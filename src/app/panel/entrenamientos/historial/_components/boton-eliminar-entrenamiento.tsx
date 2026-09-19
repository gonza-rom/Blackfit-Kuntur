"use client";

import { eliminarEntrenamiento } from "@/app/actions/alumno";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonEliminarEntrenamiento({ idEntrenamiento }: { idEntrenamiento: string }) {
  return (
    <ConfirmForm
      action={eliminarEntrenamiento}
      mensaje="¿Eliminar esta sesión registrada? No se puede deshacer."
    >
      <input type="hidden" name="id_entrenamiento" value={idEntrenamiento} />
      <button
        type="submit"
        aria-label="Eliminar sesión"
        className="text-on-surface-variant hover:text-[#ffb4ab]"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </ConfirmForm>
  );
}
