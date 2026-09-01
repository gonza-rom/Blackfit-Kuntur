import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { obtenerEjerciciosCatalogoConDefaults } from "@/lib/catalogos";
import { eliminarBloque, duplicarBloque, eliminarPlantilla } from "@/app/actions/coach";
// Reusa los mismos componentes de la página de programa real — bloques y
// ejercicios funcionan idénticos en una plantilla, ninguno de los dos
// depende de que el programa tenga alumno.
import { FormNuevoBloque } from "../../[id_programa]/_components/form-nuevo-bloque";
import { FormNuevoEjercicioBloque } from "../../[id_programa]/_components/form-nuevo-ejercicio-bloque";
import { EjercicioProgramaItem } from "../../[id_programa]/_components/ejercicio-programa-item";
import { FormAplicarPlantilla } from "./_components/form-aplicar-plantilla";

export default async function PlantillaDetallePage(
  props: PageProps<"/coach/programas/plantillas/[id_plantilla]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_plantilla } = await props.params;

  const [plantilla, bibliotecaSerializable, relacionesActivas] = await Promise.all([
    prisma.programaEntrenamiento.findUnique({
      where: { id_programa: id_plantilla },
      include: {
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
    prisma.relacionEntrenadorAlumno.findMany({
      where: { id_entrenador: contexto.id_entrenador, estado_relacion: "activa" },
      include: { alumno: { include: { usuario: true } } },
      orderBy: { fecha_inicio: "desc" },
      relationLoadStrategy: "join",
    }),
  ]);

  if (
    !plantilla ||
    plantilla.id_entrenador !== contexto.id_entrenador ||
    !plantilla.es_plantilla
  ) {
    notFound();
  }

  const alumnos = relacionesActivas.map((r) => ({
    id_alumno: r.alumno.id_alumno,
    nombre: r.alumno.usuario.nombre,
    apellido: r.alumno.usuario.apellido,
  }));

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
              {plantilla.nombre}
            </h1>
            <p className="text-sm text-on-surface-variant">
              Plantilla — {plantilla.bloques.length} bloque
              {plantilla.bloques.length === 1 ? "" : "s"}
            </p>
            {plantilla.objetivo && (
              <p className="text-sm text-on-surface-variant">Objetivo: {plantilla.objetivo}</p>
            )}
          </div>

          <form action={eliminarPlantilla}>
            <input type="hidden" name="id_plantilla" value={id_plantilla} />
            <button
              type="submit"
              aria-label="Eliminar plantilla"
              className="shrink-0 text-on-surface-variant hover:text-[#ffb4ab] p-1.5"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Aplicar a un alumno
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormAplicarPlantilla idPlantilla={id_plantilla} alumnos={alumnos} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {plantilla.bloques.map((bloque) => (
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
          <FormNuevoBloque idPrograma={id_plantilla} />
        </div>
      </section>
    </main>
  );
}
