import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAdminComerciosActual } from "@/lib/auth";
import { diasRestantesMembresia, membresiaVigente } from "@/lib/membresia";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const FILTROS = [
  { valor: "", texto: "Todos" },
  { valor: "vigente", texto: "Activos" },
  { valor: "vencida", texto: "Vencidos" },
  { valor: "sin_membresia", texto: "Sin membresía" },
  { valor: "sin_activar", texto: "Cuenta sin activar" },
] as const;

const POR_PAGINA = 50;

// KUNTUR TRAINING CLUB → SOCIOS. Lista de socios (los del Excel y los
// dados de alta a mano), con búsqueda y filtros, y las cuentas que quedaron
// mal asignadas a Blackfit para corregir.
export default async function SociosPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await obtenerAdminComerciosActual())) notFound();
  const sp = await props.searchParams;
  const texto = typeof sp.q === "string" ? sp.q.trim() : "";
  const filtro = typeof sp.estado === "string" ? sp.estado : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const socios = await prisma.socioKuntur.findMany({
    where: texto
      ? {
          usuario: {
            OR: [
              { nombre: { contains: texto, mode: "insensitive" } },
              { apellido: { contains: texto, mode: "insensitive" } },
              { dni: { contains: texto.replace(/\D/g, "") || texto } },
              { email: { contains: texto, mode: "insensitive" } },
            ],
          },
        }
      : {},
    include: {
      usuario: {
        select: {
          id_usuario: true,
          nombre: true,
          apellido: true,
          dni: true,
          membresias: {
            where: { plan_membresia: { organizacion: "kuntur" } },
            orderBy: { fecha_vencimiento_membresia: "desc" },
            select: { estado_membresia: true, fecha_vencimiento_membresia: true, plan_membresia: { select: { nombre: true } } },
          },
        },
      },
    },
    orderBy: [{ usuario: { apellido: "asc" } }, { usuario: { nombre: "asc" } }],
  });

  const filas = socios
    .map((s) => {
      const vigente = s.usuario.membresias.find(membresiaVigente);
      const ultima = s.usuario.membresias[0];
      const estado = ultima?.estado_membresia === "suspendida" ? "suspendida" : vigente ? "vigente" : ultima ? "vencida" : "sin_membresia";
      return { s, vigente, ultima, estado };
    })
    .filter((f) => (filtro === "sin_activar" ? !f.s.cuenta_activada : !filtro || f.estado === filtro));
  const total = filas.length;
  const visibles = filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Cuentas registradas como alumno de Blackfit SIN ninguna actividad de
  // Blackfit (ni coach, ni entrenamientos, ni membresía): típicamente
  // gente que buscaba Kuntur y el registro viejo mandó a Blackfit.
  const paraRevisar = await prisma.usuario.findMany({
    where: {
      roles: { some: { rol: "alumno" } },
      socio_kuntur: null,
      alumno: { relaciones: { none: {} }, entrenamientos: { none: {} }, programas: { none: {} } },
      membresias: { none: { plan_membresia: { organizacion: "blackfit" } } },
    },
    select: { id_usuario: true, nombre: true, apellido: true, email: true, fecha_creacion: true },
  });

  const href = (cambios: Record<string, string | number>) => {
    const q = new URLSearchParams({ ...(texto ? { q: texto } : {}), ...(filtro ? { estado: filtro } : {}) });
    for (const [k, v] of Object.entries(cambios)) {
      if (v === "" || v === 1) q.delete(k);
      else q.set(k, String(v));
    }
    return q.size ? `/admin/socios?${q}` : "/admin/socios";
  };

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">Socios Kuntur</h1>
          <p className="text-sm text-on-surface-variant">{total} socio{total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/usuarios/importar" className="border border-outline-variant text-on-surface text-sm font-bold px-4 py-2 rounded-full">
            Importar
          </Link>
          <Link href="/admin/socios/nuevo" className="flex items-center gap-1 bg-primary-container text-black text-sm font-bold px-4 py-2 rounded-full">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Agregar socio
          </Link>
        </div>
      </div>

      {paraRevisar.length > 0 && (
        <section className="bg-[#eda100]/10 border border-[#eda100]/40 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm text-on-surface">
            {paraRevisar.length} cuenta{paraRevisar.length === 1 ? "" : "s"} registrada{paraRevisar.length === 1 ? "" : "s"} como
            alumno de Blackfit sin ninguna actividad: puede que buscaran Kuntur.
          </p>
          {paraRevisar.map((u) => (
            <Link key={u.id_usuario} href={`/admin/socios/${u.id_usuario}`} className="text-sm text-primary-container underline underline-offset-2">
              {u.nombre} {u.apellido} · {u.email} · {FORMATEADOR_FECHA.format(u.fecha_creacion)}
            </Link>
          ))}
        </section>
      )}

      <form action="/admin/socios" className="flex gap-2">
        {filtro && <input type="hidden" name="estado" value={filtro} />}
        <input
          name="q"
          defaultValue={texto}
          placeholder="Buscar por nombre, DNI o email"
          className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <button type="submit" className="border border-outline-variant text-on-surface-variant text-sm px-4 rounded">
          Buscar
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={href({ estado: f.valor, pagina: 1 })}
            className={`border px-3 py-1.5 rounded-full text-xs uppercase tracking-[0.06em] ${
              filtro === f.valor ? "border-primary-container text-primary-container bg-primary-container/10" : "border-outline-variant text-on-surface-variant"
            }`}
          >
            {f.texto}
          </Link>
        ))}
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-[#262626] text-left text-[10px] uppercase tracking-[0.08em] text-on-surface-variant">
              <th className="px-4 py-3">Socio</th>
              <th className="px-4 py-3">DNI</th>
              <th className="px-4 py-3">Membresía</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3">Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(({ s, vigente, ultima, estado }) => (
              <tr key={s.id_socio} className="border-b border-[#262626] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/socios/${s.usuario.id_usuario}`} className="text-on-surface font-semibold hover:text-primary-container">
                    {s.usuario.apellido} {s.usuario.nombre}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-on-surface-variant tabular-nums">{s.usuario.dni ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      estado === "vigente" ? "text-primary-container" : estado === "sin_membresia" ? "text-on-surface-variant" : "text-[#ffb4ab]"
                    }
                  >
                    {estado === "vigente"
                      ? `Activa · ${diasRestantesMembresia(vigente!.fecha_vencimiento_membresia)} días`
                      : estado === "vencida"
                        ? "Vencida"
                        : estado === "suspendida"
                          ? "Suspendida"
                          : "Sin membresía"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-on-surface-variant">
                  {ultima ? FORMATEADOR_FECHA.format((vigente ?? ultima).fecha_vencimiento_membresia) : "—"}
                </td>
                <td className="px-4 py-2.5 text-on-surface-variant">{s.cuenta_activada ? "Activada" : "Sin activar"}</td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">
                  No hay socios con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > POR_PAGINA && (
        <div className="flex justify-between text-sm">
          {pagina > 1 ? <Link href={href({ pagina: pagina - 1 })} className="text-primary-container">← Anterior</Link> : <span />}
          <span className="text-on-surface-variant">Página {pagina} de {Math.ceil(total / POR_PAGINA)}</span>
          {pagina * POR_PAGINA < total ? <Link href={href({ pagina: pagina + 1 })} className="text-primary-container">Siguiente →</Link> : <span />}
        </div>
      )}
    </main>
  );
}
