"use client";

import { useActionState } from "react";
import { editarPlanMembresia } from "@/app/actions/admin";

type Plan = {
  id_plan_membresia: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  duracion_dias: number;
};

export function FormEditarPlan({ plan }: { plan: Plan }) {
  const [state, action, pending] = useActionState(editarPlanMembresia, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id_plan_membresia" value={plan.id_plan_membresia} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="nombre"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={plan.nombre}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="precio"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
          >
            Precio
          </label>
          <input
            id="precio"
            name="precio"
            type="number"
            step="0.01"
            required
            defaultValue={plan.precio}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="duracion_dias"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
          >
            Duración (días)
          </label>
          <input
            id="duracion_dias"
            name="duracion_dias"
            type="number"
            required
            defaultValue={plan.duracion_dias}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="descripcion"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          defaultValue={plan.descripcion ?? ""}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
