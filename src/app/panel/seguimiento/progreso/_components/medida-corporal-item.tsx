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
  fotoUrl,
}: {
  id: string;
  fecha: string;
  tipoMedida: string;
  valorCm: string;
  fotoUrl: string | null;
}) {
  const [editar, setEditar] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const [state, action, pending] = useActionState(editarMedidaCorporal, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-on-surface-variant shrink-0">{fecha}</span>
        {!editar && (
          <span className="text-on-surface flex-1 text-right capitalize flex items-center justify-end gap-2">
            {fotoUrl && (
              <button
                type="button"
                onClick={() => setAmpliada((v) => !v)}
                className="shrink-0"
                aria-label="Ver foto"
              >
                <img
                  src={fotoUrl}
                  alt={`Foto de ${tipoMedida}`}
                  className="w-9 h-9 rounded object-cover border border-[#262626]"
                />
              </button>
            )}
            <span>
              {tipoMedida}: {valorCm}cm
            </span>
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

      {ampliada && fotoUrl && !editar && (
        <img
          src={fotoUrl}
          alt={`Foto de ${tipoMedida}`}
          className="mt-2 w-full max-h-80 object-contain rounded border border-[#262626]"
        />
      )}

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
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
              {fotoUrl ? "Reemplazar foto" : "Agregar foto"}
            </span>
            <input
              name="foto"
              type="file"
              accept="image/*"
              className="text-xs text-on-surface-variant file:mr-2 file:rounded file:border-0 file:bg-[#262626] file:px-2 file:py-1 file:text-on-surface file:text-xs"
            />
          </label>
          {fotoUrl && (
            <label className="col-span-2 flex items-center gap-2 text-xs text-on-surface-variant">
              <input type="checkbox" name="quitar_foto" />
              Quitar la foto actual
            </label>
          )}
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
