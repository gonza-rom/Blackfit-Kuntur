import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarActividad, PUNTOS, levantamientoCompatiblePR, notificarNuevosPR } from "@/lib/gamificacion";
import {
  detectarLevantamiento,
  NOMBRE_LEVANTAMIENTO,
  aproximacionesDeSemana,
  cargaDe1RM,
  objetivoEfectiva,
  semanaDelPrograma,
} from "@/lib/progresion-fuerza";
import { obtenerRmVigentes } from "@/lib/rm-referencia";
import {
  esPlanSecuencial,
  posicionSecuencia,
  semanaParaSesion,
  type DiaPlan,
} from "@/lib/secuencia";
import type { Semana } from "@/lib/progresion-fuerza";

const PROGRAMA_ACTIVO_INCLUDE = {
  bloques: {
    orderBy: { orden: "asc" },
    include: {
      ejercicios_programa: {
        where: { archivado: false },
        orderBy: { orden: "asc" },
        include: { ejercicio: true },
      },
      grupos: true,
    },
  },
} satisfies Prisma.ProgramaEntrenamientoInclude;

export type ProgramaActivo = Prisma.ProgramaEntrenamientoGetPayload<{
  include: typeof PROGRAMA_ACTIVO_INCLUDE;
}>;

const MS_POR_SEMANA_PLAN = 7 * 24 * 60 * 60 * 1000;
const MS_POR_DIA_PLAN = 24 * 60 * 60 * 1000;

/** Semana actual (1-4, clampeada) y días transcurridos desde que arrancó el plan mensual. */
export function calcularSemanaYDiasActivos(fechaInicio: Date): {
  semanaActual: number;
  diasActivos: number;
} {
  const transcurrido = Date.now() - fechaInicio.getTime();
  return {
    semanaActual: Math.min(4, Math.max(1, Math.floor(transcurrido / MS_POR_SEMANA_PLAN) + 1)),
    diasActivos: Math.max(0, Math.floor(transcurrido / MS_POR_DIA_PLAN)),
  };
}

export type BloqueActual = ProgramaActivo["bloques"][number];

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;

export async function obtenerProgramaActivo(
  id_alumno: string
): Promise<ProgramaActivo | null> {
  return prisma.programaEntrenamiento.findFirst({
    where: { id_alumno, estado_programa: "activo" },
    orderBy: { fecha_inicio: "desc" },
    include: PROGRAMA_ACTIVO_INCLUDE,
  });
}

// ------------------------------------------------------------
// Sesiones secuenciales (Día 1, Día 2, ...) — ver lib/secuencia.ts
// ------------------------------------------------------------

/** Sesiones del plan que el alumno ya completó (las vinculadas a un Día N). */
export async function contarSesionesCompletadas(id_programa: string): Promise<number> {
  return prisma.entrenamiento.count({
    where: { id_programa, estado: "completado", numero_dia: { not: null } },
  });
}

function comoDiaPlan<B extends { id_bloque: string; numero_dia: number | null; semana_inicio: number | null; semana_fin: number | null }>(
  bloque: B,
  cantidadEjercicios: number
): B & DiaPlan {
  return { ...bloque, cantidadEjercicios };
}

export type SiguienteSesion =
  | { tipo: "sesion"; bloque: BloqueActual; numeroDia: number | null; semana: Semana | null; completadas: number }
  | { tipo: "bloque_completo"; completadas: number }
  | { tipo: "sin_plan" };

/**
 * Qué le toca entrenar al alumno. Plan secuencial: la siguiente sesión
 * pendiente según su historial real (nunca según el día de la semana).
 * Plan viejo por tramos: se sigue eligiendo por semana como siempre.
 */
export async function obtenerSiguienteSesion(programa: ProgramaActivo): Promise<SiguienteSesion> {
  if (!esPlanSecuencial(programa.bloques)) {
    const bloque = calcularBloqueActual(programa);
    return bloque
      ? { tipo: "sesion", bloque, numeroDia: null, semana: null, completadas: 0 }
      : { tipo: "sin_plan" };
  }
  const dias = programa.bloques.map((b) => comoDiaPlan(b, b.ejercicios_programa.length));
  const completadas = await contarSesionesCompletadas(programa.id_programa);
  const pos = posicionSecuencia(dias, completadas);
  if (pos.completo) {
    return dias.some((d) => d.cantidadEjercicios > 0 && d.numero_dia != null)
      ? { tipo: "bloque_completo", completadas }
      : { tipo: "sin_plan" };
  }
  return { tipo: "sesion", bloque: pos.bloque, numeroDia: pos.bloque.numero_dia, semana: pos.semana, completadas };
}

