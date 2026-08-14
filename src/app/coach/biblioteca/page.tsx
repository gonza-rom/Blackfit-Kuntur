import { redirect } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eliminarRecursoBiblioteca } from "@/app/actions/biblioteca";
import { FormNuevoRecurso } from "./_components/form-nuevo-recurso";

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  ejercicios: "Ejercicios",
  tecnicas: "Técnicas",
  movilidad: "Movilidad",
  recuperacion: "Recuperación",
  nutricion: "Nutrición",
  metodologia: "Metodología",
};

export default async function CoachBibliotecaPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const recursos = await prisma.biblioteca.findMany({
    orderBy: { fecha_creacion: "desc" },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Biblioteca educativa
        </h1>
        <p className="text-sm text-on-surface-variant">
          Contenido compartido: lo ven todos los alumnos de la plataforma.
        </p>
      </div>

      <FormNuevoRecurso />

      <div className="flex flex-col gap-2">
        {recursos.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no hay recursos publicados.
          </div>
        ) : (
          recursos.map((r) => (
            <div
              key={r.id_recurso}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-start justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase text-primary-container border border-primary-container rounded-full px-2 py-0.5">
                    {ETIQUETAS_CATEGORIA[r.categoria] ?? r.categoria}
                  </span>
                  {r.tipo_contenido && (
                    <span className="text-[11px] text-on-surface-variant">{r.tipo_contenido}</span>
                  )}
                </div>
                <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {r.titulo}
                </p>
                {r.descripcion && (
                  <p className="text-sm text-on-surface-variant mt-1">{r.descripcion}</p>
                )}
                {r.url_contenido && (
                  <a
                    href={r.url_contenido}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-container underline mt-1 inline-block"
                  >
                    Ver contenido
                  </a>
                )}
              </div>
              <form action={eliminarRecursoBiblioteca}>
                <input type="hidden" name="id_recurso" value={r.id_recurso} />
                <button
                  type="submit"
                  className="text-on-surface-variant hover:text-[#ffb4ab] transition-colors"
                  aria-label="Eliminar"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
