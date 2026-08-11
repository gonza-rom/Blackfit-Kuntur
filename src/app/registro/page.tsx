"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registrarse } from "@/app/actions/auth";

export default function RegistroPage() {
  const [state, action, pending] = useActionState(registrarse, undefined);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);

  return (
    <div className="min-h-screen flex flex-1 items-center justify-center bg-black overflow-hidden relative py-16">
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

      {/* Contenido principal */}
      <main className="relative z-10 w-full max-w-md px-5 md:px-0">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-sora)] text-[36px] leading-[42px] tracking-[-0.02em] font-bold text-primary-container mb-2 md:text-[48px] md:leading-[56px]">
            BLACK HUB
          </h1>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] leading-4 tracking-[0.2em] text-on-surface-variant uppercase">
            UNITE AL HUB. TU RENDIMIENTO ELITE EMPIEZA ACÁ.
          </p>
        </div>

        {/* Card de registro */}
        <div className="bg-[#1A1A1A]/80 backdrop-blur-xl border border-[#262626] rounded-xl p-4 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          <form action={action} className="flex flex-col gap-4">
            {/* Nombre y apellido */}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <label
                  htmlFor="nombre"
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface"
                >
                  Nombre
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  autoComplete="given-name"
                  required
                  placeholder="Nombre"
                  className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label
                  htmlFor="apellido"
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface"
                >
                  Apellido
                </label>
                <input
                  id="apellido"
                  name="apellido"
                  type="text"
                  autoComplete="family-name"
                  required
                  placeholder="Apellido"
                  className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface"
              >
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
                  className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors peer"
                />
                <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant peer-focus:text-primary-container transition-colors pointer-events-none">
                  mail
                </span>
              </div>
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface"
              >
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
                  className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors peer"
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

            {/* Confirmar contraseña */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="confirmPassword"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface"
              >
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
                  className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors peer"
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

            {/* Acción principal */}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
            >
              {pending ? "CREANDO CUENTA..." : "CREAR CUENTA"}
              <span className="material-symbols-outlined text-[20px]">
                arrow_forward
              </span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="font-[family-name:var(--font-inter)] text-base text-on-surface-variant">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="text-primary-container font-semibold hover:underline underline-offset-4 transition-all"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}