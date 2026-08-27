import { redirect, notFound } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenerOCrearConversacion, marcarConversacionLeida } from "@/app/actions/comunicacion";
import { ChatBox, type MensajeChat } from "@/components/chat-box";

export default async function CoachMensajeAlumnoPage(
  props: PageProps<"/coach/mensajes/[id_alumno]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;

  const relacion = await prisma.relacionEntrenadorAlumno.findFirst({
    where: {
      id_alumno,
      id_entrenador: contexto.id_entrenador,
      estado_relacion: "activa",
    },
    include: { alumno: { include: { usuario: true } } },
  });

  if (!relacion) notFound();

  const idConversacion = await obtenerOCrearConversacion(
    contexto.usuario.id_usuario,
    relacion.alumno.usuario.id_usuario
  );

  await marcarConversacionLeida(idConversacion);

  const mensajesDb = await prisma.mensaje.findMany({
    where: { id_conversacion: idConversacion },
    orderBy: { fecha_envio: "asc" },
    take: 200,
  });

  const mensajes: MensajeChat[] = mensajesDb.map((m) => ({
    id_mensaje: m.id_mensaje,
    contenido: m.contenido,
    fecha_envio: m.fecha_envio.toISOString(),
    esMio: m.id_usuario_emisor === contexto.usuario.id_usuario,
  }));

  return (
    <ChatBox
      idConversacion={idConversacion}
      nombreInterlocutor={`${relacion.alumno.usuario.nombre} ${relacion.alumno.usuario.apellido}`}
      mensajes={mensajes}
    />
  );
}
