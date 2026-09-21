"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import type {
  EstadoPrograma,
  TipoObjetivo,
  EstadoObjetivo,
  TipoPlanificacion,
  DiaSemana,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import { evaluarLogros } from "@/lib/gamificacion";
import { TAG_CATALOGO_EJERCICIOS } from "@/lib/catalogos";
import type { CampoComposicionCorporal } from "@/lib/composicion-corporal";
import { subirFotoProgreso } from "@/lib/storage";
import { extraerComposicionDeTexto, extraerFechaDeTexto } from "@/lib/parseo-composicion-corporal";
import { registrarAuditoria } from "@/lib/auditoria";
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

  await prisma.entrenador.update({
    where: { id_entrenador: contexto.id_entrenador },
    data: { especialidad, biografia },
  });

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

  revalidatePath("/coach/alumnos");
  redirect("/coach/alumnos");
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
  const video_url = String(formData.get("video_url") ?? "").trim() || null;
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
  const video_url = String(formData.get("video_url") ?? "").trim() || null;
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

  updateTag(TAG_CATALOGO_EJERCICIOS);
  redirect("/coach/ejercicios");
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
  if (!plantilla || plantilla.id_entrenador !== contexto.id_entrenador || !plantilla.es_plantilla) {
    return { error: "No autorizado sobre esta plantilla." };
  }

  await prisma.programaEntrenamiento.update({
    where: { id_programa: id_plantilla },
    data: { nombre, descripcion, objetivo },
  });

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
  if (!plantilla || plantilla.id_entrenador !== contexto.id_entrenador || !plantilla.es_plantilla) {
    return;
  }

  await prisma.programaEntrenamiento.delete({ where: { id_programa: id_plantilla } });
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
      include: {
        bloques: { include: { ejercicios_programa: true }, orderBy: { orden: "asc" } },
      },
    }),
    prisma.relacionEntrenadorAlumno.findUnique({
      where: {
        id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
      },
      include: { alumno: { include: { usuario: true } } },
    }),
  ]);

  if (!plantilla || plantilla.id_entrenador !== contexto.id_entrenador || !plantilla.es_plantilla) {
    return { error: "Plantilla inválida." };
  }
  if (!relacion || relacion.estado_relacion !== "activa") {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const programa = await prisma.programaEntrenamiento.create({
    data: {
      id_alumno,
      id_entrenador: contexto.id_entrenador,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      objetivo: plantilla.objetivo,
      fecha_inicio: fecha_inicioRaw ? new Date(fecha_inicioRaw) : new Date(),
      estado_programa: "activo",
      bloques: {
        create: plantilla.bloques.map((b) => ({
          nombre: b.nombre,
          orden: b.orden,
          semana_inicio: b.semana_inicio,
          semana_fin: b.semana_fin,
          tipo: b.tipo,
          ejercicios_programa: {
            create: b.ejercicios_programa.map((ep) => ({
              id_ejercicio: ep.id_ejercicio,
              series: ep.series,
              repeticiones: ep.repeticiones,
              peso_sugerido: ep.peso_sugerido,
              tempo: ep.tempo,
              descanso: ep.descanso,
              metodo_entrenamiento: ep.metodo_entrenamiento,
              tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
              orden: ep.orden,
            })),
          },
        })),
      },
    },
  });

  await crearNotificacion({
    id_usuario: relacion.alumno.usuario.id_usuario,
    titulo: "Tenés un programa nuevo",
    contenido: `${contexto.usuario.nombre} te asignó "${plantilla.nombre}", ya con los ejercicios cargados — arrancá cuando quieras.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  redirect(`/coach/programas/${programa.id_programa}`);
}

// ------------------------------------------------------------
// PLANIFICACIÓN POR DÍA — pantalla "Planificación" del perfil del
// alumno. Reusa BloqueEntrenamiento/EjercicioPrograma tal cual (ver
// dia_semana en el schema): un bloque ahora puede representar el
// entrenamiento de UN día de la semana dentro de un rango de semanas
// (1-4), en vez de un tramo libre del programa. Nada de esto toca cómo
// se guarda el historial real (SerieEntrenamiento sigue igual), así que
// las sesiones ya registradas no se alteran nunca.
// ------------------------------------------------------------

const DIAS_SEMANA: DiaSemana[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

const ETIQUETA_DIA: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

/** El programa activo (no plantilla) del alumno con este coach, creándolo si hace falta. */
export async function obtenerOCrearProgramaActivo(id_alumno: string, id_entrenador: string) {
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
    data: { tipo_planificacion: tipo },
  });

  revalidatePath(`/coach/alumnos/${programa.id_alumno}`);
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

  const existentes = new Set(
    programa.bloques
      .filter((b) => b.semana_inicio === semana_inicio && b.semana_fin === semana_fin)
      .map((b) => b.dia_semana)
  );

  const faltantes = DIAS_SEMANA.filter((d) => !existentes.has(d));
  if (faltantes.length === 0) return;

  await prisma.bloqueEntrenamiento.createMany({
    data: faltantes.map((dia_semana, i) => ({
      id_programa,
      nombre: ETIQUETA_DIA[dia_semana],
      orden: DIAS_SEMANA.indexOf(dia_semana) + i,
      semana_inicio,
      semana_fin,
      dia_semana,
    })),
  });

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

  revalidatePath(`/coach/alumnos/${programa.id_alumno}`);
  return undefined;
}

export type EjercicioDiaEntrada = {
  id_ejercicio: string;
  series: string;
  repeticiones: string;
  peso_sugerido: string;
  descanso: string;
  tempo: string;
  nota: string;
};

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
  const dia_semana = String(formData.get("dia_semana") ?? "") as DiaSemana;

  let entradas: EjercicioDiaEntrada[];
  try {
    entradas = JSON.parse(String(formData.get("entradas") ?? "[]"));
  } catch {
    return { error: "Datos inválidos." };
  }

  if (
    !id_programa ||
    !Number.isFinite(semana_inicio) ||
    !Number.isFinite(semana_fin) ||
    !DIAS_SEMANA.includes(dia_semana)
  ) {
    return { error: "Datos inválidos." };
  }

  const programa = await prisma.programaEntrenamiento.findUnique({ where: { id_programa } });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || !programa.id_alumno) {
    return { error: "No autorizado sobre este programa." };
  }
  const id_alumno = programa.id_alumno;

  const validas = entradas.filter((e) => e.id_ejercicio && e.series && e.repeticiones);

  try {
    await prisma.$transaction(async (tx) => {
      // No hay @@unique sobre (id_programa, semana_inicio, semana_fin,
      // dia_semana), así que "encontrar o crear" el bloque del día se
      // resuelve a mano en vez de con upsert.
      const existente = await tx.bloqueEntrenamiento.findFirst({
        where: { id_programa, semana_inicio, semana_fin, dia_semana },
      });
      const bloque =
        existente ??
        (await tx.bloqueEntrenamiento.create({
          data: {
            id_programa,
            nombre: ETIQUETA_DIA[dia_semana],
            orden: DIAS_SEMANA.indexOf(dia_semana),
            semana_inicio,
            semana_fin,
            dia_semana,
          },
        }));

      await tx.ejercicioPrograma.deleteMany({ where: { id_bloque: bloque.id_bloque } });

      let orden = 1;
      for (const e of validas) {
        await tx.ejercicioPrograma.create({
          data: {
            id_bloque: bloque.id_bloque,
            id_ejercicio: e.id_ejercicio,
            series: Number(e.series) || 1,
            repeticiones: e.repeticiones,
            peso_sugerido: e.peso_sugerido || null,
            descanso: e.descanso || null,
            tempo: e.tempo || null,
            nota: e.nota || null,
            orden: orden++,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return {
        error:
          "Este día ya tiene entrenamientos reales registrados por el alumno — no se puede reemplazar la lista de ejercicios sin perder ese historial. Armá una semana nueva para el cambio en vez de editar esta.",
      };
    }
    throw err;
  }

  revalidatePath(`/coach/alumnos/${id_alumno}`);
  redirect(`/coach/alumnos/${id_alumno}?tab=planificacion`);
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
  if (!programa || programa.id_entrenador !== contexto.id_entrenador) {
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
  if (!bloque || bloque.programa.id_entrenador !== contexto.id_entrenador) {
    return { error: "No autorizado sobre este bloque." };
  }

  const cantidadEjercicios = await prisma.ejercicioPrograma.count({
    where: { id_bloque },
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
      orden: cantidadEjercicios + 1,
    },
  });

  revalidatePath(`/coach/programas/${bloque.id_programa}`);
  return { message: "Ejercicio agregado al bloque." };
}

/** Trae el id_programa a partir de un id_bloque, validando que sea del entrenador logueado. */
async function bloqueDelEntrenador(id_bloque: string, id_entrenador: string) {
  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true },
  });
  if (!bloque || bloque.programa.id_entrenador !== id_entrenador) return null;
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
  if (!existente || existente.bloque.programa.id_entrenador !== contexto.id_entrenador) {
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
    include: { bloque: { include: { programa: true } } },
  });
  if (!existente || existente.bloque.programa.id_entrenador !== contexto.id_entrenador) return;

  await prisma.ejercicioPrograma.delete({ where: { id_ejercicio_programa } });
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
  if (!actual || actual.bloque.programa.id_entrenador !== contexto.id_entrenador) return;

  const hermanos = await prisma.ejercicioPrograma.findMany({
    where: { id_bloque: actual.id_bloque },
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

  await prisma.bloqueEntrenamiento.delete({ where: { id_bloque } });
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
    include: { programa: true, ejercicios_programa: { orderBy: { orden: "asc" } } },
  });
  if (!original || original.programa.id_entrenador !== contexto.id_entrenador) return;

  const cantidadBloques = await prisma.bloqueEntrenamiento.count({
    where: { id_programa: original.id_programa },
  });

  const duracionSemanas =
    original.semana_inicio != null && original.semana_fin != null
      ? original.semana_fin - original.semana_inicio + 1
      : null;

  await prisma.bloqueEntrenamiento.create({
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
      ejercicios_programa: {
        create: original.ejercicios_programa.map((ep) => ({
          id_ejercicio: ep.id_ejercicio,
          series: ep.series,
          repeticiones: ep.repeticiones,
          peso_sugerido: ep.peso_sugerido,
          tempo: ep.tempo,
          descanso: ep.descanso,
          metodo_entrenamiento: ep.metodo_entrenamiento,
          tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
          orden: ep.orden,
        })),
      },
    },
  });

  revalidatePath(`/coach/programas/${original.id_programa}`);
}

/** Avisa al alumno (in-app + push) que la rutina está lista para arrancar. */
export async function avisarAlumnoRutinaLista(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_programa = String(formData.get("id_programa") ?? "");
  if (!id_programa) return;

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
    include: { alumno: { include: { usuario: true } } },
  });
  // Una plantilla (alumno null) nunca debería llegar acá — el botón no se
  // muestra en esa vista — pero se valida igual por si el id vino
  // manipulado directamente.
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || !programa.alumno) return;

  await crearNotificacion({
    id_usuario: programa.alumno.usuario.id_usuario,
    titulo: "Tu rutina está lista",
    contenido: `"${programa.nombre}" ya tiene todos los ejercicios cargados — arrancá cuando quieras.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  revalidatePath(`/coach/programas/${id_programa}`);
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
    const n = Number(bruto.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      return { error: `Revisá el valor de "${campo}": tiene que ser un número válido.` };
    }
    algunDato = true;
    (datos as Record<string, unknown>)[campo] =
      tipo === "entero" ? Math.round(n) : bruto.replace(",", ".");
  }

  return { datos, algunDato };
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
  | { fecha: string | null; valores: Partial<Record<CampoComposicionCorporal, string>> }
  | undefined;

const EXTENSIONES_SOPORTADAS = [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"];
const TAMANO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024; // 10 MB
const TIPOS_IMAGEN: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

// Lectura por IA de una FOTO del visor de la balanza (ej. Beurer BF 990):
// a diferencia del PDF/Word (texto real, se lee con reglas sin IA — ver
// extraerComposicionDeTexto), una foto no tiene texto extraíble, así que
// acá sí hace falta un modelo con visión. Requiere ANTHROPIC_API_KEY; si
// no está configurada, se avisa igual que en generarSugerenciaIA (ia.ts)
// en vez de fallar en silencio.
async function leerComposicionDeImagen(
  buffer: Buffer,
  mediaType: string
): Promise<{ valores: Partial<Record<CampoComposicionCorporal, string>>; fecha: string | null } | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error:
        "La lectura por IA no está configurada todavía (falta ANTHROPIC_API_KEY). Completá los datos a mano, o subí el PDF/Word del reporte si tu balanza lo exporta así.",
    };
  }

  const camposValidos: CampoComposicionCorporal[] = [
    "peso_corporal",
    "imc",
    "pulso",
    "porcentaje_graso",
    "porcentaje_agua",
    "porcentaje_musculo",
    "masa_osea",
    "metabolismo_basal",
    "metabolismo_activo",
    "grasa_visceral",
    "edad_metabolica",
    "soft_lean_mass",
    "lean_body_mass",
    "proteina",
    "masa_muscular",
  ];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system:
          "Sos un asistente que lee la pantalla o el ticket impreso de una balanza de composición corporal (ej. Beurer BF 990, InBody) a partir de una foto. " +
          `Devolvé ÚNICAMENTE un objeto JSON (sin texto alrededor, sin markdown) con esta forma: {"fecha": "YYYY-MM-DD o null", "valores": {...}}. ` +
          `Las claves posibles de "valores" son exactamente: ${camposValidos.join(", ")} — usá SOLO las que puedas leer con confianza en la imagen, como números (string), sin unidades. ` +
          "Nunca inventes un valor que no se vea con claridad en la foto: omití esa clave en vez de adivinar.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
              { type: "text", text: "Leé esta captura de la balanza y devolvé el JSON." },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return { error: "El asistente de IA no pudo leer la imagen. Probá de nuevo o completá los datos a mano." };
    }

    const data = await res.json();
    const texto: string = (data.content ?? [])
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text : ""))
      .join("");

    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return { error: "El asistente no devolvió una lectura válida. Completá los datos a mano." };

    const parseado = JSON.parse(match[0]) as {
      fecha?: string | null;
      valores?: Record<string, unknown>;
    };

    const valores: Partial<Record<CampoComposicionCorporal, string>> = {};
    for (const campo of camposValidos) {
      const v = parseado.valores?.[campo];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        valores[campo] = String(v);
      }
    }

    if (Object.keys(valores).length === 0) {
      return { error: "El asistente no reconoció ningún dato en la imagen. Completá los datos a mano." };
    }

    return { valores, fecha: parseado.fecha ?? null };
  } catch {
    return { error: "No se pudo conectar con el asistente de IA. Completá los datos a mano." };
  }
}

