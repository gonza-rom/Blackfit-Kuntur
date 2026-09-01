"use client";

import { useActionState, useState } from "react";
import { editarFeedbackSemanal, eliminarFeedbackSemanal } from "@/app/actions/alumno";

export function FeedbackSemanalItem({
  id,
  semana,
  comentario,
}: {
  id: string;
  semana: string;
  comentario: string;
}) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(editarFeedbackSemanal, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-on-surface-variant">Semana del {semana}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditar((v) => !v)}
            aria-label="Editar"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">
              {editar ? "close" : "edit"}
            </span>
          </button>
          <form action={eliminarFeedbackSemanal}>
            <input type="hidden" name="id_feedback_semanal" value={id} />
            <button
              type="submit"
              aria-label="Eliminar"
              className="text-on-surface-variant hover:text-[#ffb4ab]"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </form>
        </div>
      </div>

      {editar ? (
        <form action={action} className="flex flex-col gap-2 mt-2">
          <input type="hidden" name="id_feedback_semanal" value={id} />
          <textarea
            name="comentario_semanal"
            defaultValue={comentario}
            rows={2}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2 transition-colors"
          />
          {state?.error && <p className="text-[#ffb4ab] text-xs">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold px-3 py-1.5 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      ) : (
        <p className="text-on-surface mt-1">{comentario}</p>
      )}
    </div>
  );
}
