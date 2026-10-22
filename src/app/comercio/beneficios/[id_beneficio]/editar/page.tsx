import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerComercioActual } from "@/lib/auth";
import { cambiarEstadoBeneficioComercio } from "@/app/actions/comercio";
import { FormEditarBeneficioComercio } from "./_components/form-editar-beneficio-comercio";
import { BotonEliminarBeneficioComercio } from "./_components/boton-eliminar-beneficio-comercio";
import { ETIQUETA_AUDIENCIA } from "@/lib/beneficios";

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: "Publicado",
  inactivo: "Pausado",
  vencido: "Vencido",
  pendiente: "Pendiente de aprobación",
  rechazado: "Rechazado",
};

export default async function EditarBeneficioComercioPage(
  props: PageProps<"/comercio/beneficios/[id_beneficio]/editar">
) {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  const { id_beneficio } = await props.params;

  const beneficio = await prisma.beneficio.findUnique({ where: { id_beneficio } });

  if (!beneficio || beneficio.id_comercio !== contexto.id_comercio) notFound();

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
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm text-on-surface">
            {ETIQUETA_ESTADO[beneficio.estado] ?? beneficio.estado}
            {" · "}
            <span className="text-on-surface-variant">{ETIQUETA_AUDIENCIA[beneficio.audiencia]}</span>
          </p>
          {beneficio.estado === "pendiente" && (
            <p className="text-xs text-[#eda100]">
              La administración lo está revisando. Cuando lo apruebe se publica en el catálogo.
            </p>
          )}
          {beneficio.estado === "rechazado" && (
            <p className="text-xs text-[#ffb4ab]">
              No fue aprobado{beneficio.motivo_rechazo ? `: ${beneficio.motivo_rechazo}` : "."} Corregilo y
              guardá para enviarlo de nuevo a revisión.
            </p>
          )}
          {(beneficio.estado === "activo" || beneficio.estado === "inactivo") && (
            <form action={cambiarEstadoBeneficioComercio}>
              <input type="hidden" name="id_beneficio" value={id_beneficio} />
              <input type="hidden" name="estado" value={beneficio.estado === "activo" ? "inactivo" : "activo"} />
              <button
                type="submit"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-outline-variant text-on-surface-variant"
              >
                {beneficio.estado === "activo" ? "Pausar publicación" : "Volver a publicar"}
              </button>
            </form>
          )}
        </div>
      </section>

      <BotonEliminarBeneficioComercio idBeneficio={id_beneficio} tituloBeneficio={beneficio.titulo} />
    </main>
  );
}
