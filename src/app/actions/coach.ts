"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import type {
  Membresia,
  EstadoPrograma,
  TipoObjetivo,
  EstadoObjetivo,
  TipoPlanificacion,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { avisar } from "@/lib/aviso";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import {
  evaluarLogros,
  otorgarLogroATodosLosAlumnos,
  otorgarLogrosManualesIniciales,
} from "@/lib/gamificacion";
import { TAG_CATALOGO_EJERCICIOS } from "@/lib/catalogos";
import {
  CAMPOS_PERFIL_COMPOSICION,
  type CampoPerfilComposicion,
} from "@/lib/composicion-corporal";
import { subirFotoProgreso } from "@/lib/storage";
import { extraerComposicionDeTexto, extraerFechaDeTexto } from "@/lib/parseo-composicion-corporal";
import { registrarAuditoria } from "@/lib/auditoria";
import { urlSegura } from "@/lib/video";
import { NOMBRE_LEVANTAMIENTO, PASOS_REDONDEO, type Levantamiento } from "@/lib/progresion-fuerza";
import { obtenerRmVigentes, cargasAfectadasPorRm } from "@/lib/rm-referencia";
import {
  calcularPeriodoMembresia,
  diasMembresiaValidos,
  DIAS_MEMBRESIA_MIN,
  DIAS_MEMBRESIA_MAX,
  obtenerPlanBlackfit,
} from "@/lib/membresia";
import {
  obtenerOCrearDia,
  numeroDiaValido,
  guardarContenidoDia,
  clonarEjerciciosEnDia,
  ErrorPlan,
  INCLUDE_DIA_CLONABLE,
  type ItemDiaEntrada,
} from "@/lib/plan-dia-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSinteticoAlumno } from "@/lib/importarBeneficiarios";

const TIPOS_OBJETIVO: TipoObjetivo[] = [
  "volumen",
  "frecuencia",
  "habito",
  "peso_corporal",
  "custom",
];
const ESTADOS_OBJETIVO: EstadoObjetivo[] = [
  "activo",
  "cumplido",
  "vencido",
  "cancelado",
];

export type EstadoCoach = { error?: string; message?: string } | undefined;

// especialidad/biografía son propias de Entrenador (no de Usuario, que ya
// se edita con actualizarInformacionPersonal en actions/usuario.ts).
export async function actualizarPerfilEntrenador(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const especialidad = String(formData.get("especialidad") ?? "").trim() || null;
  const biografia = String(formData.get("biografia") ?? "").trim() || null;
  const alias_pago = String(formData.get("alias_pago") ?? "").trim() || null;
  const mensaje_membresia = String(formData.get("mensaje_membresia") ?? "").trim() || null;
  // Redondeo de las cargas calculadas con el 1RM (según los discos del gimnasio).
  const redondeoCrudo = Number(String(formData.get("redondeo_carga_kg") ?? "").replace(",", "."));
  const redondeo_carga_kg = (PASOS_REDONDEO as readonly number[]).includes(redondeoCrudo)
    ? redondeoCrudo
    : undefined;

  await prisma.entrenador.update({
    where: { id_entrenador: contexto.id_entrenador },
    data: {
      especialidad,
      biografia,
      alias_pago,
      mensaje_membresia,
      ...(redondeo_carga_kg !== undefined ? { redondeo_carga_kg } : {}),
    },
  });
  if (redondeo_carga_kg !== undefined) {
    // Las cargas se calculan al mostrar el plan: cambian en las próximas sesiones.
    revalidatePath("/panel/entrenamientos");
  }

  await avisar("Perfil actualizado.");
  revalidatePath("/coach/perfil");
  return { message: "Perfil actualizado." };
}

export async function vincularAlumno(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Ingresá un email." };

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { roles: true, alumno: true },
  });

  if (!usuario) {
    return { error: "No existe un usuario con ese email." };
  }
  const esAlumno = usuario.roles.some((r) => r.rol === "alumno");
  if (!esAlumno || !usuario.alumno) {
    return { error: "Ese usuario no tiene un perfil de alumno activo." };
  }

  const relacionExistente = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: {
        id_entrenador: contexto.id_entrenador,
        id_alumno: usuario.alumno.id_alumno,
      },
    },
  });

  if (relacionExistente?.estado_relacion === "activa") {
    return { error: "Ese alumno ya está vinculado a tu cartera." };
  }

  if (relacionExistente) {
    await prisma.relacionEntrenadorAlumno.update({
      where: { id_relacion: relacionExistente.id_relacion },
      data: { estado_relacion: "activa", fecha_fin: null },
    });
  } else {
    await prisma.relacionEntrenadorAlumno.create({
      data: {
        id_entrenador: contexto.id_entrenador,
        id_alumno: usuario.alumno.id_alumno,
      },
    });
  }

  await avisar("Alumno vinculado.");
  redirect("/coach/alumnos");
}

// Alta de un alumno que todavía no tiene cuenta (no pasó por /registro):
// el coach le crea el usuario directo, con contraseña = DNI (mismo
// mecanismo que los beneficiarios importados de Kuntur — ver
// importarFilaBeneficiario en actions/admin.ts). El alumno después entra
// con su DNI (ver iniciarSesion en actions/auth.ts) y completa su perfil
// desde /panel. A diferencia del import de beneficiarios, acá un DNI que
// ya existe es un error en vez de actualizarse: el coach no debe poder
// pisar los datos de una cuenta ajena solo por adivinar su DNI — para
// vincular a alguien que ya tiene cuenta está vincularAlumno (por email).
export async function crearYVincularAlumno(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const dniRaw = String(formData.get("dni") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const vincular = formData.get("vincular") === "on";

  if (!nombre || !apellido || !dniRaw) {
    return { error: "Completá nombre, apellido y DNI." };
  }

  const dni = dniRaw.replace(/\D/g, "");
  if (dni.length < 6) {
    return { error: "El DNI debe tener al menos 6 dígitos: se usa como contraseña inicial." };
  }

  const dniEnUso = await prisma.usuario.findUnique({ where: { dni } });
  if (dniEnUso) {
    return {
      error: "Ya existe una cuenta con ese DNI. Buscala por email y usá \"Vincular\" en vez de crearla de nuevo.",
    };
  }

  const email = emailRaw || emailSinteticoAlumno(dni);
  if (emailRaw) {
    const emailEnUso = await prisma.usuario.findUnique({ where: { email } });
    if (emailEnUso) return { error: "Ese email ya está en uso por otra cuenta." };
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: dni,
    email_confirm: true,
    user_metadata: { nombre, apellido, dni },
  });
  if (error || !data.user) {
    return { error: `No se pudo crear la cuenta: ${error?.message ?? "error desconocido"}` };
  }

  const id_usuario = data.user.id;
  const usuario = await prisma.usuario.create({
    data: {
      id_usuario,
      email,
      dni,
      nombre,
      apellido,
      roles: { create: { rol: "alumno" } },
      alumno: { create: {} },
    },
    include: { alumno: true },
  });

  if (usuario.alumno) {
    await otorgarLogrosManualesIniciales(usuario.alumno.id_alumno);
  }

  if (vincular && usuario.alumno) {
    await prisma.relacionEntrenadorAlumno.create({
      data: { id_entrenador: contexto.id_entrenador, id_alumno: usuario.alumno.id_alumno },
    });
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "alta_alumno_coach",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: vincular ? "creado_y_vinculado" : "creado",
  });

  await avisar(vincular ? "Alumno creado y vinculado." : "Alumno creado.");
  revalidatePath("/coach/alumnos");
  redirect("/coach/alumnos");
}

// No borra la relación ni el historial del alumno — solo corta el
// vínculo activo (mismo criterio que ya usa el resto de la app: nunca
// destruir datos reales por una acción de baja). vincularAlumno ya sabe
// reactivar una relación "finalizada" si el alumno vuelve.
export async function desvincularAlumno(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_alumno = String(formData.get("id_alumno") ?? "");
  if (!id_alumno) return;

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
  });
  if (!relacion || relacion.estado_relacion !== "activa") return;

  await prisma.relacionEntrenadorAlumno.update({
    where: { id_relacion: relacion.id_relacion },
    data: { estado_relacion: "finalizada", fecha_fin: new Date() },
  });

  await avisar("Alumno desvinculado.", "eliminado");
  revalidatePath("/coach/alumnos");
  redirect("/coach/alumnos");
}

// ------------------------------------------------------------
// MEMBRESÍAS DE BLACKFIT (desde el panel del coach)
// El pago es por fuera de la plataforma; el coach elige de 1 a 30 días y
// confirma, y el sistema calcula todo con la hora del servidor. Cada
// activación/renovación crea una membresía NUEVA (nunca pisa la anterior),
// así queda el historial completo con quién la hizo y por cuántos días.
// ------------------------------------------------------------

export type EstadoMembresiaCoach = { error?: string; message?: string; ok?: boolean } | undefined;

/** Relación activa coach↔alumno con el usuario del alumno, o null. */
async function relacionActivaConAlumno(id_entrenador: string, id_alumno: string) {
  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: { id_entrenador_id_alumno: { id_entrenador, id_alumno } },
    include: { alumno: { include: { usuario: true } } },
  });
  return relacion?.estado_relacion === "activa" ? relacion : null;
}

