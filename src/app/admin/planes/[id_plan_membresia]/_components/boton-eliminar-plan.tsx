"use client";

import { useActionState } from "react";
import { eliminarPlanMembresia } from "@/app/actions/admin";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonEliminarPlan({
  idPlanMembresia,
  nombrePlan,
  cantidadMembresias,
}: {
  idPlanMembresia: string;
  nombrePlan: string;
  cantidadMembresias: number;
}) {
  const [state, action, pending] = useActionState(eliminarPlanMembresia, undefined);
  const bloqueado = cantidadMembresias > 0;

  return (
    <div className="bg-[#1A1A1A] border border-[#ffb4ab]/30 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-[#ffb4ab] uppercase">
          Zona de peligro
        </p>
        <p className="text-sm text-on-surface-variant mt-1">
          {bloqueado
            ? `No se puede eliminar: ${cantidadMembresias} membresía(s) ya usaron este plan. Desactivalo dejando de ofrecerlo en vez de borrarlo.`
            : "Esta acción no se puede deshacer."}
        </p>
      </div>

      {(state?.error) && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}

      <ConfirmForm action={action} mensaje={`¿Eliminar el plan "${nombrePlan}"? No se puede deshacer.`}>
        <input type="hidden" name="id_plan_membresia" value={idPlanMembresia} />
        <button
          type="submit"
          disabled={pending || bloqueado}
          className="w-full bg-transparent border border-[#ffb4ab] text-[#ffb4ab] font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:bg-[#ffb4ab]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Eliminando..." : "Eliminar plan"}
        </button>
      </ConfirmForm>
    </div>
  );
}
