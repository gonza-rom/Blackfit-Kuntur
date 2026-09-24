"use client";

import { useActionState, useState } from "react";
import { registrarse } from "@/app/actions/auth";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface";
const SECTION_TITLE =
  "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.14em] text-primary-container uppercase";

const CATEGORIAS_SUGERIDAS = [
  "Nutrición",
  "Suplementos",
  "Indumentaria deportiva",
  "Kinesiología y fisioterapia",
  "Estética",
  "Gastronomía saludable",
  "Eventos y seminarios",
];

export function FormRegistroComercio() {
  const [state, action, pending] = useActionState(registrarse, undefined);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="tipo" value="comercio" />

      <div className="flex flex-col gap-4">
        <span className={SECTION_TITLE}>Datos del comercio</span>

        <div className="flex flex-col gap-2">
          <label htmlFor="nombre_comercio" className={LABEL}>
            Nombre del comercio
          </label>
          <input
            id="nombre_comercio"
            name="nombre_comercio"
            type="text"
            required
            placeholder="Ej. Nutrisport Catamarca"
            className={INPUT}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="categoria" className={LABEL}>
            Rubro
          </label>
          <input
            id="categoria"
            name="categoria"
            type="text"
            list="categorias-sugeridas"
            placeholder="Ej. Nutrición, suplementos, indumentaria..."
            className={INPUT}
          />
          <datalist id="categorias-sugeridas">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="telefono" className={LABEL}>
              Teléfono (opcional)
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              autoComplete="tel"
              placeholder="+54 9 383..."
              className={INPUT}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="direccion" className={LABEL}>
              Dirección (opcional)
            </label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              placeholder="Calle y número"
              className={INPUT}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="descripcion" className={LABEL}>
            Descripción breve (opcional)
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
            placeholder="Contanos qué ofrece tu comercio"
            className={`${INPUT} resize-none`}
          />
        </div>
      </div>

      <div className="h-px bg-[#262626]" />

      <div className="flex flex-col gap-4">
        <span className={SECTION_TITLE}>Datos del responsable</span>

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
              placeholder="contacto@tucomercio.com"
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
      </div>

      <p className="font-[family-name:var(--font-inter)] text-[13px] text-on-surface-variant leading-relaxed bg-[#131313] border border-[#262626] rounded-lg p-3">
        Tu comercio queda <span className="text-[#eda100] font-medium">en revisión</span> apenas
        te registrás. El equipo de Kuntur Training Club lo revisa y te contacta para activarlo y
        cargar tus beneficios.
      </p>

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
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-1 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
      >
        {pending ? "REGISTRANDO..." : "REGISTRAR MI COMERCIO"}
        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
      </button>
    </form>
  );
}
