import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearNotificacion } from "@/lib/notificaciones";
import { notificarNuevosPR } from "@/lib/gamificacion";
import { obtenerRmVigentes, LEVANTAMIENTOS } from "@/lib/rm-referencia";
import { detectarLevantamiento, NOMBRE_LEVANTAMIENTO, type Levantamiento } from "@/lib/progresion-fuerza";
import { detectarRecords, type SerieReal } from "@/lib/records";

export type SerieNueva = SerieReal & { id_serie?: string | null };

// Origen de las series nuevas: un entrenamiento guardado, o una marca que
// registró el alumno a mano (con la clave del formulario).
type Origen = { id_entrenamiento: string } | { clave_operacion: string };

/**
 * Series anteriores REALES de cada levantamiento (todas las series
 * registradas de ejercicios que son sentadilla / banca / peso muerto, más
 * las marcas registradas a mano), sin contar el entrenamiento indicado.
 */
async function seriesPrevias(
  id_alumno: string,
  excluirEntrenamiento: string | null
): Promise<Record<Levantamiento, SerieReal[]>> {
  const [series, marcas] = await Promise.all([
    prisma.serieEntrenamiento.findMany({
      where: {
        entrenamiento: {
          id_alumno,
          estado: "completado",
          ...(excluirEntrenamiento ? { NOT: { id_entrenamiento: excluirEntrenamiento } } : {}),
        },
        peso_utilizado: { not: null },
        repeticiones_realizadas: { not: null },
      },
      select: {
        peso_utilizado: true,
        repeticiones_realizadas: true,
        ejercicio_programa: { select: { ejercicio: { select: { nombre: true } } } },
      },
    }),
    prisma.recordPersonal.findMany({
      where: { id_alumno, id_entrenamiento: null },
      select: { levantamiento: true, peso_kg: true, repeticiones: true },
    }),
  ]);
  const salida = Object.fromEntries(LEVANTAMIENTOS.map((l) => [l, []])) as unknown as Record<
    Levantamiento,
    SerieReal[]
  >;
  for (const s of series) {
    const l = detectarLevantamiento(s.ejercicio_programa.ejercicio.nombre);
    if (l) salida[l].push({ peso: Number(s.peso_utilizado), reps: s.repeticiones_realizadas ?? 0 });
  }
  for (const m of marcas) salida[m.levantamiento].push({ peso: Number(m.peso_kg), reps: m.repeticiones });
  return salida;
}

export type RecordAplicado = {
  levantamiento: Levantamiento;
  prCarga: { peso: number; reps: number } | null;
  prRepeticiones: { peso: number; reps: number } | null;
  nuevoRm: { valor: number; fuente: "medido" | "estimado"; anterior: number | null } | null;
};

/**
 * Detecta y GUARDA los récords de las series nuevas, por levantamiento:
 * PR de carga / repeticiones y, si la serie supera al 1RM vigente, un 1RM
 * nuevo (medido o estimado) que pasa a regir enseguida — así las cargas de
 * las sesiones futuras se recalculan solas (se calculan al mostrarlas) y lo
 * ya entrenado no cambia. No toca la semana del ciclo.
 * Idempotente: el mismo entrenamiento (o la misma marca) procesado dos
 * veces no duplica nada (índices únicos + skipDuplicates).
 */
