"use client";

import { useActionState } from "react";
import { editarBeneficio } from "@/app/actions/admin";

type Beneficio = {
  id_beneficio: string;
  titulo: string;
  descripcion: string | null;
  descuento: string | null;
  condiciones: string | null;
  fecha_inicio: Date;
  fecha_vencimiento: Date;
};

// Prisma trae DateTime como Date; el input type="date" necesita "yyyy-MM-dd".
function aFechaInput(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function FormEditarBeneficio({ beneficio }: { beneficio: Beneficio }) {
  const [state, action, pending] = useActionState(editarBeneficio, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id_beneficio" value={beneficio.id_beneficio} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="titulo"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Título
        </label>
        <input
          id="titulo"
          name="titulo"
          type="text"
          required
          defaultValue={beneficio.titulo}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="descuento"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Descuento (texto libre)
        </label>
        <input
          id="descuento"
          name="descuento"
          type="text"
          defaultValue={beneficio.descuento ?? ""}
          placeholder="20% OFF"
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
          defaultValue={beneficio.descripcion ?? ""}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="condiciones"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Condiciones
        </label>
        <textarea
          id="condiciones"
          name="condiciones"
          rows={2}
          defaultValue={beneficio.condiciones ?? ""}
          placeholder="No acumulable con otras promociones..."
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="fecha_inicio"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
          >
            Desde
          </label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type="date"
            required
            defaultValue={aFechaInput(beneficio.fecha_inicio)}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="fecha_vencimiento"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
          >
            Hasta
          </label>
          <input
            id="fecha_vencimiento"
            name="fecha_vencimiento"
            type="date"
            required
            defaultValue={aFechaInput(beneficio.fecha_vencimiento)}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
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
