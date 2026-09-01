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
        include: { ejercicio_programa: { include: { ejercicio: true } } },
      },
    },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Historial
      </h1>

      {entrenamientos.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no registraste ninguna sesión.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {entrenamientos.map((entrenamiento) => (
            <div
              key={entrenamiento.id_entrenamiento}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
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

              {entrenamiento.comentarios && (
                <p className="text-sm text-on-surface-variant italic">
                  &ldquo;{entrenamiento.comentarios}&rdquo;
                </p>
              )}

              {entrenamiento.series.length > 0 && (
                <div className="flex flex-col gap-1">
                  {entrenamiento.series.map((serie) => (
                    <div
                      key={serie.id_serie}
                      className="bg-[#131313] border border-[#262626] rounded-lg p-3 text-sm text-on-surface"
                    >
                      <p className="font-semibold">
                        {serie.ejercicio_programa.ejercicio.nombre}
                      </p>
                      <p className="text-on-surface-variant">
                        {serie.series_completadas ?? "-"}×
                        {serie.repeticiones_realizadas ?? "-"}
                        {serie.peso_utilizado ? ` · ${serie.peso_utilizado}kg` : ""}
                        {serie.rpe ? ` · RPE ${serie.rpe}` : ""}
                      </p>
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
