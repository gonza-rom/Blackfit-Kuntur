// ------------------------------------------------------------
// PROGRESIÓN DE FUERZA — modalidad "Progresión semanal" de Black Hub.
//
// Ciclo de 4 semanas que se repite mientras el plan siga vigente. Cada
// semana tiene un RANGO de intensidad para la serie efectiva:
//   Semana 1 — Pesada:      90–95 % del 1RM vigente
//   Semana 2 — Deload:      60–65 %
//   Semana 3 — Intermedia:  70–75 %
//   Semana 4 — Preparación: 80–85 %
// El % EXACTO de cada ejercicio y semana lo fija el coach dentro de ese
// rango (EjercicioPrograma.porcentajes_semana). Nunca se inventa: si falta,
// el plan no se puede guardar.
//
// Carga objetivo = 1RM vigente × % programado, redondeada según los
// discos del gimnasio (Entrenador.redondeo_carga_kg). El coach puede fijar
// una carga a mano para una semana (cargas_fijas): pisa al cálculo, sirve
// cuando falta el 1RM y no se recalcula cuando el 1RM cambia.
//
// Solo aplica a los 3 levantamientos con 1RM de referencia: sentadilla con
// barra, press de banca plano con barra y peso muerto convencional. Cada
// uno usa SU propio 1RM (nunca el de otro levantamiento).
//
// Lógica pura (sin Prisma): la usan el editor del coach, la pantalla de
// entrenamiento del alumno y el servidor al guardar.
// ------------------------------------------------------------

export type Levantamiento = "sentadilla" | "press_banca" | "peso_muerto";
export type Semana = 1 | 2 | 3 | 4;

export const INTENSIDAD_SEMANA: Readonly<Record<Semana, readonly [number, number]>> = Object.freeze({
  1: Object.freeze([90, 95] as const),
  2: Object.freeze([60, 65] as const),
  3: Object.freeze([70, 75] as const),
  4: Object.freeze([80, 85] as const),
});

