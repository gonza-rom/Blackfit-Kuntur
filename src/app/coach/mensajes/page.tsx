import { redirect } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkWhatsapp } from "@/lib/telefono";

export default async function CoachMensajesPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const relaciones = await prisma.relacionEntrenadorAlumno.findMany({
    where: { id_entrenador: contexto.id_entrenador, estado_relacion: "activa" },
    include: { alumno: { include: { usuario: true } } },
    orderBy: { fecha_inicio: "desc" },
  });

  const filas = relaciones.map((r) => {
    const u = r.alumno.usuario;
    return {
      id_alumno: r.alumno.id_alumno,
      nombre: `${u.nombre} ${u.apellido}`,
      wa: linkWhatsapp(u.telefono, `Hola ${u.nombre}, te escribo desde Black Hub.`),
    };
  });

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          WhatsApp
        </h1>
        <p className="text-sm text-on-surface-variant">
          La comunicación con tus alumnos es por WhatsApp. El chat interno de la
          app fue dado de baja.
        </p>
      </div>

      {filas.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          No tenés alumnos activos todavía.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filas.map((f) => (
            <div
              key={f.id_alumno}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <p className="text-sm text-on-surface font-medium">{f.nombre}</p>
              {f.wa ? (
                <a
                  href={f.wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  WhatsApp
                </a>
              ) : (
                <span className="text-xs text-on-surface-variant shrink-0">
                  Sin teléfono cargado
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