export async function aplicarRecords(
  id_alumno: string,
  id_usuario_autor: string,
  nuevas: Partial<Record<Levantamiento, SerieNueva[]>>,
  origen: Origen
): Promise<RecordAplicado[]> {
  const levantamientos = LEVANTAMIENTOS.filter((l) => (nuevas[l]?.length ?? 0) > 0);
  if (levantamientos.length === 0) return [];

  const id_entrenamiento = "id_entrenamiento" in origen ? origen.id_entrenamiento : null;
  const clave = "clave_operacion" in origen ? origen.clave_operacion : null;
  const [previas, vigentes] = await Promise.all([seriesPrevias(id_alumno, id_entrenamiento), obtenerRmVigentes(id_alumno)]);
  const ahora = new Date();

  const aplicados: RecordAplicado[] = [];
  const records: Prisma.RecordPersonalCreateManyInput[] = [];
  const rms: Prisma.RmReferenciaCreateManyInput[] = [];

  for (const l of levantamientos) {
    const lista = nuevas[l]!;
    const r = detectarRecords(previas[l], lista, vigentes[l]?.valor ?? null);
    if (!r.prCarga && !r.prRepeticiones && !r.nuevoRm) continue;
    aplicados.push({
      levantamiento: l,
      prCarga: r.prCarga && { peso: r.prCarga.peso, reps: r.prCarga.reps },
      prRepeticiones: r.prRepeticiones && { peso: r.prRepeticiones.peso, reps: r.prRepeticiones.reps },
      nuevoRm: r.nuevoRm && { valor: r.nuevoRm.valor, fuente: r.nuevoRm.fuente, anterior: r.nuevoRm.anterior },
    });
    for (const [tipo, rec] of [
      ["carga", r.prCarga],
      ["repeticiones", r.prRepeticiones],
    ] as const) {
      if (!rec) continue;
      records.push({
        id_alumno,
        levantamiento: l,
        tipo,
        peso_kg: String(rec.peso),
        repeticiones: rec.reps,
        valor_anterior: rec.anterior === null ? null : String(rec.anterior),
        fecha: ahora,
        id_entrenamiento,
        id_serie: lista[rec.indice]?.id_serie ?? null,
        // Una marca manual genera a lo sumo un récord por tipo.
        clave_operacion: clave ? `${clave}:${tipo}` : null,
      });
    }
    if (r.nuevoRm) {
      rms.push({
        id_alumno,
        levantamiento: l,
        valor_kg: String(r.nuevoRm.valor),
        valor_anterior: r.nuevoRm.anterior === null ? null : String(r.nuevoRm.anterior),
        fuente: r.nuevoRm.fuente,
        estado: "validado",
        fecha: ahora,
        origen: id_entrenamiento ? "entrenamiento" : "alumno",
        peso_registrado: String(r.nuevoRm.peso),
        repeticiones_registradas: r.nuevoRm.reps,
        id_entrenamiento,
        clave_operacion: clave,
        id_usuario_autor,
      });
    }
  }
  if (aplicados.length === 0) return [];

  const [creadosRecords, creadosRm] = await prisma.$transaction([
    prisma.recordPersonal.createMany({ data: records, skipDuplicates: true }),
    prisma.rmReferencia.createMany({ data: rms, skipDuplicates: true }),
  ]);
  // Ya estaba procesado (resincronización): nada nuevo, nada que avisar.
  if (creadosRecords.count === 0 && creadosRm.count === 0) return [];
  return aplicados;
}

