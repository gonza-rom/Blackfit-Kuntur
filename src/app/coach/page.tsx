import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";

export default async function CoachPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");
  const { id_entrenador } = contexto;

  const [alumnosActivos, programasActivos, ultimosAlumnos] = await Promise.all([
    prisma.relacionEntrenadorAlumno.count({
      where: { id_entrenador, estado_relacion: "activa" },
    }),
    prisma.programaEntrenamiento.count({
      where: { id_entrenador, estado_programa: "activo" },
    }),
    prisma.relacionEntrenadorAlumno.findMany({
      where: { id_entrenador, estado_relacion: "activa" },
      include: { alumno: { include: { usuario: true } } },
      orderBy: { fecha_inicio: "desc" },
      take: 5,
    }),
  ]);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-3">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-1">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Alumnos activos
          </span>
          <span className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {alumnosActivos}
          </span>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-1">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Programas activos
          </span>
          <span className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {programasActivos}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Últimos alumnos
          </h2>
          <Link
            href="/coach/alumnos"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container uppercase"
          >
            Ver todos
          </Link>
        </div>

        {ultimosAlumnos.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no vinculaste ningún alumno.{" "}
            <Link href="/coach/alumnos/vincular" className="text-primary-container underline">
              Vincular uno
            </Link>
            .
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {ultimosAlumnos.map((relacion) => (
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
                <span className="material-symbols-outlined text-on-surface-variant">
                  chevron_right
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
