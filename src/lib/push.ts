import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:contacto@blackhub.app";

let configurado = false;
function asegurarConfiguracion() {
  if (configurado || !vapidPublic || !vapidPrivate) return configurado;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  configurado = true;
  return configurado;
}

export type PayloadPush = {
  titulo: string;
  contenido: string;
  url?: string;
  tipo?: string;
};

/**
 * Envía una notificación push a todas las suscripciones activas de un
 * usuario (puede tener varias: distintos navegadores/dispositivos donde
 * instaló la PWA). Si una suscripción quedó inválida (el navegador la dio
 * de baja, el usuario desinstaló la app), Supabase/webpush devuelve 404 o
 * 410 — en ese caso se borra silenciosamente en vez de reintentar.
 *
 * Nunca lanza: si VAPID no está configurado o el envío falla, la
 * notificación in-app (la fila en `notificaciones`) ya se guardó igual —
 * el push es un plus, no una dependencia dura del flujo.
 */
export async function enviarPush(id_usuario: string, payload: PayloadPush): Promise<void> {
  if (!asegurarConfiguracion()) return;

  const suscripciones = await prisma.suscripcionPush.findMany({ where: { id_usuario } });
  if (suscripciones.length === 0) return;

  const cuerpo = JSON.stringify(payload);

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.clave_p256dh, auth: s.clave_auth },
          },
          cuerpo
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.suscripcionPush
            .delete({ where: { id_suscripcion: s.id_suscripcion } })
            .catch(() => {});
        }
        // Otros errores (red, VAPID mal configurado, etc.) se ignoran:
        // no queremos que un push fallido tumbe la acción que lo disparó.
      }
    })
  );
}
