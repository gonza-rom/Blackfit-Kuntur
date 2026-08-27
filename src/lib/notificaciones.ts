import { prisma } from "@/lib/prisma";
import { enviarPush } from "@/lib/push";

export type DatosNotificacion = {
  id_usuario: string;
  titulo: string;
  contenido: string;
  tipo?: string;
  url?: string;
};

/**
 * Punto único para crear notificaciones: guarda la fila en `notificaciones`
 * (lo que alimenta /panel/notificaciones y el badge del header) y en
 * paralelo intenta el push al navegador/dispositivo. Cualquier action que
 * hoy haga `prisma.notificacion.create(...)` directo debería pasar a usar
 * esto, así el push queda enchufado en todos lados sin repetir lógica.
 */
export async function crearNotificacion(datos: DatosNotificacion): Promise<void> {
  const { id_usuario, titulo, contenido, tipo, url } = datos;

  await prisma.notificacion.create({
    data: { id_usuario, titulo, contenido, tipo },
  });

  await enviarPush(id_usuario, { titulo, contenido, tipo, url });
}
