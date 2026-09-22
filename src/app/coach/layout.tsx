import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerUsuarioActual, tieneRol, cuentaActiva } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cerrarSesion } from "@/app/actions/auth";
import { ActivarPush } from "@/components/activar-push";
import { InstalarApp } from "@/components/instalar-app";
import { LogoMarca } from "@/components/logo-marca";
import { BotonVolver } from "@/components/boton-volver";
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

  if (!cuentaActiva(usuario)) {
    redirect("/cuenta-inactiva");
  }

  if (!tieneRol(usuario, "entrenador")) {
    redirect("/panel");
  }

  const noLeidas = await prisma.notificacion.count({
    where: { id_usuario: usuario.id_usuario, leido: false },
  });

  return (
    <div className="bg-background text-on-surface antialiased min-h-dvh flex flex-col pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0 font-[family-name:var(--font-inter)]">
      {/* TopAppBar (mobile) */}
      <header className="bg-surface border-b border-outline-variant fixed top-0 w-full z-50 flex justify-between items-center pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] box-border md:hidden">
        <div className="flex items-center gap-2">
          <BotonVolver />
          <LogoMarca marca="blackfit" size={32} className="border border-[#262626]" />
          <span className="font-[family-name:var(--font-sora)] text-primary-container tracking-tighter text-xl font-bold">
            BLACK HUB COACH
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/coach/notificaciones"
            className="relative text-primary-container hover:opacity-80 transition-opacity active:scale-95 duration-150"
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              notifications
            </span>
            {noLeidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#ffb4ab] text-[#3a0a09] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </Link>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="text-primary-container hover:opacity-80 transition-opacity active:scale-95 duration-150"
            >
              <span className="material-symbols-outlined text-2xl">logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col md:w-[240px] lg:w-[280px] bg-surface-container/80 backdrop-blur-xl border-r border-outline-variant fixed h-full left-0 top-0 pt-8 z-40 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="px-6 pb-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LogoMarca marca="blackfit" size={32} className="border border-[#262626]" />
            <span className="font-[family-name:var(--font-sora)] text-primary-container tracking-tighter text-2xl font-bold">
              BLACK HUB COACH
            </span>
          </div>
          <Link
            href="/coach/notificaciones"
            className="relative text-on-surface-variant hover:text-primary-container transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-2xl">notifications</span>
            {noLeidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#ffb4ab] text-[#3a0a09] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </Link>
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

      <div className="md:pl-[240px] lg:pl-[280px] flex-1 flex flex-col">
        <div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 pt-4 flex flex-col gap-3">
          <InstalarApp />
          <ActivarPush />
        </div>
        {children}
      </div>

      {/* BottomNavBar (mobile) */}
      <BottomNav />
    </div>
  );
}
