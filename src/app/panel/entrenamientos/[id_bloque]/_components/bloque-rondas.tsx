"use client";

import { ETIQUETA_TIPO_BLOQUE, nombreDeBloque, textoPesoSugerido, tipoDeBloque } from "@/lib/plan-dia";
import type { EjercicioDetalle } from "./modal-video-ejercicio";

export type GrupoPlan = {
  id_grupo: string;
  nombre: string | null;
  rondas: number;
  descanso_entre_ejercicios: string | null;
  descanso_entre_rondas: string | null;
  tempo: string | null;
  nota: string | null;
};

export type EjercicioDeBloque = {
  id_ejercicio_programa: string;
  repeticiones: string;
  peso_sugerido: string | null;
  nota: string | null;
  ejercicio: EjercicioDetalle;
};

/** Clave de un check: ejercicio + ronda. */
export function claveCheck(idEjercicioPrograma: string, ronda: number) {
  return `${idEjercicioPrograma}_${ronda}`;
}

export function rondasCompletas(
  ejercicios: { id_ejercicio_programa: string }[],
  rondas: number,
  checks: Set<string>
): number {
  let completas = 0;
  for (let n = 1; n <= rondas; n++) {
    if (ejercicios.every((ep) => checks.has(claveCheck(ep.id_ejercicio_programa, n)))) completas++;
  }
  return completas;
}

// Bloque (superserie/triserie/circuito) tal cual lo armó el coach: los
// ejercicios lado a lado, por ronda. Nunca se convierte en una lista
// vertical de ejercicios sueltos. Los inputs de TODAS las rondas se
// renderizan (las no activas quedan ocultas) para que el form los mande
// completos al finalizar — cada ejercicio de cada ronda es una serie
// propia (peso_{id}_{ronda} / reps_{id}_{ronda}).
export function BloqueRondas({
  grupo,
  ejercicios,
  indiceBloque,
  checks,
  rondaActiva,
  onCambiarRonda,
  onAlternarCheck,
  onVerVideo,
}: {
  grupo: GrupoPlan;
  ejercicios: EjercicioDeBloque[];
  indiceBloque: number;
  checks: Set<string>;
  rondaActiva: number;
  onCambiarRonda: (ronda: number) => void;
  onAlternarCheck: (idEjercicioPrograma: string, ronda: number) => void;
  onVerVideo: (ejercicio: EjercicioDetalle) => void;
}) {
  const tipo = tipoDeBloque(ejercicios.length);
  const hechas = rondasCompletas(ejercicios, grupo.rondas, checks);
  const completo = hechas === grupo.rondas;
  const muchos = ejercicios.length > 2;

  return (
    <section
      className={`bg-[#141414] border-2 rounded-xl overflow-hidden ${
        completo ? "border-primary-container" : "border-primary-container/30"
      }`}
    >
      <div className="bg-primary-container/10 px-4 py-2.5 flex items-center justify-between gap-2">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase text-primary-container truncate">
          {nombreDeBloque(grupo.nombre, indiceBloque)} · {ETIQUETA_TIPO_BLOQUE[tipo]}
        </p>
        <p
          className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] tabular-nums ${
            completo ? "text-primary-container" : "text-on-surface-variant"
          }`}
        >
          {completo ? "Bloque completado ✓" : `${hechas}/${grupo.rondas} rondas`}
        </p>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {(grupo.nota || grupo.tempo) && (
          <p className="text-xs text-on-surface-variant">
            {grupo.tempo ? `Tempo ${grupo.tempo}` : ""}
            {grupo.tempo && grupo.nota ? " · " : ""}
            {grupo.nota ?? ""}
          </p>
        )}

        {grupo.rondas > 1 && (
          <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Rondas">
            {Array.from({ length: grupo.rondas }, (_, i) => {
              const n = i + 1;
              const rondaHecha = ejercicios.every((ep) => checks.has(claveCheck(ep.id_ejercicio_programa, n)));
              return (
                <button
                  key={n}
                  type="button"
                  role="tab"
                  aria-selected={rondaActiva === n}
                  onClick={() => onCambiarRonda(n)}
                  className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                    rondaActiva === n
                      ? "border-primary-container bg-primary-container text-black"
                      : rondaHecha
                        ? "border-primary-container/60 text-primary-container"
                        : "border-[#333] text-on-surface-variant"
                  }`}
                >
                  Ronda {n}
                  {rondaHecha ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        )}

        {Array.from({ length: grupo.rondas }, (_, i) => {
          const n = i + 1;
          return (
            <div key={n} hidden={rondaActiva !== n}>
              <div
                className={`flex gap-2 ${muchos ? "overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1" : ""}`}
              >
                {ejercicios.map((ep, idx) => {
                  const hecho = checks.has(claveCheck(ep.id_ejercicio_programa, n));
                  return (
                    <div
                      key={ep.id_ejercicio_programa}
                      className={`${
                        muchos ? "w-[46%] min-w-[150px] max-w-[200px] shrink-0 snap-start" : "flex-1 min-w-0"
                      } bg-[#1A1A1A] border rounded-lg p-3 flex flex-col gap-2 transition-colors ${
                        hecho ? "border-primary-container/70" : "border-[#262626]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-on-surface-variant">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAlternarCheck(ep.id_ejercicio_programa, n)}
                          aria-label={hecho ? "Marcar como no hecho" : "Marcar como hecho"}
                          aria-pressed={hecho}
                          className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                            hecho
                              ? "bg-primary-container border-primary-container text-black"
                              : "border-outline-variant text-transparent"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onVerVideo(ep.ejercicio)}
                        className="font-[family-name:var(--font-sora)] text-sm font-semibold text-primary-container underline underline-offset-2 decoration-primary-container/40 text-left uppercase leading-tight"
                      >
                        {ep.ejercicio.nombre}
                      </button>
                      <p className="text-xs text-on-surface-variant leading-snug">
                        {ep.repeticiones} reps
                        <br />
                        {textoPesoSugerido(ep.peso_sugerido)}
                      </p>
                      {ep.nota && <p className="text-[11px] text-on-surface-variant italic">{ep.nota}</p>}
                      <input
                        name={`peso_${ep.id_ejercicio_programa}_${n}`}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Peso realizado"
                        aria-label={`Peso realizado ${ep.ejercicio.nombre} ronda ${n}`}
                        className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2"
                      />
                      <input
                        name={`reps_${ep.id_ejercicio_programa}_${n}`}
                        type="number"
                        inputMode="numeric"
                        placeholder="Reps reales"
                        aria-label={`Repeticiones reales ${ep.ejercicio.nombre} ronda ${n}`}
                        className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2"
                      />
                    </div>
                  );
                })}
              </div>
              {muchos && (
                <p className="text-[11px] text-on-surface-variant mt-1">Deslizá para ver todos los ejercicios →</p>
              )}
            </div>
          );
        })}

        {(grupo.descanso_entre_ejercicios || grupo.descanso_entre_rondas) && (
          <p className="text-xs text-on-surface-variant flex flex-wrap gap-x-3">
            {grupo.descanso_entre_ejercicios && <span>Descanso entre ejercicios: {grupo.descanso_entre_ejercicios}</span>}
            {grupo.descanso_entre_rondas && <span>Descanso entre rondas: {grupo.descanso_entre_rondas}</span>}
          </p>
        )}
      </div>
    </section>
  );
}
