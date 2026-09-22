"use client";

import { useActionState } from "react";
import { guardarComoPlantilla } from "@/app/actions/coach";

// Clona este programa real en la biblioteca de plantillas (compartida
// entre todos los coaches) para poder aplicarlo a otros alumnos sin
// rehacerlo de cero. El programa del alumno actual no se toca.
export function BotonGuardarComoPlantilla({ idPrograma }: { idPrograma: string }) {
  const [state, action, pending] = useActionState(guardarComoPlantilla, undefined);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id_programa" value={idPrograma} />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 flex items-center gap-1.5 border border-outline-variant text-on-surface font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
        {pending ? "Guardando..." : "Guardar como plantilla"}
      </button>
      {state?.error && <p className="text-[11px] text-[#ffb4ab]">{state.error}</p>}
    </form>
  );
}
