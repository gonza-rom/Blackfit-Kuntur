import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas } from "@/lib/alertas";
import { SugerenciaIA } from "./_components/sugerencia-ia";
import { ObjetivosAlumno, type ObjetivoSerializado } from "./_components/objetivos-alumno";

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
  ]);

  const { usuario } = relacion.alumno;

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

  const pesosOrdenados = [...progresos]
    .reverse()
    .filter((p) => p.peso_corporal !== null)
    .map((p) => Number(p.peso_corporal));
  const maxSesionesSemana = Math.max(1, ...sesionesPorSemana);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {usuario.nombre} {usuario.apellido}
        </h1>
        <p className="text-sm text-on-surface-variant">{usuario.email}</p>
        {relacion.alumno.objetivo && (
          <p className="text-sm text-on-surface-variant">
            Objetivo: {relacion.alumno.objetivo}
          </p>
        )}
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
        {progresos.length === 0 && medidas.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no cargó datos de progreso físico.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {progresos.slice(0, 5).map((p) => (
              <div
                key={p.id_progreso}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(p.fecha)}
                </span>
                <span className="text-on-surface">
                  {p.peso_corporal ? `${p.peso_corporal}kg` : ""}
                  {p.porcentaje_graso ? ` · ${p.porcentaje_graso}% graso` : ""}
                  {p.masa_muscular ? ` · ${p.masa_muscular}kg masa musc.` : ""}
                </span>
              </div>
            ))}
            {medidas.map((m) => (
              <div
                key={m.id_medida}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(m.fecha)}
                </span>
                <span className="text-on-surface capitalize">
                  {m.tipo_medida}: {m.valor_cm.toString()}cm
                </span>
              </div>
            ))}
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
              <div
                key={f.id_feedback_semanal}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm"
              >
                <span className="text-on-surface-variant">
                  Semana del {FORMATEADOR_FECHA.format(f.semana_inicio)}
                </span>
                <p className="text-on-surface mt-1">{f.comentario_semanal}</p>
              </div>
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
