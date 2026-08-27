"use client";

import { useActionState, useState } from "react";
import {
  actualizarEjercicioPrograma,
  eliminarEjercicioPrograma,
  moverEjercicioPrograma,
} from "@/app/actions/coach";

export type EjercicioProgramaData = {
  id_ejercicio_programa: string;
  nombre: string;
  series: number;
  repeticiones: string;
  peso_sugerido: string | null;
  tempo: string | null;
  descanso: string | null;
  metodo_entrenamiento: string | null;
  tiempo_bajo_tension_sugerido: number | null;
};

const inputClase =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";

export function EjercicioProgramaItem({
  ejercicio,
  esPrimero,
  esUltimo,
}: {
  ejercicio: EjercicioProgramaData;
  esPrimero: boolean;
  esUltimo: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [state, action, pending] = useActionState(actualizarEjercicioPrograma, undefined);

  if (editando) {
    return (
      <form
        action={async (formData) => {
          await action(formData);
          setEditando(false);
        }}
        className="flex flex-col gap-2 bg-[#131313] border border-primary-container/40 rounded-lg p-3"
      >
        <input type="hidden" name="id_ejercicio_programa" value={ejercicio.id_ejercicio_programa} />
        <p className="text-sm font-semibold text-on-surface">{ejercicio.nombre}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input
            name="series"
            type="number"
            min={1}
            required
            defaultValue={ejercicio.series}
            placeholder="Series"
            className={inputClase}
          />
          <input
            name="repeticiones"
            type="text"
            required
            defaultValue={ejercicio.repeticiones}
            placeholder="Reps"
            className={inputClase}
          />
          <input
            name="peso_sugerido"
            type="number"
            step="0.01"
            defaultValue={ejercicio.peso_sugerido ?? ""}
            placeholder="Peso sugerido"
            className={inputClase}
          />
          <input
            name="tiempo_bajo_tension_sugerido"
            type="number"
            min={0}
            defaultValue={ejercicio.tiempo_bajo_tension_sugerido ?? ""}
            placeholder="TUT seg."
            className={inputClase}
          />
          <input
            name="tempo"
            type="text"
            defaultValue={ejercicio.tempo ?? ""}
            placeholder="Tempo"
            className={inputClase}
          />
          <input
            name="descanso"
            type="text"
            defaultValue={ejercicio.descanso ?? ""}
            placeholder="Descanso"
            className={inputClase}
          />
          <input
            name="metodo_entrenamiento"
            type="text"
            defaultValue={ejercicio.metodo_entrenamiento ?? ""}
            placeholder="Método"
            className={`col-span-2 ${inputClase}`}
          />
        </div>

        {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-2 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="px-4 text-sm text-on-surface-variant hover:text-on-surface"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-[#131313] border border-[#262626] rounded-lg p-3 text-sm text-on-surface flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold">{ejercicio.nombre}</p>
        <p className="text-on-surface-variant">
          {ejercicio.series}×{ejercicio.repeticiones}
          {ejercicio.peso_sugerido ? ` · ${ejercicio.peso_sugerido}kg` : ""}
          {ejercicio.tempo ? ` · tempo ${ejercicio.tempo}` : ""}
          {ejercicio.descanso ? ` · descanso ${ejercicio.descanso}` : ""}
          {ejercicio.metodo_entrenamiento ? ` · ${ejercicio.metodo_entrenamiento}` : ""}
          {ejercicio.tiempo_bajo_tension_sugerido
            ? ` · TUT ${ejercicio.tiempo_bajo_tension_sugerido}s`
            : ""}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <form action={moverEjercicioPrograma}>
          <input type="hidden" name="id_ejercicio_programa" value={ejercicio.id_ejercicio_programa} />
          <input type="hidden" name="direccion" value="arriba" />
          <button
            type="submit"
            disabled={esPrimero}
            aria-label="Subir"
            className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:hover:text-on-surface-variant p-1"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
        </form>
        <form action={moverEjercicioPrograma}>
          <input type="hidden" name="id_ejercicio_programa" value={ejercicio.id_ejercicio_programa} />
          <input type="hidden" name="direccion" value="abajo" />
          <button
            type="submit"
            disabled={esUltimo}
            aria-label="Bajar"
            className="text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:hover:text-on-surface-variant p-1"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
          </button>
        </form>
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar"
          className="text-on-surface-variant hover:text-on-surface p-1"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <form action={eliminarEjercicioPrograma}>
          <input type="hidden" name="id_ejercicio_programa" value={ejercicio.id_ejercicio_programa} />
          <button
            type="submit"
            aria-label="Eliminar"
            className="text-[#ffb4ab] hover:opacity-80 p-1"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </form>
      </div>
    </div>
  );
}
