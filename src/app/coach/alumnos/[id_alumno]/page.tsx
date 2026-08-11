import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";

export default async function AlumnoDetallePage(
  props: PageProps<"/coach/alumnos/[id_alumno]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: {
        id_entrenador: contexto.id_entrenador,
        id_alumno,
      },
    },
    include: { alumno: { include: { usuario: true } } },
  });

  if (!relacion || relacion.estado_relacion !== "activa") {
    notFound();
  }

  const programas = await prisma.programaEntrenamiento.findMany({
    where: { id_alumno, id_entrenador: contexto.id_entrenador },
    orderBy: { fecha_inicio: "desc" },
  });

  const { usuario } = relacion.alumno;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {usuario.nombre} {usuario.apellido}
        </h1>
        <p className="text-sm text-on-surface-variant">{usuario.email}</p>
        {relacion.alumno.objetivo && (
          <p className="text-sm text-on-surface-variant">
            Objetivo: {relacion.alumno.objetivo}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Programas
          </h2>
          <Link
            href={`/coach/alumnos/${id_alumno}/programas/nuevo`}
            className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo programa
          </Link>
        </div>

        {programas.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Este alumno todavía no tiene programas.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {programas.map((programa) => (
              <Link
                key={programa.id_programa}
                href={`/coach/programas/${programa.id_programa}`}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                    {programa.nombre}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {programa.fecha_inicio.toLocaleDateString("es-AR")}
                  </p>
                </div>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                  {programa.estado_programa}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
