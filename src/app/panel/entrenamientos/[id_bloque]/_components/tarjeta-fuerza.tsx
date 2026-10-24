"use client";

// Ejercicio con progresión de fuerza en la pantalla de entrenamiento del
// alumno: primero las series de aproximación (objetivo del plan de su
// coach para esta semana) y después las series efectivas, bien
// diferenciadas, con el 1RM usado, el % programado y la carga final en kg
// (el alumno nunca hace cuentas).
// Los inputs no son controlados: el formulario padre los lee por `name`
// y los guarda/restaura en la sesión en curso (lib/sesion-en-curso.ts).

export type DatosFuerza = {
  semana: number;
  nombreSemana: string;
  rm: number | null;
  efectiva: { porcentaje: number | null; peso: number | null; fija: boolean; reps: string; series: number };
  descanso: string | null;
  tempo: string | null;
  aproximaciones: { reps: string; porcentaje: number | null; peso: number | null }[];
  alumnoEdita: boolean;
};

/** Sufijo del input de la serie efectiva N (la 1 conserva "ef" por compatibilidad). */
export function sufijoEfectiva(n: number): string {
  return n === 1 ? "ef" : `ef${n}`;
}

const inputClase =
  "min-w-0 flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";

export function TarjetaFuerza({
  id,
  nombre,
  fuerza,
  aproximaciones,
  completo,
  onAgregar,
  onQuitar,
  onAlternarCompletado,
  onVerVideo,
}: {
  id: string;
  nombre: string;
  fuerza: DatosFuerza;
  aproximaciones: number;
  completo: boolean;
  onAgregar: () => void;
  onQuitar: () => void;
  onAlternarCompletado: () => void;
  onVerVideo: () => void;
}) {
  const plan = fuerza.aproximaciones;
  const cambio = aproximaciones - plan.length;

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-primary-container uppercase mb-0.5">
            Progresión de fuerza · semana {fuerza.semana} de 4 · {fuerza.nombreSemana}
          </span>
          <button
            type="button"
            onClick={onVerVideo}
            className="font-[family-name:var(--font-sora)] text-base font-semibold text-primary-container underline underline-offset-2 decoration-primary-container/40 text-left"
          >
            {nombre}
          </button>
        </div>
        <button
          type="button"
          onClick={onAlternarCompletado}
          aria-label={completo ? "Marcar como no completado" : "Marcar como completado"}
          aria-pressed={completo}
          className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
            completo
              ? "bg-primary-container border-primary-container text-black"
              : "border-outline-variant text-transparent"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">check</span>
        </button>
      </div>

      {/* Aproximaciones */}
      <div className="flex flex-col gap-1.5">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
          Aproximaciones ({aproximaciones}
          {cambio !== 0 ? ` · plan ${plan.length}` : ""})
        </span>
        {aproximaciones === 0 && (
          <p className="text-xs text-on-surface-variant">Sin aproximaciones.</p>
        )}
        {Array.from({ length: aproximaciones }, (_, i) => {
          const n = i + 1;
          const p = plan[i];
          return (
            <div key={n} className="flex flex-col gap-0.5">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-on-surface-variant">
                Aprox. {n}
                {p
                  ? ` · ${p.reps || "—"} reps${p.porcentaje != null ? ` · ${p.porcentaje}%` : ""}${
                      p.peso != null ? ` (${p.peso} kg)` : ""
                    }`
                  : " · agregada por vos"}
              </span>
              <div className="flex items-center gap-2">
                <input
                  name={`peso_${id}_${n}`}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder={p?.peso != null ? `${p.peso} kg` : "Peso (kg)"}
                  className={inputClase}
                />
                <input
                  name={`reps_${id}_${n}`}
                  type="number"
                  inputMode="numeric"
                  placeholder={p?.reps ? `${p.reps} reps` : "Reps"}
                  className={inputClase}
                />
              </div>
            </div>
          );
        })}
        {fuerza.alumnoEdita && (
          <div className="flex gap-3 mt-0.5">
            <button type="button" onClick={onAgregar} className="text-xs text-primary-container">
              + Aproximación
            </button>
            {aproximaciones > 0 && (
              <button type="button" onClick={onQuitar} className="text-xs text-on-surface-variant">
                − Aproximación
              </button>
            )}
          </div>
        )}
        {cambio !== 0 && (
          <p className="text-[11px] text-[#eda100]">
            Cambiaste la cantidad de aproximaciones: tu coach lo va a ver.
          </p>
        )}
      </div>

      {/* Series efectivas: diferenciadas y calculadas */}
      <div className="bg-primary-container/10 border border-primary-container/50 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[18px]">target</span>
            <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-on-surface">
              {fuerza.efectiva.series === 1 ? "Serie efectiva" : "Series efectivas"}
            </span>
          </span>
          <span className="font-[family-name:var(--font-sora)] text-lg font-bold text-primary-container tabular-nums">
            {fuerza.efectiva.peso !== null ? `${fuerza.efectiva.peso} kg` : "—"}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-on-surface-variant">1RM vigente</dt>
          <dd className="text-on-surface tabular-nums text-right">{fuerza.rm ? `${fuerza.rm} kg` : "Sin cargar"}</dd>
          <dt className="text-on-surface-variant">Intensidad programada</dt>
          <dd className="text-on-surface tabular-nums text-right">
            {fuerza.efectiva.porcentaje !== null ? `${fuerza.efectiva.porcentaje} %` : "Sin configurar"}
          </dd>
          <dt className="text-on-surface-variant">Series × reps</dt>
          <dd className="text-on-surface tabular-nums text-right">
            {fuerza.efectiva.series} × {fuerza.efectiva.reps}
          </dd>
          {fuerza.descanso && (
            <>
              <dt className="text-on-surface-variant">Descanso</dt>
              <dd className="text-on-surface text-right">{fuerza.descanso}</dd>
            </>
          )}
          {fuerza.tempo && (
            <>
              <dt className="text-on-surface-variant">Tempo</dt>
              <dd className="text-on-surface text-right">{fuerza.tempo}</dd>
            </>
          )}
        </dl>
        {fuerza.efectiva.fija && (
          <p className="text-[11px] text-on-surface-variant">Carga indicada por tu coach para esta semana.</p>
        )}
        {fuerza.efectiva.peso === null && (
          <p className="text-[11px] text-[#eda100]">
            {fuerza.efectiva.porcentaje === null
              ? "Tu coach todavía no configuró la intensidad de esta semana."
              : "Tu coach todavía no cargó tu 1RM: consultale la carga a usar."}
          </p>
        )}
        {Array.from({ length: fuerza.efectiva.series }, (_, i) => {
          const sufijo = sufijoEfectiva(i + 1);
          return (
            <div key={sufijo} className="flex items-center gap-2">
              {fuerza.efectiva.series > 1 && (
                <span className="w-6 shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-on-surface-variant">
                  {i + 1}
                </span>
              )}
              <input
                name={`peso_${id}_${sufijo}`}
                type="number"
                step="0.01"
                inputMode="decimal"
                aria-label={`Carga real utilizada, serie efectiva ${i + 1}`}
                placeholder={fuerza.efectiva.peso !== null ? `${fuerza.efectiva.peso} kg` : "Peso (kg)"}
                className={inputClase}
              />
              <input
                name={`reps_${id}_${sufijo}`}
                type="number"
                inputMode="numeric"
                aria-label={`Repeticiones, serie efectiva ${i + 1}`}
                placeholder={`${fuerza.efectiva.reps} reps`}
                className={inputClase}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input name={`rpe_${id}`} type="number" step="0.5" min={1} max={10} placeholder="RPE (1-10)" className={inputClase} />
        <input name={`descanso_${id}`} type="number" placeholder="Descanso (seg)" className={inputClase} />
        <input name={`tut_${id}`} type="number" placeholder="TUT (seg)" className={inputClase} />
      </div>
      <input name={`comentario_${id}`} type="text" placeholder="Comentario (opcional)" className={inputClase} />
    </div>
  );
}
