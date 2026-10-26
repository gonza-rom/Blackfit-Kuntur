"use client";

import { useActionState, useState } from "react";
import { actualizarRmReferencia, resolverPropuestaRm } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";
import { NOMBRE_LEVANTAMIENTO, cargaDe1RM, type Levantamiento } from "@/lib/progresion-fuerza";
import type { CargaAfectada } from "@/lib/rm-referencia";

export type RmSerializado = {
  levantamiento: Levantamiento;
  vigente: { valor: number; fechaLabel: string; fuente: string } | null;
  historial: {
    id_rm: string;
    valor: number;
    anterior: number | null;
    fuente: string;
    estado: string;
    origen: string;
    serie: string | null;
    fechaLabel: string;
  }[];
};

export type RecordSerializado = {
  id: string;
  levantamiento: Levantamiento;
  tipo: string;
  peso: number;
  reps: number;
  anterior: number | null;
  origen: string;
  fechaLabel: string;
};

const ORIGEN: Record<string, string> = {
  coach: "coach",
  entrenamiento: "auto · entrenamiento",
  alumno: "auto · marca del alumno",
};

export type PropuestaRm = { id_rm: string; levantamiento: Levantamiento; valor: number; fuente: string; fechaLabel: string };

const CAMPO: Record<Levantamiento, string> = {
  sentadilla: "rm_sentadilla",
  press_banca: "rm_press_banca",
  peso_muerto: "rm_peso_muerto",
};

const etiqueta =
  "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase";

