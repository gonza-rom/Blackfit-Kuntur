import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { FilterChips } from "./_components/filter-chips";

type EntrenamientoItem = {
  id_entrenamiento: string;
  nombre: string | null;
  fecha: Date;
  estado: string;
};

type ProgramaItem = {
  id_programa: string;
  nombre: string;
  descripcion: string | null;
  objetivo: string | null;
  entrenador: { usuario: { nombre: string; apellido: string } } | null;
  entrenamientos: EntrenamientoItem[];
};

const FORMATEADOR_HORA = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

function etiquetaDia(fecha: Date): string {
  const hoy = new Date();
  const manana = new Date();
  manana.setDate(hoy.getDate() + 1);

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (mismoDia(fecha, hoy)) return "HOY";
  if (mismoDia(fecha, manana)) return "MAÑ";
  return fecha
    .toLocaleDateString("es-AR", { weekday: "short" })
    .toUpperCase()
    .slice(0, 3);
}

export default async function EntrenamientosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const alumno = user
    ? await prisma.alumno.findUnique({
        where: { id_usuario: user.id },
        include: {
          programas: {
            where: { estado_programa: "activo" },
            include: {
              entrenador: { include: { usuario: true } },
              entrenamientos: { orderBy: { fecha: "asc" } },
            },
          },
        },
      })
    : null;

  const programas: ProgramaItem[] = (alumno?.programas ?? []) as ProgramaItem[];

  const programasConProgreso = programas.map((programa) => {
    const total = programa.entrenamientos.length;
    const completados = programa.entrenamientos.filter(
      (e) => e.estado === "completado"
    ).length;
    const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;
    const proximo = programa.entrenamientos.find(
      (e) => e.estado === "pendiente"
    );

    return { programa, total, completados, porcentaje, proximo };
  });

  // Todas las sesiones pendientes de todos los programas activos, ordenadas por fecha
  const sesionesPendientes = programas
    .flatMap((programa) =>
      programa.entrenamientos
        .filter((e) => e.estado === "pendiente")
        .map((entrenamiento) => ({
          entrenamiento,
          programa,
        }))
    )
    .sort(
      (a, b) =>
        a.entrenamiento.fecha.getTime() - b.entrenamiento.fecha.getTime()
    );

  const destacada = sesionesPendientes[0];
  const proximasSesiones = sesionesPendientes.slice(1, 4);

  return (
    <main className="flex-1 w-full md:pl-0 px-5 md:px-10 py-8 flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Encabezado desktop */}
      <div className="hidden md:flex justify-between items-end border-b border-outline-variant pb-4">
        <h2 className="font-[family-name:var(--font-sora)] text-[36px] leading-[42px] tracking-tighter font-bold text-on-surface uppercase">
          Entrenamientos
        </h2>
        <button className="text-on-surface-variant hover:text-primary-container transition-colors">
          <span className="material-symbols-outlined text-2xl">search</span>
        </button>
      </div>

      {/* Filtros (solo visuales por ahora, no hay campo de categoría en el schema) */}
      <section>
        <FilterChips />
      </section>

      {/* Entrenamiento destacado */}
      <section>
        {destacada ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden relative">
            <div className="relative z-10 p-4 md:p-6 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <span className="inline-block px-3 py-1 bg-background/80 backdrop-blur border border-primary-container/30 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[12px] rounded-full uppercase tracking-widest">
                  Próximo Entrenamiento
                </span>
                <button className="w-10 h-10 rounded-full bg-background/50 backdrop-blur border border-outline-variant flex items-center justify-center text-on-surface hover:text-primary-container transition-colors">
                  <span className="material-symbols-outlined text-[20px]">
                    bookmark
                  </span>
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-[family-name:var(--font-sora)] text-[24px] leading-8 tracking-[-0.01em] font-semibold text-on-surface mb-1">
                    {destacada.entrenamiento.nombre ?? destacada.programa.nombre}
                  </h3>
                  <p className="font-[family-name:var(--font-inter)] text-base text-on-surface-variant flex items-center gap-2 flex-wrap">
                    <span className="material-symbols-outlined text-[16px]">
                      calendar_month
                    </span>
                    {destacada.entrenamiento.fecha.toLocaleDateString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    <span className="w-1 h-1 rounded-full bg-outline-variant mx-1" />
                    <span className="material-symbols-outlined text-[16px]">
                      schedule
                    </span>
                    {FORMATEADOR_HORA.format(destacada.entrenamiento.fecha)}
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full md:w-auto md:self-start bg-primary-container text-background font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] py-4 px-8 rounded-lg uppercase hover:opacity-90 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  COMENZAR ENTRENAMIENTO
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-center">
            <p className="font-[family-name:var(--font-inter)] text-on-surface-variant">
              No tenés entrenamientos pendientes por ahora.
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna izquierda: programas */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase border-b border-outline-variant pb-2">
            Tus Programas
          </h3>
          {programasConProgreso.length === 0 && (
            <div className="p-4 rounded-xl border border-outline-variant bg-surface-container">
              <p className="font-[family-name:var(--font-inter)] text-on-surface-variant">
                Todavía no tenés programas de entrenamiento activos. Tu
                entrenador va a asignarte uno pronto.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {programasConProgreso.map(
              ({ programa, porcentaje, proximo }) => (
                <div
                  key={programa.id_programa}
                  className="p-4 rounded-xl border border-outline-variant bg-surface-container hover:border-primary-container/50 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <div>
                      <h4 className="font-[family-name:var(--font-sora)] text-lg font-bold text-on-surface mb-1 group-hover:text-primary-container transition-colors">
                        {programa.nombre}
                      </h4>
                      <p className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant">
                        {programa.objetivo ?? programa.descripcion ?? "Sin descripción"}
                      </p>
                    </div>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-primary-container whitespace-nowrap">
                      {porcentaje}% completado
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-container rounded-full"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                  <div className="mt-4 flex justify-between items-center text-on-surface-variant">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase">
                      {proximo
                        ? `Siguiente: ${proximo.nombre ?? "Entrenamiento"}`
                        : "Sin sesiones pendientes"}
                    </span>
                    <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Columna derecha: próximas sesiones */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase border-b border-outline-variant pb-2">
            Próximas Sesiones
          </h3>
          {proximasSesiones.length === 0 && (
            <div className="p-4 rounded-xl border border-outline-variant bg-surface">
              <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
                No hay más sesiones agendadas.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {proximasSesiones.map(({ entrenamiento, programa }) => {
              const entrenador = programa.entrenador?.usuario;
              const inicialEntrenador = entrenador?.nombre
                ?.charAt(0)
                .toUpperCase();

              return (
                <div
                  key={entrenamiento.id_entrenamiento}
                  className="p-4 rounded-xl border border-outline-variant bg-surface flex gap-4 items-center"
                >
                  <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] rounded-lg bg-surface-container border border-outline-variant">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-on-surface-variant uppercase">
                      {etiquetaDia(entrenamiento.fecha)}
                    </span>
                    <span className="font-[family-name:var(--font-sora)] text-base text-primary-container">
                      {FORMATEADOR_HORA.format(entrenamiento.fecha)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-[family-name:var(--font-sora)] font-bold text-on-surface mb-1 truncate">
                      {entrenamiento.nombre ?? programa.nombre}
                    </h4>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-surface-container overflow-hidden border border-outline-variant flex items-center justify-center text-on-surface-variant shrink-0">
                        {entrenador ? (
                          <span className="font-[family-name:var(--font-sora)] text-[10px] font-bold text-primary-container">
                            {inicialEntrenador}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[12px]">
                            group
                          </span>
                        )}
                      </div>
                      <span className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant truncate">
                        {entrenador
                          ? `Coach ${entrenador.nombre} ${entrenador.apellido}`
                          : "Sesión grupal"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}