function revalidarMembresia(id_alumno: string) {
  revalidatePath("/coach/alumnos");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  // El alumno recupera (o pierde) el acceso en su próxima carga: sus
  // pantallas leen el estado real de la membresía en cada request.
  revalidatePath("/panel", "layout");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Activa o renueva la membresía de Blackfit por 1 a 30 días.
 * - Vigente: los días se suman a su vencimiento (no se pierde ninguno).
 * - Vencida, suspendida o sin membresía: el período empieza ahora.
 */
export async function activarMembresiaBlackfit(
  _prev: EstadoMembresiaCoach,
  formData: FormData
): Promise<EstadoMembresiaCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const dias = diasMembresiaValidos(formData.get("dias"));
  const claveCruda = String(formData.get("clave_operacion") ?? "");
  const clave_operacion = UUID.test(claveCruda) ? claveCruda : null;
  if (!id_alumno) return { error: "Datos inválidos." };
  if (dias === null) {
    return { error: `Elegí una duración entre ${DIAS_MEMBRESIA_MIN} y ${DIAS_MEMBRESIA_MAX} días.` };
  }

  const relacion = await relacionActivaConAlumno(contexto.id_entrenador, id_alumno);
  if (!relacion) return { error: "Ese alumno no está vinculado a tu cartera." };
  const id_usuario = relacion.alumno.id_usuario;

  // Siempre el plan de BLACKFIT: nunca se mezcla con las membresías de Kuntur.
  const { id_plan_membresia } = await obtenerPlanBlackfit();

  let resultado: { repetida: true } | { repetida: false; membresia: Membresia; renovacion: boolean };
  try {
    // Una operación por vez y por alumno: el lock serializa pedidos
    // simultáneos (doble clic, dos pestañas) y clave_operacion (única)
    // descarta el mismo pedido repetido. Así nunca se suman días de más.
    resultado = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membresia:${id_usuario}`}))`;

      if (clave_operacion) {
        const ya = await tx.membresia.findUnique({ where: { clave_operacion }, select: { id_membresia: true } });
        if (ya) return { repetida: true as const };
      }

      const ahora = new Date();
      const vigentes = await tx.membresia.findMany({
        where: {
          id_usuario,
          estado_membresia: "activa",
          fecha_vencimiento_membresia: { gt: ahora },
          plan_membresia: { organizacion: "blackfit" },
        },
        select: { fecha_vencimiento_membresia: true },
      });
      const vencimientoVigente = vigentes.length
        ? new Date(Math.max(...vigentes.map((m) => m.fecha_vencimiento_membresia.getTime())))
        : null;
      const periodo = calcularPeriodoMembresia(dias, vencimientoVigente, ahora);

      // Las que quedaron "activa" con la fecha ya pasada pasan a "vencida",
      // así el historial refleja lo que realmente ocurrió.
      await tx.membresia.updateMany({
        where: {
          id_usuario,
          estado_membresia: "activa",
          fecha_vencimiento_membresia: { lte: ahora },
          plan_membresia: { organizacion: "blackfit" },
        },
        data: { estado_membresia: "vencida" },
      });
      const membresia = await tx.membresia.create({
        data: {
          id_usuario,
          id_plan_membresia,
          estado_membresia: "activa",
          fecha_inicio_membresia: periodo.inicio,
          fecha_vencimiento_membresia: periodo.vencimiento,
          dias_contratados: dias,
          tipo_operacion: periodo.renovacion ? "renovacion" : "activacion",
          id_usuario_operador: contexto.usuario.id_usuario,
          clave_operacion,
        },
      });
      return { repetida: false as const, membresia, renovacion: periodo.renovacion };
    });
  } catch (e) {
    // Dos envíos simultáneos con la misma clave: el segundo choca con el
    // índice único. El primero ya la guardó.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      resultado = { repetida: true };
    } else {
      console.error("[coach] activarMembresiaBlackfit:", e);
      return { error: "No se pudo guardar la membresía. Probá de nuevo." };
    }
  }

  if (resultado.repetida) {
    revalidarMembresia(id_alumno);
    return { ok: true, message: "Esa operación ya se había registrado. No se sumaron días de nuevo." };
  }
  const { membresia, renovacion } = resultado;
  const textoDias = `${dias} día${dias === 1 ? "" : "s"}`;

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: membresia.id_membresia,
    resultado: `${renovacion ? "renovada" : "activada"}_${dias}_dias_por_coach`,
  }).catch(() => {});

  await crearNotificacion({
    id_usuario,
    titulo: renovacion ? "Membresía renovada" : "Membresía activada",
    contenido: renovacion
      ? `Tu coach renovó tu membresía: ${textoDias} más al terminar tu período actual.`
      : `Tu coach activó ${textoDias} de acceso a tu entrenamiento. ¡A entrenar!`,
    tipo: "membresia_activada",
    url: "/panel",
  }).catch(() => {});

  const mensaje = renovacion
    ? `Membresía renovada: ${textoDias} más para ${relacion.alumno.usuario.nombre}.`
    : `Membresía activada: ${textoDias} para ${relacion.alumno.usuario.nombre}.`;
  await avisar(mensaje);
  revalidarMembresia(id_alumno);
  return { ok: true, message: mensaje };
}

/**
 * Suspensión manual: bloquea el entrenamiento sin borrar nada (perfil,
 * planificación e historial quedan intactos). Se distingue del vencimiento
 * automático por el estado "suspendida" y la fecha/autor de la suspensión.
 * El vencimiento no se corre: si se reanuda dentro del período, sigue
 * hasta la misma fecha.
 */
