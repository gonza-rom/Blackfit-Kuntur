"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registrarse } from "@/app/actions/auth";

export default function RegistroPage() {
  const [state, action, pending] = useActionState(registrarse, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.08] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Crear cuenta
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Registrate como alumno de Black Fit.
        </p>

        <form action={action} className="mt-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="nombre" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="given-name"
                required
                className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="apellido" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Apellido
              </label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                autoComplete="family-name"
                required
                className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          {state?.message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-[#383838] disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
          >
            {pending ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿Ya tenés cuenta?{" "}
          <Link href="/iniciar-sesion" className="font-medium text-black underline dark:text-zinc-50">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
