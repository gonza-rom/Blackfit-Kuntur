import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAdminComerciosActual } from "@/lib/auth";
import { FormSocio } from "../_components/formularios-socio";

// KUNTUR TRAINING CLUB → SOCIOS → AGREGAR SOCIO. Alta individual, aunque la
// persona no esté en el Excel ni tenga cuenta todavía.
export default async function NuevoSocioPage() {
  if (!(await obtenerAdminComerciosActual())) notFound();
  const planes = await prisma.planMembresia.findMany({
    where: { organizacion: "kuntur" },
    orderBy: { duracion_dias: "asc" },
    select: { id_plan_membresia: true, nombre: true, duracion_dias: true },
  });

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <Link href="/admin/socios" className="text-sm text-on-surface-variant">← Socios</Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">Agregar socio</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Si el DNI o el email ya tienen una cuenta (por ejemplo, un alumno de Blackfit), se vincula esa cuenta como socio en
          lugar de crear otra. Después generás su código para que active el acceso.
        </p>
      </div>
      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormSocio planes={planes} />
      </div>
    </main>
  );
}
