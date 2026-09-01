"use client";

import { useActionState, useState } from "react";
import { crearObjetivo, actualizarObjetivo } from "@/app/actions/coach";

export type ObjetivoSerializado = {
  id_objetivo: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  meta: number;
  progreso_actual: number;
  estado: string;
  fecha_objetivo: string | null;
};

const TIPOS: { value: string; label: string }[] = [
  { value: "custom", label: "Personalizado" },
  { value: "volumen", label: "Volumen" },
  { value: "frecuencia", label: "Frecuencia" },
  { value: "habito", label: "Hábitos" },
  { value: "peso_corporal", label: "Peso corporal" },
];

const ESTADOS: { value: string; label: string }[] = [
  { value: "activo", label: "En curso" },
  { value: "cumplido", label: "Cumplido" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 transition-colors";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase";

export function ObjetivosAlumno({
  idAlumno,
  objetivos,
}: {
  idAlumno: string;
  objetivos: ObjetivoSerializado[];
}) {
  const [abrirNuevo, setAbrirNuevo] = useState(false);
  const [state, action, pending] = useActionState(crearObjetivo, undefined);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Objetivos
        </h2>
        <button
          type="button"
          onClick={() => setAbrirNuevo((v) => !v)}
          className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">
            {abrirNuevo ? "close" : "add"}
          </span>
          {abrirNuevo ? "Cancelar" : "Nuevo objetivo"}
        </button>
      </div>

      {abrirNuevo && (
        <form
          action={action}
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
        >
          <input type="hidden" name="id_alumno" value={idAlumno} />
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="nuevo-titulo">
              Título
            </label>
            <input id="nuevo-titulo" name="titulo" required className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="nuevo-descripcion">
              Descripción (opcional)
            </label>
            <input id="nuevo-descripcion" name="descripcion" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="nuevo-tipo">
                Tipo
              </label>
              <select id="nuevo-tipo" name="tipo" defaultValue="custom" className={INPUT}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="nuevo-meta">
                Meta
              </label>
              <input
                id="nuevo-meta"
                name="meta"
                type="number"
                step="0.01"
                min="0"
                required
                className={INPUT}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="nuevo-fecha">
              Fecha objetivo (opcional)
            </label>
            <input id="nuevo-fecha" name="fecha_objetivo" type="date" className={INPUT} />
          </div>

          {state?.error && (
            <p className="text-sm text-[#ffb4ab]">{state.error}</p>
          )}
          {state?.message && (
            <p className="text-sm text-primary-container">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-2.5 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Crear objetivo"}
          </button>
        </form>
      )}

      {objetivos.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Este alumno todavía no tiene objetivos cargados.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {objetivos.map((o) => (
            <ObjetivoItem key={o.id_objetivo} objetivo={o} />
          ))}
        </div>
      )}
    </section>
  );
}

function ObjetivoItem({ objetivo }: { objetivo: ObjetivoSerializado }) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(actualizarObjetivo, undefined);

  const pct =
    objetivo.meta > 0
      ? Math.min(100, Math.round((objetivo.progreso_actual / objetivo.meta) * 100))
      : 0;

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
            {objetivo.titulo}
          </p>
          {objetivo.descripcion && (
            <p className="text-sm text-on-surface-variant mt-0.5">
              {objetivo.descripcion}
            </p>
          )}
          <p className="text-xs text-on-surface-variant mt-1">
            {objetivo.progreso_actual} / {objetivo.meta} · {pct}% ·{" "}
            {ESTADOS.find((e) => e.value === objetivo.estado)?.label ?? objetivo.estado}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditar((v) => !v)}
          className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          aria-label="Editar objetivo"
        >
          <span className="material-symbols-outlined text-[20px]">
            {editar ? "close" : "edit"}
          </span>
        </button>
      </div>

      <div className="w-full h-1.5 bg-[#262626] rounded-full">
        <div
          className="h-full bg-primary-container rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {editar && (
        <form action={action} className="flex flex-col gap-3 border-t border-[#262626] pt-3 mt-1">
          <input type="hidden" name="id_objetivo" value={objetivo.id_objetivo} />
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor={`titulo-${objetivo.id_objetivo}`}>
              Título
            </label>
            <input
              id={`titulo-${objetivo.id_objetivo}`}
              name="titulo"
              required
              defaultValue={objetivo.titulo}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor={`descripcion-${objetivo.id_objetivo}`}>
              Descripción
            </label>
            <input
              id={`descripcion-${objetivo.id_objetivo}`}
              name="descripcion"
              defaultValue={objetivo.descripcion ?? ""}
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor={`tipo-${objetivo.id_objetivo}`}>
                Tipo
              </label>
              <select
                id={`tipo-${objetivo.id_objetivo}`}
                name="tipo"
                defaultValue={objetivo.tipo}
                className={INPUT}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor={`estado-${objetivo.id_objetivo}`}>
                Estado
              </label>
              <select
                id={`estado-${objetivo.id_objetivo}`}
                name="estado"
                defaultValue={objetivo.estado}
                className={INPUT}
              >
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor={`meta-${objetivo.id_objetivo}`}>
                Meta
              </label>
              <input
                id={`meta-${objetivo.id_objetivo}`}
                name="meta"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={objetivo.meta}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor={`progreso-${objetivo.id_objetivo}`}>
                Progreso actual
              </label>
              <input
                id={`progreso-${objetivo.id_objetivo}`}
                name="progreso_actual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={objetivo.progreso_actual}
                className={INPUT}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor={`fecha-${objetivo.id_objetivo}`}>
              Fecha objetivo
            </label>
            <input
              id={`fecha-${objetivo.id_objetivo}`}
              name="fecha_objetivo"
              type="date"
              defaultValue={objetivo.fecha_objetivo ?? ""}
              className={INPUT}
            />
          </div>

          {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
          {state?.message && (
            <p className="text-sm text-primary-container">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-2.5 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      )}
    </div>
  );
}
