"use client";

import { useActionState, useEffect, useState } from "react";
import { responderFeedbackSemanal } from "@/app/actions/coach";

export function ItemFeedbackSemanal({
  id,
  semana,
  comentario,
  respuesta,
}: {
  id: string;
  semana: string;
  comentario: string;
  respuesta: string | null;
}) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(responderFeedbackSemanal, undefined);

  // Antes había que clickear "Listo" a mano para cerrar el form después de
  // mandar la respuesta — quedaba abierto sin ningún cambio visible más
  // que ese botón cambiando de texto. Ahora, apenas llega la confirmación,
  // se deja ver un instante y se cierra solo.
  useEffect(() => {
    if (!state?.message) return;
    const temporizador = setTimeout(() => setEditar(false), 900);
    return () => clearTimeout(temporizador);
  }, [state?.message]);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm flex flex-col gap-2">
      <div>
        <span className="text-on-surface-variant">Semana del {semana}</span>
        <p className="text-on-surface mt-1">{comentario}</p>
      </div>

      {respuesta && !editar && (
        <div className="border-l-2 border-primary-container pl-3">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-primary-container uppercase">
            Tu respuesta
          </span>
          <p className="text-on-surface-variant mt-0.5">{respuesta}</p>
        </div>
      )}

      {!editar ? (
        <button
          type="button"
          onClick={() => setEditar(true)}
          className="self-start font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant"
        >
          {respuesta ? "Editar respuesta" : "Responder"}
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="id_feedback_semanal" value={id} />
          <textarea
            name="respuesta_coach"
            defaultValue={respuesta ?? ""}
            rows={2}
            placeholder="Escribí tu devolución para esta semana..."
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 transition-colors"
          />
          {state?.error && <p className="text-[#ffb4ab] text-xs">{state.error}</p>}
          {state?.message && <p className="text-primary-container text-xs">{state.message}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold px-3 py-1.5 rounded disabled:opacity-60"
            >
              {pending ? "Enviando..." : "Mandar feedback"}
            </button>
            {!state?.message && (
              <button
                type="button"
                onClick={() => setEditar(false)}
                className="text-on-surface-variant text-xs px-2 py-1.5"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
