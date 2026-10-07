import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

// Arreglos de cuentas que quedaron "a medio crear" entre Supabase Auth y
// la tabla usuarios. Solo server-side (usa la service_role key).

async function idAuthPorEmail(email: string): Promise<string | null> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    select id::text from auth.users where lower(email) = lower(${email}) limit 1`;
  return filas[0]?.id ?? null;
}

async function existeEnAuth(id: string): Promise<boolean> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    select id::text from auth.users where id::text = ${id} limit 1`;
  return filas.length > 0;
}

/**
 * Los comercios se registraban con confirmación por mail, y ese mail
 * muchas veces no llegaba (límite del SMTP de Supabase / spam): la cuenta
 * quedaba creada pero el login devolvía "Email not confirmed" para
 * siempre. Como el alta de comercio igual la revisa un admin (arranca
 * "pendiente"), se confirma el email al primer login con la contraseña
 * correcta. Devuelve true si confirmó algo (y vale la pena reintentar).
 */
export async function confirmarEmailComercio(email: string): Promise<boolean> {
  const usuario = await prisma.usuario.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      roles: { some: { rol: "comercio" } },
    },
    select: { id_usuario: true },
  });
  if (!usuario) return false;

  const idAuth = await idAuthPorEmail(email);
  if (!idAuth) return false;

  const { error } = await createAdminClient().auth.admin.updateUserById(idAuth, {
    email_confirm: true,
  });
  return !error;
}

/**
 * Si el usuario de Auth no tiene fila en `usuarios` pero sí existe una con
 * su mismo email cuyo id ya no está en Auth (el usuario de Auth se borró y
 * se volvió a registrar), se re-vincula la fila al id nuevo. Todas las FK
 * a usuarios son ON UPDATE CASCADE, así que roles, comercio, etc. siguen
 * colgando de la misma persona. Devuelve true si la cuenta quedó con perfil.
 */
export async function vincularPerfilHuerfano(idAuth: string, email: string): Promise<boolean> {
  const propio = await prisma.usuario.findUnique({
    where: { id_usuario: idAuth },
    select: { id_usuario: true },
  });
  if (propio) return true;

  const anterior = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id_usuario: true },
  });
  if (!anterior || (await existeEnAuth(anterior.id_usuario))) return false;

  await prisma.usuario.update({
    where: { id_usuario: anterior.id_usuario },
    data: { id_usuario: idAuth },
  });
  return true;
}
