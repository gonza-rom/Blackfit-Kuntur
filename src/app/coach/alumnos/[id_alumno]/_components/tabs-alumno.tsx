"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "planificacion", etiqueta: "Planificación" },
  { valor: "ejecucion", etiqueta: "Ejecución" },
  { valor: "objetivos", etiqueta: "Objetivos" },
  { valor: "composicion", etiqueta: "Composición" },
  { valor: "fotos", etiqueta: "Fotos" },
  { valor: "historial", etiqueta: "Historial" },
] as const;

export type TabAlumno = (typeof TABS)[number]["valor"];

export function TabsAlumno({
  inicial,
  panels,
}: {
  inicial: string;
  panels: Record<TabAlumno, ReactNode>;
}) {
  const inicialValida = TABS.some((t) => t.valor === inicial) ? (inicial as TabAlumno) : "resumen";
  const [activa, setActiva] = useState<TabAlumno>(inicialValida);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setActiva(t.valor)}
            className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3.5 py-2 rounded-full border transition-colors ${
              activa === t.valor
                ? "bg-primary-container text-black border-primary-container"
                : "border-outline-variant text-on-surface-variant"
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>
      <div>{panels[activa]}</div>
    </div>
  );
}
