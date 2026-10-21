// ------------------------------------------------------------
// PLANIFICACIÓN POR SESIONES SECUENCIALES
//
// Un plan se arma con sesiones numeradas — Día 1, Día 2, ... — dentro de
// cada rango de semanas del bloque de 4 (ej. semanas 1-4 si la rutina es
// fija, o una por semana). "Día N" es el ORDEN de la sesión, no un día
// del calendario: el alumno hace la siguiente sesión pendiente el día
// que entrene. Descansar nunca salta una sesión ni cuenta como ausencia.
//
// El avance sale solo del historial real: con C sesiones completadas, la
// siguiente es la número C+1 recorriendo semana 1 (sus días en orden),
// después semana 2, etc. La semana del bloque (y con ella la intensidad
// de la progresión de fuerza) avanza al completar las sesiones de la
// semana, NO porque pase el calendario.
//
// Lógica pura (sin Prisma): la usan Inicio/Entrenar del alumno, el panel
// del coach y el servidor al guardar.
// ------------------------------------------------------------

import type { Semana } from "./progresion-fuerza";

export const MAX_DIAS_SESION = 7;

export type DiaPlan = {
  id_bloque: string;
  numero_dia: number | null;
  semana_inicio: number | null;
  semana_fin: number | null;
  // Un día sin ejercicios no es una sesión (se saltea en la secuencia).
  cantidadEjercicios: number;
};

export function esPlanSecuencial(bloques: { numero_dia: number | null }[]): boolean {
  return bloques.some((b) => b.numero_dia != null);
}

/** Sesiones de una semana del bloque, en orden (Día 1, Día 2, ...). */
export function sesionesDeSemana<B extends DiaPlan>(bloques: B[], semana: number): B[] {
  return bloques
    .filter(
      (b) =>
        b.numero_dia != null &&
        b.cantidadEjercicios > 0 &&
        (b.semana_inicio ?? 1) <= semana &&
        (b.semana_fin ?? 4) >= semana
    )
    .sort((a, b) => (a.numero_dia ?? 0) - (b.numero_dia ?? 0));
}

export type Posicion<B> =
  | { completo: false; semana: Semana; bloque: B; indiceEnSemana: number; sesionesSemana: number }
  | { completo: true };

/** Siguiente sesión pendiente según cuántas sesiones del plan ya completó. */
export function posicionSecuencia<B extends DiaPlan>(bloques: B[], completadas: number): Posicion<B> {
  let restantes = Math.max(0, completadas);
  for (const semana of [1, 2, 3, 4] as Semana[]) {
    const sesiones = sesionesDeSemana(bloques, semana);
    if (sesiones.length === 0) continue;
    if (restantes < sesiones.length) {
      return {
        completo: false,
        semana,
        bloque: sesiones[restantes],
        indiceEnSemana: restantes,
        sesionesSemana: sesiones.length,
      };
    }
    restantes -= sesiones.length;
  }
  return { completo: true };
}

/**
 * Semana del bloque a la que corresponde hacer ESTA sesión ahora: la de
 * la posición actual si la sesión es de esa semana; si el bloque ya se
 * completó, la última semana que cubre la sesión; si el alumno abrió una
 * sesión de otra semana, la primera semana que cubre.
 */
export function semanaParaSesion<B extends DiaPlan>(bloques: B[], completadas: number, bloque: B): Semana {
  const pos = posicionSecuencia(bloques, completadas);
  const desde = Math.max(1, Math.min(4, bloque.semana_inicio ?? 1));
  const hasta = Math.max(desde, Math.min(4, bloque.semana_fin ?? 4));
  if (pos.completo) return hasta as Semana;
  if (pos.semana >= desde && pos.semana <= hasta) return pos.semana;
  return desde as Semana;
}

// "Día 3" o un día de la semana (los entrenamientos viejos se guardaron con
// "Lunes", "Martes"...): no son un nombre propio de la sesión.
const NOMBRE_POR_DEFECTO = /^(d[ií]a\s*\d+|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i;

/** "Día 2 — Tren superior", o solo "Día 2" si la sesión no tiene nombre propio. */
export function etiquetaSesion(numeroDia: number | null | undefined, nombre: string | null | undefined): string {
  const limpio = nombre?.trim() ?? "";
  if (numeroDia == null) return limpio || "Entrenamiento";
  return limpio && !NOMBRE_POR_DEFECTO.test(limpio) ? `Día ${numeroDia} — ${limpio}` : `Día ${numeroDia}`;
}

/** Nombre propio de la sesión (sin el "Día N" por defecto), para el editor. */
export function nombrePropioSesion(nombre: string | null | undefined): string {
  const limpio = nombre?.trim() ?? "";
  return NOMBRE_POR_DEFECTO.test(limpio) ? "" : limpio;
}
