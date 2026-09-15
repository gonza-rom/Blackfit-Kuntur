import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FormEditarComercio } from "../_components/form-editar-comercio";
import { BotonEliminarComercio } from "../_components/boton-eliminar-comercio";

export default async function EditarComercioPage(
  props: PageProps<"/admin/comercios/[id_comercio]/editar">
) {
  const { id_comercio } = await props.params;

  const comercio = await prisma.comercio.findUnique({ where: { id_comercio } });
  if (!comercio) notFound();

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Editar comercio
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarComercio comercio={comercio} />
      </div>

      <BotonEliminarComercio idComercio={id_comercio} nombreComercio={comercio.nombre} />
    </main>
  );
}
