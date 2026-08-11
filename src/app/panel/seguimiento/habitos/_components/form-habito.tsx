"use client";

import { useActionState } from "react";
import { registrarHabito } from "@/app/actions/alumno";

type HabitoHoy = {
  sueno: number | null;
  agua: string | null;
  nutricion: number | null;
  suplementacion: boolean | null;
  cardio: boolean | null;
  movilidad: boolean | null;
  recuperacion: number | null;
} | null;

export function FormHabito({ habitoHoy }: { habitoHoy: HabitoHoy }) {
  const [state, action, pending] = useActionState(registrarHabito, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
            Sueño (horas)
          </label>
          <input
            name="sueno"
            type="number"
            step="0.5"
            defaultValue={habitoHoy?.sueno ?? ""}
            className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
            Agua (litros)
          </label>
          <input
            name="agua"
            type="number"
            step="0.1"
            defaultValue={habitoHoy?.agua ?? ""}
            className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
            Nutrición (1-10)
          </label>
          <input
            name="nutricion"
            type="number"
            min={1}
            max={10}
            defaultValue={habitoHoy?.nutricion ?? ""}
            className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
            Recuperación (1-10)
          </label>
          <input
            name="recuperacion"
            type="number"
            min={1}
            max={10}
            defaultValue={habitoHoy?.recuperacion ?? ""}
            className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            name="suplementacion"
            defaultChecked={habitoHoy?.suplementacion ?? false}
          />
          Suplementación
        </label>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" name="cardio" defaultChecked={habitoHoy?.cardio ?? false} />
          Cardio
        </label>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            name="movilidad"
            defaultChecked={habitoHoy?.movilidad ?? false}
          />
          Movilidad
        </label>
      </div>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-primary-container">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-2.5 rounded disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar de hoy"}
      </button>
    </form>
  );
}
