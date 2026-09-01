import { redirect } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { FormNuevaPlantilla } from "./_components/form-nueva-plantilla";

export default async function NuevaPlantillaPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Nueva plantilla
        </h1>
        <p className="text-sm text-on-surface-variant">
          Armala una vez, con bloques y ejercicios, y aplicala a cada alumno que la necesite.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormNuevaPlantilla />
      </div>
    </main>
  );
}
