import { prisma } from "@/lib/prisma";

export type Alerta = {
  tipo: string;
  mensaje: string;
  severidad: "info" | "advertencia" | "critica";
};

const DIA_MS = 1000 * 60 * 60 * 24;

/**
 * Reglas simples y explicables sobre datos que el alumno ya registró —
 * sin caja negra. Cubre adherencia baja, estancamiento/caída de volumen,
 * fatiga elevada, dolor repetitivo y ausencias. Nunca decide nada por sí
 * sola: son señales para que el entrenador revise, la decisión final
 * siempre es humana.
 */
export async function detectarAlertas(id_alumno: string): Promise<Alerta[]> {
  const hace30 = new Date(Date.now() - 30 * DIA_MS);
  const hace14 = new Date(Date.now() - 14 * DIA_MS);

  const [entrenamientos, feedbacksDiarios, habitosRecientes] = await Promise.all([
    prisma.entrenamiento.findMany({
      where: { id_alumno, fecha: { gte: hace30 } },
      include: { series: true },
      orderBy: { fecha: "desc" },
    }),
    prisma.feedbackDiario.findMany({ where: { id_alumno, fecha: { gte: hace14 } } }),
    prisma.habito.count({ where: { id_alumno, fecha: { gte: hace14 } } }),
  ]);

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
  if (volumenes.length >= 4) {
    const recientes = volumenes.slice(0, 2);
    const previos = volumenes.slice(2, 4);
    const avgReciente = recientes.reduce((a, b) => a + b, 0) / recientes.length;
    const avgPrevio = previos.reduce((a, b) => a + b, 0) / previos.length;
    if (avgPrevio > 0 && avgReciente < avgPrevio * 0.85) {
      alertas.push({
        tipo: "volumen",
        mensaje: "El volumen de entrenamiento cayó más de un 15% respecto a sesiones previas.",
        severidad: "advertencia",
      });
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
  if (criticas >= 1 && alertas.length >= 3) {
    alertas.unshift({
      tipo: "abandono",
      mensaje: "Combinación de señales — vale la pena un contacto personal esta semana.",
      severidad: "critica",
    });
  }

  return alertas;
}
