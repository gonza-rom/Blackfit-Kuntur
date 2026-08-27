"use client";

import { useActionState, useRef, useEffect } from "react";
import { enviarMensaje } from "@/app/actions/comunicacion";

export type MensajeChat = {
  id_mensaje: string;
  contenido: string;
  fecha_envio: string;
  esMio: boolean;
};

const FORMATEADOR_HORA = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function ChatBox({
  idConversacion,
  nombreInterlocutor,
  mensajes,
}: {
  idConversacion: string;
  nombreInterlocutor: string;
  mensajes: MensajeChat[];
}) {
  const [state, action, pending] = useActionState(enviarMensaje, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pending) formRef.current?.reset();
  }, [pending]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-64px)]">
      <div className="px-5 py-3 border-b border-outline-variant">
        <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
          {nombreInterlocutor}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
        {mensajes.length === 0 && (
          <p className="text-sm text-on-surface-variant text-center mt-8">
            Todavía no hay mensajes. Escribí el primero.
          </p>
        )}
        {mensajes.map((m) => (
          <div
            key={m.id_mensaje}
            className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
              m.esMio
                ? "self-end bg-primary-container text-black rounded-br-sm"
                : "self-start bg-[#262626] text-on-surface rounded-bl-sm"
            }`}
          >
            <p>{m.contenido}</p>
            <p
              className={`text-[10px] mt-1 ${m.esMio ? "text-black/60" : "text-on-surface-variant"}`}
            >
              {FORMATEADOR_HORA.format(new Date(m.fecha_envio))}
            </p>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      <form
        ref={formRef}
        action={action}
        className="flex items-center gap-2 px-5 py-3 border-t border-outline-variant"
      >
        <input type="hidden" name="id_conversacion" value={idConversacion} />
        <input
          name="contenido"
          type="text"
          required
          placeholder="Escribí un mensaje..."
          autoComplete="off"
          className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded-full text-on-surface text-sm px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-10 h-10 rounded-full bg-primary-container text-black flex items-center justify-center disabled:opacity-60 shrink-0"
          aria-label="Enviar"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </form>
      {state?.error && <p className="px-5 pb-2 text-xs text-[#ffb4ab]">{state.error}</p>}
    </div>
  );
}
