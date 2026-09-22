import Link from "next/link";
import { establecerTipoPlanificacion, crearGrupoSemanas } from "@/app/actions/coach";
import { BotonEliminarGrupo } from "./boton-eliminar-grupo";

const DIAS: { valor: string; etiqueta: string }[] = [
  { valor: "lunes", etiqueta: "Lun" },
  { valor: "martes", etiqueta: "Mar" },
  { valor: "miercoles", etiqueta: "Mié" },
  { valor: "jueves", etiqueta: "Jue" },
  { valor: "viernes", etiqueta: "Vie" },
  { valor: "sabado", etiqueta: "Sáb" },
  { valor: "domingo", etiqueta: "Dom" },
];

const TIPOS: { valor: string; etiqueta: string; ayuda: string }[] = [
  { valor: "fija", etiqueta: "Rutina fija", ayuda: "1 semana se repite en las 4" },
  { valor: "semanal", etiqueta: "Progresión semanal", ayuda: "las 4 semanas son distintas" },
  {
    valor: "personalizada",
    etiqueta: "Personalizada",
    ayuda: "agrupá las semanas como quieras (2+2, 3+1, ...)",
  },
];

type Bloque = {
  id_bloque: string;
  semana_inicio: number | null;
  semana_fin: number | null;
  dia_semana: string | null;
  _count: { ejercicios_programa: number };
};

export function PlanificacionTab({
  idAlumno,
  idPrograma,
  nombrePrograma,
  tipoPlanificacion,
  bloques,
}: {
  idAlumno: string;
  idPrograma: string;
  nombrePrograma: string;
  tipoPlanificacion: string;
  bloques: Bloque[];
}) {
  const bloquesPorDia = bloques.filter((b) => b.dia_semana != null);

  let grupos: { semana_inicio: number; semana_fin: number; etiqueta: string }[];
  if (tipoPlanificacion === "fija") {
    grupos = [{ semana_inicio: 1, semana_fin: 4, etiqueta: "Semanas 1 a 4" }];
  } else if (tipoPlanificacion === "semanal") {
    grupos = [1, 2, 3, 4].map((s) => ({
      semana_inicio: s,
      semana_fin: s,
      etiqueta: `Semana ${s}`,
    }));
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
                {tipoPlanificacion === "personalizada" && (
                  <BotonEliminarGrupo
                    idPrograma={idPrograma}
                    semanaInicio={grupo.semana_inicio}
                    semanaFin={grupo.semana_fin}
                    etiqueta={grupo.etiqueta}
                  />
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {DIAS.map((dia) => {
                  const bloque = bloquesGrupo.find((b) => b.dia_semana === dia.valor);
                  const cantidad = bloque?._count.ejercicios_programa ?? 0;
                  return (
                    <Link
                      key={dia.valor}
                      href={`/coach/alumnos/${idAlumno}/dia?programa=${idPrograma}&semana_inicio=${grupo.semana_inicio}&semana_fin=${grupo.semana_fin}&dia=${dia.valor}`}
                      className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-center ${
                        cantidad > 0
                          ? "border-primary-container/40 bg-primary-container/5"
                          : "border-[#262626] bg-[#1A1A1A]"
                      }`}
                    >
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] text-on-surface-variant uppercase">
                        {dia.etiqueta}
                      </span>
                      <span
                        className={`text-xs ${cantidad > 0 ? "text-primary-container" : "text-on-surface-variant"}`}
                      >
                        {cantidad > 0 ? `${cantidad} ej.` : "Descanso"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
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
