"use client";

import { useActionState } from "react";
import { eliminarEjercicio } from "@/app/actions/coach";

export function BotonEliminarEjercicio({
  idEjercicio,
  nombre,
}: {
  idEjercicio: string;
  nombre: string;
}) {
  const [state, action, pending] = useActionState(eliminarEjercicio, undefined);

  return (
    <div className="flex flex-col gap-2">
      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`¿Eliminar "${nombre}" de la biblioteca? No se puede deshacer.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id_ejercicio" value={idEjercicio} />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-transparent border border-[#ffb4ab] text-[#ffb4ab] font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:bg-[#ffb4ab]/10 transition-colors disabled:opacity-40"
        >
          {pending ? "Eliminando..." : "Eliminar ejercicio"}
        </button>
      </form>
    </div>
  );
}
