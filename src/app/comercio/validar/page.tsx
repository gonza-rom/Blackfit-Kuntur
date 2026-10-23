import { redirect } from "next/navigation";
import { obtenerComercioActual } from "@/lib/auth";
import { FormValidar } from "./_components/form-validar";

export default async function ComercioValidarPage() {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Validar credencial
        </h1>
        <p className="text-sm text-on-surface-variant">
          Escaneá el QR del socio o ingresá su código manualmente.
        </p>
      </div>

      {contexto.usuario.comercio?.estado === "activo" ? (
        <FormValidar />
      ) : (
        <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-4 text-sm text-on-surface-variant">
          Tu comercio todavía no está aprobado por la administración de Kuntur. Cuando lo aprueben vas a poder
          validar beneficios desde acá (te llega una notificación).
        </div>
      )}
    </main>
  );
}
