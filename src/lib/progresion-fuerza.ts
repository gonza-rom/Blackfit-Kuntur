// ------------------------------------------------------------
// PROGRESIÓN DE FUERZA — metodología fija de Black Hub.
//
// Bloque de 4 semanas con intensidad FIJA para la serie efectiva:
//   Semana 1: 70–75% · Semana 2: 80–85% · Semana 3: 90–95% · Semana 4: 60–65% (deload)
// Estos rangos no se editan desde ninguna pantalla: viven solo acá.
//
// Carga efectiva = 1RM de referencia vigente × % de la semana.
// Lo único configurable (coach, y alumno si tiene permiso) son las series
// de aproximación previas: cantidad, repeticiones y % del 1RM de cada una.
// La cantidad de aproximaciones nunca cambia el % de la serie efectiva.
//
// Solo aplica a los 3 levantamientos del sistema de PR: sentadilla con
// barra, press de banca plano con barra y peso muerto convencional.
//
// Lógica pura (sin Prisma): la usan el editor del coach, la pantalla de
// entrenamiento del alumno y el servidor al guardar.
// ------------------------------------------------------------

export type Levantamiento = "sentadilla" | "press_banca" | "peso_muerto";
export type Semana = 1 | 2 | 3 | 4;

export const INTENSIDAD_SEMANA: Readonly<Record<Semana, readonly [number, number]>> = Object.freeze({
  1: Object.freeze([70, 75] as const),
  2: Object.freeze([80, 85] as const),
  3: Object.freeze([90, 95] as const),
  4: Object.freeze([60, 65] as const),
});

export const SEMANAS: readonly Semana[] = [1, 2, 3, 4];

export const NOMBRE_LEVANTAMIENTO: Record<Levantamiento, string> = {
  sentadilla: "Sentadilla con barra",
  press_banca: "Press de banca plano con barra",
  peso_muerto: "Peso muerto convencional",
};

const PATRONES: { levantamiento: Levantamiento; si: RegExp; no: RegExp }[] = [
  {
    levantamiento: "sentadilla",
    si: /sentadilla|back squat|\bsquat\b/i,
    no: /b[uú]lgar|goblet|copa|hack|smith|frontal|front|sumo|pistol|split|zancada|mancuern|dumbbell|kettlebell|pesa rusa|m[aá]quina|sissy|caj[oó]n|box|zercher|overhead|landmine|isom[eé]tric|salto|jump|pared|wall/i,
  },
  {
    levantamiento: "press_banca",
    si: /press.*banca|bench press|press plano/i,
    no: /inclinad|declinad|incline|decline|mancuern|dumbbell|smith|m[aá]quina|cerrad|close grip|spoto|floor|suelo|unilateral|kettlebell/i,
  },
  {
    levantamiento: "peso_muerto",
    si: /peso muerto|deadlift/i,
    no: /rumano|\brdl\b|romanian|sumo|piernas r[ií]gidas|stiff|mancuern|dumbbell|trap|hexagonal|d[eé]ficit|deficit|rack pull|bloque|una pierna|unilateral|kettlebell|pesa rusa|single leg/i,
  },
];

/** El levantamiento del sistema de PR/progresión que corresponde al ejercicio, o null. */
export function detectarLevantamiento(nombreEjercicio: string): Levantamiento | null {
  for (const p of PATRONES) {
    if (p.si.test(nombreEjercicio) && !p.no.test(nombreEjercicio)) return p.levantamiento;
  }
  return null;
}

/** Semana 1..4 del bloque según la fecha de inicio del programa (después de la 4 se queda en 4). */
export function semanaDelPrograma(fechaInicio: Date, ahora: Date = new Date()): Semana {
  const semanas = Math.floor((ahora.getTime() - fechaInicio.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(4, Math.max(1, semanas)) as Semana;
}

/** Redondeo a 0,5 kg (lo mínimo que se puede cargar con discos fraccionales). */
export function redondearCarga(kg: number): number {
  return Math.round(kg * 2) / 2;
}

export function cargaDe1RM(rm: number, porcentaje: number): number {
  return redondearCarga((rm * porcentaje) / 100);
}

/** Texto "80–85" del % de la serie efectiva de una semana. */
export function textoIntensidad(semana: Semana): string {
  const [min, max] = INTENSIDAD_SEMANA[semana];
  return `${min}–${max}`;
}

/** Objetivo de la serie efectiva: % fijo de la semana y su carga si hay 1RM. */
export function objetivoEfectiva(semana: Semana, rm: number | null) {
  const [min, max] = INTENSIDAD_SEMANA[semana];
  return {
    porcentaje: `${min}–${max}`,
    pesoMin: rm ? cargaDe1RM(rm, min) : null,
    pesoMax: rm ? cargaDe1RM(rm, max) : null,
    peso: rm ? `${cargaDe1RM(rm, min)}–${cargaDe1RM(rm, max)}` : null,
  };
}

// ------------------------------------------------------------
// Aproximaciones
// ------------------------------------------------------------

export type Aproximacion = { reps: string; porcentaje: number | null };
export type AproximacionesPorSemana = Partial<Record<`${Semana}`, Aproximacion[]>>;

export const MAX_APROXIMACIONES = 20;

/**
 * Normaliza lo que llega del editor (o de la base) a una estructura
 * válida: solo semanas 1..4, a lo sumo 20 aproximaciones por semana, reps
 * como texto corto y % entre 1 y 100 (o vacío).
 */
export function normalizarAproximaciones(crudo: unknown, semanasPermitidas?: Semana[]): AproximacionesPorSemana {
  const salida: AproximacionesPorSemana = {};
  if (!crudo || typeof crudo !== "object") return salida;
  for (const semana of semanasPermitidas ?? SEMANAS) {
    const lista = (crudo as Record<string, unknown>)[String(semana)];
    if (!Array.isArray(lista)) continue;
    salida[`${semana}`] = lista.slice(0, MAX_APROXIMACIONES).map((a) => {
      const x = (a ?? {}) as { reps?: unknown; porcentaje?: unknown };
      const pct = Number(String(x.porcentaje ?? "").replace(",", "."));
      return {
        reps: String(x.reps ?? "").trim().slice(0, 10),
        porcentaje: String(x.porcentaje ?? "").trim() !== "" && pct > 0 && pct <= 100 ? pct : null,
      };
    });
  }
  return salida;
}

export function aproximacionesDeSemana(config: unknown, semana: Semana): Aproximacion[] {
  return normalizarAproximaciones(config)[`${semana}`] ?? [];
}
