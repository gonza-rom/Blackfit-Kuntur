import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { obtenerOCrearConversacion } from "@/app/actions/comunicacion";
import { ChatThread } from "@/components/chat-thread";

const FORMATEADOR_HORA = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export default async function PanelMensajesPage() {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const relacion = await prisma.relacionEntrenadorAlumno.findFirst({
    where: { id_alumno: contexto.id_alumno, estado_relacion: "activa" },
    include: { entrenador: { include: { usuario: true } } },
  });

  if (!relacion) {
    return (
      <main className="flex-1 w-full max-w-md sm:max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface mb-4">
          Mensajes
        </h1>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no tenés un entrenador asignado — cuando te asignen uno vas a poder
          escribirle desde acá.
        </div>
      </main>
    );
  }

  const coach = relacion.entrenador.usuario;
  const id_conversacion = await obtenerOCrearConversacion(coach.id_usuario);
  if (!id_conversacion) redirect("/panel");

  const mensajes = await prisma.mensaje.findMany({
    where: { id_conversacion },
    orderBy: { fecha_envio: "asc" },
    take: 200,
  });

  await prisma.mensaje.updateMany({
    where: {
      id_conversacion,
      id_usuario_emisor: { not: contexto.usuario.id_usuario },
      leido: false,
    },
    data: { leido: true },
  });

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl mx-auto flex flex-col min-h-0 h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-2rem)]">
      <div className="px-4 sm:px-6 py-4 border-b border-[#262626] flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full border border-[#262626] bg-[#131313] flex items-center justify-center">
          <span className="font-[family-name:var(--font-sora)] font-bold text-primary-container">
            {coach.nombre.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-[family-name:var(--font-sora)] font-semibold text-on-surface">
            {coach.nombre} {coach.apellido}
          </p>
          <p className="text-xs text-on-surface-variant">Tu coach</p>
        </div>
      </div>
      <ChatThread
        idConversacion={id_conversacion}
        nombreOtro={coach.nombre}
        mensajes={mensajes.map((m) => ({
          id_mensaje: m.id_mensaje,
          contenido: m.contenido,
          horaLabel: FORMATEADOR_HORA.format(m.fecha_envio),
          esPropio: m.id_usuario_emisor === contexto.usuario.id_usuario,
        }))}
      />
    </main>
  );
}
