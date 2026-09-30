"use client";

import { useId, useMemo, useState } from "react";

export type EjercicioCatalogo = {
  id_ejercicio: string;
  nombre: string;
  series_default: number | null;
  repeticiones_default: string | null;
  peso_sugerido_default: string | null;
  tempo_default: string | null;
  descanso_default: string | null;
  metodo_entrenamiento_default: string | null;
  tiempo_bajo_tension_default: number | null;
};

// Buscador de la Biblioteca de Ejercicios: se escribe parte del nombre y
// se elige de la lista. Reemplaza al <select> gigante con todos los
// ejercicios, que en una biblioteca grande era lento de recorrer.
export function SelectorEjercicio({
  idSeleccionado,
  nombreSeleccionado,
  catalogo,
  onElegir,
  autoFocus,
}: {
  idSeleccionado: string;
  nombreSeleccionado: string;
  catalogo: EjercicioCatalogo[];
  onElegir: (ejercicio: EjercicioCatalogo) => void;
  autoFocus?: boolean;
}) {
  const idLista = useId();
  const [busqueda, setBusqueda] = useState<string | null>(null);
  const [resaltado, setResaltado] = useState(0);
  const abierto = busqueda !== null;

  const resultados = useMemo(() => {
    const q = (busqueda ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    const normalizar = (t: string) =>
      t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return (q ? catalogo.filter((e) => normalizar(e.nombre).includes(q)) : catalogo).slice(0, 8);
  }, [busqueda, catalogo]);

  function elegir(ejercicio: EjercicioCatalogo) {
    onElegir(ejercicio);
    setBusqueda(null);
  }

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        value={abierto ? busqueda : nombreSeleccionado}
        placeholder="Buscar en la biblioteca de ejercicios"
        onFocus={() => {
          setBusqueda("");
          setResaltado(0);
        }}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setResaltado(0);
        }}
        onBlur={() => setTimeout(() => setBusqueda(null), 150)}
        onKeyDown={(e) => {
          if (!abierto) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setResaltado((i) => Math.min(resultados.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setResaltado((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            // Enter nunca envía el form del día desde el buscador.
            e.preventDefault();
            if (resultados[resaltado]) elegir(resultados[resaltado]);
          } else if (e.key === "Escape") {
            setBusqueda(null);
          }
        }}
        className={`w-full bg-[#262626] border focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 ${
          idSeleccionado ? "border-transparent font-semibold" : "border-[#ffb4ab]/40"
        }`}
      />
      {abierto && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-[#1f1f1f] border border-[#333] rounded-lg shadow-2xl py-1"
        >
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-on-surface-variant">
              No hay ejercicios con ese nombre en la biblioteca.
            </li>
          ) : (
            resultados.map((e, i) => (
              <li
                key={e.id_ejercicio}
                role="option"
                aria-selected={i === resaltado}
                // onMouseDown (no onClick) para que dispare antes del blur del input.
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  elegir(e);
                }}
                onMouseEnter={() => setResaltado(i)}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  i === resaltado ? "bg-primary-container/10 text-primary-container" : "text-on-surface"
                }`}
              >
                {e.nombre}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
