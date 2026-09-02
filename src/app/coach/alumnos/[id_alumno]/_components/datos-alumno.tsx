"use client";

import { useActionState, useState } from "react";
import { actualizarDatosAlumno } from "@/app/actions/coach";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase";

export function DatosAlumno({
  idAlumno,
  objetivo,
  fechaNacimiento,
}: {
  idAlumno: string;
  objetivo: string | null;
  fechaNacimiento: string | null; // YYYY-MM-DD
}) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(actualizarDatosAlumno, undefined);

  return (
    <div className="flex flex-col gap-1">
      {!editar ? (
        <>
          <div className="flex items-center gap-2">
            <p className="text-sm text-on-surface-variant">
              Objetivo: {objetivo ?? "—"}
              {fechaNacimiento ? ` · Nac. ${fechaNacimiento}` : ""}
            </p>
            <button
              type="button"
              onClick={() => setEditar(true)}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Editar datos del alumno"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
          </div>
          {state?.message && (
            <p className="text-xs text-primary-container">{state.message}</p>
          )}
        </>
      ) : (
        <form action={action} className="flex flex-col gap-2 mt-1">
          <input type="hidden" name="id_alumno" value={idAlumno} />
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="objetivo">
              Objetivo
            </label>
            <input
              id="objetivo"
              name="objetivo"
              type="text"
              defaultValue={objetivo ?? ""}
              placeholder="Ej. bajar 5 kg de grasa"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="fecha_nacimiento">
              Fecha de nacimiento
            </label>
            <input
              id="fecha_nacimiento"
              name="fecha_nacimiento"
              type="date"
              defaultValue={fechaNacimiento ?? ""}
              className={INPUT}
            />
          </div>
          {state?.error && <p className="text-xs text-[#ffb4ab]">{state.error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold px-4 py-2 rounded disabled:opacity-60"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditar(false)}
              className="text-on-surface-variant text-xs px-3 py-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
