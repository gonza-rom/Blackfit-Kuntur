"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RolUsuario, EstadoMembresia } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerAdministradorActual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

export type EstadoAdmin = { error?: string; message?: string } | undefined;

const ROLES_ASIGNABLES: RolUsuario[] = [
  "alumno",
  "entrenador",
  "miembro_kuntur",
  "administrador",
];

const ESTADOS_MEMBRESIA: EstadoMembresia[] = [
  "activa",
  "vencida",
  "cancelada",
  "suspendida",
  "pendiente",
];

export async function asignarRol(formData: FormData): Promise<void> {
  const contexto = await obtenerAdministradorActual();
  if (!contexto) return;

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const rol = String(formData.get("rol") ?? "") as RolUsuario;

  if (!id_usuario || !ROLES_ASIGNABLES.includes(rol)) {
    return;
  }

  const existente = await prisma.usuarioRol.findUnique({
    where: { usuario_rol_unico: { id_usuario, rol } },
  });

  if (!existente) {
    await prisma.usuarioRol.create({ data: { id_usuario, rol } });

    if (rol === "alumno") {
      await prisma.alumno.upsert({
        where: { id_usuario },
        update: {},
        create: { id_usuario },
      });
    }
    if (rol === "entrenador") {
      await prisma.entrenador.upsert({
        where: { id_usuario },
        update: {},
        create: { id_usuario },
      });
    }
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_rol",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `asignado:${rol}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
}

export async function quitarRol(formData: FormData): Promise<void> {
  const contexto = await obtenerAdministradorActual();
  if (!contexto) return;

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const rol = String(formData.get("rol") ?? "") as RolUsuario;

  if (!id_usuario || !ROLES_ASIGNABLES.includes(rol)) {
    return;
  }

  await prisma.usuarioRol.deleteMany({ where: { id_usuario, rol } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_rol",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `quitado:${rol}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
}

export async function crearPlanMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdministradorActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = String(formData.get("precio") ?? "").trim();
  const duracion_diasRaw = String(formData.get("duracion_dias") ?? "").trim();

  if (!nombre || !precio || !duracion_diasRaw) {
    return { error: "Completá nombre, precio y duración." };
  }

  await prisma.planMembresia.create({
    data: {
      nombre,
      descripcion,
      precio,
      duracion_dias: Number(duracion_diasRaw),
    },
  });

  redirect("/admin/planes");
}

export async function activarMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdministradorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");

  if (!id_usuario || !id_plan_membresia) {
    return { error: "Elegí un plan." };
  }

  const plan = await prisma.planMembresia.findUnique({
    where: { id_plan_membresia },
  });
  if (!plan) return { error: "Plan inválido." };

  const fecha_inicio_membresia = fecha_inicioRaw ? new Date(fecha_inicioRaw) : new Date();
  const fecha_vencimiento_membresia = new Date(fecha_inicio_membresia);
  fecha_vencimiento_membresia.setDate(
    fecha_vencimiento_membresia.getDate() + plan.duracion_dias
  );

  await prisma.membresia.create({
    data: {
      id_usuario,
      id_plan_membresia,
      estado_membresia: "activa",
      fecha_inicio_membresia,
      fecha_vencimiento_membresia,
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: id_usuario,
    resultado: `activada:${plan.nombre}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
  return { message: "Membresía activada." };
}

export async function cambiarEstadoMembresia(formData: FormData): Promise<void> {
  const contexto = await obtenerAdministradorActual();
  if (!contexto) return;

  const id_membresia = String(formData.get("id_membresia") ?? "");
  const estado_membresia = String(formData.get("estado_membresia") ?? "") as EstadoMembresia;

  if (!id_membresia || !ESTADOS_MEMBRESIA.includes(estado_membresia)) {
    return;
  }

  const membresia = await prisma.membresia.update({
    where: { id_membresia },
    data: { estado_membresia },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: membresia.id_usuario,
    resultado: `estado:${estado_membresia}`,
  });

  revalidatePath(`/admin/usuarios/${membresia.id_usuario}`);
}
