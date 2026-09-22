"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { EstadoBeneficio } from "@prisma/client";
import { obtenerComercioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { subirAvatar } from "@/lib/storage";

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
    }
  | undefined;

function membresiaVigente(m: { estado_membresia: string; fecha_vencimiento_membresia: Date }) {
  return m.estado_membresia === "activa" && m.fecha_vencimiento_membresia >= new Date();
}

function beneficioVigente(b: { estado: string; fecha_inicio: Date; fecha_vencimiento: Date }) {
  const hoy = new Date();
  return b.estado === "activo" && b.fecha_inicio <= hoy && b.fecha_vencimiento >= hoy;
}

export async function buscarSocio(
  _prev: ResultadoBusquedaSocio,
  formData: FormData
): Promise<ResultadoBusquedaSocio> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return { error: "No autorizado." };

  const identificador = String(formData.get("identificador") ?? "").trim();
  if (!identificador) return { error: "Ingresá un DNI, email o escaneá el QR." };

  // El QR contiene el token opaco `codigo_qr_token`. Como fallback manual
  // (si falla el escaneo) también se puede buscar por DNI o por email —
  // nunca por otros datos sensibles del alumno. El número de socio ya no
  // se usa como vía de búsqueda ni se muestra.
  const usuario = await prisma.usuario.findFirst({
    where: {
      OR: [
        { email: identificador },
        { dni: identificador },
        { credencial: { codigo_qr_token: identificador } },
      ],
    },
    include: {
      credencial: true,
      membresias: {
        orderBy: { fecha_vencimiento_membresia: "desc" },
        take: 1,
        include: { plan_membresia: true },
      },
    },
  });

  if (!usuario) {
    return { error: "No se encontró ningún socio con ese dato." };
  }
  if (!usuario.credencial) {
    return { error: "Ese usuario todavía no tiene una credencial Kuntur." };
  }

  const membresia = usuario.membresias[0];
  const activa = Boolean(membresia && membresiaVigente(membresia));

  let beneficios: BeneficioDisponible[] = [];
  if (activa && membresia) {
    const beneficiosDelComercio = await prisma.beneficio.findMany({
      where: {
        id_comercio: contexto.id_comercio,
        beneficios_planes: { some: { id_plan_membresia: membresia.id_plan_membresia } },
      },
    });
    beneficios = beneficiosDelComercio
      .filter(beneficioVigente)
      .map((b) => ({ id_beneficio: b.id_beneficio, titulo: b.titulo, descuento: b.descuento }));
  }

  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    membresia_activa: activa,
    nombre_plan: membresia?.plan_membresia.nombre ?? null,
    fecha_vencimiento: membresia ? membresia.fecha_vencimiento_membresia.toISOString() : null,
    beneficios,
  };
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
  const contexto = await obtenerComercioActual();
  if (!contexto) return { error: "No autorizado." };

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  if (!id_usuario || !id_beneficio) {
    return { error: "Faltan datos del socio o del beneficio." };
  }

  // Se vuelve a validar todo desde cero contra la base — nunca se confía
  // en lo que haya devuelto `buscarSocio` en el paso anterior.
  const [usuario, beneficio] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id_usuario },
      include: {
        membresias: {
          orderBy: { fecha_vencimiento_membresia: "desc" },
          take: 1,
          include: { plan_membresia: true },
        },
      },
    }),
    prisma.beneficio.findUnique({ where: { id_beneficio } }),
  ]);

  if (!usuario || !beneficio) {
    return { error: "Socio o beneficio inválido." };
  }
  if (beneficio.id_comercio !== contexto.id_comercio) {
    return { error: "Ese beneficio no pertenece a tu comercio." };
  }

  const membresia = usuario.membresias[0];
  const membresiaOk = Boolean(membresia && membresiaVigente(membresia));
  const beneficioOk = beneficioVigente(beneficio);

  let planAsociado = false;
  if (membresiaOk && membresia) {
    const relacion = await prisma.beneficioPlan.findUnique({
      where: {
        id_beneficio_id_plan_membresia: {
          id_beneficio,
          id_plan_membresia: membresia.id_plan_membresia,
        },
      },
    });
    planAsociado = Boolean(relacion);
  }

  const aprobado = membresiaOk && beneficioOk && planAsociado;
  const resultado = aprobado ? "aprobado" : "rechazado";

  await prisma.validacionBeneficio.create({
    data: {
      id_comercio: contexto.id_comercio,
      id_usuario,
      id_beneficio,
      resultado,
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "validacion_qr",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `${resultado}:${usuario.email}`,
  });

  let mensaje = "Beneficio habilitado.";
  if (!membresiaOk) mensaje = "El socio no tiene una membresía Kuntur activa.";
  else if (!beneficioOk) mensaje = "Este beneficio no está vigente.";
  else if (!planAsociado) mensaje = "Este beneficio no está disponible para el plan del socio.";

  return {
    resultado,
    mensaje,
    nombre_socio: `${usuario.nombre} ${usuario.apellido}`,
    titulo_beneficio: beneficio.titulo,
    fecha_vencimiento: membresia ? membresia.fecha_vencimiento_membresia.toISOString() : null,
  };
}

