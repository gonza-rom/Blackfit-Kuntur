import { redirect } from "next/navigation";
import { obtenerBeneficiarioActual } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";
import { FormInformacionPersonal } from "@/app/panel/perfil/informacion-personal/_components/form-informacion-personal";

export default async function BeneficiarioPerfilPage() {
  const contexto = await obtenerBeneficiarioActual();
  if (!contexto) redirect("/panel");

  const { usuario } = contexto;
  const inicial = usuario.nombre.charAt(0).toUpperCase();

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <section className="flex flex-col items-center text-center gap-3">
        <div className="w-24 h-24 rounded-full border border-[#262626] bg-[#1A1A1A] flex items-center justify-center">
          <span className="font-[family-name:var(--font-sora)] text-[40px] font-bold text-primary-container">
            {inicial}
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {usuario.nombre} {usuario.apellido}
        </h1>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container uppercase">
          Socio Kuntur
        </span>
      </section>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormInformacionPersonal
          nombre={usuario.nombre}
          apellido={usuario.apellido}
          telefono={usuario.telefono}
          email={usuario.email}
        />
      </div>

      <div className="flex justify-center pt-4 border-t border-outline-variant/30">
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="flex items-center gap-2 py-3 px-8 rounded-lg border border-outline-variant text-[#ffb4ab] hover:bg-[#ffb4ab]/10 hover:border-[#ffb4ab]/50 transition-all font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar Sesión
          </button>
        </form>
      </div>
    </main>
  );
}
