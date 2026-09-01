"use client";

import { usePathname } from "next/navigation";
import { LogoMarca } from "./logo-marca";

/**
 * En /panel conviven las dos marcas (Black Fit para entrenamiento, Kuntur
 * para beneficios), a diferencia de /coach, /comercio y /beneficiario que
 * son cada uno una sola marca fija. Acá el logo cambia según la sección
 * que el alumno está mirando.
 */
export function LogoMarcaPanel({ size, className }: { size?: number; className?: string }) {
  const pathname = usePathname();
  const marca = pathname.startsWith("/panel/beneficios") ? "kuntur" : "blackfit";
  return <LogoMarca marca={marca} size={size} className={className} />;
}
