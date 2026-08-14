import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminPlanesPage() {
  const planes = await prisma.planMembresia.findMany({ orderBy: { nombre: "asc" } });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Planes de membresía
        </h1>
        <Link
          href="/admin/planes/nuevo"
          className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nuevo
        </Link>
      </div>

      {planes.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no hay planes de membresía.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {planes.map((plan) => (
            <div
              key={plan.id_plan_membresia}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4"
            >
              <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                {plan.nombre}
              </p>
              <p className="text-sm text-on-surface-variant">
                ${plan.precio.toString()} · {plan.duracion_dias} días
              </p>
              {plan.descripcion && (
                <p className="text-sm text-on-surface-variant mt-1">{plan.descripcion}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
