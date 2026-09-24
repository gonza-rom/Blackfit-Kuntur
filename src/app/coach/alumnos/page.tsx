import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas, type Alerta } from "@/lib/alertas";

const DIA_MS = 1000 * 60 * 60 * 24;

function formatearFechaRelativa(fecha: Date | null): string {
  if (!fecha) return "Nunca";
  const dias = Math.floor((Date.now() - fecha.getTime()) / DIA_MS);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias}d`;
}

function chipAlertas(alertas: Alerta[]) {
  if (alertas.length === 0) {
    return { texto: "Sin alertas", clase: "text-on-surface-variant" };
  }
  const criticas = alertas.filter((a) => a.severidad === "critica").length;
  if (criticas > 0) {
    return { texto: `${criticas} crítica${criticas === 1 ? "" : "s"}`, clase: "text-error" };
  }
  const advertencias = alertas.filter((a) => a.severidad === "advertencia").length;
  if (advertencias > 0) {
    return { texto: `${advertencias} advertencia${advertencias === 1 ? "" : "s"}`, clase: "text-[#eda100]" };
  }
  return { texto: `${alertas.length} info`, clase: "text-on-surface-variant" };
}

function fechaHaceDias(dias: number): Date {
  return new Date(Date.now() - dias * DIA_MS);
}

function diasHasta(fecha: Date): number {
  return Math.ceil((fecha.getTime() - Date.now()) / DIA_MS);
}

function chipAdherencia(total: number, completados: number) {
  if (total === 0) return { texto: "—", clase: "text-on-surface-variant" };
  const pct = Math.round((completados / total) * 100);
  const clase = pct >= 80 ? "text-primary-container" : pct >= 50 ? "text-[#eda100]" : "text-error";
  return { texto: `${pct}%`, clase };
}

// null = nunca tuvo membresía. Negativo = ya venció hace esos días.
function chipMembresia(dias: number | null): { texto: string; clase: string } {
  if (dias === null) return { texto: "Sin membresía", clase: "text-on-surface-variant" };
  if (dias < 0) return { texto: `Vencida (${Math.abs(dias)}d)`, clase: "text-error" };
  if (dias === 0) return { texto: "Vence hoy", clase: "text-error" };
  if (dias <= 7) return { texto: `${dias}d`, clase: "text-[#eda100]" };
  return { texto: `${dias}d`, clase: "text-primary-container" };
}

export default async function CoachAlumnosPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  // Antes de que existiera "desvincular" esto nunca hacía falta: una
  // relación, una vez vinculada, quedaba activa para siempre. Ahora que
  // puede pasar a "finalizada" hay que filtrarla, o un alumno dado de
  // baja seguiría apareciendo en la cartera.
  const relaciones = await prisma.relacionEntrenadorAlumno.findMany({
    where: { id_entrenador: contexto.id_entrenador, estado_relacion: "activa" },
    include: { alumno: { include: { usuario: true } } },
    orderBy: { fecha_inicio: "desc" },
  });

  const idsAlumnos = relaciones.map((r) => r.alumno.id_alumno);
  const idsUsuarios = relaciones.map((r) => r.alumno.usuario.id_usuario);
  const hace30 = fechaHaceDias(30);

  const [
    entrenamientos30d,
    ultimosEntrenamientos,
    programasActivos,
    ultimosProgresos,
    ultimosFeedbacks,
    alertasPorAlumno,
    ultimasMembresias,
  ] =
    idsAlumnos.length === 0
      ? [[], [], [], [], [], [], []]
      : await Promise.all([
          prisma.entrenamiento.findMany({
            where: { id_alumno: { in: idsAlumnos }, fecha: { gte: hace30 } },
            select: { id_alumno: true, estado: true },
          }),
          prisma.entrenamiento.findMany({
            where: { id_alumno: { in: idsAlumnos } },
            orderBy: { fecha: "desc" },
            distinct: ["id_alumno"],
            select: { id_alumno: true, fecha: true },
          }),
          prisma.programaEntrenamiento.findMany({
            where: { id_alumno: { in: idsAlumnos }, estado_programa: "activo", es_plantilla: false },
            select: { id_alumno: true, id_programa: true, nombre: true },
          }),
          prisma.progresoFisico.findMany({
            where: { id_alumno: { in: idsAlumnos } },
            orderBy: { fecha: "desc" },
            distinct: ["id_alumno"],
            select: { id_alumno: true, peso_corporal: true },
          }),
          prisma.feedbackSemanal.findMany({
            where: { id_alumno: { in: idsAlumnos } },
            orderBy: { semana_inicio: "desc" },
            distinct: ["id_alumno"],
            select: { id_alumno: true, respuesta_coach: true },
          }),
          Promise.all(
            idsAlumnos.map(async (id_alumno) => [id_alumno, await detectarAlertas(id_alumno)] as const)
          ),
          // Última membresía por usuario (la de fecha_vencimiento más lejana
          // en el tiempo, sin importar el estado) — así el coach ve tanto
          // la que está por vencer como la que ya venció.
          prisma.membresia.findMany({
            where: { id_usuario: { in: idsUsuarios } },
            orderBy: { fecha_vencimiento_membresia: "desc" },
            distinct: ["id_usuario"],
            select: { id_usuario: true, fecha_vencimiento_membresia: true },
          }),
        ]);

  const mapaAlertas = new Map(alertasPorAlumno);
  const mapaPrograma = new Map(
    programasActivos.map((p) => [p.id_alumno, { id_programa: p.id_programa, nombre: p.nombre }])
  );
  const mapaUltimoEntrenamiento = new Map(ultimosEntrenamientos.map((e) => [e.id_alumno, e.fecha]));
  const mapaPeso = new Map(ultimosProgresos.map((p) => [p.id_alumno, p.peso_corporal]));
  const mapaFeedback = new Map(ultimosFeedbacks.map((f) => [f.id_alumno, f.respuesta_coach]));
  const mapaMembresia = new Map(
    ultimasMembresias.map((m) => [m.id_usuario, m.fecha_vencimiento_membresia])
  );

  const conteoPorAlumno = new Map<string, { total: number; completados: number }>();
  for (const e of entrenamientos30d) {
    const actual = conteoPorAlumno.get(e.id_alumno) ?? { total: 0, completados: 0 };
    actual.total += 1;
    if (e.estado === "completado") actual.completados += 1;
    conteoPorAlumno.set(e.id_alumno, actual);
  }

  const filas = relaciones
    .map((relacion) => {
      const id_alumno = relacion.alumno.id_alumno;
      const conteo = conteoPorAlumno.get(id_alumno) ?? { total: 0, completados: 0 };
      const feedbackRespuesta = mapaFeedback.has(id_alumno) ? mapaFeedback.get(id_alumno) : undefined;
      const vencimiento = mapaMembresia.get(relacion.alumno.usuario.id_usuario) ?? null;
      const diasMembresia = vencimiento ? diasHasta(vencimiento) : null;

      return {
        id_alumno,
        relacion,
        nombre: `${relacion.alumno.usuario.nombre} ${relacion.alumno.usuario.apellido}`,
        programa: mapaPrograma.get(id_alumno) ?? null,
        alertas: chipAlertas(mapaAlertas.get(id_alumno) ?? []),
        adherencia: chipAdherencia(conteo.total, conteo.completados),
        ultimoEntrenamiento: formatearFechaRelativa(mapaUltimoEntrenamiento.get(id_alumno) ?? null),
        peso: mapaPeso.get(id_alumno),
        feedback:
          feedbackRespuesta === undefined
            ? { texto: "—", clase: "text-on-surface-variant" }
            : feedbackRespuesta === null
              ? { texto: "Pendiente", clase: "text-[#eda100]" }
              : { texto: "Respondido", clase: "text-primary-container" },
        puntos: relacion.alumno.puntos_totales,
        diasMembresia,
        membresia: chipMembresia(diasMembresia),
      };
    })
    // Al que se le vence antes (o ya venció) aparece primero, así el coach
    // ve de entrada a quién tiene que avisarle. Sin membresía queda al final.
    .sort((a, b) => (a.diasMembresia ?? Infinity) - (b.diasMembresia ?? Infinity));

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
            Alumnos
          </h1>
          <p className="text-sm text-on-surface-variant">
            {relaciones.length} activo{relaciones.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/coach/alumnos/vincular"
            className="flex items-center gap-2 border border-outline-variant text-on-surface font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
          >
            Vincular
          </Link>
          <Link
            href="/coach/alumnos/nuevo"
            className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo
          </Link>
        </div>
      </div>

      {relaciones.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no vinculaste ningún alumno.
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-[#262626]">
                {["Alumno", "Programa", "Membresía", "Alertas", "Cumplimiento (30d)", "Último entren.", "Peso", "Feedback semanal", "Puntos"].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase px-4 py-3 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id_alumno} className="border-b border-[#262626] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/coach/alumnos/${fila.id_alumno}`}
                      className="font-[family-name:var(--font-sora)] font-semibold text-on-surface hover:text-primary-container"
                    >
                      {fila.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fila.programa ? (
                      <Link
                        href={`/coach/programas/${fila.programa.id_programa}`}
                        className="text-on-surface-variant hover:text-primary-container hover:underline underline-offset-2"
                      >
                        {fila.programa.nombre}
                      </Link>
                    ) : (
                      <span className="text-on-surface-variant">Sin programa</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase ${fila.membresia.clase}`}
                    >
                      {fila.membresia.texto}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase ${fila.alertas.clase}`}
                    >
                      {fila.alertas.texto}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] text-[12px] ${fila.adherencia.clase}`}
                    >
                      {fila.adherencia.texto}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap tabular-nums">
                    {fila.ultimoEntrenamiento}
                  </td>
                  <td className="px-4 py-3 text-on-surface whitespace-nowrap tabular-nums">
                    {fila.peso ? `${fila.peso} kg` : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase ${fila.feedback.clase}`}
                    >
                      {fila.feedback.texto}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface whitespace-nowrap tabular-nums">
                    {fila.puntos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
