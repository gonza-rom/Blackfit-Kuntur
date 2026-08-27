import { prisma } from "@/lib/prisma";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminPage() {
  const hace7 = new Date();
  hace7.setDate(hace7.getDate() - 7);
  const hace14 = new Date();
  hace14.setDate(hace14.getDate() - 14);

  const [porRol, porEstadoMembresia, ultimaActividad, comercios, validacionesSemanaAnterior] =
    await Promise.all([
      prisma.usuarioRol.groupBy({ by: ["rol"], _count: { _all: true } }),
      prisma.membresia.groupBy({ by: ["estado_membresia"], _count: { _all: true } }),
      prisma.registroAuditoria.findMany({
        orderBy: { fecha: "desc" },
        take: 10,
        include: { usuario: true },
      }),
      prisma.comercio.findMany({
        include: {
          _count: { select: { validaciones: true } },
          validaciones: {
            where: { fecha_validacion: { gte: hace7 } },
            select: { resultado: true },
          },
        },
      }),
      prisma.validacionBeneficio.groupBy({
        by: ["id_comercio"],
        where: { fecha_validacion: { gte: hace14, lt: hace7 } },
        _count: { _all: true },
      }),
    ]);

  const activas =
    porEstadoMembresia.find((e) => e.estado_membresia === "activa")?._count._all ?? 0;
  const vencidas =
    porEstadoMembresia.find((e) => e.estado_membresia === "vencida")?._count._all ?? 0;

  const semanaAnteriorPorComercio = new Map<string, number>(
    validacionesSemanaAnterior.map((v) => [v.id_comercio, v._count._all])
  );

  const rankingComercios = comercios
    .map((c) => {
      const estaSemana = c.validaciones.length;
      const aprobadas = c.validaciones.filter((v) => v.resultado === "aprobado").length;
      const semanaPasada = semanaAnteriorPorComercio.get(c.id_comercio) ?? 0;
      return {
        nombre: c.nombre,
        totalHistorico: c._count.validaciones,
        estaSemana,
        aprobadas,
        tendencia: estaSemana - semanaPasada,
      };
    })
    .filter((c) => c.totalHistorico > 0)
    .sort((a, b) => b.totalHistorico - a.totalHistorico)
    .slice(0, 6);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Panel de administrador
      </h1>

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Membresías activas
          </span>
          <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {activas}
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Membresías vencidas
          </span>
          <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {vencidas}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Usuarios por rol
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {porRol.map((r) => (
            <div
              key={r.rol}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-center"
            >
              <div className="font-[family-name:var(--font-sora)] text-xl font-bold text-on-surface">
                {r._count._all}
              </div>
              <div className="text-xs text-on-surface-variant capitalize">{r.rol}</div>
            </div>
          ))}
        </div>
      </section>

      {rankingComercios.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Comercios más usados
          </h2>
          <div className="flex flex-col gap-1">
            {rankingComercios.map((c) => (
              <div
                key={c.nombre}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="text-on-surface font-medium">{c.nombre}</p>
                  <p className="text-xs text-on-surface-variant">
                    {c.totalHistorico} validaciones históricas · {c.estaSemana} esta semana (
                    {c.aprobadas} aprobadas)
                  </p>
                </div>
                {c.tendencia !== 0 && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-[family-name:var(--font-jetbrains-mono)] ${
                      c.tendencia > 0 ? "text-primary-container" : "text-[#ffb4ab]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {c.tendencia > 0 ? "trending_up" : "trending_down"}
                    </span>
                    {Math.abs(c.tendencia)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Últimas acciones
        </h2>
        {ultimaActividad.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no hay actividad registrada.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {ultimaActividad.map((registro) => (
              <div
                key={registro.id_registro}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface">
                  {registro.accion}
                  {registro.resultado ? ` · ${registro.resultado}` : ""}
                  {registro.usuario ? ` · ${registro.usuario.email}` : ""}
                </span>
                <span className="text-on-surface-variant text-xs">
                  {FORMATEADOR_FECHA.format(registro.fecha)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
