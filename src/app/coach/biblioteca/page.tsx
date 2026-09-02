import { redirect } from "next/navigation";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { obtenerBibliotecaCatalogo } from "@/lib/catalogos";
import { FormNuevoRecurso } from "./_components/form-nuevo-recurso";
import { RecursoItem } from "./_components/recurso-item";

export default async function CoachBibliotecaPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const recursos = await obtenerBibliotecaCatalogo();

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
            <RecursoItem
              key={r.id_recurso}
              recurso={{
                id_recurso: r.id_recurso,
                titulo: r.titulo,
                descripcion: r.descripcion,
                categoria: r.categoria,
                tipo_contenido: r.tipo_contenido,
                url_contenido: r.url_contenido,
              }}
            />
          ))
        )}
      </div>
    </main>
  );
}
