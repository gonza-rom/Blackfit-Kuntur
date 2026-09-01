import { redirect } from "next/navigation";
import { obtenerBeneficiarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CredencialCard } from "@/app/panel/beneficios/_components/credencial-card";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

export default async function BeneficiarioBeneficiosPage() {
  const contexto = await obtenerBeneficiarioActual();
  if (!contexto) redirect("/panel");

  const { usuario } = contexto;

  // Solo lo que le corresponde: su credencial y los beneficios del plan de
  // su membresía ACTIVA Y VIGENTE (estado activa AND vencimiento >= hoy).
  const datos = await prisma.usuario.findUnique({
    where: { id_usuario: usuario.id_usuario },
    include: {
      credencial: true,
      membresias: {
        where: {
          estado_membresia: "activa",
          fecha_vencimiento_membresia: { gte: new Date() },
        },
        orderBy: { fecha_vencimiento_membresia: "desc" },
        take: 1,
        include: {
          plan_membresia: {
            include: {
              beneficios_planes: {
                include: { beneficio: { include: { comercio: true } } },
              },
            },
          },
        },
      },
    },
  });

  const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`.toUpperCase();
  const membresiaActiva = datos?.membresias[0];
  const hoy = new Date();

  const beneficios = (membresiaActiva?.plan_membresia.beneficios_planes ?? [])
    .map((bp) => bp.beneficio)
    .filter((b) => b.estado === "activo" && b.fecha_vencimiento >= hoy);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-2 scroll-mt-20">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Tus beneficios Kuntur
        </h1>

        {datos?.credencial ? (
          <CredencialCard
            nombreCompleto={nombreCompleto}
            numeroSocio={datos.credencial.numero_socio}
            membresiaActiva={Boolean(membresiaActiva)}
            codigoQrToken={datos.credencial.codigo_qr_token}
          />
        ) : (
          <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-6 text-center">
            <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
              Todavía no tenés una credencial Kuntur activa. Se genera
              automáticamente cuando se activa tu membresía.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Ofertas Activas
        </h2>
        {beneficios.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-6 text-center">
            <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
              No tenés ofertas activas por ahora.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {beneficios.map((beneficio) => (
              <div
                key={beneficio.id_beneficio}
                className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-4 flex flex-col gap-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-sora)] text-[18px] font-semibold text-on-surface">
                    {beneficio.titulo}
                  </h3>
                  {beneficio.descuento && (
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container uppercase shrink-0">
                      {beneficio.descuento}
                    </span>
                  )}
                </div>
                <p className="font-[family-name:var(--font-inter)] text-sm text-[#c8c6c5]">
                  {beneficio.comercio.nombre}
                  {beneficio.descripcion ? ` · ${beneficio.descripcion}` : ""}
                </p>
                {beneficio.condiciones && (
                  <p className="font-[family-name:var(--font-inter)] text-xs text-on-surface-variant">
                    {beneficio.condiciones}
                  </p>
                )}
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase mt-1">
                  Vence {FORMATEADOR_FECHA.format(beneficio.fecha_vencimiento)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
