"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { iniciarSesion } from "@/app/actions/auth";
import { LogoMarca } from "@/components/logo-marca";

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors peer";
const LABEL = "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface";

// Un solo formulario para todos: alumnos y coaches de Blackfit, socios de
// Kuntur y comercios adheridos. No hace falta elegir "por dónde entrar":
// el servidor mira los roles de la cuenta y la manda a su espacio (ver
// destinoTrasLogin en lib/auth.ts); quien usa más de uno cambia desde el
// selector de espacio. Registrarse sí depende de qué quiere usar.
export default function IniciarSesionPage() {
  const [state, action, pending] = useActionState(iniciarSesion, undefined);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [ayudaPassword, setAyudaPassword] = useState(false);

  return (
    <div className="min-h-dvh flex flex-1 items-center justify-center bg-black overflow-hidden relative py-10">
      {/* Imagen de fondo */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div
          className="bg-cover bg-center w-full h-full grayscale"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBFiaK9m-neRJTBX2yG7k2e9vcyr6XaVXEDGZxz13GKOcgZKgRNLkFvQEE-1Imy347l-S0h8ncysjWfY9FzxehyRl340l9Qr1k5-UVR5PtqqXyu4fjXgzaC0dIkTNOTblNzJdhtUOrvMBC4HXo2XssMhocEAxgNOtDUwjdKtpTZuRx2F44VARETO3QIJwXLL5KBsmJ4fIrF679yh16g3gxHidAJpfaZJxZ95B7kEluxm2905F1emDs')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black" />
      </div>

      <main className="relative z-10 w-full max-w-md px-5 md:px-0">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <LogoMarca
              marca="blackfit"
              size={64}
              className="border-2 border-[#262626] [animation:flotar-marca_3.4s_ease-in-out_infinite]"
            />
            <span className="font-[family-name:var(--font-sora)] text-on-surface-variant text-xl">×</span>
            <LogoMarca
              marca="kuntur"
              size={64}
              className="border-2 border-[#262626] [animation:flotar-marca_3.4s_ease-in-out_infinite] [animation-delay:1.1s]"
            />
          </div>
          <h1 className="font-[family-name:var(--font-sora)] text-[34px] leading-[40px] tracking-[-0.02em] font-bold text-primary-container md:text-[44px] md:leading-[52px]">
            BLACK HUB
          </h1>
          <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant mt-1">
            Blackfit · Kuntur Training Club · Comercios adheridos
          </p>
        </div>

        {/* Ingreso */}
        <div className="bg-[#1A1A1A]/80 backdrop-blur-xl border border-[#262626] rounded-xl p-4 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          <form action={action} className="flex flex-col gap-4 relative">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className={LABEL}>
                Email o DNI
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  required
                  placeholder="tu@email.com o tu DNI"
                  className={INPUT}
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant peer-focus:text-primary-container transition-colors pointer-events-none">
                  person
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className={LABEL}>
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setAyudaPassword((v) => !v)}
                  aria-expanded={ayudaPassword}
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.06em] text-on-surface-variant hover:text-primary-container"
                >
                  ¿La olvidaste?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className={INPUT}
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
              {ayudaPassword && (
                <div className="text-xs text-on-surface-variant bg-black/30 border border-[#262626] rounded-lg p-3 flex flex-col gap-1.5">
                  <p>
                    <span className="text-on-surface">Socio de Kuntur:</span> pedí un código nuevo en recepción y elegí
                    otra contraseña en{" "}
                    <Link href="/kuntur/activar" className="text-primary-container font-semibold">
                      Activar mi cuenta
                    </Link>
                    .
                  </p>
                  <p>
                    <span className="text-on-surface">Alumno, coach o comercio:</span> pedile a tu coach o a la
                    administración que te asigne una contraseña nueva.
                  </p>
                </div>
              )}
            </div>

            {state?.error && (
              <p role="alert" className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-1 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
            >
              {pending ? "INGRESANDO..." : "INGRESAR"}
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>

            <p className="text-center text-xs text-on-surface-variant">
              Entrás con la misma cuenta seas alumno, socio o comercio: te llevamos a tu espacio.
            </p>
          </form>
        </div>

        {/* Registro */}
        <div className="mt-6 flex flex-col gap-2">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.12em] text-on-surface-variant uppercase text-center">
            ¿Primera vez? Creá tu cuenta
          </p>
          <div className="grid grid-cols-1 gap-2">
            <Link
              href="/registro/beneficiario"
              className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A]/80 hover:border-primary-container/60 p-3 transition-colors"
            >
              <span className="material-symbols-outlined text-primary-container">loyalty</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-on-surface">Soy socio de Kuntur</span>
                <span className="block text-xs text-on-surface-variant">Mi membresía y los beneficios</span>
              </span>
            </Link>
            <Link
              href="/registro"
              className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A]/80 hover:border-primary-container/60 p-3 transition-colors"
            >
              <span className="material-symbols-outlined text-primary-container">fitness_center</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-on-surface">Entreno con Blackfit</span>
                <span className="block text-xs text-on-surface-variant">Rutinas, seguimiento y mi coach</span>
              </span>
            </Link>
            <Link
              href="/registro/comercio"
              className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1A1A1A]/80 hover:border-primary-container/60 p-3 transition-colors"
            >
              <span className="material-symbols-outlined text-primary-container">storefront</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-on-surface">Tengo un comercio</span>
                <span className="block text-xs text-on-surface-variant">Publicar descuentos para la comunidad</span>
              </span>
            </Link>
          </div>
          <Link
            href="/kuntur/activar"
            className="text-center text-sm text-primary-container font-semibold hover:underline underline-offset-4 mt-1"
          >
            Ya figuro como socio de Kuntur: activar mi cuenta
          </Link>
        </div>
      </main>
    </div>
  );
}
