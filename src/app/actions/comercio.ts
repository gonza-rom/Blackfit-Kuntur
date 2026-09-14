"use server";

import { revalidatePath } from "next/cache";
import { obtenerComercioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

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

  if (!nombre) return { error: "El nombre del comercio es obligatorio." };

  await prisma.comercio.update({
    where: { id_comercio: contexto.id_comercio },
    data: { nombre, descripcion, direccion, telefono, email, categoria },
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
      numero_socio: string;
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
  if (!identificador) return { error: "Ingresá un código, número de socio o email." };

  // El QR contiene el token opaco `codigo_qr_token`. Como fallback manual
  // (si falla el escaneo) también se puede buscar por número de socio o
  // por email — nunca por datos sensibles del alumno.
  const usuario = await prisma.usuario.findFirst({
    where: {
      OR: [
        { email: identificador },
        { credencial: { codigo_qr_token: identificador } },
        { credencial: { numero_socio: identificador } },
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
    return { error: "No se encontró ningún socio con ese código." };
  }
  if (!usuario.credencial) {
    return { error: "Ese usuario todavía no tiene una credencial Kuntur." };
  }
  const credencialUsuario = usuario.credencial;

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
    numero_socio: credencialUsuario.numero_socio,
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
