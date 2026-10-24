import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas, type Alerta } from "@/lib/alertas";
import {
  resumenMembresiaBlackfit,
  claseEstadoMembresia,
  textoEstadoMembresia,
  type ResumenMembresiaBlackfit,
} from "@/lib/membresia";
import { ActivarMembresia } from "./_components/activar-membresia";

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

function chipAdherencia(total: number, completados: number) {
  if (total === 0) return { texto: "—", clase: "text-on-surface-variant" };
  const pct = Math.round((completados / total) * 100);
  const clase = pct >= 80 ? "text-primary-container" : pct >= 50 ? "text-[#eda100]" : "text-error";
  return { texto: `${pct}%`, clase };
}

// Estado real de la membresía de Blackfit (misma regla que el bloqueo del
// servidor) y qué botón corresponde: activar si nunca tuvo, renovar si
// está vigente o vencida. Suspendida se reanuda desde la ficha del alumno.
function chipMembresia(r: ResumenMembresiaBlackfit) {
  return {
    texto: textoEstadoMembresia(r),
    clase: claseEstadoMembresia(r),
    boton:
      r.estado === "sin_membresia"
        ? "Activar membresía"
        : r.estado === "suspendida"
          ? null
          : "Renovar membresía",
    vencimientoVigente: r.estado === "activa" && r.vencimiento ? r.vencimiento.getTime() : null,
  };
}

// Orden: primero a quien se le vence antes (o ya venció / está
// suspendido), al final los que nunca tuvieron membresía.
function prioridadMembresia(r: ResumenMembresiaBlackfit): number {
  if (r.estado === "vencida") return -2;
  if (r.estado === "suspendida") return -1;
  if (r.estado === "activa") return r.dias;
  return Infinity;
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
          // Todas las membresías de cada usuario: alcanza con que una esté
          // vigente para mostrar sus días; si tuvo alguna pero ninguna lo
          // está, figura como vencida.
          prisma.membresia.findMany({
            where: { id_usuario: { in: idsUsuarios }, plan_membresia: { organizacion: "blackfit" } },
            select: {
              id_usuario: true,
              estado_membresia: true,
              fecha_vencimiento_membresia: true,
              fecha_creacion: true,
            },
          }),
        ]);

  const mapaAlertas = new Map(alertasPorAlumno);
  const mapaPrograma = new Map(
    programasActivos.map((p) => [p.id_alumno, { id_programa: p.id_programa, nombre: p.nombre }])
  );
  const mapaUltimoEntrenamiento = new Map(ultimosEntrenamientos.map((e) => [e.id_alumno, e.fecha]));
  const mapaPeso = new Map(ultimosProgresos.map((p) => [p.id_alumno, p.peso_corporal]));
  const mapaFeedback = new Map(ultimosFeedbacks.map((f) => [f.id_alumno, f.respuesta_coach]));
  const membresiasPorUsuario = new Map<string, typeof ultimasMembresias>();
  for (const m of ultimasMembresias) {
    membresiasPorUsuario.set(m.id_usuario, [...(membresiasPorUsuario.get(m.id_usuario) ?? []), m]);
  }

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
      const estadoMembresia = resumenMembresiaBlackfit(
        membresiasPorUsuario.get(relacion.alumno.usuario.id_usuario) ?? []
      );

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
        prioridad: prioridadMembresia(estadoMembresia),
        membresia: chipMembresia(estadoMembresia),
      };
    })
    // Al que se le vence antes (o ya venció) aparece primero, así el coach
    // ve de entrada a quién tiene que avisarle. Sin membresía queda al final.
    .sort((a, b) => a.prioridad - b.prioridad);

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
        <>
        {/* Móvil: una tarjeta por alumno, con la membresía y su botón siempre visibles. */}
        <ul className="md:hidden flex flex-col gap-2">
          {filas.map((fila) => (
            <li
              key={fila.id_alumno}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/coach/alumnos/${fila.id_alumno}`}
                    className="font-[family-name:var(--font-sora)] font-semibold text-on-surface hover:text-primary-container break-words"
                  >
                    {fila.nombre}
                  </Link>
                  <p className="text-xs text-on-surface-variant truncate">
                    {fila.programa ? fila.programa.nombre : "Sin programa"} · {fila.ultimoEntrenamiento}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase ${fila.alertas.clase}`}
                >
                  {fila.alertas.texto}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.06em] uppercase tabular-nums ${fila.membresia.clase}`}
                >
                  <span aria-hidden className="w-2 h-2 rounded-full bg-current" />
                  {fila.membresia.texto}
                </span>
                {fila.membresia.boton ? (
                  <ActivarMembresia
                    idAlumno={fila.id_alumno}
                    nombreAlumno={fila.nombre}
                    vencimientoVigente={fila.membresia.vencimientoVigente}
                    etiqueta={fila.membresia.boton}
                    compacto
                  />
                ) : (
                  <Link
                    href={`/coach/alumnos/${fila.id_alumno}`}
                    className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] uppercase px-2.5 py-1 rounded-full border border-outline-variant text-on-surface"
                  >
                    Gestionar
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden md:block bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-x-auto">
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] uppercase ${fila.membresia.clase}`}
                      >
                        <span aria-hidden className="w-2 h-2 rounded-full bg-current" />
                        {fila.membresia.texto}
                      </span>
                      {fila.membresia.boton && (
                        <ActivarMembresia
                          idAlumno={fila.id_alumno}
                          nombreAlumno={fila.nombre}
                          vencimientoVigente={fila.membresia.vencimientoVigente}
                          etiqueta={fila.membresia.boton}
                          compacto
                        />
                      )}
                    </div>
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
        </>
      )}
    </main>
  );
}
