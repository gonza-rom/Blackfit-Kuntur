import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marcarNotificacionLeida, marcarTodasLeidas } from "@/app/actions/comunicacion";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PanelNotificacionesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/iniciar-sesion");

  const notificaciones = await prisma.notificacion.findMany({
    where: { id_usuario: usuario.id_usuario },
    orderBy: { fecha_creacion: "desc" },
    take: 50,
  });

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Notificaciones
        </h1>
        {notificaciones.some((n) => !n.leido) && (
          <form action={marcarTodasLeidas}>
            <button
              type="submit"
              className="text-[12px] text-primary-container font-[family-name:var(--font-jetbrains-mono)] tracking-[0.08em] uppercase"
            >
              Marcar todas leídas
            </button>
          </form>
        )}
      </div>

      {notificaciones.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          No tenés notificaciones.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {notificaciones.map((n) => (
            <form key={n.id_notificacion} action={marcarNotificacionLeida}>
              <input type="hidden" name="id_notificacion" value={n.id_notificacion} />
              <button
                type="submit"
                disabled={n.leido}
                className={`w-full text-left bg-[#1A1A1A] border rounded-xl p-4 flex items-start gap-3 transition-colors ${
                  n.leido ? "border-[#262626]" : "border-primary-container"
                }`}
              >
                {!n.leido && (
                  <span className="w-2 h-2 rounded-full bg-primary-container mt-1.5 shrink-0" />
                )}
                <div className={n.leido ? "" : "flex-1"}>
                  <p className="text-sm font-medium text-on-surface">{n.titulo}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">{n.contenido}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    {FORMATEADOR_FECHA.format(n.fecha_creacion)}
                  </p>
                </div>
              </button>
            </form>
          ))}
        </div>
      )}
    </main>
  );
}
