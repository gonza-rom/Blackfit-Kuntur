import { redirect } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { FormInformacionPersonal } from "@/app/panel/perfil/informacion-personal/_components/form-informacion-personal";
import { FormPerfilEntrenador } from "./_components/form-perfil-entrenador";

export default async function CoachPerfilPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { usuario } = contexto;

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Tu perfil
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          El teléfono que cargues acá es el que ven tus alumnos para escribirte por
          WhatsApp.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormInformacionPersonal
          nombre={usuario.nombre}
          apellido={usuario.apellido}
          telefono={usuario.telefono}
          email={usuario.email}
        />
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-2">
          Como entrenador
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
          <FormPerfilEntrenador
            especialidad={usuario.entrenador?.especialidad ?? null}
            biografia={usuario.entrenador?.biografia ?? null}
          />
        </div>
      </div>
    </main>
  );
}
