import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Alerta = {
  tipo: string;
  mensaje: string;
  severidad: "info" | "advertencia" | "critica";
};

export type EstadoAlumnoSemaforo = "progresando" | "estable" | "estancado";

export const ETIQUETA_ESTADO_SEMAFORO: Record<EstadoAlumnoSemaforo, string> = {
  progresando: "Progresando",
  estable: "Estable",
  estancado: "Estancado",
};

/** Semáforo simple para el resumen del alumno — se deriva de las mismas alertas, nunca de una regla aparte. */
export function calcularEstadoSemaforo(alertas: Alerta[]): EstadoAlumnoSemaforo {
  if (alertas.some((a) => a.severidad === "critica")) return "estancado";
  if (alertas.some((a) => a.severidad === "advertencia")) return "estable";
  return "progresando";
}

const DIA_MS = 1000 * 60 * 60 * 24;

const TIPOS_BLOQUE_DESCARGA = /deload|descarga/i;

type BloqueActual = { nombre: string; tipo: string | null } | null;

type ProgramaConBloques = Prisma.ProgramaEntrenamientoGetPayload<{
  include: { bloques: true };
}>;

type EntrenamientoConSeries = Prisma.EntrenamientoGetPayload<{
  include: { series: true };
}>;

/**
 * Determina si el alumno está, HOY, dentro de un bloque marcado como
 * deload/descarga en alguno de sus programas activos. Se calcula por
 * semana relativa a la fecha de inicio del programa (semana_inicio /
 * semana_fin del bloque). Si el bloque no tiene semanas definidas, no se
 * puede ubicar temporalmente y se ignora (no bloquea alertas por las dudas).
 */
function bloqueActualDesdePrograms(programas: ProgramaConBloques[]): BloqueActual {
  for (const programa of programas) {
    const semanaActual =
      Math.floor((Date.now() - programa.fecha_inicio.getTime()) / (7 * DIA_MS)) + 1;

    const bloque = programa.bloques.find(
      (b) =>
        b.semana_inicio != null &&
        b.semana_fin != null &&
        semanaActual >= b.semana_inicio &&
        semanaActual <= b.semana_fin
    );

    if (bloque) return { nombre: bloque.nombre, tipo: bloque.tipo };
  }

  return null;
}

async function obtenerBloqueActual(id_alumno: string): Promise<BloqueActual> {
  const programas = await prisma.programaEntrenamiento.findMany({
    where: { id_alumno, estado_programa: "activo" },
    include: { bloques: true },
    relationLoadStrategy: "join",
  });
  return bloqueActualDesdePrograms(programas);
}

type DatosAlertas = {
  entrenamientos: EntrenamientoConSeries[];
  feedbacksDiarios: { comentario_diario: string }[];
  habitosRecientes: number;
  bloqueActual: BloqueActual;
};

/**
 * Reglas simples y explicables sobre datos que el alumno ya registró —
 * sin caja negra. Cubre adherencia baja, estancamiento/caída de volumen,
 * fatiga elevada, dolor repetitivo y ausencias. Nunca decide nada por sí
 * sola: son señales para que el entrenador revise, la decisión final
 * siempre es humana.
 *
 * Antes de marcar una caída de volumen como alerta, el motor consulta si
 * el alumno está cursando un bloque de deload planificado (según el
 * programa vigente) o si la caída de volumen viene acompañada de un
 * aumento de peso (progresión de intensidad, no retroceso) — en ambos
 * casos no es una señal real y no debe generar ruido para el coach.
 *
 * Pura: no toca la base. `detectarAlertas` y `detectarAlertasPorAlumnos`
 * son los que juntan los datos (uno por alumno o batcheado para varios) y
 * llaman a esta misma función, así ambos caminos comparten exactamente la
 * misma lógica de reglas.
 */
