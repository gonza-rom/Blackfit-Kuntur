"use client";

import { useActionState, useState } from "react";
import { editarMedidaCorporal, eliminarMedidaCorporal } from "@/app/actions/alumno";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 transition-colors";

export function MedidaCorporalItem({
  id,
  fecha,
  tipoMedida,
  valorCm,
}: {
  id: string;
  fecha: string;
  tipoMedida: string;
  valorCm: string;
}) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(editarMedidaCorporal, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-on-surface-variant shrink-0">{fecha}</span>
        {!editar && (
          <span className="text-on-surface flex-1 text-right capitalize">
            {tipoMedida}: {valorCm}cm
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditar((v) => !v)}
            aria-label="Editar"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">
              {editar ? "close" : "edit"}
            </span>
          </button>
          <form action={eliminarMedidaCorporal}>
            <input type="hidden" name="id_medida" value={id} />
            <button
              type="submit"
              aria-label="Eliminar"
              className="text-on-surface-variant hover:text-[#ffb4ab]"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </form>
        </div>
      </div>

      {editar && (
        <form action={action} className="grid grid-cols-2 gap-2 mt-2">
          <input type="hidden" name="id_medida" value={id} />
          <input
            name="tipo_medida"
            type="text"
            defaultValue={tipoMedida}
            placeholder="Cintura, brazo..."
            className={INPUT}
          />
          <input
            name="valor_cm"
            type="number"
            step="0.01"
            defaultValue={valorCm}
            placeholder="cm"
            className={INPUT}
          />
          {state?.error && (
            <p className="col-span-2 text-[#ffb4ab] text-xs">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="col-span-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold py-1.5 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}
    </div>
  );
}
