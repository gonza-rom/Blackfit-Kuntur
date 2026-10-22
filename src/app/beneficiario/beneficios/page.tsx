import { redirect } from "next/navigation";
import { obtenerBeneficiarioActual } from "@/lib/auth";
import { CatalogoBeneficios } from "@/components/catalogo-beneficios";

// Beneficios del socio de Kuntur: el MISMO catálogo único que ve Blackfit
// (acá, los beneficios para "Kuntur" o "ambos"). Ver lib/beneficios.ts.
export default async function BeneficiosSocioKunturPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const contexto = await obtenerBeneficiarioActual();
  if (!contexto) redirect("/sin-acceso?ruta=kuntur");
  const sp = await props.searchParams;

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">Beneficios</h1>
      <CatalogoBeneficios
        entorno="kuntur"
        usuario={contexto.usuario}
        rutaBase="/beneficiario/beneficios"
        texto={typeof sp.q === "string" ? sp.q : undefined}
        categoria={typeof sp.categoria === "string" ? sp.categoria : undefined}
      />
    </main>
  );
}
