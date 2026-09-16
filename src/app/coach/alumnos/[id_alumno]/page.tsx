import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas } from "@/lib/alertas";
import { urlesFirmadasFotos } from "@/lib/storage";
import { SugerenciaIA } from "./_components/sugerencia-ia";
import { ObjetivosAlumno, type ObjetivoSerializado } from "./_components/objetivos-alumno";
import { BotonDesvincular } from "./_components/boton-desvincular";
import { DatosAlumno } from "./_components/datos-alumno";
import {
  ProgresoFisicoCoach,
  type ProgresoSerializado,
} from "./_components/progreso-fisico-coach";
import { ItemFeedbackSemanal } from "./_components/item-feedback-semanal";

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

const ANCHO_SPARKLINE = 280;
const ALTO_SPARKLINE = 60;

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

export default async function AlumnoDetallePage(
  props: PageProps<"/coach/alumnos/[id_alumno]">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;

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

  const [
    programas,
    ultimaSesion,
    totalSesiones,
    sesionesPorSemana,
    progresos,
    medidas,
    habitosSemana,
    feedbackDiarios,
    feedbackSemanales,
    alertas,
    objetivos,
    seriesConPeso,
  ] = await Promise.all([
    prisma.programaEntrenamiento.findMany({
      where: { id_alumno, id_entrenador: contexto.id_entrenador },
      orderBy: { fecha_inicio: "desc" },
    }),
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
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      take: 5,
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
  ]);

  const { usuario } = relacion.alumno;

  const urlesFotos = await urlesFirmadasFotos(medidas.map((m) => m.foto_url));

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

  const pesosOrdenados = [...progresos]
    .reverse()
    .filter((p) => p.peso_corporal !== null)
    .map((p) => Number(p.peso_corporal));
  const maxSesionesSemana = Math.max(1, ...sesionesPorSemana);

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-8">
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

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Programas
          </h2>
          <Link
            href={`/coach/alumnos/${id_alumno}/programas/nuevo`}
            className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo programa
          </Link>
        </div>

        {programas.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Este alumno todavía no tiene programas.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {programas.map((programa) => (
              <Link
                key={programa.id_programa}
                href={`/coach/programas/${programa.id_programa}`}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                    {programa.nombre}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {programa.fecha_inicio.toLocaleDateString("es-AR")}
                  </p>
                </div>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                  {programa.estado_programa}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ObjetivosAlumno idAlumno={id_alumno} objetivos={objetivosSerializados} />

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
          Progresión de fuerza
        </h2>
        <p className="text-xs text-on-surface-variant -mt-1">
          Peso sugerido (lo cargás vos en el programa) vs. peso real que el alumno registró en cada sesión.
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

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Progreso físico
        </h2>
        {pesosOrdenados.length >= 2 && (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
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
          </div>
        )}
        <ProgresoFisicoCoach idAlumno={id_alumno} entradas={progresosSerializados} />

        {medidas.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
              Medidas corporales
            </h3>
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
        )}
      </section>

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
    </main>
  );
}
