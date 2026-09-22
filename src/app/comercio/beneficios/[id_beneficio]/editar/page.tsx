import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerComercioActual } from "@/lib/auth";
import { obtenerPlanesMembresia } from "@/lib/catalogos";
import { cambiarEstadoBeneficioComercio } from "@/app/actions/comercio";
import { FormEditarBeneficioComercio } from "./_components/form-editar-beneficio-comercio";
import { BotonEliminarBeneficioComercio } from "./_components/boton-eliminar-beneficio-comercio";
import { PlanesBeneficioComercio } from "./_components/planes-beneficio-comercio";

const ESTADOS = ["activo", "inactivo", "vencido"] as const;

export default async function EditarBeneficioComercioPage(
  props: PageProps<"/comercio/beneficios/[id_beneficio]/editar">
) {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  const { id_beneficio } = await props.params;

  const [beneficio, planes] = await Promise.all([
    prisma.beneficio.findUnique({
      where: { id_beneficio },
      include: { beneficios_planes: true },
    }),
    obtenerPlanesMembresia(),
  ]);

  if (!beneficio || beneficio.id_comercio !== contexto.id_comercio) notFound();

  const planesAsignados = new Set(beneficio.beneficios_planes.map((bp) => bp.id_plan_membresia));

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Editar beneficio
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarBeneficioComercio beneficio={beneficio} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Estado
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <form action={cambiarEstadoBeneficioComercio} className="flex items-center gap-2">
            <input type="hidden" name="id_beneficio" value={id_beneficio} />
            <select
              name="estado"
              defaultValue={beneficio.estado}
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
            >
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-outline-variant text-on-surface-variant"
            >
              Aplicar
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Planes que lo ven
        </h2>
        {planes.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no hay planes de membresía cargados.
          </div>
        ) : (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
            <PlanesBeneficioComercio
              idBeneficio={id_beneficio}
              planes={planes}
              planesAsignados={planesAsignados}
            />
          </div>
        )}
      </section>

      <BotonEliminarBeneficioComercio idBeneficio={id_beneficio} tituloBeneficio={beneficio.titulo} />
    </main>
  );
}
