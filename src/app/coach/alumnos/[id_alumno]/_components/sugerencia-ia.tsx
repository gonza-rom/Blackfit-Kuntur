"use client";

import { useState, useTransition } from "react";
import { generarSugerenciaIA } from "@/app/actions/ia";

export function SugerenciaIA({ idAlumno }: { idAlumno: string }) {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{ error?: string; sugerencia?: string } | null>(
    null
  );

  function pedirSugerencia() {
    startTransition(async () => {
      const r = await generarSugerenciaIA(idAlumno);
      setResultado(r ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={pedirSugerencia}
        disabled={pending}
        className="self-start flex items-center gap-2 font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase text-primary-container border border-primary-container rounded-full px-3 py-1.5 disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
        {pending ? "Pensando..." : "Sugerencia de la IA"}
      </button>

      {resultado?.error && <p className="text-xs text-on-surface-variant">{resultado.error}</p>}
      {resultado?.sugerencia && (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 text-sm text-on-surface">
          {resultado.sugerencia}
        </div>
      )}
    </div>
  );
}