export async function suspenderMembresiaBlackfit(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;
  const id_alumno = String(formData.get("id_alumno") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 200) || null;
  const relacion = id_alumno ? await relacionActivaConAlumno(contexto.id_entrenador, id_alumno) : null;
  if (!relacion) return;

  const ahora = new Date();
  const vigentes = await prisma.membresia.findMany({
    where: {
      id_usuario: relacion.alumno.id_usuario,
      estado_membresia: "activa",
      fecha_vencimiento_membresia: { gt: ahora },
      plan_membresia: { organizacion: "blackfit" },
    },
    select: { id_membresia: true },
  });
  if (vigentes.length === 0) {
    await avisar("No tiene una membresía activa para suspender.", "info");
    return;
  }
  await prisma.membresia.updateMany({
    where: { id_membresia: { in: vigentes.map((m) => m.id_membresia) } },
    data: {
      estado_membresia: "suspendida",
      fecha_suspension: ahora,
      motivo_suspension: motivo,
      id_usuario_suspension: contexto.usuario.id_usuario,
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: vigentes[0].id_membresia,
    resultado: "suspendida_por_coach",
  }).catch(() => {});

  await crearNotificacion({
    id_usuario: relacion.alumno.id_usuario,
    titulo: "Membresía suspendida",
    contenido: "Tu servicio de entrenamiento está suspendido. Contactá a tu entrenador para consultar el estado de tu membresía.",
    tipo: "membresia_suspendida",
    url: "/membresia-vencida",
  }).catch(() => {});

  await avisar(`Membresía de ${relacion.alumno.usuario.nombre} suspendida.`, "info");
  revalidarMembresia(id_alumno);
}

/** Levanta la suspensión manual si el período todavía no terminó. */
export async function reanudarMembresiaBlackfit(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;
  const id_alumno = String(formData.get("id_alumno") ?? "");
  const relacion = id_alumno ? await relacionActivaConAlumno(contexto.id_entrenador, id_alumno) : null;
  if (!relacion) return;

  const ahora = new Date();
  const suspendidas = await prisma.membresia.findMany({
    where: {
      id_usuario: relacion.alumno.id_usuario,
      estado_membresia: "suspendida",
      fecha_vencimiento_membresia: { gt: ahora },
      plan_membresia: { organizacion: "blackfit" },
    },
    select: { id_membresia: true },
  });
  if (suspendidas.length === 0) {
    await avisar("El período ya terminó: renová la membresía para habilitar el acceso.", "info");
    revalidarMembresia(id_alumno);
    return;
  }
  await prisma.membresia.updateMany({
    where: { id_membresia: { in: suspendidas.map((m) => m.id_membresia) } },
    data: { estado_membresia: "activa" },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: suspendidas[0].id_membresia,
    resultado: "reanudada_por_coach",
  }).catch(() => {});

  await crearNotificacion({
    id_usuario: relacion.alumno.id_usuario,
    titulo: "Membresía reactivada",
    contenido: "Tu coach levantó la suspensión: ya podés volver a entrenar.",
    tipo: "membresia_activada",
    url: "/panel",
  }).catch(() => {});

  await avisar(`Membresía de ${relacion.alumno.usuario.nombre} reactivada.`);
  revalidarMembresia(id_alumno);
}

export async function crearEjercicio(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const grupo_muscular = String(formData.get("grupo_muscular") ?? "").trim() || null;
  const video_url = urlSegura(String(formData.get("video_url") ?? "").trim());
  if (video_url === undefined) return { error: "El link del video no es válido (debe empezar con https://)." };
  const instrucciones = String(formData.get("instrucciones") ?? "").trim() || null;

  const series_defaultRaw = String(formData.get("series_default") ?? "").trim();
  const repeticiones_default = String(formData.get("repeticiones_default") ?? "").trim() || null;
  const peso_sugerido_defaultRaw = String(formData.get("peso_sugerido_default") ?? "").trim();
  const tempo_default = String(formData.get("tempo_default") ?? "").trim() || null;
  const descanso_default = String(formData.get("descanso_default") ?? "").trim() || null;
  const metodo_entrenamiento_default =
    String(formData.get("metodo_entrenamiento_default") ?? "").trim() || null;
  const tut_defaultRaw = String(formData.get("tiempo_bajo_tension_default") ?? "").trim();

  await prisma.ejercicio.create({
    data: {
      nombre,
      descripcion,
      grupo_muscular,
      video_url,
      instrucciones,
      series_default: series_defaultRaw ? Number(series_defaultRaw) : null,
      repeticiones_default,
      peso_sugerido_default: peso_sugerido_defaultRaw || null,
      tempo_default,
      descanso_default,
      metodo_entrenamiento_default,
      tiempo_bajo_tension_default: tut_defaultRaw ? Number(tut_defaultRaw) : null,
    },
  });

  await avisar("Ejercicio creado.");
  updateTag(TAG_CATALOGO_EJERCICIOS);
  redirect("/coach/ejercicios");
}

export async function editarEjercicio(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_ejercicio = String(formData.get("id_ejercicio") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id_ejercicio || !nombre) return { error: "El nombre es obligatorio." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const grupo_muscular = String(formData.get("grupo_muscular") ?? "").trim() || null;
  const video_url = urlSegura(String(formData.get("video_url") ?? "").trim());
  if (video_url === undefined) return { error: "El link del video no es válido (debe empezar con https://)." };
  const instrucciones = String(formData.get("instrucciones") ?? "").trim() || null;

  const series_defaultRaw = String(formData.get("series_default") ?? "").trim();
  const repeticiones_default = String(formData.get("repeticiones_default") ?? "").trim() || null;
  const peso_sugerido_defaultRaw = String(formData.get("peso_sugerido_default") ?? "").trim();
  const tempo_default = String(formData.get("tempo_default") ?? "").trim() || null;
  const descanso_default = String(formData.get("descanso_default") ?? "").trim() || null;
  const metodo_entrenamiento_default =
    String(formData.get("metodo_entrenamiento_default") ?? "").trim() || null;
  const tut_defaultRaw = String(formData.get("tiempo_bajo_tension_default") ?? "").trim();

  await prisma.ejercicio.update({
    where: { id_ejercicio },
    data: {
      nombre,
      descripcion,
      grupo_muscular,
      video_url,
      instrucciones,
      series_default: series_defaultRaw ? Number(series_defaultRaw) : null,
      repeticiones_default,
      peso_sugerido_default: peso_sugerido_defaultRaw || null,
      tempo_default,
      descanso_default,
      metodo_entrenamiento_default,
      tiempo_bajo_tension_default: tut_defaultRaw ? Number(tut_defaultRaw) : null,
    },
  });

  await avisar("Ejercicio actualizado.");
  updateTag(TAG_CATALOGO_EJERCICIOS);
  redirect("/coach/ejercicios");
}

// No se borra si ya se usó en algún bloque de algún programa (real o
// plantilla) — eso rompería el historial de series ya registradas contra
// ese ejercicio. Se puede seguir editando igual.
export async function eliminarEjercicio(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_ejercicio = String(formData.get("id_ejercicio") ?? "");
  if (!id_ejercicio) return { error: "Ejercicio inválido." };

  const forzar = formData.get("forzar") === "1";

  const usos = await prisma.ejercicioPrograma.count({ where: { id_ejercicio } });
  if (usos > 0 && !forzar) {
    return {
      error: `No se puede eliminar: ya se usó en ${usos} programa(s)/plantilla(s). Editalo si hace falta corregirlo, o forzá el borrado más abajo si estás seguro — se pierde el historial real de series que los alumnos ya registraron con ese ejercicio.`,
    };
  }

  // El count() de arriba da el mensaje detallado en el caso común, pero no
  // cubre una fila creada justo entre el count() y este delete() — sin este
  // try/catch, esa carrera (o cualquier otro error de Prisma) tiraba una
  // excepción sin capturar y el cliente veía "unexpected response" en vez
  // de un mensaje.
  try {
    if (usos > 0) {
      // Forzado: el coach ya vio la advertencia de arriba y decidió
      // borrar igual. Se pierde el historial real de series contra ese
      // ejercicio en esos programas/plantillas — es intencional, no un
      // efecto secundario.
      await prisma.$transaction([
        prisma.serieEntrenamiento.deleteMany({ where: { ejercicio_programa: { id_ejercicio } } }),
        prisma.ejercicioPrograma.deleteMany({ where: { id_ejercicio } }),
        prisma.ejercicio.delete({ where: { id_ejercicio } }),
      ]);
    } else {
      await prisma.ejercicio.delete({ where: { id_ejercicio } });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        error: "No se puede eliminar: ya se usó en un programa/plantilla. Editalo si hace falta corregirlo.",
      };
    }
    throw err;
  }

  await avisar("Ejercicio eliminado.", "eliminado");
  updateTag(TAG_CATALOGO_EJERCICIOS);
  redirect("/coach/ejercicios");
}

// Nunca deben quedar dos programas "activos" a la vez para el mismo
// alumno — obtenerOCrearProgramaActivo() y el listado de /coach/alumnos
// (columna "Programa") asumen que hay uno solo, y con dos activos cuál se
// muestra queda no determinístico. Se llama antes de dejar un programa
// nuevo (o recién editado) como activo, así el anterior pasa a
// "finalizado" solo — nunca se borra ni se pierde su historial.
async function finalizarProgramaActivoPrevio(
  id_alumno: string,
  excluirIdPrograma?: string
): Promise<void> {
  await prisma.programaEntrenamiento.updateMany({
    where: {
      id_alumno,
      estado_programa: "activo",
      es_plantilla: false,
      ...(excluirIdPrograma ? { id_programa: { not: excluirIdPrograma } } : {}),
    },
    data: { estado_programa: "finalizado" },
  });
}

export async function crearPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const fecha_inicio = String(formData.get("fecha_inicio") ?? "");
  const fecha_finRaw = String(formData.get("fecha_fin") ?? "");
  const estado_programa = String(formData.get("estado_programa") ?? "activo") as EstadoPrograma;

  if (!id_alumno || !nombre || !fecha_inicio) {
    return { error: "Completá alumno, nombre y fecha de inicio." };
  }

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
    include: { alumno: { include: { usuario: true } } },
  });
  if (!relacion || relacion.estado_relacion !== "activa") {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  if (estado_programa === "activo") {
    await finalizarProgramaActivoPrevio(id_alumno);
  }

  const programa = await prisma.programaEntrenamiento.create({
    data: {
      id_alumno,
      id_entrenador: contexto.id_entrenador,
      nombre,
      descripcion,
      objetivo,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_finRaw ? new Date(fecha_finRaw) : null,
      estado_programa,
    },
  });

  await crearNotificacion({
    id_usuario: relacion.alumno.usuario.id_usuario,
    titulo: "Tenés un programa nuevo",
    contenido: `${contexto.usuario.nombre} te asignó "${nombre}". Todavía no tiene ejercicios cargados — te va a avisar cuando esté lista.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  await avisar(`Programa "${nombre}" creado.`);
  redirect(`/coach/programas/${programa.id_programa}`);
}

export async function editarPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const fecha_inicio = String(formData.get("fecha_inicio") ?? "");
  const fecha_finRaw = String(formData.get("fecha_fin") ?? "");
  const estado_programa = String(formData.get("estado_programa") ?? "activo") as EstadoPrograma;

  if (!id_programa || !nombre || !fecha_inicio) {
    return { error: "Completá nombre y fecha de inicio." };
  }

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
  });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || programa.es_plantilla) {
    return { error: "No autorizado sobre este programa." };
  }

  if (estado_programa === "activo" && programa.id_alumno) {
    await finalizarProgramaActivoPrevio(programa.id_alumno, id_programa);
  }

  await prisma.programaEntrenamiento.update({
    where: { id_programa },
    data: {
      nombre,
      descripcion,
      objetivo,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_finRaw ? new Date(fecha_finRaw) : null,
      estado_programa,
    },
  });

  await avisar("Programa actualizado.");
  revalidatePath(`/coach/programas/${id_programa}`);
  redirect(`/coach/programas/${id_programa}`);
}

// Borrado definitivo de un programa real (nunca de una plantilla, para eso
// está eliminarPlantilla). Si el alumno ya registró algún entrenamiento
// contra este programa, Postgres rechaza el borrado (ON DELETE NO ACTION
// entre Entrenamiento y ProgramaEntrenamiento) — en ese caso conviene
// marcarlo "finalizado" desde /editar en vez de borrarlo, así no se pierde
// el historial de lo que el alumno ya entrenó.
export async function eliminarPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  if (!id_programa) return { error: "Programa inválido." };

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
  });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || programa.es_plantilla) {
    return { error: "No autorizado sobre este programa." };
  }

  try {
    await prisma.programaEntrenamiento.delete({ where: { id_programa } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        error:
          'No se puede eliminar: el alumno ya registró entrenamientos contra este programa. Marcalo como "finalizado" en vez de borrarlo.',
      };
    }
    throw err;
  }

  await avisar("Programa eliminado.", "eliminado");
  revalidatePath("/coach/alumnos");
  redirect(programa.id_alumno ? `/coach/alumnos/${programa.id_alumno}` : "/coach/alumnos");
}

// ------------------------------------------------------------
// BIBLIOTECA DE PROGRAMAS (plantillas)
// ------------------------------------------------------------
// Una plantilla es un ProgramaEntrenamiento sin alumno todavía
// (id_alumno null, es_plantilla true). Se arma una sola vez — con sus
// bloques y ejercicios — y se "aplica" a cada alumno que la necesite, en
// vez de rehacer todo desde cero para cada uno. crearBloque,
// crearEjercicioPrograma, duplicarBloque, eliminarBloque, etc. funcionan
// sin cambios sobre una plantilla: solo validan `programa.id_entrenador`,
// nunca al alumno.

export async function crearPlantillaPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;

  if (!nombre) return { error: "Completá el nombre de la plantilla." };

  const plantilla = await prisma.programaEntrenamiento.create({
    data: {
      id_entrenador: contexto.id_entrenador,
      nombre,
      descripcion,
      objetivo,
      fecha_inicio: new Date(),
      es_plantilla: true,
    },
  });

  await avisar("Plantilla creada.");
  redirect(`/coach/programas/plantillas/${plantilla.id_programa}`);
}

export async function editarPlantillaPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_plantilla = String(formData.get("id_plantilla") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;

  if (!id_plantilla || !nombre) return { error: "Completá el nombre de la plantilla." };

  const plantilla = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa: id_plantilla },
  });
  // La biblioteca de plantillas es compartida entre todos los coaches
  // (igual que la de ejercicios y la de logros) — cualquier coach puede
  // editar cualquier plantilla, no hace falta que sea quien la creó.
  if (!plantilla || !plantilla.es_plantilla) {
    return { error: "Plantilla inválida." };
  }

  await prisma.programaEntrenamiento.update({
    where: { id_programa: id_plantilla },
    data: { nombre, descripcion, objetivo },
  });

  await avisar("Plantilla actualizada.");
  revalidatePath(`/coach/programas/plantillas/${id_plantilla}`);
  revalidatePath("/coach/programas/plantillas");
  return { message: "Plantilla actualizada." };
}

export async function eliminarPlantilla(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_plantilla = String(formData.get("id_plantilla") ?? "");
  if (!id_plantilla) return;

  const plantilla = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa: id_plantilla },
  });
  // Biblioteca compartida: cualquier coach puede borrar cualquier
  // plantilla (mismo criterio que editarPlantillaPrograma).
  if (!plantilla || !plantilla.es_plantilla) return;

  await prisma.programaEntrenamiento.delete({ where: { id_programa: id_plantilla } });
  await avisar("Plantilla eliminada.", "eliminado");
  revalidatePath("/coach/programas/plantillas");
}

/**
 * Clona una plantilla (bloques + ejercicios incluidos) en un programa
 * real para un alumno puntual. La plantilla original queda intacta,
 * lista para aplicarse de nuevo con el próximo alumno.
 */
export async function aplicarPlantilla(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_plantilla = String(formData.get("id_plantilla") ?? "");
  const id_alumno = String(formData.get("id_alumno") ?? "");
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");

  if (!id_plantilla || !id_alumno) {
    return { error: "Elegí un alumno." };
  }

  const [plantilla, relacion] = await Promise.all([
    prisma.programaEntrenamiento.findUnique({
      where: { id_programa: id_plantilla },
      include: { bloques: { include: INCLUDE_DIA_CLONABLE, orderBy: { orden: "asc" } } },
    }),
    prisma.relacionEntrenadorAlumno.findUnique({
      where: {
        id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
      },
      include: { alumno: { include: { usuario: true } } },
    }),
  ]);

  // Biblioteca compartida: cualquier coach puede aplicar cualquier
  // plantilla a un alumno de SU propia cartera (eso sí se sigue
  // validando abajo, vía `relacion`).
  if (!plantilla || !plantilla.es_plantilla) {
    return { error: "Plantilla inválida." };
  }
  if (!relacion || relacion.estado_relacion !== "activa") {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  await finalizarProgramaActivoPrevio(id_alumno);

  // Se clona día por día (con sus bloques/superseries) dentro de una
  // transacción, en vez de un create anidado: los bloques necesitan su
  // id nuevo antes de poder colgarles los ejercicios.
  const programa = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.programaEntrenamiento.create({
      data: {
        id_alumno,
        id_entrenador: contexto.id_entrenador,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        objetivo: plantilla.objetivo,
        tipo_planificacion: plantilla.tipo_planificacion,
        fecha_inicio: fecha_inicioRaw ? new Date(fecha_inicioRaw) : new Date(),
        estado_programa: "activo",
      },
    });
    await clonarDiasDePrograma(tx, nuevo.id_programa, plantilla.bloques);
    return nuevo;
  });

  await crearNotificacion({
    id_usuario: relacion.alumno.usuario.id_usuario,
    titulo: "Tenés un programa nuevo",
    contenido: `${contexto.usuario.nombre} te asignó "${plantilla.nombre}", ya con los ejercicios cargados — arrancá cuando quieras.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  await avisar("Plantilla aplicada al alumno.");
  redirect(`/coach/programas/${programa.id_programa}`);
}

/**
 * Inversa de aplicarPlantilla: clona un programa real (con sus bloques y
 * ejercicios) en una plantilla nueva, para poder reusarlo con otros
 * alumnos sin rehacerlo desde cero. El programa original del alumno no se
 * toca — queda una copia independiente en la biblioteca compartida.
 */
export async function guardarComoPlantilla(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  if (!id_programa) return { error: "Programa inválido." };

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
    include: { bloques: { include: INCLUDE_DIA_CLONABLE, orderBy: { orden: "asc" } } },
  });

  if (!programa || programa.id_entrenador !== contexto.id_entrenador || programa.es_plantilla) {
    return { error: "No autorizado sobre este programa." };
  }

  const plantilla = await prisma.$transaction(async (tx) => {
    const nueva = await tx.programaEntrenamiento.create({
      data: {
        id_entrenador: contexto.id_entrenador,
        nombre: programa.nombre,
        descripcion: programa.descripcion,
        objetivo: programa.objetivo,
        tipo_planificacion: programa.tipo_planificacion,
        fecha_inicio: new Date(),
        es_plantilla: true,
      },
    });
    await clonarDiasDePrograma(tx, nueva.id_programa, programa.bloques);
    return nueva;
  });

  await avisar("Programa guardado como plantilla.");
  redirect(`/coach/programas/plantillas/${plantilla.id_programa}`);
}

