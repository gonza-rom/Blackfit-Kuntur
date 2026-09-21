"use client";

import { useActionState, useEffect, useRef } from "react";
import { enviarMensaje } from "@/app/actions/comunicacion";

export type MensajeSerializado = {
  id_mensaje: string;
  contenido: string;
  horaLabel: string;
  esPropio: boolean;
};

// Chat 1 a 1 (coach-alumno) reutilizado desde /panel/mensajes y
// /coach/mensajes/[id_alumno]. No es tiempo real: cada envío revalida la
// página vía Server Action, así que llega en el próximo request, no por
// websocket — suficiente para el volumen de mensajes de un gimnasio, sin
// sumar infraestructura nueva.
export function ChatThread({
  idConversacion,
  nombreOtro,
  mensajes,
}: {
  idConversacion: string;
  nombreOtro: string;
  mensajes: MensajeSerializado[];
}) {
  const [state, action, pending] = useActionState(enviarMensaje, undefined);
  const finRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cantidadPrevia = useRef(mensajes.length);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    if (mensajes.length !== cantidadPrevia.current) {
      finRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      cantidadPrevia.current = mensajes.length;
    }
    if (!pending) formRef.current?.reset();
  }, [mensajes.length, pending]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-4">
        {mensajes.length === 0 ? (
          <p className="text-on-surface-variant text-sm text-center mt-8">
            Todavía no hay mensajes. Escribí el primero.
          </p>
        ) : (
          mensajes.map((m) => (
            <div
              key={m.id_mensaje}
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                m.esPropio
                  ? "self-end bg-primary-container text-black rounded-br-sm"
                  : "self-start bg-[#262626] text-on-surface rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
              <span
                className={`block text-[10px] mt-1 text-right ${
                  m.esPropio ? "text-black/60" : "text-on-surface-variant"
                }`}
              >
                {m.horaLabel}
              </span>
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      {state?.error && (
        <p className="text-[#ffb4ab] text-xs px-4 pb-1">{state.error}</p>
      )}

      <form
        ref={formRef}
        action={action}
        className="flex items-center gap-2 p-3 border-t border-[#262626] bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <input type="hidden" name="id_conversacion" value={idConversacion} />
        <input
          name="contenido"
          type="text"
          required
          autoComplete="off"
          placeholder={`Mensaje para ${nombreOtro}...`}
          className="flex-1 min-w-0 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded-full text-on-surface text-sm px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Enviar"
          className="w-10 h-10 shrink-0 bg-primary-container text-black rounded-full flex items-center justify-center disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </form>
    </div>
  );
}
