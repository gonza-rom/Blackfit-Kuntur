import Link from "next/link";
import { prisma } from "@/lib/prisma";

const ETIQUETA_ESTADO: Record<string, string> = {
  activa: "Activa",
  vencida: "Vencida",
  cancelada: "Cancelada",
  suspendida: "Suspendida",
  pendiente: "Pendiente",
};

export default async function AdminUsuariosPage(
  props: PageProps<"/admin/usuarios">
) {
  const { q } = await props.searchParams;
  const busqueda = typeof q === "string" ? q.trim() : "";

  const usuarios = await prisma.usuario.findMany({
    where: busqueda
      ? { email: { contains: busqueda, mode: "insensitive" } }
      : undefined,
    orderBy: { fecha_creacion: "desc" },
    take: 50,
    include: {
      roles: true,
      membresias: {
        orderBy: { fecha_vencimiento_membresia: "desc" },
        take: 1,
      },
    },
  });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Usuarios
      </h1>

      <form method="get" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por email..."
          className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
        />
        <button
          type="submit"
          className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 rounded"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-col gap-1">
        {usuarios.map((usuario) => {
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
                <p className="text-sm text-on-surface-variant">{usuario.email}</p>
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
        })}
      </div>
    </main>
  );
}