// Copia todos los días de un programa a otro (plantilla ⇄ programa real)
// conservando semanas, día de la semana y bloques/superseries.
async function clonarDiasDePrograma(
  tx: Prisma.TransactionClient,
  id_programa_destino: string,
  bloques: Prisma.BloqueEntrenamientoGetPayload<{ include: typeof INCLUDE_DIA_CLONABLE }>[]
) {
  for (const b of bloques) {
    const nuevo = await tx.bloqueEntrenamiento.create({
      data: {
        id_programa: id_programa_destino,
        nombre: b.nombre,
        orden: b.orden,
        semana_inicio: b.semana_inicio,
        semana_fin: b.semana_fin,
        tipo: b.tipo,
        dia_semana: b.dia_semana,
        numero_dia: b.numero_dia,
      },
    });
    await clonarEjerciciosEnDia(tx, nuevo.id_bloque, b.ejercicios_programa, b.grupos);
  }
}

// ------------------------------------------------------------
// PLANIFICACIÓN POR SESIONES — pantalla "Planificación" del perfil del
// alumno. Cada BloqueEntrenamiento con numero_dia es una sesión "Día N"
// dentro de un rango de semanas (1-4): el ORDEN de la sesión, no un día
// del calendario (ver lib/secuencia.ts). El historial real
// (Entrenamiento/SerieEntrenamiento) no se altera nunca desde acá.
// ------------------------------------------------------------

/** El programa activo (no plantilla) del alumno con este coach, creándolo si hace falta. */
// Al estar exportada desde un archivo "use server" también es invocable
// como server action desde afuera: se valida que quien llama sea ese
// mismo coach y que el alumno sea suyo.
export async function obtenerOCrearProgramaActivo(id_alumno: string, id_entrenador: string) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto || contexto.id_entrenador !== id_entrenador) {
    throw new Error("No autorizado.");
  }
  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: { id_entrenador_id_alumno: { id_entrenador, id_alumno } },
    select: { estado_relacion: true },
  });
  if (relacion?.estado_relacion !== "activa") throw new Error("No autorizado.");

  const existente = await prisma.programaEntrenamiento.findFirst({
    where: { id_alumno, id_entrenador, estado_programa: "activo", es_plantilla: false },
    orderBy: { fecha_inicio: "desc" },
  });
  if (existente) return existente;

  return prisma.programaEntrenamiento.create({
    data: {
      id_alumno,
      id_entrenador,
      nombre: "Plan mensual",
      fecha_inicio: new Date(),
      estado_programa: "activo",
      tipo_planificacion: "fija",
    },
  });
}

export async function establecerTipoPlanificacion(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_programa = String(formData.get("id_programa") ?? "");
  const tipo = String(formData.get("tipo_planificacion") ?? "") as TipoPlanificacion;
  if (!id_programa || !["fija", "semanal", "personalizada"].includes(tipo)) return;

  const programa = await prisma.programaEntrenamiento.findUnique({ where: { id_programa } });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador) return;

  await prisma.programaEntrenamiento.update({
    where: { id_programa },
    data: {
      tipo_planificacion: tipo,
      // Progresión semanal: el ciclo de 4 semanas empieza a contar desde
      // que se elige (si nunca tuvo uno). Cambiar de tipo no lo reinicia.
      ...(tipo === "semanal" && !programa.fecha_inicio_ciclo ? { fecha_inicio_ciclo: new Date() } : {}),
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_tipo_planificacion",
    recurso: "programa",
    id_recurso: id_programa,
    resultado: `${programa.tipo_planificacion}->${tipo}`,
  }).catch(() => {});

  await avisar("Tipo de planificación actualizado.");
  revalidatePath(`/coach/alumnos/${programa.id_alumno}`);
  revalidatePath("/panel");
  revalidatePath("/panel/entrenamientos");
}

/**
 * Control explícito del ciclo de 4 semanas de la Progresión semanal:
 * - pausar: la semana deja de avanzar (el plan sigue visible).
 * - reanudar: sigue desde la misma semana (se corre el inicio lo que duró
 *   la pausa).
 * - reiniciar: vuelve a la semana 1 desde hoy.
 * Nunca toca entrenamientos hechos ni cargas reales. Renovar la membresía
 * tampoco reinicia el ciclo: solo esto lo hace. Queda en la auditoría.
 */
export async function controlarCicloFuerza(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_programa = String(formData.get("id_programa") ?? "");
  const accion = String(formData.get("accion") ?? "");
  if (!id_programa || !["pausar", "reanudar", "reiniciar"].includes(accion)) return;

  const programa = await prisma.programaEntrenamiento.findUnique({ where: { id_programa } });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || programa.es_plantilla) return;

  const ahora = new Date();
  const inicio = programa.fecha_inicio_ciclo ?? programa.fecha_inicio;
  let data: Prisma.ProgramaEntrenamientoUpdateInput;
  let mensaje: string;
  if (accion === "pausar") {
    if (programa.fecha_pausa) return;
    data = { fecha_pausa: ahora, fecha_inicio_ciclo: inicio };
    mensaje = "Ciclo pausado: la semana no avanza hasta que lo reanudes.";
  } else if (accion === "reanudar") {
    if (!programa.fecha_pausa) return;
    const pausa = ahora.getTime() - programa.fecha_pausa.getTime();
    data = { fecha_pausa: null, fecha_inicio_ciclo: new Date(inicio.getTime() + Math.max(0, pausa)) };
    mensaje = "Ciclo reanudado desde la misma semana.";
  } else {
    data = { fecha_pausa: null, fecha_inicio_ciclo: ahora };
    mensaje = "Ciclo reiniciado: hoy empieza la semana 1.";
  }

  await prisma.programaEntrenamiento.update({ where: { id_programa }, data });
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "ciclo_fuerza",
    recurso: "programa",
    id_recurso: id_programa,
    resultado: accion,
  }).catch(() => {});

  await avisar(mensaje);
  revalidatePath(`/coach/alumnos/${programa.id_alumno}`);
  revalidatePath("/panel");
  revalidatePath("/panel/entrenamientos");
}

// Crea (si no existen todavía) los 7 bloques vacíos — uno por día — para
// un rango de semanas nuevo, así la grilla de la semana aparece completa
// aunque el coach todavía no haya cargado ejercicios en ningún día.
export async function crearGrupoSemanas(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_programa = String(formData.get("id_programa") ?? "");
  const semana_inicio = Number(formData.get("semana_inicio") ?? "");
  const semana_fin = Number(formData.get("semana_fin") ?? "");
  if (
    !id_programa ||
    !Number.isFinite(semana_inicio) ||
    !Number.isFinite(semana_fin) ||
    semana_inicio < 1 ||
    semana_fin > 4 ||
    semana_inicio > semana_fin
  ) {
    return;
  }

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
    include: { bloques: true },
  });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador) return;

  // El grupo arranca con su Día 1 (sesión vacía) para que aparezca en la
  // planificación; el coach agrega Día 2, Día 3... desde ahí.
  const yaTieneDias = programa.bloques.some(
    (b) => b.semana_inicio === semana_inicio && b.semana_fin === semana_fin && b.numero_dia != null
  );
  if (yaTieneDias) return;

  await prisma.bloqueEntrenamiento.create({
    data: { id_programa, nombre: "Día 1", orden: 1, semana_inicio, semana_fin, numero_dia: 1 },
  });

  await avisar("Semanas creadas.");
  revalidatePath(`/coach/alumnos/${programa.id_alumno}`);
}

// Elimina un grupo de semanas completo (los 7 días). Si algún día ya
// tiene historial real registrado por el alumno, Postgres rechaza el
// borrado de ESE bloque puntual — se avisa y no se borra nada del grupo,
// para no dejarlo a medio borrar.
export async function eliminarGrupoSemanas(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  const semana_inicio = Number(formData.get("semana_inicio") ?? "");
  const semana_fin = Number(formData.get("semana_fin") ?? "");

  const programa = await prisma.programaEntrenamiento.findUnique({ where: { id_programa } });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador) {
    return { error: "No autorizado." };
  }

  try {
    await prisma.bloqueEntrenamiento.deleteMany({
      where: { id_programa, semana_inicio, semana_fin },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        error:
          "No se puede eliminar: algún día de este grupo ya tiene entrenamientos registrados por el alumno.",
      };
    }
    throw err;
  }

  await avisar("Semanas eliminadas.", "eliminado");
  revalidatePath(`/coach/alumnos/${programa.id_alumno}`);
  return undefined;
}


export type EstadoDiaPlan = { error?: string; message?: string } | undefined;

// Reemplaza de punta a punta los ejercicios de un día puntual (semana +
// día de semana dentro de un programa). Simplifica la pantalla de
// edición a un solo botón "Guardar cambios" — arma la lista que quiere
// el coach, sin ir agregando/borrando de a uno. Si algún ejercicio que
// se iba a borrar ya tiene series reales registradas, no se borra nada:
// se avisa para que el coach edite ese día como una semana nueva en vez
// de pisar el historial.
export async function guardarDiaPlan(
  _prev: EstadoDiaPlan,
  formData: FormData
): Promise<EstadoDiaPlan> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  const semana_inicio = Number(formData.get("semana_inicio") ?? "");
  const semana_fin = Number(formData.get("semana_fin") ?? "");
  const numero_dia = numeroDiaValido(formData.get("numero_dia"));
  // Nombre de la sesión ("Tren inferior"); vacío = "Día N".
  const nombre_sesion = String(formData.get("nombre_sesion") ?? "").trim().slice(0, 60);

  let items: ItemDiaEntrada[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
    if (!Array.isArray(items)) throw new Error();
  } catch {
    return { error: "Datos inválidos." };
  }

  if (
    !id_programa ||
    !Number.isFinite(semana_inicio) ||
    !Number.isFinite(semana_fin) ||
    numero_dia === null
  ) {
    return { error: "Datos inválidos." };
  }

  const programa = await prisma.programaEntrenamiento.findUnique({ where: { id_programa } });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || !programa.id_alumno) {
    return { error: "No autorizado sobre este programa." };
  }
  const id_alumno = programa.id_alumno;

  // Todos los ejercicios tienen que existir en la biblioteca — mejor un
  // mensaje claro acá que un error de FK a mitad de la transacción.
  const idsEjercicio = new Set(
    items
      .flatMap((item) =>
        item.tipo === "grupo" ? item.ejercicios.map((e) => e.id_ejercicio) : [item.ejercicio.id_ejercicio]
      )
      .filter(Boolean)
  );
  const encontrados = await prisma.ejercicio.count({
    where: { id_ejercicio: { in: [...idsEjercicio] } },
  });
  if (encontrados !== idsEjercicio.size) {
    return { error: "Algún ejercicio ya no existe en la biblioteca. Elegilo de nuevo." };
  }
  const bloqueSinEjercicios = items.some(
    (item) => item.tipo === "grupo" && !item.ejercicios.some((e) => e.id_ejercicio)
  );
  if (bloqueSinEjercicios) {
    return { error: "Hay un bloque sin ejercicios. Agregale al menos uno o quitalo." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const dia = await obtenerOCrearDia(tx, id_programa, semana_inicio, semana_fin, numero_dia);
      await tx.bloqueEntrenamiento.update({
        where: { id_bloque: dia.id_bloque },
        data: { nombre: nombre_sesion || `Día ${numero_dia}` },
      });
      await guardarContenidoDia(tx, dia.id_bloque, items);
      // Progresión semanal: al publicar el bloque de fuerza queda registrada
      // la fecha de inicio del ciclo (si todavía no tenía una).
      if (programa.tipo_planificacion === "semanal" && !programa.fecha_inicio_ciclo) {
        await tx.programaEntrenamiento.update({
          where: { id_programa },
          data: { fecha_inicio_ciclo: new Date() },
        });
      }
    });
  } catch (e) {
    // Validación del plan (ej. falta el % de una semana): no se guardó nada.
    if (e instanceof ErrorPlan) return { error: e.message };
    throw e;
  }

  await avisar("Día guardado. El alumno ya ve los cambios.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  revalidatePath("/panel");
  revalidatePath("/panel/entrenamientos");
  redirect(`/coach/alumnos/${id_alumno}?tab=planificacion`);
}

