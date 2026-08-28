import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { obtenerEjerciciosCatalogoConDefaults } from "@/lib/catalogos";
import { eliminarBloque, duplicarBloque, avisarAlumnoRutinaLista } from "@/app/actions/coach";
import { FormNuevoBloque } from "./_components/form-nuevo-bloque";
import { FormNuevoEjercicioBloque } from "./_components/form-nuevo-ejercicio-bloque";
import { EjercicioProgramaItem } from "./_components/ejercicio-programa-item";

export default async function ProgramaDetallePage(
  props: PageProps<"/coach/programas/[id_programa]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_programa } = await props.params;

  const [programa, bibliotecaSerializable] = await Promise.all([
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
    obtenerEjerciciosCatalogoConDefaults(),
  ]);

  if (!programa || programa.id_entrenador !== contexto.id_entrenador) {
    notFound();
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div>
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
          </div>

          {programa.bloques.some((b) => b.ejercicios_programa.length > 0) && (
            <form action={avisarAlumnoRutinaLista}>
              <input type="hidden" name="id_programa" value={id_programa} />
              <button
                type="submit"
                className="shrink-0 flex items-center gap-1.5 bg-primary-container text-black font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase font-bold px-3 py-2 rounded-full"
              >
                <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                Avisar al alumno
              </button>
            </form>
          )}
        </div>
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

              <div className="flex items-center gap-1 shrink-0">
                <form action={duplicarBloque}>
                  <input type="hidden" name="id_bloque" value={bloque.id_bloque} />
                  <button
                    type="submit"
                    aria-label="Duplicar bloque"
                    title="Duplicar bloque (ej: para la semana siguiente)"
                    className="text-on-surface-variant hover:text-on-surface p-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                </form>
                <form action={eliminarBloque}>
                  <input type="hidden" name="id_bloque" value={bloque.id_bloque} />
                  <button
                    type="submit"
                    aria-label="Eliminar bloque"
                    className="text-[#ffb4ab] hover:opacity-80 p-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </form>
              </div>
            </div>

            {bloque.ejercicios_programa.length > 0 && (
              <div className="flex flex-col gap-1">
                {bloque.ejercicios_programa.map((ep, idx) => (
                  <EjercicioProgramaItem
                    key={ep.id_ejercicio_programa}
                    ejercicio={{
                      id_ejercicio_programa: ep.id_ejercicio_programa,
                      nombre: ep.ejercicio.nombre,
                      series: ep.series,
                      repeticiones: ep.repeticiones,
                      peso_sugerido: ep.peso_sugerido ? ep.peso_sugerido.toString() : null,
                      tempo: ep.tempo,
                      descanso: ep.descanso,
                      metodo_entrenamiento: ep.metodo_entrenamiento,
                      tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
                    }}
                    esPrimero={idx === 0}
                    esUltimo={idx === bloque.ejercicios_programa.length - 1}
                  />
                ))}
              </div>
            )}

            <FormNuevoEjercicioBloque idBloque={bloque.id_bloque} biblioteca={bibliotecaSerializable} />
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
