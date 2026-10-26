"use client";

import { useActionState, useRef } from "react";
import { registrarMarca } from "@/app/actions/alumno";
import type { EstadoAlumno } from "@/app/actions/alumno";
import { NOMBRE_LEVANTAMIENTO, type Levantamiento } from "@/lib/progresion-fuerza";

export type MiRm = {
  levantamiento: Levantamiento;
  // 1RM con el que se calculan tus cargas.
  vigente: { valor: number; fuente: string; fechaLabel: string } | null;
  // Mayor peso levantado (PR de carga) y último PR de repeticiones.
  prCarga: { peso: number; reps: number; fechaLabel: string } | null;
  prRepeticiones: { peso: number; reps: number; fechaLabel: string } | null;
};

const campo =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 w-full";

// Tus 1RM y récords de sentadilla, banca y peso muerto. Se actualizan solos
// con lo que registrás al entrenar; también podés registrar una marca
// (un test) desde acá, sin depender de tu coach.
export function MisRm({ rms }: { rms: MiRm[] }) {
  // Una clave por marca: si el mismo envío llega dos veces, no se cuenta de nuevo.
  const clave = useRef<string | null>(null);
  const [state, action, pending] = useActionState(async (prev: EstadoAlumno, formData: FormData) => {
    clave.current ??= crypto.randomUUID();
    formData.set("clave_operacion", clave.current);
    const r = await registrarMarca(prev, formData);
    if (!r?.error) clave.current = null;
    return r;
  }, undefined);

  return (
    <details className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
      <summary className="cursor-pointer select-none font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
        Mis 1RM y récords
      </summary>
      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {rms.map((r) => (
          <li key={r.levantamiento} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-on-surface font-semibold">{NOMBRE_LEVANTAMIENTO[r.levantamiento]}</span>
              <span className="tabular-nums text-on-surface">
                {r.vigente ? (
                  <>
                    1RM {r.vigente.valor} kg{" "}
                    <span className={r.vigente.fuente === "estimado" ? "text-[#eda100]" : "text-primary-container"}>
                      ({r.vigente.fuente === "estimado" ? "estimado" : "real"})
                    </span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">1RM sin registrar</span>
                )}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {r.prCarga ? `PR de carga: ${r.prCarga.peso} kg × ${r.prCarga.reps} (${r.prCarga.fechaLabel})` : "Sin PR de carga"}
              {r.prRepeticiones
                ? ` · PR de reps: ${r.prRepeticiones.reps} × ${r.prRepeticiones.peso} kg (${r.prRepeticiones.fechaLabel})`
                : ""}
            </span>
          </li>
        ))}
      </ul>

      <form action={action} className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select
          name="levantamiento"
          required
          defaultValue=""
          aria-label="Levantamiento"
          className={`col-span-2 sm:col-span-1 ${campo}`}
        >
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
          name="peso_kg"
          type="number"
          min={0.5}
          max={500}
          step="0.5"
          inputMode="decimal"
          required
          placeholder="Peso (kg)"
          aria-label="Peso levantado en kilogramos"
          className={campo}
        />
        <input
          name="repeticiones"
          type="number"
          min={1}
          max={50}
          step={1}
          inputMode="numeric"
          required
          placeholder="Reps"
          aria-label="Repeticiones realizadas"
          className={campo}
        />
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 sm:col-span-1 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold rounded p-2.5 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Registrar marca"}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-on-surface-variant">
        Registrá solo lo que levantaste de verdad. Con 1 repetición es tu 1RM real; con 2 a 10 se estima
        (fórmula de Epley) y queda marcado como estimado. Si supera tu 1RM actual, tus próximas cargas se
        recalculan solas. También se detecta solo cuando cargás tus series al entrenar.
      </p>
      {state?.error && <p className="mt-1 text-sm text-[#ffb4ab]">{state.error}</p>}
      {state?.message && <p className="mt-1 text-sm text-primary-container">{state.message}</p>}
    </details>
  );
}
