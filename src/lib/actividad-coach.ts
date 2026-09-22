import { prisma } from "@/lib/prisma";

export type ItemActividad = {
  tipo: "completo" | "pr" | "racha" | "pendiente";
  id_alumno: string;
  mensaje: string;
};

function inicioDelDia(fecha = new Date()): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Feed de actividad del día para el inicio del coach: quién terminó su
 * entrenamiento hoy, quién hizo un PR, quién lleva racha y quién todavía
 * no entrenó. Se recalcula en cada carga de la página (sin caché) porque
 * el volumen de alumnos por coach es chico.
 */
export async function obtenerFeedActividad(
  alumnos: { id_alumno: string; nombre: string }[]
): Promise<ItemActividad[]> {
  const hoyInicio = inicioDelDia();
  const hoyFin = new Date(hoyInicio);
  hoyFin.setDate(hoyFin.getDate() + 1);

  const resultados = await Promise.all(
    alumnos.map(async (a) => {
      const items: ItemActividad[] = [];

      const [entrenamientoHoy, entrenamientosPrevios] = await Promise.all([
        prisma.entrenamiento.findFirst({
          where: {
            id_alumno: a.id_alumno,
            estado: "completado",
            fecha: { gte: hoyInicio, lt: hoyFin },
          },
          select: {
            id_entrenamiento: true,
            series: {
              where: { peso_utilizado: { not: null } },
              select: {
                peso_utilizado: true,
                ejercicio_programa: { select: { ejercicio: { select: { id_ejercicio: true, nombre: true } } } },
              },
            },
          },
        }),
        prisma.entrenamiento.findMany({
          where: { id_alumno: a.id_alumno, estado: "completado" },
          select: { fecha: true },
          orderBy: { fecha: "desc" },
          take: 60,
        }),
      ]);

      // Racha: días consecutivos con entrenamiento, contando desde hoy (o
      // ayer si hoy todavía no entrenó) hacia atrás.
      const diasConEntrenamiento = new Set(
        entrenamientosPrevios.map((e) => e.fecha.toISOString().slice(0, 10))
      );
      let racha = 0;
      const cursor = new Date(hoyInicio);
      if (!diasConEntrenamiento.has(cursor.toISOString().slice(0, 10))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (diasConEntrenamiento.has(cursor.toISOString().slice(0, 10))) {
        racha++;
        cursor.setDate(cursor.getDate() - 1);
      }

      if (entrenamientoHoy) {
        items.push({
          tipo: "completo",
          id_alumno: a.id_alumno,
          mensaje: `${a.nombre} terminó su entrenamiento`,
        });

        if (entrenamientoHoy.series.length > 0) {
          const maximoHistorico = await prisma.serieEntrenamiento.findMany({
            where: {
              entrenamiento: {
                id_alumno: a.id_alumno,
                NOT: { id_entrenamiento: entrenamientoHoy.id_entrenamiento },
              },
              peso_utilizado: { not: null },
            },
            select: {
              peso_utilizado: true,
              ejercicio_programa: { select: { ejercicio: { select: { id_ejercicio: true } } } },
            },
          });
          const maximosPrevios = new Map<string, number>();
          for (const s of maximoHistorico) {
            if (s.peso_utilizado === null) continue;
            const id = s.ejercicio_programa.ejercicio.id_ejercicio;
            const peso = Number(s.peso_utilizado);
            const actual = maximosPrevios.get(id);
            if (!actual || peso > actual) maximosPrevios.set(id, peso);
          }

          const maximosHoy = new Map<string, { peso: number; nombre: string }>();
          for (const s of entrenamientoHoy.series) {
            if (s.peso_utilizado === null) continue;
            const ej = s.ejercicio_programa.ejercicio;
            const peso = Number(s.peso_utilizado);
            const actual = maximosHoy.get(ej.id_ejercicio);
            if (!actual || peso > actual.peso) maximosHoy.set(ej.id_ejercicio, { peso, nombre: ej.nombre });
          }

          for (const [id_ejercicio, hoy] of maximosHoy) {
            const previo = maximosPrevios.get(id_ejercicio);
            if (previo !== undefined && hoy.peso > previo) {
              items.push({
                tipo: "pr",
                id_alumno: a.id_alumno,
                mensaje: `${a.nombre} hizo PR en ${hoy.nombre} (${hoy.peso}kg)`,
              });
            }
          }
        }
      } else {
        items.push({
          tipo: "pendiente",
          id_alumno: a.id_alumno,
          mensaje: `${a.nombre} todavía no entrenó hoy`,
        });
      }

      if (racha >= 3) {
        items.push({
          tipo: "racha",
          id_alumno: a.id_alumno,
          mensaje: `${a.nombre} lleva ${racha} días consecutivos`,
        });
      }

      return items;
    })
  );

  const prioridad: Record<ItemActividad["tipo"], number> = {
    pr: 0,
    completo: 1,
    racha: 2,
    pendiente: 3,
  };

  return resultados.flat().sort((a, b) => prioridad[a.tipo] - prioridad[b.tipo]);
}
