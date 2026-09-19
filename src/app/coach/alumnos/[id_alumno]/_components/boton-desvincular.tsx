"use client";

import { desvincularAlumno } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonDesvincular({
  idAlumno,
  nombreCompleto,
}: {
  idAlumno: string;
  nombreCompleto: string;
}) {
  return (
    <ConfirmForm
      action={desvincularAlumno}
      titulo="Desvincular alumno"
      confirmLabel="Desvincular"
      mensaje={`¿Desvincular a ${nombreCompleto} de tu cartera? Podés volver a vincularlo más adelante — no se borra su historial.`}
    >
      <input type="hidden" name="id_alumno" value={idAlumno} />
      <button
        type="submit"
        className="shrink-0 flex items-center gap-1.5 text-on-surface-variant hover:text-[#ffb4ab] font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-outline-variant"
      >
        <span className="material-symbols-outlined text-[16px]">person_remove</span>
        Desvincular
      </button>
    </ConfirmForm>
  );
}
