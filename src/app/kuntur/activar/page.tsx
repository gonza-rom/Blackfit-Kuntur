"use client";

import Link from "next/link";
import { useActionState } from "react";
import { activarCuentaSocio } from "@/app/actions/kuntur";
import { LogoMarca } from "@/components/logo-marca";

const LABEL = "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface";
const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-base p-3 transition-colors";

// Activación de la cuenta de un socio de Kuntur ya registrado (importado
// del Excel o dado de alta en recepción): con su DNI y el código de un
// solo uso que le da Kuntur, elige su contraseña. Nunca hay contraseñas
// predeterminadas. Sirve también para recuperar el acceso (código nuevo).
export default function ActivarCuentaSocioPage() {
  const [state, action, pending] = useActionState(activarCuentaSocio, undefined);

  return (
    <div className="min-h-dvh flex flex-1 items-center justify-center bg-black px-5 py-10">
      <main className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-3">
          <LogoMarca marca="kuntur" size={64} className="border-2 border-[#262626]" />
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-primary-container">Activá tu cuenta de socio</h1>
          <p className="text-sm text-on-surface-variant">
            Kuntur Training Club. Pedí tu código de activación en recepción (vale 7 días).
          </p>
        </div>

        <form action={action} className="bg-[#1A1A1A]/80 border border-[#262626] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="dni" className={LABEL}>DNI</label>
            <input id="dni" name="dni" inputMode="numeric" required placeholder="Sin puntos" className={INPUT} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="codigo" className={LABEL}>Código de activación</label>
            <input id="codigo" name="codigo" required autoComplete="one-time-code" placeholder="XXXX-XXXX" className={`${INPUT} uppercase tracking-[0.2em]`} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className={LABEL}>Tu email (opcional)</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="Para entrar también con tu email" className={INPUT} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className={LABEL}>Elegí tu contraseña</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={INPUT} />
            <p className="text-xs text-on-surface-variant">Mínimo 8 caracteres, con al menos una letra y un número.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className={LABEL}>Repetí la contraseña</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className={INPUT} />
          </div>

          {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
          {state?.message && <p className="text-sm text-primary-container">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded disabled:opacity-60"
          >
            {pending ? "Activando..." : "Activar mi cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-on-surface-variant">
          ¿Ya la activaste?{" "}
          <Link href="/iniciar-sesion" className="text-primary-container font-semibold">
            Iniciá sesión
          </Link>
        </p>
      </main>
    </div>
  );
}
