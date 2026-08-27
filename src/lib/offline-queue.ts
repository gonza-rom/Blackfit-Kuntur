"use client";

const CLAVE = "bh_pendientes_entrenamiento";

export type SesionPendiente = {
  id_local: string;
  id_bloque: string;
  comentario_general: string | null;
  series: {
    id_ejercicio_programa: string;
    peso_utilizado: number | null;
    repeticiones_realizadas: number | null;
    series_completadas: number | null;
    rpe: number | null;
    descanso_real: number | null;
    tiempo_bajo_tension: number | null;
    comentarios: string | null;
  }[];
  guardado_en: string;
};

function leerCola(): SesionPendiente[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLAVE);
    return raw ? (JSON.parse(raw) as SesionPendiente[]) : [];
  } catch {
    return [];
  }
}

function guardarCola(cola: SesionPendiente[]): void {
  window.localStorage.setItem(CLAVE, JSON.stringify(cola));
}

export function encolarSesion(sesion: Omit<SesionPendiente, "id_local" | "guardado_en">): void {
  const cola = leerCola();
  cola.push({
    ...sesion,
    id_local: crypto.randomUUID(),
    guardado_en: new Date().toISOString(),
  });
  guardarCola(cola);
}

export function contarPendientes(): number {
  return leerCola().length;
}

/** Intenta enviar cada sesión encolada. Devuelve cuántas se sincronizaron. */
export async function sincronizarPendientes(): Promise<number> {
  const cola = leerCola();
  if (cola.length === 0) return 0;

  let sincronizadas = 0;
  const restantes: SesionPendiente[] = [];

  for (const sesion of cola) {
    try {
      const res = await fetch("/api/entrenamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sesion),
      });
      if (res.ok) {
        sincronizadas++;
      } else {
        restantes.push(sesion);
      }
    } catch {
      restantes.push(sesion);
    }
  }

  guardarCola(restantes);
  return sincronizadas;
}
