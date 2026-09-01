"use client";

import { desvincularAlumno } from "@/app/actions/coach";

export function BotonDesvincular({
  idAlumno,
  nombreCompleto,
}: {
  idAlumno: string;
  nombreCompleto: string;
}) {
  return (
    <form
      action={desvincularAlumno}
      onSubmit={(e) => {
        if (
          !confirm(
            `¿Desvincular a ${nombreCompleto} de tu cartera? Podés volver a vincularlo más adelante — no se borra su historial.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id_alumno" value={idAlumno} />
      <button
        type="submit"
        className="shrink-0 flex items-center gap-1.5 text-on-surface-variant hover:text-[#ffb4ab] font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-outline-variant"
      >
        <span className="material-symbols-outlined text-[16px]">person_remove</span>
        Desvincular
      </button>
    </form>
  );
}
