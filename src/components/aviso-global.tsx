"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Muestra como ventanita emergente el aviso que dejó una server action vía
// avisar() (src/lib/aviso.ts). La cookie llega en la respuesta de la acción
// sin que cambie necesariamente la URL (las acciones que solo hacen
// revalidatePath no navegan), así que no alcanza con mirar el pathname: se
// escucha `cookieStore` donde existe y, como respaldo, se revisa
// document.cookie cada poco — leerla es instantáneo y no toca la red.
const COOKIE_AVISO = "aviso_accion";
const DURACION_MS = 2800;

type Aviso = { mensaje: string; tipo: "exito" | "eliminado" | "info"; id: number };

const ESTILO: Record<Aviso["tipo"], { icono: string; titulo: string; color: string }> = {
  exito: { icono: "check_circle", titulo: "¡Listo!", color: "text-primary-container bg-primary-container/10" },
  eliminado: { icono: "delete", titulo: "Eliminado", color: "text-[#ffb4ab] bg-[#ffb4ab]/10" },
  info: { icono: "info", titulo: "Aviso", color: "text-[#8ab4f8] bg-[#8ab4f8]/10" },
};

function leerYConsumirAviso(): Aviso | null {
  const par = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_AVISO}=`));
  if (!par) return null;

  document.cookie = `${COOKIE_AVISO}=; path=/; max-age=0`;
  try {
    const aviso = JSON.parse(decodeURIComponent(par.slice(COOKIE_AVISO.length + 1)));
    if (typeof aviso?.mensaje !== "string") return null;
    return {
      mensaje: aviso.mensaje,
      tipo: aviso.tipo in ESTILO ? aviso.tipo : "exito",
      id: Number(aviso.id) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function AvisoGlobal() {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setAviso(null);
  }, []);

  const revisar = useCallback(() => {
    const nuevo = leerYConsumirAviso();
    if (!nuevo) return;
    if (timer.current) clearTimeout(timer.current);
    setAviso(nuevo);
    timer.current = setTimeout(() => setAviso(null), DURACION_MS);
  }, []);

  useEffect(() => {
    const inicial = setTimeout(revisar, 0);
    const intervalo = setInterval(revisar, 400);
    const store = (globalThis as { cookieStore?: EventTarget }).cookieStore;
    store?.addEventListener("change", revisar);
    return () => {
      clearTimeout(inicial);
      clearInterval(intervalo);
      store?.removeEventListener("change", revisar);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [revisar]);

  useEffect(() => {
    if (!aviso) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter") cerrar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [aviso, cerrar]);

  if (!aviso) return null;
  const estilo = ESTILO[aviso.tipo];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-5 animate-[aviso-fondo_150ms_ease-out]"
      onClick={cerrar}
    >
      <div
        key={aviso.id}
        role="status"
        aria-live="polite"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs bg-[#1A1A1A] border border-[#262626] rounded-2xl p-6 flex flex-col items-center gap-3 text-center shadow-2xl animate-[aviso-entrada_200ms_ease-out]"
      >
        <span className={`flex items-center justify-center w-14 h-14 rounded-full ${estilo.color}`}>
          <span className="material-symbols-outlined text-[32px]">{estilo.icono}</span>
        </span>
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold text-on-surface">
          {estilo.titulo}
        </h2>
        <p className="text-sm text-on-surface-variant">{aviso.mensaje}</p>
        <button
          type="button"
          onClick={cerrar}
          autoFocus
          className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-5 py-2 rounded-full bg-primary-container text-black hover:opacity-90 transition-opacity"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
