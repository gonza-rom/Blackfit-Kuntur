"use client";

import { useActionState } from "react";
import { registrarMedidaCorporal } from "@/app/actions/alumno";

export function FormMedidaCorporal() {
  const [state, action, pending] = useActionState(registrarMedidaCorporal, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          name="tipo_medida"
          required
          defaultValue=""
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        >
          <option value="" disabled>
            Tipo de medida
          </option>
          <option value="cintura">Cintura</option>
          <option value="cadera">Cadera</option>
          <option value="brazo">Brazo</option>
          <option value="pecho">Pecho</option>
          <option value="pierna">Pierna</option>
        </select>
        <input
          name="valor_cm"
          type="number"
          step="0.01"
          required
          placeholder="cm"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
          Foto de progreso (opcional)
        </span>
        <input
          name="foto"
          type="file"
          accept="image/*"
          className="text-sm text-on-surface-variant file:mr-3 file:rounded file:border-0 file:bg-[#262626] file:px-3 file:py-1.5 file:text-on-surface file:text-sm"
        />
      </label>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-primary-container">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-2.5 rounded disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Registrar medida"}
      </button>
    </form>
  );
}
