import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "@/app/actions/auth";

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 text-center dark:border-white/[.08] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Panel
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sesión iniciada como{" "}
          <span className="font-medium text-black dark:text-zinc-50">{user?.email}</span>
        </p>

        <form action={cerrarSesion} className="mt-6">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-full border border-black/[.08] px-5 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] dark:text-zinc-50"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
