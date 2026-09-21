"use client";

import { useActionState } from "react";
import { eliminarEjercicio } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";

export function BotonEliminarEjercicio({
  idEjercicio,
  nombre,
}: {
  idEjercicio: string;
  nombre: string;
}) {
  const [state, action, pending] = useActionState(eliminarEjercicio, undefined);
  const bloqueadoPorUso = Boolean(state?.error);

  return (
    <div className="flex flex-col gap-2">
      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}
      <ConfirmForm
        action={action}
        pending={pending}
        mensaje={`¿Eliminar "${nombre}" de la biblioteca? No se puede deshacer.`}
      >
        <input type="hidden" name="id_ejercicio" value={idEjercicio} />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-transparent border border-[#ffb4ab] text-[#ffb4ab] font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:bg-[#ffb4ab]/10 transition-colors disabled:opacity-40"
        >
          {pending ? "Eliminando..." : "Eliminar ejercicio"}
        </button>
      </ConfirmForm>

      {bloqueadoPorUso && (
        <ConfirmForm
          action={action}
          pending={pending}
          titulo="Forzar borrado"
          confirmLabel="Forzar borrado"
          mensaje={`Esto borra "${nombre}" Y el historial real de series que los alumnos ya registraron con él en sus programas. No hay forma de deshacerlo.`}
        >
          <input type="hidden" name="id_ejercicio" value={idEjercicio} />
          <input type="hidden" name="forzar" value="1" />
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#ffb4ab] text-black font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {pending ? "Eliminando..." : "Eliminar de todas formas (se pierde el historial)"}
          </button>
        </ConfirmForm>
      )}
    </div>
  );
}
