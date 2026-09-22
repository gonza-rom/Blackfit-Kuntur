"use client";

import { useActionState, useState } from "react";
import { actualizarPerfilComercio } from "@/app/actions/comercio";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase";

export function FormPerfilComercio({
  nombre,
  descripcion,
  direccion,
  telefono,
  email,
  categoria,
  logoActual,
}: {
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  categoria: string | null;
  logoActual?: string | null;
}) {
  const [state, action, pending] = useActionState(actualizarPerfilComercio, undefined);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#262626] bg-[#1A1A1A] flex items-center justify-center shrink-0">
          {preview || logoActual ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido a Supabase Storage, no un asset del build
            <img
              src={preview ?? logoActual ?? undefined}
              alt="Logo del comercio"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="material-symbols-outlined text-3xl text-on-surface-variant">
              storefront
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="logo"
            className="font-[family-name:var(--font-sora)] text-sm font-bold text-primary-container cursor-pointer w-fit"
          >
            Cambiar logo
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) setPreview(URL.createObjectURL(archivo));
            }}
          />
          <p className="text-xs text-on-surface-variant">JPG o PNG, máx. 4 MB</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="nombre" className={LABEL}>
          Nombre del comercio
        </label>
        <input id="nombre" name="nombre" type="text" required defaultValue={nombre} className={INPUT} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="categoria" className={LABEL}>
          Categoría
        </label>
        <input
          id="categoria"
          name="categoria"
          type="text"
          defaultValue={categoria ?? ""}
          placeholder="Gastronomía, indumentaria, salud..."
          className={INPUT}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="direccion" className={LABEL}>
          Dirección
        </label>
        <input
          id="direccion"
          name="direccion"
          type="text"
          defaultValue={direccion ?? ""}
          className={INPUT}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="telefono" className={LABEL}>
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="text"
            defaultValue={telefono ?? ""}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={LABEL}>
            Email de contacto
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
            className={INPUT}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="descripcion" className={LABEL}>
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          defaultValue={descripcion ?? ""}
          className={INPUT}
        />
      </div>

      {state?.error && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-primary-container">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
