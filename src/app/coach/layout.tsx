import { redirect } from "next/navigation";
import { obtenerUsuarioActual, tieneRol } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";
import { BottomNav } from "./_components/bottom-nav";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    redirect("/iniciar-sesion");
  }

  if (!tieneRol(usuario, "entrenador")) {
    redirect("/panel");
  }

  const nombre = usuario.nombre;
  const inicial = nombre.charAt(0).toUpperCase();

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col pt-16 pb-20 md:pb-0 font-[family-name:var(--font-inter)]">
      {/* TopAppBar (mobile) */}
      <header className="bg-surface border-b border-outline-variant fixed top-0 w-full z-50 flex justify-between items-center px-5 h-16 md:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#262626] bg-[#1A1A1A] flex items-center justify-center">
            <span className="font-[family-name:var(--font-sora)] text-[13px] font-bold text-primary-container">
              {inicial}
            </span>
          </div>
          <span className="font-[family-name:var(--font-sora)] text-primary-container tracking-tighter text-xl font-bold">
            BLACK HUB COACH
          </span>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="text-primary-container hover:opacity-80 transition-opacity active:scale-95 duration-150"
          >
            <span className="material-symbols-outlined text-2xl">logout</span>
          </button>
        </form>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-[280px] bg-surface-container/80 backdrop-blur-xl border-r border-outline-variant fixed h-full left-0 top-0 pt-8 z-40">
        <div className="px-6 pb-8">
          <span className="font-[family-name:var(--font-sora)] text-primary-container tracking-tighter text-2xl font-bold">
            BLACK HUB COACH
          </span>
        </div>
        <SidebarNav />
        <form action={cerrarSesion} className="mt-auto px-4 pb-8">
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase">
              Cerrar sesión
            </span>
          </button>
        </form>
      </aside>

      <div className="md:pl-[280px] flex-1 flex flex-col">{children}</div>

      {/* BottomNavBar (mobile) */}
      <BottomNav />
    </div>
  );
}
