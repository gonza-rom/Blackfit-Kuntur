import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas, calcularEstadoSemaforo, ETIQUETA_ESTADO_SEMAFORO } from "@/lib/alertas";
import { urlesFirmadasFotos } from "@/lib/storage";
import { calcularSemanaYDiasActivos, inicioCicloPrograma } from "@/lib/alumno";
import { posicionCiclo, NOMBRE_SEMANA } from "@/lib/progresion-fuerza";
import { obtenerOCrearProgramaActivo } from "@/app/actions/coach";
import { ObjetivosAlumno, type ObjetivoSerializado } from "./_components/objetivos-alumno";
import { BotonDesvincular } from "./_components/boton-desvincular";
import { DatosAlumno } from "./_components/datos-alumno";
import {
  ProgresoFisicoCoach,
  type ProgresoSerializado,
} from "./_components/progreso-fisico-coach";
import { ItemFeedbackSemanal } from "./_components/item-feedback-semanal";
import {
  LogrosAlumnoCoach,
  type LogroCatalogoItem,
  type LogroObtenidoItem,
} from "./_components/logros-alumno-coach";
import { TabsAlumno } from "./_components/tabs-alumno";
import { PlanificacionTab } from "./_components/planificacion-tab";
import { FotosTab, type FotoSerializada } from "./_components/fotos-tab";
import { RmReferenciaCoach, type RmSerializado, type PropuestaRm } from "./_components/rm-referencia-coach";
import {
  obtenerHistorialRm,
  obtenerRmVigentes,
  cargasAfectadasPorRm,
  obtenerPasoRedondeo,
} from "@/lib/rm-referencia";
import type { Levantamiento } from "@/lib/progresion-fuerza";
import { etiquetaSesion, posicionSecuencia, sesionesDeSemana } from "@/lib/secuencia";
import {
  obtenerMembresiaBlackfit,
  claseEstadoMembresia,
  textoEstadoMembresia,
} from "@/lib/membresia";
import { suspenderMembresiaBlackfit, reanudarMembresiaBlackfit } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";
import { ActivarMembresia } from "../_components/activar-membresia";
import type { FilaSeguimiento } from "./_components/planificacion-tab";

const FORMATEADOR_FECHA_HORA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

// "jueves 22 de octubre": la fecha real en que entrenó, aparte del Día N.
const FORMATEADOR_FECHA_SESION = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

const CAMPOS_PROGRESO = [
  "peso_corporal",
  "imc",
  "pulso",
  "porcentaje_graso",
  "porcentaje_agua",
  "porcentaje_musculo",
  "masa_osea",
  "metabolismo_basal",
  "metabolismo_activo",
  "grasa_visceral",
  "edad_metabolica",
  "soft_lean_mass",
  "lean_body_mass",
  "proteina",
  "masa_muscular",
] as const;

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

const ANGULOS_FOTO = ["frente", "espalda", "perfil_izquierdo", "perfil_derecho"];

const ANCHO_SPARKLINE = 280;
const ALTO_SPARKLINE = 60;

const SENSACION_EMOJI: Record<number, string> = {
  1: "😫",
  2: "😕",
  3: "🙂",
  4: "😃",
  5: "🤩",
};

const COLOR_SEMAFORO: Record<string, string> = {
  progresando: "text-primary-container border-primary-container/40 bg-primary-container/5",
  estable: "text-[#eda100] border-[#eda100]/40 bg-[#eda100]/5",
  estancado: "text-[#ffb4ab] border-[#ffb4ab]/40 bg-[#ffb4ab]/5",
};
const ICONO_SEMAFORO: Record<string, string> = {
  progresando: "trending_up",
  estable: "trending_flat",
  estancado: "trending_down",
};

