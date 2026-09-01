import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FormEditarPlan } from "./_components/form-editar-plan";
import { BotonEliminarPlan } from "./_components/boton-eliminar-plan";

export default async function PlanDetallePage(
  props: PageProps<"/admin/planes/[id_plan_membresia]">
) {
  const { id_plan_membresia } = await props.params;

  const plan = await prisma.planMembresia.findUnique({
    where: { id_plan_membresia },
    include: { _count: { select: { membresias: true } } },
  });
  if (!plan) notFound();

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        {plan.nombre}
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarPlan
          plan={{
            id_plan_membresia: plan.id_plan_membresia,
            nombre: plan.nombre,
            descripcion: plan.descripcion,
            precio: plan.precio.toString(),
            duracion_dias: plan.duracion_dias,
          }}
        />
      </div>

      <BotonEliminarPlan
        idPlanMembresia={plan.id_plan_membresia}
        nombrePlan={plan.nombre}
        cantidadMembresias={plan._count.membresias}
      />
    </main>
  );
}
