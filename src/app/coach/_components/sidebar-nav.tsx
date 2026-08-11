"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS_COACH } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 px-4">
      {NAV_ITEMS_COACH.map((item) => {
        const activo = pathname === item.href;

        if (activo) {
          return (
            <div key={item.href} className="relative">
              <div className="absolute left-0 top-0 h-full w-[4px] bg-primary-container rounded-r-full" />
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 bg-surface-variant/30 text-primary-container transition-colors pl-6 rounded-lg"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {item.icon}
                </span>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase">
                  {item.label}
                </span>
              </Link>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
