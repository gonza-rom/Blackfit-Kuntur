import Link from "next/link";
import { CredencialCard } from "@/app/panel/beneficios/_components/credencial-card";
import {
  asegurarCredencial,
  catalogoBeneficios,
  CATEGORIAS_BENEFICIO,
  contarUsos,
  ETIQUETA_AUDIENCIA,
  evaluarUso,
  membresiasVigentes,
  NOMBRE_ENTORNO,
  type Entorno,
} from "@/lib/beneficios";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const CHIP =
  "border px-3 py-1.5 rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase transition-colors";

// Catálogo ÚNICO de beneficios, el mismo componente en Blackfit
// (/panel/beneficios) y en Kuntur (/beneficiario/beneficios): cambia solo
// el entorno, que define qué audiencias se ven y qué membresía se usa para
// marcar si cada beneficio se puede usar ahora (ver lib/beneficios.ts).
export async function CatalogoBeneficios({
  entorno,
  usuario,
  rutaBase,
  texto,
  categoria,
  idComercio,
}: {
  entorno: Entorno;
  usuario: { id_usuario: string; nombre: string; apellido: string };
  rutaBase: string;
  texto?: string;
  categoria?: string;
  idComercio?: string;
}) {
  const [credencial, vigentes, todos] = await Promise.all([
    asegurarCredencial(usuario.id_usuario),
    membresiasVigentes(usuario.id_usuario),
    catalogoBeneficios(entorno, { texto, categoria }),
  ]);
  const beneficios = idComercio ? todos.filter((b) => b.comercio.id_comercio === idComercio) : todos;
  const usos = new Map(
    await Promise.all(beneficios.map(async (b) => [b.id_beneficio, await contarUsos(usuario.id_usuario, b.id_beneficio)] as const))
  );

  const href = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return q.size ? `${rutaBase}?${q}` : rutaBase;
  };

  return (
    <div className="flex flex-col gap-6">
      <section id="credencial" className="flex flex-col gap-2 scroll-mt-20">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-semibold text-on-surface">Tu credencial</h2>
        <CredencialCard
          nombreCompleto={`${usuario.nombre} ${usuario.apellido}`.toUpperCase()}
          numeroSocio={credencial.numero_socio}
          membresiaActiva={vigentes[entorno]}
          codigoQrToken={credencial.codigo_qr_token}
        />
        <p className="text-xs text-on-surface-variant">
          Mostrá este QR en el comercio: ellos lo validan en el momento. Ver el QR en pantalla no alcanza,
          el comercio confirma tu membresía y el beneficio en el sistema.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <form action={rutaBase} className="flex gap-2">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <input
            name="q"
            defaultValue={texto}
            placeholder="Buscar comercio o beneficio"
            className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          />
          <button type="submit" className={`${CHIP} border-outline-variant text-on-surface-variant`}>
            Buscar
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link
            href={href({ q: texto })}
            className={`${CHIP} ${!categoria ? "border-primary-container bg-primary-container/10 text-primary-container" : "border-outline-variant text-on-surface-variant"}`}
          >
            Todos
          </Link>
          {CATEGORIAS_BENEFICIO.map((c) => (
            <Link
              key={c}
              href={href({ q: texto, categoria: c })}
              className={`${CHIP} ${categoria === c ? "border-primary-container bg-primary-container/10 text-primary-container" : "border-outline-variant text-on-surface-variant"}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Beneficios {NOMBRE_ENTORNO[entorno]} ({beneficios.length})
        </h2>
        {beneficios.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-6 text-center text-sm text-on-surface-variant">
            {texto || categoria ? "No hay beneficios con ese filtro." : "Todavía no hay beneficios publicados."}
          </div>
        ) : (
          beneficios.map((b) => {
            const evaluacion = evaluarUso(b, vigentes, usos.get(b.id_beneficio) ?? 0);
            return (
              <article key={b.id_beneficio} className="bg-[#1a1a1a] border border-outline-variant rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                      {b.comercio.nombre}
                      {b.categoria ?? b.comercio.categoria ? ` · ${b.categoria ?? b.comercio.categoria}` : ""}
                    </p>
                    <h3 className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">{b.titulo}</h3>
                  </div>
                  {b.descuento && (
                    <span className="shrink-0 font-[family-name:var(--font-sora)] text-lg font-bold text-primary-container">
                      {b.descuento}
                    </span>
                  )}
                </div>
                {b.descripcion && <p className="text-sm text-[#c8c6c5]">{b.descripcion}</p>}
                {b.condiciones && <p className="text-xs text-on-surface-variant">Condiciones: {b.condiciones}</p>}
                <p className="text-[11px] text-on-surface-variant">
                  Vence {FORMATEADOR_FECHA.format(b.fecha_vencimiento)} · {ETIQUETA_AUDIENCIA[b.audiencia]} ·{" "}
                  {b.limite_usos == null ? "usos ilimitados" : b.limite_usos === 1 ? "uso único" : `${b.limite_usos} usos`}
                  {b.comercio.direccion ? ` · ${b.comercio.direccion}` : ""}
                </p>
                <p className={`text-xs ${evaluacion.ok ? "text-primary-container" : "text-[#eda100]"}`}>
                  {evaluacion.ok ? "Disponible: mostrá tu credencial en el comercio." : evaluacion.motivo}
                </p>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
