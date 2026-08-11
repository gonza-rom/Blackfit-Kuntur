"use client";

import { useActionState } from "react";
import { crearBloque } from "@/app/actions/coach";

export function FormNuevoBloque({ idPrograma }: { idPrograma: string }) {
  const [state, action, pending] = useActionState(crearBloque, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id_programa" value={idPrograma} />

      <div className="flex gap-3">
        <input
          name="nombre"
          type="text"
          required
          placeholder="Nombre del bloque"
          className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-sm p-2.5 transition-colors"
        />
        <input
          name="tipo"
          type="text"
          list="tipos-bloque"
          placeholder="Tipo (deload...)"
          className="w-40 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-sm p-2.5 transition-colors"
        />
        <datalist id="tipos-bloque">
          <option value="acumulacion" />
          <option value="intensificacion" />
          <option value="deload" />
          <option value="descarga" />
        </datalist>
      </div>

      <div className="flex gap-3">
        <input
          name="semana_inicio"
          type="number"
          min={1}
          placeholder="Semana inicio"
          className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-sm p-2.5 transition-colors"
        />
        <input
          name="semana_fin"
          type="number"
          min={1}
          placeholder="Semana fin"
          className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-sm p-2.5 transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 rounded disabled:opacity-60"
        >
          {pending ? "..." : "Agregar bloque"}
        </button>
      </div>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}
    </form>
  );
}
