import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { obtenerOCrearConversacion } from "@/app/actions/comunicacion";
import { ChatThread } from "@/components/chat-thread";

const FORMATEADOR_HORA = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export default async function CoachChatAlumnoPage(
  props: PageProps<"/coach/mensajes/[id_alumno]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
    include: { alumno: { include: { usuario: true } } },
  });
  if (!relacion || relacion.estado_relacion !== "activa") notFound();

  const alumno = relacion.alumno.usuario;
  const id_conversacion = await obtenerOCrearConversacion(alumno.id_usuario);
  if (!id_conversacion) notFound();

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
        <Link
          href="/coach/mensajes"
          aria-label="Volver"
          className="text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="w-10 h-10 rounded-full border border-[#262626] bg-[#131313] flex items-center justify-center">
          <span className="font-[family-name:var(--font-sora)] font-bold text-primary-container">
            {alumno.nombre.charAt(0).toUpperCase()}
          </span>
        </div>
        <p className="font-[family-name:var(--font-sora)] font-semibold text-on-surface">
          {alumno.nombre} {alumno.apellido}
        </p>
      </div>
      <ChatThread
        idConversacion={id_conversacion}
        nombreOtro={alumno.nombre}
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
