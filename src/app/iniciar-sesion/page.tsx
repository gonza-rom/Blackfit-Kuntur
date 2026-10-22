"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { iniciarSesion } from "@/app/actions/auth";
import { LogoMarca } from "@/components/logo-marca";

// Tres rutas de acceso dentro de una sola app. La ruta elegida solo dice
// QUÉ quiere usar la persona: los permisos los decide el servidor con sus
// roles (ver destinoTrasLogin en lib/auth.ts).
type Ruta = "blackfit" | "kuntur" | "comercio";

const RUTAS: {
  valor: Ruta;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  icono: string;
  enlaces: { href: string; texto: string }[];
}[] = [
  {
    valor: "blackfit",
    titulo: "BLACKFIT",
    subtitulo: "Entrenamiento personalizado",
    descripcion:
      "Ingresá a tu espacio de entrenamiento para consultar tus rutinas, seguimiento, perfil y comunicación con tu entrenador.",
    icono: "fitness_center",
    enlaces: [{ href: "/registro", texto: "¿Alumno nuevo? Creá tu cuenta" }],
  },
  {
    valor: "kuntur",
    titulo: "KUNTUR TRAINING CLUB",
    subtitulo: "Socios del gimnasio",
    descripcion: "Consultá tu perfil de socio, los días de membresía que te quedan y los beneficios disponibles.",
    icono: "badge",
    enlaces: [
      { href: "/kuntur/activar", texto: "Ya soy socio: activar mi cuenta" },
      { href: "/registro/beneficiario", texto: "¿Socio nuevo? Registrate" },
    ],
  },
  {
    valor: "comercio",
    titulo: "COMERCIOS ADHERIDOS",
    subtitulo: "Publicá tus beneficios",
    descripcion:
      "Registrá tu empresa o emprendimiento y ofrecé descuentos y promociones a la comunidad Blackfit y Kuntur Training Club.",
    icono: "storefront",
    enlaces: [{ href: "/registro/comercio", texto: "Sumá tu comercio" }],
  },
];

export default function IniciarSesionPage() {
  const [state, action, pending] = useActionState(iniciarSesion, undefined);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const rutaElegida = RUTAS.find((r) => r.valor === ruta) ?? null;

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

      {/* Contenido principal */}
      <main className="relative z-10 w-full max-w-md px-5 md:px-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-5">
            <LogoMarca
              marca="blackfit"
              size={72}
              className="border-2 border-[#262626] [animation:flotar-marca_3.4s_ease-in-out_infinite]"
            />
            <span className="font-[family-name:var(--font-sora)] text-on-surface-variant text-xl">
              ×
            </span>
            <LogoMarca
              marca="kuntur"
              size={72}
              className="border-2 border-[#262626] [animation:flotar-marca_3.4s_ease-in-out_infinite] [animation-delay:1.1s]"
            />
          </div>
          <h1 className="font-[family-name:var(--font-sora)] text-[36px] leading-[42px] tracking-[-0.02em] font-bold text-primary-container mb-2 md:text-[48px] md:leading-[56px]">
            BLACK HUB
          </h1>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] leading-4 tracking-[0.2em] text-on-surface-variant uppercase">
            ENTRÁ AL HUB. EL RENDIMIENTO ELITE EMPIEZA ACÁ.
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-[#1A1A1A]/80 backdrop-blur-xl border border-[#262626] rounded-xl p-4 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          {!rutaElegida ? (
            <div className="flex flex-col gap-3">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.12em] text-on-surface-variant uppercase text-center">
                ¿Cómo querés ingresar?
              </p>
              {RUTAS.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  onClick={() => setRuta(r.valor)}
                  className="text-left flex items-start gap-3 rounded-xl border border-[#262626] hover:border-primary-container/60 bg-black/30 p-4 transition-colors"
                >
                  <span className="material-symbols-outlined text-primary-container text-[28px] shrink-0">{r.icono}</span>
                  <span className="min-w-0">
                    <span className="block font-[family-name:var(--font-sora)] text-sm font-bold text-on-surface">
                      {r.titulo} <span className="font-normal text-on-surface-variant">— {r.subtitulo}</span>
                    </span>
                    <span className="block text-xs text-on-surface-variant mt-0.5">{r.descripcion}</span>
                  </span>
                </button>
              ))}

              <div className="border-t border-[#262626] pt-4 mt-1 flex flex-col gap-2">
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.12em] text-on-surface-variant uppercase text-center">
                  ¿No tenés cuenta?
                </p>
                <Link
                  href="/registro/beneficiario"
                  className="w-full flex items-center justify-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded"
                >
                  <span className="material-symbols-outlined text-[18px]">loyalty</span>
                  Registrarme en Kuntur (beneficios)
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/registro"
                    className="flex items-center justify-center border border-outline-variant text-on-surface text-xs font-bold h-10 rounded hover:border-primary-container/60"
                  >
                    Registrarme en Blackfit
                  </Link>
                  <Link
                    href="/registro/comercio"
                    className="flex items-center justify-center border border-outline-variant text-on-surface text-xs font-bold h-10 rounded hover:border-primary-container/60"
                  >
                    Registrar mi comercio
                  </Link>
                </div>
                <Link href="/kuntur/activar" className="text-center text-xs text-primary-container hover:underline underline-offset-4">
                  Ya soy socio de Kuntur: activar mi cuenta
                </Link>
              </div>
            </div>
          ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="ruta" value={rutaElegida.valor} />
            <button
              type="button"
              onClick={() => setRuta(null)}
              className="self-start flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              {rutaElegida.titulo} — {rutaElegida.subtitulo}
            </button>
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface"
              >
                Correo electrónico o DNI
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="atleta@blackhub.com o tu DNI"
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
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
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

            {/* Olvidaste tu contraseña */}
            <div className="flex justify-end">
              <Link
                href="#"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant hover:text-primary-container transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {state?.error && (
              <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
                {state.error}
              </p>
            )}

            {/* Acción principal */}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
            >
              {pending ? "INGRESANDO..." : "INICIAR SESIÓN"}
              <span className="material-symbols-outlined text-[20px]">
                arrow_forward
              </span>
            </button>

            <div className="flex flex-col items-center gap-1.5 pt-1">
              {rutaElegida.enlaces.map((e) => (
                <Link
                  key={e.href}
                  href={e.href}
                  className="text-sm text-primary-container font-semibold hover:underline underline-offset-4"
                >
                  {e.texto}
                </Link>
              ))}
            </div>
          </form>
          )}
        </div>

      </main>
    </div>
  );
}