"use client";

import { useActionState } from "react";
import { aplicarPlantilla } from "@/app/actions/coach";

type Alumno = { id_alumno: string; nombre: string; apellido: string };

export function FormAplicarPlantilla({
  idPlantilla,
  alumnos,
}: {
  idPlantilla: string;
  alumnos: Alumno[];
}) {
  const [state, action, pending] = useActionState(aplicarPlantilla, undefined);

  if (alumnos.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        Todavía no tenés alumnos vinculados para aplicarle esta plantilla.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id_plantilla" value={idPlantilla} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="id_alumno"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Alumno
        </label>
        <select
          id="id_alumno"
          name="id_alumno"
          required
          defaultValue=""
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        >
          <option value="" disabled>
            Elegir alumno
          </option>
          {alumnos.map((a) => (
            <option key={a.id_alumno} value={a.id_alumno}>
              {a.nombre} {a.apellido}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="fecha_inicio"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Fecha de inicio
        </label>
        <input
          id="fecha_inicio"
          name="fecha_inicio"
          type="date"
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {pending ? "Aplicando..." : "Aplicar a este alumno"}
      </button>
    </form>
  );
}
