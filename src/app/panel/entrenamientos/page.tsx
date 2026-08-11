import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { obtenerProgramaActivo, calcularBloqueActual } from "@/lib/alumno";
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

export default async function EntrenamientosPage() {
  const contexto = await obtenerAlumnoActual();

  const alumno = contexto
    ? await prisma.alumno.findUnique({
        where: { id_alumno: contexto.id_alumno },
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

    return { programa, total, completados, porcentaje };
  });

  const programaActivo = contexto ? await obtenerProgramaActivo(contexto.id_alumno) : null;
  const bloqueActual = programaActivo ? calcularBloqueActual(programaActivo) : null;

  return (
    <main className="flex-1 w-full md:pl-0 px-5 md:px-10 py-8 flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Encabezado desktop */}
      <div className="hidden md:flex justify-between items-end border-b border-outline-variant pb-4">
        <h2 className="font-[family-name:var(--font-sora)] text-[36px] leading-[42px] tracking-tighter font-bold text-on-surface uppercase">
          Entrenamientos
        </h2>
        <Link
          href="/panel/entrenamientos/historial"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container uppercase"
        >
          Ver historial
        </Link>
      </div>

      {/* Filtros (solo visuales por ahora, no hay campo de categoría en el schema) */}
      <section>
        <FilterChips />
      </section>

      {/* Sesión sugerida según la semana actual del programa */}
      <section>
        {bloqueActual ? (
          <div className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden relative">
            <div className="relative z-10 p-4 md:p-6 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <span className="inline-block px-3 py-1 bg-background/80 backdrop-blur border border-primary-container/30 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[12px] rounded-full uppercase tracking-widest">
                  Sesión sugerida
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-[family-name:var(--font-sora)] text-[24px] leading-8 tracking-[-0.01em] font-semibold text-on-surface mb-1">
                    {bloqueActual.nombre}
                  </h3>
                  <p className="font-[family-name:var(--font-inter)] text-base text-on-surface-variant flex items-center gap-2 flex-wrap">
                    <span className="material-symbols-outlined text-[16px]">
                      fitness_center
                    </span>
                    {bloqueActual.ejercicios_programa.length} ejercicios
                    {bloqueActual.tipo && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-outline-variant mx-1" />
                        {bloqueActual.tipo}
                      </>
                    )}
                  </p>
                </div>
                <Link
                  href={`/panel/entrenamientos/${bloqueActual.id_bloque}`}
                  className="w-full md:w-auto md:self-start bg-primary-container text-background font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] py-4 px-8 rounded-lg uppercase hover:opacity-90 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  COMENZAR ENTRENAMIENTO
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-center">
            <p className="font-[family-name:var(--font-inter)] text-on-surface-variant">
              Todavía no tenés un programa activo con bloques cargados.
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
            {programasConProgreso.map(({ programa, porcentaje, completados }) => (
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
                    {completados} sesiones
                  </span>
                </div>
                <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha: bloques del programa activo */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase border-b border-outline-variant pb-2">
            Bloques de tu programa
          </h3>
          {!programaActivo || programaActivo.bloques.length === 0 ? (
            <div className="p-4 rounded-xl border border-outline-variant bg-surface">
              <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
                No hay bloques cargados todavía.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {programaActivo.bloques.map((bloque) => (
                <Link
                  key={bloque.id_bloque}
                  href={`/panel/entrenamientos/${bloque.id_bloque}`}
                  className={`p-4 rounded-xl border bg-surface flex items-center justify-between ${
                    bloqueActual?.id_bloque === bloque.id_bloque
                      ? "border-primary-container"
                      : "border-outline-variant"
                  }`}
                >
                  <div>
                    <h4 className="font-[family-name:var(--font-sora)] font-bold text-on-surface">
                      {bloque.nombre}
                    </h4>
                    <p className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant">
                      {bloque.semana_inicio && bloque.semana_fin
                        ? `Semana ${bloque.semana_inicio}-${bloque.semana_fin}`
                        : `${bloque.ejercicios_programa.length} ejercicios`}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                    chevron_right
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
