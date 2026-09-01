import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";

export default async function PlantillasPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const plantillas = await prisma.programaEntrenamiento.findMany({
    where: { id_entrenador: contexto.id_entrenador, es_plantilla: true },
    include: { _count: { select: { bloques: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
            Biblioteca de programas
          </h1>
          <p className="text-sm text-on-surface-variant">
            Armá una plantilla una vez y aplicala a cada alumno, sin rehacerla de cero.
          </p>
        </div>
        <Link
          href="/coach/programas/plantillas/nueva"
          className="shrink-0 flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nueva
        </Link>
      </div>

      {plantillas.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no armaste ninguna plantilla.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {plantillas.map((plantilla) => (
            <Link
              key={plantilla.id_programa}
              href={`/coach/programas/plantillas/${plantilla.id_programa}`}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {plantilla.nombre}
                </p>
                {plantilla.objetivo && (
                  <p className="text-sm text-on-surface-variant">{plantilla.objetivo}</p>
                )}
              </div>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase shrink-0">
                {plantilla._count.bloques} bloque{plantilla._count.bloques === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
