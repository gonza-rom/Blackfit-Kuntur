"use client";

import { use, useActionState } from "react";
import { crearBeneficio } from "@/app/actions/admin";

export default function NuevoBeneficioPage(
  props: PageProps<"/admin/comercios/[id_comercio]/beneficios/nuevo">
) {
  const { id_comercio } = use(props.params);
  const [state, action, pending] = useActionState(crearBeneficio, undefined);

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Nuevo beneficio
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="id_comercio" value={id_comercio} />

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
              placeholder="20% de descuento"
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
            {pending ? "Creando..." : "Crear beneficio"}
          </button>
        </form>
      </div>
    </main>
  );
}
