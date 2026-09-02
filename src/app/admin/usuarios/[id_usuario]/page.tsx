import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerPlanesMembresia } from "@/lib/catalogos";
import {
  asignarRol,
  quitarRol,
  cambiarEstadoMembresia,
  cambiarEstadoUsuario,
} from "@/app/actions/admin";
import { FormActivarMembresia } from "./_components/form-activar-membresia";

const ESTADOS_USUARIO = ["activo", "inactivo", "suspendido"] as const;

const ETIQUETA_ESTADO_USUARIO: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  suspendido: "Suspendido",
};

const ROLES_ASIGNABLES = [
  "alumno",
  "entrenador",
  "miembro_kuntur",
  "beneficiario",
  "administrador",
] as const;

const ESTADOS_MEMBRESIA = [
  "activa",
  "vencida",
  "cancelada",
  "suspendida",
  "pendiente",
] as const;

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function AdminUsuarioDetallePage(
  props: PageProps<"/admin/usuarios/[id_usuario]">
) {
  const { id_usuario } = await props.params;

  const [usuario, planes] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id_usuario },
      include: {
        roles: true,
        membresias: {
          orderBy: { fecha_vencimiento_membresia: "desc" },
          include: { plan_membresia: true },
        },
      },
    }),
    obtenerPlanesMembresia(),
  ]);

  if (!usuario) notFound();

  const rolesActuales = new Set(usuario.roles.map((r) => r.rol));

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {usuario.nombre} {usuario.apellido}
        </h1>
        <p className="text-sm text-on-surface-variant">{usuario.email}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Estado de la cuenta
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm text-on-surface-variant">
            Estado actual:{" "}
            <span
              className={
                usuario.estado_usuario === "activo"
                  ? "text-primary-container"
                  : "text-[#ffb4ab]"
              }
            >
              {ETIQUETA_ESTADO_USUARIO[usuario.estado_usuario] ?? usuario.estado_usuario}
            </span>
            . Un usuario que no esté activo no puede iniciar sesión ni entrar a
            ninguna sección. No se borra ningún dato.
          </p>
          <form action={cambiarEstadoUsuario} className="flex items-center gap-2">
            <input type="hidden" name="id_usuario" value={id_usuario} />
            <select
              name="estado_usuario"
              defaultValue={usuario.estado_usuario}
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
            >
              {ESTADOS_USUARIO.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETA_ESTADO_USUARIO[estado]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant"
            >
              Aplicar
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Roles
        </h2>
        <div className="flex flex-col gap-1">
          {ROLES_ASIGNABLES.map((rol) => {
            const tiene = rolesActuales.has(rol);
            return (
              <div
                key={rol}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex items-center justify-between"
              >
                <span className="text-sm text-on-surface capitalize">{rol}</span>
                <form action={tiene ? quitarRol : asignarRol}>
                  <input type="hidden" name="id_usuario" value={id_usuario} />
                  <input type="hidden" name="rol" value={rol} />
                  <button
                    type="submit"
                    className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full ${
                      tiene
                        ? "border border-[#ffb4ab] text-[#ffb4ab]"
                        : "bg-primary-container text-black"
                    }`}
                  >
                    {tiene ? "Quitar" : "Asignar"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Activar membresía
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormActivarMembresia idUsuario={id_usuario} planes={planes} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Historial de membresías
        </h2>
        {usuario.membresias.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Sin membresías registradas.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {usuario.membresias.map((membresia) => (
              <div
                key={membresia.id_membresia}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface">{membresia.plan_membresia.nombre}</span>
                  <span className="text-on-surface-variant">
                    hasta {FORMATEADOR_FECHA.format(membresia.fecha_vencimiento_membresia)}
                  </span>
                </div>
                <form action={cambiarEstadoMembresia} className="flex items-center gap-2">
                  <input type="hidden" name="id_membresia" value={membresia.id_membresia} />
                  <select
                    name="estado_membresia"
                    defaultValue={membresia.estado_membresia}
                    className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
                  >
                    {ESTADOS_MEMBRESIA.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant"
                  >
                    Actualizar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
