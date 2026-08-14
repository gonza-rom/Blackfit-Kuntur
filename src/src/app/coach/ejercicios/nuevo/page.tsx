"use client";

import { useActionState } from "react";
import { crearEjercicio } from "@/app/actions/coach";

export default function NuevoEjercicioPage() {
  const [state, action, pending] = useActionState(crearEjercicio, undefined);

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Nuevo ejercicio
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <form action={action} className="flex flex-col gap-4">
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
              placeholder="Sentadilla trasera"
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="grupo_muscular"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              Grupo muscular
            </label>
            <input
              id="grupo_muscular"
              name="grupo_muscular"
              type="text"
              placeholder="Cuádriceps"
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

          <div className="flex flex-col gap-2">
            <label
              htmlFor="instrucciones"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              Instrucciones
            </label>
            <textarea
              id="instrucciones"
              name="instrucciones"
              rows={3}
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="video_url"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              URL de video
            </label>
            <input
              id="video_url"
              name="video_url"
              type="url"
              placeholder="https://..."
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
            {pending ? "Creando..." : "Crear ejercicio"}
          </button>
        </form>
      </div>
    </main>
  );
}
