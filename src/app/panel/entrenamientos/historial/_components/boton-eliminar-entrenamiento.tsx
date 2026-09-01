"use client";

import { eliminarEntrenamiento } from "@/app/actions/alumno";

export function BotonEliminarEntrenamiento({ idEntrenamiento }: { idEntrenamiento: string }) {
  return (
    <form
      action={eliminarEntrenamiento}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta sesión registrada? No se puede deshacer.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id_entrenamiento" value={idEntrenamiento} />
      <button
        type="submit"
        aria-label="Eliminar sesión"
        className="text-on-surface-variant hover:text-[#ffb4ab]"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </form>
  );
}
