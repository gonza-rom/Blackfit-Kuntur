import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { CredencialCard } from "../_components/credencial-card";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function ComercioBeneficioPage(
  props: PageProps<"/panel/beneficios/[id_comercio]">
) {
  const { id_comercio } = await props.params;

  const comercio = await prisma.comercio.findUnique({ where: { id_comercio } });
  if (!comercio || comercio.estado !== "activo") {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const usuario = user
    ? await prisma.usuario.findUnique({
        where: { id_usuario: user.id },
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
                    where: { beneficio: { id_comercio } },
                    include: { beneficio: true },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const nombreCompleto = usuario
    ? `${usuario.nombre} ${usuario.apellido}`.toUpperCase()
    : "";
  const membresiaActiva = usuario?.membresias[0];
  const hoy = new Date();

  const beneficiosDisponibles = (
    membresiaActiva?.plan_membresia.beneficios_planes ?? []
  )
    .map((bp) => bp.beneficio)
    .filter((b) => b.estado === "activo" && b.fecha_vencimiento >= hoy);

  const mapsHref = comercio.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${comercio.nombre} ${comercio.direccion}`
      )}`
    : null;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <div>
        <Link
          href="/panel/beneficios"
          className="text-sm text-on-surface-variant inline-flex items-center gap-1 mb-2"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Beneficios
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {comercio.nombre}
        </h1>
        {comercio.categoria && (
          <p className="text-sm text-primary-container uppercase tracking-wide">
            {comercio.categoria}
          </p>
        )}
        {comercio.descripcion && (
          <p className="text-sm text-on-surface-variant mt-2">{comercio.descripcion}</p>
        )}
      </div>

      <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
        {comercio.direccion && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                location_on
              </span>
              {comercio.direccion}
            </div>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-container underline whitespace-nowrap"
              >
                Cómo llegar
              </a>
            )}
          </div>
        )}
        {comercio.telefono && (
          <a
            href={`tel:${comercio.telefono}`}
            className="flex items-center gap-2 text-sm text-on-surface"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              call
            </span>
            {comercio.telefono}
          </a>
        )}
        {!comercio.direccion && !comercio.telefono && (
          <p className="text-sm text-on-surface-variant">
            Este comercio todavía no cargó dirección ni teléfono.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Beneficios disponibles
        </h2>
        {!membresiaActiva ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Necesitás una membresía Kuntur activa para canjear beneficios.
          </div>
        ) : beneficiosDisponibles.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Este comercio no tiene beneficios vigentes para tu plan en este momento.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {beneficiosDisponibles.map((b) => (
              <div
                key={b.id_beneficio}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                    {b.titulo}
                  </p>
                  {b.descuento && (
                    <span className="font-[family-name:var(--font-sora)] text-primary-container font-bold whitespace-nowrap">
                      {b.descuento}
                    </span>
                  )}
                </div>
                {b.descripcion && (
                  <p className="text-sm text-on-surface-variant mt-1">{b.descripcion}</p>
                )}
                {b.condiciones && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Condiciones: {b.condiciones}
                  </p>
                )}
                <p className="text-xs text-on-surface-variant mt-1">
                  Vigente hasta {FORMATEADOR_FECHA.format(b.fecha_vencimiento)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {usuario?.credencial && membresiaActiva && (
        <section className="flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Mostrá esto en el comercio
          </h2>
          <CredencialCard
            nombreCompleto={nombreCompleto}
            numeroSocio={usuario.credencial.numero_socio}
            membresiaActiva
            codigoQrToken={usuario.credencial.codigo_qr_token}
          />
        </section>
      )}
    </main>
  );
}
