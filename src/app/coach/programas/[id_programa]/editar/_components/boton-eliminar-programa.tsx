"use client";

import { useActionState } from "react";
import { eliminarPrograma } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonEliminarPrograma({
  idPrograma,
  nombrePrograma,
}: {
  idPrograma: string;
  nombrePrograma: string;
}) {
  const [state, action, pending] = useActionState(eliminarPrograma, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#ffb4ab]/30 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-[#ffb4ab] uppercase">
          Zona de peligro
        </p>
        <p className="text-sm text-on-surface-variant mt-1">
          Si el alumno ya registró entrenamientos contra este programa, no se
          puede eliminar — marcalo como &quot;finalizado&quot; en vez de esto.
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
        mensaje={`¿Eliminar el programa "${nombrePrograma}"? No se puede deshacer.`}
      >
        <input type="hidden" name="id_programa" value={idPrograma} />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-transparent border border-[#ffb4ab] text-[#ffb4ab] font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:bg-[#ffb4ab]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Eliminando..." : "Eliminar programa"}
        </button>
      </ConfirmForm>
    </div>
  );
}
