import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CoachMensajesPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const relaciones = await prisma.relacionEntrenadorAlumno.findMany({
    where: { id_entrenador: contexto.id_entrenador, estado_relacion: "activa" },
    include: { alumno: { include: { usuario: true } } },
  });

  const filas = await Promise.all(
    relaciones.map(async (r) => {
      const idUsuarioAlumno = r.alumno.usuario.id_usuario;
      const [id_usuario_1, id_usuario_2] = [contexto.usuario.id_usuario, idUsuarioAlumno].sort();
      const conversacion = await prisma.conversacion.findUnique({
        where: { id_usuario_1_id_usuario_2: { id_usuario_1, id_usuario_2 } },
        include: {
          mensajes: { orderBy: { fecha_envio: "desc" }, take: 1 },
          _count: {
            select: {
              mensajes: {
                where: { leido: false, id_usuario_emisor: { not: contexto.usuario.id_usuario } },
              },
            },
          },
        },
      });

      return {
        id_alumno: r.alumno.id_alumno,
        nombre: `${r.alumno.usuario.nombre} ${r.alumno.usuario.apellido}`,
        ultimoMensaje: conversacion?.mensajes[0]?.contenido ?? null,
        noLeidos: conversacion?._count.mensajes ?? 0,
      };
    })
  );

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-4">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Mensajes
      </h1>

      {filas.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          No tenés alumnos activos todavía.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filas.map((f) => (
            <Link
              key={f.id_alumno}
              href={`/coach/mensajes/${f.id_alumno}`}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-on-surface font-medium">{f.nombre}</p>
                <p className="text-xs text-on-surface-variant truncate max-w-[220px]">
                  {f.ultimoMensaje ?? "Sin mensajes todavía"}
                </p>
              </div>
              {f.noLeidos > 0 && (
                <span className="bg-primary-container text-black text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {f.noLeidos}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
