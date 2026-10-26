"use client";

import { useState } from "react";
import {
  INTENSIDAD_SEMANA,
  MAX_APROXIMACIONES,
  NOMBRE_LEVANTAMIENTO,
  NOMBRE_SEMANA,
  cargaDe1RM,
  derivarPorcentajes,
  objetivoEfectiva,
  porcentajeEnRango,
  type Levantamiento,
  type Semana,
} from "@/lib/progresion-fuerza";

// Aproximación tal como la edita el coach (texto, para inputs controlados).
export type AproximacionEditor = { reps: string; porcentaje: string };
export type AproximacionesEditor = Partial<Record<string, AproximacionEditor[]>>;
// % de la serie efectiva y carga fija por semana, como texto ("1": "92.5").
export type ValoresPorSemanaEditor = Partial<Record<string, string>>;

const input =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 w-full";
const etiqueta =
  "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase";

function aNumero(texto: string | undefined): number {
  const limpio = String(texto ?? "").trim().replace(",", ".");
  return limpio === "" ? NaN : Number(limpio);
}

/** ¿El % de esta semana está cargado y dentro del rango? */
export function porcentajeValido(valores: ValoresPorSemanaEditor | undefined, semana: Semana): boolean {
  return porcentajeEnRango(semana, aNumero(valores?.[String(semana)]));
}