/** Avisos al alumno y a su coach de los récords / 1RM nuevos. Nunca lanza. */
export async function notificarRecords(id_alumno: string, aplicados: RecordAplicado[]): Promise<void> {
  if (aplicados.length === 0) return;
  try {
    await notificarNuevosPR(
      id_alumno,
      aplicados.flatMap((a) =>
        a.prCarga ? [{ nombreEjercicio: NOMBRE_LEVANTAMIENTO[a.levantamiento], peso: a.prCarga.peso }] : []
      )
    );
    const alumno = await prisma.alumno.findUnique({
      where: { id_alumno },
      select: {
        id_usuario: true,
        usuario: { select: { nombre: true, apellido: true } },
        relaciones: {
          where: { estado_relacion: "activa" },
          select: { entrenador: { select: { id_usuario: true } } },
          take: 1,
        },
      },
    });
    if (!alumno) return;
    const idCoach = alumno.relaciones[0]?.entrenador.id_usuario ?? null;
    for (const a of aplicados) {
      const nombre = NOMBRE_LEVANTAMIENTO[a.levantamiento];
      if (a.prRepeticiones) {
        await crearNotificacion({
          id_usuario: alumno.id_usuario,
          titulo: "¡PR de repeticiones!",
          contenido: `${nombre}: ${a.prRepeticiones.reps} reps con ${a.prRepeticiones.peso} kg.`,
          tipo: "pr",
          url: "/panel/entrenamientos",
        }).catch(() => {});
      }
      if (a.nuevoRm) {
        const texto = `${nombre}: ${a.nuevoRm.anterior ?? "—"} → ${a.nuevoRm.valor} kg (${a.nuevoRm.fuente}).`;
        await crearNotificacion({
          id_usuario: alumno.id_usuario,
          titulo: "Tu 1RM subió",
          contenido: `${texto} Tus próximas cargas ya están recalculadas.`,
          tipo: "progresion",
          url: "/panel/entrenamientos",
        }).catch(() => {});
        if (idCoach) {
          await crearNotificacion({
            id_usuario: idCoach,
            titulo: "1RM actualizado automáticamente",
            contenido: `${alumno.usuario.nombre} ${alumno.usuario.apellido} · ${texto}`,
            tipo: "progresion",
            url: `/coach/alumnos/${id_alumno}?tab=planificacion`,
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Silencioso: los avisos nunca rompen el guardado.
  }
}

export type ResumenRecord = {
  levantamiento: Levantamiento;
  prCarga: { peso: number; reps: number; fecha: Date } | null;
  prRepeticiones: { peso: number; reps: number; fecha: Date } | null;
};

/**
 * Mayor peso levantado de cada levantamiento (sobre TODO el historial real,
 * también el anterior a los récords automáticos) y el último PR de
 * repeticiones registrado.
 */
export async function resumenRecords(id_alumno: string): Promise<ResumenRecord[]> {
  const [series, marcas, ultimosReps] = await Promise.all([
    prisma.serieEntrenamiento.findMany({
      where: {
        entrenamiento: { id_alumno, estado: "completado" },
        peso_utilizado: { not: null },
        repeticiones_realizadas: { not: null },
      },
      select: {
        peso_utilizado: true,
        repeticiones_realizadas: true,
        entrenamiento: { select: { fecha: true } },
        ejercicio_programa: { select: { ejercicio: { select: { nombre: true } } } },
      },
    }),
    prisma.recordPersonal.findMany({
      where: { id_alumno, id_entrenamiento: null },
      select: { levantamiento: true, peso_kg: true, repeticiones: true, fecha: true },
    }),
    prisma.recordPersonal.findMany({
      where: { id_alumno, tipo: "repeticiones" },
      orderBy: { fecha: "desc" },
      distinct: ["levantamiento"],
      select: { levantamiento: true, peso_kg: true, repeticiones: true, fecha: true },
    }),
  ]);
  const mejor = new Map<Levantamiento, { peso: number; reps: number; fecha: Date }>();
  const considerar = (l: Levantamiento, peso: number, reps: number, fecha: Date) => {
    const actual = mejor.get(l);
    if (!actual || peso > actual.peso || (peso === actual.peso && reps > actual.reps)) mejor.set(l, { peso, reps, fecha });
  };
  for (const s of series) {
    const l = detectarLevantamiento(s.ejercicio_programa.ejercicio.nombre);
    if (l && s.repeticiones_realizadas && s.repeticiones_realizadas > 0) {
      considerar(l, Number(s.peso_utilizado), s.repeticiones_realizadas, s.entrenamiento.fecha);
    }
  }
  for (const m of marcas) considerar(m.levantamiento, Number(m.peso_kg), m.repeticiones, m.fecha);
  return LEVANTAMIENTOS.map((l) => {
    const r = ultimosReps.find((x) => x.levantamiento === l);
    return {
      levantamiento: l,
      prCarga: mejor.get(l) ?? null,
      prRepeticiones: r ? { peso: Number(r.peso_kg), reps: r.repeticiones, fecha: r.fecha } : null,
    };
  });
}
