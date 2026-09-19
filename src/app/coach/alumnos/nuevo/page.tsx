"use client";

import { useActionState } from "react";
import { crearYVincularAlumno } from "@/app/actions/coach";

export default function NuevoAlumnoPage() {
  const [state, action, pending] = useActionState(crearYVincularAlumno, undefined);

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Nuevo alumno
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Para alguien que todavía no tiene cuenta. Le creás el usuario con su DNI — esa va
          a ser también su contraseña inicial para entrar y completar su perfil. Si ya tiene
          cuenta, usá &quot;Vincular&quot; en vez de esto.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <form action={action} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
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
                className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label
                htmlFor="apellido"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
              >
                Apellido
              </label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                required
                className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="dni"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              DNI
            </label>
            <input
              id="dni"
              name="dni"
              type="text"
              inputMode="numeric"
              required
              placeholder="Ej. 30123456"
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
            />
            <p className="text-xs text-on-surface-variant">
              Va a ser su usuario y su contraseña inicial para entrar.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              Email (opcional)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Dejalo vacío si no tiene"
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
            />
            <p className="text-xs text-on-surface-variant">
              Si no tiene, va a poder entrar igual con su DNI.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="checkbox"
              name="vincular"
              defaultChecked
              className="w-4 h-4 accent-primary-container"
            />
            Vincularlo a mi cartera ahora
          </label>

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
            {pending ? "Creando..." : "Crear alumno"}
          </button>
        </form>
      </div>
    </main>
  );
}