// 1RM de referencia de los 3 levantamientos de la progresión de fuerza.
// Actualizarlo es la "actualización autorizada": agrega un registro nuevo
// (el historial queda) y las cargas futuras se recalculan. Antes de
// guardar se ve qué cargas del bloque publicado cambian, y hay que
// confirmarlo. Las propuestas del alumno se validan o rechazan acá.
export function RmReferenciaCoach({
  idAlumno,
  rms,
  afectadas,
  propuestas,
  records,
  paso,
}: {
  idAlumno: string;
  rms: RmSerializado[];
  afectadas: Record<Levantamiento, CargaAfectada[]>;
  propuestas: PropuestaRm[];
  records: RecordSerializado[];
  paso: number;
}) {
  const [state, action, pending] = useActionState(actualizarRmReferencia, undefined);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(rms.map((r) => [r.levantamiento, r.vigente ? String(r.vigente.valor) : ""]))
  );

  // Cambios con impacto en el bloque publicado (cargas que no son fijas).
  const cambios = rms.flatMap((r) => {
    const nuevo = Number(String(valores[r.levantamiento] ?? "").replace(",", "."));
    if (!(nuevo > 0) || nuevo === r.vigente?.valor) return [];
    const filas = afectadas[r.levantamiento].flatMap((a) =>
      a.semanas
        .filter((s) => s.porcentaje !== null || s.cargaFija !== null)
        .map((s) => ({
          clave: `${a.sesion}-${a.ejercicio}-${s.semana}`,
          texto: `${a.sesion} · ${a.ejercicio} · S${s.semana}${s.porcentaje !== null ? ` (${s.porcentaje} %)` : ""}`,
          antes:
            s.cargaFija ?? (s.porcentaje !== null && r.vigente ? cargaDe1RM(r.vigente.valor, s.porcentaje, paso) : null),
          despues: s.cargaFija ?? (s.porcentaje !== null ? cargaDe1RM(nuevo, s.porcentaje, paso) : null),
          fija: s.cargaFija !== null,
        }))
    );
    return filas.length ? [{ levantamiento: r.levantamiento, filas }] : [];
  });
  const requiereConfirmar = cambios.some((c) => c.filas.some((f) => !f.fija));

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className={etiqueta.replace("text-[10px]", "text-[11px]")}>1RM de referencia</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Base de la carga automática en la Progresión semanal. Se actualiza solo cuando el alumno registra
          una serie que lo supera (1 rep = real; 2 a 10 = estimado). También podés corregirlo a mano. Al
          cambiar, se recalculan las cargas futuras; lo ya entrenado y las cargas fijas no cambian.
        </p>
      </div>

      {propuestas.length > 0 && (
        <div className="border border-[#eda100]/40 bg-[#eda100]/5 rounded-lg p-3 flex flex-col gap-2">
          <span className={`${etiqueta} text-[#eda100]`}>Propuestas del alumno</span>
          {propuestas.map((p) => (
            <div key={p.id_rm} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-on-surface">
                {NOMBRE_LEVANTAMIENTO[p.levantamiento]}: <b className="tabular-nums">{p.valor} kg</b>
                <span className="text-on-surface-variant"> · {p.fuente} · {p.fechaLabel}</span>
              </span>
              <span className="flex gap-2">
                <ConfirmForm
                  action={resolverPropuestaRm}
                  titulo="Validar 1RM"
                  mensaje={`¿Validar ${p.valor} kg como 1RM de ${NOMBRE_LEVANTAMIENTO[p.levantamiento]}? Las cargas futuras que dependen de él se recalculan.`}
                  confirmLabel="Validar"
                  variante="positiva"
                >
                  <input type="hidden" name="id_rm" value={p.id_rm} />
                  <input type="hidden" name="decision" value="validar" />
                  <button type="submit" className="text-xs font-bold text-primary-container">
                    Validar
                  </button>
                </ConfirmForm>
                <ConfirmForm
                  action={resolverPropuestaRm}
                  titulo="Rechazar propuesta"
                  mensaje="¿Rechazar este 1RM propuesto? Queda en el historial como rechazado."
                  confirmLabel="Rechazar"
                >
                  <input type="hidden" name="id_rm" value={p.id_rm} />
                  <input type="hidden" name="decision" value="rechazar" />
                  <button type="submit" className="text-xs text-on-surface-variant">
                    Rechazar
                  </button>
                </ConfirmForm>
              </span>
            </div>
          ))}
        </div>
      )}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id_alumno" value={idAlumno} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rms.map((r) => (
            <div key={r.levantamiento} className="flex flex-col gap-1">
              <label htmlFor={CAMPO[r.levantamiento]} className={etiqueta}>
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
                value={valores[r.levantamiento] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [r.levantamiento]: e.target.value }))}
                placeholder="Sin cargar"
                className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
              />
              <select
                name={`fuente_${CAMPO[r.levantamiento]}`}
                defaultValue={r.vigente?.fuente ?? "medido"}
                aria-label={`Fuente del 1RM de ${NOMBRE_LEVANTAMIENTO[r.levantamiento]}`}
                className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
              >
                <option value="medido">RM medido</option>
                <option value="estimado">RM estimado</option>
              </select>
              <span className="text-[11px] text-on-surface-variant">
                {r.vigente
                  ? `Vigente desde el ${r.vigente.fechaLabel} · ${r.vigente.fuente}`
                  : "Todavía no se cargó"}
              </span>
              {r.historial.length > 0 && (
                <details className="text-[11px] text-on-surface-variant">
                  <summary className="cursor-pointer select-none">Historial ({r.historial.length})</summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {r.historial.map((h) => (
                      <li key={h.id_rm} className="flex justify-between gap-2 tabular-nums">
                        <span>
                          {h.fechaLabel} · {h.fuente} · {ORIGEN[h.origen] ?? h.origen}
                          {h.serie ? ` (${h.serie})` : ""}
                          {h.estado !== "validado" ? ` · ${h.estado}` : ""}
                        </span>
                        <span className="text-on-surface">
                          {h.anterior !== null ? `${h.anterior} → ` : ""}
                          {h.valor} kg
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>

        {cambios.length > 0 && (
          <div className="border border-primary-container/40 rounded-lg p-3 flex flex-col gap-2">
            <span className={etiqueta}>Cargas del bloque publicado que cambian</span>
            {cambios.map((c) => (
              <div key={c.levantamiento} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-on-surface">{NOMBRE_LEVANTAMIENTO[c.levantamiento]}</span>
                <ul className="flex flex-col gap-0.5">
                  {c.filas.map((f) => (
                    <li key={f.clave} className="flex justify-between gap-2 text-xs tabular-nums">
                      <span className="text-on-surface-variant min-w-0 truncate">{f.texto}</span>
                      <span className={f.fija ? "text-on-surface-variant" : "text-on-surface"}>
                        {f.fija
                          ? `${f.antes} kg (fija, no cambia)`
                          : `${f.antes ?? "—"} → ${f.despues ?? "—"} kg`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {requiereConfirmar && (
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  name="confirmar_recalculo"
                  required
                  className="accent-[var(--color-primary-container)]"
                />
                Confirmo el recálculo de las cargas futuras
              </label>
            )}
          </div>
        )}

        {records.length > 0 && (
          <details className="text-xs text-on-surface-variant">
            <summary className="cursor-pointer select-none">Récords personales ({records.length})</summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {records.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 tabular-nums">
                  <span>
                    {r.fechaLabel} · {NOMBRE_LEVANTAMIENTO[r.levantamiento]} ·{" "}
                    {r.tipo === "carga" ? "PR de carga" : "PR de repeticiones"} · {ORIGEN[r.origen] ?? r.origen}
                  </span>
                  <span className="text-on-surface">
                    {r.peso} kg × {r.reps}
                    {r.anterior !== null
                      ? r.tipo === "carga"
                        ? ` (antes ${r.anterior} kg)`
                        : ` (antes ${r.anterior} reps)`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

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
    </div>
  );
}
