"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { consultarAccesoEntrenamiento } from "@/app/actions/usuario";
import type { EstadoAccesoEntrenamiento } from "@/lib/auth";

// Cada cuánto se vuelve a consultar el estado con la app abierta.
const INTERVALO_MS = 60 * 1000;
// setTimeout no admite más de ~24,8 días.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// La membresía puede vencer (o el coach suspenderla / activarla) mientras
// el alumno tiene la app abierta o en segundo plano. Este componente no
// decide nada: cuando el estado cambia, o llega la hora exacta del
// vencimiento, refresca la ruta y el servidor vuelve a aplicar el bloqueo
// (exigirMembresiaActiva en cada página). Así nunca queda a la vista una
// rutina cargada antes de vencer.
export function VigilanteMembresia({
  estadoInicial,
  vencimiento,
}: {
  estadoInicial: EstadoAccesoEntrenamiento;
  vencimiento: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const estadoRef = useRef(estadoInicial);

  useEffect(() => {
    estadoRef.current = estadoInicial;
  }, [estadoInicial]);

  // A la hora exacta del vencimiento.
  useEffect(() => {
    if (estadoInicial !== "permitido" || !vencimiento) return;
    const resto = vencimiento - Date.now();
    if (resto > MAX_TIMEOUT_MS) return;
    const t = setTimeout(() => router.refresh(), Math.max(0, resto) + 1000);
    return () => clearTimeout(t);
  }, [estadoInicial, vencimiento, router]);

  // Al volver del segundo plano y cada tanto con la app abierta.
  useEffect(() => {
    let cancelado = false;
    async function verificar() {
      if (document.visibilityState !== "visible") return;
      try {
        const actual = await consultarAccesoEntrenamiento();
        if (cancelado || !actual) return;
        if (actual.estado !== estadoRef.current) {
          estadoRef.current = actual.estado;
          router.refresh();
        }
      } catch {
        // Sin conexión: el servidor igual rechaza todo al reconectar.
      }
    }
    const intervalo = setInterval(verificar, INTERVALO_MS);
    document.addEventListener("visibilitychange", verificar);
    window.addEventListener("pageshow", verificar);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificar);
      window.removeEventListener("pageshow", verificar);
    };
  }, [router, pathname]);

  return null;
}
