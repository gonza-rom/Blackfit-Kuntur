"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Chrome/Edge/Android disparan este evento cuando el navegador considera
// la PWA instalable (manifest válido + service worker activo + HTTPS).
// No está tipado en lib.dom.d.ts todavía, de ahí la interfaz mínima.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function suscribirseAInstalado(notificar: () => void) {
  window.addEventListener("appinstalled", notificar);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", notificar);
  return () => {
    window.removeEventListener("appinstalled", notificar);
    media.removeEventListener("change", notificar);
  };
}

function leerInstalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari/iOS expone esto en vez de la media query display-mode.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// El user-agent no cambia durante la vida de la pestaña — no hace falta
// suscripción real, solo un snapshot estable por lado (servidor/cliente)
// para que useSyncExternalStore no dispare hidratación inconsistente.
function suscribirseNoop() {
  return () => {};
}

function leerEsIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Banner discreto para instalar la PWA — mismo lenguaje visual que
 * ActivarPush. Android/desktop (Chrome, Edge) exponen `beforeinstallprompt`
 * y acá se dispara `.prompt()` real al tocar el botón. iOS Safari nunca
 * dispara ese evento (no lo soporta), así que ahí se muestran instrucciones
 * manuales en vez de un botón que no haría nada.
 */
export function InstalarApp() {
  const instalado = useSyncExternalStore(suscribirseAInstalado, leerInstalado, () => false);
  const esIOS = useSyncExternalStore(suscribirseNoop, leerEsIOS, () => false);
  const [descartado, setDescartado] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function alEstarDisponible(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    function alInstalar() {
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", alEstarDisponible);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alEstarDisponible);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    // Se dispara igual haya aceptado o no: el navegador no vuelve a ofrecer
    // el mismo evento, así que no tiene sentido dejar el botón activo.
    setPromptEvent(null);
  }

  if (instalado || descartado) return null;
  if (!promptEvent && !esIOS) return null;

  if (!promptEvent && esIOS) {
    return (
      <div className="flex items-center justify-between gap-3 bg-[#1A1A1A] border border-[#262626] rounded-xl px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs text-on-surface">
          <span className="material-symbols-outlined text-[16px] text-primary-container">
            ios_share
          </span>
          Instalá la app: tocá Compartir y elegí &quot;Agregar a inicio&quot;.
        </span>
        <button
          onClick={() => setDescartado(true)}
          className="shrink-0 text-on-surface-variant hover:text-on-surface text-sm leading-none"
          aria-label="Descartar"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-[#1A1A1A] border border-[#262626] rounded-xl px-4 py-2.5">
      <span className="flex items-center gap-2 text-xs text-on-surface">
        <span className="material-symbols-outlined text-[16px] text-primary-container">
          install_mobile
        </span>
        Instalá BLACK HUB para acceso rápido desde tu pantalla de inicio.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={instalar}
          className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase bg-primary-container text-black px-3 py-1.5 rounded-full font-bold"
        >
          Instalar
        </button>
        <button
          onClick={() => setDescartado(true)}
          className="text-on-surface-variant hover:text-on-surface text-sm leading-none"
          aria-label="Descartar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
