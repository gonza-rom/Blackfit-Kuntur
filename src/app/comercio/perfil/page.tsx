import { redirect } from "next/navigation";
import { obtenerComercioActual } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";
import { FormPerfilComercio } from "./_components/form-perfil-comercio";

export default async function ComercioPerfilPage() {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  const comercio = contexto.usuario.comercio!;

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Perfil del comercio
        </h1>
        <p className="text-sm text-on-surface-variant">
          Estos datos los ven los socios cuando miran tu comercio en Kuntur.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormPerfilComercio
          nombre={comercio.nombre}
          descripcion={comercio.descripcion}
          direccion={comercio.direccion}
          telefono={comercio.telefono}
          email={comercio.email}
          categoria={comercio.categoria}
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
