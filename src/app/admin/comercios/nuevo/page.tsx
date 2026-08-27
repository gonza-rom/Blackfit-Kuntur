"use client";

import { useActionState } from "react";
import { crearComercio } from "@/app/actions/admin";

export default function NuevoComercioPage() {
  const [state, action, pending] = useActionState(crearComercio, undefined);

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Nuevo comercio
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          El usuario debe haberse registrado antes en la plataforma. Esta acción le
          asigna el rol de comercio y crea su perfil.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              Email del usuario
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="contacto@comercio.com"
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
            />
          </div>

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
              placeholder="Café Kuntur"
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
            {pending ? "Creando..." : "Crear comercio"}
          </button>
        </form>
      </div>
    </main>
  );
}
