"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-surface-container/80 backdrop-blur-xl fixed bottom-0 w-full z-50 rounded-t-xl border-t border-outline-variant flex justify-around items-center h-20 pb-[env(safe-area-inset-bottom)] px-5 md:hidden">
      {NAV_ITEMS.map((item) => {
        const activo = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center transition-transform duration-200 ${
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
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] mt-1">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}