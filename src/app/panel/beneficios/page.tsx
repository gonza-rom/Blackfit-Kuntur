import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { CatalogoBeneficios } from "@/components/catalogo-beneficios";

// Beneficios en Blackfit: el MISMO catálogo que ven los socios de Kuntur
// (los beneficios para "Blackfit" o "ambos"), ver lib/beneficios.ts.
export default async function BeneficiosPage(props: PageProps<"/panel/beneficios">) {
  // El catálogo de beneficios es independiente de la membresía de
  // ENTRENAMIENTO: no se bloquea acá. Quién puede USAR cada beneficio lo
  // decide evaluarUso() (lib/beneficios.ts) según la audiencia y la
  // membresía vigente de cada organización.

  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/iniciar-sesion");
  const sp = await props.searchParams;

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">Beneficios</h1>
      <CatalogoBeneficios
        entorno="blackfit"
        usuario={usuario}
        rutaBase="/panel/beneficios"
        texto={typeof sp.q === "string" ? sp.q : undefined}
        categoria={typeof sp.categoria === "string" ? sp.categoria : undefined}
      />
    </main>
  );
}
