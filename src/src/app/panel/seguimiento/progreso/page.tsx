import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { FormProgresoFisico } from "./_components/form-progreso-fisico";
import { FormMedidaCorporal } from "./_components/form-medida-corporal";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

const ANCHO_SPARKLINE = 280;
const ALTO_SPARKLINE = 60;

function puntosSparkline(valores: number[]): string {
  if (valores.length < 2) return "";
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  return valores
    .map((valor, i) => {
      const x = (i / (valores.length - 1)) * ANCHO_SPARKLINE;
      const y = ALTO_SPARKLINE - ((valor - min) / rango) * ALTO_SPARKLINE;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

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

  const pesosOrdenados = [...progresos]
    .reverse()
    .filter((p) => p.peso_corporal !== null)
    .map((p) => Number(p.peso_corporal));

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Progreso físico
      </h1>

      {pesosOrdenados.length >= 2 && (
        <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-3">
            Evolución del peso
          </h2>
          <svg
            viewBox={`0 0 ${ANCHO_SPARKLINE} ${ALTO_SPARKLINE}`}
            className="w-full h-16"
            preserveAspectRatio="none"
          >
            <polyline
              points={puntosSparkline(pesosOrdenados)}
              fill="none"
              stroke="#61edda"
              strokeWidth="2"
            />
          </svg>
        </section>
      )}

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
            {progresos.map((p) => (
              <div
                key={p.id_progreso}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(p.fecha)}
                </span>
                <span className="text-on-surface">
                  {p.peso_corporal ? `${p.peso_corporal}kg` : ""}
                  {p.porcentaje_graso ? ` · ${p.porcentaje_graso}% graso` : ""}
                  {p.masa_muscular ? ` · ${p.masa_muscular}kg masa musc.` : ""}
                </span>
              </div>
            ))}
            {medidas.map((m) => (
              <div
                key={m.id_medida}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(m.fecha)}
                </span>
                <span className="text-on-surface capitalize">
                  {m.tipo_medida}: {m.valor_cm.toString()}cm
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
