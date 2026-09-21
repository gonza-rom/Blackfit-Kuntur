"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";

// El chat interno había quedado dado de baja como canal de comunicación
// (se usaba solo un link a WhatsApp del coach asignado — ver
// src/lib/telefono.ts). Vuelve a estar activo a pedido explícito: la
// pantalla "Mensajes" del alumno y el chat interno del coach escriben acá
// de nuevo. WhatsApp se mantiene como acceso rápido adicional en
// /coach/mensajes, no se saca.

export type EstadoNotificacion = { error?: string } | undefined;

// Devuelve la conversación entre dos usuarios, creándola si hace falta.
// El orden de (id_usuario_1, id_usuario_2) se normaliza para que siempre
// exista una sola fila por par, sin importar quién le escribió primero al
// otro.
export async function obtenerOCrearConversacion(idOtroUsuario: string): Promise<string | null> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return null;
  if (usuario.id_usuario === idOtroUsuario) return null;

  const [id_usuario_1, id_usuario_2] = [usuario.id_usuario, idOtroUsuario].sort();

  const conversacion = await prisma.conversacion.upsert({
    where: { id_usuario_1_id_usuario_2: { id_usuario_1, id_usuario_2 } },
    update: {},
    create: { id_usuario_1, id_usuario_2 },
  });

  return conversacion.id_conversacion;
}

export type EstadoMensaje = { error?: string } | undefined;

export async function enviarMensaje(
  _prev: EstadoMensaje,
  formData: FormData
): Promise<EstadoMensaje> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "No autorizado." };

  const id_conversacion = String(formData.get("id_conversacion") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();
  if (!id_conversacion || !contenido) return { error: "Escribí un mensaje." };

  const conversacion = await prisma.conversacion.findUnique({ where: { id_conversacion } });
  if (
    !conversacion ||
    (conversacion.id_usuario_1 !== usuario.id_usuario &&
      conversacion.id_usuario_2 !== usuario.id_usuario)
  ) {
    return { error: "No autorizado sobre esta conversación." };
  }

  const idOtro =
    conversacion.id_usuario_1 === usuario.id_usuario
      ? conversacion.id_usuario_2
      : conversacion.id_usuario_1;

  await prisma.mensaje.create({
    data: { id_conversacion, id_usuario_emisor: usuario.id_usuario, contenido },
  });

  const otro = await prisma.usuario.findUnique({
    where: { id_usuario: idOtro },
    include: { roles: true },
  });
  const urlDestino = otro?.roles.some((r) => r.rol === "entrenador")
    ? "/coach/mensajes"
    : "/panel/mensajes";

  await crearNotificacion({
    id_usuario: idOtro,
    titulo: `Mensaje de ${usuario.nombre}`,
    contenido: contenido.length > 100 ? `${contenido.slice(0, 97)}...` : contenido,
    tipo: "mensaje",
    url: urlDestino,
  }).catch(() => {});

  revalidatePath("/panel/mensajes");
  revalidatePath("/coach/mensajes");
  return undefined;
}

export async function marcarNotificacionLeida(formData: FormData): Promise<void> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const id_notificacion = String(formData.get("id_notificacion") ?? "");
  if (!id_notificacion) return;

  await prisma.notificacion.updateMany({
    where: { id_notificacion, id_usuario: usuario.id_usuario },
    data: { leido: true },
  });

  revalidatePath("/panel/notificaciones");
}

export async function marcarTodasLeidas(): Promise<void> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  await prisma.notificacion.updateMany({
    where: { id_usuario: usuario.id_usuario, leido: false },
    data: { leido: true },
  });

  revalidatePath("/panel/notificaciones");
}
