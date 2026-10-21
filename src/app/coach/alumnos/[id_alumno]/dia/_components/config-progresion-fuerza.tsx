"use client";

import { useState } from "react";
import {
  INTENSIDAD_SEMANA,
  MAX_APROXIMACIONES,
  NOMBRE_LEVANTAMIENTO,
  cargaDe1RM,
  objetivoEfectiva,
  type Levantamiento,
  type Semana,
} from "@/lib/progresion-fuerza";

// Aproximación tal como la edita el coach (texto, para inputs controlados).
export type AproximacionEditor = { reps: string; porcentaje: string };
export type AproximacionesEditor = Partial<Record<string, AproximacionEditor[]>>;

const input =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 w-full";
const etiqueta =
  "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase";

// Configuración de la progresión de fuerza de un ejercicio del plan. La
// serie efectiva se muestra pero NO se edita: su % es el fijo de la semana
// y su carga sale del 1RM de referencia. Lo editable son las
// aproximaciones de cada semana (cantidad, reps y % del 1RM).
export function ConfigProgresionFuerza({
  levantamiento,
  rm,
  semanas,
  repeticionesEfectiva,
  aproximaciones,
  alumnoEdita,
  onCambiarAproximaciones,
  onCambiarAlumnoEdita,
}: {
  levantamiento: Levantamiento;
  rm: number | null;
  semanas: Semana[];
  repeticionesEfectiva: string;
  aproximaciones: AproximacionesEditor;
  alumnoEdita: boolean;
  onCambiarAproximaciones: (valor: AproximacionesEditor) => void;
  onCambiarAlumnoEdita: (valor: boolean) => void;
}) {
  const [semana, setSemana] = useState<Semana>(semanas[0] ?? 1);
  const lista = aproximaciones[String(semana)] ?? [];
  const efectiva = objetivoEfectiva(semana, rm);

  function cambiarLista(nueva: AproximacionEditor[]) {
    onCambiarAproximaciones({ ...aproximaciones, [String(semana)]: nueva });
  }

  function copiarATodas() {
    const copia: AproximacionesEditor = {};
    for (const s of semanas) copia[String(s)] = lista.map((a) => ({ ...a }));
    onCambiarAproximaciones(copia);
  }

  return (
    <div className="border border-primary-container/30 rounded-lg p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={etiqueta}>Progresión de fuerza · {NOMBRE_LEVANTAMIENTO[levantamiento]}</span>
        <span className="text-xs text-on-surface-variant">
          1RM de referencia:{" "}
          {rm ? <span className="text-on-surface tabular-nums">{rm} kg</span> : <span className="text-[#eda100]">sin cargar</span>}
        </span>
      </div>

      {semanas.length > 1 && (
        <div className="flex gap-1" role="tablist">
          {semanas.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === semana}
              onClick={() => setSemana(s)}
              className={`flex-1 rounded-full px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase border ${
                s === semana
                  ? "border-primary-container text-primary-container bg-primary-container/10"
                  : "border-[#262626] text-on-surface-variant"
              }`}
            >
              S{s} · {INTENSIDAD_SEMANA[s][0]}–{INTENSIDAD_SEMANA[s][1]}%
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className={etiqueta}>
          Aproximaciones · semana {semana} ({lista.length})
        </span>
        {lista.length === 0 && (
          <p className="text-xs text-on-surface-variant">Sin aproximaciones esta semana.</p>
        )}
        {lista.map((a, i) => {
          const pct = Number(a.porcentaje.replace(",", "."));
          const kg = rm && pct > 0 && pct <= 100 ? cargaDe1RM(rm, pct) : null;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-on-surface-variant">
                Aprox. {i + 1}
              </span>
              <input
                type="text"
                value={a.reps}
                onChange={(e) => cambiarLista(lista.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
                placeholder="Reps"
                aria-label={`Repeticiones de la aproximación ${i + 1}`}
                className={input}
              />
              <input
                type="number"
                min={1}
                max={100}
                step="0.5"
                value={a.porcentaje}
                onChange={(e) =>
                  cambiarLista(lista.map((x, j) => (j === i ? { ...x, porcentaje: e.target.value } : x)))
                }
                placeholder="% 1RM"
                aria-label={`Porcentaje del 1RM de la aproximación ${i + 1}`}
                className={input}
              />
              <span className="w-16 shrink-0 text-xs text-on-surface-variant tabular-nums text-right">
                {kg !== null ? `${kg} kg` : "—"}
              </span>
              <button
                type="button"
                onClick={() => cambiarLista(lista.filter((_, j) => j !== i))}
                aria-label={`Quitar aproximación ${i + 1}`}
                className="p-1 text-on-surface-variant hover:text-[#ffb4ab]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={lista.length >= MAX_APROXIMACIONES}
            onClick={() => cambiarLista([...lista, { reps: lista.at(-1)?.reps ?? "", porcentaje: "" }])}
            className="text-xs text-primary-container disabled:opacity-40"
          >
            + Aproximación
          </button>
          {semanas.length > 1 && lista.length > 0 && (
            <button type="button" onClick={copiarATodas} className="text-xs text-on-surface-variant">
              Copiar a todas las semanas
            </button>
          )}
        </div>
      </div>

      {/* Serie efectiva: solo lectura, calculada. */}
      <div className="bg-primary-container/10 border border-primary-container/50 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-[18px]">target</span>
          <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-on-surface">Serie efectiva</span>
        </span>
        <span className="text-sm text-on-surface tabular-nums">
          {efectiva.porcentaje}% · {efectiva.peso ? `${efectiva.peso} kg` : "cargá el 1RM"} ·{" "}
          {repeticionesEfectiva || "—"} reps
        </span>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        El % de la serie efectiva es fijo por semana (70–75 · 80–85 · 90–95 · 60–65 deload) y la carga se
        recalcula sola cuando cambia el 1RM.
      </p>

      <label className="flex items-center gap-2 text-sm text-on-surface">
        <input
          type="checkbox"
          checked={alumnoEdita}
          onChange={(e) => onCambiarAlumnoEdita(e.target.checked)}
          className="accent-[var(--color-primary-container)]"
        />
        El alumno puede cambiar la cantidad de aproximaciones
      </label>
    </div>
  );
}
