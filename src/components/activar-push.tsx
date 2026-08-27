"use client";

import { useEffect, useState } from "react";
import { guardarSuscripcionPush, eliminarSuscripcionPush } from "@/app/actions/push";

function base64UrlAUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Estado = "cargando" | "no-soportado" | "denegado" | "inactivo" | "activo";

/**
 * Banner discreto para activar notificaciones push. Se muestra solo
 * cuando tiene sentido (soportado por el navegador, permiso no denegado
 * de antemano, todavía no suscripto) y desaparece una vez activado o
 * descartado. No pide el permiso solo — el usuario tiene que tocar el
 * botón, así el prompt del navegador no aparece a lo bruto al entrar.
 */
export function ActivarPush() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function revisar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelado) setEstado("no-soportado");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelado) setEstado("denegado");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (!cancelado) setEstado(suscripcion ? "activo" : "inactivo");
    }

    revisar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function activar() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      setEstado("denegado");
      return;
    }

    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8Array(vapidPublicKey) as unknown as BufferSource,
    });

    const json = suscripcion.toJSON();
    const resultado = await guardarSuscripcionPush({
      endpoint: json.endpoint!,
      keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
    });

    if (resultado.ok) setEstado("activo");
  }

  async function desactivar() {
    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    if (suscripcion) {
      await eliminarSuscripcionPush(suscripcion.endpoint);
      await suscripcion.unsubscribe();
    }
    setEstado("inactivo");
  }

  if (estado === "cargando" || estado === "no-soportado" || estado === "denegado" || descartado) {
    return null;
  }

  if (estado === "activo") {
    return (
      <div className="flex items-center justify-between gap-3 bg-[#1A1A1A] border border-[#262626] rounded-xl px-4 py-2.5 text-xs text-on-surface-variant">
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary-container">
            notifications_active
          </span>
          Notificaciones activadas
        </span>
        <button
          onClick={desactivar}
          className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase text-on-surface-variant hover:text-on-surface"
        >
          Desactivar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-[#1A1A1A] border border-[#262626] rounded-xl px-4 py-2.5">
      <span className="flex items-center gap-2 text-xs text-on-surface">
        <span className="material-symbols-outlined text-[16px] text-primary-container">
          notifications
        </span>
        Activá notificaciones para no perderte mensajes y avisos.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={activar}
          className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase bg-primary-container text-black px-3 py-1.5 rounded-full font-bold"
        >
          Activar
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
