import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerBeneficiarioActual } from "@/lib/auth";
import { resumenSocio, ETIQUETA_ESTADO_SOCIO } from "@/lib/kuntur";
import { claseColorMembresia } from "@/lib/membresia";
import { prisma } from "@/lib/prisma";
import { filtroCatalogo } from "@/lib/beneficios";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const TARJETA = "bg-[#1A1A1A] border border-[#262626] rounded-xl p-4";
const ETIQUETA =
  "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase";

// Inicio del socio de Kuntur Training Club: estado de su membresía del
// GIMNASIO (independiente de Blackfit) y acceso rápido a beneficios.
export default async function InicioSocioKunturPage() {
  const contexto = await obtenerBeneficiarioActual();
  if (!contexto) redirect("/sin-acceso?ruta=kuntur");
  const { usuario } = contexto;

  const [r, cantidadBeneficios] = await Promise.all([
    resumenSocio(usuario.id_usuario),
    prisma.beneficio.count({ where: filtroCatalogo("kuntur") }),
  ]);
  const color = claseColorMembresia(r.estado === "vigente" ? r.diasRestantes : r.estado === "sin_membresia" ? null : 0);

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">Hola, {usuario.nombre}</h1>
        <p className="text-sm text-on-surface-variant">Kuntur Training Club · socio hace {r.antiguedad}</p>
      </div>

      <section className={`${TARJETA} flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={ETIQUETA}>Membresía</p>
            <p className={`font-[family-name:var(--font-sora)] text-xl font-bold ${color}`}>
              {ETIQUETA_ESTADO_SOCIO[r.estado]}
            </p>
            {r.membresia && <p className="text-sm text-on-surface-variant">{r.membresia.plan_membresia.nombre}</p>}
          </div>
          {r.estado === "vigente" && (
            <div className="text-right">
              <p className={`font-[family-name:var(--font-sora)] text-3xl font-bold tabular-nums ${color}`}>{r.diasRestantes}</p>
              <p className={ETIQUETA}>día{r.diasRestantes === 1 ? "" : "s"} restante{r.diasRestantes === 1 ? "" : "s"}</p>
            </div>
          )}
        </div>
        {r.membresia && (
          <p className="text-sm text-on-surface-variant">
            {r.estado === "vigente" ? "Vence el" : "Venció el"}{" "}
            {FORMATEADOR_FECHA.format(r.membresia.fecha_vencimiento_membresia)}
            {r.periodoDias ? ` · período de ${r.periodoDias} días` : ""}
          </p>
        )}
        {r.estado === "vigente" && r.diasRestantes <= 5 && (
          <p className="text-xs text-[#eda100]">Tu membresía está por vencer: renovala en recepción.</p>
        )}
        {r.estado === "vencida" && (
          <p className="text-xs text-[#ffb4ab]">
            Tu membresía venció. Renovala en recepción para volver a usar los beneficios exclusivos de socios.
          </p>
        )}
        {r.estado === "suspendida" && (
          <p className="text-xs text-[#ffb4ab]">Tu membresía está suspendida. Consultá en recepción.</p>
        )}
        {r.estado === "sin_membresia" && (
          <p className="text-xs text-on-surface-variant">
            Tu cuenta de socio está creada. Kuntur todavía no cargó tu membresía: consultá en recepción.
          </p>
        )}
      </section>

      <Link
        href="/beneficiario/beneficios"
        className={`${TARJETA} flex items-center justify-between gap-3 hover:border-primary-container/60`}
      >
        <span className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-container text-[28px]">loyalty</span>
          <span>
            <span className="block font-[family-name:var(--font-sora)] font-semibold text-on-surface">Beneficios</span>
            <span className="block text-xs text-on-surface-variant">
              {cantidadBeneficios} disponible{cantidadBeneficios === 1 ? "" : "s"} en comercios adheridos
            </span>
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
      </Link>
    </main>
  );
}
