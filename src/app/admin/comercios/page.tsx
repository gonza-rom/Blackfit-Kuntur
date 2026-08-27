import Link from "next/link";
import { prisma } from "@/lib/prisma";

const ESTILO_ESTADO: Record<string, string> = {
  activo: "border-primary-container text-primary-container",
  inactivo: "border-outline-variant text-on-surface-variant",
};

export default async function AdminComerciosPage() {
  const comercios = await prisma.comercio.findMany({
    include: { usuario: true, _count: { select: { beneficios: true } } },
    orderBy: { fecha_creacion: "desc" },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
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
