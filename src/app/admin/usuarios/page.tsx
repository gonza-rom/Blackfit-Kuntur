import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, RolUsuario, EstadoMembresia } from "@prisma/client";
import {
  obtenerUsuarioActual,
  tieneRol,
  ROLES_DOMINIO_COMERCIOS,
  ROLES_DOMINIO_BLACKFIT,
} from "@/lib/auth";

const ETIQUETA_ESTADO: Record<string, string> = {
  activa: "Activa",
  vencida: "Vencida",
  cancelada: "Cancelada",
  suspendida: "Suspendida",
  pendiente: "Pendiente",
};

const ROLES_FILTRO_COMPLETO: RolUsuario[] = [
  "alumno",
  "entrenador",
  "miembro_kuntur",
  "beneficiario",
  "comercio",
  "administrador",
  "admin_comercios",
  "admin_blackfit",
];

const ESTADOS_FILTRO: EstadoMembresia[] = [
  "activa",
  "vencida",
  "cancelada",
  "suspendida",
  "pendiente",
];

const TAMANO_PAGINA = 30;

export default async function AdminUsuariosPage(
  props: PageProps<"/admin/usuarios">
) {
  const usuario = await obtenerUsuarioActual();
  const esGeneral = tieneRol(usuario, "administrador");
  const puedeComercios = esGeneral || tieneRol(usuario, "admin_comercios");
  const puedeBlackfit = esGeneral || tieneRol(usuario, "admin_blackfit");
  if (!esGeneral && !puedeComercios && !puedeBlackfit) redirect("/admin");

  // Roles de su dominio: un admin recortado ni ve ni puede filtrar por
  // roles fuera de lo que le toca gestionar (ver también autorizarSobreUsuario
  // en actions/admin.ts, que revalida esto mismo del lado del servidor).
  const rolesDominio: RolUsuario[] = esGeneral
    ? ROLES_FILTRO_COMPLETO
    : [
        ...(puedeComercios ? ROLES_DOMINIO_COMERCIOS : []),
        ...(puedeBlackfit ? ROLES_DOMINIO_BLACKFIT : []),
      ];

  const { q, rol, estado, pagina: paginaRaw } = await props.searchParams;

  const busqueda = typeof q === "string" ? q.trim() : "";
  const rolFiltro =
    typeof rol === "string" && rolesDominio.includes(rol as RolUsuario)
      ? (rol as RolUsuario)
      : undefined;
  const estadoFiltro =
    typeof estado === "string" && (estado === "sin_membresia" || ESTADOS_FILTRO.includes(estado as EstadoMembresia))
      ? estado
      : undefined;
  const pagina = Math.max(1, Number(typeof paginaRaw === "string" ? paginaRaw : 1) || 1);

  const where: Prisma.UsuarioWhereInput = {};
  if (busqueda) {
    where.OR = [
      { email: { contains: busqueda, mode: "insensitive" } },
      { dni: { contains: busqueda } },
      { nombre: { contains: busqueda, mode: "insensitive" } },
      { apellido: { contains: busqueda, mode: "insensitive" } },
    ];
  }
  if (rolFiltro) {
    where.roles = { some: { rol: rolFiltro } };
  } else if (!esGeneral) {
    where.roles = { some: { rol: { in: rolesDominio } } };
  }
  if (estadoFiltro === "sin_membresia") {
    where.membresias = { none: {} };
  } else if (estadoFiltro) {
    where.membresias = { some: { estado_membresia: estadoFiltro as EstadoMembresia } };
  }

  const [usuarios, total, conteosPorRol] = await Promise.all([
    prisma.usuario.findMany({
      where,
      orderBy: { fecha_creacion: "desc" },
      skip: (pagina - 1) * TAMANO_PAGINA,
      take: TAMANO_PAGINA,
      include: {
        roles: true,
        membresias: {
          orderBy: { fecha_vencimiento_membresia: "desc" },
          take: 1,
        },
      },
    }),
    prisma.usuario.count({ where }),
    prisma.usuarioRol.groupBy({ by: ["rol"], _count: true }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const conteos = Object.fromEntries(
    conteosPorRol.map((c) => [c.rol, c._count])
  ) as Partial<Record<RolUsuario, number>>;

  function hrefFiltro(cambios: { rol?: string; pagina?: number }) {
    const sp = new URLSearchParams();
    if (busqueda) sp.set("q", busqueda);
    if (estadoFiltro) sp.set("estado", estadoFiltro);
    const nuevoRol = "rol" in cambios ? cambios.rol : rolFiltro;
    if (nuevoRol) sp.set("rol", nuevoRol);
    const nuevaPagina = cambios.pagina ?? pagina;
    if (nuevaPagina > 1) sp.set("pagina", String(nuevaPagina));
    const qs = sp.toString();
    return qs ? `/admin/usuarios?${qs}` : "/admin/usuarios";
  }

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
            Usuarios
          </h1>
          <p className="text-sm text-on-surface-variant">
            {total} usuario{total === 1 ? "" : "s"}
            {(busqueda || rolFiltro || estadoFiltro) && " (filtrados)"}
          </p>
        </div>
        {puedeComercios && (
          <Link
            href="/admin/usuarios/importar"
            className="flex items-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded-full"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Importar
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={busqueda}
            placeholder="Buscar por email, DNI o nombre..."
            className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          />
          <button
            type="submit"
            className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 rounded"
          >
            Buscar
          </button>
        </div>
        <div className="flex gap-2">
          <select
            name="rol"
            defaultValue={rolFiltro ?? ""}
            className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          >
            <option value="">Todos los roles</option>
            {rolesDominio.map((r) => (
              <option key={r} value={r}>
                {r} {conteos[r] ? `(${conteos[r]})` : ""}
              </option>
            ))}
          </select>
          <select
            name="estado"
            defaultValue={estadoFiltro ?? ""}
            className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
          >
            <option value="">Toda membresía</option>
            {ESTADOS_FILTRO.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </option>
            ))}
            <option value="sin_membresia">Sin membresía</option>
          </select>
        </div>
      </form>

      <div className="flex flex-col gap-1">
        {usuarios.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            No hay usuarios que coincidan con el filtro.
          </div>
        ) : (
          usuarios.map((usuario) => {
            const membresia = usuario.membresias[0];
            return (
              <Link
                key={usuario.id_usuario}
                href={`/admin/usuarios/${usuario.id_usuario}`}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                    {usuario.nombre} {usuario.apellido}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {usuario.dni ? `DNI ${usuario.dni}` : usuario.email}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {usuario.estado_usuario !== "activo" && (
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase px-2 py-0.5 rounded-full border border-[#ffb4ab] text-[#ffb4ab]">
                        {usuario.estado_usuario}
                      </span>
                    )}
                    {usuario.roles.map((r) => (
                      <span
                        key={r.id_rol_usuario}
                        className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase px-2 py-0.5 rounded-full bg-surface-variant/30 text-primary-container"
                      >
                        {r.rol}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                  {membresia ? ETIQUETA_ESTADO[membresia.estado_membresia] : "Sin membresía"}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <Link
            aria-disabled={pagina <= 1}
            href={hrefFiltro({ pagina: Math.max(1, pagina - 1) })}
            className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant ${
              pagina <= 1 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            Anterior
          </Link>
          <span className="text-xs text-on-surface-variant">
            Página {pagina} de {totalPaginas}
          </span>
          <Link
            aria-disabled={pagina >= totalPaginas}
            href={hrefFiltro({ pagina: Math.min(totalPaginas, pagina + 1) })}
            className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant ${
              pagina >= totalPaginas ? "pointer-events-none opacity-40" : ""
            }`}
          >
            Siguiente
          </Link>
        </div>
      )}
    </main>
  );
}
