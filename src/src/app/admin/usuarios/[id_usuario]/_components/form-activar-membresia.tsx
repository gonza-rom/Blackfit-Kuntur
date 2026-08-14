"use client";

import { useActionState } from "react";
import { activarMembresia } from "@/app/actions/admin";

type Plan = { id_plan_membresia: string; nombre: string; duracion_dias: number };

export function FormActivarMembresia({
  idUsuario,
  planes,
}: {
  idUsuario: string;
  planes: Plan[];
}) {
  const [state, action, pending] = useActionState(activarMembresia, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id_usuario" value={idUsuario} />

      <select
        name="id_plan_membresia"
        required
        defaultValue=""
        className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
      >
        <option value="" disabled>
          Elegir plan
        </option>
        {planes.map((plan) => (
          <option key={plan.id_plan_membresia} value={plan.id_plan_membresia}>
            {plan.nombre} ({plan.duracion_dias} días)
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-1">
        <label className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
          Fecha de inicio
        </label>
        <input
          name="fecha_inicio"
          type="date"
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
        {pending ? "Activando..." : "Activar membresía"}
      </button>
    </form>
  );
}
