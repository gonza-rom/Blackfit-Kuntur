"use client";

import { useEffect, useRef, useState } from "react";

// Reemplazo de `<form onSubmit={() => confirm(...)}>` por un modal propio,
// con el mismo lenguaje visual del resto de la app (en vez del diálogo
// nativo del navegador, que no se puede estilar y desentona). Drop-in: es
// un <form> normal por fuera — mismos hijos — así que cada botón de
// eliminar/desvincular existente solo cambia la etiqueta `<form>` por
// `<ConfirmForm>` y agrega `mensaje`.
//
// Mecanismo (importante — ya se probaron tres alternativas que NO andan):
// - El <form> "gatillo" (el que ve el usuario) NUNCA se envía de verdad —
//   su submit solo se intercepta para copiar sus campos ocultos a estado
//   y abrir el modal.
// - Confirmar en el modal renderiza un SEGUNDO <form action={action}>,
//   real, con esos mismos campos ocultos y su propio botón type="submit"
//   — el envío real pasa por ese botón nativo, no por código, y SIN
//   ningún handler que toque el DOM en el mismo evento (ver abajo).
// Se descartaron: (a) formRef.requestSubmit() para "reproducir" el
// primer submit ya prevenido, y (b) llamar a `action(formData)` a mano
// (incluso envuelto en startTransition) — ambos rompían con "An
// unexpected response was received from the server": el servidor sí
// procesaba la acción (se veía el resultado correcto en los logs), pero
// esa respuesta nunca llegaba a aplicarse del lado del cliente. Y (c)
// cerrar el modal con onClick en el propio botón submit — eso desmonta el
// <form> antes de que el navegador termine de mandarlo ("Form submission
// canceled because the form is not connected"). Un <button type="submit">
// real, dentro de un <form action={fn}> real, sin nada que lo interrumpa,
// es el único camino que funciona de punta a punta.
//
// Por eso el cierre del modal tras confirmar NO pasa por el click: se
// observa `pending` (que cada llamador ya trackea con useActionState) y
// se cierra solo cuando pasa de true a false — o sea, cuando la acción ya
// terminó. Si la acción hace redirect() en el éxito, todo el árbol se
// desmonta solo y esto ni corre. Para acciones sin useActionState (sin
// path de error, siempre terminan en redirect), `pending` queda undefined
// y no hace falta.
export function ConfirmForm({
  action,
  mensaje,
  titulo = "Confirmar acción",
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  className,
  pending,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mensaje: string;
  titulo?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  pending?: boolean;
  children: React.ReactNode;
}) {
  const triggerFormRef = useRef<HTMLFormElement>(null);
  const [campos, setCampos] = useState<[string, string][] | null>(null);
  const eraPending = useRef(false);

  useEffect(() => {
    if (eraPending.current && !pending) {
      setCampos(null);
    }
    eraPending.current = !!pending;
  }, [pending]);

  useEffect(() => {
    if (!campos) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCampos(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [campos]);

  return (
    <>
      <form
        ref={triggerFormRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (!triggerFormRef.current) return;
          const datos = new FormData(triggerFormRef.current);
          setCampos(Array.from(datos.entries(), ([k, v]) => [k, String(v)]));
        }}
      >
        {children}
      </form>

      {campos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-5"
          onClick={() => setCampos(null)}
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

            <form action={action} className="flex gap-2 justify-end mt-1">
              {campos.map(([nombre, valor]) => (
                <input key={nombre} type="hidden" name={nombre} value={valor} />
              ))}
              <button
                type="button"
                onClick={() => setCampos(null)}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-variant/20 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full bg-[#ffb4ab] text-[#3a0a09] hover:opacity-90 transition-opacity"
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