export async function extraerComposicionDeDocumento(
  _prev: ResultadoExtraccionComposicion,
  formData: FormData
): Promise<ResultadoExtraccionComposicion> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí un archivo PDF, Word o una foto de la balanza." };
  }
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
    return { error: "El archivo es demasiado grande (máx. 10 MB)." };
  }

  const nombreArchivo = archivo.name.toLowerCase();
  const esPdf = archivo.type === "application/pdf" || nombreArchivo.endsWith(".pdf");
  const esDocx = nombreArchivo.endsWith(".docx");
  const mediaTypeImagen = TIPOS_IMAGEN[archivo.type];

  if (mediaTypeImagen) {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const resultado = await leerComposicionDeImagen(buffer, mediaTypeImagen);
    if ("error" in resultado) return resultado;
    return { fecha: resultado.fecha, valores: resultado.valores };
  }

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

  const valores = extraerComposicionDeTexto(texto);
  const fecha = extraerFechaDeTexto(texto);

  if (Object.keys(valores).length === 0) {
    return {
      error: "No se reconoció ningún campo conocido en el archivo. Completá los datos a mano.",
    };
  }

  return { fecha, valores };
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

  const fechaRaw = String(formData.get("fecha") ?? "").trim();

  await prisma.progresoFisico.create({
    data: {
      id_alumno,
      origen: "coach",
      ...(fechaRaw ? { fecha: new Date(fechaRaw) } : {}),
      ...parsed.datos,
    },
  });

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

  const fechaRaw = String(formData.get("fecha") ?? "").trim();

  await prisma.progresoFisico.update({
    where: { id_progreso },
    data: {
      ...(fechaRaw ? { fecha: new Date(fechaRaw) } : {}),
      ...parsed.datos,
    },
  });

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
  revalidatePath(`/coach/alumnos/${progreso.id_alumno}`);
}
