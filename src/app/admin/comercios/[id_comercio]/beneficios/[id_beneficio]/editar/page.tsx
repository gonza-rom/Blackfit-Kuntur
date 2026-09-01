import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FormEditarBeneficio } from "./_components/form-editar-beneficio";

export default async function EditarBeneficioPage(
  props: PageProps<"/admin/comercios/[id_comercio]/beneficios/[id_beneficio]/editar">
) {
  const { id_comercio, id_beneficio } = await props.params;

  const beneficio = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficio || beneficio.id_comercio !== id_comercio) notFound();

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Editar beneficio
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarBeneficio beneficio={beneficio} />
      </div>
    </main>
  );
}
