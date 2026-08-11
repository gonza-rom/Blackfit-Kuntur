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
