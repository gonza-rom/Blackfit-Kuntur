import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { urlesFirmadasFotos } from "@/lib/storage";
import { FormProgresoFisico } from "./_components/form-progreso-fisico";
import { FormMedidaCorporal } from "./_components/form-medida-corporal";
import { ProgresoFisicoItem } from "./_components/progreso-fisico-item";
import { MedidaCorporalItem } from "./_components/medida-corporal-item";
import { GraficoEvolucion, type SerieMetrica } from "./_components/grafico-evolucion";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

// Campos extra de composición corporal que carga el coach desde su panel
// (el alumno los ve pero no los edita acá).
const CAMPOS_EXTRA: { campo: string; label: string; unit: string }[] = [
  { campo: "imc", label: "IMC", unit: "" },
  { campo: "pulso", label: "Pulso", unit: "lpm" },
  { campo: "porcentaje_agua", label: "Agua", unit: "%" },
  { campo: "porcentaje_musculo", label: "Músculos", unit: "%" },
  { campo: "masa_osea", label: "Huesos", unit: "kg" },
  { campo: "metabolismo_basal", label: "Metabolismo basal", unit: "kcal" },
  { campo: "metabolismo_activo", label: "Metabolismo activo", unit: "kcal" },
  { campo: "grasa_visceral", label: "Grasa visceral", unit: "" },
  { campo: "edad_metabolica", label: "Edad metabólica", unit: "años" },
  { campo: "soft_lean_mass", label: "Soft Lean Mass", unit: "kg" },
  { campo: "lean_body_mass", label: "Lean Body Mass", unit: "kg" },
  { campo: "proteina", label: "Proteína", unit: "kg" },
];

export default async function ProgresoFisicoPage() {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const [progresos, medidas] = await Promise.all([
    prisma.progresoFisico.findMany({
      where: { id_alumno: contexto.id_alumno },
      orderBy: { fecha: "desc" },
      take: 10,
    }),
    prisma.medidaCorporal.findMany({
      where: { id_alumno: contexto.id_alumno },
      orderBy: { fecha: "desc" },
      take: 10,
    }),
  ]);

  const progresosAscendentes = [...progresos].reverse();

  function serieDe(campo: "peso_corporal" | "porcentaje_graso" | "masa_muscular") {
    return progresosAscendentes
      .filter((p) => p[campo] !== null)
      .map((p) => ({ fecha: FORMATEADOR_FECHA.format(p.fecha), valor: Number(p[campo]) }));
  }

  const seriesGrafico: SerieMetrica[] = [
    { clave: "peso_corporal", etiqueta: "Peso", unidad: "kg", puntos: serieDe("peso_corporal") },
    {
      clave: "porcentaje_graso",
      etiqueta: "% Grasa",
      unidad: "%",
      puntos: serieDe("porcentaje_graso"),
    },
    {
      clave: "masa_muscular",
      etiqueta: "Masa muscular",
      unidad: "kg",
      puntos: serieDe("masa_muscular"),
    },
  ];

  const urlesFotos = await urlesFirmadasFotos(medidas.map((m) => m.foto_url));

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-8">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Progreso físico
      </h1>

      <GraficoEvolucion series={seriesGrafico} />

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Registrar hoy
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormProgresoFisico />
        </div>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormMedidaCorporal />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Historial
        </h2>
        {progresos.length === 0 && medidas.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no cargaste datos de progreso.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {progresos.map((p) => {
              const extra = CAMPOS_EXTRA.map(({ campo, label, unit }) => {
                const v = (p as Record<string, unknown>)[campo];
                return v === null || v === undefined
                  ? null
                  : { label, valor: `${String(v)}${unit ? ` ${unit}` : ""}` };
              }).filter((x): x is { label: string; valor: string } => x !== null);
              return (
                <ProgresoFisicoItem
                  key={p.id_progreso}
                  id={p.id_progreso}
                  fecha={FORMATEADOR_FECHA.format(p.fecha)}
                  pesoCorporal={p.peso_corporal ? p.peso_corporal.toString() : null}
                  porcentajeGraso={p.porcentaje_graso ? p.porcentaje_graso.toString() : null}
                  masaMuscular={p.masa_muscular ? p.masa_muscular.toString() : null}
                  extra={extra}
                  cargadoPorCoach={p.origen === "coach"}
                />
              );
            })}
            {medidas.map((m) => (
              <MedidaCorporalItem
                key={m.id_medida}
                id={m.id_medida}
                fecha={FORMATEADOR_FECHA.format(m.fecha)}
                tipoMedida={m.tipo_medida}
                valorCm={m.valor_cm.toString()}
                fotoUrl={m.foto_url ? urlesFotos.get(m.foto_url) ?? null : null}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
