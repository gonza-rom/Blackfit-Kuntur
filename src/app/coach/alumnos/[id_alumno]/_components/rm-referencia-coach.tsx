"use client";

import { useActionState } from "react";
import { actualizarRmReferencia } from "@/app/actions/coach";
import { NOMBRE_LEVANTAMIENTO, type Levantamiento } from "@/lib/progresion-fuerza";

export type RmSerializado = {
  levantamiento: Levantamiento;
  vigente: { valor: number; fechaLabel: string } | null;
  historial: { id_rm: string; valor: number; fechaLabel: string }[];
};

const CAMPO: Record<Levantamiento, string> = {
  sentadilla: "rm_sentadilla",
  press_banca: "rm_press_banca",
  peso_muerto: "rm_peso_muerto",
};

// 1RM de referencia de los 3 levantamientos de la progresión de fuerza.
// Actualizarlo es la "actualización autorizada": agrega un registro nuevo
// (el historial queda) y todas las cargas futuras se recalculan.
export function RmReferenciaCoach({ idAlumno, rms }: { idAlumno: string; rms: RmSerializado[] }) {
  const [state, action, pending] = useActionState(actualizarRmReferencia, undefined);

  return (
    <form action={action} className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
      <input type="hidden" name="id_alumno" value={idAlumno} />
      <div>
        <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
          1RM de referencia
        </h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Base de la serie efectiva en la progresión de fuerza. Al cambiarlo se recalculan las cargas
          futuras; los entrenamientos ya hechos no cambian.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rms.map((r) => (
          <div key={r.levantamiento} className="flex flex-col gap-1">
            <label
              htmlFor={CAMPO[r.levantamiento]}
              className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase"
            >
              {NOMBRE_LEVANTAMIENTO[r.levantamiento]} (kg)
            </label>
            <input
              id={CAMPO[r.levantamiento]}
              name={CAMPO[r.levantamiento]}
              type="number"
              min={1}
              max={500}
              step="0.5"
              inputMode="decimal"
              defaultValue={r.vigente?.valor ?? ""}
              placeholder="Sin cargar"
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
            />
            <span className="text-[11px] text-on-surface-variant">
              {r.vigente ? `Vigente desde el ${r.vigente.fechaLabel}` : "Todavía no se cargó"}
            </span>
            {r.historial.length > 1 && (
              <details className="text-[11px] text-on-surface-variant">
                <summary className="cursor-pointer select-none">Historial</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {r.historial.map((h) => (
                    <li key={h.id_rm} className="flex justify-between tabular-nums">
                      <span>{h.fechaLabel}</span>
                      <span className="text-on-surface">{h.valor} kg</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
      {state?.message && <p className="text-sm text-primary-container">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Actualizar 1RM"}
      </button>
    </form>
  );
}
