// ------------------------------------------------------------
// RÉCORDS PERSONALES Y 1RM AUTOMÁTICO — lógica pura (sin Prisma).
//
// Solo cuentan series REALMENTE registradas: con peso y repeticiones
// cargados por el alumno (nunca la carga planificada, nunca una serie
// incompleta). Cada levantamiento se evalúa por separado.
//
// - PR de carga: más peso que cualquier serie anterior.
// - PR de repeticiones: más repeticiones que nunca con ese peso o más
//   (sin ser PR de carga).
// - 1RM: una serie de 1 repetición es un 1RM MEDIDO (real). De 2 a 10
//   repeticiones se estima con Epley (peso × (1 + reps / 30)), redondeado
//   hacia abajo a 0,5 kg, y se guarda como ESTIMADO. Más de 10 reps no
//   estima (la fórmula deja de ser confiable). El 1RM vigente solo sube:
//   se actualiza cuando la serie supera al vigente.
// ------------------------------------------------------------

export type SerieReal = { peso: number; reps: number };

export const MAX_REPS_ESTIMACION = 10;
export const PESO_MAX_KG = 500;
export const REPS_MAX = 50;

/** Serie que cuenta para récords: peso y repeticiones reales y razonables. */
export function serieValida(peso: number | null | undefined, reps: number | null | undefined): boolean {
  return (
    typeof peso === "number" &&
    typeof reps === "number" &&
    Number.isFinite(peso) &&
    peso > 0 &&
    peso <= PESO_MAX_KG &&
    Number.isInteger(reps) &&
    reps >= 1 &&
    reps <= REPS_MAX
  );
}

/** 1RM a partir de una serie: medido (1 rep), estimado (2–10) o null. */
export function rmDeSerie(s: SerieReal): { valor: number; fuente: "medido" | "estimado" } | null {
  if (!serieValida(s.peso, s.reps)) return null;
  if (s.reps === 1) return { valor: s.peso, fuente: "medido" };
  if (s.reps > MAX_REPS_ESTIMACION) return null;
  return { valor: Math.floor(s.peso * (1 + s.reps / 30) * 2) / 2, fuente: "estimado" };
}

export type RecordDetectado = { peso: number; reps: number; anterior: number | null; indice: number };
export type RmDetectado = {
  valor: number;
  fuente: "medido" | "estimado";
  peso: number;
  reps: number;
  anterior: number | null;
  indice: number;
};

export type ResultadoRecords = {
  prCarga: RecordDetectado | null;
  prRepeticiones: RecordDetectado | null;
  nuevoRm: RmDetectado | null;
};

/**
 * Récords de UN levantamiento en una sesión (o marca), comparando las
 * series nuevas contra las anteriores y contra el 1RM vigente. `indice`
 * apunta a la serie de `nuevas` que originó cada récord.
 */
export function detectarRecords(
  previas: SerieReal[],
  nuevas: SerieReal[],
  rmVigente: number | null
): ResultadoRecords {
  const validasPrevias = previas.filter((s) => serieValida(s.peso, s.reps));
  const validas = nuevas
    .map((s, indice) => ({ ...s, indice }))
    .filter((s) => serieValida(s.peso, s.reps));
  if (validas.length === 0) return { prCarga: null, prRepeticiones: null, nuevoRm: null };

  // PR de carga: la serie más pesada (a igual peso, la de más reps).
  const maxPrevio = validasPrevias.length ? Math.max(...validasPrevias.map((s) => s.peso)) : null;
  const masPesada = [...validas].sort((a, b) => b.peso - a.peso || b.reps - a.reps)[0];
  const prCarga =
    maxPrevio === null || masPesada.peso > maxPrevio
      ? { peso: masPesada.peso, reps: masPesada.reps, anterior: maxPrevio, indice: masPesada.indice }
      : null;

  // PR de repeticiones: más reps que nunca con ese peso o más. Solo si ya
  // había series con ese peso o más (si no, es la primera vez, no una mejora).
  let prRepeticiones: RecordDetectado | null = null;
  for (const s of [...validas].sort((a, b) => b.peso - a.peso || b.reps - a.reps)) {
    if (prCarga && s.indice === prCarga.indice) continue;
    const conIgualOMas = validasPrevias.filter((p) => p.peso >= s.peso);
    if (conIgualOMas.length === 0) continue;
    const mejorReps = Math.max(...conIgualOMas.map((p) => p.reps));
    if (s.reps > mejorReps) {
      prRepeticiones = { peso: s.peso, reps: s.reps, anterior: mejorReps, indice: s.indice };
      break;
    }
  }

  // 1RM: el mejor de la sesión (a igual valor, gana el medido).
  let nuevoRm: RmDetectado | null = null;
  for (const s of validas) {
    const rm = rmDeSerie(s);
    if (!rm) continue;
    if (
      !nuevoRm ||
      rm.valor > nuevoRm.valor ||
      (rm.valor === nuevoRm.valor && rm.fuente === "medido" && nuevoRm.fuente === "estimado")
    ) {
      nuevoRm = { ...rm, peso: s.peso, reps: s.reps, anterior: rmVigente, indice: s.indice };
    }
  }
  if (nuevoRm && rmVigente !== null && nuevoRm.valor <= rmVigente) nuevoRm = null;

  return { prCarga, prRepeticiones, nuevoRm };
}
