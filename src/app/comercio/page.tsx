import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerComercioActual } from "@/lib/auth";

function inicioDelDia(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function ComercioPage() {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  const hoy = inicioDelDia();

  const [validacionesHoy, validacionesTotales, beneficiosActivos, sociosDistintos] =
    await Promise.all([
      prisma.validacionBeneficio.count({
        where: { id_comercio: contexto.id_comercio, fecha_validacion: { gte: hoy } },
      }),
      prisma.validacionBeneficio.count({
        where: { id_comercio: contexto.id_comercio },
      }),
      prisma.beneficio.count({
        where: { id_comercio: contexto.id_comercio, estado: "activo" },
      }),
      prisma.validacionBeneficio.findMany({
        where: { id_comercio: contexto.id_comercio },
        distinct: ["id_usuario"],
        select: { id_usuario: true },
      }),
    ]);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {contexto.usuario.comercio?.nombre}
        </h1>
        <p className="text-sm text-on-surface-variant">Panel de comercio adherido</p>
      </div>

      <Link
        href="/comercio/validar"
        className="flex items-center justify-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-base font-bold h-14 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
      >
        <span className="material-symbols-outlined">qr_code_scanner</span>
        Validar credencial
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Validaciones hoy
          </span>
          <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {validacionesHoy}
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Validaciones totales
          </span>
          <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {validacionesTotales}
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Beneficios activos
          </span>
          <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {beneficiosActivos}
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Socios atendidos
          </span>
          <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
            {sociosDistintos.length}
          </div>
        </div>
      </section>
    </main>
  );
}
