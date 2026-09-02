import { redirect } from "next/navigation";
import { obtenerUsuarioActual, cuentaActiva } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";

export default async function CuentaInactivaPage() {
  const usuario = await obtenerUsuarioActual();

  // Si no hay sesión, o la cuenta ya volvió a estar activa, no hay nada
  // que mostrar acá.
  if (!usuario) redirect("/iniciar-sesion");
  if (cuentaActiva(usuario)) redirect("/panel");

  const suspendida = usuario.estado_usuario === "suspendido";

  return (
    <div className="min-h-screen flex flex-1 items-center justify-center bg-black px-5">
      <main className="w-full max-w-md text-center flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-[#ffb4ab] text-5xl">
          {suspendida ? "gpp_bad" : "person_off"}
        </span>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {suspendida ? "Cuenta suspendida" : "Cuenta inactiva"}
        </h1>
        <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant">
          {suspendida
            ? "Tu cuenta fue suspendida por el equipo de Black Hub. Escribinos para revisar la situación."
            : "Tu cuenta está inactiva. Contactá al equipo de Black Hub para reactivarla."}
        </p>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="flex items-center gap-2 py-3 px-8 rounded-lg border border-outline-variant text-[#ffb4ab] hover:bg-[#ffb4ab]/10 hover:border-[#ffb4ab]/50 transition-all font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar sesión
          </button>
        </form>
      </main>
    </div>
  );
}
