import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearNotificacion } from "@/lib/notificaciones";

// Puntos que otorga cada evento de actividad diaria. Un único lugar para
// definirlos — el resto del código llama a otorgarPuntos() con estas
// constantes, nunca con números sueltos.
export const PUNTOS = {
  entrenamiento_completado: 20,
  habito_registrado: 10,
  feedback_diario: 5,
} as const;

const DIA_MS = 1000 * 60 * 60 * 24;

/** Clave de día (YYYY-MM-DD) para usar como parte de `motivo`. */
export function claveDia(fecha: Date = new Date()): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Punto ÚNICO para sumar puntos. Crea el MovimientoPuntos y actualiza el
 * total denormalizado de Alumno en una sola transacción.
 *
 * `motivo` es la clave de idempotencia (ver el @@unique(id_alumno, motivo)
 * en schema.prisma): tiene que identificar el evento de forma estable, por
 * ej. `entrenamiento:<id_entrenamiento>` o `habito:2026-09-01`. Si ya se
 * otorgaron puntos por ese mismo motivo, esta función no hace nada y
 * devuelve `{ otorgado: false }` — nunca suma dos veces por el mismo
 * evento y nunca lanza por ese caso.
 */
export async function otorgarPuntos(
  id_alumno: string,
  motivo: string,
  cantidad: number,
  descripcion?: string
): Promise<{ otorgado: boolean }> {
  try {
    await prisma.$transaction([
      prisma.movimientoPuntos.create({
        data: { id_alumno, motivo, cantidad, descripcion: descripcion ?? null },
      }),
      prisma.alumno.update({
        where: { id_alumno },
        data: { puntos_totales: { increment: cantidad } },
      }),
    ]);
    return { otorgado: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Choque con el índice único (id_alumno, motivo): ya estaba otorgado.
      return { otorgado: false };
    }
    throw err;
  }
}

type Criterio = { tipo: string; valor: number };

type EstadoAlumnoGamificacion = {
  id_usuario: string;
  puntos_totales: number;
  entrenamientosCompletados: number;
  rachaDias: number;
  objetivosCumplidos: number;
  volumenAcumulado: number;
};

/** Racha de días consecutivos (desde hoy hacia atrás) con ≥1 entrenamiento
 *  completado. Misma regla que calcularEstadisticasAlumno en lib/alumno.ts,
 *  reimplementada acá para no crear una dependencia circular. */
function calcularRacha(fechas: Date[]): number {
  const dias = new Set(fechas.map((f) => f.toISOString().slice(0, 10)));
  let racha = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!dias.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dias.has(cursor.toISOString().slice(0, 10))) {
    racha++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}

async function reunirEstadoAlumno(
  id_alumno: string
): Promise<EstadoAlumnoGamificacion | null> {
  const [alumno, completados, objetivosCumplidos, series] = await Promise.all([
    prisma.alumno.findUnique({
      where: { id_alumno },
      select: { id_usuario: true, puntos_totales: true },
    }),
    prisma.entrenamiento.findMany({
      where: { id_alumno, estado: "completado" },
      select: { fecha: true },
    }),
    prisma.objetivo.count({ where: { id_alumno, estado: "cumplido" } }),
    prisma.serieEntrenamiento.findMany({
      where: { entrenamiento: { id_alumno } },
      select: {
        peso_utilizado: true,
        repeticiones_realizadas: true,
        series_completadas: true,
      },
    }),
  ]);

  if (!alumno) return null;

  const volumenAcumulado = series.reduce(
    (acc, s) =>
      acc +
      Number(s.peso_utilizado ?? 0) *
        (s.repeticiones_realizadas ?? 0) *
        (s.series_completadas ?? 1),
    0
  );

  return {
    id_usuario: alumno.id_usuario,
    puntos_totales: alumno.puntos_totales,
    entrenamientosCompletados: completados.length,
    rachaDias: calcularRacha(completados.map((e) => e.fecha)),
    objetivosCumplidos,
    volumenAcumulado,
  };
}

function cumpleCriterio(
  criterio: Criterio,
  estado: EstadoAlumnoGamificacion
): boolean {
  switch (criterio.tipo) {
    case "racha_dias":
      return estado.rachaDias >= criterio.valor;
    case "entrenamientos_totales":
      return estado.entrenamientosCompletados >= criterio.valor;
    case "puntos_totales":
      return estado.puntos_totales >= criterio.valor;
    case "objetivos_cumplidos":
      return estado.objetivosCumplidos >= criterio.valor;
    case "volumen_acumulado":
      return estado.volumenAcumulado >= criterio.valor;
    default:
      // Criterio desconocido: no se otorga (nunca rompe).
      return false;
  }
}

/**
 * Chequea todos los Logro del catálogo contra el estado actual del alumno
 * y asigna (vía LogroAlumno) los que correspondan y todavía no tenga.
 * Por cada logro nuevo dispara una notificación in-app + push usando el
 * mismo mecanismo de lib/notificaciones.ts.
 *
 * Es idempotente y no lanza: pensada para llamarse de forma oportunista
 * después de cualquier evento de actividad (igual que
 * verificarRecordatorioMembresia).
 */
export async function evaluarLogros(id_alumno: string): Promise<string[]> {
  const [estado, catalogo, yaObtenidos] = await Promise.all([
    reunirEstadoAlumno(id_alumno),
    prisma.logro.findMany({ where: { activo: true } }),
    prisma.logroAlumno.findMany({
      where: { id_alumno },
      select: { id_logro: true },
    }),
  ]);

  if (!estado) return [];

  const obtenidos = new Set(yaObtenidos.map((l) => l.id_logro));
  const nuevos: string[] = [];

  for (const logro of catalogo) {
    if (obtenidos.has(logro.id_logro)) continue;

    const criterio = logro.criterio as unknown as Criterio;
    if (!criterio || typeof criterio.valor !== "number") continue;
    if (!cumpleCriterio(criterio, estado)) continue;

    try {
      await prisma.logroAlumno.create({
        data: { id_alumno, id_logro: logro.id_logro },
      });
    } catch (err) {
      // Otra ejecución concurrente ya lo asignó — ok, seguimos.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }

    nuevos.push(logro.codigo);

    await crearNotificacion({
      id_usuario: estado.id_usuario,
      titulo: "¡Logro desbloqueado!",
      contenido: `${logro.titulo} — ${logro.descripcion}`,
      tipo: "logro",
      url: "/panel/logros",
    }).catch(() => {});
  }

  return nuevos;
}

/**
 * Otorga los puntos de un evento y re-evalúa los logros del alumno. Nunca
 * lanza: la gamificación es un extra, no debe tumbar la acción que la
 * disparó (registrar un entrenamiento, un hábito, un feedback).
 */
export async function registrarActividad(
  id_alumno: string,
  motivo: string,
  cantidad: number,
  descripcion?: string
): Promise<void> {
  try {
    await otorgarPuntos(id_alumno, motivo, cantidad, descripcion);
    await evaluarLogros(id_alumno);
  } catch {
    // Silencioso a propósito.
  }
}