/**
 * Semana del bloque de 4 para hacer (o guardar) una sesión. En un plan
 * secuencial sale de las sesiones completadas — retrasarse no adelanta la
 * semana. En un plan viejo, por calendario como hasta ahora.
 */
export async function semanaDeLaSesion(
  programa: { id_programa: string; fecha_inicio: Date },
  bloque: { id_bloque: string; numero_dia: number | null; semana_inicio: number | null; semana_fin: number | null },
  bloquesDelPrograma: (DiaPlan & { id_bloque: string })[]
): Promise<Semana> {
  if (bloque.numero_dia == null) return semanaDelPrograma(programa.fecha_inicio);
  const completadas = await contarSesionesCompletadas(programa.id_programa);
  const propio = bloquesDelPrograma.find((b) => b.id_bloque === bloque.id_bloque) ?? comoDiaPlan(bloque, 1);
  return semanaParaSesion(bloquesDelPrograma, completadas, propio);
}

/**
 * Bloque vigente de un plan VIEJO armado por tramos libres (sin Día N):
 * se elige por semana, como siempre. Los planes por sesiones usan
 * obtenerSiguienteSesion. Los días de descanso vacíos de la planificación
 * por día de la semana anterior (dia_semana sin numero_dia) no son
 * sesiones y se ignoran.
 */
export function calcularBloqueActual(programa: ProgramaActivo): BloqueActual | null {
  const bloques = programa.bloques.filter((b) => b.dia_semana == null);
  if (bloques.length === 0) return null;

  const semanaActual =
    Math.floor((Date.now() - programa.fecha_inicio.getTime()) / MS_POR_SEMANA) + 1;

  const bloquePorSemana = bloques.find(
    (b) =>
      b.semana_inicio != null &&
      b.semana_fin != null &&
      semanaActual >= b.semana_inicio &&
      semanaActual <= b.semana_fin
  );

  return bloquePorSemana ?? bloques[0];
}

export type EstadisticasAlumno = {
  sesiones: number;
  rachaDias: number;
  nuevosRecords: number;
};

/**
 * Reemplaza los números fijos que había en /panel/perfil ("142 sesiones",
 * "12 racha", "8 récords") por cálculos reales sobre lo que el alumno ya
 * registró.
 */
