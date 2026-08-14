"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { contarPendientes, sincronizarPendientes } from "@/lib/offline-queue";

export function OfflineSyncBanner() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<number>(() => contarPendientes());
  const [sincronizando, setSincronizando] = useState(false);

  const refrescarContador = useCallback(() => {
    setPendientes(contarPendientes());
  }, []);

  const sincronizar = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSincronizando(true);
    await sincronizarPendientes();
    setSincronizando(false);
    refrescarContador();
    router.refresh();
  }, [refrescarContador, router]);

  useEffect(() => {
    window.addEventListener("online", sincronizar);
    window.addEventListener("focus", refrescarContador);
    const id = setTimeout(sincronizar, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("online", sincronizar);
      window.removeEventListener("focus", refrescarContador);
    };
  }, [refrescarContador, sincronizar]);

  if (pendientes === 0) return null;

  return (
    <div className="bg-[#3a2a06] border border-[#eda100]/40 text-[#faeeda] text-xs px-4 py-2 flex items-center justify-between gap-3">
      <span>
        {pendientes} sesión{pendientes > 1 ? "es" : ""} de entrenamiento sin sincronizar
        {sincronizando ? " · sincronizando..." : ""}
      </span>
      <button
        onClick={sincronizar}
        disabled={sincronizando}
        className="font-[family-name:var(--font-jetbrains-mono)] tracking-[0.08em] uppercase underline shrink-0 disabled:opacity-60"
      >
        Reintentar
      </button>
    </div>
  );
}