// Copia un bloque (superserie/triserie/circuito) ya guardado a otro día
// y/o semana del mismo programa, a continuación de lo que ese día ya
// tenga. Se llama directo desde el editor del día (no es un <form>: vive
// dentro del form grande del editor).
export async function copiarBloqueADia(datos: {
  id_grupo: string;
  semana_inicio: number;
  semana_fin: number;
  numero_dia: number;
}): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const { id_grupo, semana_inicio, semana_fin } = datos;
  const numero_dia = numeroDiaValido(datos.numero_dia);
  if (
    !id_grupo ||
    numero_dia === null ||
    !Number.isInteger(semana_inicio) ||
    !Number.isInteger(semana_fin) ||
    semana_inicio < 1 ||
    semana_fin > 4 ||
    semana_inicio > semana_fin
  ) {
    return { error: "Elegí un día y una semana válidos." };
  }

  const grupo = await prisma.grupoEjercicios.findUnique({
    where: { id_grupo },
    include: {
      bloque: { include: { programa: true } },
      ejercicios: { where: { archivado: false }, orderBy: { orden: "asc" } },
    },
  });
  if (!grupo || grupo.bloque.programa.id_entrenador !== contexto.id_entrenador) {
    return { error: "No autorizado sobre este bloque." };
  }

  await prisma.$transaction(async (tx) => {
    const destino = await obtenerOCrearDia(
      tx,
      grupo.bloque.id_programa,
      semana_inicio,
      semana_fin,
      numero_dia
    );
    await clonarEjerciciosEnDia(tx, destino.id_bloque, grupo.ejercicios, [grupo]);
  });

  const semanas =
    semana_inicio === semana_fin ? `semana ${semana_inicio}` : `semanas ${semana_inicio}-${semana_fin}`;
  await avisar(`Bloque copiado al Día ${numero_dia} (${semanas}).`);
  if (grupo.bloque.programa.id_alumno) {
    revalidatePath(`/coach/alumnos/${grupo.bloque.programa.id_alumno}`);
  }
  return { message: "Bloque copiado." };
}

export async function crearBloque(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const semana_inicioRaw = String(formData.get("semana_inicio") ?? "").trim();
  const semana_finRaw = String(formData.get("semana_fin") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim() || null;

  if (!id_programa || !nombre) {
    return { error: "Completá el nombre del bloque." };
  }

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
  });
  // Un programa real solo lo toca su coach dueño; una plantilla es
  // biblioteca compartida — cualquier coach puede agregarle bloques.
  if (!programa || (programa.id_entrenador !== contexto.id_entrenador && !programa.es_plantilla)) {
    return { error: "No autorizado sobre este programa." };
  }

  const cantidadBloques = await prisma.bloqueEntrenamiento.count({
    where: { id_programa },
  });

  await prisma.bloqueEntrenamiento.create({
    data: {
      id_programa,
      nombre,
      orden: cantidadBloques + 1,
      semana_inicio: semana_inicioRaw ? Number(semana_inicioRaw) : null,
      semana_fin: semana_finRaw ? Number(semana_finRaw) : null,
      tipo,
    },
  });

  await avisar("Bloque creado.");
  revalidatePath(`/coach/programas/${id_programa}`);
  return { message: "Bloque creado." };
}

export async function crearEjercicioPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_bloque = String(formData.get("id_bloque") ?? "");
  const id_ejercicio = String(formData.get("id_ejercicio") ?? "");
  const seriesRaw = String(formData.get("series") ?? "").trim();
  const repeticiones = String(formData.get("repeticiones") ?? "").trim();
  const peso_sugeridoRaw = String(formData.get("peso_sugerido") ?? "").trim();
  const tempo = String(formData.get("tempo") ?? "").trim() || null;
  const descanso = String(formData.get("descanso") ?? "").trim() || null;
  const metodo_entrenamiento =
    String(formData.get("metodo_entrenamiento") ?? "").trim() || null;
  const tutRaw = String(formData.get("tiempo_bajo_tension_sugerido") ?? "").trim();

  if (!id_bloque || !id_ejercicio || !seriesRaw || !repeticiones) {
    return { error: "Completá ejercicio, series y repeticiones." };
  }

  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true },
  });
  if (
    !bloque ||
    (bloque.programa.id_entrenador !== contexto.id_entrenador && !bloque.programa.es_plantilla)
  ) {
    return { error: "No autorizado sobre este bloque." };
  }

  const ultimo = await prisma.ejercicioPrograma.aggregate({
    where: { id_bloque },
    _max: { orden: true },
  });

  await prisma.ejercicioPrograma.create({
    data: {
      id_bloque,
      id_ejercicio,
      series: Number(seriesRaw),
      repeticiones,
      peso_sugerido: peso_sugeridoRaw || null,
      tempo,
      descanso,
      metodo_entrenamiento,
      tiempo_bajo_tension_sugerido: tutRaw ? Number(tutRaw) : null,
      orden: (ultimo._max.orden ?? 0) + 1,
    },
  });

  await avisar("Ejercicio agregado al bloque.");
  revalidatePath(`/coach/programas/${bloque.id_programa}`);
  return { message: "Ejercicio agregado al bloque." };
}

/**
 * Trae el bloque a partir de su id, validando acceso: dueño si es un
 * programa real, cualquier coach si es una plantilla (biblioteca
 * compartida).
 */
async function bloqueDelEntrenador(id_bloque: string, id_entrenador: string) {
  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true },
  });
  if (!bloque) return null;
  if (bloque.programa.id_entrenador !== id_entrenador && !bloque.programa.es_plantilla) return null;
  return bloque;
}

export async function actualizarEjercicioPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_ejercicio_programa = String(formData.get("id_ejercicio_programa") ?? "");
  const seriesRaw = String(formData.get("series") ?? "").trim();
  const repeticiones = String(formData.get("repeticiones") ?? "").trim();
  const peso_sugeridoRaw = String(formData.get("peso_sugerido") ?? "").trim();
  const tempo = String(formData.get("tempo") ?? "").trim() || null;
  const descanso = String(formData.get("descanso") ?? "").trim() || null;
  const metodo_entrenamiento = String(formData.get("metodo_entrenamiento") ?? "").trim() || null;
  const tutRaw = String(formData.get("tiempo_bajo_tension_sugerido") ?? "").trim();

  if (!id_ejercicio_programa || !seriesRaw || !repeticiones) {
    return { error: "Completá series y repeticiones." };
  }

  const existente = await prisma.ejercicioPrograma.findUnique({
    where: { id_ejercicio_programa },
    include: { bloque: { include: { programa: true } } },
  });
  if (
    !existente ||
    (existente.bloque.programa.id_entrenador !== contexto.id_entrenador &&
      !existente.bloque.programa.es_plantilla)
  ) {
    return { error: "No autorizado sobre este ejercicio." };
  }

  await prisma.ejercicioPrograma.update({
    where: { id_ejercicio_programa },
    data: {
      series: Number(seriesRaw),
      repeticiones,
      peso_sugerido: peso_sugeridoRaw || null,
      tempo,
      descanso,
      metodo_entrenamiento,
      tiempo_bajo_tension_sugerido: tutRaw ? Number(tutRaw) : null,
    },
  });

  await avisar("Ejercicio actualizado.");
  revalidatePath(`/coach/programas/${existente.bloque.id_programa}`);
  return { message: "Ejercicio actualizado." };
}

export async function eliminarEjercicioPrograma(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_ejercicio_programa = String(formData.get("id_ejercicio_programa") ?? "");
  if (!id_ejercicio_programa) return;

  const existente = await prisma.ejercicioPrograma.findUnique({
    where: { id_ejercicio_programa },
    include: {
      bloque: { include: { programa: true } },
      _count: { select: { series_registradas: true } },
    },
  });
  if (
    !existente ||
    (existente.bloque.programa.id_entrenador !== contexto.id_entrenador &&
      !existente.bloque.programa.es_plantilla)
  ) {
    return;
  }

  // Con series ya registradas no se puede borrar sin perder historial y
  // PR del alumno: se archiva (desaparece del plan, queda en el historial).
  if (existente._count.series_registradas > 0) {
    await prisma.ejercicioPrograma.update({
      where: { id_ejercicio_programa },
      data: { archivado: true, id_grupo: null },
    });
  } else {
    await prisma.ejercicioPrograma.delete({ where: { id_ejercicio_programa } });
  }
  await avisar("Ejercicio quitado del bloque.", "eliminado");
  revalidatePath(`/coach/programas/${existente.bloque.id_programa}`);
}

/** Sube o baja un ejercicio dentro de su bloque, intercambiando `orden` con el vecino. */
export async function moverEjercicioPrograma(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_ejercicio_programa = String(formData.get("id_ejercicio_programa") ?? "");
  const direccion = String(formData.get("direccion") ?? "");
  if (!id_ejercicio_programa || (direccion !== "arriba" && direccion !== "abajo")) return;

  const actual = await prisma.ejercicioPrograma.findUnique({
    where: { id_ejercicio_programa },
    include: { bloque: { include: { programa: true } } },
  });
  if (
    !actual ||
    (actual.bloque.programa.id_entrenador !== contexto.id_entrenador &&
      !actual.bloque.programa.es_plantilla)
  ) {
    return;
  }

  const hermanos = await prisma.ejercicioPrograma.findMany({
    where: { id_bloque: actual.id_bloque, archivado: false },
    orderBy: { orden: "asc" },
  });
  const idx = hermanos.findIndex((e) => e.id_ejercicio_programa === id_ejercicio_programa);
  const idxVecino = direccion === "arriba" ? idx - 1 : idx + 1;
  if (idxVecino < 0 || idxVecino >= hermanos.length) return;

  const vecino = hermanos[idxVecino];

  await prisma.$transaction([
    prisma.ejercicioPrograma.update({
      where: { id_ejercicio_programa: actual.id_ejercicio_programa },
      data: { orden: vecino.orden },
    }),
    prisma.ejercicioPrograma.update({
      where: { id_ejercicio_programa: vecino.id_ejercicio_programa },
      data: { orden: actual.orden },
    }),
  ]);

  revalidatePath(`/coach/programas/${actual.bloque.id_programa}`);
}

