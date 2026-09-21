import Link from "next/link";
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
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Mensajes
        </h1>
        <p className="text-sm text-on-surface-variant">
          Chat interno con cada alumno, o WhatsApp directo si preferís.
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
              <p className="text-sm text-on-surface font-medium min-w-0 truncate">{f.nombre}</p>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/coach/mensajes/${f.id_alumno}`}
                  className="flex items-center gap-1.5 border border-outline-variant text-on-surface font-[family-name:var(--font-sora)] text-sm font-bold px-3 py-2 rounded-full"
                >
                  <span className="material-symbols-outlined text-[18px]">forum</span>
                  Chat
                </Link>
                {f.wa ? (
                  <a
                    href={f.wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-3 py-2 rounded-full"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-on-surface-variant">Sin teléfono</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
