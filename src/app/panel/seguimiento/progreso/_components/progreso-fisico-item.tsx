"use client";

import { useActionState, useState } from "react";
import { editarProgresoFisico, eliminarProgresoFisico } from "@/app/actions/alumno";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 transition-colors";

export function ProgresoFisicoItem({
  id,
  fecha,
  pesoCorporal,
  porcentajeGraso,
  masaMuscular,
  extra = [],
  cargadoPorCoach = false,
}: {
  id: string;
  fecha: string;
  pesoCorporal: string | null;
  porcentajeGraso: string | null;
  masaMuscular: string | null;
  extra?: { label: string; valor: string }[];
  cargadoPorCoach?: boolean;
}) {
  const [editar, setEditar] = useState(false);
  const [verMas, setVerMas] = useState(false);
  const [state, action, pending] = useActionState(editarProgresoFisico, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-on-surface-variant shrink-0 flex items-center gap-1.5">
          {fecha}
          {cargadoPorCoach && (
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] tracking-[0.08em] uppercase text-primary-container border border-primary-container/40 rounded-full px-1.5 py-0.5">
              coach
            </span>
          )}
        </span>
        {!editar && (
          <span className="text-on-surface flex-1 text-right">
            {pesoCorporal ? `${pesoCorporal}kg` : ""}
            {porcentajeGraso ? ` · ${porcentajeGraso}% graso` : ""}
            {masaMuscular ? ` · ${masaMuscular}kg masa musc.` : ""}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditar((v) => !v)}
            aria-label="Editar"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">
              {editar ? "close" : "edit"}
            </span>
          </button>
          <form action={eliminarProgresoFisico}>
            <input type="hidden" name="id_progreso" value={id} />
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

      {!editar && extra.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setVerMas((v) => !v)}
            className="text-xs text-primary-container flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">
              {verMas ? "expand_less" : "expand_more"}
            </span>
            {verMas ? "Ver menos" : `Ver composición completa (${extra.length})`}
          </button>
          {verMas && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              {extra.map((e) => (
                <div
                  key={e.label}
                  className="flex justify-between gap-2 border-b border-[#262626] py-1"
                >
                  <dt className="text-on-surface-variant">{e.label}</dt>
                  <dd className="text-on-surface tabular-nums">{e.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {editar && (
        <form action={action} className="grid grid-cols-3 gap-2 mt-2">
          <input type="hidden" name="id_progreso" value={id} />
          <input
            name="peso_corporal"
            type="number"
            step="0.01"
            defaultValue={pesoCorporal ?? ""}
            placeholder="Peso (kg)"
            className={INPUT}
          />
          <input
            name="porcentaje_graso"
            type="number"
            step="0.01"
            defaultValue={porcentajeGraso ?? ""}
            placeholder="% graso"
            className={INPUT}
          />
          <input
            name="masa_muscular"
            type="number"
            step="0.01"
            defaultValue={masaMuscular ?? ""}
            placeholder="Masa musc."
            className={INPUT}
          />
          {state?.error && (
            <p className="col-span-3 text-[#ffb4ab] text-xs">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="col-span-3 bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold py-1.5 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}
    </div>
  );
}
