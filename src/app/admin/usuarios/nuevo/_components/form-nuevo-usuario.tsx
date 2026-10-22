"use client";

import { useActionState, useState } from "react";
import { crearUsuario } from "@/app/actions/admin";

const LABEL = "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase";
const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";

export type OpcionRol = { valor: string; etiqueta: string };

export function FormNuevoUsuario({ roles }: { roles: OpcionRol[] }) {
  const [state, action, pending] = useActionState(crearUsuario, undefined);
  const [verPassword, setVerPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Nombre *</span>
          <input name="nombre" required className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Apellido *</span>
          <input name="apellido" required className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Email *</span>
          <input name="email" type="email" required className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>DNI</span>
          <input name="dni" inputMode="numeric" placeholder="Sin puntos (opcional)" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Teléfono</span>
          <input name="telefono" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Rol *</span>
          <select name="rol" required defaultValue={roles[0]?.valor} className={INPUT}>
            {roles.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Contraseña inicial *</span>
        <div className="flex gap-2">
          <input
            name="password"
            type={verPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className={INPUT}
          />
          <button type="button" onClick={() => setVerPassword((v) => !v)} className="text-xs text-on-surface-variant px-2">
            {verPassword ? "Ocultar" : "Ver"}
          </button>
        </div>
        <span className="text-xs text-on-surface-variant">
          Mínimo 8 caracteres, con letra y número (no puede ser el DNI). Pasásela a la persona por un medio privado.
        </span>
      </label>

      {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}
