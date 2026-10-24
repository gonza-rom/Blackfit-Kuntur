"use client";

import { useActionState } from "react";
import { proponerRm } from "@/app/actions/alumno";
import { NOMBRE_LEVANTAMIENTO, type Levantamiento } from "@/lib/progresion-fuerza";

export type MiRm = {
  levantamiento: Levantamiento;
  vigente: number | null;
  propuesto: number | null;
};

const campo =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 w-full";

// Los 1RM con los que se calculan tus cargas, y un formulario para
// proponerle uno nuevo a tu coach (no rige hasta que lo valida).
export function MisRm({ rms }: { rms: MiRm[] }) {
  const [state, action, pending] = useActionState(proponerRm, undefined);

  return (
    <details className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
      <summary className="cursor-pointer select-none font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
        Mis 1RM
      </summary>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {rms.map((r) => (
          <li key={r.levantamiento} className="flex flex-wrap justify-between gap-2">
            <span className="text-on-surface">{NOMBRE_LEVANTAMIENTO[r.levantamiento]}</span>
            <span className="tabular-nums text-on-surface">
              {r.vigente !== null ? `${r.vigente} kg` : <span className="text-on-surface-variant">Sin cargar</span>}
              {r.propuesto !== null && (
                <span className="text-[#eda100]"> · propuesto {r.propuesto} kg (pendiente)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form action={action} className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select name="levantamiento" required defaultValue="" aria-label="Levantamiento" className={`col-span-2 sm:col-span-1 ${campo}`}>
          <option value="" disabled>
            Levantamiento
          </option>
          {rms.map((r) => (
            <option key={r.levantamiento} value={r.levantamiento}>
              {NOMBRE_LEVANTAMIENTO[r.levantamiento]}
            </option>
          ))}
        </select>
        <input
          name="valor_kg"
          type="number"
          min={1}
          max={500}
          step="0.5"
          inputMode="decimal"
          required
          placeholder="1RM (kg)"
          aria-label="1RM en kilogramos"
          className={campo}
        />
        <select name="fuente" defaultValue="medido" aria-label="Fuente" className={campo}>
          <option value="medido">Medido</option>
          <option value="estimado">Estimado</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 sm:col-span-1 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold rounded p-2.5 disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Proponer"}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-on-surface-variant">
        Tu coach revisa y valida el 1RM antes de usarlo para calcular tus cargas.
      </p>
      {state?.error && <p className="mt-1 text-sm text-[#ffb4ab]">{state.error}</p>}
      {state?.message && <p className="mt-1 text-sm text-primary-container">{state.message}</p>}
    </details>
  );
}
