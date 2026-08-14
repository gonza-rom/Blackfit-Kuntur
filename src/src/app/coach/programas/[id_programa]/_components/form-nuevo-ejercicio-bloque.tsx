"use client";

import { useActionState } from "react";
import { crearEjercicioPrograma } from "@/app/actions/coach";

type Ejercicio = { id_ejercicio: string; nombre: string };

export function FormNuevoEjercicioBloque({
  idBloque,
  biblioteca,
}: {
  idBloque: string;
  biblioteca: Ejercicio[];
}) {
  const [state, action, pending] = useActionState(crearEjercicioPrograma, undefined);

  return (
    <form action={action} className="flex flex-col gap-2 bg-[#131313] border border-[#262626] rounded-lg p-3">
      <input type="hidden" name="id_bloque" value={idBloque} />

      <select
        name="id_ejercicio"
        required
        defaultValue=""
        className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-sm p-2.5 transition-colors"
      >
        <option value="" disabled>
          Elegir ejercicio de la biblioteca
        </option>
        {biblioteca.map((ejercicio) => (
          <option key={ejercicio.id_ejercicio} value={ejercicio.id_ejercicio}>
            {ejercicio.nombre}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          name="series"
          type="number"
          min={1}
          required
          placeholder="Series"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="repeticiones"
          type="text"
          required
          placeholder="Reps (ej. 8-10)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="peso_sugerido"
          type="number"
          step="0.01"
          placeholder="Peso sugerido (opcional)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="tiempo_bajo_tension_sugerido"
          type="number"
          min={0}
          placeholder="TUT seg. (opcional)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="tempo"
          type="text"
          placeholder="Tempo (ej. 3-1-1)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="descanso"
          type="text"
          placeholder="Descanso (ej. 90s)"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <input
          name="metodo_entrenamiento"
          type="text"
          placeholder="Método (ej. dropset)"
          className="col-span-2 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
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
        className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-2 rounded disabled:opacity-60"
      >
        {pending ? "Agregando..." : "Agregar ejercicio"}
      </button>
    </form>
  );
}
