"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

// El chat interno (Conversacion/Mensaje + ChatBox) fue dado de baja como
// canal de comunicación: se reemplazó por un enlace directo a WhatsApp del
// coach asignado (ver src/lib/telefono.ts, /panel/coach y /coach/mensajes).
// Los modelos Conversacion/Mensaje y sus migraciones se conservan para no
// perder el historial ya cargado ni romper las políticas RLS existentes,
// pero ninguna acción los escribe. Con eso también se retira el trigger de
// notificación push `tipo: "mensaje"`.

export type EstadoNotificacion = { error?: string } | undefined;

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
