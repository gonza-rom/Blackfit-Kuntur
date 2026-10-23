"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { EstadoBeneficio } from "@prisma/client";
import { obtenerComercioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisar } from "@/lib/aviso";
import { subirAvatar } from "@/lib/storage";
import { crearNotificacion } from "@/lib/notificaciones";
import { evaluarUso, leerBeneficio, membresiasVigentes } from "@/lib/beneficios";

// ------------------------------------------------------------
// Nunca se expone al comercio información de entrenamiento, progreso
// físico, hábitos ni feedback del socio: solo lo mínimo para validar
// la membresía y el beneficio (ver punto 43 del brief del proyecto).
// ------------------------------------------------------------

export type EstadoPerfilComercio = { error?: string; message?: string } | undefined;

// El comercio edita su propia ficha (nombre, dirección, teléfono, etc.).
// Antes esto dependía 100% de que lo cargara el administrador.
export async function actualizarPerfilComercio(
  _prev: EstadoPerfilComercio,
  formData: FormData
): Promise<EstadoPerfilComercio> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const logoArchivo = formData.get("logo");

  if (!nombre) return { error: "El nombre del comercio es obligatorio." };

  // El logo es opcional: si no se elige un archivo nuevo, no se toca.
  let logo: string | undefined;
  if (logoArchivo instanceof File && logoArchivo.size > 0) {
    const url = await subirAvatar("comercios", contexto.id_comercio, logoArchivo);
    if (!url) return { error: "No se pudo subir el logo. Probá con otra imagen (máx. 4 MB)." };
    logo = url;
  }

  await prisma.comercio.update({
    where: { id_comercio: contexto.id_comercio },
    data: { nombre, descripcion, direccion, telefono, email, categoria, ...(logo ? { logo } : {}) },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "modificacion_perfil",
    recurso: "comercio",
    id_recurso: contexto.id_comercio,
    resultado: "actualizado",
  });

  await avisar("Perfil del comercio actualizado.");
  revalidatePath("/comercio/perfil");
  revalidatePath("/comercio");
  return { message: "Perfil actualizado." };
}

export type BeneficioDisponible = {
  id_beneficio: string;
  titulo: string;
  descuento: string | null;
};

export type ResultadoBusquedaSocio =
  | { error: string }
  | {
      id_usuario: string;
      nombre: string;
      apellido: string;
      membresia_activa: boolean;
      nombre_plan: string | null;
      fecha_vencimiento: string | null;
      beneficios: BeneficioDisponible[];
      // Beneficios del comercio que esta persona NO puede usar, y por qué.
      no_disponibles: (BeneficioDisponible & { motivo: string })[];
    }
  | undefined;

// Solo un comercio APROBADO valida beneficios o publica promociones. Uno
// pendiente o rechazado puede ver su panel y su estado, nada más.
async function obtenerComercioAprobado() {
  const contexto = await obtenerComercioActual();
  if (!contexto || contexto.usuario.comercio?.estado !== "activo") return null;
  return contexto;
}