export const NOMBRE_SEMANA: Readonly<Record<Semana, string>> = Object.freeze({
  1: "Pesada",
  2: "Deload",
  3: "Intermedia",
  4: "Preparación",
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

/**
 * ¿El tipo de planificación admite cargas por 1RM? "Rutina fija" nunca
 * (la misma rutina las 4 semanas, cargas que pone el coach). "Progresión
 * semanal" sí, y "Personalizada" solo en los ejercicios donde el coach la
 * activó expresamente (EjercicioPrograma.progresion_fuerza).
 */
export function progresionHabilitada(tipoPlanificacion: string): boolean {
  return tipoPlanificacion !== "fija";
}

// ------------------------------------------------------------
// Semana del ciclo (por calendario, desde el inicio del bloque)
// ------------------------------------------------------------

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Posición en el ciclo según el inicio del bloque: días 0–6 → semana 1,
 * 7–13 → 2, 14–20 → 3, 21–27 → 4, 28–34 → semana 1 del ciclo 2, etc.
 * Con el programa pausado, el ciclo se congela en la fecha de la pausa.
 */
export function posicionCiclo(
  fechaInicio: Date,
  ahora: Date = new Date(),
  fechaPausa: Date | null = null
): { semana: Semana; ciclo: number; inicioSemana: Date; finSemana: Date } {
  const referencia = fechaPausa && fechaPausa.getTime() < ahora.getTime() ? fechaPausa : ahora;
  const transcurridas = Math.max(0, Math.floor((referencia.getTime() - fechaInicio.getTime()) / SEMANA_MS));
  const inicioSemana = new Date(fechaInicio.getTime() + transcurridas * SEMANA_MS);
  return {
    semana: ((transcurridas % 4) + 1) as Semana,
    ciclo: Math.floor(transcurridas / 4) + 1,
    inicioSemana,
    finSemana: new Date(inicioSemana.getTime() + SEMANA_MS),
  };
}

/** Semana 1..4 del ciclo según la fecha de inicio (después de la 4 vuelve a la 1). */
export function semanaDelPrograma(fechaInicio: Date, ahora: Date = new Date()): Semana {
  return posicionCiclo(fechaInicio, ahora).semana;
}

// ------------------------------------------------------------
// Cargas
// ------------------------------------------------------------

export const PASOS_REDONDEO = [0.5, 1, 1.25, 2, 2.5, 5] as const;
export const REDONDEO_POR_DEFECTO = 0.5;

/** Redondeo al múltiplo de `paso` kg más cercano (según los discos disponibles). */
export function redondearCarga(kg: number, paso: number = REDONDEO_POR_DEFECTO): number {
  const p = paso > 0 ? paso : REDONDEO_POR_DEFECTO;
  return Math.round(Math.round(kg / p) * p * 100) / 100;
}

export function cargaDe1RM(rm: number, porcentaje: number, paso: number = REDONDEO_POR_DEFECTO): number {
  return redondearCarga((rm * porcentaje) / 100, paso);
}

/** Texto "90–95" del rango de intensidad de una semana. */
export function textoIntensidad(semana: Semana): string {
  const [min, max] = INTENSIDAD_SEMANA[semana];
  return `${min}–${max}`;
}

export function porcentajeEnRango(semana: Semana, pct: number): boolean {
  const [min, max] = INTENSIDAD_SEMANA[semana];
  return Number.isFinite(pct) && pct >= min && pct <= max;
}

export type PorcentajesPorSemana = Partial<Record<`${Semana}`, number>>;
export type CargasPorSemana = Partial<Record<`${Semana}`, number>>;

function numero(valor: unknown): number {
  const crudo = String(valor ?? "").trim().replace(",", ".");
  return crudo === "" ? NaN : Number(crudo);
}

/** % por semana válidos (dentro del rango de cada semana); el resto se descarta. */
export function normalizarPorcentajes(crudo: unknown, semanasPermitidas?: readonly Semana[]): PorcentajesPorSemana {
  const salida: PorcentajesPorSemana = {};
  if (!crudo || typeof crudo !== "object") return salida;
  for (const semana of semanasPermitidas ?? SEMANAS) {
    const pct = numero((crudo as Record<string, unknown>)[String(semana)]);
    if (porcentajeEnRango(semana, pct)) salida[`${semana}`] = Math.round(pct * 100) / 100;
  }
  return salida;
}

/** Cargas fijadas a mano por semana (kg entre 0,5 y 500); el resto se descarta. */
export function normalizarCargasFijas(crudo: unknown, semanasPermitidas?: readonly Semana[]): CargasPorSemana {
  const salida: CargasPorSemana = {};
  if (!crudo || typeof crudo !== "object") return salida;
  for (const semana of semanasPermitidas ?? SEMANAS) {
    const kg = numero((crudo as Record<string, unknown>)[String(semana)]);
    if (Number.isFinite(kg) && kg >= 0.5 && kg <= 500) salida[`${semana}`] = Math.round(kg * 100) / 100;
  }
  return salida;
}

/**
 * Semanas a las que les falta el % (o lo tienen fuera de rango).
 * Vacío = la configuración está completa y se puede publicar.
 */
export function semanasSinPorcentaje(crudo: unknown, semanas: readonly Semana[]): Semana[] {
  const validos = normalizarPorcentajes(crudo, semanas);
  return semanas.filter((s) => validos[`${s}`] === undefined);
}

export type ObjetivoEfectiva = {
  // % programado por el coach para esta semana (null = sin configurar).
  porcentaje: number | null;
  // Carga objetivo en kg (null = no se puede calcular: falta % o 1RM).
  peso: number | null;
  // true = carga fijada a mano por el coach (no depende del 1RM).
  fija: boolean;
};

/** Objetivo de la serie efectiva de una semana: % del coach y carga con el 1RM (o la fija). */
export function objetivoEfectiva(
  semana: Semana,
  rm: number | null,
  config: { porcentajes: unknown; cargasFijas: unknown },
  paso: number = REDONDEO_POR_DEFECTO
): ObjetivoEfectiva {
  const porcentaje = normalizarPorcentajes(config.porcentajes, [semana])[`${semana}`] ?? null;
  const fija = normalizarCargasFijas(config.cargasFijas, [semana])[`${semana}`] ?? null;
  if (fija !== null) return { porcentaje, peso: fija, fija: true };
  return { porcentaje, peso: porcentaje !== null && rm ? cargaDe1RM(rm, porcentaje, paso) : null, fija: false };
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
export function normalizarAproximaciones(crudo: unknown, semanasPermitidas?: readonly Semana[]): AproximacionesPorSemana {
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
