"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
<<<<<<< HEAD
import { crearNotificacion } from "@/lib/notificaciones";
=======
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5

export type EstadoMensaje = { error?: string } | undefined;

/** Devuelve el id de conversación entre dos usuarios, creándola si no existe. */
export async function obtenerOCrearConversacion(
  idUsuarioA: string,
  idUsuarioB: string
): Promise<string> {
  const [id_usuario_1, id_usuario_2] = [idUsuarioA, idUsuarioB].sort();

  const conversacion = await prisma.conversacion.upsert({
    where: { id_usuario_1_id_usuario_2: { id_usuario_1, id_usuario_2 } },
    update: {},
    create: { id_usuario_1, id_usuario_2 },
  });

  return conversacion.id_conversacion;
}

export async function enviarMensaje(
  _prev: EstadoMensaje,
  formData: FormData
): Promise<EstadoMensaje> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "No autorizado." };

  const id_conversacion = String(formData.get("id_conversacion") ?? "");
  const contenido = String(formData.get("contenido") ?? "").trim();
  if (!id_conversacion || !contenido) return { error: "Escribí un mensaje." };

  const conversacion = await prisma.conversacion.findUnique({
    where: { id_conversacion },
  });
  if (
    !conversacion ||
    (conversacion.id_usuario_1 !== usuario.id_usuario &&
      conversacion.id_usuario_2 !== usuario.id_usuario)
  ) {
    return { error: "No autorizado." };
  }

  await prisma.mensaje.create({
    data: { id_conversacion, id_usuario_emisor: usuario.id_usuario, contenido },
  });

  const idDestinatario =
    conversacion.id_usuario_1 === usuario.id_usuario
      ? conversacion.id_usuario_2
      : conversacion.id_usuario_1;

<<<<<<< HEAD
  await crearNotificacion({
    id_usuario: idDestinatario,
    titulo: `Mensaje de ${usuario.nombre}`,
    contenido: contenido.slice(0, 140),
    tipo: "mensaje",
    url: "/panel/chat",
=======
  await prisma.notificacion.create({
    data: {
      id_usuario: idDestinatario,
      titulo: `Mensaje de ${usuario.nombre}`,
      contenido: contenido.slice(0, 140),
      tipo: "mensaje",
    },
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
  });

  revalidatePath("/panel/chat");
  revalidatePath("/coach/mensajes", "layout");
  return undefined;
}

export async function marcarConversacionLeida(id_conversacion: string): Promise<void> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  await prisma.mensaje.updateMany({
    where: {
      id_conversacion,
      id_usuario_emisor: { not: usuario.id_usuario },
      leido: false,
    },
    data: { leido: true },
  });
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
