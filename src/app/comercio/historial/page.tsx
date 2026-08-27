import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerComercioActual } from "@/lib/auth";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ComercioHistorialPage() {
  const contexto = await obtenerComercioActual();
  if (!contexto) redirect("/panel");

  const validaciones = await prisma.validacionBeneficio.findMany({
    where: { id_comercio: contexto.id_comercio },
    include: { usuario: true, beneficio: true },
    orderBy: { fecha_validacion: "desc" },
    take: 50,
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Historial de validaciones
      </h1>

      {validaciones.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no registraste ninguna validación.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {validaciones.map((v) => (
            <div
              key={v.id_validacion}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-on-surface">
                  {v.usuario.nombre} {v.usuario.apellido}
                </p>
                <p className="text-xs text-on-surface-variant">{v.beneficio.titulo}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-2 py-1 rounded-full border ${
                    v.resultado === "aprobado"
                      ? "border-primary-container text-primary-container"
                      : "border-[#ffb4ab] text-[#ffb4ab]"
                  }`}
                >
                  {v.resultado}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {FORMATEADOR_FECHA.format(v.fecha_validacion)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
