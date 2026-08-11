import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "./_components/bottom-nav";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/iniciar-sesion");
  }

  const nombre =
    (user.user_metadata?.nombre as string | undefined) ??
    user.email?.split("@")[0] ??
    "Atleta";
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
            BLACK HUB
          </span>
        </div>
        <button className="text-primary-container hover:opacity-80 transition-opacity active:scale-95 duration-150">
          <span
            className="material-symbols-outlined text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            notifications
          </span>
        </button>
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

      <div className="md:pl-[280px] flex-1 flex flex-col">{children}</div>

      {/* BottomNavBar (mobile) */}
      <BottomNav />
    </div>
  );
}