import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  RolUsuario,
  Usuario,
  UsuarioRol,
  Alumno,
  Entrenador,
  Comercio,
} from "@prisma/client";

export type UsuarioActual = Usuario & {
  roles: UsuarioRol[];
  alumno: Alumno | null;
  entrenador: Entrenador | null;
  comercio: Comercio | null;
};

export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return prisma.usuario.findUnique({
    where: { id_usuario: user.id },
    include: { roles: true, alumno: true, entrenador: true, comercio: true },
  });
}

export function tieneRol(usuario: UsuarioActual | null, rol: RolUsuario): boolean {
  return usuario?.roles.some((r) => r.rol === rol) ?? false;
}

export async function obtenerEntrenadorActual(): Promise<
  { usuario: UsuarioActual; id_entrenador: string } | null
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneRol(usuario, "entrenador") || !usuario.entrenador) {
    return null;
  }
  return { usuario, id_entrenador: usuario.entrenador.id_entrenador };
}

export async function obtenerAlumnoActual(): Promise<
  { usuario: UsuarioActual; id_alumno: string } | null
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneRol(usuario, "alumno") || !usuario.alumno) {
    return null;
  }
  return { usuario, id_alumno: usuario.alumno.id_alumno };
}

export async function obtenerAdministradorActual(): Promise<
  { usuario: UsuarioActual } | null
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneRol(usuario, "administrador")) {
    return null;
  }
  return { usuario };
}

// Un usuario "comercio" siempre debe tener, además del rol, un perfil de
// Comercio creado (nombre, categoría, etc.). Ambas cosas se crean juntas
// en `crearComercio` — nunca se asigna el rol "comercio" suelto, así se
// evita un estado inconsistente (rol sin perfil).
export async function obtenerComercioActual(): Promise<
  { usuario: UsuarioActual; id_comercio: string } | null
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneRol(usuario, "comercio") || !usuario.comercio) {
    return null;
  }
  return { usuario, id_comercio: usuario.comercio.id_comercio };
}
