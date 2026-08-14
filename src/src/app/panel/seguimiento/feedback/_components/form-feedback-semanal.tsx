"use client";

import { useActionState } from "react";
import { registrarFeedbackSemanal } from "@/app/actions/alumno";

export function FormFeedbackSemanal() {
  const [state, action, pending] = useActionState(registrarFeedbackSemanal, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
          Inicio de semana
        </label>
        <input
          name="semana_inicio"
          type="date"
          required
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
      </div>
      <textarea
        name="comentario_semanal"
        required
        rows={3}
        placeholder="¿Cómo fue tu semana?"
        className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-base p-3 transition-colors"
      />

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
        {pending ? "Guardando..." : "Guardar feedback semanal"}
      </button>
    </form>
  );
}
