import Link from "next/link";
import type { ClaveEntorno, EntornoDisponible } from "@/lib/auth";

// Cambio de espacio para quien está habilitado en más de un entorno (ej.
// alumno de Blackfit que además es socio de Kuntur). La lista sale de sus
// roles en el servidor (entornosDisponibles); cada layout vuelve a validar
// el acceso, así que no se puede "cambiar de organización" desde el cliente.
export function SelectorEntorno({
  entornos,
  actual,
  compacto = false,
}: {
  entornos: EntornoDisponible[];
  actual: ClaveEntorno;
  compacto?: boolean;
}) {
  if (entornos.length < 2) return null;
  const vigente = entornos.find((e) => e.clave === actual);

  return (
    <details className={`relative ${compacto ? "" : "px-4 pb-4"}`}>
      <summary
        className={`list-none cursor-pointer select-none flex items-center gap-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface ${
          compacto ? "p-1.5" : "px-3 py-2 text-xs"
        }`}
        aria-label="Cambiar de espacio"
      >
        <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
        {!compacto && <span className="truncate">{vigente?.etiqueta ?? "Cambiar de espacio"}</span>}
      </summary>
      <div
        className={`absolute z-[60] mt-2 min-w-[220px] bg-[#1A1A1A] border border-[#262626] rounded-xl p-1 shadow-2xl flex flex-col ${
          compacto ? "right-0" : "left-4"
        }`}
      >
        {entornos.map((e) => (
          <Link
            key={e.clave}
            href={e.href}
            className={`px-3 py-2 rounded-lg text-sm ${
              e.clave === actual ? "text-primary-container bg-primary-container/10" : "text-on-surface hover:bg-white/5"
            }`}
          >
            {e.etiqueta}
          </Link>
        ))}
      </div>
    </details>
  );
}
