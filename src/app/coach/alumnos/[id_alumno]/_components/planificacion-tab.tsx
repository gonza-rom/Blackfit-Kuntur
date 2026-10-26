import Link from "next/link";
import { establecerTipoPlanificacion, crearGrupoSemanas, controlarCicloFuerza } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";
import { BotonEliminarGrupo } from "./boton-eliminar-grupo";
import { MAX_DIAS_SESION, nombrePropioSesion } from "@/lib/secuencia";

// Seguimiento de la secuencia de sesiones (calculado en la página con
// lib/secuencia.ts a partir del historial real).
export type FilaSeguimiento = {
  semana: number;
  sesiones: {
    id_bloque: string;
    numero_dia: number;
    nombre: string;
    estado: "completada" | "siguiente" | "pendiente";
    fechaLabel: string | null;
  }[];
};

const TIPOS: { valor: string; etiqueta: string; ayuda: string }[] = [
  { valor: "fija", etiqueta: "Rutina fija", ayuda: "1 semana se repite en las 4 · cargas que ponés vos" },
  {
    valor: "semanal",
    etiqueta: "Progresión semanal",
    ayuda: "bloque de fuerza de 4 semanas que se repite · cargas automáticas con el 1RM",
  },
  {
    valor: "personalizada",
    etiqueta: "Personalizada",
    ayuda: "agrupá las semanas como quieras (2+2, 3+1, ...)",
  },
];

// Estado del ciclo de 4 semanas (solo Progresión semanal).
export type InfoCiclo = {
  inicioLabel: string;
  semana: number;
  nombreSemana: string;
  ciclo: number;
  pausado: boolean;
};

type Bloque = {
  id_bloque: string;
  semana_inicio: number | null;
  semana_fin: number | null;
  numero_dia: number | null;
  nombre: string;
  _count: { ejercicios_programa: number };
};

