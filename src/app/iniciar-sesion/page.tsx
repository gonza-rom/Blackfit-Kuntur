"use client";

import Link from "next/link";
import { useActionState } from "react";
import { iniciarSesion } from "@/app/actions/auth";

export default function IniciarSesionPage() {
  const [state, action, pending] = useActionState(iniciarSesion, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.08] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Iniciar sesión
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ingresá a tu cuenta de Black Hub.
        </p>

        <form action={action} className="mt-6 flex flex-col gap-4">
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
              autoComplete="current-password"
              required
              className="rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-black outline-none focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-[#383838] disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
          >
            {pending ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="font-medium text-black underline dark:text-zinc-50">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
