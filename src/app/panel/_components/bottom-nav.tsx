"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-surface-container/80 backdrop-blur-xl fixed bottom-0 w-full z-50 rounded-t-xl border-t border-outline-variant flex items-center h-20 pb-[env(safe-area-inset-bottom)] px-2 md:hidden">
      {NAV_ITEMS.map((item) => {
        const activo =
          item.href === "/panel"
            ? pathname === "/panel"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 transition-transform duration-200 ${
              activo
                ? "text-primary-container scale-110"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={activo ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="w-full truncate text-center font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.02em]">
              {item.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}