export async function eliminarBloque(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_bloque = String(formData.get("id_bloque") ?? "");
  if (!id_bloque) return;

  const bloque = await bloqueDelEntrenador(id_bloque, contexto.id_entrenador);
  if (!bloque) return;

  try {
    await prisma.bloqueEntrenamiento.delete({ where: { id_bloque } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      await avisar(
        "No se puede eliminar: el alumno ya registró entrenamientos en este bloque. Quitale los ejercicios en vez de borrarlo.",
        "info"
      );
      return;
    }
    throw err;
  }
  await avisar("Bloque eliminado.", "eliminado");
  revalidatePath(`/coach/programas/${bloque.id_programa}`);
}

/**
 * Duplica un bloque completo (con todos sus ejercicios, series, reps,
 * tempo, descanso, etc.) al final del programa — el flujo real de armar
 * una rutina es "semana 2 = semana 1 pero con más peso", no escribir todo
 * de cero cada vez. Las semanas del bloque nuevo se corren automáticamente
 * si el original tenía semana_inicio/semana_fin definidas.
 */
export async function duplicarBloque(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_bloque = String(formData.get("id_bloque") ?? "");
  if (!id_bloque) return;

  const original = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true, ...INCLUDE_DIA_CLONABLE },
  });
  if (
    !original ||
    (original.programa.id_entrenador !== contexto.id_entrenador && !original.programa.es_plantilla)
  ) {
    return;
  }

  const cantidadBloques = await prisma.bloqueEntrenamiento.count({
    where: { id_programa: original.id_programa },
  });

  const duracionSemanas =
    original.semana_inicio != null && original.semana_fin != null
      ? original.semana_fin - original.semana_inicio + 1
      : null;

  await prisma.$transaction(async (tx) => {
    const copia = await tx.bloqueEntrenamiento.create({
      data: {
        id_programa: original.id_programa,
        nombre: `${original.nombre} (copia)`,
        orden: cantidadBloques + 1,
        tipo: original.tipo,
        semana_inicio: original.semana_fin != null ? original.semana_fin + 1 : null,
        semana_fin:
          original.semana_fin != null && duracionSemanas != null
            ? original.semana_fin + duracionSemanas
            : null,
      },
    });
    await clonarEjerciciosEnDia(tx, copia.id_bloque, original.ejercicios_programa, original.grupos);
  });

  await avisar("Bloque duplicado.");
  revalidatePath(`/coach/programas/${original.id_programa}`);
}