export function PlanificacionTab({
  idAlumno,
  idPrograma,
  nombrePrograma,
  tipoPlanificacion,
  bloques,
  seguimiento,
  completadas,
  ciclo,
}: {
  idAlumno: string;
  idPrograma: string;
  nombrePrograma: string;
  tipoPlanificacion: string;
  bloques: Bloque[];
  seguimiento: FilaSeguimiento[];
  completadas: number;
  ciclo: InfoCiclo;
}) {
  // Sesiones numeradas (Día 1, Día 2, ...). Los bloques sin número son de
  // la planificación vieja por tramos y se ven en la pantalla del programa.
  const bloquesPorDia = bloques.filter((b) => b.numero_dia != null);

  let grupos: { semana_inicio: number; semana_fin: number; etiqueta: string }[];
  if (tipoPlanificacion === "fija") {
    grupos = [{ semana_inicio: 1, semana_fin: 4, etiqueta: "Semanas 1 a 4" }];
  } else if (tipoPlanificacion === "semanal") {
    // Progresión semanal: el coach arma SOLO la semana 1 y esas mismas
    // sesiones (días, ejercicios, series, reps, descansos, tempo,
    // accesorios) rigen en las semanas 2, 3 y 4; lo único que cambia por
    // semana es el % del 1RM y la carga. Los días armados antes por semana
    // suelta se siguen mostrando abajo para no perderlos.
    grupos = [
      {
        semana_inicio: 1,
        semana_fin: 4,
        etiqueta: "Semana 1 · se replica automáticamente en las semanas 2, 3 y 4",
      },
    ];
    const vistos = new Set<string>(["1-4"]);
    for (const b of bloquesPorDia) {
      if (b.semana_inicio == null || b.semana_fin == null) continue;
      const clave = `${b.semana_inicio}-${b.semana_fin}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      grupos.push({
        semana_inicio: b.semana_inicio,
        semana_fin: b.semana_fin,
        etiqueta: `${
          b.semana_inicio === b.semana_fin ? `Semana ${b.semana_inicio}` : `Semanas ${b.semana_inicio} a ${b.semana_fin}`
        } (armado anterior)`,
      });
    }
  } else {
    const vistos = new Set<string>();
    grupos = [];
    for (const b of bloquesPorDia) {
      if (b.semana_inicio == null || b.semana_fin == null) continue;
      const clave = `${b.semana_inicio}-${b.semana_fin}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      grupos.push({
        semana_inicio: b.semana_inicio,
        semana_fin: b.semana_fin,
        etiqueta:
          b.semana_inicio === b.semana_fin
            ? `Semana ${b.semana_inicio}`
            : `Semanas ${b.semana_inicio} a ${b.semana_fin}`,
      });
    }
    grupos.sort((a, b) => a.semana_inicio - b.semana_inicio);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
            Programa activo
          </p>
          <Link
            href={`/coach/programas/${idPrograma}`}
            className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface hover:text-primary-container"
          >
            {nombrePrograma}
          </Link>
        </div>
        <Link
          href={`/coach/alumnos/${idAlumno}/programas/nuevo`}
          className="shrink-0 flex items-center gap-1.5 border border-outline-variant text-on-surface font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[16px]">sync_alt</span>
          Cambiar programa
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Tipo de planificación
        </h2>
        <div className="flex flex-col gap-1.5">
          {TIPOS.map((t) => (
            <form key={t.valor} action={establecerTipoPlanificacion}>
              <input type="hidden" name="id_programa" value={idPrograma} />
              <input type="hidden" name="tipo_planificacion" value={t.valor} />
              <button
                type="submit"
                className={`w-full text-left flex items-center justify-between gap-3 rounded-xl p-3 border ${
                  tipoPlanificacion === t.valor
                    ? "border-primary-container bg-primary-container/5"
                    : "border-[#262626] bg-[#1A1A1A]"
                }`}
              >
                <span>
                  <span className="block text-sm font-[family-name:var(--font-sora)] font-semibold text-on-surface">
                    {t.etiqueta}
                  </span>
                  <span className="block text-xs text-on-surface-variant">{t.ayuda}</span>
                </span>
                {tipoPlanificacion === t.valor && (
                  <span className="material-symbols-outlined text-primary-container">
                    check_circle
                  </span>
                )}
              </button>
            </form>
          ))}
        </div>
      </section>

      {tipoPlanificacion === "semanal" && (
        <section className="bg-[#1A1A1A] border border-primary-container/40 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                Ciclo de fuerza
              </span>
              <span className="font-[family-name:var(--font-sora)] text-base font-bold text-on-surface">
                Semana {ciclo.semana} de 4 · {ciclo.nombreSemana}
                <span className="text-on-surface-variant font-normal"> · ciclo {ciclo.ciclo}</span>
              </span>
              <span className="text-xs text-on-surface-variant">
                Inicio del ciclo: {ciclo.inicioLabel}
                {ciclo.pausado ? " · en pausa (la semana no avanza)" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={controlarCicloFuerza}>
                <input type="hidden" name="id_programa" value={idPrograma} />
                <input type="hidden" name="accion" value={ciclo.pausado ? "reanudar" : "pausar"} />
                <button
                  type="submit"
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-outline-variant text-on-surface"
                >
                  {ciclo.pausado ? "Reanudar" : "Pausar"}
                </button>
              </form>
              <ConfirmForm
                action={controlarCicloFuerza}
                titulo="Reiniciar ciclo"
                mensaje="¿Reiniciar el ciclo? Hoy pasa a ser la semana 1. Los entrenamientos ya hechos no cambian."
                confirmLabel="Reiniciar"
              >
                <input type="hidden" name="id_programa" value={idPrograma} />
                <input type="hidden" name="accion" value="reiniciar" />
                <button
                  type="submit"
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-outline-variant text-on-surface"
                >
                  Reiniciar
                </button>
              </ConfirmForm>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Semana 1 Pesada (90–95 %) · Semana 2 Deload (60–65 %) · Semana 3 Intermedia (70–75 %) · Semana 4
            Preparación (80–85 %). Armá solo la semana 1: las semanas 2, 3 y 4 repiten los mismos días,
            ejercicios, series, repeticiones, descansos y tempo, y solo cambian el % y la carga. Cada 7 días
            avanza una semana y después de la 4 vuelve a la 1. En sentadilla, press de banca o peso muerto
            activá &quot;Carga automática por 1RM&quot;: con el % de la semana 1 se completan solas las demás
            (podés ajustarlas).
          </p>
        </section>
      )}

      {grupos.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no armaste ningún grupo de semanas.
        </div>
      ) : (
        grupos.map((grupo) => {
          const bloquesGrupo = bloquesPorDia.filter(
            (b) => b.semana_inicio === grupo.semana_inicio && b.semana_fin === grupo.semana_fin
          );
          return (
            <section key={`${grupo.semana_inicio}-${grupo.semana_fin}`} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
                  {grupo.etiqueta}
                </h2>
                {(tipoPlanificacion === "personalizada" ||
                  (tipoPlanificacion === "semanal" && !(grupo.semana_inicio === 1 && grupo.semana_fin === 4))) && (
                  <BotonEliminarGrupo
                    idPrograma={idPrograma}
                    semanaInicio={grupo.semana_inicio}
                    semanaFin={grupo.semana_fin}
                    etiqueta={grupo.etiqueta}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[...bloquesGrupo]
                  .sort((a, b) => (a.numero_dia ?? 0) - (b.numero_dia ?? 0))
                  .map((bloque) => {
                    const cantidad = bloque._count.ejercicios_programa;
                    const nombre = nombrePropioSesion(bloque.nombre);
                    return (
                      <Link
                        key={bloque.id_bloque}
                        href={`/coach/alumnos/${idAlumno}/dia?programa=${idPrograma}&semana_inicio=${grupo.semana_inicio}&semana_fin=${grupo.semana_fin}&dia=${bloque.numero_dia}`}
                        className={`flex flex-col gap-1 rounded-xl p-3 border ${
                          cantidad > 0
                            ? "border-primary-container/40 bg-primary-container/5"
                            : "border-[#262626] bg-[#1A1A1A]"
                        }`}
                      >
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] text-on-surface uppercase">
                          Día {bloque.numero_dia}
                        </span>
                        {nombre && <span className="text-sm text-on-surface truncate">{nombre}</span>}
                        <span
                          className={`text-xs ${cantidad > 0 ? "text-primary-container" : "text-on-surface-variant"}`}
                        >
                          {cantidad > 0 ? `${cantidad} ej.` : "Sin ejercicios"}
                        </span>
                      </Link>
                    );
                  })}
                {(() => {
                  const siguienteNumero =
                    Math.max(0, ...bloquesGrupo.map((b) => b.numero_dia ?? 0)) + 1;
                  if (siguienteNumero > MAX_DIAS_SESION) return null;
                  return (
                    <Link
                      href={`/coach/alumnos/${idAlumno}/dia?programa=${idPrograma}&semana_inicio=${grupo.semana_inicio}&semana_fin=${grupo.semana_fin}&dia=${siguienteNumero}`}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl p-3 border border-dashed border-outline-variant text-on-surface-variant hover:text-primary-container hover:border-primary-container/60"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      <span className="text-xs">Agregar Día {siguienteNumero}</span>
                    </Link>
                  );
                })()}
              </div>
            </section>
          );
        })
      )}

      {seguimiento.length > 0 && (
        <section className="flex flex-col gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
              Seguimiento de sesiones · {completadas} completada{completadas === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              El alumno avanza por las sesiones que completa, el día que entrene. Descansar no es una
              ausencia: la sesión queda pendiente hasta que la haga.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {seguimiento.map((fila) => (
              <div key={fila.semana} className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex flex-col gap-2">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                  Semana {fila.semana}
                </span>
                <div className="flex flex-col gap-1">
                  {fila.sesiones.map((sesion) => (
                    <div key={sesion.id_bloque} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-on-surface truncate">{sesion.nombre}</span>
                      <span
                        className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] uppercase ${
                          sesion.estado === "completada"
                            ? "text-primary-container"
                            : sesion.estado === "siguiente"
                              ? "text-[#eda100]"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {sesion.estado === "completada"
                          ? `Completada · ${sesion.fechaLabel}`
                          : sesion.estado === "siguiente"
                            ? "Siguiente"
                            : "Pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tipoPlanificacion === "personalizada" && (
        <section className="flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Agregar grupo de semanas
          </h2>
          <form
            action={crearGrupoSemanas}
            className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-end gap-3"
          >
            <input type="hidden" name="id_programa" value={idPrograma} />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-on-surface-variant">Desde semana</label>
              <select
                name="semana_inicio"
                defaultValue="1"
                className="bg-[#262626] rounded text-on-surface text-sm p-2"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-on-surface-variant">Hasta semana</label>
              <select
                name="semana_fin"
                defaultValue="1"
                className="bg-[#262626] rounded text-on-surface text-sm p-2"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded"
            >
              Agregar
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
