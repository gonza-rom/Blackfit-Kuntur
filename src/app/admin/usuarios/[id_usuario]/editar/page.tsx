import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  obtenerUsuarioActual,
  tieneRol,
  ROLES_DOMINIO_COMERCIOS,
  ROLES_DOMINIO_BLACKFIT,
} from "@/lib/auth";
import { FormEditarUsuario } from "../_components/form-editar-usuario";

export default async function EditarUsuarioPage(
  props: PageProps<"/admin/usuarios/[id_usuario]/editar">
) {
  const { id_usuario } = await props.params;

  const actor = await obtenerUsuarioActual();
  const esGeneral = tieneRol(actor, "administrador");
  const puedeComercios = esGeneral || tieneRol(actor, "admin_comercios");
  const puedeBlackfit = esGeneral || tieneRol(actor, "admin_blackfit");
  if (!esGeneral && !puedeComercios && !puedeBlackfit) notFound();

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario },
    include: { roles: true },
  });
  if (!usuario) notFound();

  // Mismo chequeo de dominio que en la ficha del usuario — ver el
  // comentario en [id_usuario]/page.tsx.
  if (!esGeneral) {
    const rolesActuales = usuario.roles.map((r) => r.rol);
    const enDominio =
      (puedeComercios && rolesActuales.some((r) => ROLES_DOMINIO_COMERCIOS.includes(r))) ||
      (puedeBlackfit && rolesActuales.some((r) => ROLES_DOMINIO_BLACKFIT.includes(r)));
    if (!enDominio) notFound();
  }

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Editar usuario
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarUsuario usuario={usuario} />
      </div>
    </main>
  );
}
