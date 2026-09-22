"use client";

import { useActionState } from "react";
import { avisarAlumnoRutinaLista } from "@/app/actions/coach";

// Antes era un <form action={fn}> plano sin useActionState: la acción
// corría bien (se veía en los logs del servidor) pero no había ningún
// cambio visual en pantalla, así que parecía que el botón no hacía nada.
export function BotonAvisarAlumno({ idPrograma }: { idPrograma: string }) {
  const [state, action, pending] = useActionState(avisarAlumnoRutinaLista, undefined);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id_programa" value={idPrograma} />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 flex items-center gap-1.5 bg-primary-container text-black font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase font-bold px-3 py-2 rounded-full disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[16px]">
          {pending ? "hourglass_top" : "notifications_active"}
        </span>
        {pending ? "Avisando..." : "Avisar al alumno"}
      </button>
      {state?.message && (
        <p className="text-[11px] text-primary-container">{state.message}</p>
      )}
      {state?.error && <p className="text-[11px] text-[#ffb4ab]">{state.error}</p>}
    </form>
  );
}
