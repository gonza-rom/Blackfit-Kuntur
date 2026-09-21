"use client";

import { useActionState } from "react";
import { eliminarGrupoSemanas } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonEliminarGrupo({
  idPrograma,
  semanaInicio,
  semanaFin,
  etiqueta,
}: {
  idPrograma: string;
  semanaInicio: number;
  semanaFin: number;
  etiqueta: string;
}) {
  const [state, action, pending] = useActionState(eliminarGrupoSemanas, undefined);

  return (
    <div className="flex flex-col items-end gap-1">
      {state?.error && <p className="text-[#ffb4ab] text-xs text-right">{state.error}</p>}
      <ConfirmForm
        action={action}
        pending={pending}
        titulo="Eliminar grupo de semanas"
        mensaje={`¿Eliminar "${etiqueta}" y los ejercicios de sus 7 días? No se puede deshacer.`}
      >
        <input type="hidden" name="id_programa" value={idPrograma} />
        <input type="hidden" name="semana_inicio" value={semanaInicio} />
        <input type="hidden" name="semana_fin" value={semanaFin} />
        <button
          type="submit"
          disabled={pending}
          aria-label={`Eliminar ${etiqueta}`}
          className="text-on-surface-variant hover:text-[#ffb4ab] disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </ConfirmForm>
    </div>
  );
}
