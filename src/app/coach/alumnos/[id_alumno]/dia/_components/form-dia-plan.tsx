"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { guardarDiaPlan } from "@/app/actions/coach";

type EjercicioCatalogo = {
  id_ejercicio: string;
  nombre: string;
  series_default: number | null;
  repeticiones_default: string | null;
  peso_sugerido_default: string | null;
  tempo_default: string | null;
  descanso_default: string | null;
};

type Fila = {
  id_ejercicio: string;
  nombre: string;
  series: string;
  repeticiones: string;
  peso_sugerido: string;
  descanso: string;
  tempo: string;
  nota: string;
};

const inputClase =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 w-full";

function filaVacia(): Fila {
  return {
    id_ejercicio: "",
    nombre: "",
    series: "",
    repeticiones: "",
    peso_sugerido: "",
    descanso: "",
    tempo: "",
    nota: "",
  };
}

export function FormDiaPlan({
  idPrograma,
  idAlumno,
  semanaInicio,
  semanaFin,
  diaSemana,
  catalogo,
  ejerciciosIniciales,
}: {
  idPrograma: string;
  idAlumno: string;
  semanaInicio: number;
  semanaFin: number;
  diaSemana: string;
  catalogo: EjercicioCatalogo[];
  ejerciciosIniciales: Fila[];
}) {
  const [state, action, pending] = useActionState(guardarDiaPlan, undefined);
  const [filas, setFilas] = useState<Fila[]>(
    ejerciciosIniciales.length > 0 ? ejerciciosIniciales : [filaVacia()]
  );

  function actualizarFila(i: number, cambios: Partial<Fila>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)));
  }

  function alElegirEjercicio(i: number, idEjercicio: string) {
    const ejercicio = catalogo.find((e) => e.id_ejercicio === idEjercicio);
    actualizarFila(i, {
      id_ejercicio: idEjercicio,
      nombre: ejercicio?.nombre ?? "",
      series: filas[i].series || ejercicio?.series_default?.toString() || "",
      repeticiones: filas[i].repeticiones || ejercicio?.repeticiones_default || "",
      peso_sugerido: filas[i].peso_sugerido || ejercicio?.peso_sugerido_default || "",
      descanso: filas[i].descanso || ejercicio?.descanso_default || "",
      tempo: filas[i].tempo || ejercicio?.tempo_default || "",
    });
  }

  function agregarFila() {
    setFilas((prev) => [...prev, filaVacia()]);
  }

  function quitarFila(i: number) {
    setFilas((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id_programa" value={idPrograma} />
      <input type="hidden" name="semana_inicio" value={semanaInicio} />
      <input type="hidden" name="semana_fin" value={semanaFin} />
      <input type="hidden" name="dia_semana" value={diaSemana} />
      <input type="hidden" name="entradas" value={JSON.stringify(filas)} />

      {filas.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Día de descanso — sin ejercicios cargados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filas.map((fila, i) => (
            <div
              key={i}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <select
                  value={fila.id_ejercicio}
                  onChange={(e) => alElegirEjercicio(i, e.target.value)}
                  required
                  className={inputClase}
                >
                  <option value="" disabled>
                    Elegir ejercicio
                  </option>
                  {catalogo.map((e) => (
                    <option key={e.id_ejercicio} value={e.id_ejercicio}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => quitarFila(i)}
                  aria-label="Quitar ejercicio"
                  className="shrink-0 text-on-surface-variant hover:text-[#ffb4ab]"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="number"
                  min={1}
                  required
                  value={fila.series}
                  onChange={(e) => actualizarFila(i, { series: e.target.value })}
                  placeholder="Series"
                  className={inputClase}
                />
                <input
                  type="text"
                  required
                  value={fila.repeticiones}
                  onChange={(e) => actualizarFila(i, { repeticiones: e.target.value })}
                  placeholder="Reps (ej. 8-10)"
                  className={inputClase}
                />
                <input
                  type="number"
                  step="0.01"
                  value={fila.peso_sugerido}
                  onChange={(e) => actualizarFila(i, { peso_sugerido: e.target.value })}
                  placeholder="Peso sugerido"
                  className={inputClase}
                />
                <input
                  type="text"
                  value={fila.descanso}
                  onChange={(e) => actualizarFila(i, { descanso: e.target.value })}
                  placeholder="Descanso (ej. 90s)"
                  className={inputClase}
                />
                <input
                  type="text"
                  value={fila.tempo}
                  onChange={(e) => actualizarFila(i, { tempo: e.target.value })}
                  placeholder="Tempo (opcional)"
                  className={`col-span-2 ${inputClase}`}
                />
                <input
                  type="text"
                  value={fila.nota}
                  onChange={(e) => actualizarFila(i, { nota: e.target.value })}
                  placeholder="Nota (opcional)"
                  className={`col-span-2 ${inputClase}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={agregarFila}
        className="self-start flex items-center gap-1.5 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        Agregar ejercicio
      </button>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <Link
          href={`/coach/alumnos/${idAlumno}?tab=planificacion`}
          className="text-on-surface-variant text-sm"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
