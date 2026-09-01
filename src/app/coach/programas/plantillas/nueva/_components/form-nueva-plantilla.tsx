"use client";

import { useActionState } from "react";
import { crearPlantillaPrograma } from "@/app/actions/coach";

export function FormNuevaPlantilla() {
  const [state, action, pending] = useActionState(crearPlantillaPrograma, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="nombre"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Nombre de la plantilla
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          placeholder="Fuerza general — 4 semanas"
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="objetivo"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Objetivo
        </label>
        <input
          id="objetivo"
          name="objetivo"
          type="text"
          placeholder="Hipertrofia, fuerza, pérdida de grasa..."
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
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
          rows={3}
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
        {pending ? "Creando..." : "Crear plantilla"}
      </button>
    </form>
  );
}