function calcularAlertas({
  entrenamientos,
  feedbacksDiarios,
  habitosRecientes,
  bloqueActual,
}: DatosAlertas): Alerta[] {
  const enDeload = bloqueActual != null && TIPOS_BLOQUE_DESCARGA.test(bloqueActual.tipo ?? "");

  const alertas: Alerta[] = [];

  const ultimo = entrenamientos[0];
  if (!ultimo) {
    alertas.push({
      tipo: "ausencia",
      mensaje: "Sin entrenamientos registrados en los últimos 30 días.",
      severidad: "critica",
    });
  } else {
    const dias = Math.floor((Date.now() - ultimo.fecha.getTime()) / DIA_MS);
    if (dias >= 10) {
      alertas.push({
        tipo: "ausencia",
        mensaje: `${dias} días sin registrar un entrenamiento.`,
        severidad: "advertencia",
      });
    }
  }

  const completados = entrenamientos.filter((e) => e.estado === "completado").length;
  if (entrenamientos.length >= 3 && completados / entrenamientos.length < 0.6) {
    alertas.push({
      tipo: "adherencia",
      mensaje: "Menos del 60% de los entrenamientos registrados están completados.",
      severidad: "advertencia",
    });
  }

  const rpes = entrenamientos
    .flatMap((e) => e.series)
    .map((s) => s.rpe)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(Number);
  if (rpes.length >= 5) {
    const promedio = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    if (promedio >= 8.5) {
      alertas.push({
        tipo: "fatiga",
        mensaje: `RPE promedio de ${promedio.toFixed(1)} en las últimas sesiones.`,
        severidad: "advertencia",
      });
    }
  }

  const volumenes = entrenamientos.map((e) =>
    e.series.reduce(
      (acc, s) =>
        acc +
        Number(s.peso_utilizado ?? 0) *
          (s.repeticiones_realizadas ?? 0) *
          (s.series_completadas ?? 1),
      0
    )
  );
  // Peso promedio por serie registrada, para distinguir "cayó el volumen
  // porque bajó el rendimiento" de "cayó el volumen porque subió la
  // intensidad" (menos repeticiones, más peso: progresión válida).
  const pesoPromedio = (desde: number, hasta: number) => {
    const series = entrenamientos
      .slice(desde, hasta)
      .flatMap((e) => e.series)
      .map((s) => Number(s.peso_utilizado ?? 0))
      .filter((p) => p > 0);
    return series.length ? series.reduce((a, b) => a + b, 0) / series.length : 0;
  };

  if (volumenes.length >= 4) {
    const recientes = volumenes.slice(0, 2);
    const previos = volumenes.slice(2, 4);
    const avgReciente = recientes.reduce((a, b) => a + b, 0) / recientes.length;
    const avgPrevio = previos.reduce((a, b) => a + b, 0) / previos.length;

    if (avgPrevio > 0 && avgReciente < avgPrevio * 0.85) {
      if (enDeload) {
        // Caída de volumen esperada por el programa — no es una señal,
        // es el plan funcionando. Se informa igual pero sin alarmar.
        alertas.push({
          tipo: "volumen",
          mensaje: `Volumen bajo, coherente con el bloque de descarga vigente ("${bloqueActual?.nombre}").`,
          severidad: "info",
        });
      } else {
        const pesoReciente = pesoPromedio(0, 2);
        const pesoPrevio = pesoPromedio(2, 4);
        const progresionDeIntensidad = pesoPrevio > 0 && pesoReciente > pesoPrevio * 1.05;

        if (progresionDeIntensidad) {
          alertas.push({
            tipo: "volumen",
            mensaje:
              "Bajó el volumen pero subió el peso promedio utilizado — progresión de intensidad, no retroceso.",
            severidad: "info",
          });
        } else {
          alertas.push({
            tipo: "volumen",
            mensaje: "El volumen de entrenamiento cayó más de un 15% respecto a sesiones previas.",
            severidad: "advertencia",
          });
        }
      }
    }
  }

  const mencionesDolor = feedbacksDiarios.filter((f) =>
    /dolor/i.test(f.comentario_diario)
  ).length;
  if (mencionesDolor >= 2) {
    alertas.push({
      tipo: "dolor",
      mensaje: `Mencionó dolor en ${mencionesDolor} feedbacks de los últimos 14 días.`,
      severidad: "critica",
    });
  }

  if (habitosRecientes < 4) {
    alertas.push({
      tipo: "habitos",
      mensaje: "Registró hábitos menos de 4 veces en las últimas 2 semanas.",
      severidad: "info",
    });
  }

  const criticas = alertas.filter((a) => a.severidad === "critica").length;
  const señalesReales = alertas.filter((a) => a.severidad !== "info").length;
  if (criticas >= 1 && señalesReales >= 3) {
    alertas.unshift({
      tipo: "abandono",
      mensaje: "Combinación de señales — vale la pena un contacto personal esta semana.",
      severidad: "critica",
    });
  }

  return alertas;
}

