import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { BotonEliminarEntrenamiento } from "./_components/boton-eliminar-entrenamiento";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function HistorialPage() {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const entrenamientos = await prisma.entrenamiento.findMany({
    where: { id_alumno: contexto.id_alumno, estado: "completado" },
    orderBy: { fecha: "desc" },
    include: {
      series: {
        orderBy: [{ id_ejercicio_programa: "asc" }, { numero_serie: "asc" }],
        include: { ejercicio_programa: { include: { ejercicio: true } } },
      },
    },
  });

  const entrenamientosAgrupados = entrenamientos.map((entrenamiento) => {
    const porEjercicio = new Map<
      string,
      { nombre: string; sets: { numero_serie: number | null; peso: number | null; reps: number | null }[] }
    >();
    for (const serie of entrenamiento.series) {
      const grupo = porEjercicio.get(serie.id_ejercicio_programa) ?? {
        nombre: serie.ejercicio_programa.ejercicio.nombre,
        sets: [],
      };
      grupo.sets.push({
        numero_serie: serie.numero_serie,
        peso: serie.peso_utilizado ? Number(serie.peso_utilizado) : null,
        reps: serie.repeticiones_realizadas,
      });
      porEjercicio.set(serie.id_ejercicio_programa, grupo);
    }
    return {
      id_entrenamiento: entrenamiento.id_entrenamiento,
      nombre: entrenamiento.nombre,
      fecha: entrenamiento.fecha,
      comentarios: entrenamiento.comentarios,
      volumen_total: entrenamiento.volumen_total,
      duracion_minutos: entrenamiento.duracion_minutos,
      ejercicios: Array.from(porEjercicio.values()),
    };
  });

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Historial
      </h1>

      {entrenamientosAgrupados.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no registraste ninguna sesión.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {entrenamientosAgrupados.map((entrenamiento) => (
            <div
              key={entrenamiento.id_entrenamiento}
              id={entrenamiento.id_entrenamiento}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3 scroll-mt-20"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-[family-name:var(--font-sora)] text-lg font-semibold text-on-surface">
                  {entrenamiento.nombre ?? "Sesión"}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-on-surface-variant">
                    {FORMATEADOR_FECHA.format(entrenamiento.fecha)}
                  </span>
                  <BotonEliminarEntrenamiento idEntrenamiento={entrenamiento.id_entrenamiento} />
                </div>
              </div>

              {(entrenamiento.volumen_total || entrenamiento.duracion_minutos) && (
                <div className="flex gap-4 text-xs text-on-surface-variant">
                  {entrenamiento.volumen_total != null && (
                    <span>
                      Volumen: {Number(entrenamiento.volumen_total).toLocaleString("es-AR")}kg
                    </span>
                  )}
                  {entrenamiento.duracion_minutos != null && (
                    <span>Duración: {entrenamiento.duracion_minutos} min</span>
                  )}
                </div>
              )}

              {entrenamiento.comentarios && (
                <p className="text-sm text-on-surface-variant italic">
                  &ldquo;{entrenamiento.comentarios}&rdquo;
                </p>
              )}

              {entrenamiento.ejercicios.length > 0 && (
                <div className="flex flex-col gap-1">
                  {entrenamiento.ejercicios.map((ej, i) => (
                    <div
                      key={i}
                      className="bg-[#131313] border border-[#262626] rounded-lg p-3 text-sm text-on-surface"
                    >
                      <p className="font-semibold">{ej.nombre}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ej.sets.map((set, j) => (
                          <span
                            key={j}
                            className="font-[family-name:var(--font-jetbrains-mono)] text-xs bg-[#262626] rounded px-2 py-1 text-on-surface-variant tabular-nums"
                          >
                            Serie {set.numero_serie ?? j + 1} → {set.peso ?? "—"}
                            {set.peso != null ? "kg" : ""} × {set.reps ?? "—"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
