"use client";

import { useActionState } from "react";
import { actualizarPerfilEntrenador } from "@/app/actions/coach";

export function FormPerfilEntrenador({
  especialidad,
  biografia,
}: {
  especialidad: string | null;
  biografia: string | null;
}) {
  const [state, action, pending] = useActionState(actualizarPerfilEntrenador, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="especialidad"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Especialidad
        </label>
        <input
          id="especialidad"
          name="especialidad"
          type="text"
          defaultValue={especialidad ?? ""}
          placeholder="Fuerza, hipertrofia, rehabilitación..."
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="biografia"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Biografía
        </label>
        <textarea
          id="biografia"
          name="biografia"
          rows={3}
          defaultValue={biografia ?? ""}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
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
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
