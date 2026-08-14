"use client";

import { useActionState, useRef, useEffect } from "react";
import { crearRecursoBiblioteca } from "@/app/actions/biblioteca";

const CATEGORIAS = [
  { value: "ejercicios", label: "Ejercicios" },
  { value: "tecnicas", label: "Técnicas" },
  { value: "movilidad", label: "Movilidad" },
  { value: "recuperacion", label: "Recuperación" },
  { value: "nutricion", label: "Nutrición" },
  { value: "metodologia", label: "Metodología" },
];

export function FormNuevoRecurso() {
  const [state, action, pending] = useActionState(crearRecursoBiblioteca, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) formRef.current?.reset();
  }, [state]);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            name="titulo"
            type="text"
            required
            placeholder="Título del recurso"
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-3"
          />
          <select
            name="categoria"
            required
            defaultValue=""
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-3"
          >
            <option value="" disabled>
              Categoría
            </option>
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
          placeholder="Descripción breve"
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-3"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            name="tipo_contenido"
            type="text"
            placeholder="Tipo (video, artículo, pdf)"
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-3"
          />
          <input
            name="url_contenido"
            type="url"
            placeholder="Link al contenido (opcional)"
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-3"
          />
        </div>
        {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
        >
          {pending ? "Publicando..." : "Publicar recurso"}
        </button>
      </form>
    </div>
  );
}
