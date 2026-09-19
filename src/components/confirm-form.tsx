"use client";

import { startTransition, useEffect, useRef, useState } from "react";

// Reemplazo de `<form onSubmit={() => confirm(...)}>` por un modal propio,
// con el mismo lenguaje visual del resto de la app (en vez del diálogo
// nativo del navegador, que no se puede estilar y desentona). Drop-in: es
// un <form> normal por fuera — mismos hijos — así que cada botón de
// eliminar/desvincular existente solo cambia la etiqueta `<form>` por
// `<ConfirmForm>` y agrega `mensaje`.
//
// Mecanismo: el <form> NUNCA se envía de forma nativa — todo submit
// (incluido el primer click real) se intercepta y solo abre el modal.
// Al confirmar, se llama a `action` DIRECTO con el FormData del formulario
// en vez de reintentar un submit nativo del DOM (ej. formRef.requestSubmit()):
// React 19 solo garantiza que dispara una Server Action ligada a
// `<form action={fn}>` en un submit nativo del usuario — reproducir ese
// submit programáticamente después de haber hecho preventDefault() en el
// primero no está garantizado y en la práctica rompía el borrado con "An
// unexpected response was received from the server". Llamar a `action`
// como función (soportado explícitamente por React, incluso si viene de
// useActionState) evita depender de ese mecanismo.
export function ConfirmForm({
  action,
  mensaje,
  titulo = "Confirmar acción",
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mensaje: string;
  titulo?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  return (
    <>
      <form
        ref={formRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          setAbierto(true);
        }}
      >
        {children}
      </form>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-5"
          onClick={() => setAbierto(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-form-titulo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[#ffb4ab]/10 text-[#ffb4ab]">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </span>
              <h2
                id="confirm-form-titulo"
                className="font-[family-name:var(--font-sora)] text-base font-bold text-on-surface"
              >
                {titulo}
              </h2>
            </div>

            <p className="text-sm text-on-surface-variant">{mensaje}</p>

            <div className="flex gap-2 justify-end mt-1">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-variant/20 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  if (formRef.current) {
                    // useActionState exige que su dispatch se llame dentro
                    // de una transición cuando se invoca a mano (fuera del
                    // wiring nativo de `<form action={fn}>`) — si no, React
                    // avisa "called outside of a transition" y el pending
                    // state/la respuesta quedan rotos (era la causa real
                    // del "unexpected response").
                    const formData = new FormData(formRef.current);
                    startTransition(() => {
                      action(formData);
                    });
                  }
                }}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full bg-[#ffb4ab] text-[#3a0a09] hover:opacity-90 transition-opacity"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
