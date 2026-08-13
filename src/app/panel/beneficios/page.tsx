import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { MerchantList } from "./_components/merchant-list";
import { CredencialCard } from "./_components/credencial-card";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

type Comercio = {
  id_comercio: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  logo: string | null;
};

type Beneficio = {
  id_beneficio: string;
  titulo: string;
  descripcion: string | null;
  descuento: string | null;
  fecha_vencimiento: Date;
  estado: string;
  comercio: Comercio;
};

export default async function BeneficiosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const usuario = user
    ? await prisma.usuario.findUnique({
        where: { id_usuario: user.id },
        include: {
          credencial: true,
          // "Activa" no alcanza: también tiene que estar vigente en el
          // tiempo (fecha_vencimiento_membresia >= hoy). Ver punto 5 y 7
          // del brief — nunca confiar solo en el estado guardado.
          membresias: {
            where: { estado_membresia: "activa", fecha_vencimiento_membresia: { gte: new Date() } },
            orderBy: { fecha_vencimiento_membresia: "desc" },
            take: 1,
            include: {
              plan_membresia: {
                include: {
                  beneficios_planes: {
                    include: {
                      beneficio: { include: { comercio: true } },
                    },
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

  const beneficios: Beneficio[] = (
    membresiaActiva?.plan_membresia.beneficios_planes ?? []
  )
    .map((bp: { beneficio: Beneficio }) => bp.beneficio)
    .filter(
      (b: Beneficio) => b.estado === "activo" && b.fecha_vencimiento >= hoy
    );

  // Un comercio representativo por beneficio (para la fila de ofertas activas)
  const ofertasActivas = beneficios;

  // Comercios únicos, cada uno con su beneficio principal (para el listado filtrable)
  const comerciosMap = new Map<string, { comercio: Comercio; beneficio: Beneficio }>();
  for (const beneficio of beneficios) {
    if (!comerciosMap.has(beneficio.comercio.id_comercio)) {
      comerciosMap.set(beneficio.comercio.id_comercio, {
        comercio: beneficio.comercio,
        beneficio,
      });
    }
  }
  const comercios = Array.from(comerciosMap.values());

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      {/* Credencial Digital */}
      <section id="credencial" className="flex flex-col gap-2 scroll-mt-20">
        <h2 className="font-[family-name:var(--font-sora)] text-[24px] leading-8 font-semibold text-on-surface">
          Credencial Digital
        </h2>

        {usuario?.credencial ? (
          <CredencialCard
            nombreCompleto={nombreCompleto}
            numeroSocio={usuario.credencial.numero_socio}
            membresiaActiva={Boolean(membresiaActiva)}
            codigoQrToken={usuario.credencial.codigo_qr_token}
          />
        ) : (
          <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-6 text-center">
            <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
              Todavía no tenés una credencial Kuntur activa. Se genera
              automáticamente cuando te sumás al programa de beneficios.
            </p>
          </div>
        )}
      </section>

      {/* Ofertas activas */}
      <section className="flex flex-col gap-2">
        <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Ofertas Activas
        </h3>
        {ofertasActivas.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-6 text-center">
            <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
              No tenés ofertas activas por ahora.
            </p>
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
            {ofertasActivas.map((beneficio) => (
              <div
                key={beneficio.id_beneficio}
                className="snap-start shrink-0 w-64 bg-[#1a1a1a] border border-outline-variant rounded-lg p-4 flex flex-col gap-2 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary-container/10 rounded-bl-full" />
                <span className="material-symbols-outlined text-primary-container text-[28px]">
                  loyalty
                </span>
                <h4 className="font-[family-name:var(--font-sora)] text-[18px] font-semibold text-on-surface">
                  {beneficio.titulo}
                </h4>
                <p className="font-[family-name:var(--font-inter)] text-sm text-[#c8c6c5]">
                  {beneficio.descripcion ?? beneficio.comercio.nombre}
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                  Vence {FORMATEADOR_FECHA.format(beneficio.fecha_vencimiento)}
                </p>
                <a
                  href={`/panel/beneficios/${beneficio.comercio.id_comercio}`}
                  className="mt-auto text-left font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container border-b border-primary-container/30 w-fit pb-1 group-hover:border-primary-container transition-colors uppercase"
                >
                  Usar ahora
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Comercios adheridos */}
      <section className="flex flex-col gap-2">
        <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Comercios Adheridos
        </h3>
        <MerchantList comercios={comercios} />
      </section>
    </main>
  );
}