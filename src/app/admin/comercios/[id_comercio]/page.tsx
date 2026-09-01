import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerPlanesMembresia } from "@/lib/catalogos";
import { cambiarEstadoComercio, cambiarEstadoBeneficio } from "@/app/actions/admin";
import { PlanesBeneficio } from "./_components/planes-beneficio";

const ESTADOS_COMERCIO = ["activo", "inactivo"] as const;
const ESTADOS_BENEFICIO = ["activo", "inactivo", "vencido"] as const;

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function AdminComercioDetallePage(
  props: PageProps<"/admin/comercios/[id_comercio]">
) {
  const { id_comercio } = await props.params;

  const [comercio, planes] = await Promise.all([
    prisma.comercio.findUnique({
      where: { id_comercio },
      include: {
        usuario: true,
        beneficios: {
          orderBy: { fecha_vencimiento: "desc" },
          include: { beneficios_planes: true },
        },
      },
    }),
    obtenerPlanesMembresia(),
  ]);

  if (!comercio) notFound();

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
              {comercio.nombre}
            </h1>
            <Link
              href={`/admin/comercios/${id_comercio}/editar`}
              className="text-on-surface-variant hover:text-primary-container"
              aria-label="Editar comercio"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </Link>
          </div>
          <p className="text-sm text-on-surface-variant">{comercio.usuario.email}</p>
          {comercio.categoria && (
            <p className="text-sm text-on-surface-variant">{comercio.categoria}</p>
          )}
        </div>
        <form action={cambiarEstadoComercio} className="flex items-center gap-2 shrink-0">
          <input type="hidden" name="id_comercio" value={id_comercio} />
          <select
            name="estado"
            defaultValue={comercio.estado}
            className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          >
            {ESTADOS_COMERCIO.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2.5 rounded border border-outline-variant text-on-surface-variant"
          >
            Actualizar
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Beneficios
          </h2>
          <Link
            href={`/admin/comercios/${id_comercio}/beneficios/nuevo`}
            className="flex items-center gap-1 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Nuevo
          </Link>
        </div>

        {comercio.beneficios.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Este comercio todavía no tiene beneficios cargados.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {comercio.beneficios.map((beneficio) => {
              const planesAsignados = new Set<string>(
                beneficio.beneficios_planes.map(
                  (bp: { id_plan_membresia: string }) => bp.id_plan_membresia
                )
              );
              return (
                <div
                  key={beneficio.id_beneficio}
                  className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                          {beneficio.titulo}
                        </p>
                        <Link
                          href={`/admin/comercios/${id_comercio}/beneficios/${beneficio.id_beneficio}/editar`}
                          className="text-on-surface-variant hover:text-primary-container"
                          aria-label="Editar beneficio"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </Link>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Vigente hasta {FORMATEADOR_FECHA.format(beneficio.fecha_vencimiento)}
                      </p>
                    </div>
                    <form
                      action={cambiarEstadoBeneficio}
                      className="flex items-center gap-2 shrink-0"
                    >
                      <input type="hidden" name="id_beneficio" value={beneficio.id_beneficio} />
                      <select
                        name="estado"
                        defaultValue={beneficio.estado}
                        className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
                      >
                        {ESTADOS_BENEFICIO.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase px-2 py-2 rounded border border-outline-variant text-on-surface-variant"
                      >
                        OK
                      </button>
                    </form>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                      Planes con acceso
                    </span>
                    <PlanesBeneficio
                      idBeneficio={beneficio.id_beneficio}
                      idComercio={id_comercio}
                      planes={planes}
                      planesAsignados={planesAsignados}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
