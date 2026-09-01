import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { evaluarLogros } from "@/lib/gamificacion";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

const ETIQUETA_ESTADO_OBJETIVO: Record<string, string> = {
  activo: "En curso",
  cumplido: "Cumplido",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

const ETIQUETA_TIPO_OBJETIVO: Record<string, string> = {
  volumen: "Volumen",
  frecuencia: "Frecuencia",
  habito: "Hábitos",
  peso_corporal: "Peso corporal",
  custom: "Personalizado",
};

export default async function LogrosPage() {
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

  const { id_alumno } = contexto;

  // Oportunista: una visita a esta pantalla también puede destrabar un
  // logro (igual que verificarRecordatorioMembresia en el layout). Nunca
  // bloquea el render.
  await evaluarLogros(id_alumno).catch(() => {});

  const [alumno, objetivos, movimientos, catalogo, obtenidos] = await Promise.all([
    prisma.alumno.findUnique({
      where: { id_alumno },
      select: { puntos_totales: true },
    }),
    prisma.objetivo.findMany({
      where: { id_alumno },
      orderBy: [{ estado: "asc" }, { fecha_creacion: "desc" }],
    }),
    prisma.movimientoPuntos.findMany({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      take: 8,
    }),
    prisma.logro.findMany({
      where: { activo: true },
      orderBy: { fecha_creacion: "asc" },
    }),
    prisma.logroAlumno.findMany({
      where: { id_alumno },
      select: { id_logro: true, fecha_obtenido: true },
    }),
  ]);

  const puntos = alumno?.puntos_totales ?? 0;
  const obtenidosMap = new Map(obtenidos.map((l) => [l.id_logro, l.fecha_obtenido]));

  const objetivosActivos = objetivos.filter((o) => o.estado === "activo");
  const objetivosCerrados = objetivos.filter((o) => o.estado !== "activo");

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Objetivos y logros
        </h1>
        <p className="text-sm text-on-surface-variant">
          Sumás puntos cada día que te movés: entrenamientos completados,
          hábitos cargados y feedback diario.
        </p>
      </section>

      {/* Puntos */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Puntos
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <span className="font-[family-name:var(--font-sora)] text-[40px] leading-none font-bold text-primary-container">
              {puntos}
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-1">
              puntos totales
            </span>
          </div>
          {movimientos.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-[#262626] pt-3">
              {movimientos.map((m) => (
                <div
                  key={m.id_movimiento}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-on-surface-variant">
                    {m.descripcion ?? m.motivo}
                  </span>
                  <span className="text-on-surface tabular-nums">
                    +{m.cantidad}
                    <span className="text-on-surface-variant text-xs ml-2">
                      {FORMATEADOR_FECHA.format(m.fecha)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Objetivos */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Objetivos activos
        </h2>
        {objetivosActivos.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Tu coach todavía no te cargó objetivos.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {objetivosActivos.map((o) => {
              const meta = Number(o.meta);
              const progreso = Number(o.progreso_actual);
              const pct =
                meta > 0 ? Math.min(100, Math.round((progreso / meta) * 100)) : 0;
              return (
                <div
                  key={o.id_objetivo}
                  className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                        {o.titulo}
                      </p>
                      {o.descripcion && (
                        <p className="text-sm text-on-surface-variant mt-0.5">
                          {o.descripcion}
                        </p>
                      )}
                    </div>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase shrink-0">
                      {ETIQUETA_TIPO_OBJETIVO[o.tipo] ?? o.tipo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span>
                      {progreso} / {meta}
                    </span>
                    <span>
                      {pct}%
                      {o.fecha_objetivo
                        ? ` · meta ${FORMATEADOR_FECHA.format(o.fecha_objetivo)}`
                        : ""}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#262626] rounded-full">
                    <div
                      className="h-full bg-primary-container rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {objetivosCerrados.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {objetivosCerrados.map((o) => (
              <div
                key={o.id_objetivo}
                className="bg-[#141414] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">{o.titulo}</span>
                <span
                  className={`font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase ${
                    o.estado === "cumplido"
                      ? "text-primary-container"
                      : "text-on-surface-variant"
                  }`}
                >
                  {ETIQUETA_ESTADO_OBJETIVO[o.estado] ?? o.estado}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Logros */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Logros ({obtenidosMap.size}/{catalogo.length})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {catalogo.map((logro) => {
            const desbloqueado = obtenidosMap.has(logro.id_logro);
            const fecha = obtenidosMap.get(logro.id_logro);
            return (
              <div
                key={logro.id_logro}
                className={`rounded-xl p-4 flex flex-col items-center text-center gap-1 border ${
                  desbloqueado
                    ? "bg-[#1A1A1A] border-primary-container/40 shadow-[inset_0_0_20px_rgba(97,237,218,0.05)]"
                    : "bg-[#141414] border-[#262626] opacity-60"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[32px] ${
                    desbloqueado ? "text-primary-container" : "text-on-surface-variant"
                  }`}
                  style={desbloqueado ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {desbloqueado ? logro.icono ?? "emoji_events" : "lock"}
                </span>
                <p className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
                  {logro.titulo}
                </p>
                <p className="text-[11px] text-on-surface-variant leading-tight">
                  {logro.descripcion}
                </p>
                {desbloqueado && fecha && (
                  <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-primary-container uppercase mt-1">
                    {FORMATEADOR_FECHA.format(fecha)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Link
        href="/panel"
        className="text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Volver al inicio
      </Link>
    </main>
  );
}
