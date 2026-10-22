import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual, entornosDisponibles } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";

const MENSAJES: Record<string, { titulo: string; texto: string; acciones: { href: string; texto: string }[] }> = {
  kuntur: {
    titulo: "Tu cuenta no está vinculada a Kuntur",
    texto:
      "Para entrar a Kuntur Training Club tu cuenta tiene que estar asociada a tu ficha de socio. Si ya sos socio, pedí en recepción que vinculen tu cuenta o tu código de activación.",
    acciones: [{ href: "/kuntur/activar", texto: "Activar mi cuenta de socio" }],
  },
  blackfit: {
    titulo: "Tu cuenta no tiene acceso a Blackfit",
    texto:
      "El entrenamiento personalizado de Blackfit lo habilita tu coach. Si ya entrenás con Blackfit, pedile que te vincule a su cartera.",
    acciones: [],
  },
  comercio: {
    titulo: "Tu cuenta no es de un comercio adherido",
    texto: "Para publicar beneficios, registrá tu comercio. La administración revisa cada solicitud antes de aprobarla.",
    acciones: [{ href: "/registro/comercio", texto: "Registrar mi comercio" }],
  },
};

// Cuenta autenticada que no tiene acceso a la ruta que eligió (o a
// ninguna todavía). La ruta del login nunca da permisos: acá se explica
// qué falta, en vez de mandar a todos a Blackfit por defecto.
export default async function SinAccesoPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/iniciar-sesion");

  const { ruta } = await props.searchParams;
  const entornos = entornosDisponibles(usuario);
  const mensaje = MENSAJES[typeof ruta === "string" ? ruta : ""] ?? {
    titulo: "Tu cuenta todavía no está habilitada",
    texto:
      "Tu cuenta existe, pero todavía no está asociada a Blackfit, a Kuntur Training Club ni a un comercio adherido. Si te registraste hace poco, puede estar pendiente de revisión.",
    acciones: [{ href: "/kuntur/activar", texto: "Soy socio de Kuntur: activar mi cuenta" }],
  };

  return (
    <div className="min-h-dvh flex flex-1 items-center justify-center bg-black px-[max(1.25rem,env(safe-area-inset-left))] py-10">
      <main className="w-full max-w-md text-center flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-[#eda100] text-5xl">link_off</span>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">{mensaje.titulo}</h1>
        <p className="text-sm text-on-surface-variant">{mensaje.texto}</p>

        {mensaje.acciones.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="w-full flex items-center justify-center bg-primary-container text-black font-[family-name:var(--font-sora)] text-[15px] font-bold h-12 rounded"
          >
            {a.texto}
          </Link>
        ))}

        {entornos.length > 0 && (
          <div className="w-full flex flex-col gap-2 mt-2">
            <p className="text-xs text-on-surface-variant uppercase tracking-[0.08em]">Tus espacios disponibles</p>
            {entornos.map((e) => (
              <Link
                key={e.clave}
                href={e.href}
                className="w-full border border-outline-variant rounded h-11 flex items-center justify-center text-sm text-on-surface hover:border-primary-container/60"
              >
                {e.etiqueta}
              </Link>
            ))}
          </div>
        )}

        <form action={cerrarSesion} className="mt-2">
          <button
            type="submit"
            className="flex items-center gap-2 py-3 px-8 rounded-lg border border-outline-variant text-on-surface-variant font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar sesión
          </button>
        </form>
      </main>
    </div>
  );
}
