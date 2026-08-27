"use client";

import { useActionState } from "react";
import { registrarProgresoFisico } from "@/app/actions/alumno";

export function FormProgresoFisico() {
  const [state, action, pending] = useActionState(registrarProgresoFisico, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <input
          name="peso_corporal"
          type="number"
          step="0.01"
          placeholder="Peso (kg)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="porcentaje_graso"
          type="number"
          step="0.01"
          placeholder="% graso"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="masa_muscular"
          type="number"
          step="0.01"
          placeholder="Masa musc. (kg)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
      </div>

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
        {pending ? "Guardando..." : "Registrar"}
      </button>
    </form>
  );
}
