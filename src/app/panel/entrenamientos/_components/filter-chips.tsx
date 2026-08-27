"use client";

import { useState } from "react";

const FILTROS = ["Todos", "Fuerza", "Acondicionamiento", "Movilidad"];

export function FilterChips() {
  const [activo, setActivo] = useState("Todos");

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {FILTROS.map((filtro) => {
        const seleccionado = filtro === activo;
        return (
          <button
            key={filtro}
            type="button"
            onClick={() => setActivo(filtro)}
            className={`px-6 py-2 rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase whitespace-nowrap shrink-0 transition-all active:scale-95 border ${
              seleccionado
                ? "border-primary-container bg-primary-container text-background"
                : "border-outline-variant bg-transparent text-on-surface-variant hover:border-primary-container hover:text-primary-container"
            }`}
          >
            {filtro}
          </button>
        );
      })}
    </div>
  );
}