export async function buscarSocio(
  _prev: ResultadoBusquedaSocio,
  formData: FormData
): Promise<ResultadoBusquedaSocio> {
  const contexto = await obtenerComercioAprobado();
  if (!contexto) return { error: "Tu comercio todavía no está aprobado para validar beneficios." };

  const identificador = String(formData.get("identificador") ?? "").trim();
  if (!identificador) return { error: "Ingresá un DNI, email o escaneá el QR." };

  // El QR contiene el token opaco `codigo_qr_token` (se verifica acá, en
  // el servidor: ver el QR en una pantalla no alcanza). Como respaldo si
  // falla el escaneo: DNI, email o número de socio (K-000123) de la
  // credencial. Solo personas con credencial (socios de Kuntur o alumnos
  // de Blackfit que entraron a Beneficios), nunca cualquier usuario.
  const digitos = identificador.replace(/\D/g, "");
  const numeroSocio = /^k-?\d+$/i.test(identificador) ? `K-${digitos.padStart(6, "0")}` : null;
  const esToken = identificador.length >= 16 && !identificador.includes("@");

  try {
    const usuario = await prisma.usuario.findFirst({
      where: {
        credencial: { isNot: null },
        OR: [
          ...(identificador.includes("@") ? [{ email: { equals: identificador, mode: "insensitive" as const } }] : []),
          ...(digitos.length >= 6 && !numeroSocio ? [{ dni: digitos }] : []),
          ...(numeroSocio ? [{ credencial: { numero_socio: numeroSocio } }] : []),
          ...(esToken ? [{ credencial: { codigo_qr_token: identificador } }] : []),
        ],
      },
      select: { id_usuario: true, nombre: true, apellido: true },
    });
    if (!usuario) return { error: "No se encontró ninguna credencial con ese dato." };

    const [vigentes, beneficiosDelComercio, membresia, usos] = await Promise.all([
      membresiasVigentes(usuario.id_usuario),
      prisma.beneficio.findMany({ where: { id_comercio: contexto.id_comercio, estado: "activo" } }),
      prisma.membresia.findFirst({
        where: { id_usuario: usuario.id_usuario, estado_membresia: "activa" },
        orderBy: { fecha_vencimiento_membresia: "desc" },
        include: { plan_membresia: true },
      }),
      prisma.validacionBeneficio.groupBy({
        by: ["id_beneficio"],
        where: { id_usuario: usuario.id_usuario, id_comercio: contexto.id_comercio, resultado: "aprobado" },
        _count: { _all: true },
      }),
    ]);
    const usosPorBeneficio = new Map(usos.map((u) => [u.id_beneficio, u._count._all]));

    const beneficios: BeneficioDisponible[] = [];
    const no_disponibles: (BeneficioDisponible & { motivo: string })[] = [];
    for (const b of beneficiosDelComercio) {
      const evaluacion = evaluarUso(b, vigentes, usosPorBeneficio.get(b.id_beneficio) ?? 0);
      const item = { id_beneficio: b.id_beneficio, titulo: b.titulo, descuento: b.descuento };
      if (evaluacion.ok) beneficios.push(item);
      else no_disponibles.push({ ...item, motivo: evaluacion.motivo });
    }

    return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    membresia_activa: vigentes.blackfit || vigentes.kuntur,
    nombre_plan: membresia?.plan_membresia.nombre ?? null,
    fecha_vencimiento: membresia ? membresia.fecha_vencimiento_membresia.toISOString() : null,
    beneficios,
    no_disponibles,
    };
  } catch (e) {
    console.error("[comercio] buscarSocio:", e);
    return { error: "No se pudo buscar al socio. Probá de nuevo en unos segundos." };
  }
}

export type ResultadoValidacion =
  | { error: string }
  | {
      resultado: "aprobado" | "rechazado";
      mensaje: string;
      nombre_socio: string;
      titulo_beneficio: string;
      fecha_vencimiento: string | null;
    }
  | undefined;

