import { redirect } from "next/navigation";
import { obtenerComercioActual } from "@/lib/auth";
import { FormValidar } from "./_components/form-validar";

export default async function ComercioValidarPage() {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Validar credencial
        </h1>
        <p className="text-sm text-on-surface-variant">
          Escaneá el QR del socio o ingresá su código manualmente.
        </p>
      </div>

      <FormValidar />
    </main>
  );
}
