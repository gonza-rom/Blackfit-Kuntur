"use client";

import { useActionState } from "react";
import { editarComercio } from "@/app/actions/admin";

type Comercio = {
  id_comercio: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string | null;
  categoria: string | null;
};

export function FormEditarComercio({ comercio }: { comercio: Comercio }) {
  const [state, action, pending] = useActionState(editarComercio, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id_comercio" value={comercio.id_comercio} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="nombre"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Nombre del comercio
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={comercio.nombre}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="categoria"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Categoría
        </label>
        <input
          id="categoria"
          name="categoria"
          type="text"
          defaultValue={comercio.categoria ?? ""}
          placeholder="Gastronomía, indumentaria, salud..."
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="direccion"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Dirección
        </label>
        <input
          id="direccion"
          name="direccion"
          type="text"
          defaultValue={comercio.direccion ?? ""}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="telefono"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Teléfono
        </label>
        <input
          id="telefono"
          name="telefono"
          type="text"
          defaultValue={comercio.telefono ?? ""}
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
          rows={2}
          defaultValue={comercio.descripcion ?? ""}
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
