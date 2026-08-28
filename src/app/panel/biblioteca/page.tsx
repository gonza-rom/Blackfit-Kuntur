import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaBiblioteca } from "@prisma/client";
import { obtenerBibliotecaCatalogo } from "@/lib/catalogos";

const CATEGORIAS = [
  { value: "todas", label: "Todas" },
  { value: "ejercicios", label: "Ejercicios" },
  { value: "tecnicas", label: "Técnicas" },
  { value: "movilidad", label: "Movilidad" },
  { value: "recuperacion", label: "Recuperación" },
  { value: "nutricion", label: "Nutrición" },
  { value: "metodologia", label: "Metodología" },
];

const ETIQUETAS_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label])
);

export default async function PanelBibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion");

  const { categoria } = await searchParams;
  const filtro = categoria && categoria !== "todas" ? (categoria as CategoriaBiblioteca) : undefined;

  const recursos = await obtenerBibliotecaCatalogo(filtro);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Biblioteca
      </h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIAS.map((c) => {
          const activo = (categoria ?? "todas") === c.value;
          return (
            <a
              key={c.value}
              href={c.value === "todas" ? "/panel/biblioteca" : `/panel/biblioteca?categoria=${c.value}`}
              className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border transition-colors ${
                activo
                  ? "border-primary-container bg-primary-container/10 text-primary-container"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              {c.label}
            </a>
          );
        })}
      </div>

      {recursos.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          No hay recursos en esta categoría todavía.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recursos.map((r) => (
            <div
              key={r.id_recurso}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4"
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase text-primary-container">
                {ETIQUETAS_CATEGORIA[r.categoria] ?? r.categoria}
              </span>
              <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface mt-1">
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
                  className="text-sm text-primary-container underline mt-2 inline-block"
                >
                  Ver contenido
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
