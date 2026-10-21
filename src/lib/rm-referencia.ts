import { prisma } from "@/lib/prisma";
import type { Levantamiento } from "@/lib/progresion-fuerza";

export type RmVigente = { valor: number; fecha: Date } | null;
export type RmVigentes = Record<Levantamiento, RmVigente>;

const LEVANTAMIENTOS: Levantamiento[] = ["sentadilla", "press_banca", "peso_muerto"];

/**
 * 1RM de referencia vigente (el más reciente) de cada levantamiento. Es la
 * única fuente para calcular la carga de la serie efectiva: como la carga
 * se calcula al mostrar el plan, actualizar el 1RM recalcula todas las
 * cargas futuras, y los entrenamientos ya hechos no cambian (guardan su
 * propio objetivo en cada serie).
 */
export async function obtenerRmVigentes(id_alumno: string): Promise<RmVigentes> {
  const filas = await prisma.rmReferencia.findMany({
    where: { id_alumno },
    orderBy: { fecha: "desc" },
    distinct: ["levantamiento"],
    select: { levantamiento: true, valor_kg: true, fecha: true },
  });
  const salida = Object.fromEntries(LEVANTAMIENTOS.map((l) => [l, null])) as RmVigentes;
  for (const f of filas) salida[f.levantamiento] = { valor: Number(f.valor_kg), fecha: f.fecha };
  return salida;
}

export async function obtenerHistorialRm(id_alumno: string, porLevantamiento = 5) {
  const filas = await prisma.rmReferencia.findMany({
    where: { id_alumno },
    orderBy: { fecha: "desc" },
    take: porLevantamiento * LEVANTAMIENTOS.length,
    select: { id_rm: true, levantamiento: true, valor_kg: true, fecha: true },
  });
  return filas.map((f) => ({ ...f, valor_kg: Number(f.valor_kg) }));
}
