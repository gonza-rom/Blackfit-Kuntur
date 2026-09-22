import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas, calcularEstadoSemaforo, ETIQUETA_ESTADO_SEMAFORO } from "@/lib/alertas";
import { urlesFirmadasFotos } from "@/lib/storage";
import { calcularSemanaYDiasActivos } from "@/lib/alumno";
import { obtenerOCrearProgramaActivo } from "@/app/actions/coach";
import { SugerenciaIA } from "./_components/sugerencia-ia";
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
      include: { bloques: { include: { _count: { select: { ejercicios_programa: true } } } } },
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
        series: {
          orderBy: [{ id_ejercicio_programa: "asc" }, { numero_serie: "asc" }],
          select: {
            id_serie: true,
            numero_serie: true,
            peso_utilizado: true,
            repeticiones_realizadas: true,
            comentarios: true,
            id_ejercicio_programa: true,
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
  ]);

  const { usuario } = relacion.alumno;

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
        sets: { numero_serie: number | null; peso: number | null; reps: number | null }[];
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
      };
      grupo.sets.push({
        numero_serie: serie.numero_serie,
        peso: serie.peso_utilizado ? Number(serie.peso_utilizado) : null,
        reps: serie.repeticiones_realizadas,
      });
      porEjercicio.set(serie.id_ejercicio_programa, grupo);
    }
    return {
      id_entrenamiento: s.id_entrenamiento,
      fecha: s.fecha,
      nombre: s.nombre,
      comentarios: s.comentarios,
      sensacion_general: s.sensacion_general,
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
  const { semanaActual, diasActivos } = calcularSemanaYDiasActivos(programaActivo.fecha_inicio);

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
          <SugerenciaIA idAlumno={id_alumno} />
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
                  {sesion.nombre ?? "Entrenamiento"}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(sesion.fecha)}
                </p>
              </div>
              {sesion.sensacion_general != null && (
                <span className="text-2xl leading-none" title="Estado de ánimo">
                  {SENSACION_EMOJI[sesion.sensacion_general] ?? ""}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {sesion.ejercicios.map((ej, i) => (
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
                        Serie {set.numero_serie ?? j + 1} → {set.peso ?? "—"}
                        {set.peso != null ? "kg" : ""} × {set.reps ?? "—"}
                      </span>
                    ))}
                  </div>
                  {ej.comentario && (
                    <p className="text-xs text-on-surface-variant italic">“{ej.comentario}”</p>
                  )}
                </div>
              ))}
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

      <TabsAlumno
        inicial={tabInicial}
        panels={{
          resumen: panelResumen,
          planificacion: (
            <PlanificacionTab
              idAlumno={id_alumno}
              idPrograma={programaActivo.id_programa}
              tipoPlanificacion={programaConBloques?.tipo_planificacion ?? "fija"}
              bloques={programaConBloques?.bloques ?? []}
            />
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
