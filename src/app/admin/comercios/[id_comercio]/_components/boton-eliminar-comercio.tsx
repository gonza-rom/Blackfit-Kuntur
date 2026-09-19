"use client";

import { useActionState } from "react";
import { eliminarComercio } from "@/app/actions/admin";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonEliminarComercio({
  idComercio,
  nombreComercio,
}: {
  idComercio: string;
  nombreComercio: string;
}) {
  const [state, action, pending] = useActionState(eliminarComercio, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#ffb4ab]/30 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-[#ffb4ab] uppercase">
          Zona de peligro
        </p>
        <p className="text-sm text-on-surface-variant mt-1">
          Elimina el comercio y todos sus beneficios. Si algún beneficio ya
          tiene validaciones registradas, no se puede eliminar — desactivalo
          en vez de esto.
        </p>
      </div>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}

      <ConfirmForm
        action={action}
        pending={pending}
        mensaje={`¿Eliminar el comercio "${nombreComercio}"? No se puede deshacer.`}
      >
        <input type="hidden" name="id_comercio" value={idComercio} />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-transparent border border-[#ffb4ab] text-[#ffb4ab] font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:bg-[#ffb4ab]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Eliminando..." : "Eliminar comercio"}
        </button>
      </ConfirmForm>
    </div>
  );
}
