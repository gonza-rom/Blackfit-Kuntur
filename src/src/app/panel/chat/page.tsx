import { redirect } from "next/navigation";
import { obtenerUsuarioActual, tieneRol } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenerOCrearConversacion } from "@/app/actions/comunicacion";
import { ChatBox, type MensajeChat } from "@/components/chat-box";

export default async function PanelChatPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneRol(usuario, "alumno") || !usuario.alumno) redirect("/panel");

  const relacion = await prisma.relacionEntrenadorAlumno.findFirst({
    where: { id_alumno: usuario.alumno.id_alumno, estado_relacion: "activa" },
    include: { entrenador: { include: { usuario: true } } },
  });

  if (!relacion) {
    return (
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-8">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no tenés un entrenador asignado — cuando el equipo de Kuntur te
          asigne uno, vas a poder chatear acá.
        </div>
      </main>
    );
  }

  const idConversacion = await obtenerOCrearConversacion(
    usuario.id_usuario,
    relacion.entrenador.usuario.id_usuario
  );

  const mensajesDb = await prisma.mensaje.findMany({
    where: { id_conversacion: idConversacion },
    orderBy: { fecha_envio: "asc" },
    take: 200,
  });

  const mensajes: MensajeChat[] = mensajesDb.map((m) => ({
    id_mensaje: m.id_mensaje,
    contenido: m.contenido,
    fecha_envio: m.fecha_envio.toISOString(),
    esMio: m.id_usuario_emisor === usuario.id_usuario,
  }));

  return (
    <ChatBox
      idConversacion={idConversacion}
      nombreInterlocutor={`${relacion.entrenador.usuario.nombre} ${relacion.entrenador.usuario.apellido}`}
      mensajes={mensajes}
    />
  );
}
