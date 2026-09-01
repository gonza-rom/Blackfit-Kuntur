"use client";

import { useActionState, useState } from "react";
import { registrarse } from "@/app/actions/auth";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface";

export function FormRegistro({
  tipo = "alumno",
}: {
  tipo?: "alumno" | "beneficiario";
}) {
  const [state, action, pending] = useActionState(registrarse, undefined);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Diferencia el alta de beneficiario Kuntur del alta de alumno. El
          servidor igual valida el valor; esto es solo lo que envía el form. */}
      <input type="hidden" name="tipo" value={tipo} />

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="nombre" className={LABEL}>
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="given-name"
            required
            placeholder="Nombre"
            className={INPUT}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="apellido" className={LABEL}>
            Apellido
          </label>
          <input
            id="apellido"
            name="apellido"
            type="text"
            autoComplete="family-name"
            required
            placeholder="Apellido"
            className={INPUT}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={LABEL}>
          Correo electrónico
        </label>
        <div className="relative">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="atleta@blackhub.com"
            className={`${INPUT} peer`}
          />
          <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant peer-focus:text-primary-container transition-colors pointer-events-none">
            mail
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className={LABEL}>
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={mostrarPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            className={`${INPUT} peer`}
          />
          <button
            type="button"
            onClick={() => setMostrarPassword((v) => !v)}
            aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant peer-focus:text-primary-container transition-colors cursor-pointer"
          >
            {mostrarPassword ? "visibility" : "visibility_off"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className={LABEL}>
          Confirmar contraseña
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={mostrarConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Repetí tu contraseña"
            className={`${INPUT} peer`}
          />
          <button
            type="button"
            onClick={() => setMostrarConfirm((v) => !v)}
            aria-label={mostrarConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant peer-focus:text-primary-container transition-colors cursor-pointer"
          >
            {mostrarConfirm ? "visibility" : "visibility_off"}
          </button>
        </div>
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
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
      >
        {pending ? "CREANDO CUENTA..." : "CREAR CUENTA"}
        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
      </button>
    </form>
  );
}
