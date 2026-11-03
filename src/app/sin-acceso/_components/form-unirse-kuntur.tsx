"use client";

import { useActionState } from "react";
import { unirseAKuntur } from "@/app/actions/kuntur";

// Cuenta que existe pero no es socio de Kuntur: con su DNI se suma sola.
// Si figura en el padrón se une con su ficha; si no, queda como socio
// nuevo con 30 días de membresía.
export function FormUnirseKuntur({ dniActual }: { dniActual: string | null }) {
  const [state, action, pending] = useActionState(unirseAKuntur, undefined);

  return (
    <form action={action} className="w-full bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3 text-left">
      <p className="text-sm text-on-surface">Sumate a Kuntur Training Club con tu cuenta</p>
      <label className="flex flex-col gap-1">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
          DNI (sin puntos)
        </span>
        <input
          name="dni"
          inputMode="numeric"
          required
          defaultValue={dniActual ?? ""}
          readOnly={Boolean(dniActual)}
          placeholder="Ej. 30123456"
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-base p-3"
        />
      </label>
      {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center bg-primary-container text-black font-[family-name:var(--font-sora)] text-[15px] font-bold h-12 rounded disabled:opacity-60"
      >
        {pending ? "Un momento..." : "Sumarme a Kuntur"}
      </button>
      <p className="text-[11px] text-on-surface-variant">
        Si ya figurás como socio en el gimnasio, se vincula con tu ficha (tu apellido tiene que coincidir).
        Si no, empezás con 30 días de membresía.
      </p>
    </form>
  );
}
