"use client";

import { useActionState } from "react";
import { editarEjercicio } from "@/app/actions/coach";

const inputClase =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors";

const labelClase =
  "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase";

type Ejercicio = {
  id_ejercicio: string;
  nombre: string;
  descripcion: string | null;
  grupo_muscular: string | null;
  video_url: string | null;
  instrucciones: string | null;
  series_default: number | null;
  repeticiones_default: string | null;
  peso_sugerido_default: string | null;
  tempo_default: string | null;
  descanso_default: string | null;
  metodo_entrenamiento_default: string | null;
  tiempo_bajo_tension_default: number | null;
};

export function FormEditarEjercicio({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, action, pending] = useActionState(editarEjercicio, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id_ejercicio" value={ejercicio.id_ejercicio} />

      <div className="flex flex-col gap-2">
        <label htmlFor="nombre" className={labelClase}>
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          defaultValue={ejercicio.nombre}
          className={inputClase}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="grupo_muscular" className={labelClase}>
          Grupo muscular
        </label>
        <input
          id="grupo_muscular"
          name="grupo_muscular"
          type="text"
          defaultValue={ejercicio.grupo_muscular ?? ""}
          className={inputClase}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="descripcion" className={labelClase}>
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          defaultValue={ejercicio.descripcion ?? ""}
          className={inputClase}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="instrucciones" className={labelClase}>
          Instrucciones
        </label>
        <textarea
          id="instrucciones"
          name="instrucciones"
          rows={3}
          defaultValue={ejercicio.instrucciones ?? ""}
          className={inputClase}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="video_url" className={labelClase}>
          URL de video
        </label>
        <input
          id="video_url"
          name="video_url"
          type="url"
          defaultValue={ejercicio.video_url ?? ""}
          className={inputClase}
        />
      </div>

      <div className="border-t border-[#262626] pt-4 flex flex-col gap-2">
        <p className={labelClase}>Valores por defecto (opcional)</p>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input
            name="series_default"
            type="number"
            min={1}
            defaultValue={ejercicio.series_default ?? ""}
            placeholder="Series"
            className={`${inputClase} text-sm p-2.5`}
          />
          <input
            name="repeticiones_default"
            type="text"
            defaultValue={ejercicio.repeticiones_default ?? ""}
            placeholder="Reps (ej. 8-10)"
            className={`${inputClase} text-sm p-2.5`}
          />
          <input
            name="peso_sugerido_default"
            type="number"
            step="0.01"
            defaultValue={ejercicio.peso_sugerido_default ?? ""}
            placeholder="Peso sugerido (kg)"
            className={`${inputClase} text-sm p-2.5`}
          />
          <input
            name="tiempo_bajo_tension_default"
            type="number"
            min={0}
            defaultValue={ejercicio.tiempo_bajo_tension_default ?? ""}
            placeholder="TUT seg."
            className={`${inputClase} text-sm p-2.5`}
          />
          <input
            name="tempo_default"
            type="text"
            defaultValue={ejercicio.tempo_default ?? ""}
            placeholder="Tempo (ej. 3-1-1)"
            className={`${inputClase} text-sm p-2.5`}
          />
          <input
            name="descanso_default"
            type="text"
            defaultValue={ejercicio.descanso_default ?? ""}
            placeholder="Descanso (ej. 90s)"
            className={`${inputClase} text-sm p-2.5`}
          />
          <input
            name="metodo_entrenamiento_default"
            type="text"
            defaultValue={ejercicio.metodo_entrenamiento_default ?? ""}
            placeholder="Método (ej. dropset)"
            className={`col-span-2 ${inputClase} text-sm p-2.5`}
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
