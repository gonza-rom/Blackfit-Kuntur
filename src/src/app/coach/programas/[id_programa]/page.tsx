import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { FormNuevoBloque } from "./_components/form-nuevo-bloque";
import { FormNuevoEjercicioBloque } from "./_components/form-nuevo-ejercicio-bloque";

export default async function ProgramaDetallePage(
  props: PageProps<"/coach/programas/[id_programa]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_programa } = await props.params;

  const [programa, biblioteca] = await Promise.all([
    prisma.programaEntrenamiento.findUnique({
      where: { id_programa },
      include: {
        alumno: { include: { usuario: true } },
        bloques: {
          orderBy: { orden: "asc" },
          include: {
            ejercicios_programa: {
              orderBy: { orden: "asc" },
              include: { ejercicio: true },
            },
          },
        },
      },
    }),
    prisma.ejercicio.findMany({
      orderBy: { nombre: "asc" },
      select: { id_ejercicio: true, nombre: true },
    }),
  ]);

  if (!programa || programa.id_entrenador !== contexto.id_entrenador) {
    notFound();
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {programa.nombre}
        </h1>
        <p className="text-sm text-on-surface-variant">
          {programa.alumno.usuario.nombre} {programa.alumno.usuario.apellido} ·{" "}
          {programa.estado_programa}
        </p>
        {programa.objetivo && (
          <p className="text-sm text-on-surface-variant">Objetivo: {programa.objetivo}</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {programa.bloques.map((bloque) => (
          <div
            key={bloque.id_bloque}
            className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-sora)] text-lg font-semibold text-on-surface">
                  {bloque.nombre}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  {bloque.tipo && `${bloque.tipo} · `}
                  {bloque.semana_inicio && bloque.semana_fin
                    ? `semana ${bloque.semana_inicio}-${bloque.semana_fin}`
                    : ""}
                </p>
              </div>
            </div>

            {bloque.ejercicios_programa.length > 0 && (
              <div className="flex flex-col gap-1">
                {bloque.ejercicios_programa.map((ep) => (
                  <div
                    key={ep.id_ejercicio_programa}
                    className="bg-[#131313] border border-[#262626] rounded-lg p-3 text-sm text-on-surface"
                  >
                    <p className="font-semibold">{ep.ejercicio.nombre}</p>
                    <p className="text-on-surface-variant">
                      {ep.series}×{ep.repeticiones}
                      {ep.peso_sugerido ? ` · ${ep.peso_sugerido.toString()}kg` : ""}
                      {ep.tempo ? ` · tempo ${ep.tempo}` : ""}
                      {ep.descanso ? ` · descanso ${ep.descanso}` : ""}
                      {ep.metodo_entrenamiento ? ` · ${ep.metodo_entrenamiento}` : ""}
                      {ep.tiempo_bajo_tension_sugerido
                        ? ` · TUT ${ep.tiempo_bajo_tension_sugerido}s`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <FormNuevoEjercicioBloque idBloque={bloque.id_bloque} biblioteca={biblioteca} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Nuevo bloque
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormNuevoBloque idPrograma={id_programa} />
        </div>
      </section>
    </main>
  );
}
