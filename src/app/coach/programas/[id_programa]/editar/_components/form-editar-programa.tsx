"use client";

import { useActionState } from "react";
import { editarPrograma } from "@/app/actions/coach";

type Programa = {
  id_programa: string;
  nombre: string;
  descripcion: string | null;
  objetivo: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_programa: string;
};

export function FormEditarPrograma({ programa }: { programa: Programa }) {
  const [state, action, pending] = useActionState(editarPrograma, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id_programa" value={programa.id_programa} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="nombre"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Nombre del programa
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={programa.nombre}
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
          defaultValue={programa.objetivo ?? ""}
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
          defaultValue={programa.descripcion ?? ""}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="fecha_inicio"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
          >
            Inicio
          </label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            required
            defaultValue={programa.fecha_inicio}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="fecha_fin"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
          >
            Fin (opcional)
          </label>
          <input
            id="fecha_fin"
            name="fecha_fin"
            type="date"
            defaultValue={programa.fecha_fin ?? ""}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="estado_programa"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Estado
        </label>
        <select
          id="estado_programa"
          name="estado_programa"
          defaultValue={programa.estado_programa}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        >
          <option value="activo">Activo</option>
          <option value="pausado">Pausado</option>
          <option value="finalizado">Finalizado</option>
        </select>
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
