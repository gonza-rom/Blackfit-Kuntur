import { prisma } from "@/lib/prisma";
import {
  REDONDEO_POR_DEFECTO,
  SEMANAS,
  detectarLevantamiento,
  normalizarCargasFijas,
  normalizarPorcentajes,
  progresionHabilitada,
  type Levantamiento,
  type Semana,
} from "@/lib/progresion-fuerza";

export type RmVigente = { valor: number; fecha: Date; fuente: string } | null;
export type RmVigentes = Record<Levantamiento, RmVigente>;

export const LEVANTAMIENTOS: Levantamiento[] = ["sentadilla", "press_banca", "peso_muerto"];

/**
 * 1RM de referencia vigente (el más reciente VALIDADO) de cada
 * levantamiento. Es la única fuente para calcular la carga de la serie
 * efectiva: como la carga se calcula al mostrar el plan, actualizar el 1RM
 * recalcula todas las cargas futuras, y los entrenamientos ya hechos no
 * cambian (guardan su propio objetivo en cada serie). Lo que propone el
 * alumno no cuenta hasta que el coach lo valida.
 */
export async function obtenerRmVigentes(id_alumno: string): Promise<RmVigentes> {
  const filas = await prisma.rmReferencia.findMany({
    where: { id_alumno, estado: "validado" },
    orderBy: { fecha: "desc" },
    distinct: ["levantamiento"],
    select: { levantamiento: true, valor_kg: true, fecha: true, fuente: true },
  });
  const salida = Object.fromEntries(LEVANTAMIENTOS.map((l) => [l, null])) as RmVigentes;
  for (const f of filas) salida[f.levantamiento] = { valor: Number(f.valor_kg), fecha: f.fecha, fuente: f.fuente };
  return salida;
}

/** Historial completo (validados, propuestos y rechazados), del más nuevo al más viejo. */
export async function obtenerHistorialRm(id_alumno: string, porLevantamiento = 10) {
  const filas = await prisma.rmReferencia.findMany({
    where: { id_alumno },
    orderBy: { fecha_registro: "desc" },
    take: porLevantamiento * LEVANTAMIENTOS.length,
    select: {
      id_rm: true,
      levantamiento: true,
      valor_kg: true,
      valor_anterior: true,
      fecha: true,
      fecha_registro: true,
      fuente: true,
      estado: true,
      id_usuario_autor: true,
      origen: true,
      peso_registrado: true,
      repeticiones_registradas: true,
    },
  });
  return filas.map((f) => ({
    ...f,
    valor_kg: Number(f.valor_kg),
    valor_anterior: f.valor_anterior === null ? null : Number(f.valor_anterior),
    peso_registrado: f.peso_registrado === null ? null : Number(f.peso_registrado),
  }));
}

export type CargaAfectada = {
  ejercicio: string;
  sesion: string;
  semanas: { semana: Semana; porcentaje: number | null; cargaFija: number | null }[];
};

/**
 * Ejercicios del programa ACTIVO cuya carga depende del 1RM de cada
 * levantamiento (para mostrarle al coach qué cambia antes de confirmar un
 * 1RM nuevo). Solo planes que admiten progresión; los ejercicios
 * archivados o dentro de un bloque no cuentan.
 */
export async function cargasAfectadasPorRm(id_alumno: string): Promise<Record<Levantamiento, CargaAfectada[]>> {
  const salida = Object.fromEntries(LEVANTAMIENTOS.map((l) => [l, []])) as unknown as Record<
    Levantamiento,
    CargaAfectada[]
  >;
  const programa = await prisma.programaEntrenamiento.findFirst({
    where: { id_alumno, estado_programa: "activo", es_plantilla: false },
    orderBy: { fecha_inicio: "desc" },
    select: {
      tipo_planificacion: true,
      bloques: {
        orderBy: [{ semana_inicio: "asc" }, { numero_dia: "asc" }],
        select: {
          nombre: true,
          numero_dia: true,
          semana_inicio: true,
          semana_fin: true,
          ejercicios_programa: {
            where: { progresion_fuerza: true, archivado: false, id_grupo: null },
            select: { porcentajes_semana: true, cargas_fijas: true, ejercicio: { select: { nombre: true } } },
          },
        },
      },
    },
  });
  if (!programa || !progresionHabilitada(programa.tipo_planificacion)) return salida;

  for (const b of programa.bloques) {
    const semanas = SEMANAS.filter((s) => s >= (b.semana_inicio ?? 1) && s <= (b.semana_fin ?? 4));
    for (const ep of b.ejercicios_programa) {
      const levantamiento = detectarLevantamiento(ep.ejercicio.nombre);
      if (!levantamiento) continue;
      const pcts = normalizarPorcentajes(ep.porcentajes_semana, semanas);
      const fijas = normalizarCargasFijas(ep.cargas_fijas, semanas);
      salida[levantamiento].push({
        ejercicio: ep.ejercicio.nombre,
        sesion:
          (b.numero_dia != null ? `Día ${b.numero_dia}` : b.nombre) +
          (b.semana_inicio === b.semana_fin ? ` · S${b.semana_inicio}` : ` · S${b.semana_inicio}-${b.semana_fin}`),
        semanas: semanas.map((s) => ({
          semana: s,
          porcentaje: pcts[`${s}`] ?? null,
          cargaFija: fijas[`${s}`] ?? null,
        })),
      });
    }
  }
  return salida;
}

/** Redondeo de cargas (kg) que configuró el coach del programa. */
export async function obtenerPasoRedondeo(id_entrenador: string): Promise<number> {
  const entrenador = await prisma.entrenador.findUnique({
    where: { id_entrenador },
    select: { redondeo_carga_kg: true },
  });
  const paso = entrenador ? Number(entrenador.redondeo_carga_kg) : REDONDEO_POR_DEFECTO;
  return paso > 0 ? paso : REDONDEO_POR_DEFECTO;
}
