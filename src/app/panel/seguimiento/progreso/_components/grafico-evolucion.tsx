"use client";

import { useState } from "react";

export type SerieMetrica = {
  clave: string;
  etiqueta: string;
  unidad: string;
  puntos: { fecha: string; valor: number }[];
};

const ANCHO = 300;
const ALTO = 120;
const PAD_Y = 18;

export function GraficoEvolucion({ series }: { series: SerieMetrica[] }) {
  const conDatos = series.filter((s) => s.puntos.length >= 2);
  const [activa, setActiva] = useState(conDatos[0]?.clave ?? series[0]?.clave);

  if (conDatos.length === 0) return null;

  const serie = conDatos.find((s) => s.clave === activa) ?? conDatos[0];
  const valores = serie.puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  const coords = serie.puntos.map((p, i) => {
    const x = (i / (serie.puntos.length - 1)) * ANCHO;
    const y = ALTO - PAD_Y - ((p.valor - min) / rango) * (ALTO - PAD_Y * 2);
    return { x, y, ...p };
  });
  const puntosLinea = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const ultimo = coords[coords.length - 1];

  return (
    <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Evolución
        </h2>
        <div className="flex gap-1">
          {conDatos.map((s) => (
            <button
              key={s.clave}
              type="button"
              onClick={() => setActiva(s.clave)}
              className={`font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] uppercase px-2.5 py-1 rounded-full border transition-colors ${
                serie.clave === s.clave
                  ? "bg-primary-container text-black border-primary-container"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              {s.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface tabular-nums">
          {ultimo.valor}
          {serie.unidad}
        </span>
        <span className="text-xs text-on-surface-variant">
          último registro · {ultimo.fecha}
        </span>
      </div>

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-28" preserveAspectRatio="none">
        <line
          x1="0"
          y1={ALTO - PAD_Y}
          x2={ANCHO}
          y2={ALTO - PAD_Y}
          stroke="#262626"
          strokeWidth="1"
        />
        <line x1="0" y1={PAD_Y} x2={ANCHO} y2={PAD_Y} stroke="#262626" strokeWidth="1" />
        <polyline points={puntosLinea} fill="none" stroke="#61edda" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.5 : 2}
            fill="#61edda"
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-on-surface-variant tabular-nums">
        <span>
          {coords[0].fecha} · {coords[0].valor}
          {serie.unidad}
        </span>
        <span>
          {ultimo.fecha} · {ultimo.valor}
          {serie.unidad}
        </span>
      </div>
    </section>
  );
}
