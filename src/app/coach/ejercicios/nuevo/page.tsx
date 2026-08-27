"use client";

import { useActionState } from "react";
import { crearEjercicio } from "@/app/actions/coach";

<<<<<<< HEAD
const inputClase =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors";

const labelClase =
  "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase";

=======
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
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
<<<<<<< HEAD
            <label htmlFor="nombre" className={labelClase}>
=======
            <label
              htmlFor="nombre"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              placeholder="Sentadilla trasera"
<<<<<<< HEAD
              className={inputClase}
=======
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
            />
          </div>

          <div className="flex flex-col gap-2">
<<<<<<< HEAD
            <label htmlFor="grupo_muscular" className={labelClase}>
=======
            <label
              htmlFor="grupo_muscular"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
              Grupo muscular
            </label>
            <input
              id="grupo_muscular"
              name="grupo_muscular"
              type="text"
              placeholder="Cuádriceps"
<<<<<<< HEAD
              className={inputClase}
=======
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
            />
          </div>

          <div className="flex flex-col gap-2">
<<<<<<< HEAD
            <label htmlFor="descripcion" className={labelClase}>
              Descripción
            </label>
            <textarea id="descripcion" name="descripcion" rows={3} className={inputClase} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="instrucciones" className={labelClase}>
              Instrucciones
            </label>
            <textarea id="instrucciones" name="instrucciones" rows={3} className={inputClase} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="video_url" className={labelClase}>
=======
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
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
              URL de video
            </label>
            <input
              id="video_url"
              name="video_url"
              type="url"
              placeholder="https://..."
<<<<<<< HEAD
              className={inputClase}
            />
          </div>

          <div className="border-t border-[#262626] pt-4 flex flex-col gap-2">
            <p className={labelClase}>Valores por defecto (opcional)</p>
            <p className="text-xs text-on-surface-variant -mt-1">
              Se van a precargar cada vez que agregues este ejercicio a una rutina — podés
              cambiarlos igual en cada programa.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                name="series_default"
                type="number"
                min={1}
                placeholder="Series"
                className={`${inputClase} text-sm p-2.5`}
              />
              <input
                name="repeticiones_default"
                type="text"
                placeholder="Reps (ej. 8-10)"
                className={`${inputClase} text-sm p-2.5`}
              />
              <input
                name="peso_sugerido_default"
                type="number"
                step="0.01"
                placeholder="Peso sugerido (kg)"
                className={`${inputClase} text-sm p-2.5`}
              />
              <input
                name="tiempo_bajo_tension_default"
                type="number"
                min={0}
                placeholder="TUT seg."
                className={`${inputClase} text-sm p-2.5`}
              />
              <input
                name="tempo_default"
                type="text"
                placeholder="Tempo (ej. 3-1-1)"
                className={`${inputClase} text-sm p-2.5`}
              />
              <input
                name="descanso_default"
                type="text"
                placeholder="Descanso (ej. 90s)"
                className={`${inputClase} text-sm p-2.5`}
              />
              <input
                name="metodo_entrenamiento_default"
                type="text"
                placeholder="Método (ej. dropset)"
                className={`col-span-2 ${inputClase} text-sm p-2.5`}
              />
            </div>
          </div>

=======
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
            />
          </div>

>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
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
