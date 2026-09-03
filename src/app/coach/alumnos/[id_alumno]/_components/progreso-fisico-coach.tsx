"use client";

import { useActionState, useState } from "react";
import {
  crearProgresoFisicoAlumno,
  editarProgresoFisicoAlumno,
  eliminarProgresoFisicoAlumno,
} from "@/app/actions/coach";

// Orden y unidades como los muestra la balanza/InBody.
const CAMPOS = [
  { name: "peso_corporal", label: "Peso", unit: "kg", step: "0.01" },
  { name: "imc", label: "IMC", unit: "", step: "0.1" },
  { name: "pulso", label: "Pulso", unit: "lpm", step: "1" },
  { name: "porcentaje_graso", label: "Grasa corporal", unit: "%", step: "0.1" },
  { name: "porcentaje_agua", label: "Agua", unit: "%", step: "0.1" },
  { name: "porcentaje_musculo", label: "Músculos", unit: "%", step: "0.1" },
  { name: "masa_osea", label: "Huesos", unit: "kg", step: "0.1" },
  { name: "metabolismo_basal", label: "Metabolismo basal", unit: "kcal", step: "1" },
  { name: "metabolismo_activo", label: "Metabolismo activo", unit: "kcal", step: "1" },
  { name: "grasa_visceral", label: "Grasa visceral", unit: "", step: "1" },
  { name: "edad_metabolica", label: "Edad metabólica", unit: "años", step: "1" },
  { name: "soft_lean_mass", label: "Soft Lean Mass", unit: "kg", step: "0.1" },
  { name: "lean_body_mass", label: "Lean Body Mass", unit: "kg", step: "0.1" },
  { name: "proteina", label: "Proteína", unit: "kg", step: "0.1" },
  { name: "masa_muscular", label: "Masa muscular", unit: "kg", step: "0.1" },
] as const;

type Campo = (typeof CAMPOS)[number]["name"];

export type ProgresoSerializado = {
  id_progreso: string;
  fecha: string; // YYYY-MM-DD
  fechaLabel: string;
  origen: string | null;
  valores: Record<Campo, string | null>;
};

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 transition-colors";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase";

function CamposComposicion({
  valores,
  fecha,
}: {
  valores?: Record<Campo, string | null>;
  fecha?: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label className={LABEL}>Fecha</label>
        <input
          name="fecha"
          type="date"
          defaultValue={fecha ?? new Date().toISOString().slice(0, 10)}
          className={INPUT}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {CAMPOS.map((c) => (
          <div key={c.name} className="flex flex-col gap-1">
            <label className={LABEL} htmlFor={`${c.name}-in`}>
              {c.label}
              {c.unit ? ` (${c.unit})` : ""}
            </label>
            <input
              id={`${c.name}-in`}
              name={c.name}
              type="number"
              step={c.step}
              min="0"
              inputMode="decimal"
              defaultValue={valores?.[c.name] ?? ""}
              className={INPUT}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export function ProgresoFisicoCoach({
  idAlumno,
  entradas,
}: {
  idAlumno: string;
  entradas: ProgresoSerializado[];
}) {
  const [abrirNueva, setAbrirNueva] = useState(false);
  const [state, action, pending] = useActionState(crearProgresoFisicoAlumno, undefined);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
          Mediciones de composición corporal
        </h3>
        <button
          type="button"
          onClick={() => setAbrirNueva((v) => !v)}
          className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">
            {abrirNueva ? "close" : "add"}
          </span>
          {abrirNueva ? "Cancelar" : "Cargar medición"}
        </button>
      </div>

      {abrirNueva && (
        <form
          action={action}
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
        >
          <input type="hidden" name="id_alumno" value={idAlumno} />
          <CamposComposicion />
          {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
          {state?.message && (
            <p className="text-sm text-primary-container">{state.message}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar medición"}
          </button>
        </form>
      )}

      {entradas.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no hay mediciones de composición cargadas.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {entradas.map((e) => (
            <EntradaItem key={e.id_progreso} entrada={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntradaItem({ entrada }: { entrada: ProgresoSerializado }) {
  const [abierto, setAbierto] = useState(false);
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(editarProgresoFisicoAlumno, undefined);

  const conValor = CAMPOS.filter((c) => entrada.valores[c.name] != null);
  const resumen = CAMPOS.filter(
    (c) =>
      ["peso_corporal", "porcentaje_graso", "porcentaje_musculo", "imc"].includes(
        c.name
      ) && entrada.valores[c.name] != null
  )
    .map((c) => `${entrada.valores[c.name]}${c.unit}`)
    .join(" · ");

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
            {abierto ? "expand_less" : "expand_more"}
          </span>
          <span className="text-on-surface-variant shrink-0">{entrada.fechaLabel}</span>
          {entrada.origen === "coach" && (
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] tracking-[0.08em] uppercase text-primary-container border border-primary-container/40 rounded-full px-1.5 py-0.5 shrink-0">
              coach
            </span>
          )}
          <span className="text-on-surface truncate">{resumen || "sin resumen"}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditar((v) => !v);
              setAbierto(true);
            }}
            aria-label="Editar"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">
              {editar ? "close" : "edit"}
            </span>
          </button>
          <form action={eliminarProgresoFisicoAlumno}>
            <input type="hidden" name="id_progreso" value={entrada.id_progreso} />
            <button
              type="submit"
              aria-label="Eliminar"
              className="text-on-surface-variant hover:text-[#ffb4ab]"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </form>
        </div>
      </div>

      {abierto && !editar && (
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mt-3">
          {conValor.length === 0 && (
            <p className="text-on-surface-variant col-span-full">Sin datos.</p>
          )}
          {conValor.map((c) => (
            <div key={c.name} className="flex justify-between gap-2 border-b border-[#262626] py-1">
              <dt className="text-on-surface-variant">{c.label}</dt>
              <dd className="text-on-surface tabular-nums">
                {entrada.valores[c.name]}
                {c.unit ? ` ${c.unit}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {abierto && editar && (
        <form
          action={action}
          className="flex flex-col gap-3 mt-3 border-t border-[#262626] pt-3"
        >
          <input type="hidden" name="id_progreso" value={entrada.id_progreso} />
          <CamposComposicion valores={entrada.valores} fecha={entrada.fecha} />
          {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
          {state?.message && (
            <p className="text-sm text-primary-container">{state.message}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      )}
    </div>
  );
}
