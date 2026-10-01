"use client";

import { useActionState } from "react";
import { actualizarPerfilEntrenador } from "@/app/actions/coach";

export function FormPerfilEntrenador({
  especialidad,
  biografia,
  aliasPago,
  mensajeMembresia,
}: {
  especialidad: string | null;
  biografia: string | null;
  aliasPago: string | null;
  mensajeMembresia: string | null;
}) {
  const [state, action, pending] = useActionState(actualizarPerfilEntrenador, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="especialidad"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Especialidad
        </label>
        <input
          id="especialidad"
          name="especialidad"
          type="text"
          defaultValue={especialidad ?? ""}
          placeholder="Fuerza, hipertrofia, rehabilitación..."
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="biografia"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Biografía
        </label>
        <textarea
          id="biografia"
          name="biografia"
          rows={3}
          defaultValue={biografia ?? ""}
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1 border-t border-[#262626] pt-4">
        <p className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
          Renovación de membresía
        </p>
        <p className="text-xs text-on-surface-variant">
          Lo ve el alumno cuando se le vence la membresía, debajo del botón de WhatsApp (que usa
          tu teléfono de arriba). Si lo dejás vacío, no se muestra.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="alias_pago"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Alias de pago (opcional)
        </label>
        <input
          id="alias_pago"
          name="alias_pago"
          type="text"
          defaultValue={aliasPago ?? ""}
          placeholder="mi.alias.mp"
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="mensaje_membresia"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Mensaje para renovar (opcional)
        </label>
        <textarea
          id="mensaje_membresia"
          name="mensaje_membresia"
          rows={2}
          defaultValue={mensajeMembresia ?? ""}
          placeholder="Consultá con tu Coach para renovar tu membresía."
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
        />
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
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
