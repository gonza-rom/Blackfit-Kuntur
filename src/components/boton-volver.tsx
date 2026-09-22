"use client";

import { useRouter } from "next/navigation";

// router.back() en vez de un href fijo: vuelve a la pantalla real de
// donde vino el usuario (funciona igual sin importar desde qué lista se
// haya llegado a un detalle), a diferencia de un Link a una ruta fija.
export function BotonVolver() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver"
      className="text-primary-container hover:opacity-80 transition-opacity active:scale-95 duration-150"
    >
      <span className="material-symbols-outlined text-2xl">arrow_back</span>
    </button>
  );
}
