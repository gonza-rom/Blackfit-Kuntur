import type { DiaSemana, Prisma } from "@prisma/client";

// Helpers de servidor para el contenido de un día de la planificación
// (ejercicios individuales + bloques). Todos reciben el cliente de la
// transacción, así cada acción decide su propia atomicidad.

type Tx = Prisma.TransactionClient;

export const ORDEN_DIA_SEMANA: DiaSemana[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export const ETIQUETA_DIA_SEMANA: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

// ------------------------------------------------------------
// Payload que manda el editor del día (form-dia-plan.tsx)
// ------------------------------------------------------------

export type EjercicioDiaEntrada = {
  // Presente si la fila ya existía: se actualiza en su lugar en vez de
  // borrar y recrear, así las series ya registradas por el alumno siguen
  // apuntando al mismo ejercicio del plan.
  id_ejercicio_programa?: string;
  id_ejercicio: string;
  series: string;
  repeticiones: string;
  peso_sugerido: string;
  descanso: string;
  tempo: string;
  metodo_entrenamiento: string;
  tiempo_bajo_tension_sugerido: string;
  nota: string;
};

export type GrupoDiaEntrada = {
  id_grupo?: string;
  nombre: string;
  rondas: string;
  descanso_entre_ejercicios: string;
  descanso_entre_rondas: string;
  tempo: string;
  nota: string;
  ejercicios: EjercicioDiaEntrada[];
};

export type ItemDiaEntrada =
  | { tipo: "ejercicio"; ejercicio: EjercicioDiaEntrada }
  | ({ tipo: "grupo" } & GrupoDiaEntrada);

function texto(valor: string | null | undefined): string | null {
  const limpio = String(valor ?? "").trim();
  return limpio || null;
}

function entero(valor: string | null | undefined): number | null {
  const n = Number(String(valor ?? "").trim());
  return String(valor ?? "").trim() !== "" && Number.isFinite(n) ? Math.round(n) : null;
}

function decimal(valor: string | null | undefined): string | null {
  const limpio = String(valor ?? "").trim().replace(",", ".");
  return limpio !== "" && Number.isFinite(Number(limpio)) ? limpio : null;
}

// ------------------------------------------------------------
// Día (BloqueEntrenamiento) de una semana/grupo de semanas
// ------------------------------------------------------------

export async function obtenerOCrearDia(
  tx: Tx,
  id_programa: string,
  semana_inicio: number,
  semana_fin: number,
  dia_semana: DiaSemana
) {
  // No hay @@unique sobre (id_programa, semana_inicio, semana_fin,
  // dia_semana), así que "encontrar o crear" se resuelve a mano.
  const existente = await tx.bloqueEntrenamiento.findFirst({
    where: { id_programa, semana_inicio, semana_fin, dia_semana },
  });
  if (existente) return existente;
  return tx.bloqueEntrenamiento.create({
    data: {
      id_programa,
      nombre: ETIQUETA_DIA_SEMANA[dia_semana],
      orden: ORDEN_DIA_SEMANA.indexOf(dia_semana),
      semana_inicio,
      semana_fin,
      dia_semana,
    },
  });
}

// ------------------------------------------------------------
// Guardado completo del contenido de un día
// ------------------------------------------------------------

/**
 * Reemplaza el contenido del día por `items`, respetando el historial:
 * - Una fila que ya existía se ACTUALIZA en su lugar (mismo id), así el
 *   alumno recibe el cambio y sus series viejas siguen enganchadas.
 * - Si el coach cambió el ejercicio de una fila que ya tiene series
 *   registradas, no se reescribe (eso le "cambiaría el nombre" al
 *   historial): se archiva la vieja y se crea una nueva.
 * - Lo que el coach sacó se borra, salvo que tenga series registradas:
 *   ahí se archiva (oculto del plan, intacto para historial y PR).
 */
export async function guardarContenidoDia(tx: Tx, id_bloque: string, items: ItemDiaEntrada[]) {
  const existentes = await tx.ejercicioPrograma.findMany({
    where: { id_bloque, archivado: false },
    include: { _count: { select: { series_registradas: true } } },
  });
  const gruposExistentes = await tx.grupoEjercicios.findMany({ where: { id_bloque } });

  const existentePorId = new Map(existentes.map((e) => [e.id_ejercicio_programa, e]));
  const idsGruposExistentes = new Set(gruposExistentes.map((g) => g.id_grupo));
  const usados = new Set<string>();
  const gruposUsados = new Set<string>();
  let orden = 1;

  async function guardarEjercicio(
    e: EjercicioDiaEntrada,
    comun: { series: number; descanso: string | null; tempo: string | null; nota: string | null; id_grupo: string | null }
  ) {
    const data = {
      id_ejercicio: e.id_ejercicio,
      series: comun.series,
      repeticiones: e.repeticiones.trim(),
      peso_sugerido: decimal(e.peso_sugerido),
      descanso: comun.descanso,
      tempo: comun.tempo,
      metodo_entrenamiento: texto(e.metodo_entrenamiento),
      tiempo_bajo_tension_sugerido: entero(e.tiempo_bajo_tension_sugerido),
      nota: comun.nota,
      id_grupo: comun.id_grupo,
      orden: orden++,
    };

    const previo = e.id_ejercicio_programa ? existentePorId.get(e.id_ejercicio_programa) : undefined;
    const reutilizable =
      previo &&
      !usados.has(previo.id_ejercicio_programa) &&
      (previo.id_ejercicio === e.id_ejercicio || previo._count.series_registradas === 0);

    if (previo && reutilizable) {
      usados.add(previo.id_ejercicio_programa);
      await tx.ejercicioPrograma.update({
        where: { id_ejercicio_programa: previo.id_ejercicio_programa },
        data,
      });
    } else {
      await tx.ejercicioPrograma.create({ data: { ...data, id_bloque } });
    }
  }

  for (const item of items) {
    if (item.tipo === "ejercicio") {
      const e = item.ejercicio;
      if (!e.id_ejercicio || !e.repeticiones?.trim()) continue;
      await guardarEjercicio(e, {
        series: Math.max(1, entero(e.series) ?? 1),
        descanso: texto(e.descanso),
        tempo: texto(e.tempo),
        nota: texto(e.nota),
        id_grupo: null,
      });
      continue;
    }

    const validos = item.ejercicios.filter((e) => e.id_ejercicio && e.repeticiones?.trim());
    if (validos.length === 0) continue;
    const rondas = Math.max(1, entero(item.rondas) ?? 1);

    // Un "bloque" de un solo ejercicio es, por definición, un ejercicio
    // individual: se guarda así para que coach y alumno lo vean igual.
    if (validos.length === 1) {
      const e = validos[0];
      await guardarEjercicio(e, {
        series: rondas,
        descanso: texto(item.descanso_entre_rondas) ?? texto(e.descanso),
        tempo: texto(item.tempo) ?? texto(e.tempo),
        nota: [texto(item.nota), texto(e.nota)].filter(Boolean).join(" · ") || null,
        id_grupo: null,
      });
      continue;
    }

    const datosGrupo = {
      nombre: texto(item.nombre),
      rondas,
      descanso_entre_ejercicios: texto(item.descanso_entre_ejercicios),
      descanso_entre_rondas: texto(item.descanso_entre_rondas),
      tempo: texto(item.tempo),
      nota: texto(item.nota),
    };
    let id_grupo: string;
    if (item.id_grupo && idsGruposExistentes.has(item.id_grupo) && !gruposUsados.has(item.id_grupo)) {
      id_grupo = item.id_grupo;
      await tx.grupoEjercicios.update({ where: { id_grupo }, data: datosGrupo });
    } else {
      id_grupo = (await tx.grupoEjercicios.create({ data: { ...datosGrupo, id_bloque } })).id_grupo;
    }
    gruposUsados.add(id_grupo);

    for (const e of validos) {
      await guardarEjercicio(e, {
        series: rondas,
        descanso: datosGrupo.descanso_entre_ejercicios,
        tempo: datosGrupo.tempo,
        nota: texto(e.nota),
        id_grupo,
      });
    }
  }

  for (const e of existentes) {
    if (usados.has(e.id_ejercicio_programa)) continue;
    if (e._count.series_registradas > 0) {
      await tx.ejercicioPrograma.update({
        where: { id_ejercicio_programa: e.id_ejercicio_programa },
        data: { archivado: true, id_grupo: null },
      });
    } else {
      await tx.ejercicioPrograma.delete({ where: { id_ejercicio_programa: e.id_ejercicio_programa } });
    }
  }

  const gruposSobrantes = gruposExistentes.filter((g) => !gruposUsados.has(g.id_grupo)).map((g) => g.id_grupo);
  if (gruposSobrantes.length > 0) {
    await tx.grupoEjercicios.deleteMany({ where: { id_grupo: { in: gruposSobrantes } } });
  }
}

// ------------------------------------------------------------
// Clonado (plantillas, duplicar día, copiar bloque a otro día)
// ------------------------------------------------------------

type EjercicioClonable = {
  id_ejercicio: string;
  series: number;
  repeticiones: string;
  peso_sugerido: Prisma.Decimal | null;
  tempo: string | null;
  descanso: string | null;
  metodo_entrenamiento: string | null;
  tiempo_bajo_tension_sugerido: number | null;
  nota: string | null;
  orden: number;
  id_grupo: string | null;
  archivado: boolean;
};

type GrupoClonable = {
  id_grupo: string;
  nombre: string | null;
  rondas: number;
  descanso_entre_ejercicios: string | null;
  descanso_entre_rondas: string | null;
  tempo: string | null;
  nota: string | null;
};

function datosEjercicio(ep: EjercicioClonable) {
  return {
    id_ejercicio: ep.id_ejercicio,
    series: ep.series,
    repeticiones: ep.repeticiones,
    peso_sugerido: ep.peso_sugerido,
    tempo: ep.tempo,
    descanso: ep.descanso,
    metodo_entrenamiento: ep.metodo_entrenamiento,
    tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
    nota: ep.nota,
  };
}

/**
 * Copia ejercicios (y los bloques a los que pertenecen) al día destino,
 * a continuación de lo que ya tenga. Los archivados nunca se copian: son
 * solo historial.
 */
export async function clonarEjerciciosEnDia(
  tx: Tx,
  id_bloque_destino: string,
  ejercicios: EjercicioClonable[],
  grupos: GrupoClonable[]
) {
  const ultimo = await tx.ejercicioPrograma.aggregate({
    where: { id_bloque: id_bloque_destino },
    _max: { orden: true },
  });
  let orden = (ultimo._max.orden ?? 0) + 1;

  const grupoPorId = new Map(grupos.map((g) => [g.id_grupo, g]));
  const nuevoIdGrupo = new Map<string, string>();

  for (const ep of [...ejercicios].sort((a, b) => a.orden - b.orden)) {
    if (ep.archivado) continue;
    let id_grupo: string | null = null;
    const grupo = ep.id_grupo ? grupoPorId.get(ep.id_grupo) : undefined;
    if (grupo) {
      id_grupo = nuevoIdGrupo.get(grupo.id_grupo) ?? null;
      if (!id_grupo) {
        const creado = await tx.grupoEjercicios.create({
          data: {
            id_bloque: id_bloque_destino,
            nombre: grupo.nombre,
            rondas: grupo.rondas,
            descanso_entre_ejercicios: grupo.descanso_entre_ejercicios,
            descanso_entre_rondas: grupo.descanso_entre_rondas,
            tempo: grupo.tempo,
            nota: grupo.nota,
          },
        });
        id_grupo = creado.id_grupo;
        nuevoIdGrupo.set(grupo.id_grupo, id_grupo);
      }
    }
    await tx.ejercicioPrograma.create({
      data: { ...datosEjercicio(ep), id_bloque: id_bloque_destino, id_grupo, orden: orden++ },
    });
  }
}

/** Include estándar para leer un día con todo lo necesario para clonarlo. */
export const INCLUDE_DIA_CLONABLE = {
  ejercicios_programa: { where: { archivado: false }, orderBy: { orden: "asc" } },
  grupos: true,
} satisfies Prisma.BloqueEntrenamientoInclude;
