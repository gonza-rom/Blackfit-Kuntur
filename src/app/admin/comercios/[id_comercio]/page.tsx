import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cambiarEstadoComercio, cambiarEstadoBeneficio } from "@/app/actions/admin";
import { ETIQUETA_AUDIENCIA } from "@/lib/beneficios";

const ESTADOS_COMERCIO = ["activo", "inactivo", "pendiente", "rechazado"] as const;
const ESTADOS_BENEFICIO = ["activo", "inactivo", "vencido", "rechazado"] as const;

const ETIQUETA_ESTADO: Record<string, string> = {
  activo: "Publicado",
  inactivo: "Pausado",
  vencido: "Vencido",
  pendiente: "Pendiente de aprobación",
  rechazado: "Rechazado",
};

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const BOTON =
  "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full";
const INPUT =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2";

// Aprobar / rechazar (con motivo) algo pendiente de revisión.
function RevisionPendiente({
  action,
  campoId,
  id,
  etiquetaAprobar,
}: {
  action: (formData: FormData) => Promise<void>;
  campoId: string;
  id: string;
  etiquetaAprobar: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <form action={action}>
        <input type="hidden" name={campoId} value={id} />
        <input type="hidden" name="estado" value="activo" />
        <button type="submit" className={`${BOTON} bg-primary-container text-black font-bold`}>
          {etiquetaAprobar}
        </button>
      </form>
      <form action={action} className="flex gap-2 flex-1">
        <input type="hidden" name={campoId} value={id} />
        <input type="hidden" name="estado" value="rechazado" />
        <input name="motivo" placeholder="Motivo del rechazo (se le avisa)" maxLength={300} className={`${INPUT} flex-1`} />
        <button type="submit" className={`${BOTON} border border-[#ffb4ab]/60 text-[#ffb4ab]`}>
          Rechazar
        </button>
      </form>
    </div>
  );
}

export default async function AdminComercioDetallePage(
  props: PageProps<"/admin/comercios/[id_comercio]">
) {
  const { id_comercio } = await props.params;

  const comercio = await prisma.comercio.findUnique({
    where: { id_comercio },
    include: {
      usuario: true,
      beneficios: { orderBy: [{ estado: "asc" }, { fecha_vencimiento: "desc" }] },
      _count: { select: { validaciones: true } },
    },
  });

  if (!comercio) notFound();

  const datosSolicitud = [
    ["Razón social", comercio.razon_social],
    ["CUIT", comercio.cuit],
    ["Responsable", comercio.responsable],
    ["Teléfono", comercio.telefono],
    ["Dirección", comercio.direccion],
    ["Email de contacto", comercio.email],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
                {comercio.nombre}
              </h1>
              <Link
                href={`/admin/comercios/${id_comercio}/editar`}
                className="text-on-surface-variant hover:text-primary-container"
                aria-label="Editar comercio"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </Link>
            </div>
            <p className="text-sm text-on-surface-variant">{comercio.usuario.email}</p>
            {comercio.categoria && <p className="text-sm text-on-surface-variant">{comercio.categoria}</p>}
            <p className="text-xs text-on-surface-variant mt-1">
              {comercio._count.validaciones} validaciones registradas
            </p>
          </div>
          {comercio.estado !== "pendiente" && (
            <form action={cambiarEstadoComercio} className="flex items-center gap-2 shrink-0">
              <input type="hidden" name="id_comercio" value={id_comercio} />
              <select name="estado" key={comercio.estado} defaultValue={comercio.estado} className={INPUT}>
                {ESTADOS_COMERCIO.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
              <button type="submit" className={`${BOTON} border border-outline-variant text-on-surface-variant`}>
                Actualizar
              </button>
            </form>
          )}
        </div>

        {comercio.descripcion && <p className="text-sm text-on-surface">{comercio.descripcion}</p>}
        {datosSolicitud.length > 0 && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {datosSolicitud.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-[#262626] py-1">
                <dt className="text-on-surface-variant">{k}</dt>
                <dd className="text-on-surface text-right">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {comercio.estado === "pendiente" && (
          <div className="bg-[#eda100]/10 border border-[#eda100]/40 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-sm text-on-surface">
              Solicitud de adhesión pendiente. Mientras no se apruebe, el comercio no puede publicar
              beneficios ni validar QR.
            </p>
            <RevisionPendiente action={cambiarEstadoComercio} campoId="id_comercio" id={id_comercio} etiquetaAprobar="Aprobar comercio" />
          </div>
        )}
        {comercio.estado === "rechazado" && comercio.motivo_rechazo && (
          <p className="text-xs text-[#ffb4ab]">Rechazado: {comercio.motivo_rechazo}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Beneficios
          </h2>
          <Link
            href={`/admin/comercios/${id_comercio}/beneficios/nuevo`}
            className="flex items-center gap-1 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Nuevo
          </Link>
        </div>

        {comercio.beneficios.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Este comercio todavía no tiene beneficios cargados.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {comercio.beneficios.map((beneficio) => (
              <div
                key={beneficio.id_beneficio}
                className={`bg-[#1A1A1A] border rounded-xl p-4 flex flex-col gap-3 ${
                  beneficio.estado === "pendiente" ? "border-[#eda100]/50" : "border-[#262626]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                        {beneficio.titulo}
                      </p>
                      <Link
                        href={`/admin/comercios/${id_comercio}/beneficios/${beneficio.id_beneficio}/editar`}
                        className="text-on-surface-variant hover:text-primary-container"
                        aria-label="Editar beneficio"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </Link>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {ETIQUETA_ESTADO[beneficio.estado]} · {ETIQUETA_AUDIENCIA[beneficio.audiencia]}
                      {beneficio.categoria ? ` · ${beneficio.categoria}` : ""}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {beneficio.descuento ? `${beneficio.descuento} · ` : ""}
                      {FORMATEADOR_FECHA.format(beneficio.fecha_inicio)} al{" "}
                      {FORMATEADOR_FECHA.format(beneficio.fecha_vencimiento)} ·{" "}
                      {beneficio.limite_usos == null
                        ? "usos ilimitados"
                        : beneficio.limite_usos === 1
                          ? "uso único"
                          : `${beneficio.limite_usos} usos por persona`}
                    </p>
                    {beneficio.condiciones && (
                      <p className="text-xs text-on-surface-variant mt-1">Condiciones: {beneficio.condiciones}</p>
                    )}
                    {beneficio.estado === "rechazado" && beneficio.motivo_rechazo && (
                      <p className="text-xs text-[#ffb4ab] mt-1">Rechazado: {beneficio.motivo_rechazo}</p>
                    )}
                  </div>
                  {beneficio.estado !== "pendiente" && (
                    <form action={cambiarEstadoBeneficio} className="flex items-center gap-2 shrink-0">
                      <input type="hidden" name="id_beneficio" value={beneficio.id_beneficio} />
                      <select name="estado" key={beneficio.estado} defaultValue={beneficio.estado} className={`${INPUT} text-xs`}>
                        {ESTADOS_BENEFICIO.map((estado) => (
                          <option key={estado} value={estado}>
                            {ETIQUETA_ESTADO[estado]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={`${BOTON} border border-outline-variant text-on-surface-variant`}>
                        OK
                      </button>
                    </form>
                  )}
                </div>
                {beneficio.estado === "pendiente" && (
                  <RevisionPendiente
                    action={cambiarEstadoBeneficio}
                    campoId="id_beneficio"
                    id={beneficio.id_beneficio}
                    etiquetaAprobar="Aprobar y publicar"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