export async function validarBeneficio(
  _prev: ResultadoValidacion,
  formData: FormData
): Promise<ResultadoValidacion> {
  const contexto = await obtenerComercioAprobado();
  if (!contexto) return { error: "Tu comercio todavía no está aprobado para validar beneficios." };

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  if (!id_usuario || !id_beneficio) {
    return { error: "Faltan datos del socio o del beneficio." };
  }

  // Todo se vuelve a validar desde cero contra la base — nunca se confía en
  // lo que haya devuelto `buscarSocio` en el paso anterior.
  const [usuario, beneficio] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id_usuario },
      select: { id_usuario: true, nombre: true, apellido: true, email: true, credencial: { select: { id_credencial: true } } },
    }),
    prisma.beneficio.findUnique({ where: { id_beneficio } }),
  ]);
  if (!usuario?.credencial || !beneficio) return { error: "Socio o beneficio inválido." };
  if (beneficio.id_comercio !== contexto.id_comercio) {
    return { error: "Ese beneficio no pertenece a tu comercio." };
  }
  // Un comercio no es beneficiario de su propia promoción.
  if (usuario.id_usuario === contexto.usuario.id_usuario) {
    return { error: "No podés validar un beneficio para tu propia cuenta." };
  }

  // Las membresías se consultan ANTES de abrir la transacción: hacerlo
  // adentro usaba otra conexión del pool mientras la transacción retenía
  // la suya, y en el hosting eso podía agotar el pool o pasarse del tiempo
  // límite (error al tocar "Validar beneficio").
  let evaluacion: ReturnType<typeof evaluarUso>;
  try {
    const vigentes = await membresiasVigentes(id_usuario);
    // Lock por persona + beneficio: dos validaciones simultáneas (doble
    // toque, dos cajas) no pueden pasar ambas el límite de usos.
    evaluacion = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`validacion:${id_usuario}:${id_beneficio}`}))`;
        const usos = await tx.validacionBeneficio.count({ where: { id_usuario, id_beneficio, resultado: "aprobado" } });
        const ev = evaluarUso(beneficio, vigentes, usos);
        await tx.validacionBeneficio.create({
          data: {
            id_comercio: contexto.id_comercio,
            id_usuario,
            id_beneficio,
            resultado: ev.ok ? "aprobado" : "rechazado",
            motivo: ev.ok ? null : ev.motivo,
          },
        });
        return ev;
      },
      { maxWait: 10_000, timeout: 15_000 }
    );
  } catch (e) {
    console.error("[comercio] validarBeneficio:", e);
    return { error: "No se pudo registrar la validación. Probá de nuevo." };
  }

  const resultado = evaluacion.ok ? "aprobado" : "rechazado";
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "validacion_qr",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `${resultado}:${usuario.id_usuario}`,
  });

  const mensaje = evaluacion.ok ? "Beneficio habilitado." : evaluacion.motivo;
  await avisar(
    evaluacion.ok
      ? `Beneficio aceptado para ${usuario.nombre} ${usuario.apellido}.`
      : `Beneficio rechazado: ${mensaje}`,
    evaluacion.ok ? "exito" : "info"
  );

  const membresia = await prisma.membresia.findFirst({
    where: {
      id_usuario,
      estado_membresia: "activa",
      ...(beneficio.audiencia === "ambos" ? {} : { plan_membresia: { organizacion: beneficio.audiencia } }),
    },
    orderBy: { fecha_vencimiento_membresia: "desc" },
  });

  revalidatePath("/comercio/historial");
  return {
    resultado,
    mensaje,
    nombre_socio: `${usuario.nombre} ${usuario.apellido}`,
    titulo_beneficio: beneficio.titulo,
    fecha_vencimiento: membresia ? membresia.fecha_vencimiento_membresia.toISOString() : null,
  };
}

// ------------------------------------------------------------
// BENEFICIOS DEL COMERCIO — catálogo único (ver lib/beneficios.ts).
// Cada acción resuelve id_comercio desde la sesión, nunca de un campo del
// form, y revalida que el beneficio sea de ESE comercio. Lo que carga un
// comercio queda PENDIENTE hasta que la administración lo aprueba; si
// cambia una condición sensible, vuelve a revisión.
// ------------------------------------------------------------

export type EstadoBeneficioComercio = { error?: string; message?: string } | undefined;

function esErrorDeIntegridadReferencial(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

// Solo la administración de comercios de Kuntur revisa beneficios.
async function avisarAdminsBeneficioPendiente(titulo: string, comercio: string, id_beneficio: string, id_comercio: string) {
  try {
    const admins = await prisma.usuario.findMany({
      where: { roles: { some: { rol: "admin_comercios" } } },
      select: { id_usuario: true },
    });
    await Promise.all(
      admins.map((a) =>
        crearNotificacion({
          id_usuario: a.id_usuario,
          titulo: "Beneficio para revisar",
          contenido: `${comercio}: "${titulo}" espera aprobación.`,
          tipo: "beneficio",
          url: `/admin/comercios/${id_comercio}?beneficio=${id_beneficio}`,
        })
      )
    );
  } catch {
    // Best-effort: el beneficio queda pendiente igual.
  }
}

export async function crearBeneficioComercio(
  _prev: EstadoBeneficioComercio,
  formData: FormData
): Promise<EstadoBeneficioComercio> {
  const contexto = await obtenerComercioAprobado();
  if (!contexto) return { error: "Tu comercio tiene que estar aprobado para cargar beneficios." };

  const datos = leerBeneficio(formData);
  if ("error" in datos) return datos;

  const beneficio = await prisma.beneficio.create({
    data: { ...datos, id_comercio: contexto.id_comercio, estado: "pendiente" },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: beneficio.id_beneficio,
    resultado: `creado_pendiente:${beneficio.titulo}`,
  });
  await avisarAdminsBeneficioPendiente(beneficio.titulo, contexto.usuario.comercio?.nombre ?? "", beneficio.id_beneficio, contexto.id_comercio);

  await avisar(`Beneficio "${beneficio.titulo}" enviado a revisión.`);
  revalidatePath("/comercio/beneficios");
  redirect(`/comercio/beneficios/${beneficio.id_beneficio}/editar`);
}

// Cambiar algo de esto exige una nueva aprobación.
const CAMPOS_SENSIBLES = ["descuento", "condiciones", "audiencia", "limite_usos", "fecha_inicio", "fecha_vencimiento"] as const;

export async function editarBeneficioComercio(
  _prev: EstadoBeneficioComercio,
  formData: FormData
): Promise<EstadoBeneficioComercio> {
  const contexto = await obtenerComercioAprobado();
  if (!contexto) return { error: "Tu comercio tiene que estar aprobado para editar beneficios." };

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const actual = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!actual || actual.id_comercio !== contexto.id_comercio) {
    return { error: "Ese beneficio no pertenece a tu comercio." };
  }

  const datos = leerBeneficio(formData);
  if ("error" in datos) return datos;

  const cambioSensible = CAMPOS_SENSIBLES.some((campo) => {
    const antes = actual[campo];
    const despues = datos[campo];
    return antes instanceof Date && despues instanceof Date
      ? antes.getTime() !== despues.getTime()
      : (antes ?? null) !== (despues ?? null);
  });
  const vuelveARevision = cambioSensible && actual.estado !== "pendiente";

  const beneficio = await prisma.beneficio.update({
    where: { id_beneficio },
    data: { ...datos, ...(cambioSensible ? { estado: "pendiente", motivo_rechazo: null } : {}) },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `editado${cambioSensible ? "_a_revision" : ""}:${beneficio.titulo}`,
  });
  if (vuelveARevision) {
    await avisarAdminsBeneficioPendiente(beneficio.titulo, contexto.usuario.comercio?.nombre ?? "", id_beneficio, contexto.id_comercio);
  }

  const mensaje = cambioSensible
    ? "Cambios guardados. Como modificaste condiciones del beneficio, vuelve a revisión antes de publicarse."
    : "Beneficio actualizado.";
  await avisar(mensaje, cambioSensible ? "info" : "exito");
  revalidatePath(`/comercio/beneficios/${id_beneficio}/editar`);
  revalidatePath("/comercio/beneficios");
  return { message: mensaje };
}

// El comercio puede pausar ("inactivo") o reanudar ("activo") un beneficio
// YA APROBADO. Uno pendiente o rechazado solo lo publica la administración.
export async function cambiarEstadoBeneficioComercio(formData: FormData): Promise<void> {
  const contexto = await obtenerComercioAprobado();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoBeneficio;
  if (!id_beneficio || !["activo", "inactivo"].includes(estado)) return;

  const actual = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!actual || actual.id_comercio !== contexto.id_comercio) return;
  if (!["activo", "inactivo", "vencido"].includes(actual.estado)) {
    await avisar("Este beneficio todavía no fue aprobado por la administración.", "info");
    return;
  }

  await prisma.beneficio.update({ where: { id_beneficio }, data: { estado } });
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `estado:${estado}`,
  });

  await avisar(estado === "activo" ? "Beneficio publicado." : "Beneficio pausado.", estado === "activo" ? "exito" : "info");
  revalidatePath(`/comercio/beneficios/${id_beneficio}/editar`);
  revalidatePath("/comercio/beneficios");
}

// Borrado definitivo. Si ya tiene validaciones registradas, Postgres
// rechaza el borrado — en ese caso conviene pausarlo en vez de eliminarlo.
export async function eliminarBeneficioComercio(
  _prev: EstadoBeneficioComercio,
  formData: FormData
): Promise<EstadoBeneficioComercio> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return { error: "No autorizado." };

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  if (!id_beneficio) return { error: "Beneficio inválido." };

  const beneficio = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficio || beneficio.id_comercio !== contexto.id_comercio) {
    return { error: "Ese beneficio no pertenece a tu comercio." };
  }

  try {
    await prisma.beneficio.delete({ where: { id_beneficio } });
  } catch (err) {
    if (esErrorDeIntegridadReferencial(err)) {
      return {
        error: "No se puede eliminar: ya tiene validaciones registradas. Pausalo en vez de borrarlo.",
      };
    }
    throw err;
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `eliminado:${beneficio.titulo}`,
  });

  await avisar(`Beneficio "${beneficio.titulo}" eliminado.`, "eliminado");
  revalidatePath("/comercio/beneficios");
  redirect("/comercio/beneficios");
}
