import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { FormInformacionPersonal } from "./_components/form-informacion-personal";

export default async function InformacionPersonalPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/iniciar-sesion");

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Información personal
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormInformacionPersonal
          nombre={usuario.nombre}
          apellido={usuario.apellido}
          telefono={usuario.telefono}
          email={usuario.email}
        />
      </div>
    </main>
  );
}
