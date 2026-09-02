"use client";

import { useActionState, useState } from "react";
import {
  editarRecursoBiblioteca,
  eliminarRecursoBiblioteca,
} from "@/app/actions/biblioteca";

const CATEGORIAS = [
  { value: "ejercicios", label: "Ejercicios" },
  { value: "tecnicas", label: "Técnicas" },
  { value: "movilidad", label: "Movilidad" },
  { value: "recuperacion", label: "Recuperación" },
  { value: "nutricion", label: "Nutrición" },
  { value: "metodologia", label: "Metodología" },
];

const ETIQUETAS: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label])
);

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";

export type RecursoSerializado = {
  id_recurso: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  tipo_contenido: string | null;
  url_contenido: string | null;
};

export function RecursoItem({ recurso }: { recurso: RecursoSerializado }) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(editarRecursoBiblioteca, undefined);

  if (editar) {
    return (
      <form
        action={action}
        className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
      >
        <input type="hidden" name="id_recurso" value={recurso.id_recurso} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            name="titulo"
            type="text"
            required
            defaultValue={recurso.titulo}
            placeholder="Título del recurso"
            className={INPUT}
          />
          <select
            name="categoria"
            required
            defaultValue={recurso.categoria}
            className={INPUT}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="descripcion"
          rows={2}
          defaultValue={recurso.descripcion ?? ""}
          placeholder="Descripción breve"
          className={INPUT}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            name="tipo_contenido"
            type="text"
            defaultValue={recurso.tipo_contenido ?? ""}
            placeholder="Tipo (video, artículo, pdf)"
            className={INPUT}
          />
          <input
            name="url_contenido"
            type="url"
            defaultValue={recurso.url_contenido ?? ""}
            placeholder="Link al contenido (opcional)"
            className={INPUT}
          />
        </div>
        {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={() => setEditar(false)}
            className="text-on-surface-variant text-sm px-4 py-2"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase text-primary-container border border-primary-container rounded-full px-2 py-0.5">
            {ETIQUETAS[recurso.categoria] ?? recurso.categoria}
          </span>
          {recurso.tipo_contenido && (
            <span className="text-[11px] text-on-surface-variant">
              {recurso.tipo_contenido}
            </span>
          )}
        </div>
        <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
          {recurso.titulo}
        </p>
        {recurso.descripcion && (
          <p className="text-sm text-on-surface-variant mt-1">{recurso.descripcion}</p>
        )}
        {recurso.url_contenido && (
          <a
            href={recurso.url_contenido}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-container underline mt-1 inline-block"
          >
            Ver contenido
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditar(true)}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Editar"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
        <form action={eliminarRecursoBiblioteca}>
          <input type="hidden" name="id_recurso" value={recurso.id_recurso} />
          <button
            type="submit"
            className="text-on-surface-variant hover:text-[#ffb4ab] transition-colors"
            aria-label="Eliminar"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </form>
      </div>
    </div>
  );
}
