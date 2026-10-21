"use client";

// Entrenamiento EN CURSO, guardado en el teléfono (localStorage) a medida
// que el alumno carga series. Antes todo vivía solo en el estado de la
// pantalla: al ir a Inicio/Perfil y volver se perdían pesos, reps y el
// tiempo. Ahora:
// - Cada sesión tiene un id único (id_sesion) desde que se abre el día.
// - El tiempo se calcula desde la hora de inicio guardada, no desde que
//   se montó la pantalla, así navegar o recargar no lo reinicia.
// - Se borra solo cuando el servidor confirmó el guardado (o quedó en la
//   cola offline). Salir de la pantalla NO finaliza la sesión.
// Se guarda por alumno y por día de entrenamiento, así un teléfono
// compartido no mezcla sesiones de dos alumnos.

const PREFIJO = "bh_sesion_en_curso";
// Una sesión abandonada no queda "en curso" para siempre.
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

export type BorradorSesion = {
  version: 1;
  id_sesion: string;
  id_alumno: string;
  id_bloque: string;
  titulo: string;
  inicio: number; // epoch ms
  actualizado: number;
  // Valor de cada input del formulario, por su name (peso_<id>_<n>, reps_..., rpe_..., etc.).
  valores: Record<string, string>;
  filas: Record<string, number>;
  completados: string[];
  checks: string[];
  rondaActiva: Record<string, number>;
  sensacion: number | null;
  comentario: string;
};

function clave(idAlumno: string, idBloque: string): string {
  return `${PREFIJO}:${idAlumno}:${idBloque}`;
}

function valido(b: unknown): b is BorradorSesion {
  const x = b as BorradorSesion;
  return (
    !!x &&
    x.version === 1 &&
    typeof x.id_sesion === "string" &&
    typeof x.inicio === "number" &&
    typeof x.valores === "object" &&
    Date.now() - (x.actualizado ?? 0) < VIGENCIA_MS
  );
}

export function leerBorrador(idAlumno: string, idBloque: string): BorradorSesion | null {
  try {
    const raw = window.localStorage.getItem(clave(idAlumno, idBloque));
    if (!raw) return null;
    const b = JSON.parse(raw);
    if (valido(b)) return b;
    window.localStorage.removeItem(clave(idAlumno, idBloque));
  } catch {
    // localStorage bloqueado o JSON corrupto: se arranca una sesión nueva.
  }
  return null;
}

export function guardarBorrador(b: BorradorSesion): void {
  try {
    window.localStorage.setItem(
      clave(b.id_alumno, b.id_bloque),
      JSON.stringify({ ...b, actualizado: Date.now() })
    );
  } catch {
    // Sin espacio o almacenamiento bloqueado: la sesión sigue en pantalla.
  }
}

export function borrarBorrador(idAlumno: string, idBloque: string): void {
  try {
    window.localStorage.removeItem(clave(idAlumno, idBloque));
  } catch {
    // nada
  }
}

/** Sesiones en curso de un alumno (para el aviso "Continuar entrenamiento"). */
export function listarBorradores(idAlumno: string): BorradorSesion[] {
  const salida: BorradorSesion[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(`${PREFIJO}:${idAlumno}:`)) continue;
      const b = JSON.parse(window.localStorage.getItem(k) ?? "null");
      if (valido(b)) salida.push(b);
    }
  } catch {
    // nada
  }
  return salida.sort((a, b) => b.actualizado - a.actualizado);
}

/** "12:05" o "1:02:09" desde un epoch de inicio. */
export function formatearTranscurrido(inicio: number, ahora: number = Date.now()): string {
  const total = Math.max(0, Math.floor((ahora - inicio) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
