import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";

export default async function EjerciciosPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const ejercicios = await prisma.ejercicio.findMany({ orderBy: { nombre: "asc" } });

<<<<<<< HEAD
  const detalleDefault = (e: (typeof ejercicios)[number]) => {
    if (!e.series_default && !e.repeticiones_default) return null;
    const partes = [
      e.series_default && e.repeticiones_default
        ? `${e.series_default}×${e.repeticiones_default}`
        : null,
      e.peso_sugerido_default ? `${e.peso_sugerido_default.toString()}kg` : null,
      e.tempo_default ? `tempo ${e.tempo_default}` : null,
      e.descanso_default ? `descanso ${e.descanso_default}` : null,
    ].filter(Boolean);
    return partes.join(" · ") || null;
  };

=======
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Biblioteca de ejercicios
        </h1>
        <Link
          href="/coach/ejercicios/nuevo"
          className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo
        </Link>
      </div>

      {ejercicios.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no hay ejercicios en la biblioteca.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {ejercicios.map((ejercicio) => (
            <div
              key={ejercicio.id_ejercicio}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4"
            >
              <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                {ejercicio.nombre}
              </p>
              {ejercicio.grupo_muscular && (
                <p className="text-sm text-on-surface-variant">{ejercicio.grupo_muscular}</p>
              )}
<<<<<<< HEAD
              {detalleDefault(ejercicio) && (
                <p className="text-xs text-primary-container mt-1">{detalleDefault(ejercicio)}</p>
              )}
=======
>>>>>>> f2e2a915f8dd2dda0d05c16563da3c249ecbc4e5
              {ejercicio.video_url && (
                <a
                  href={ejercicio.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-container underline"
                >
                  Ver video
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
