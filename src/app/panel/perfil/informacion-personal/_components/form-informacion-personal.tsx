"use client";

import { useActionState, useState } from "react";
import { actualizarInformacionPersonal } from "@/app/actions/usuario";

export function FormInformacionPersonal({
  nombre,
  apellido,
  telefono,
  email,
  fotoActual,
}: {
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string;
  fotoActual?: string | null;
}) {
  const [state, action, pending] = useActionState(actualizarInformacionPersonal, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const inicial = nombre.charAt(0).toUpperCase();

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden border border-[#262626] bg-[#1A1A1A] flex items-center justify-center shrink-0">
          {preview || fotoActual ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar subido a Supabase Storage, no un asset del build
            <img
              src={preview ?? fotoActual ?? undefined}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-[family-name:var(--font-sora)] text-2xl font-bold text-primary-container">
              {inicial}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="foto_perfil"
            className="font-[family-name:var(--font-sora)] text-sm font-bold text-primary-container cursor-pointer w-fit"
          >
            Cambiar foto
          </label>
          <input
            id="foto_perfil"
            name="foto_perfil"
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
        <label
          htmlFor="email"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="w-full bg-[#1a1a1a] border border-transparent rounded text-on-surface-variant font-[family-name:var(--font-inter)] text-base p-3"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="nombre"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
          >
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={nombre}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label
            htmlFor="apellido"
            className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
          >
            Apellido
          </label>
          <input
            id="apellido"
            name="apellido"
            type="text"
            required
            defaultValue={apellido}
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="telefono"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase"
        >
          Teléfono
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          defaultValue={telefono ?? ""}
          placeholder="Opcional"
          className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
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
