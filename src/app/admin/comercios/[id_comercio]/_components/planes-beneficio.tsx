import { asignarBeneficioPlan, quitarBeneficioPlan } from "@/app/actions/admin";

type Plan = { id_plan_membresia: string; nombre: string };

export function PlanesBeneficio({
  idBeneficio,
  idComercio,
  planes,
  planesAsignados,
}: {
  idBeneficio: string;
  idComercio: string;
  planes: Plan[];
  planesAsignados: Set<string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {planes.map((plan) => {
        const asignado = planesAsignados.has(plan.id_plan_membresia);
        return (
          <form
            key={plan.id_plan_membresia}
            action={asignado ? quitarBeneficioPlan : asignarBeneficioPlan}
          >
            <input type="hidden" name="id_beneficio" value={idBeneficio} />
            <input type="hidden" name="id_plan_membresia" value={plan.id_plan_membresia} />
            <input type="hidden" name="id_comercio" value={idComercio} />
            <button
              type="submit"
              className={`font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase px-2.5 py-1 rounded-full border transition-colors ${
                asignado
                  ? "border-primary-container bg-primary-container/10 text-primary-container"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              {plan.nombre}
            </button>
          </form>
        );
      })}
    </div>
  );
}
