"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { listarBorradores } from "@/lib/sesion-en-curso";

type Resumen = { id_bloque: string; titulo: string; inicio: number };

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener("focus", avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener("focus", avisar);
  };
}

// Atajo para volver al entrenamiento que quedó en curso (ver
// lib/sesion-en-curso.ts) desde Inicio o Entrenar. No muestra nada si no
// hay ninguno, ni durante el render del servidor.
export function AvisoSesionEnCurso({ idAlumno }: { idAlumno: string }) {
  // El snapshot es un string (JSON) para que sea estable entre renders.
  const json = useSyncExternalStore(
    suscribir,
    () =>
      JSON.stringify(
        listarBorradores(idAlumno).map(
          (b): Resumen => ({ id_bloque: b.id_bloque, titulo: b.titulo, inicio: b.inicio })
        )
      ),
    () => "[]"
  );
  const sesiones = JSON.parse(json) as Resumen[];
  if (sesiones.length === 0) return null;
  const s = sesiones[0];

  return (
    <Link
      href={`/panel/entrenamientos/${s.id_bloque}`}
      className="flex items-center justify-between gap-3 bg-primary-container/10 border border-primary-container/40 rounded-xl px-4 py-3"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span aria-hidden className="w-2 h-2 rounded-full bg-primary-container animate-pulse shrink-0" />
        <span className="min-w-0">
          <span className="block font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-primary-container uppercase">
            Entrenamiento en curso
          </span>
          <span className="block text-sm text-on-surface truncate">{s.titulo}</span>
        </span>
      </span>
      <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-primary-container shrink-0">
        Continuar
      </span>
    </Link>
  );
}
