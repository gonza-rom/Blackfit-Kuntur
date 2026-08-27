"use server";

import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

export type EstadoPush = { error?: string; ok?: boolean };

export async function guardarSuscripcionPush(
  suscripcion: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<EstadoPush> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "No autorizado." };

  const { endpoint, keys } = suscripcion;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return { error: "Suscripción inválida." };
  }

  await prisma.suscripcionPush.upsert({
    where: { endpoint },
    update: { id_usuario: usuario.id_usuario, clave_p256dh: keys.p256dh, clave_auth: keys.auth },
    create: {
      id_usuario: usuario.id_usuario,
      endpoint,
      clave_p256dh: keys.p256dh,
      clave_auth: keys.auth,
    },
  });

  return { ok: true };
}

export async function eliminarSuscripcionPush(endpoint: string): Promise<EstadoPush> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "No autorizado." };

  await prisma.suscripcionPush
    .deleteMany({ where: { endpoint, id_usuario: usuario.id_usuario } })
    .catch(() => {});

  return { ok: true };
}
