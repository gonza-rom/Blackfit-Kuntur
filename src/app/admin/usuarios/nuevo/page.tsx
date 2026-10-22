import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerUsuarioActual, tieneRol } from "@/lib/auth";
import { FormNuevoUsuario, type OpcionRol } from "./_components/form-nuevo-usuario";

// Alta manual de usuarios. Cada admin ve solo los roles que puede asignar
// (la acción lo vuelve a validar en el servidor). Los socios de Kuntur con
// membresía y código de activación se cargan desde Socios Kuntur, y los
// comercios desde Comercios.
export default async function NuevoUsuarioPage() {
  const actor = await obtenerUsuarioActual();
  if (!actor) notFound();
  const esGeneral = tieneRol(actor, "administrador");
  const puedeComercios = esGeneral || tieneRol(actor, "admin_comercios");
  const puedeBlackfit = esGeneral || tieneRol(actor, "admin_blackfit");
  if (!puedeComercios && !puedeBlackfit) notFound();

  const roles: OpcionRol[] = [
    ...(puedeBlackfit
      ? [
          { valor: "alumno", etiqueta: "Alumno de Blackfit" },
          { valor: "entrenador", etiqueta: "Coach de Blackfit" },
        ]
      : []),
    ...(puedeComercios
      ? [
          { valor: "beneficiario", etiqueta: "Socio de Kuntur (solo beneficios)" },
          { valor: "miembro_kuntur", etiqueta: "Socio de Kuntur (también usa Blackfit)" },
        ]
      : []),
    ...(esGeneral
      ? [
          { valor: "admin_blackfit", etiqueta: "Administrador de Blackfit" },
          { valor: "admin_comercios", etiqueta: "Administrador de Kuntur y comercios" },
          { valor: "administrador", etiqueta: "Administrador general" },
        ]
      : []),
  ];

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-on-surface-variant">← Usuarios</Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">Nuevo usuario</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {puedeComercios && (
            <>
              Para un socio de Kuntur con su membresía, usá{" "}
              <Link href="/admin/socios/nuevo" className="text-primary-container">Agregar socio</Link>. 
            </>
          )}
          Los comercios se crean desde <Link href="/admin/comercios/nuevo" className="text-primary-container">Comercios</Link>.
        </p>
      </div>
      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormNuevoUsuario roles={roles} />
      </div>
    </main>
  );
}
