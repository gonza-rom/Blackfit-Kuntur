import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerComercioActual } from "@/lib/auth";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const ESTILO_ESTADO: Record<string, string> = {
  activo: "border-primary-container text-primary-container",
  inactivo: "border-outline-variant text-on-surface-variant",
  vencido: "border-[#ffb4ab] text-[#ffb4ab]",
};

export default async function ComercioBeneficiosPage() {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  const beneficios = await prisma.beneficio.findMany({
    where: { id_comercio: contexto.id_comercio },
    include: { beneficios_planes: { include: { plan_membresia: true } } },
    orderBy: { fecha_vencimiento: "desc" },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Tus beneficios
        </h1>
        <p className="text-sm text-on-surface-variant">
          Los beneficios los crea y edita el administrador de Kuntur.
        </p>
      </div>

      {beneficios.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no tenés beneficios cargados.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {beneficios.map((beneficio) => (
            <div
              key={beneficio.id_beneficio}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {beneficio.titulo}
                </p>
                <span
                  className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1 rounded-full border ${ESTILO_ESTADO[beneficio.estado]}`}
                >
                  {beneficio.estado}
                </span>
              </div>
              {beneficio.descripcion && (
                <p className="text-sm text-on-surface-variant">{beneficio.descripcion}</p>
              )}
              <p className="text-sm text-on-surface-variant">
                {beneficio.descuento && `${beneficio.descuento} · `}
                Vigente hasta {FORMATEADOR_FECHA.format(beneficio.fecha_vencimiento)}
              </p>
              {beneficio.beneficios_planes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {beneficio.beneficios_planes.map((bp) => (
                    <span
                      key={bp.id_plan_membresia}
                      className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase text-on-surface-variant border border-outline-variant rounded-full px-2 py-1"
                    >
                      {bp.plan_membresia.nombre}
                    </span>
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
