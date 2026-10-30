import Link from "next/link";
import { prisma } from "@/lib/prisma";

const ESTILO_ESTADO: Record<string, string> = {
  activo: "border-primary-container text-primary-container",
  inactivo: "border-outline-variant text-on-surface-variant",
  pendiente: "border-[#eda100] text-[#eda100]",
  rechazado: "border-[#ffb4ab] text-[#ffb4ab]",
};

export default async function AdminComerciosPage() {
  const [comerciosTodos, pendientesPorComercio] = await Promise.all([
    prisma.comercio.findMany({
      include: {
        usuario: { select: { email: true } },
        _count: { select: { beneficios: true } },
      },
      orderBy: { fecha_creacion: "desc" },
    }),
    prisma.beneficio.groupBy({ by: ["id_comercio"], where: { estado: "pendiente" }, _count: true }),
  ]);
  // Lo que espera revisión va primero: solicitudes de adhesión y comercios
  // con beneficios pendientes de aprobación.
  const pendientes = new Map(pendientesPorComercio.map((p) => [p.id_comercio, p._count]));
  const comercios = [...comerciosTodos].sort(
    (a, b) =>
      Number(b.estado === "pendiente") - Number(a.estado === "pendiente") ||
      (pendientes.get(b.id_comercio) ?? 0) - (pendientes.get(a.id_comercio) ?? 0)
  );
  const solicitudes = comercios.filter((c) => c.estado === "pendiente").length;
  const beneficiosPendientes = [...pendientes.values()].reduce((a, b) => a + b, 0);

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Comercios
        </h1>
        <Link
          href="/admin/comercios/nuevo"
          className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo
        </Link>
      </div>

      {(solicitudes > 0 || beneficiosPendientes > 0) && (
        <p className="bg-[#eda100]/10 border border-[#eda100]/40 rounded-xl p-3 text-sm text-on-surface">
          Para revisar: {solicitudes} solicitud{solicitudes === 1 ? "" : "es"} de adhesión y {beneficiosPendientes} beneficio
          {beneficiosPendientes === 1 ? "" : "s"} pendiente{beneficiosPendientes === 1 ? "" : "s"} de aprobación.
        </p>
      )}

      {comercios.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no hay comercios adheridos.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {comercios.map((comercio) => (
            <Link
              key={comercio.id_comercio}
              href={`/admin/comercios/${comercio.id_comercio}`}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {comercio.nombre}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {comercio.usuario.email} · {comercio._count.beneficios} beneficio(s)
                  {pendientes.get(comercio.id_comercio) ? ` · ${pendientes.get(comercio.id_comercio)} para aprobar` : ""}
                </p>
              </div>
              <span
                className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border ${ESTILO_ESTADO[comercio.estado]}`}
              >
                {comercio.estado}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