// Configuración de la progresión de fuerza de un ejercicio del plan. Por
// cada semana del día: el % EXACTO de la serie efectiva (dentro del rango
// de la semana, obligatorio), una carga fija opcional que pisa al cálculo,
// y las aproximaciones previas. La carga se calcula sola con el 1RM.
export function ConfigProgresionFuerza({
  levantamiento,
  rm,
  paso,
  semanas,
  seriesEfectiva,
  repeticionesEfectiva,
  porcentajes,
  cargasFijas,
  aproximaciones,
  alumnoEdita,
  onCambiarPorcentajes,
  onCambiarCargasFijas,
  onCambiarAproximaciones,
  onCambiarAlumnoEdita,
  replicarDesdeSemana1 = false,
}: {
  levantamiento: Levantamiento;
  rm: number | null;
  paso: number;
  semanas: Semana[];
  seriesEfectiva: string;
  repeticionesEfectiva: string;
  porcentajes: ValoresPorSemanaEditor;
  cargasFijas: ValoresPorSemanaEditor;
  aproximaciones: AproximacionesEditor;
  alumnoEdita: boolean;
  onCambiarPorcentajes: (valor: ValoresPorSemanaEditor) => void;
  onCambiarCargasFijas: (valor: ValoresPorSemanaEditor) => void;
  onCambiarAproximaciones: (valor: AproximacionesEditor) => void;
  onCambiarAlumnoEdita: (valor: boolean) => void;
  // Progresión semanal: se configura la semana 1 y las 2, 3 y 4 la repiten
  // (los % se completan solos manteniendo la posición en el rango).
  replicarDesdeSemana1?: boolean;
}) {
  const [semana, setSemana] = useState<Semana>(semanas[0] ?? 1);
  const replica = replicarDesdeSemana1 && semanas.includes(1);
  // Una semana sin aproximaciones propias repite las de la semana 1.
  const heredaAproximaciones = replica && semana !== 1 && aproximaciones[String(semana)] === undefined;
  const lista = aproximaciones[String(semana)] ?? (heredaAproximaciones ? aproximaciones["1"] : undefined) ?? [];
  const [min, max] = INTENSIDAD_SEMANA[semana];
  const pctTexto = porcentajes[String(semana)] ?? "";
  const pctOk = porcentajeValido(porcentajes, semana);
  const efectiva = objetivoEfectiva(semana, rm, { porcentajes, cargasFijas }, paso);
  const faltantes = semanas.filter((s) => !porcentajeValido(porcentajes, s));

  function cambiarLista(nueva: AproximacionEditor[]) {
    onCambiarAproximaciones({ ...aproximaciones, [String(semana)]: nueva });
  }

  // Vuelve a repetir las aproximaciones de la semana 1 en esta semana.
  function igualarASemana1() {
    const copia = { ...aproximaciones };
    delete copia[String(semana)];
    onCambiarAproximaciones(copia);
  }

  function cambiarPorcentaje(valor: string) {
    const nuevos: ValoresPorSemanaEditor = { ...porcentajes, [String(semana)]: valor };
    // Al cargar el % de la semana 1, las semanas 2–4 vacías se completan solas.
    if (replica && semana === 1) {
      const derivados = derivarPorcentajes(aNumero(valor));
      if (derivados) {
        for (const s of ["2", "3", "4"] as const) {
          if (semanas.includes(Number(s) as Semana) && !String(nuevos[s] ?? "").trim()) nuevos[s] = String(derivados[s]);
        }
      }
    }
    onCambiarPorcentajes(nuevos);
  }

  // Recalcula las semanas 2–4 desde la semana 1 (pisa lo que tuvieran).
  function regenerarDesdeSemana1() {
    const derivados = derivarPorcentajes(aNumero(porcentajes["1"]));
    if (!derivados) return;
    onCambiarPorcentajes({
      ...porcentajes,
      "2": String(derivados["2"]),
      "3": String(derivados["3"]),
      "4": String(derivados["4"]),
    });
  }

  function copiarATodas() {
    const copia: AproximacionesEditor = {};
    for (const s of semanas) copia[String(s)] = lista.map((a) => ({ ...a }));
    onCambiarAproximaciones(copia);
  }

  return (
    <div className="border border-primary-container/30 rounded-lg p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={etiqueta}>Progresión semanal · {NOMBRE_LEVANTAMIENTO[levantamiento]}</span>
        <span className="text-xs text-on-surface-variant">
          1RM vigente:{" "}
          {rm ? <span className="text-on-surface tabular-nums">{rm} kg</span> : <span className="text-[#eda100]">sin cargar</span>}
        </span>
      </div>

      {semanas.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1" role="tablist">
          {semanas.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === semana}
              onClick={() => setSemana(s)}
              className={`rounded-full px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.04em] uppercase border ${
                s === semana
                  ? "border-primary-container text-primary-container bg-primary-container/10"
                  : porcentajeValido(porcentajes, s)
                    ? "border-[#262626] text-on-surface-variant"
                    : "border-[#eda100]/60 text-[#eda100]"
              }`}
            >
              S{s} · {INTENSIDAD_SEMANA[s][0]}–{INTENSIDAD_SEMANA[s][1]}%
            </button>
          ))}
        </div>
      )}

      {/* Serie efectiva de la semana */}
      <div className="bg-primary-container/10 border border-primary-container/50 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[18px]">target</span>
            <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-on-surface">
              Semana {semana} — {NOMBRE_SEMANA[semana]} ({min}–{max} %)
            </span>
          </span>
          <span className="text-sm text-on-surface tabular-nums">
            {seriesEfectiva || "—"} × {repeticionesEfectiva || "—"} ·{" "}
            {efectiva.peso !== null ? `${efectiva.peso} kg` : "sin carga"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={etiqueta}>% del 1RM (obligatorio)</span>
            <input
              type="number"
              min={min}
              max={max}
              step="0.5"
              inputMode="decimal"
              value={pctTexto}
              onChange={(e) => cambiarPorcentaje(e.target.value)}
              placeholder={`${min}–${max}`}
              aria-invalid={!pctOk}
              className={`${input} ${pctOk ? "" : "border-[#eda100]/60"}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiqueta}>Carga fija (kg, opcional)</span>
            <input
              type="number"
              min={0.5}
              max={500}
              step="0.5"
              inputMode="decimal"
              value={cargasFijas[String(semana)] ?? ""}
              onChange={(e) => onCambiarCargasFijas({ ...cargasFijas, [String(semana)]: e.target.value })}
              placeholder={rm ? "Calculada con el 1RM" : "Sin 1RM: cargala acá"}
              className={input}
            />
          </label>
        </div>
        {!pctOk && (
          <p className="text-[11px] text-[#eda100]">
            {pctTexto.trim() === ""
              ? `Completá el % de la semana ${semana} (entre ${min} y ${max}).`
              : `El % de la semana ${semana} tiene que estar entre ${min} y ${max}.`}
          </p>
        )}
        {pctOk && efectiva.peso === null && (
          <p className="text-[11px] text-[#eda100]">
            Falta el 1RM de {NOMBRE_LEVANTAMIENTO[levantamiento]}: cargalo o indicá una carga fija.
          </p>
        )}
        {efectiva.fija && (
          <p className="text-[11px] text-on-surface-variant">
            Carga fija: no se recalcula cuando cambie el 1RM.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={etiqueta}>
          Aproximaciones · semana {semana} ({lista.length})
        </span>
        {heredaAproximaciones && (
          <p className="text-xs text-on-surface-variant">
            Iguales a la semana 1. Si cambiás algo acá, esta semana pasa a tener las suyas.
          </p>
        )}
        {replica && semana !== 1 && !heredaAproximaciones && (
          <button type="button" onClick={igualarASemana1} className="self-start text-xs text-on-surface-variant underline">
            Volver a usar las de la semana 1
          </button>
        )}
        {lista.length === 0 && (
          <p className="text-xs text-on-surface-variant">Sin aproximaciones esta semana.</p>
        )}
        {lista.map((a, i) => {
          const pct = aNumero(a.porcentaje);
          const kg = rm && pct > 0 && pct <= 100 ? cargaDe1RM(rm, pct, paso) : null;
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
          {semanas.length > 1 && lista.length > 0 && !replica && (
            <button type="button" onClick={copiarATodas} className="text-xs text-on-surface-variant">
              Copiar a todas las semanas
            </button>
          )}
        </div>
      </div>

      {replica && semana === 1 && porcentajeValido(porcentajes, 1) && (
        <button type="button" onClick={regenerarDesdeSemana1} className="self-start text-xs text-primary-container">
          Recalcular los % de las semanas 2, 3 y 4 desde la semana 1
        </button>
      )}

      <p className="text-[11px] text-on-surface-variant">
        Ciclo de 4 semanas que se repite: Pesada 90–95 · Deload 60–65 · Intermedia 70–75 · Preparación 80–85.
        La carga = 1RM × % y se redondea a {paso} kg; se recalcula sola cuando cambia el 1RM.
        {faltantes.length > 0 && (
          <span className="text-[#eda100]"> Falta el % de: semana {faltantes.join(", ")}.</span>
        )}
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
