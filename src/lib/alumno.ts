import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

export function calcularBloqueActual(programa: ProgramaActivo): BloqueActual | null {
  if (programa.bloques.length === 0) return null;

  const semanaActual =
    Math.floor((Date.now() - programa.fecha_inicio.getTime()) / MS_POR_SEMANA) + 1;

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

export type SerieRegistrada = {
  id_ejercicio_programa: string;
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
export async function guardarSesionEntrenamiento(
  id_alumno: string,
  id_bloque: string,
  comentarioGeneral: string | null,
  series: SerieRegistrada[]
): Promise<{ error?: string }> {
  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true, ejercicios_programa: true },
  });

  if (!bloque || bloque.programa.id_alumno !== id_alumno) {
    return { error: "No autorizado sobre este bloque." };
  }

  const idsValidos = new Set(bloque.ejercicios_programa.map((ep) => ep.id_ejercicio_programa));

  await prisma.$transaction(async (tx) => {
    const entrenamiento = await tx.entrenamiento.create({
      data: {
        id_alumno,
        id_programa: bloque.id_programa,
        nombre: bloque.nombre,
        estado: "completado",
        comentarios: comentarioGeneral,
      },
    });

    for (const s of series) {
      if (!idsValidos.has(s.id_ejercicio_programa)) continue;

      const ep = bloque.ejercicios_programa.find(
        (e) => e.id_ejercicio_programa === s.id_ejercicio_programa
      )!;

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
          peso_utilizado: s.peso_utilizado,
          repeticiones_realizadas: s.repeticiones_realizadas,
          series_completadas: s.series_completadas ?? ep.series,
          rpe: s.rpe,
          descanso_real: s.descanso_real,
          tiempo_bajo_tension: s.tiempo_bajo_tension,
          comentarios: s.comentarios,
        },
      });
    }
  });

  return {};
}
