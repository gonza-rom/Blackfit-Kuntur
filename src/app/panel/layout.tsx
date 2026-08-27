import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerUsuarioActual, tieneRol } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfflineSyncBanner } from "@/components/offline-sync-banner";
import { ActivarPush } from "@/components/activar-push";
import { verificarRecordatorioMembresia } from "@/lib/membresia";
import { BottomNav } from "./_components/bottom-nav";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    redirect("/iniciar-sesion");
  }

  if (!tieneRol(usuario, "alumno") && tieneRol(usuario, "entrenador")) {
    redirect("/coach");
  }

  if (
    !tieneRol(usuario, "alumno") &&
    !tieneRol(usuario, "entrenador") &&
    tieneRol(usuario, "administrador")
  ) {
    redirect("/admin");
  }

  if (
    !tieneRol(usuario, "alumno") &&
    !tieneRol(usuario, "entrenador") &&
    !tieneRol(usuario, "administrador") &&
    tieneRol(usuario, "comercio") &&
    usuario.comercio
  ) {
    redirect("/comercio");
  }

  const nombre = usuario.nombre;
  const inicial = nombre.charAt(0).toUpperCase();
  const noLeidas = await prisma.notificacion.count({
    where: { id_usuario: usuario.id_usuario, leido: false },
  });

  // No bloquea el render: si falla (ej. sin fila de membresía todavía)
  // no debe tumbar la navegación del alumno.
  verificarRecordatorioMembresia(usuario.id_usuario).catch(() => {});

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
            BLACK HUB
          </span>
        </div>
        <Link
          href="/panel/notificaciones"
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
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-[280px] bg-surface-container/80 backdrop-blur-xl border-r border-outline-variant fixed h-full left-0 top-0 pt-8 z-40">
        <div className="px-6 pb-8">
          <span className="font-[family-name:var(--font-sora)] text-primary-container tracking-tighter text-3xl font-bold">
            BLACK HUB
          </span>
        </div>
        <SidebarNav />
      </aside>

      <div className="md:pl-[280px] flex-1 flex flex-col">
        <OfflineSyncBanner />
        <div className="w-full max-w-md md:max-w-3xl mx-auto px-5 md:px-10 pt-4">
          <ActivarPush />
        </div>
        {children}
      </div>

      {/* BottomNavBar (mobile) */}
      <BottomNav />
    </div>
  );
}