function puntosSparkline(valores: number[]): string {
  if (valores.length < 2) return "";
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  return valores
    .map((valor, i) => {
      const x = (i / (valores.length - 1)) * ANCHO_SPARKLINE;
      const y = ALTO_SPARKLINE - ((valor - min) / rango) * ALTO_SPARKLINE;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function inicioDelDia(fecha = new Date()): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calcularEdad(fechaNacimiento: Date | null): number | null {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const aunNoCumplio =
    hoy.getMonth() < fechaNacimiento.getMonth() ||
    (hoy.getMonth() === fechaNacimiento.getMonth() && hoy.getDate() < fechaNacimiento.getDate());
  if (aunNoCumplio) edad--;
  return edad;
}

export default async function AlumnoDetallePage(
  props: PageProps<"/coach/alumnos/[id_alumno]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;
  const sp = await props.searchParams;
  const tabInicial = typeof sp.tab === "string" ? sp.tab : "resumen";

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: {
        id_entrenador: contexto.id_entrenador,
        id_alumno,
      },
    },
    include: { alumno: { include: { usuario: true } } },
  });

  if (!relacion || relacion.estado_relacion !== "activa") {
    notFound();
  }

  const hoy = inicioDelDia();
  const inicioSemanaActual = new Date(hoy);
  inicioSemanaActual.setDate(inicioSemanaActual.getDate() - 6);

  const semanas = [0, 1, 2, 3].map((i) => {
    const fin = new Date(hoy);
    fin.setDate(fin.getDate() - i * 7 + 1);
    const inicio = new Date(fin);
    inicio.setDate(inicio.getDate() - 7);
    return { inicio, fin };
  });

  const programaActivo = await obtenerOCrearProgramaActivo(id_alumno, contexto.id_entrenador);

  const [rmVigentes, historialRm, cargasAfectadas, pasoRedondeo] = await Promise.all([
    obtenerRmVigentes(id_alumno),
    obtenerHistorialRm(id_alumno),
    cargasAfectadasPorRm(id_alumno),
    obtenerPasoRedondeo(contexto.id_entrenador),
  ]);
  const rmsSerializados: RmSerializado[] = (["sentadilla", "press_banca", "peso_muerto"] as Levantamiento[]).map(
    (levantamiento) => {
      const vigente = rmVigentes[levantamiento];
      return {
        levantamiento,
        vigente: vigente
          ? { valor: vigente.valor, fechaLabel: FORMATEADOR_FECHA.format(vigente.fecha), fuente: vigente.fuente }
          : null,
        historial: historialRm
          .filter((h) => h.levantamiento === levantamiento)
          .map((h) => ({
            id_rm: h.id_rm,
            valor: h.valor_kg,
            anterior: h.valor_anterior,
            fuente: h.fuente,
            estado: h.estado,
            fechaLabel: FORMATEADOR_FECHA.format(h.estado === "validado" ? h.fecha : h.fecha_registro),
          })),
      };
    }
  );
  const propuestasRm: PropuestaRm[] = historialRm
    .filter((h) => h.estado === "propuesto")
    .map((h) => ({
      id_rm: h.id_rm,
      levantamiento: h.levantamiento,
      valor: h.valor_kg,
      fuente: h.fuente,
      fechaLabel: FORMATEADOR_FECHA.format(h.fecha_registro),
    }));

  const [
    ultimaSesion,
    totalSesiones,
    sesionesPorSemana,
    progresos,
    medidas,
    fotosAngulo,
    habitosSemana,
    feedbackDiarios,
    feedbackSemanales,
    alertas,
    objetivos,
    seriesConPeso,
    programaConBloques,
    sesionesEjecucion,
    catalogoLogros,
    logrosObtenidos,
    sesionesDelPlan,
  ] = await Promise.all([
    prisma.entrenamiento.findFirst({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      select: { fecha: true, nombre: true },
    }),
    prisma.entrenamiento.count({ where: { id_alumno } }),
    Promise.all(
      semanas.map(({ inicio, fin }) =>
        prisma.entrenamiento.count({
          where: { id_alumno, fecha: { gte: inicio, lt: fin } },
        })
      )
    ),
    prisma.progresoFisico.findMany({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      take: 10,
    }),
    prisma.medidaCorporal.findMany({
      where: { id_alumno, tipo_medida: { notIn: ANGULOS_FOTO } },
      orderBy: { fecha: "desc" },
      take: 5,
    }),
    prisma.medidaCorporal.findMany({
      where: { id_alumno, tipo_medida: { in: ANGULOS_FOTO } },
      orderBy: { fecha: "desc" },
      take: 40,
    }),
    prisma.habito.findMany({
      where: { id_alumno, fecha: { gte: inicioSemanaActual } },
      orderBy: { fecha: "desc" },
    }),
    prisma.feedbackDiario.findMany({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      take: 5,
    }),
    prisma.feedbackSemanal.findMany({
      where: { id_alumno },
      orderBy: { semana_inicio: "desc" },
      take: 5,
    }),
    detectarAlertas(id_alumno),
    prisma.objetivo.findMany({
      where: { id_alumno },
      orderBy: [{ estado: "asc" }, { fecha_creacion: "desc" }],
    }),
    // Objetivo (peso_sugerido, lo carga el coach en el programa) vs.
    // ejecución (peso_utilizado, lo carga el alumno al entrenar) — series
    // reales más recientes por ejercicio, para ver la progresión de fuerza.
    prisma.serieEntrenamiento.findMany({
      where: { entrenamiento: { id_alumno }, peso_utilizado: { not: null } },
      orderBy: { entrenamiento: { fecha: "desc" } },
      take: 300,
      select: {
        peso_utilizado: true,
        repeticiones_realizadas: true,
        entrenamiento: { select: { fecha: true } },
        ejercicio_programa: {
          select: {
            peso_sugerido: true,
            ejercicio: { select: { id_ejercicio: true, nombre: true } },
          },
        },
      },
    }),
    prisma.programaEntrenamiento.findUnique({
      where: { id_programa: programaActivo.id_programa },
      include: {
        bloques: {
          include: { _count: { select: { ejercicios_programa: { where: { archivado: false } } } } },
        },
      },
    }),
    // Tab "Ejecución": últimas sesiones completadas, con cada serie real
    // (numero_serie) para comparar contra lo prescrito por el coach.
    prisma.entrenamiento.findMany({
      where: { id_alumno, estado: "completado" },
      orderBy: { fecha: "desc" },
      take: 6,
      select: {
        id_entrenamiento: true,
        fecha: true,
        nombre: true,
        comentarios: true,
        sensacion_general: true,
        semana_programa: true,
        numero_dia: true,
        series: {
          orderBy: [{ id_ejercicio_programa: "asc" }, { numero_serie: "asc" }],
          select: {
            id_serie: true,
            numero_serie: true,
            numero_ronda: true,
            peso_utilizado: true,
            repeticiones_realizadas: true,
            comentarios: true,
            id_ejercicio_programa: true,
            tipo_serie: true,
            porcentaje_objetivo: true,
            peso_objetivo: true,
            repeticiones_objetivo: true,
            agregada_por_alumno: true,
            aproximaciones_plan: true,
            ejercicio_programa: {
              select: {
                series: true,
                repeticiones: true,
                peso_sugerido: true,
                ejercicio: { select: { nombre: true } },
              },
            },
          },
        },
      },
    }),
    prisma.logro.findMany({
      where: { activo: true },
      orderBy: { fecha_creacion: "asc" },
      select: { id_logro: true, titulo: true, icono: true, color: true },
    }),
    prisma.logroAlumno.findMany({
      where: { id_alumno },
      orderBy: { fecha_obtenido: "desc" },
      select: {
        id_logro: true,
        fecha_obtenido: true,
        logro: { select: { titulo: true, icono: true, color: true } },
      },
    }),
    // Seguimiento de la secuencia: sesiones del plan completadas (Día N),
    // en el orden en que las hizo, con su fecha real.
    prisma.entrenamiento.findMany({
      where: { id_programa: programaActivo.id_programa, estado: "completado", numero_dia: { not: null } },
      orderBy: { fecha: "asc" },
      select: { id_bloque: true, numero_dia: true, semana_programa: true, fecha: true },
    }),
  ]);

  const { usuario } = relacion.alumno;
  // Mismo estado que Coach → Alumnos, el perfil del alumno y el bloqueo del servidor.
  const estadoMembresia = await obtenerMembresiaBlackfit(usuario.id_usuario);
  const historialMembresias = await prisma.membresia.findMany({
    where: { id_usuario: usuario.id_usuario, plan_membresia: { organizacion: "blackfit" } },
    orderBy: { fecha_creacion: "desc" },
    take: 20,
  });
  const idsOperadores = [
    ...new Set(
      historialMembresias.flatMap((m) => [m.id_usuario_operador, m.id_usuario_suspension]).filter((x): x is string => !!x)
    ),
  ];
  const operadores = new Map(
    (
      await prisma.usuario.findMany({
        where: { id_usuario: { in: idsOperadores } },
        select: { id_usuario: true, nombre: true, apellido: true },
      })
    ).map((u) => [u.id_usuario, `${u.nombre} ${u.apellido}`])
  );

  const urlesFotos = await urlesFirmadasFotos(medidas.map((m) => m.foto_url));
  const urlesFotosAngulo = await urlesFirmadasFotos(fotosAngulo.map((m) => m.foto_url));

  const progresosSerializados: ProgresoSerializado[] = progresos.map((p) => {
    const valores: Record<string, string | null> = {};
    for (const campo of CAMPOS_PROGRESO) {
      const v = (p as Record<string, unknown>)[campo];
      valores[campo] = v === null || v === undefined ? null : String(v);
    }
    return {
      id_progreso: p.id_progreso,
      fecha: p.fecha.toISOString().slice(0, 10),
      fechaLabel: FORMATEADOR_FECHA.format(p.fecha),
      origen: p.origen,
      valores: valores as ProgresoSerializado["valores"],
    };
  });

  const objetivosSerializados: ObjetivoSerializado[] = objetivos.map((o) => ({
    id_objetivo: o.id_objetivo,
    titulo: o.titulo,
    descripcion: o.descripcion,
    tipo: o.tipo,
    meta: Number(o.meta),
    progreso_actual: Number(o.progreso_actual),
    estado: o.estado,
    fecha_objetivo: o.fecha_objetivo
      ? o.fecha_objetivo.toISOString().slice(0, 10)
      : null,
  }));

  const fotosSerializadas: FotoSerializada[] = fotosAngulo.map((f) => ({
    id_medida: f.id_medida,
    angulo: f.tipo_medida,
    fechaLabel: FORMATEADOR_FECHA.format(f.fecha),
    url: f.foto_url ? urlesFotosAngulo.get(f.foto_url) ?? null : null,
  }));

  // seriesConPeso ya viene ordenado por fecha desc — se toman como mucho 8
  // sets por ejercicio (los más recientes) y se dan vuelta para leer la
  // progresión de izquierda (más vieja) a derecha (más reciente).
  const progresionPorEjercicio = new Map<
    string,
    {
      nombre: string;
      entradas: { fecha: Date; peso: number; reps: number | null; sugerido: number | null }[];
    }
  >();
  for (const s of seriesConPeso) {
    if (s.peso_utilizado == null) continue;
    const ej = s.ejercicio_programa.ejercicio;
    const grupo = progresionPorEjercicio.get(ej.id_ejercicio) ?? { nombre: ej.nombre, entradas: [] };
    if (grupo.entradas.length < 8) {
      grupo.entradas.push({
        fecha: s.entrenamiento.fecha,
        peso: Number(s.peso_utilizado),
        reps: s.repeticiones_realizadas,
        sugerido: s.ejercicio_programa.peso_sugerido ? Number(s.ejercicio_programa.peso_sugerido) : null,
      });
    }
    progresionPorEjercicio.set(ej.id_ejercicio, grupo);
  }
  const progresionEjercicios = Array.from(progresionPorEjercicio.entries()).map(
    ([id_ejercicio, grupo]) => ({
      id_ejercicio,
      nombre: grupo.nombre,
      sugeridoActual: grupo.entradas[0]?.sugerido ?? null,
      entradas: [...grupo.entradas].reverse(),
    })
  );

  // Seguimiento de sesiones (Día N por semana del bloque): completada con
  // su fecha real, la siguiente pendiente, o pendiente. Nunca "ausente"
  // por no haber entrenado un día del calendario.
  const diasPlan = (programaConBloques?.bloques ?? []).map((b) => ({
    ...b,
    cantidadEjercicios: b._count.ejercicios_programa,
  }));
  // Progresión semanal: el ciclo avanza por calendario y se repite, así que
  // el seguimiento muestra solo el ciclo EN CURSO (los anteriores quedan en
  // el historial de Ejecución).
  const esSemanal = programaActivo.tipo_planificacion === "semanal";
  const ciclo = posicionCiclo(inicioCicloPrograma(programaActivo), new Date(), programaActivo.fecha_pausa);
  const inicioCicloActual = new Date(ciclo.inicioSemana.getTime() - (ciclo.semana - 1) * 7 * 24 * 60 * 60 * 1000);
  const sesionesSeguimiento = esSemanal
    ? sesionesDelPlan.filter((e) => e.fecha >= inicioCicloActual)
    : sesionesDelPlan;
  const posicionActual = posicionSecuencia(diasPlan, sesionesDelPlan.length);
  const usadas = new Set<number>();
  const seguimiento: FilaSeguimiento[] = [1, 2, 3, 4]
    .map((semana) => ({
      semana,
      sesiones: sesionesDeSemana(diasPlan, semana).map((dia) => {
        const idx = sesionesSeguimiento.findIndex(
          (e, k) =>
            !usadas.has(k) &&
            e.semana_programa === semana &&
            (e.id_bloque === dia.id_bloque || (e.id_bloque == null && e.numero_dia === dia.numero_dia))
        );
        if (idx >= 0) usadas.add(idx);
        const hecha = idx >= 0 ? sesionesSeguimiento[idx] : null;
        const esSiguiente = esSemanal
          ? !hecha && semana === ciclo.semana
          : !hecha &&
            !posicionActual.completo &&
            posicionActual.semana === semana &&
            posicionActual.bloque.id_bloque === dia.id_bloque;
        return {
          id_bloque: dia.id_bloque,
          numero_dia: dia.numero_dia ?? 0,
          nombre: etiquetaSesion(dia.numero_dia, dia.nombre),
          estado: hecha ? ("completada" as const) : esSiguiente ? ("siguiente" as const) : ("pendiente" as const),
          fechaLabel: hecha ? FORMATEADOR_FECHA_SESION.format(hecha.fecha) : null,
        };
      }),
    }))
    .filter((fila) => fila.sesiones.length > 0);

  // Ejecución: agrupa las series reales de cada sesión por ejercicio, para
  // mostrar "Serie 1 → 80×6" tal como lo cargó el alumno, comparado contra
  // lo prescrito por el coach en ese ejercicio.
  const sesionesEjecucionAgrupadas = sesionesEjecucion.map((s) => {
    const porEjercicio = new Map<
      string,
      {
        nombre: string;
        prescrito: { series: number; repeticiones: string; peso_sugerido: number | null };
        comentario: string | null;
        sets: {
          numero_serie: number | null;
          numero_ronda: number | null;
          peso: number | null;
          reps: number | null;
          tipo: string | null;
          objetivo: string | null;
          agregada: boolean;
        }[];
        // Progresión de fuerza: aproximaciones hechas vs. planificadas.
        aproximacionesPlan: number | null;
      }
    >();
    for (const serie of s.series) {
      const ep = serie.ejercicio_programa;
      const grupo = porEjercicio.get(serie.id_ejercicio_programa) ?? {
        nombre: ep.ejercicio.nombre,
        prescrito: {
          series: ep.series,
          repeticiones: ep.repeticiones,
          peso_sugerido: ep.peso_sugerido ? Number(ep.peso_sugerido) : null,
        },
        comentario: serie.comentarios,
        sets: [],
        aproximacionesPlan: null,
      };
      // Objetivo copiado al guardar (plan del coach + 1RM de ese día).
      const objetivo =
        serie.tipo_serie == null
          ? null
          : [
              serie.porcentaje_objetivo ? `${serie.porcentaje_objetivo}%` : null,
              serie.peso_objetivo ? `${serie.peso_objetivo} kg` : null,
              serie.repeticiones_objetivo ? `${serie.repeticiones_objetivo} reps` : null,
            ]
              .filter(Boolean)
              .join(" · ") || null;
      grupo.sets.push({
        numero_serie: serie.numero_serie,
        numero_ronda: serie.numero_ronda,
        peso: serie.peso_utilizado ? Number(serie.peso_utilizado) : null,
        reps: serie.repeticiones_realizadas,
        tipo: serie.tipo_serie,
        objetivo,
        agregada: serie.agregada_por_alumno,
      });
      if (serie.tipo_serie === "efectiva") grupo.aproximacionesPlan = serie.aproximaciones_plan;
      porEjercicio.set(serie.id_ejercicio_programa, grupo);
    }
    return {
      id_entrenamiento: s.id_entrenamiento,
      fecha: s.fecha,
      nombre: s.nombre,
      comentarios: s.comentarios,
      sensacion_general: s.sensacion_general,
      semana_programa: s.semana_programa,
      numero_dia: s.numero_dia,
      ejercicios: Array.from(porEjercicio.values()),
    };
  });

  const idsObtenidos = new Set(logrosObtenidos.map((l) => l.id_logro));
  const catalogoDisponible: LogroCatalogoItem[] = catalogoLogros.filter(
    (l) => !idsObtenidos.has(l.id_logro)
  );
  const logrosObtenidosSerializados: LogroObtenidoItem[] = logrosObtenidos.map((l) => ({
    id_logro: l.id_logro,
    titulo: l.logro.titulo,
    icono: l.logro.icono,
    color: l.logro.color,
    fechaLabel: FORMATEADOR_FECHA.format(l.fecha_obtenido),
  }));

  const pesosOrdenados = [...progresos]
    .reverse()
    .filter((p) => p.peso_corporal !== null)
    .map((p) => Number(p.peso_corporal));
  const maxSesionesSemana = Math.max(1, ...sesionesPorSemana);

  const estadoSemaforo = calcularEstadoSemaforo(alertas);
  const edad = calcularEdad(relacion.alumno.fecha_nacimiento);
  const pesoActual = progresos[0]?.peso_corporal ? Number(progresos[0].peso_corporal) : null;
  const { semanaActual, diasActivos } = calcularSemanaYDiasActivos(
    inicioCicloPrograma(programaActivo),
    programaActivo.fecha_pausa
  );

  const panelResumen = (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap gap-2">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl px-3 py-2 flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase">Edad</span>
          <span className="text-sm text-on-surface tabular-nums">{edad ?? "—"}</span>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl px-3 py-2 flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase">Peso</span>
          <span className="text-sm text-on-surface tabular-nums">
            {pesoActual ? `${pesoActual}kg` : "—"}
          </span>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl px-3 py-2 flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase">Semana</span>
          <span className="text-sm text-on-surface tabular-nums">{semanaActual} de 4</span>
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl px-3 py-2 flex flex-col">
          <span className="text-[10px] text-on-surface-variant uppercase">Días activo</span>
          <span className="text-sm text-on-surface tabular-nums">{diasActivos}</span>
        </div>
        <div
          className={`rounded-xl px-3 py-2 flex items-center gap-1.5 border ${COLOR_SEMAFORO[estadoSemaforo]}`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {ICONO_SEMAFORO[estadoSemaforo]}
          </span>
          <span className="text-xs font-[family-name:var(--font-sora)] font-semibold">
            {ETIQUETA_ESTADO_SEMAFORO[estadoSemaforo]}
          </span>
        </div>
      </section>

      {relacion.alumno.objetivo && (
        <p className="text-sm text-on-surface-variant">
          <span className="text-on-surface-variant/70">Objetivo:</span> {relacion.alumno.objetivo}
        </p>
      )}

      {alertas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Alertas
          </h2>
          <div className="flex flex-col gap-1">
            {alertas.map((a, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 flex items-start gap-2 border text-sm ${
                  a.severidad === "critica"
                    ? "border-[#ffb4ab]/40 bg-[#ffb4ab]/5 text-[#ffb4ab]"
                    : a.severidad === "advertencia"
                      ? "border-[#eda100]/40 bg-[#eda100]/5 text-[#eda100]"
                      : "border-[#262626] bg-[#1A1A1A] text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[18px] mt-0.5">
                  {a.severidad === "critica"
                    ? "error"
                    : a.severidad === "advertencia"
                      ? "warning"
                      : "info"}
                </span>
                <span>{a.mensaje}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <LogrosAlumnoCoach
        idAlumno={id_alumno}
        catalogoDisponible={catalogoDisponible}
        obtenidos={logrosObtenidosSerializados}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Actividad
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">
              {totalSesiones} sesiones registradas en total
            </span>
            <span className="text-on-surface-variant">
              {ultimaSesion
                ? `Última: ${FORMATEADOR_FECHA.format(ultimaSesion.fecha)}`
                : "Sin sesiones todavía"}
            </span>
          </div>
          <div className="flex items-end gap-2 h-16">
            {sesionesPorSemana
              .slice()
              .reverse()
              .map((cantidad, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary-container rounded-t"
                    style={{ height: `${(cantidad / maxSesionesSemana) * 100}%` }}
                  />
                  <span className="text-[10px] text-on-surface-variant">{cantidad}</span>
                </div>
              ))}
          </div>
          <p className="text-[11px] text-on-surface-variant text-center">
            Sesiones por semana (últimas 4 semanas)
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Rendimiento
        </h2>
        <p className="text-xs text-on-surface-variant -mt-1">
          Peso sugerido (lo cargás vos en el día) vs. peso real que el alumno registró en cada sesión.
        </p>
        {progresionEjercicios.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no registró ningún peso en sus entrenamientos.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {progresionEjercicios.map((ej) => (
              <div
                key={ej.id_ejercicio}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                    {ej.nombre}
                  </h3>
                  <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                    {ej.sugeridoActual ? `Sugerido: ${ej.sugeridoActual}kg` : "Sin peso sugerido"}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ej.entradas.map((entrada, i) => {
                    const cumplioObjetivo =
                      entrada.sugerido != null && entrada.peso >= entrada.sugerido;
                    return (
                      <div
                        key={i}
                        className="shrink-0 w-[64px] bg-[#131313] border border-[#262626] rounded-lg p-2 flex flex-col items-center gap-0.5"
                      >
                        <span className="text-[10px] text-on-surface-variant tabular-nums">
                          {FORMATEADOR_FECHA.format(entrada.fecha)}
                        </span>
                        <span
                          className={`font-[family-name:var(--font-sora)] text-sm font-bold tabular-nums ${
                            cumplioObjetivo ? "text-primary-container" : "text-on-surface"
                          }`}
                        >
                          {entrada.peso}
                        </span>
                        <span className="text-[10px] text-on-surface-variant tabular-nums">
                          {entrada.reps != null ? `${entrada.reps} reps` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const panelEjecucion = (
    <div className="flex flex-col gap-4">
      {sesionesEjecucionAgrupadas.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no completó ningún entrenamiento.
        </div>
      ) : (
        sesionesEjecucionAgrupadas.map((sesion) => (
          <section
            key={sesion.id_entrenamiento}
            className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {etiquetaSesion(sesion.numero_dia, sesion.nombre)}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Realizado el {FORMATEADOR_FECHA_SESION.format(sesion.fecha)}
                  {sesion.semana_programa ? ` · semana ${sesion.semana_programa} del bloque` : ""}
                </p>
              </div>
              {sesion.sensacion_general != null && (
                <span className="text-2xl leading-none" title="Estado de ánimo">
                  {SENSACION_EMOJI[sesion.sensacion_general] ?? ""}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {sesion.ejercicios.map((ej, i) => {
                const esFuerza = ej.sets.some((set) => set.tipo != null);
                if (esFuerza) {
                  const aproximaciones = ej.sets.filter((set) => set.tipo === "aproximacion");
                  const efectivas = ej.sets.filter((set) => set.tipo === "efectiva");
                  const agregadas = aproximaciones.filter((set) => set.agregada).length;
                  const modificado =
                    agregadas > 0 ||
                    (ej.aproximacionesPlan != null && aproximaciones.length !== ej.aproximacionesPlan);
                  return (
                    <div key={i} className="bg-[#131313] border border-[#262626] rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
                          {ej.nombre}
                        </span>
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] text-primary-container uppercase">
                          Progresión de fuerza
                        </span>
                      </div>
                      {modificado && (
                        <p className="text-xs text-[#eda100]">
                          Modificado por el alumno: hizo {aproximaciones.length} aproximaciones
                          {ej.aproximacionesPlan != null ? ` (plan: ${ej.aproximacionesPlan})` : ""}
                          {agregadas > 0 ? ` · ${agregadas} agregada${agregadas === 1 ? "" : "s"} por él` : ""}.
                        </p>
                      )}
                      {aproximaciones.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] text-on-surface-variant uppercase">
                            Aproximaciones
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {aproximaciones.map((set, j) => (
                              <span
                                key={j}
                                title={set.objetivo ? `Plan: ${set.objetivo}` : "Sin plan (agregada por el alumno)"}
                                className={`font-[family-name:var(--font-jetbrains-mono)] text-xs rounded px-2 py-1 tabular-nums ${
                                  set.agregada ? "bg-[#eda100]/10 text-[#eda100]" : "bg-[#262626] text-on-surface"
                                }`}
                              >
                                A{set.numero_serie ?? j + 1} → {set.peso ?? "—"}
                                {set.peso != null ? "kg" : ""} × {set.reps ?? "—"}
                                {set.agregada ? " · agregada" : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {efectivas.map((set, j) => (
                        <div
                          key={j}
                          className="flex flex-wrap items-center justify-between gap-2 bg-primary-container/10 border border-primary-container/40 rounded px-2.5 py-1.5"
                        >
                          <span className="text-xs font-bold text-primary-container uppercase tracking-[0.06em]">
                            Serie efectiva
                          </span>
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-on-surface tabular-nums">
                            {set.peso ?? "—"}
                            {set.peso != null ? "kg" : ""} × {set.reps ?? "—"}
                            {set.objetivo ? ` · plan ${set.objetivo}` : ""}
                          </span>
                        </div>
                      ))}
                      {ej.comentario && (
                        <p className="text-xs text-on-surface-variant italic">“{ej.comentario}”</p>
                      )}
                    </div>
                  );
                }
                return (
                <div
                  key={i}
                  className="bg-[#131313] border border-[#262626] rounded-lg p-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
                      {ej.nombre}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] text-on-surface-variant uppercase shrink-0">
                      Prescrito: {ej.prescrito.series}×{ej.prescrito.repeticiones}
                      {ej.prescrito.peso_sugerido ? ` @ ${ej.prescrito.peso_sugerido}kg` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ej.sets.map((set, j) => (
                      <span
                        key={j}
                        className="font-[family-name:var(--font-jetbrains-mono)] text-xs bg-[#262626] rounded px-2 py-1 text-on-surface tabular-nums"
                      >
                        {set.numero_ronda ? `Ronda ${set.numero_ronda}` : `Serie ${set.numero_serie ?? j + 1}`} → {set.peso ?? "—"}
                        {set.peso != null ? "kg" : ""} × {set.reps ?? "—"}
                      </span>
                    ))}
                  </div>
                  {ej.comentario && (
                    <p className="text-xs text-on-surface-variant italic">“{ej.comentario}”</p>
                  )}
                </div>
                );
              })}
            </div>

            {sesion.comentarios && (
              <p className="text-sm text-on-surface border-t border-[#262626] pt-2.5">
                {sesion.comentarios}
              </p>
            )}
          </section>
        ))
      )}
    </div>
  );

  const panelComposicion = (
    <div className="flex flex-col gap-6">
      {pesosOrdenados.length >= 2 && (
        <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-3">
            Evolución del peso
          </h2>
          <svg
            viewBox={`0 0 ${ANCHO_SPARKLINE} ${ALTO_SPARKLINE}`}
            className="w-full h-16"
            preserveAspectRatio="none"
          >
            <polyline
              points={puntosSparkline(pesosOrdenados)}
              fill="none"
              stroke="#61edda"
              strokeWidth="2"
            />
          </svg>
        </section>
      )}
      <ProgresoFisicoCoach idAlumno={id_alumno} entradas={progresosSerializados} />
    </div>
  );

  const panelHistorial = (
    <div className="flex flex-col gap-6">
      {medidas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Medidas corporales
          </h2>
          <div className="flex flex-col gap-1">
            {medidas.map((m) => {
              const foto = m.foto_url ? urlesFotos.get(m.foto_url) ?? null : null;
              return (
                <div
                  key={m.id_medida}
                  className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-on-surface-variant shrink-0">
                    {FORMATEADOR_FECHA.format(m.fecha)}
                  </span>
                  <span className="text-on-surface capitalize flex items-center gap-2 text-right">
                    {foto && (
                      <a href={foto} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={foto}
                          alt={`Foto de ${m.tipo_medida}`}
                          className="w-9 h-9 rounded object-cover border border-[#262626]"
                        />
                      </a>
                    )}
                    {m.tipo_medida}: {m.valor_cm.toString()}cm
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Hábitos (últimos 7 días)
        </h2>
        {habitosSemana.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no cargó hábitos esta semana.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {habitosSemana.map((h) => (
              <div
                key={h.id_habito}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(h.fecha)}
                </span>
                <span className="text-on-surface">
                  {h.sueno ? `${h.sueno}h sueño` : ""}
                  {h.agua ? ` · ${h.agua}L agua` : ""}
                  {h.nutricion ? ` · nutrición ${h.nutricion}/10` : ""}
                  {h.cardio ? " · cardio" : ""}
                  {h.movilidad ? " · movilidad" : ""}
                  {h.recuperacion ? ` · recuperación ${h.recuperacion}/10` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Feedback
        </h2>
        {feedbackDiarios.length === 0 && feedbackSemanales.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no dejó feedback.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {feedbackSemanales.map((f) => (
              <ItemFeedbackSemanal
                key={f.id_feedback_semanal}
                id={f.id_feedback_semanal}
                semana={FORMATEADOR_FECHA.format(f.semana_inicio)}
                comentario={f.comentario_semanal}
                respuesta={f.respuesta_coach}
              />
            ))}
            {feedbackDiarios.map((f) => (
              <div
                key={f.id_feedback_diario}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm"
              >
                <span className="text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(f.fecha)}
                </span>
                <p className="text-on-surface mt-1">{f.comentario_diario}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <section className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
            {usuario.nombre} {usuario.apellido}
          </h1>
          <p className="text-sm text-on-surface-variant">{usuario.email}</p>
          <DatosAlumno
            idAlumno={id_alumno}
            objetivo={relacion.alumno.objetivo}
            fechaNacimiento={
              relacion.alumno.fecha_nacimiento
                ? relacion.alumno.fecha_nacimiento.toISOString().slice(0, 10)
                : null
            }
          />
        </div>
        <BotonDesvincular
          idAlumno={id_alumno}
          nombreCompleto={`${usuario.nombre} ${usuario.apellido}`}
        />
      </section>

      {/* Membresía: el pago es por fuera; el coach elige 1–30 días y confirma. */}
      <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
              Membresía
            </span>
            <span
              className={`inline-flex items-center gap-2 font-[family-name:var(--font-sora)] text-base font-bold ${claseEstadoMembresia(estadoMembresia)}`}
            >
              <span aria-hidden className="w-2 h-2 rounded-full bg-current" />
              {estadoMembresia.estado === "activa"
                ? `Activa · ${textoEstadoMembresia(estadoMembresia)}`
                : `${textoEstadoMembresia(estadoMembresia)} — entrenamiento bloqueado`}
            </span>
            {estadoMembresia.vencimiento && (
              <span className="text-xs text-on-surface-variant">
                {estadoMembresia.estado === "activa"
                  ? "Vence el "
                  : estadoMembresia.estado === "suspendida"
                    ? "Período hasta el "
                    : "Venció el "}
                {FORMATEADOR_FECHA_HORA.format(estadoMembresia.vencimiento)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {estadoMembresia.estado === "suspendida" && (
              <ConfirmForm
                action={reanudarMembresiaBlackfit}
                titulo="Reanudar membresía"
                mensaje={`¿Levantar la suspensión de ${usuario.nombre}? Recupera el acceso hasta el vencimiento original.`}
                confirmLabel="Reanudar"
                variante="positiva"
              >
                <input type="hidden" name="id_alumno" value={id_alumno} />
                <button
                  type="submit"
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full border border-primary-container text-primary-container font-bold"
                >
                  Reanudar
                </button>
              </ConfirmForm>
            )}
            {estadoMembresia.estado === "activa" && (
              <ConfirmForm
                action={suspenderMembresiaBlackfit}
                titulo="Suspender membresía"
                mensaje={`¿Suspender el servicio de ${usuario.nombre}? Pierde el acceso al entrenamiento hasta que lo reanudes; su planificación e historial no se borran.`}
                confirmLabel="Suspender"
              >
                <input type="hidden" name="id_alumno" value={id_alumno} />
                <button
                  type="submit"
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full border border-[#ffb4ab]/60 text-[#ffb4ab] font-bold"
                >
                  Suspender
                </button>
              </ConfirmForm>
            )}
            <ActivarMembresia
              idAlumno={id_alumno}
              nombreAlumno={`${usuario.nombre} ${usuario.apellido}`}
              vencimientoVigente={
                estadoMembresia.estado === "activa" && estadoMembresia.vencimiento
                  ? estadoMembresia.vencimiento.getTime()
                  : null
              }
              etiqueta={estadoMembresia.estado === "sin_membresia" ? "Activar membresía" : "Renovar membresía"}
            />
          </div>
        </div>

        {historialMembresias.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-on-surface-variant text-xs">
              Historial de activaciones ({historialMembresias.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {historialMembresias.map((m) => (
                <li
                  key={m.id_membresia}
                  className="bg-[#131313] border border-[#262626] rounded-lg px-3 py-2 flex flex-col gap-0.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-on-surface font-semibold">
                      {m.tipo_operacion === "renovacion"
                        ? "Renovación"
                        : m.tipo_operacion === "activacion"
                          ? "Activación"
                          : "Membresía"}
                      {m.dias_contratados ? ` · ${m.dias_contratados} día${m.dias_contratados === 1 ? "" : "s"}` : ""}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] uppercase text-on-surface-variant">
                      {m.estado_membresia === "activa" && m.fecha_vencimiento_membresia <= new Date()
                        ? "vencida"
                        : m.estado_membresia}
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant tabular-nums">
                    {FORMATEADOR_FECHA_HORA.format(m.fecha_inicio_membresia)} →{" "}
                    {FORMATEADOR_FECHA_HORA.format(m.fecha_vencimiento_membresia)}
                  </span>
                  {m.id_usuario_operador && (
                    <span className="text-xs text-on-surface-variant">
                      Por {operadores.get(m.id_usuario_operador) ?? "—"} el {FORMATEADOR_FECHA_HORA.format(m.fecha_creacion)}
                    </span>
                  )}
                  {m.fecha_suspension && (
                    <span className="text-xs text-[#ff8a3d]">
                      Suspendida el {FORMATEADOR_FECHA_HORA.format(m.fecha_suspension)}
                      {m.id_usuario_suspension ? ` por ${operadores.get(m.id_usuario_suspension) ?? "—"}` : ""}
                      {m.motivo_suspension ? ` · ${m.motivo_suspension}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <TabsAlumno
        inicial={tabInicial}
        panels={{
          resumen: panelResumen,
          planificacion: (
            <div className="flex flex-col gap-4">
              <RmReferenciaCoach
                idAlumno={id_alumno}
                rms={rmsSerializados}
                afectadas={cargasAfectadas}
                propuestas={propuestasRm}
                paso={pasoRedondeo}
              />
              <PlanificacionTab
                idAlumno={id_alumno}
                idPrograma={programaActivo.id_programa}
                nombrePrograma={programaActivo.nombre}
                tipoPlanificacion={programaConBloques?.tipo_planificacion ?? "fija"}
                bloques={programaConBloques?.bloques ?? []}
                seguimiento={seguimiento}
                completadas={sesionesDelPlan.length}
                ciclo={{
                  inicioLabel: FORMATEADOR_FECHA.format(inicioCicloPrograma(programaActivo)),
                  semana: ciclo.semana,
                  nombreSemana: NOMBRE_SEMANA[ciclo.semana],
                  ciclo: ciclo.ciclo,
                  pausado: programaActivo.fecha_pausa !== null,
                }}
              />
            </div>
          ),
          ejecucion: panelEjecucion,
          objetivos: <ObjetivosAlumno idAlumno={id_alumno} objetivos={objetivosSerializados} />,
          composicion: panelComposicion,
          fotos: <FotosTab idAlumno={id_alumno} fotos={fotosSerializadas} />,
          historial: panelHistorial,
        }}
      />

      <Link
        href="/coach/alumnos"
        className="text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 self-start"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Volver a alumnos
      </Link>
    </main>
  );
}
