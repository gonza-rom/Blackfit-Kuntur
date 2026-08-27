"use client";

import { useActionState, useState } from "react";
import { crearEjercicioPrograma } from "@/app/actions/coach";

type Ejercicio = {
  id_ejercicio: string;
  nombre: string;
  series_default: number | null;
  repeticiones_default: string | null;
  peso_sugerido_default: string | null;
  tempo_default: string | null;
  descanso_default: string | null;
  metodo_entrenamiento_default: string | null;
  tiempo_bajo_tension_default: number | null;
};

const inputClase =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";

const VALORES_VACIOS = {
  series: "",
  repeticiones: "",
  peso_sugerido: "",
  tiempo_bajo_tension_sugerido: "",
  tempo: "",
  descanso: "",
  metodo_entrenamiento: "",
};

export function FormNuevoEjercicioBloque({
  idBloque,
  biblioteca,
}: {
  idBloque: string;
  biblioteca: Ejercicio[];
}) {
  const [state, action, pending] = useActionState(crearEjercicioPrograma, undefined);

  // Precarga con los valores por defecto del ejercicio elegido (definidos
  // en /coach/ejercicios/nuevo). El coach puede pisarlos libremente antes
  // de guardar — esto solo ahorra tipeo repetido. Los inputs quedan
  // controlados por este estado (en vez de defaultValue) para que la
  // precarga se vea reflejada al tocar el <select>.
  const [valores, setValores] = useState(VALORES_VACIOS);

  function alElegirEjercicio(idEjercicio: string) {
    const ejercicio = biblioteca.find((e) => e.id_ejercicio === idEjercicio);
    setValores({
      series: ejercicio?.series_default?.toString() ?? "",
      repeticiones: ejercicio?.repeticiones_default ?? "",
      peso_sugerido: ejercicio?.peso_sugerido_default ?? "",
      tiempo_bajo_tension_sugerido: ejercicio?.tiempo_bajo_tension_default?.toString() ?? "",
      tempo: ejercicio?.tempo_default ?? "",
      descanso: ejercicio?.descanso_default ?? "",
      metodo_entrenamiento: ejercicio?.metodo_entrenamiento_default ?? "",
    });
  }

  return (
    <form action={action} className="flex flex-col gap-2 bg-[#131313] border border-[#262626] rounded-lg p-3">
      <input type="hidden" name="id_bloque" value={idBloque} />

      <select
        name="id_ejercicio"
        required
        defaultValue=""
        onChange={(e) => alElegirEjercicio(e.target.value)}
        className={`w-full ${inputClase}`}
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
          value={valores.series}
          onChange={(e) => setValores((v) => ({ ...v, series: e.target.value }))}
          placeholder="Series"
          className={inputClase}
        />
        <input
          name="repeticiones"
          type="text"
          required
          value={valores.repeticiones}
          onChange={(e) => setValores((v) => ({ ...v, repeticiones: e.target.value }))}
          placeholder="Reps (ej. 8-10)"
          className={inputClase}
        />
        <input
          name="peso_sugerido"
          type="number"
          step="0.01"
          value={valores.peso_sugerido}
          onChange={(e) => setValores((v) => ({ ...v, peso_sugerido: e.target.value }))}
          placeholder="Peso sugerido (opcional)"
          className={inputClase}
        />
        <input
          name="tiempo_bajo_tension_sugerido"
          type="number"
          min={0}
          value={valores.tiempo_bajo_tension_sugerido}
          onChange={(e) =>
            setValores((v) => ({ ...v, tiempo_bajo_tension_sugerido: e.target.value }))
          }
          placeholder="TUT seg. (opcional)"
          className={inputClase}
        />
        <input
          name="tempo"
          type="text"
          value={valores.tempo}
          onChange={(e) => setValores((v) => ({ ...v, tempo: e.target.value }))}
          placeholder="Tempo (ej. 3-1-1)"
          className={inputClase}
        />
        <input
          name="descanso"
          type="text"
          value={valores.descanso}
          onChange={(e) => setValores((v) => ({ ...v, descanso: e.target.value }))}
          placeholder="Descanso (ej. 90s)"
          className={inputClase}
        />
        <input
          name="metodo_entrenamiento"
          type="text"
          value={valores.metodo_entrenamiento}
          onChange={(e) => setValores((v) => ({ ...v, metodo_entrenamiento: e.target.value }))}
          placeholder="Método (ej. dropset)"
          className={`col-span-2 ${inputClase}`}
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
