"use client";

import { useMemo, useState } from "react";

type Comercio = {
  id_comercio: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  logo: string | null;
};

type Beneficio = {
  id_beneficio: string;
  titulo: string;
  descripcion: string | null;
  descuento: string | null;
};

type ComercioConBeneficio = { comercio: Comercio; beneficio: Beneficio };

export function MerchantList({ comercios }: { comercios: ComercioConBeneficio[] }) {
  const categorias = useMemo(() => {
    const set = new Set(
      comercios
        .map((c) => c.comercio.categoria)
        .filter((c): c is string => Boolean(c))
    );
    return Array.from(set);
  }, [comercios]);

  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

  const comerciosFiltrados = categoriaActiva
    ? comercios.filter((c) => c.comercio.categoria === categoriaActiva)
    : comercios;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoriaActiva(null)}
          className={`border px-4 py-2 rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase transition-colors ${
            categoriaActiva === null
              ? "border-primary-container bg-primary-container/10 text-primary-container"
              : "border-outline-variant text-on-surface-variant hover:border-primary-container/50"
          }`}
        >
          Todos
        </button>
        {categorias.map((categoria) => (
          <button
            key={categoria}
            type="button"
            onClick={() => setCategoriaActiva(categoria)}
            className={`border px-4 py-2 rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase transition-colors ${
              categoriaActiva === categoria
                ? "border-primary-container bg-primary-container/10 text-primary-container"
                : "border-outline-variant text-on-surface-variant hover:border-primary-container/50"
            }`}
          >
            {categoria}
          </button>
        ))}
      </div>

      {comerciosFiltrados.length === 0 ? (
        <div className="border border-outline-variant bg-[#1a1a1a] rounded-lg p-6 text-center">
          <p className="font-[family-name:var(--font-inter)] text-on-surface-variant text-sm">
            No hay comercios en esta categoría todavía.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {comerciosFiltrados.map(({ comercio, beneficio }) => (
            <div
              key={comercio.id_comercio}
              className="bg-[#1a1a1a] border border-outline-variant rounded-lg overflow-hidden flex flex-col"
            >
              <div className="h-24 w-full relative bg-[#262626] flex items-end p-4">
                {beneficio.descuento && (
                  <span className="font-[family-name:var(--font-sora)] text-[24px] font-bold text-primary-container">
                    {beneficio.descuento}
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col gap-2">
                <h4 className="font-[family-name:var(--font-sora)] text-[20px] font-semibold text-on-surface">
                  {comercio.nombre}
                </h4>
                <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant mb-2">
                  {beneficio.descripcion ?? comercio.descripcion ?? beneficio.titulo}
                </p>
                <button
                  type="button"
                  className="w-full bg-primary-container text-background font-[family-name:var(--font-sora)] text-[14px] py-3 rounded text-center uppercase tracking-wider font-bold"
                >
                  Ver Beneficio
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}