import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { CatalogoBeneficios } from "@/components/catalogo-beneficios";

// Beneficios de un comercio puntual, dentro del catálogo de Blackfit.
export default async function BeneficiosComercioPage(props: PageProps<"/panel/beneficios/[id_comercio]">) {
  // El catálogo de beneficios es independiente de la membresía de
  // ENTRENAMIENTO: no se bloquea acá. Quién puede USAR cada beneficio lo
  // decide evaluarUso() (lib/beneficios.ts) según la audiencia y la
  // membresía vigente de cada organización.

  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/iniciar-sesion");
  const { id_comercio } = await props.params;
  const comercio = await prisma.comercio.findFirst({
    where: { id_comercio, estado: "activo" },
    select: { nombre: true, descripcion: true },
  });
  if (!comercio) notFound();

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">{comercio.nombre}</h1>
        {comercio.descripcion && <p className="text-sm text-on-surface-variant">{comercio.descripcion}</p>}
      </div>
      <CatalogoBeneficios entorno="blackfit" usuario={usuario} rutaBase="/panel/beneficios" idComercio={id_comercio} />
    </main>
  );
}
