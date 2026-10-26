import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarActividad, PUNTOS } from "@/lib/gamificacion";
import { aplicarRecords, notificarRecords, type SerieNueva } from "@/lib/records-server";
import { serieValida } from "@/lib/records";
import {
  detectarLevantamiento,
  NOMBRE_LEVANTAMIENTO,
  aproximacionesDeSemana,
  cargaDe1RM,
  objetivoEfectiva,
  posicionCiclo,
  progresionHabilitada,
  semanaDelPrograma,
  type Levantamiento,
} from "@/lib/progresion-fuerza";
import { obtenerRmVigentes, obtenerPasoRedondeo } from "@/lib/rm-referencia";
import {
  esPlanSecuencial,
  posicionSecuencia,
  semanaParaSesion,
  sesionesDeSemana,
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

const MS_POR_DIA_PLAN = 24 * 60 * 60 * 1000;

/**
 * Semana actual del ciclo de 4 (después de la 4 vuelve a la 1), número de
 * ciclo y días transcurridos desde que arrancó el plan.
 */
export function calcularSemanaYDiasActivos(
  fechaInicio: Date,
  fechaPausa: Date | null = null
): {
  semanaActual: number;
  ciclo: number;
  diasActivos: number;
} {
  const { semana, ciclo } = posicionCiclo(fechaInicio, new Date(), fechaPausa);
  const transcurrido = (fechaPausa ?? new Date()).getTime() - fechaInicio.getTime();
  return {
    semanaActual: semana,
    ciclo,
    diasActivos: Math.max(0, Math.floor(transcurrido / MS_POR_DIA_PLAN)),
  };
}

/** Desde cuándo cuenta el ciclo de 4 semanas del programa. */
export function inicioCicloPrograma(programa: { fecha_inicio: Date; fecha_inicio_ciclo: Date | null }): Date {
  return programa.fecha_inicio_ciclo ?? programa.fecha_inicio;
}

export type BloqueActual = ProgramaActivo["bloques"][number];

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
  | { tipo: "semana_completa"; semana: Semana; proximaSemana: Date }
  | { tipo: "sin_plan" };

/**
 * Qué le toca entrenar al alumno.
 * - Progresión semanal: la semana sale del CALENDARIO (períodos de 7 días
 *   desde el inicio del ciclo, que se repite cada 4) y, dentro de esa
 *   semana, la siguiente sesión que todavía no hizo en este período.
 * - Resto de planes secuenciales: la siguiente sesión pendiente según su
 *   historial real (nunca según el día de la semana).
 * - Plan viejo por tramos: se sigue eligiendo por semana como siempre.
 */
export async function obtenerSiguienteSesion(programa: ProgramaActivo): Promise<SiguienteSesion> {
  if (programa.tipo_planificacion === "semanal" && esPlanSecuencial(programa.bloques)) {
    const dias = programa.bloques.map((b) => comoDiaPlan(b, b.ejercicios_programa.length));
    const { semana, inicioSemana, finSemana } = posicionCiclo(
      inicioCicloPrograma(programa),
      new Date(),
      programa.fecha_pausa
    );
    const sesiones = sesionesDeSemana(dias, semana);
    if (sesiones.length === 0) {
      return dias.some((d) => d.cantidadEjercicios > 0 && d.numero_dia != null)
        ? { tipo: "semana_completa", semana, proximaSemana: finSemana }
        : { tipo: "sin_plan" };
    }
    const hechas = await prisma.entrenamiento.findMany({
      where: {
        id_programa: programa.id_programa,
        estado: "completado",
        id_bloque: { in: sesiones.map((s) => s.id_bloque) },
        fecha: { gte: inicioSemana },
      },
      select: { id_bloque: true },
    });
    const idsHechos = new Set(hechas.map((h) => h.id_bloque));
    const siguiente = sesiones.find((s) => !idsHechos.has(s.id_bloque));
    if (!siguiente) return { tipo: "semana_completa", semana, proximaSemana: finSemana };
    return {
      tipo: "sesion",
      bloque: siguiente,
      numeroDia: siguiente.numero_dia,
      semana,
      completadas: idsHechos.size,
    };
  }
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
 * Semana del bloque de 4 para hacer (o guardar) una sesión.
 * - Progresión semanal: por calendario desde el inicio del ciclo (cíclica).
 * - Otro plan secuencial: sale de las sesiones completadas — retrasarse no
 *   adelanta la semana.
 * - Plan viejo: por calendario como hasta ahora.
 */
export async function semanaDeLaSesion(
  programa: {
    id_programa: string;
    fecha_inicio: Date;
    fecha_inicio_ciclo: Date | null;
    fecha_pausa: Date | null;
    tipo_planificacion: string;
  },
  bloque: { id_bloque: string; numero_dia: number | null; semana_inicio: number | null; semana_fin: number | null },
  bloquesDelPrograma: (DiaPlan & { id_bloque: string })[]
): Promise<Semana> {
  if (programa.tipo_planificacion === "semanal") {
    const semana = posicionCiclo(inicioCicloPrograma(programa), new Date(), programa.fecha_pausa).semana;
    // Si abrió una sesión de otra semana, se usa la semana de ESA sesión
    // (sus % están configurados para sus semanas, no para la actual).
    const desde = Math.max(1, Math.min(4, bloque.semana_inicio ?? 1));
    const hasta = Math.max(desde, Math.min(4, bloque.semana_fin ?? 4));
    return (semana >= desde && semana <= hasta ? semana : desde) as Semana;
  }
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

  // Cíclica: después de la semana 4 vuelve a la 1.
  const semanaActual = semanaDelPrograma(programa.fecha_inicio);

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
  // semana, % programado de la efectiva y carga con el 1RM vigente) se
  // calcula ACÁ y se copia en la serie. Nunca se confía en lo que mande el
  // teléfono, y así lo ya entrenado no cambia si después cambia el 1RM.
  // Semana: en Progresión semanal por calendario (ciclo de 4 que se
  // repite); en otro plan secuencial, según las sesiones ya completadas
  // (calculada ANTES de guardar esta).
  const semana = await semanaDeLaSesion(
    bloque.programa,
    bloque,
    bloque.programa.bloques.map((b) => ({ ...b, cantidadEjercicios: b._count.ejercicios_programa }))
  );
  const epPorIdPlan = new Map(bloque.ejercicios_programa.map((ep) => [ep.id_ejercicio_programa, ep]));
  // En "Rutina fija" nunca se calculan cargas por 1RM.
  const conProgresion = progresionHabilitada(bloque.programa.tipo_planificacion);
  const hayProgresion = conProgresion && bloque.ejercicios_programa.some((ep) => ep.progresion_fuerza);
  const rmVigentes = hayProgresion ? await obtenerRmVigentes(id_alumno) : null;
  const paso = hayProgresion ? await obtenerPasoRedondeo(bloque.programa.id_entrenador) : undefined;

  // Progresión semanal: una semana sin aproximaciones propias repite las de la 1.
  const heredarSemana1 = bloque.programa.tipo_planificacion === "semanal";

  function objetivoDe(s: SerieRegistrada) {
    const ep = epPorIdPlan.get(s.id_ejercicio_programa);
    if (!conProgresion || !ep?.progresion_fuerza || ep.id_grupo) return { omitir: false, datos: { tipo_serie: null } };
    const levantamiento = detectarLevantamiento(ep.ejercicio.nombre);
    const rm = levantamiento ? (rmVigentes?.[levantamiento]?.valor ?? null) : null;
    const plan = aproximacionesDeSemana(ep.aproximaciones, semana, heredarSemana1);

    if (s.tipo_serie === "efectiva") {
      const objetivo = objetivoEfectiva(
        semana,
        rm,
        { porcentajes: ep.porcentajes_semana, cargasFijas: ep.cargas_fijas },
        paso
      );
      return {
        omitir: false,
        datos: {
          tipo_serie: "efectiva",
          porcentaje_objetivo: objetivo.porcentaje !== null ? String(objetivo.porcentaje) : null,
          peso_objetivo: objetivo.peso !== null ? String(objetivo.peso) : null,
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
        peso_objetivo: delPlan?.porcentaje != null && rm ? String(cargaDe1RM(rm, delPlan.porcentaje, paso)) : null,
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
  // Series guardadas con peso y reps reales, para detectar récords.
  const guardadas: { id_serie: string; id_ejercicio_programa: string; peso: number | null; reps: number | null }[] = [];
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

        const creada = await tx.serieEntrenamiento.create({
          select: { id_serie: true },
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
        guardadas.push({
          id_serie: creada.id_serie,
          id_ejercicio_programa: s.id_ejercicio_programa,
          peso: s.peso_utilizado,
          reps: s.repeticiones_realizadas,
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

  // Récords automáticos (sentadilla, banca, peso muerto), a partir de las
  // series REALMENTE registradas: PR de carga / repeticiones y, si supera
  // al vigente, 1RM nuevo (medido o estimado) sin pasar por el coach. Las
  // cargas futuras se recalculan solas; esta sesión y las anteriores no
  // cambian. Idempotente por entrenamiento. Best-effort: nunca rompe el
  // guardado de la sesión.
  try {
    const epPorId = new Map(bloque.ejercicios_programa.map((ep) => [ep.id_ejercicio_programa, ep]));
    const nuevasPorLevantamiento: Partial<Record<Levantamiento, SerieNueva[]>> = {};
    for (const g of guardadas) {
      const ep = epPorId.get(g.id_ejercicio_programa);
      const l = ep ? detectarLevantamiento(ep.ejercicio.nombre) : null;
      if (!l || !serieValida(g.peso, g.reps)) continue;
      (nuevasPorLevantamiento[l] ??= []).push({ peso: g.peso!, reps: g.reps!, id_serie: g.id_serie });
    }
    const alumno = await prisma.alumno.findUnique({ where: { id_alumno }, select: { id_usuario: true } });
    const aplicados = await aplicarRecords(id_alumno, alumno?.id_usuario ?? id_alumno, nuevasPorLevantamiento, {
      id_entrenamiento,
    });
    await notificarRecords(id_alumno, aplicados);
  } catch (e) {
    console.error("[alumno] récords automáticos:", e);
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
