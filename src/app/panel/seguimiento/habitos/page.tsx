import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { eliminarHabito } from "@/app/actions/alumno";
import { FormHabito } from "./_components/form-habito";

const FORMATEADOR_DIA = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
});

export default async function HabitosPage() {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(inicioSemana.getDate() - 6);

  const habitosSemana = await prisma.habito.findMany({
    where: { id_alumno: contexto.id_alumno, fecha: { gte: inicioSemana } },
    orderBy: { fecha: "desc" },
  });

  const habitoHoy = habitosSemana.find((h) => h.fecha.getTime() === hoy.getTime());

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Hábitos
      </h1>

      <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-3">
          Hoy
        </h2>
        <FormHabito
          habitoHoy={
            habitoHoy
              ? {
                  sueno: habitoHoy.sueno,
                  agua: habitoHoy.agua ? habitoHoy.agua.toString() : null,
                  nutricion: habitoHoy.nutricion,
                  suplementacion: habitoHoy.suplementacion,
                  cardio: habitoHoy.cardio,
                  movilidad: habitoHoy.movilidad,
                  recuperacion: habitoHoy.recuperacion,
                }
              : null
          }
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Últimos 7 días
        </h2>
        {habitosSemana.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no cargaste hábitos esta semana.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {habitosSemana.map((h) => (
              <div
                key={h.id_habito}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm gap-3"
              >
                <span className="text-on-surface-variant capitalize shrink-0">
                  {FORMATEADOR_DIA.format(h.fecha)}
                </span>
                <span className="text-on-surface flex-1">
                  {h.sueno ? `${h.sueno}h sueño` : ""}
                  {h.agua ? ` · ${h.agua}L agua` : ""}
                  {h.cardio ? " · cardio" : ""}
                  {h.movilidad ? " · movilidad" : ""}
                </span>
                <form action={eliminarHabito}>
                  <input type="hidden" name="id_habito" value={h.id_habito} />
                  <button
                    type="submit"
                    aria-label="Eliminar hábitos de este día"
                    className="text-on-surface-variant hover:text-[#ffb4ab] shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
