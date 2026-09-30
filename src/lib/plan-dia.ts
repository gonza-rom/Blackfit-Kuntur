// Lógica pura (sin Prisma ni nada server-only) para armar la estructura de
// un día de entrenamiento: ejercicios individuales y bloques (superseries,
// triseries, circuitos). La usan por igual el editor del coach, la vista
// del alumno y las pantallas de programa, así el coach y el alumno ven
// SIEMPRE la misma estructura — nunca se "aplana" un bloque en una lista.

export type TipoBloque = "individual" | "superserie" | "triserie" | "circuito";

/** 1 ejercicio = individual, 2 = superserie, 3 = triserie, 4 o más = circuito. Sin límite. */
export function tipoDeBloque(cantidadEjercicios: number): TipoBloque {
  if (cantidadEjercicios <= 1) return "individual";
  if (cantidadEjercicios === 2) return "superserie";
  if (cantidadEjercicios === 3) return "triserie";
  return "circuito";
}

export const ETIQUETA_TIPO_BLOQUE: Record<TipoBloque, string> = {
  individual: "Ejercicio individual",
  superserie: "Superserie",
  triserie: "Triserie",
  circuito: "Circuito",
};

/** "Bloque A", "Bloque B"... — por posición entre los bloques del día (no entre los ejercicios sueltos). */
export function nombreAutomaticoBloque(indiceEntreBloques: number): string {
  let n = indiceEntreBloques;
  let letras = "";
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Bloque ${letras}`;
}

export function nombreDeBloque(nombre: string | null | undefined, indiceEntreBloques: number): string {
  const limpio = nombre?.trim();
  return limpio ? limpio : nombreAutomaticoBloque(indiceEntreBloques);
}

type ConGrupo = { id_grupo: string | null };

export type ItemDia<E extends ConGrupo, G> =
  | { tipo: "ejercicio"; ejercicio: E }
  | { tipo: "grupo"; grupo: G; ejercicios: E[]; indiceBloque: number };

/**
 * Convierte la lista plana de ejercicios de un día (ya ordenada por
 * `orden`) en items: ejercicios sueltos y bloques. Cada bloque aparece
 * donde está su primer ejercicio, con todos sus ejercicios juntos en el
 * orden guardado — aunque algún editor viejo los haya dejado no
 * contiguos, el bloque nunca se parte en dos.
 */
export function agruparItemsDia<E extends ConGrupo, G extends { id_grupo: string }>(
  ejercicios: E[],
  grupos: G[]
): ItemDia<E, G>[] {
  const grupoPorId = new Map(grupos.map((g) => [g.id_grupo, g]));
  const items: ItemDia<E, G>[] = [];
  const itemDeGrupo = new Map<string, Extract<ItemDia<E, G>, { tipo: "grupo" }>>();
  let indiceBloque = 0;

  for (const ejercicio of ejercicios) {
    const grupo = ejercicio.id_grupo ? grupoPorId.get(ejercicio.id_grupo) : undefined;
    if (!grupo) {
      items.push({ tipo: "ejercicio", ejercicio });
      continue;
    }
    const existente = itemDeGrupo.get(grupo.id_grupo);
    if (existente) {
      existente.ejercicios.push(ejercicio);
    } else {
      const nuevo = { tipo: "grupo" as const, grupo, ejercicios: [ejercicio], indiceBloque: indiceBloque++ };
      itemDeGrupo.set(grupo.id_grupo, nuevo);
      items.push(nuevo);
    }
  }
  return items;
}

/** Texto corto de peso sugerido: "80 kg" o "Peso corporal" si no hay. */
export function textoPesoSugerido(peso: string | number | null | undefined): string {
  if (peso === null || peso === undefined || peso === "") return "Peso corporal";
  return `${peso} kg`;
}

/** "5 ejercicios · 2 bloques" — resumen de un día para tarjetas y listas. */
export function resumenDia(ejercicios: ConGrupo[]): string {
  const bloques = new Set(ejercicios.map((e) => e.id_grupo).filter(Boolean)).size;
  const texto = `${ejercicios.length} ${ejercicios.length === 1 ? "ejercicio" : "ejercicios"}`;
  return bloques > 0 ? `${texto} · ${bloques} ${bloques === 1 ? "bloque" : "bloques"}` : texto;
}