export async function calcularEstadisticasAlumno(
  id_alumno: string
): Promise<EstadisticasAlumno> {
  const [sesiones, entrenamientosCompletados, series] = await Promise.all([
    prisma.entrenamiento.count({ where: { id_alumno, estado: "completado" } }),
    prisma.entrenamiento.findMany({
      where: { id_alumno, estado: "completado" },
      select: { fecha: true },
      orderBy: { fecha: "desc" },
    }),
    prisma.serieEntrenamiento.findMany({
      where: { entrenamiento: { id_alumno } },
      select: {
        peso_utilizado: true,
        entrenamiento: { select: { fecha: true } },
        ejercicio_programa: { select: { ejercicio: { select: { nombre: true } } } },
      },
    }),
  ]);

  // Racha: días consecutivos (contando desde hoy hacia atrás) con al
  // menos un entrenamiento completado, cortando en el primer hueco.
  const diasConEntrenamiento = new Set(
    entrenamientosCompletados.map((e) => e.fecha.toISOString().slice(0, 10))
  );
  let rachaDias = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Si hoy todavía no entrenó, la racha se cuenta desde ayer (no se
  // rompe recién a la medianoche).
  if (!diasConEntrenamiento.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (diasConEntrenamiento.has(cursor.toISOString().slice(0, 10))) {
    rachaDias++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Récords: solo los 3 levantamientos del sistema de PR (sentadilla con
  // barra, press de banca plano, peso muerto convencional). Por cada uno,
  // el peso máximo histórico; cuenta como "nuevo récord" si ese máximo se
  // marcó en los últimos 30 días.
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const maximos = new Map<string, { peso: number; fecha: Date }>();
  for (const s of series) {
    if (s.peso_utilizado === null) continue;
    const levantamiento = detectarLevantamiento(s.ejercicio_programa.ejercicio.nombre);
    if (!levantamiento) continue;
    const peso = Number(s.peso_utilizado);
    const actual = maximos.get(levantamiento);
    if (!actual || peso > actual.peso) {
      maximos.set(levantamiento, { peso, fecha: s.entrenamiento.fecha });
    }
  }
  const nuevosRecords = [...maximos.values()].filter((m) => m.fecha >= hace30).length;

  return { sesiones, rachaDias, nuevosRecords };
}

export type UltimoPR = { nombreEjercicio: string; peso: number; fecha: Date } | null;

/** El récord de peso más reciente del alumno entre los 3 levantamientos del sistema de PR. */
export async function obtenerUltimoPR(id_alumno: string): Promise<UltimoPR> {
  const series = await prisma.serieEntrenamiento.findMany({
    where: { entrenamiento: { id_alumno }, peso_utilizado: { not: null } },
    select: {
      peso_utilizado: true,
      entrenamiento: { select: { fecha: true } },
      ejercicio_programa: {
        select: { ejercicio: { select: { id_ejercicio: true, nombre: true } } },
      },
    },
  });

  const maximos = new Map<string, { peso: number; fecha: Date; nombre: string }>();
  for (const s of series) {
    if (s.peso_utilizado === null) continue;
    const levantamiento = detectarLevantamiento(s.ejercicio_programa.ejercicio.nombre);
    if (!levantamiento) continue;
    const peso = Number(s.peso_utilizado);
    const id = levantamiento;
    const actual = maximos.get(id);
    if (!actual || peso > actual.peso) {
      maximos.set(id, {
        peso,
        fecha: s.entrenamiento.fecha,
        nombre: NOMBRE_LEVANTAMIENTO[levantamiento],
      });
    }
  }

  let mejor: UltimoPR = null;
  for (const m of maximos.values()) {
    if (!mejor || m.fecha > mejor.fecha) {
      mejor = { nombreEjercicio: m.nombre, peso: m.peso, fecha: m.fecha };
    }
  }
  return mejor;
}

export type SerieRegistrada = {
  id_ejercicio_programa: string;
  numero_serie: number | null;
  // Ronda del bloque (superserie/circuito). Opcional: la cola offline puede
  // traer sesiones guardadas antes de que existiera este campo.
  numero_ronda?: number | null;
  peso_utilizado: number | null;
  repeticiones_realizadas: number | null;
  series_completadas: number | null;
  rpe: number | null;
  descanso_real: number | null;
  tiempo_bajo_tension: number | null;
  comentarios: string | null;
  // Solo en ejercicios con progresión de fuerza. En las aproximaciones,
  // numero_serie es su posición (1, 2, 3...) para emparejarla con el plan.
  tipo_serie?: "aproximacion" | "efectiva" | null;
};

/**
 * Lógica compartida entre la server action (formulario normal, online) y
 * el route handler (usado por la cola de sincronización offline — ver
 * lib/offline-queue.ts) para que ambos caminos guarden exactamente igual.
 */
export type ResumenSesion = {
  duracionMinutos?: number | null;
  caloriasEstimadas?: number | null;
  sensacionGeneral?: number | null;
  // Id único que genera el teléfono al empezar la sesión (ver
  // lib/sesion-en-curso.ts). Con él, un reintento nunca duplica.
  idSesion?: string | null;
};

export async function guardarSesionEntrenamiento(
  id_alumno: string,
  id_bloque: string,
  comentarioGeneral: string | null,
  series: SerieRegistrada[],
  resumen?: ResumenSesion
): Promise<{ error?: string }> {
  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: {
      programa: {
        include: {
          bloques: {
            select: {
              id_bloque: true,
              numero_dia: true,
              semana_inicio: true,
              semana_fin: true,
              _count: { select: { ejercicios_programa: { where: { archivado: false } } } },
            },
          },
        },
      },
      ejercicios_programa: { include: { ejercicio: true } },
    },
  });

  if (!bloque || bloque.programa.id_alumno !== id_alumno) {
    return { error: "No autorizado sobre este bloque." };
  }

  const idsValidos = new Set(bloque.ejercicios_programa.map((ep) => ep.id_ejercicio_programa));

  // Esta sesión ya se guardó (reintento tras un corte, o la cola offline
  // reenviando algo que sí había llegado): éxito sin duplicar.
  const idSesion = resumen?.idSesion ?? null;
  if (idSesion) {
    const existente = await prisma.entrenamiento.findUnique({
      where: { id_sesion_cliente: idSesion },
      select: { id_alumno: true },
    });
    if (existente) {
      return existente.id_alumno === id_alumno ? {} : { error: "Sesión inválida." };
    }
  }

  // Progresión de fuerza: el objetivo de cada serie (plan del coach para la
  // semana, % fijo de la efectiva y carga con el 1RM vigente) se calcula
  // ACÁ y se copia en la serie. Nunca se confía en lo que mande el
  // teléfono, y así lo ya entrenado no cambia si después cambia el 1RM.
  // Semana del bloque: en un plan secuencial, según las sesiones ya
  // completadas (calculada ANTES de guardar esta), nunca por calendario.
  const semana = await semanaDeLaSesion(
    bloque.programa,
    bloque,
    bloque.programa.bloques.map((b) => ({ ...b, cantidadEjercicios: b._count.ejercicios_programa }))
  );
  const epPorIdPlan = new Map(bloque.ejercicios_programa.map((ep) => [ep.id_ejercicio_programa, ep]));
  const hayProgresion = bloque.ejercicios_programa.some((ep) => ep.progresion_fuerza);
  const rmVigentes = hayProgresion ? await obtenerRmVigentes(id_alumno) : null;

  function objetivoDe(s: SerieRegistrada) {
    const ep = epPorIdPlan.get(s.id_ejercicio_programa);
    if (!ep?.progresion_fuerza) return { omitir: false, datos: { tipo_serie: null } };
    const levantamiento = detectarLevantamiento(ep.ejercicio.nombre);
    const rm = levantamiento ? (rmVigentes?.[levantamiento]?.valor ?? null) : null;
    const plan = aproximacionesDeSemana(ep.aproximaciones, semana);

    if (s.tipo_serie === "efectiva") {
      const objetivo = objetivoEfectiva(semana, rm);
      return {
        omitir: false,
        datos: {
          tipo_serie: "efectiva",
          porcentaje_objetivo: objetivo.porcentaje,
          peso_objetivo: objetivo.peso,
          repeticiones_objetivo: ep.repeticiones,
          aproximaciones_plan: plan.length,
        },
      };
    }

    const posicion = s.numero_serie ?? 0;
    const delPlan = posicion >= 1 ? plan[posicion - 1] : undefined;
    // Sin permiso, el alumno no puede sumar aproximaciones al plan.
    if (!delPlan && !ep.alumno_edita_aproximaciones) return { omitir: true, datos: { tipo_serie: null } };
    return {
      omitir: false,
      datos: {
        tipo_serie: "aproximacion",
        porcentaje_objetivo: delPlan?.porcentaje != null ? String(delPlan.porcentaje) : null,
        peso_objetivo: delPlan?.porcentaje != null && rm ? String(cargaDe1RM(rm, delPlan.porcentaje)) : null,
        repeticiones_objetivo: delPlan?.reps || null,
        agregada_por_alumno: !delPlan,
      },
    };
  }

  // Volumen total: se calcula acá, nunca se confía en un valor que mande
  // el cliente, para que no se pueda falsear desde el navegador.
  const volumenTotal = series.reduce(
    (acc, s) => acc + (s.peso_utilizado ?? 0) * (s.repeticiones_realizadas ?? 0),
    0
  );

  let id_entrenamiento: string;
  try {
    id_entrenamiento = await prisma.$transaction(async (tx) => {
      const entrenamiento = await tx.entrenamiento.create({
        data: {
          id_sesion_cliente: idSesion,
          id_alumno,
          id_programa: bloque.id_programa,
          nombre: bloque.nombre,
          estado: "completado",
          comentarios: comentarioGeneral,
          duracion_minutos: resumen?.duracionMinutos ?? null,
          calorias_estimadas: resumen?.caloriasEstimadas ?? null,
          sensacion_general: resumen?.sensacionGeneral ?? null,
          volumen_total: volumenTotal,
          semana_programa: semana,
          // Qué sesión fue (Día N), aparte de la fecha real.
          id_bloque: bloque.numero_dia != null ? bloque.id_bloque : null,
          numero_dia: bloque.numero_dia,
        },
      });

      for (const s of series) {
        if (!idsValidos.has(s.id_ejercicio_programa)) continue;

        const huboCarga =
          s.peso_utilizado !== null ||
          s.repeticiones_realizadas !== null ||
          s.series_completadas !== null ||
          s.rpe !== null ||
          s.descanso_real !== null ||
          s.tiempo_bajo_tension !== null ||
          s.comentarios !== null;

        if (!huboCarga) continue;

        const objetivo = objetivoDe(s);
        if (objetivo.omitir) continue;

        await tx.serieEntrenamiento.create({
          data: {
            ...objetivo.datos,
            id_entrenamiento: entrenamiento.id_entrenamiento,
            id_ejercicio_programa: s.id_ejercicio_programa,
            numero_serie: s.numero_serie,
            numero_ronda: s.numero_ronda ?? null,
            peso_utilizado: s.peso_utilizado,
            repeticiones_realizadas: s.repeticiones_realizadas,
            series_completadas: s.series_completadas,
            rpe: s.rpe,
            descanso_real: s.descanso_real,
            tiempo_bajo_tension: s.tiempo_bajo_tension,
            comentarios: s.comentarios,
          },
        });
      }

      return entrenamiento.id_entrenamiento;
    });
  } catch (e) {
    // Dos envíos simultáneos de la misma sesión: el segundo choca con el
    // índice único de id_sesion_cliente. El primero ya la guardó.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return {};
    throw e;
  }

  // Logro automático por PR (levantamientos base) — best-effort, nunca
  // bloquea ni rompe el guardado si algo falla.
  try {
    const epPorId = new Map(bloque.ejercicios_programa.map((ep) => [ep.id_ejercicio_programa, ep]));
    const maximosHoyPorEjercicio = new Map<string, { nombre: string; peso: number }>();
    for (const s of series) {
      if (s.peso_utilizado === null) continue;
      const ep = epPorId.get(s.id_ejercicio_programa);
      if (!ep) continue;
      const clave = levantamientoCompatiblePR(ep.ejercicio.nombre);
      if (!clave) continue;
      const actual = maximosHoyPorEjercicio.get(ep.id_ejercicio);
      if (!actual || s.peso_utilizado > actual.peso) {
        maximosHoyPorEjercicio.set(ep.id_ejercicio, { nombre: clave, peso: s.peso_utilizado });
      }
    }

    if (maximosHoyPorEjercicio.size > 0) {
      const historico = await prisma.serieEntrenamiento.findMany({
        where: {
          entrenamiento: { id_alumno, NOT: { id_entrenamiento } },
          peso_utilizado: { not: null },
          ejercicio_programa: {
            id_ejercicio: { in: [...maximosHoyPorEjercicio.keys()] },
          },
        },
        select: { peso_utilizado: true, ejercicio_programa: { select: { id_ejercicio: true } } },
      });
      const maximosPrevios = new Map<string, number>();
      for (const s of historico) {
        if (s.peso_utilizado === null) continue;
        const id = s.ejercicio_programa.id_ejercicio;
        const peso = Number(s.peso_utilizado);
        const actual = maximosPrevios.get(id);
        if (!actual || peso > actual) maximosPrevios.set(id, peso);
      }

      const prsNuevos: { nombreEjercicio: string; peso: number }[] = [];
      for (const [id_ejercicio, hoy] of maximosHoyPorEjercicio) {
        const previo = maximosPrevios.get(id_ejercicio);
        if (previo === undefined || hoy.peso > previo) {
          prsNuevos.push({ nombreEjercicio: hoy.nombre, peso: hoy.peso });
        }
      }
      await notificarNuevosPR(id_alumno, prsNuevos);
    }
  } catch {
    // Silencioso a propósito — nunca puede tumbar el guardado de la sesión.
  }

  // Gamificación: puntos por el entrenamiento completado + re-evaluación de
  // logros. `motivo` incluye el id del entrenamiento => nunca suma dos veces
  // por la misma sesión. No bloquea ni puede romper el guardado.
  await registrarActividad(
    id_alumno,
    `entrenamiento:${id_entrenamiento}`,
    PUNTOS.entrenamiento_completado,
    "Entrenamiento completado"
  );

  return {};
}
