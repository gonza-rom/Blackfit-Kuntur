"use client";

// Ejercicio con progresión de fuerza en la pantalla de entrenamiento del
// alumno: primero las series de aproximación (objetivo del plan de su
// coach para esta semana) y después la serie efectiva, bien diferenciada,
// con el % fijo de la semana y la carga calculada con su 1RM.
// Los inputs no son controlados: el formulario padre los lee por `name`
// y los guarda/restaura en la sesión en curso (lib/sesion-en-curso.ts).

export type DatosFuerza = {
  semana: number;
  rm: number | null;
  efectiva: { porcentaje: string; peso: string | null; reps: string };
  aproximaciones: { reps: string; porcentaje: number | null; peso: number | null }[];
  alumnoEdita: boolean;
};

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
            Progresión de fuerza · semana {fuerza.semana}
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

      {/* Serie efectiva: diferenciada y calculada */}
      <div className="bg-primary-container/10 border border-primary-container/50 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[18px]">target</span>
            <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-on-surface">
              Serie efectiva
            </span>
          </span>
          <span className="text-sm text-on-surface tabular-nums">
            {fuerza.efectiva.porcentaje}%
            {fuerza.efectiva.peso ? ` · ${fuerza.efectiva.peso} kg` : ""} · {fuerza.efectiva.reps} reps
          </span>
        </div>
        {!fuerza.rm && (
          <p className="text-[11px] text-on-surface-variant">
            Tu coach todavía no cargó tu 1RM: usá el % como guía.
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            name={`peso_${id}_ef`}
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder={fuerza.efectiva.peso ? `${fuerza.efectiva.peso} kg` : "Peso (kg)"}
            className={inputClase}
          />
          <input
            name={`reps_${id}_ef`}
            type="number"
            inputMode="numeric"
            placeholder={`${fuerza.efectiva.reps} reps`}
            className={inputClase}
          />
        </div>
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
