import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { registrarActividad, PUNTOS, levantamientoCompatiblePR, notificarNuevosPR } from "@/lib/gamificacion";

const PROGRAMA_ACTIVO_INCLUDE = {
  bloques: {
    orderBy: { orden: "asc" },
    include: {
      ejercicios_programa: {
        orderBy: { orden: "asc" },
        include: { ejercicio: true },
      },
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

// Índice = Date.getDay() (0 = domingo). Traduce la fecha de hoy al enum
// DiaSemana para elegir el bloque del día en un plan armado por día.
const DIAS_SEMANA_JS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const;

export async function obtenerProgramaActivo(
  id_alumno: string
): Promise<ProgramaActivo | null> {
  return prisma.programaEntrenamiento.findFirst({
    where: { id_alumno, estado_programa: "activo" },
    orderBy: { fecha_inicio: "desc" },
    include: PROGRAMA_ACTIVO_INCLUDE,
  });
}

export function calcularBloqueActual(programa: ProgramaActivo): BloqueActual | null {
  if (programa.bloques.length === 0) return null;

  const semanaActual =
    Math.floor((Date.now() - programa.fecha_inicio.getTime()) / MS_POR_SEMANA) + 1;

  // Planificación nueva (por día): si algún bloque tiene dia_semana
  // cargado, el programa entero se arma con ese esquema — se busca el
  // bloque de HOY dentro de la semana actual, y si no hay ninguno (día de
  // descanso planificado) no se devuelve nada, en vez de caer a
  // cualquier otro bloque.
  const esPorDia = programa.bloques.some((b) => b.dia_semana != null);
  if (esPorDia) {
    const hoy = DIAS_SEMANA_JS[new Date().getDay()];
    return (
      programa.bloques.find(
        (b) =>
          b.dia_semana === hoy &&
          b.semana_inicio != null &&
          b.semana_fin != null &&
          semanaActual >= b.semana_inicio &&
          semanaActual <= b.semana_fin
      ) ?? null
    );
  }

  // Planificación vieja (por bloques libres): se mantiene igual que
  // siempre, para no romper ningún programa ya armado.
  const bloquePorSemana = programa.bloques.find(
    (b) =>
      b.semana_inicio != null &&
      b.semana_fin != null &&
      semanaActual >= b.semana_inicio &&
      semanaActual <= b.semana_fin
  );

  return bloquePorSemana ?? programa.bloques[0];
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
        id_ejercicio_programa: true,
        peso_utilizado: true,
        entrenamiento: { select: { fecha: true } },
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

  // Récords: por cada ejercicio (id_ejercicio_programa), el peso máximo
  // histórico registrado por el alumno. Cuenta como "nuevo récord" si ese
  // máximo se marcó en los últimos 30 días.
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const maximos = new Map<string, { peso: number; fecha: Date }>();
  for (const s of series) {
    if (s.peso_utilizado === null) continue;
    const peso = Number(s.peso_utilizado);
    const actual = maximos.get(s.id_ejercicio_programa);
    if (!actual || peso > actual.peso) {
      maximos.set(s.id_ejercicio_programa, { peso, fecha: s.entrenamiento.fecha });
    }
  }
  const nuevosRecords = [...maximos.values()].filter((m) => m.fecha >= hace30).length;

  return { sesiones, rachaDias, nuevosRecords };
}

export type UltimoPR = { nombreEjercicio: string; peso: number; fecha: Date } | null;

/** El ejercicio en el que el alumno marcó su récord de peso más reciente (entre todos los que entrenó). */
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
    const peso = Number(s.peso_utilizado);
    const id = s.ejercicio_programa.ejercicio.id_ejercicio;
    const actual = maximos.get(id);
    if (!actual || peso > actual.peso) {
      maximos.set(id, {
        peso,
        fecha: s.entrenamiento.fecha,
        nombre: s.ejercicio_programa.ejercicio.nombre,
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
  peso_utilizado: number | null;
  repeticiones_realizadas: number | null;
  series_completadas: number | null;
  rpe: number | null;
  descanso_real: number | null;
  tiempo_bajo_tension: number | null;
  comentarios: string | null;
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
    include: { programa: true, ejercicios_programa: { include: { ejercicio: true } } },
  });

  if (!bloque || bloque.programa.id_alumno !== id_alumno) {
    return { error: "No autorizado sobre este bloque." };
  }

  const idsValidos = new Set(bloque.ejercicios_programa.map((ep) => ep.id_ejercicio_programa));

  // Volumen total: se calcula acá, nunca se confía en un valor que mande
  // el cliente, para que no se pueda falsear desde el navegador.
  const volumenTotal = series.reduce(
    (acc, s) => acc + (s.peso_utilizado ?? 0) * (s.repeticiones_realizadas ?? 0),
    0
  );

  const id_entrenamiento = await prisma.$transaction(async (tx) => {
    const entrenamiento = await tx.entrenamiento.create({
      data: {
        id_alumno,
        id_programa: bloque.id_programa,
        nombre: bloque.nombre,
        estado: "completado",
        comentarios: comentarioGeneral,
        duracion_minutos: resumen?.duracionMinutos ?? null,
        calorias_estimadas: resumen?.caloriasEstimadas ?? null,
        sensacion_general: resumen?.sensacionGeneral ?? null,
        volumen_total: volumenTotal,
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

      await tx.serieEntrenamiento.create({
        data: {
          id_entrenamiento: entrenamiento.id_entrenamiento,
          id_ejercicio_programa: s.id_ejercicio_programa,
          numero_serie: s.numero_serie,
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
