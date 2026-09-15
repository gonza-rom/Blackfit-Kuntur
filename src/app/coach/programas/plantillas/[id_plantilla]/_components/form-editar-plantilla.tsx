"use client";

import { useActionState, useState } from "react";
import { editarPlantillaPrograma, eliminarPlantilla } from "@/app/actions/coach";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 transition-colors";

type Plantilla = {
  id_programa: string;
  nombre: string;
  descripcion: string | null;
  objetivo: string | null;
  cantidadBloques: number;
};

export function FormEditarPlantilla({ plantilla }: { plantilla: Plantilla }) {
  const [editar, setEditar] = useState(false);
  const [state, action, pending] = useActionState(editarPlantillaPrograma, undefined);

  if (editar) {
    return (
      <section className="flex flex-col gap-1">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id_plantilla" value={plantilla.id_programa} />
          <input
            name="nombre"
            type="text"
            required
            defaultValue={plantilla.nombre}
            placeholder="Nombre de la plantilla"
            className={INPUT}
          />
          <input
            name="objetivo"
            type="text"
            defaultValue={plantilla.objetivo ?? ""}
            placeholder="Objetivo (opcional)"
            className={INPUT}
          />
          <textarea
            name="descripcion"
            rows={2}
            defaultValue={plantilla.descripcion ?? ""}
            placeholder="Descripción (opcional)"
            className={INPUT}
          />
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
      </section>
    );
  }

  return (
    <section className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
            {plantilla.nombre}
          </h1>
          <button
            type="button"
            onClick={() => setEditar(true)}
            className="text-on-surface-variant hover:text-primary-container"
            aria-label="Editar plantilla"
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
        </div>
        <p className="text-sm text-on-surface-variant">
          Plantilla — {plantilla.cantidadBloques} bloque
          {plantilla.cantidadBloques === 1 ? "" : "s"}
        </p>
        {plantilla.objetivo && (
          <p className="text-sm text-on-surface-variant">Objetivo: {plantilla.objetivo}</p>
        )}
        {plantilla.descripcion && (
          <p className="text-sm text-on-surface-variant mt-1">{plantilla.descripcion}</p>
        )}
      </div>

      <form
        action={eliminarPlantilla}
        onSubmit={(e) => {
          if (!confirm(`¿Eliminar la plantilla "${plantilla.nombre}"? No se puede deshacer.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id_plantilla" value={plantilla.id_programa} />
        <button
          type="submit"
          aria-label="Eliminar plantilla"
          className="shrink-0 text-on-surface-variant hover:text-[#ffb4ab] p-1.5"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </button>
      </form>
    </section>
  );
}