// ------------------------------------------------------------
// CRUD DE BENEFICIOS — el propio comercio los crea/edita/borra, ya no
// depende de que lo cargue el administrador. Cada acción resuelve
// id_comercio desde la sesión (obtenerComercioActual), nunca de un campo
// oculto del form, y para editar/borrar/asignar plan revalida que el
// beneficio en cuestión sea realmente de ESE comercio.
// ------------------------------------------------------------

export type EstadoBeneficioComercio = { error?: string; message?: string } | undefined;

const ESTADOS_BENEFICIO: EstadoBeneficio[] = ["activo", "inactivo", "vencido"];

function esErrorDeIntegridadReferencial(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

export async function crearBeneficioComercio(
  _prev: EstadoBeneficioComercio,
  formData: FormData
): Promise<EstadoBeneficioComercio> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return { error: "No autorizado." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const descuento = String(formData.get("descuento") ?? "").trim() || null;
  const condiciones = String(formData.get("condiciones") ?? "").trim() || null;
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");
  const fecha_vencimientoRaw = String(formData.get("fecha_vencimiento") ?? "");

  if (!titulo || !fecha_inicioRaw || !fecha_vencimientoRaw) {
    return { error: "Completá título y vigencia del beneficio." };
  }

  const beneficio = await prisma.beneficio.create({
    data: {
      id_comercio: contexto.id_comercio,
      titulo,
      descripcion,
      descuento,
      condiciones,
      fecha_inicio: new Date(fecha_inicioRaw),
      fecha_vencimiento: new Date(fecha_vencimientoRaw),
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: beneficio.id_beneficio,
    resultado: `creado:${beneficio.titulo}`,
  });

  revalidatePath("/comercio/beneficios");
  redirect(`/comercio/beneficios/${beneficio.id_beneficio}/editar`);
}

export async function editarBeneficioComercio(
  _prev: EstadoBeneficioComercio,
  formData: FormData
): Promise<EstadoBeneficioComercio> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return { error: "No autorizado." };

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const descuento = String(formData.get("descuento") ?? "").trim() || null;
  const condiciones = String(formData.get("condiciones") ?? "").trim() || null;
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");
  const fecha_vencimientoRaw = String(formData.get("fecha_vencimiento") ?? "");

  if (!id_beneficio || !titulo || !fecha_inicioRaw || !fecha_vencimientoRaw) {
    return { error: "Completá título y vigencia del beneficio." };
  }

  const beneficioActual = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficioActual || beneficioActual.id_comercio !== contexto.id_comercio) {
    return { error: "Ese beneficio no pertenece a tu comercio." };
  }

  const beneficio = await prisma.beneficio.update({
    where: { id_beneficio },
    data: {
      titulo,
      descripcion,
      descuento,
      condiciones,
      fecha_inicio: new Date(fecha_inicioRaw),
      fecha_vencimiento: new Date(fecha_vencimientoRaw),
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `editado:${beneficio.titulo}`,
  });

  revalidatePath(`/comercio/beneficios/${id_beneficio}/editar`);
  revalidatePath("/comercio/beneficios");
  return { message: "Beneficio actualizado." };
}

export async function cambiarEstadoBeneficioComercio(formData: FormData): Promise<void> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoBeneficio;
  if (!id_beneficio || !ESTADOS_BENEFICIO.includes(estado)) return;

  const beneficioActual = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficioActual || beneficioActual.id_comercio !== contexto.id_comercio) return;

  await prisma.beneficio.update({ where: { id_beneficio }, data: { estado } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `estado:${estado}`,
  });

  revalidatePath(`/comercio/beneficios/${id_beneficio}/editar`);
  revalidatePath("/comercio/beneficios");
}

// Borrado definitivo. Si ya tiene validaciones registradas, Postgres
// rechaza el borrado (igual que en admin.ts) — en ese caso conviene
// marcarlo "inactivo"/"vencido" en vez de eliminarlo.
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
        error:
          "No se puede eliminar: ya tiene validaciones registradas. Marcalo como \"inactivo\" o \"vencido\" en vez de borrarlo.",
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

  revalidatePath("/comercio/beneficios");
  redirect("/comercio/beneficios");
}

export async function asignarBeneficioPlanComercio(formData: FormData): Promise<void> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  if (!id_beneficio || !id_plan_membresia) return;

  const beneficio = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficio || beneficio.id_comercio !== contexto.id_comercio) return;

  await prisma.beneficioPlan.upsert({
    where: { id_beneficio_id_plan_membresia: { id_beneficio, id_plan_membresia } },
    update: {},
    create: { id_beneficio, id_plan_membresia },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `plan_asignado:${id_plan_membresia}`,
  });

  revalidatePath(`/comercio/beneficios/${id_beneficio}/editar`);
}

export async function quitarBeneficioPlanComercio(formData: FormData): Promise<void> {
  const contexto = await obtenerComercioActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  if (!id_beneficio || !id_plan_membresia) return;

  const beneficio = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficio || beneficio.id_comercio !== contexto.id_comercio) return;

  await prisma.beneficioPlan.deleteMany({ where: { id_beneficio, id_plan_membresia } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `plan_quitado:${id_plan_membresia}`,
  });

  revalidatePath(`/comercio/beneficios/${id_beneficio}/editar`);
}
