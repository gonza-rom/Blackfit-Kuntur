import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";

export default async function CoachAlumnosPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const relaciones = await prisma.relacionEntrenadorAlumno.findMany({
    where: { id_entrenador: contexto.id_entrenador },
    include: { alumno: { include: { usuario: true } } },
    orderBy: { fecha_inicio: "desc" },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Alumnos
        </h1>
        <Link
          href="/coach/alumnos/vincular"
          className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Vincular
        </Link>
      </div>

      {relaciones.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no vinculaste ningún alumno.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {relaciones.map((relacion) => (
            <Link
              key={relacion.id_relacion}
              href={`/coach/alumnos/${relacion.alumno.id_alumno}`}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {relacion.alumno.usuario.nombre} {relacion.alumno.usuario.apellido}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {relacion.alumno.usuario.email}
                </p>
              </div>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                {relacion.estado_relacion}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
