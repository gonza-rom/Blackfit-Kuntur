"use client";

import { useActionState } from "react";
import { registrarFeedbackDiario } from "@/app/actions/alumno";

export function FormFeedbackDiario() {
  const [state, action, pending] = useActionState(registrarFeedbackDiario, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <textarea
        name="comentario_diario"
        required
        rows={3}
        placeholder="¿Cómo te sentiste hoy?"
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
        {pending ? "Guardando..." : "Guardar feedback diario"}
      </button>
    </form>
  );
}