/** Avisa al alumno (in-app + push) que la rutina está lista para arrancar. */
export async function avisarAlumnoRutinaLista(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  if (!id_programa) return { error: "Programa inválido." };

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
    include: { alumno: { include: { usuario: true } } },
  });
  // Una plantilla (alumno null) nunca debería llegar acá — el botón no se
  // muestra en esa vista — pero se valida igual por si el id vino
  // manipulado directamente.
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || !programa.alumno) {
    return { error: "Programa inválido." };
  }

  await crearNotificacion({
    id_usuario: programa.alumno.usuario.id_usuario,
    titulo: "Tu rutina está lista",
    contenido: `"${programa.nombre}" ya tiene todos los ejercicios cargados — arrancá cuando quieras.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  await avisar("Aviso enviado al alumno.");
  revalidatePath(`/coach/programas/${id_programa}`);
  return { message: "Aviso enviado." };
}

// ------------------------------------------------------------
// GAMIFICACIÓN — objetivos del alumno (los crea/edita el coach)
// ------------------------------------------------------------

/** Valida que el alumno esté en la cartera activa del entrenador logueado. */
async function alumnoDelEntrenador(id_alumno: string, id_entrenador: string) {
  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: { id_entrenador_id_alumno: { id_entrenador, id_alumno } },
  });
  return relacion?.estado_relacion === "activa" ? relacion : null;
}

// ------------------------------------------------------------
// 1RM DE REFERENCIA (progresión de fuerza) — actualización autorizada:
// solo el coach del alumno. Agrega una fila nueva por levantamiento que
// cambió (historial intacto, con el valor anterior y la fuente); las
// cargas futuras se recalculan solas porque se calculan al mostrar el
// plan, y lo ya entrenado no cambia (cada serie guardó su objetivo). Las
// cargas fijadas a mano por el coach tampoco cambian.
// Actualizar un 1RM NO toca la membresía: no activa ni desbloquea nada.
// ------------------------------------------------------------
const CAMPOS_RM: { campo: string; levantamiento: Levantamiento }[] = [
  { campo: "rm_sentadilla", levantamiento: "sentadilla" },
  { campo: "rm_press_banca", levantamiento: "press_banca" },
  { campo: "rm_peso_muerto", levantamiento: "peso_muerto" },
];

function fuenteRm(valor: FormDataEntryValue | null): "medido" | "estimado" {
  return String(valor ?? "") === "estimado" ? "estimado" : "medido";
}

export async function actualizarRmReferencia(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  if (!id_alumno || !(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const vigentes = await obtenerRmVigentes(id_alumno);
  const cambios: { levantamiento: Levantamiento; valor: number; fuente: "medido" | "estimado" }[] = [];
  for (const { campo, levantamiento } of CAMPOS_RM) {
    const crudo = String(formData.get(campo) ?? "").trim().replace(",", ".");
    if (!crudo) continue;
    const valor = Number(crudo);
    if (!Number.isFinite(valor) || valor <= 0 || valor > 500) {
      return { error: `Revisá el 1RM de ${NOMBRE_LEVANTAMIENTO[levantamiento]}: entre 1 y 500 kg.` };
    }
    const redondeado = Math.round(valor * 100) / 100;
    if (vigentes[levantamiento]?.valor !== redondeado) {
      cambios.push({ levantamiento, valor: redondeado, fuente: fuenteRm(formData.get(`fuente_${campo}`)) });
    }
  }
  if (cambios.length === 0) return { message: "No hubo cambios en el 1RM." };

  // Si el bloque publicado tiene cargas que dependen de estos 1RM, el
  // coach tiene que haber visto el cambio y confirmarlo.
  const afectadas = await cargasAfectadasPorRm(id_alumno);
  const hayAfectadas = cambios.some((c) =>
    afectadas[c.levantamiento].some((a) => a.semanas.some((s) => s.cargaFija === null && s.porcentaje !== null))
  );
  if (hayAfectadas && formData.get("confirmar_recalculo") !== "on") {
    return { error: "Revisá las cargas que van a cambiar y confirmá el recálculo." };
  }

  try {
    await prisma.rmReferencia.createMany({
      data: cambios.map((c) => ({
        id_alumno,
        levantamiento: c.levantamiento,
        valor_kg: String(c.valor),
        valor_anterior: vigentes[c.levantamiento] ? String(vigentes[c.levantamiento]!.valor) : null,
        fuente: c.fuente,
        estado: "validado",
        id_usuario_autor: contexto.usuario.id_usuario,
        id_usuario_validador: contexto.usuario.id_usuario,
      })),
    });
  } catch (e) {
    console.error("[coach] actualizarRmReferencia:", e);
    return { error: "No se pudo guardar el 1RM. Probá de nuevo." };
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_rm_referencia",
    recurso: "alumno",
    id_recurso: id_alumno,
    resultado: cambios
      .map((c) => `${c.levantamiento}:${vigentes[c.levantamiento]?.valor ?? "-"}->${c.valor}(${c.fuente})`)
      .join(","),
  }).catch(() => {});

  const alumno = await prisma.alumno.findUnique({ where: { id_alumno }, select: { id_usuario: true } });
  if (alumno) {
    await crearNotificacion({
      id_usuario: alumno.id_usuario,
      titulo: "Tu coach actualizó tu 1RM",
      contenido: `${cambios
        .map((c) => `${NOMBRE_LEVANTAMIENTO[c.levantamiento]}: ${c.valor} kg`)
        .join(" · ")}. Tus próximas cargas ya están recalculadas.`,
      tipo: "progresion",
      url: "/panel/entrenamientos",
    }).catch(() => {});
  }

  await avisar("1RM actualizado. Las cargas futuras se recalcularon.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  revalidatePath("/panel/entrenamientos");
  return { message: "1RM actualizado." };
}

/**
 * El coach valida (pasa a regir y recalcula las cargas futuras) o rechaza
 * un 1RM que propuso el alumno. Nunca se toma solo una carga registrada en
 * un entrenamiento como 1RM nuevo.
 */
export async function resolverPropuestaRm(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;
  const id_rm = String(formData.get("id_rm") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id_rm || !["validar", "rechazar"].includes(decision)) return;

  const propuesta = await prisma.rmReferencia.findUnique({ where: { id_rm } });
  if (!propuesta || propuesta.estado !== "propuesto") return;
  if (!(await alumnoDelEntrenador(propuesta.id_alumno, contexto.id_entrenador))) return;

  const vigentes = await obtenerRmVigentes(propuesta.id_alumno);
  const ahora = new Date();
  await prisma.rmReferencia.update({
    where: { id_rm },
    data:
      decision === "validar"
        ? {
            estado: "validado",
            // Rige desde que se valida (así queda como el más reciente).
            fecha: ahora,
            valor_anterior: vigentes[propuesta.levantamiento]
              ? String(vigentes[propuesta.levantamiento]!.valor)
              : null,
            id_usuario_validador: contexto.usuario.id_usuario,
          }
        : { estado: "rechazado", id_usuario_validador: contexto.usuario.id_usuario },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "propuesta_rm",
    recurso: "rm_referencia",
    id_recurso: id_rm,
    resultado: decision,
  }).catch(() => {});

  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno: propuesta.id_alumno },
    select: { id_usuario: true },
  });
  if (alumno) {
    await crearNotificacion({
      id_usuario: alumno.id_usuario,
      titulo: decision === "validar" ? "Tu coach validó tu 1RM" : "Tu coach no aceptó el 1RM propuesto",
      contenido: `${NOMBRE_LEVANTAMIENTO[propuesta.levantamiento]}: ${Number(propuesta.valor_kg)} kg.${
        decision === "validar" ? " Tus próximas cargas ya están recalculadas." : ""
      }`,
      tipo: "progresion",
      url: "/panel/entrenamientos",
    }).catch(() => {});
  }

  await avisar(decision === "validar" ? "1RM validado. Las cargas futuras se recalcularon." : "Propuesta rechazada.");
  revalidatePath(`/coach/alumnos/${propuesta.id_alumno}`);
  revalidatePath("/panel/entrenamientos");
}


// Datos básicos del alumno que hoy solo se mostraban en la ficha y nunca
// se editaban desde ningún lado: el objetivo (texto libre) y la fecha de
// nacimiento. Los edita el coach desde la ficha del alumno.
export async function actualizarDatosAlumno(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const fechaNacimientoRaw = String(formData.get("fecha_nacimiento") ?? "").trim();

  if (!id_alumno) return { error: "Falta el alumno." };
  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  let fecha_nacimiento: Date | null = null;
  if (fechaNacimientoRaw) {
    const d = new Date(fechaNacimientoRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Fecha de nacimiento inválida." };
    }
    fecha_nacimiento = d;
  }

  await prisma.alumno.update({
    where: { id_alumno },
    data: { objetivo, fecha_nacimiento },
  });

  await avisar("Datos del alumno actualizados.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  return { message: "Datos del alumno actualizados." };
}

export async function crearObjetivo(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "custom") as TipoObjetivo;
  const metaRaw = String(formData.get("meta") ?? "").trim();
  const fecha_objetivoRaw = String(formData.get("fecha_objetivo") ?? "").trim();

  if (!id_alumno || !titulo || !metaRaw) {
    return { error: "Completá alumno, título y meta." };
  }
  if (!TIPOS_OBJETIVO.includes(tipo)) {
    return { error: "Tipo de objetivo inválido." };
  }
  const meta = Number(metaRaw);
  if (!Number.isFinite(meta) || meta <= 0) {
    return { error: "La meta tiene que ser un número mayor a 0." };
  }

  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  await prisma.objetivo.create({
    data: {
      id_alumno,
      titulo,
      descripcion,
      tipo,
      meta: metaRaw,
      fecha_objetivo: fecha_objetivoRaw ? new Date(fecha_objetivoRaw) : null,
    },
  });

  await avisar("Objetivo creado.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  return { message: "Objetivo creado." };
}

export async function actualizarObjetivo(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_objetivo = String(formData.get("id_objetivo") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "custom") as TipoObjetivo;
  const metaRaw = String(formData.get("meta") ?? "").trim();
  const progresoRaw = String(formData.get("progreso_actual") ?? "").trim();
  const estado = String(formData.get("estado") ?? "activo") as EstadoObjetivo;
  const fecha_objetivoRaw = String(formData.get("fecha_objetivo") ?? "").trim();

  if (!id_objetivo || !titulo || !metaRaw) {
    return { error: "Completá título y meta." };
  }
  if (!TIPOS_OBJETIVO.includes(tipo) || !ESTADOS_OBJETIVO.includes(estado)) {
    return { error: "Tipo o estado inválido." };
  }
  const meta = Number(metaRaw);
  const progreso = progresoRaw ? Number(progresoRaw) : 0;
  if (!Number.isFinite(meta) || meta <= 0 || !Number.isFinite(progreso) || progreso < 0) {
    return { error: "Meta y progreso tienen que ser números válidos." };
  }

  const objetivo = await prisma.objetivo.findUnique({
    where: { id_objetivo },
  });
  if (
    !objetivo ||
    !(await alumnoDelEntrenador(objetivo.id_alumno, contexto.id_entrenador))
  ) {
    return { error: "No autorizado sobre este objetivo." };
  }

  await prisma.objetivo.update({
    where: { id_objetivo },
    data: {
      titulo,
      descripcion,
      tipo,
      meta: metaRaw,
      progreso_actual: progresoRaw || "0",
      estado,
      fecha_objetivo: fecha_objetivoRaw ? new Date(fecha_objetivoRaw) : null,
    },
  });

  // Si el objetivo pasó a "cumplido", puede haber destrabado un logro.
  if (estado === "cumplido" && objetivo.estado !== "cumplido") {
    await evaluarLogros(objetivo.id_alumno).catch(() => {});
    const alumno = await prisma.alumno.findUnique({
      where: { id_alumno: objetivo.id_alumno },
      select: { id_usuario: true },
    });
    if (alumno) {
      await crearNotificacion({
        id_usuario: alumno.id_usuario,
        titulo: "Objetivo cumplido",
        contenido: `Marcaste "${titulo}" como cumplido. ¡Bien ahí!`,
        tipo: "objetivo",
        url: "/panel/logros",
      }).catch(() => {});
    }
  }

  await avisar("Objetivo actualizado.");
  revalidatePath(`/coach/alumnos/${objetivo.id_alumno}`);
  return { message: "Objetivo actualizado." };
}

export async function eliminarObjetivo(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_objetivo = String(formData.get("id_objetivo") ?? "");
  if (!id_objetivo) return;

  const objetivo = await prisma.objetivo.findUnique({ where: { id_objetivo } });
  if (!objetivo || !(await alumnoDelEntrenador(objetivo.id_alumno, contexto.id_entrenador))) {
    return;
  }

  await prisma.objetivo.delete({ where: { id_objetivo } });
  await avisar("Objetivo eliminado.", "eliminado");
  revalidatePath(`/coach/alumnos/${objetivo.id_alumno}`);
}

// ------------------------------------------------------------
// FEEDBACK SEMANAL — antes era de solo lectura para el coach; esto le
// permite responder dentro de la misma app en vez de tener que escribirle
// por WhatsApp aparte.
// ------------------------------------------------------------

export async function responderFeedbackSemanal(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_feedback_semanal = String(formData.get("id_feedback_semanal") ?? "");
  const respuesta_coach = String(formData.get("respuesta_coach") ?? "").trim();
  if (!id_feedback_semanal || !respuesta_coach) {
    return { error: "Escribí una respuesta." };
  }

  const feedback = await prisma.feedbackSemanal.findUnique({
    where: { id_feedback_semanal },
    include: { alumno: { include: { usuario: true } } },
  });
  if (!feedback || !(await alumnoDelEntrenador(feedback.id_alumno, contexto.id_entrenador))) {
    return { error: "No autorizado sobre este feedback." };
  }

  await prisma.feedbackSemanal.update({
    where: { id_feedback_semanal },
    data: { respuesta_coach, fecha_respuesta: new Date() },
  });

  await crearNotificacion({
    id_usuario: feedback.alumno.usuario.id_usuario,
    titulo: "Tu coach respondió tu feedback semanal",
    contenido:
      respuesta_coach.length > 120 ? `${respuesta_coach.slice(0, 117)}...` : respuesta_coach,
    tipo: "feedback",
    url: "/panel/seguimiento/feedback",
  });

  await avisar("Respuesta enviada.");
  revalidatePath(`/coach/alumnos/${feedback.id_alumno}`);
  revalidatePath("/panel/seguimiento/feedback");
  return { message: "Respuesta enviada." };
}

// ------------------------------------------------------------
// COMPOSICIÓN CORPORAL — el coach carga la medición completa de
// balanza/InBody de cada alumno de su cartera.
// ------------------------------------------------------------

// Campos numéricos de ProgresoFisico y su tipo. Los "decimal" se pasan
// como string (Prisma lo acepta para columnas Decimal); los "entero" van
// como number.
const CAMPOS_COMPOSICION = {
  peso_corporal: "decimal",
  porcentaje_graso: "decimal",
  masa_muscular: "decimal",
  imc: "decimal",
  pulso: "entero",
  porcentaje_agua: "decimal",
  porcentaje_musculo: "decimal",
  masa_osea: "decimal",
  metabolismo_basal: "entero",
  metabolismo_activo: "entero",
  grasa_visceral: "entero",
  edad_metabolica: "entero",
  soft_lean_mass: "decimal",
  lean_body_mass: "decimal",
  proteina: "decimal",
} as const;

type DatosComposicion = {
  peso_corporal: string | null;
  porcentaje_graso: string | null;
  masa_muscular: string | null;
  imc: string | null;
  pulso: number | null;
  porcentaje_agua: string | null;
  porcentaje_musculo: string | null;
  masa_osea: string | null;
  metabolismo_basal: number | null;
  metabolismo_activo: number | null;
  grasa_visceral: number | null;
  edad_metabolica: number | null;
  soft_lean_mass: string | null;
  lean_body_mass: string | null;
  proteina: string | null;
};

function parsearComposicion(
  formData: FormData
): { datos: DatosComposicion; algunDato: boolean } | { error: string } {
  const datos = {} as DatosComposicion;
  let algunDato = false;

  for (const [campo, tipo] of Object.entries(CAMPOS_COMPOSICION)) {
    const bruto = String(formData.get(campo) ?? "").trim();
    if (!bruto) {
      (datos as Record<string, unknown>)[campo] = null;
      continue;
    }
    const n = Number(bruto.replace(",", ".").replace("%", "").trim());
    if (!Number.isFinite(n) || n < 0) {
      return { error: `Revisá el valor de "${campo}": tiene que ser un número válido.` };
    }
    // Un porcentaje nunca puede pasar de 100 (ej. un valor en kg cargado
    // por error en % músculo).
    if (campo.startsWith("porcentaje_") && n > 100) {
      return { error: `Revisá el valor de "${campo}": es un porcentaje (0 a 100).` };
    }
    algunDato = true;
    (datos as Record<string, unknown>)[campo] =
      tipo === "entero" ? Math.round(n) : String(n);
  }

  return { datos, algunDato };
}

// "YYYY-MM-DD" del input de fecha → mediodía en hora de Argentina. Con
// new Date("2026-10-15") quedaba a las 00:00 UTC, que en Argentina es el
// día anterior a las 21hs: la medición aparecía con un día menos.
// "" → null (sin fecha: se usa la de hoy). Inválida → undefined.
function fechaMedicion(crudo: string): Date | null | undefined {
  const valor = crudo.trim();
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const fecha = new Date(`${valor}T12:00:00-03:00`);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

/** id_alumno del ProgresoFisico si pertenece a un alumno de la cartera activa del coach. */
async function progresoDelEntrenador(id_progreso: string, id_entrenador: string) {
  const progreso = await prisma.progresoFisico.findUnique({ where: { id_progreso } });
  if (!progreso) return null;
  return (await alumnoDelEntrenador(progreso.id_alumno, id_entrenador)) ? progreso : null;
}

// ------------------------------------------------------------
// LECTURA AUTOMÁTICA DE UN REPORTE DE BALANZA (PDF/Word) — sin IA: se le
// extrae el texto al documento (pdf-parse / mammoth) y se lo busca contra
// una lista de etiquetas conocidas por campo (extraerComposicionDeTexto,
// en src/lib/parseo-composicion-corporal.ts). Cada balanza imprime su
// reporte distinto, así que esto es una ayuda para no tipear todo a mano
// — nunca se guarda solo: el coach siempre ve los campos ya cargados en
// el formulario y confirma (o corrige) antes de "Guardar medición".
// ------------------------------------------------------------

export type ResultadoExtraccionComposicion =
  | { error: string }
  | {
      fecha: string | null;
      // Solo los 5 indicadores del perfil (ver CAMPOS_PERFIL_COMPOSICION).
      valores: Partial<Record<CampoPerfilComposicion, string>>;
      // Completados, pero sin certeza de que sean el valor actual.
      revisar: CampoPerfilComposicion[];
      // No aparecen en el archivo (o no con la unidad correcta): quedan
      // vacíos para que el coach los complete a mano.
      faltantes: CampoPerfilComposicion[];
    }
  | undefined;

function faltantesDe(valores: Partial<Record<CampoPerfilComposicion, string>>): CampoPerfilComposicion[] {
  return CAMPOS_PERFIL_COMPOSICION.filter((c) => !valores[c]);
}

const EXTENSIONES_SOPORTADAS = [".pdf", ".docx"];
const TAMANO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024; // 10 MB
export async function extraerComposicionDeDocumento(
  _prev: ResultadoExtraccionComposicion,
  formData: FormData
): Promise<ResultadoExtraccionComposicion> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí un archivo PDF o Word del informe." };
  }
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
    return { error: "El archivo es demasiado grande (máx. 10 MB)." };
  }

  const nombreArchivo = archivo.name.toLowerCase();
  const esPdf = archivo.type === "application/pdf" || nombreArchivo.endsWith(".pdf");
  const esDocx = nombreArchivo.endsWith(".docx");

  // Las fotos (jpg, png...) se leen con OCR en el navegador del coach y
  // llegan como texto a extraerComposicionDeTextoOcr.
  if (!esPdf && !esDocx) {
    return {
      error: `Formato no soportado: subí un archivo ${EXTENSIONES_SOPORTADAS.join(" o ")}.`,
    };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  let texto = "";
  try {
    if (esPdf) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const resultado = await parser.getText({ pageJoiner: "\n" });
        texto = resultado.text;
      } finally {
        await parser.destroy();
      }
    } else {
      const mammoth = await import("mammoth");
      const resultado = await mammoth.extractRawText({ buffer });
      texto = resultado.value;
    }
  } catch {
    return {
      error: "No se pudo leer el archivo. Puede estar dañado, protegido con contraseña o ser una imagen escaneada — probá con otro o completá los datos a mano.",
    };
  }

  if (!texto.trim()) {
    return {
      error: "El archivo no tiene texto reconocible (¿es una imagen escaneada?). Completá los datos a mano.",
    };
  }

  return interpretarTextoComposicion(texto, "el archivo");
}

function interpretarTextoComposicion(texto: string, origen: string): ResultadoExtraccionComposicion {
  const { valores, revisar } = extraerComposicionDeTexto(texto);
  const fecha = extraerFechaDeTexto(texto);

  if (Object.keys(valores).length === 0) {
    return {
      error: `No se reconoció ninguno de los 5 indicadores (peso, IMC, % grasa, grasa visceral, % músculo) en ${origen}. Completá los datos a mano o probá con otro archivo.`,
    };
  }

  return { fecha, valores, revisar, faltantes: faltantesDe(valores) };
}

// Texto que el navegador del coach leyó de una FOTO del informe con OCR
// (Tesseract, sin IA — ver src/lib/ocr-cliente.ts). Pasa por el mismo
// lector de reglas que el PDF/Word.
export async function extraerComposicionDeTextoOcr(texto: string): Promise<ResultadoExtraccionComposicion> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };
  if (typeof texto !== "string" || !texto.trim()) {
    return {
      error: "No se pudo leer texto en la foto. Probá con una foto más nítida, de frente y con buena luz, o completá los datos a mano.",
    };
  }
  return interpretarTextoComposicion(texto.slice(0, 50_000), "la foto");
}

// ------------------------------------------------------------
// FOTOS DE PROGRESO POR ÁNGULO — el coach las sube desde el perfil del
// alumno (frente/espalda/perfil izquierdo/perfil derecho, con fecha
// automática). Reusa MedidaCorporal + Supabase Storage tal cual el
// alumno ya las carga desde /panel/seguimiento/progreso — mismo bucket,
// mismas URLs firmadas — así que ambos caminos conviven sin pisarse.
// ------------------------------------------------------------

// No exportado: un archivo "use server" solo puede exportar funciones
// async — ver el mismo listado de ángulos, duplicado a propósito, en
// fotos-tab.tsx y en la página del perfil del alumno.
const ANGULOS_FOTO = ["frente", "espalda", "perfil_izquierdo", "perfil_derecho"] as const;
type AnguloFoto = (typeof ANGULOS_FOTO)[number];

export async function subirFotoProgresoAngulo(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const angulo = String(formData.get("angulo") ?? "") as AnguloFoto;
  const archivo = formData.get("foto");

  if (!id_alumno || !ANGULOS_FOTO.includes(angulo)) {
    return { error: "Datos inválidos." };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí una foto." };
  }
  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const medida = await prisma.medidaCorporal.create({
    data: { id_alumno, tipo_medida: angulo, valor_cm: 0 },
  });

  const path = await subirFotoProgreso(id_alumno, medida.id_medida, archivo);
  if (path) {
    await prisma.medidaCorporal.update({
      where: { id_medida: medida.id_medida },
      data: { foto_url: path },
    });
  } else {
    // Sin la foto no tiene sentido conservar la fila vacía.
    await prisma.medidaCorporal.delete({ where: { id_medida: medida.id_medida } });
    return { error: "No se pudo subir la foto. Probá de nuevo." };
  }

  await avisar("Foto guardada.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  return { message: "Foto guardada." };
}

export async function crearProgresoFisicoAlumno(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  if (!id_alumno) return { error: "Falta el alumno." };
  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const parsed = parsearComposicion(formData);
  if ("error" in parsed) return { error: parsed.error };
  if (!parsed.algunDato) return { error: "Cargá al menos un dato." };

  const fecha = fechaMedicion(String(formData.get("fecha") ?? ""));
  if (fecha === undefined) return { error: "Revisá la fecha de la medición." };

  try {
    // Doble toque o reintento tras un error de red: si esta misma medición
    // (mismo alumno, mismo día, mismos valores) ya se guardó hace un rato,
    // no se crea otra.
    const desde = new Date(Date.now() - 15 * 60 * 1000);
    const recientes = await prisma.progresoFisico.findMany({
      where: { id_alumno, origen: "coach", fecha: fecha ?? undefined },
      orderBy: { fecha: "desc" },
      take: 5,
    });
    const yaGuardada = recientes.some(
      (r) =>
        (fecha || r.fecha >= desde) &&
        Object.entries(parsed.datos).every(([campo, valor]) => {
          const actual = (r as Record<string, unknown>)[campo];
          return valor === null ? actual === null : actual !== null && Number(actual) === Number(valor);
        })
    );

    if (!yaGuardada) {
      await prisma.progresoFisico.create({
        data: {
          id_alumno,
          origen: "coach",
          ...(fecha ? { fecha } : {}),
          ...parsed.datos,
        },
      });
    }
  } catch (e) {
    console.error("[coach] crearProgresoFisicoAlumno:", e);
    return { error: "No se pudo guardar la medición. Probá de nuevo." };
  }

  await avisar("Medición cargada.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  return { message: "Medición cargada." };
}

export async function editarProgresoFisicoAlumno(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_progreso = String(formData.get("id_progreso") ?? "");
  const progreso = await progresoDelEntrenador(id_progreso, contexto.id_entrenador);
  if (!progreso) return { error: "No autorizado sobre esta medición." };

  const parsed = parsearComposicion(formData);
  if ("error" in parsed) return { error: parsed.error };
  if (!parsed.algunDato) return { error: "Cargá al menos un dato." };

  const fecha = fechaMedicion(String(formData.get("fecha") ?? ""));
  if (fecha === undefined) return { error: "Revisá la fecha de la medición." };

  try {
    await prisma.progresoFisico.update({
      where: { id_progreso },
      data: {
        ...(fecha ? { fecha } : {}),
        ...parsed.datos,
      },
    });
  } catch (e) {
    console.error("[coach] editarProgresoFisicoAlumno:", e);
    return { error: "No se pudieron guardar los cambios. Probá de nuevo." };
  }

  await avisar("Medición actualizada.");
  revalidatePath(`/coach/alumnos/${progreso.id_alumno}`);
  return { message: "Medición actualizada." };
}

export async function eliminarProgresoFisicoAlumno(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_progreso = String(formData.get("id_progreso") ?? "");
  const progreso = await progresoDelEntrenador(id_progreso, contexto.id_entrenador);
  if (!progreso) return;

  await prisma.progresoFisico.delete({ where: { id_progreso } });
  await avisar("Medición eliminada.", "eliminado");
  revalidatePath(`/coach/alumnos/${progreso.id_alumno}`);
}

// ------------------------------------------------------------
// BIBLIOTECA GLOBAL DE LOGROS (PROMPT MAESTRO sección 15.B / 16)
// El catálogo es único para toda la app (no está atado a un coach en
// particular) — mismo diseño que Ejercicio, para que cualquier coach lo
// vea y lo pueda usar con su propia cartera de alumnos.
// ------------------------------------------------------------

function generarCodigoLogro(titulo: string): string {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "logro"}_${Date.now().toString(36)}`;
}

export async function crearLogro(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const icono = String(formData.get("icono") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  if (!titulo || !descripcion) {
    return { error: "Completá nombre y descripción." };
  }

  const logro = await prisma.logro.create({
    data: {
      codigo: generarCodigoLogro(titulo),
      titulo,
      descripcion,
      icono,
      color,
      categoria,
      criterio: Prisma.JsonNull,
    },
  });

  // Un logro manual (criterio null) es para toda la cartera, no algo que
  // se gana: apenas se crea, se otorga a todos los alumnos que ya existen
  // (los que se den de alta después lo reciben al crearse — ver
  // otorgarLogrosManualesIniciales, usado en registrarse/asignarRol/
  // crearYVincularAlumno).
  await otorgarLogroATodosLosAlumnos(logro.id_logro);

  await avisar("Logro creado y otorgado a todos los alumnos.");
  revalidatePath("/coach/logros");
  revalidatePath("/coach/alumnos");
  return { message: "Logro creado y otorgado a todos los alumnos." };
}

export async function editarLogro(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_logro = String(formData.get("id_logro") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const icono = String(formData.get("icono") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  if (!id_logro || !titulo || !descripcion) {
    return { error: "Completá nombre y descripción." };
  }

  await prisma.logro.update({
    where: { id_logro },
    data: { titulo, descripcion, icono, color, categoria },
  });

  await avisar("Logro actualizado.");
  revalidatePath("/coach/logros");
  return { message: "Logro actualizado." };
}

// Nunca se borra de verdad: LogroAlumno tiene onDelete Cascade contra
// Logro, así que un delete físico borraría el historial de badges ya
// obtenidos por los alumnos. "Archivar" (activo=false) lo saca de la
// biblioteca para otorgar nuevos sin tocar lo ya ganado.
export async function alternarActivoLogro(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_logro = String(formData.get("id_logro") ?? "");
  const logro = await prisma.logro.findUnique({ where: { id_logro } });
  if (!logro) return;

  await prisma.logro.update({ where: { id_logro }, data: { activo: !logro.activo } });
  await avisar(logro.activo ? "Logro desactivado." : "Logro activado.");
  revalidatePath("/coach/logros");
}

export async function otorgarLogroManual(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const id_logro = String(formData.get("id_logro") ?? "");
  if (!id_alumno || !id_logro) return { error: "Faltan datos." };

  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const logro = await prisma.logro.findUnique({ where: { id_logro } });
  if (!logro) return { error: "Ese logro no existe." };

  try {
    await prisma.logroAlumno.create({ data: { id_alumno, id_logro } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "El alumno ya tiene ese logro." };
    }
    throw err;
  }

  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno },
    select: { id_usuario: true },
  });
  if (alumno) {
    await crearNotificacion({
      id_usuario: alumno.id_usuario,
      titulo: "¡Logro desbloqueado!",
      contenido: `${logro.titulo} — ${logro.descripcion}`,
      tipo: "logro",
      url: "/panel/logros",
    }).catch(() => {});
  }

  await avisar("Logro otorgado.");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
  return { message: "Logro otorgado." };
}

export async function quitarLogroAlumno(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const id_logro = String(formData.get("id_logro") ?? "");
  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) return;

  await prisma.logroAlumno.deleteMany({ where: { id_alumno, id_logro } });
  await avisar("Logro quitado.", "eliminado");
  revalidatePath(`/coach/alumnos/${id_alumno}`);
}
