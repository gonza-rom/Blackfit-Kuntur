import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual, tieneRol } from "@/lib/auth";
import { obtenerProgramaActivo, calcularBloqueActual } from "@/lib/alumno";

export default async function PanelPage() {
  const contexto = await obtenerAlumnoActual();

  if (!contexto) {
    return (
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Tu cuenta todavía no tiene un perfil de alumno activo.
        </div>
      </main>
    );
  }

  const { usuario, id_alumno } = contexto;

  const inicioSemana = new Date();
  inicioSemana.setHours(0, 0, 0, 0);
  inicioSemana.setDate(inicioSemana.getDate() - 6);

  const programa = await obtenerProgramaActivo(id_alumno);

  const [
    ultimosProgresos,
    habitosEstaSemana,
    entrenamientosPrograma,
    alumnoPuntos,
    objetivosActivos,
    logrosObtenidos,
  ] = await Promise.all([
    prisma.progresoFisico.findMany({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      take: 2,
    }),
    prisma.habito.count({
      where: { id_alumno, fecha: { gte: inicioSemana } },
    }),
    programa
      ? prisma.entrenamiento.findMany({
          where: { id_programa: programa.id_programa },
          select: { estado: true },
        })
      : Promise.resolve([]),
    prisma.alumno.findUnique({
      where: { id_alumno },
      select: { puntos_totales: true },
    }),
    prisma.objetivo.count({ where: { id_alumno, estado: "activo" } }),
    prisma.logroAlumno.count({ where: { id_alumno } }),
  ]);

  const bloqueActual = programa ? calcularBloqueActual(programa) : null;

  const pesoActual = ultimosProgresos[0]?.peso_corporal
    ? Number(ultimosProgresos[0].peso_corporal)
    : null;
  const pesoAnterior = ultimosProgresos[1]?.peso_corporal
    ? Number(ultimosProgresos[1].peso_corporal)
    : null;
  const deltaPeso =
    pesoActual !== null && pesoAnterior !== null ? pesoActual - pesoAnterior : null;

  const totalEntrenamientos = entrenamientosPrograma.length;
  const completados = entrenamientosPrograma.filter(
    (e) => e.estado === "completado"
  ).length;
  const adherencia =
    totalEntrenamientos > 0 ? Math.round((completados / totalEntrenamientos) * 100) : 0;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      {/* Protocolo de hoy */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Protocolo de Hoy
        </h2>
        {bloqueActual ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 relative overflow-hidden [border:1px_solid_#61edda] shadow-[inset_0_0_20px_rgba(97,237,218,0.05)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-[#262626]/50 pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-[family-name:var(--font-sora)] text-[24px] leading-8 tracking-[-0.01em] font-semibold text-on-surface">
                    {bloqueActual.nombre}
                  </h3>
                  <p className="font-[family-name:var(--font-inter)] text-base text-on-surface-variant flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[16px]">
                      fitness_center
                    </span>{" "}
                    {bloqueActual.ejercicios_programa.length} ejercicios
                  </p>
                </div>
                <span
                  className="material-symbols-outlined text-primary-container"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  fitness_center
                </span>
              </div>
              <Link
                href={`/panel/entrenamientos/${bloqueActual.id_bloque}`}
                className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] leading-6 rounded-lg py-3 mt-2 active:scale-[0.98] transition-transform font-bold flex items-center justify-center"
              >
                COMENZAR SESIÓN
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no tenés un programa asignado. Tu entrenador te va a asignar uno pronto.
          </div>
        )}
      </section>

      {/* Métricas de rendimiento */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Métricas de Rendimiento
        </h2>
        <div className="grid grid-cols-3 gap-1">
          {/* Peso */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-on-surface-variant absolute top-4 right-4 text-[20px]">
              monitor_weight
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              PESO ACTUAL
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
                {pesoActual !== null ? (
                  <>
                    {pesoActual}
                    <span className="text-[16px] text-on-surface-variant">kg</span>
                  </>
                ) : (
                  <span className="text-[16px] text-on-surface-variant">Sin datos</span>
                )}
              </div>
              {deltaPeso !== null && (
                <div className="font-[family-name:var(--font-inter)] text-[12px] text-primary-container mt-1">
                  {deltaPeso > 0 ? "+" : ""}
                  {deltaPeso.toFixed(1)}kg
                </div>
              )}
            </div>
          </div>

          {/* Adherencia */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-on-surface-variant absolute top-4 right-4 text-[20px]">
              track_changes
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              ADHERENCIA
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
                {adherencia}
                <span className="text-[16px] text-on-surface-variant">%</span>
              </div>
              <div className="w-full h-1 bg-[#262626] rounded-full mt-2">
                <div
                  className="h-full bg-primary-container rounded-full"
                  style={{ width: `${adherencia}%` }}
                />
              </div>
            </div>
          </div>

          {/* Hábitos */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-on-surface-variant absolute top-4 right-4 text-[20px]">
              check_circle
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              HÁBITOS
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
                {habitosEstaSemana}
                <span className="text-[16px] text-on-surface-variant">/7</span>
              </div>
              <div className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant mt-1">
                Esta semana
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link
          href="/panel/biblioteca"
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2"
        >
          <span className="material-symbols-outlined text-primary-container text-[22px]">
            menu_book
          </span>
          <span className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
            Biblioteca
          </span>
        </Link>
        <Link
          href="/panel/coach"
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2"
        >
          <span className="material-symbols-outlined text-primary-container text-[22px]">
            forum
          </span>
          <span className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
            Tu coach
          </span>
        </Link>
      </section>

      {/* Objetivos y logros (gamificación) */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Objetivos y Logros
        </h2>
        <Link
          href="/panel/logros"
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-primary-container flex items-center justify-center bg-[#131313]">
              <span
                className="material-symbols-outlined text-primary-container text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                emoji_events
              </span>
            </div>
            <div>
              <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                {alumnoPuntos?.puntos_totales ?? 0} puntos
              </p>
              <p className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant">
                {objetivosActivos} objetivo{objetivosActivos === 1 ? "" : "s"} activo
                {objetivosActivos === 1 ? "" : "s"} · {logrosObtenidos} logro
                {logrosObtenidos === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            chevron_right
          </span>
        </Link>
      </section>

      {tieneRol(usuario, "miembro_kuntur") && (
        <section className="flex flex-col gap-1">
          <Link
            href="/panel/beneficios"
            className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between border-l-2 border-l-primary-container"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-primary-container flex items-center justify-center bg-[#131313]">
                <span className="material-symbols-outlined text-primary-container text-[20px]">
                  loyalty
                </span>
              </div>
              <div>
                <h4 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container">
                  ESTADO KUNTUR ACTIVO
                </h4>
                <p className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant">
                  Toca para ver tus beneficios Kuntur
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              qr_code_scanner
            </span>
          </Link>
        </section>
      )}
    </main>
  );
}