/** Alertas de un solo alumno (perfil individual, ver /coach/alumnos/[id_alumno]). */
export async function detectarAlertas(id_alumno: string): Promise<Alerta[]> {
  const hace30 = new Date(Date.now() - 30 * DIA_MS);
  const hace14 = new Date(Date.now() - 14 * DIA_MS);

  const [entrenamientos, feedbacksDiarios, habitosRecientes, bloqueActual] = await Promise.all([
    prisma.entrenamiento.findMany({
      where: { id_alumno, fecha: { gte: hace30 } },
      include: { series: true },
      orderBy: { fecha: "desc" },
      relationLoadStrategy: "join",
    }),
    prisma.feedbackDiario.findMany({ where: { id_alumno, fecha: { gte: hace14 } } }),
    prisma.habito.count({ where: { id_alumno, fecha: { gte: hace14 } } }),
    obtenerBloqueActual(id_alumno),
  ]);

  return calcularAlertas({ entrenamientos, feedbacksDiarios, habitosRecientes, bloqueActual });
}

/**
 * Misma regla que detectarAlertas(), pero para varios alumnos de una sola
 * pasada: 4 queries en total (batcheadas con `id_alumno IN (...)`) en vez
 * de 4 × cantidad de alumnos. Pensada para listados como /coach y
 * /coach/alumnos, donde antes se llamaba detectarAlertas() una vez por
 * alumno dentro de un .map(), multiplicando los viajes a la base por la
 * cantidad de alumnos de la cartera.
 */
export async function detectarAlertasPorAlumnos(
  idsAlumnos: string[]
): Promise<Map<string, Alerta[]>> {
  if (idsAlumnos.length === 0) return new Map();

  const hace30 = new Date(Date.now() - 30 * DIA_MS);
  const hace14 = new Date(Date.now() - 14 * DIA_MS);

  const [entrenamientos, feedbacksDiarios, habitosRecientes, programasActivos] =
    await Promise.all([
      prisma.entrenamiento.findMany({
        where: { id_alumno: { in: idsAlumnos }, fecha: { gte: hace30 } },
        include: { series: true },
        orderBy: { fecha: "desc" },
        relationLoadStrategy: "join",
      }),
      prisma.feedbackDiario.findMany({
        where: { id_alumno: { in: idsAlumnos }, fecha: { gte: hace14 } },
        select: { id_alumno: true, comentario_diario: true },
      }),
      prisma.habito.groupBy({
        by: ["id_alumno"],
        where: { id_alumno: { in: idsAlumnos }, fecha: { gte: hace14 } },
        _count: { _all: true },
      }),
      prisma.programaEntrenamiento.findMany({
        where: { id_alumno: { in: idsAlumnos }, estado_programa: "activo" },
        include: { bloques: true },
        relationLoadStrategy: "join",
      }),
    ]);

  const entrenamientosPorAlumno = new Map<string, EntrenamientoConSeries[]>();
  for (const e of entrenamientos) {
    const lista = entrenamientosPorAlumno.get(e.id_alumno);
    if (lista) lista.push(e);
    else entrenamientosPorAlumno.set(e.id_alumno, [e]);
  }

  const feedbacksPorAlumno = new Map<string, { comentario_diario: string }[]>();
  for (const f of feedbacksDiarios) {
    const lista = feedbacksPorAlumno.get(f.id_alumno);
    if (lista) lista.push(f);
    else feedbacksPorAlumno.set(f.id_alumno, [f]);
  }

  const habitosPorAlumno = new Map(habitosRecientes.map((h) => [h.id_alumno, h._count._all]));

  const programasPorAlumno = new Map<string, ProgramaConBloques[]>();
  for (const p of programasActivos) {
    if (!p.id_alumno) continue;
    const lista = programasPorAlumno.get(p.id_alumno);
    if (lista) lista.push(p);
    else programasPorAlumno.set(p.id_alumno, [p]);
  }

  const resultado = new Map<string, Alerta[]>();
  for (const id_alumno of idsAlumnos) {
    resultado.set(
      id_alumno,
      calcularAlertas({
        entrenamientos: entrenamientosPorAlumno.get(id_alumno) ?? [],
        feedbacksDiarios: feedbacksPorAlumno.get(id_alumno) ?? [],
        habitosRecientes: habitosPorAlumno.get(id_alumno) ?? 0,
        bloqueActual: bloqueActualDesdePrograms(programasPorAlumno.get(id_alumno) ?? []),
      })
    );
  }
  return resultado;
}
