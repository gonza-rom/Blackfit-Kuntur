import { prisma } from "@/lib/prisma";

// Arreglos de cuentas que quedaron "a medio crear" entre Supabase Auth y
// la tabla usuarios. Solo server-side. Escribe auth.users por SQL con la
// misma conexión de Prisma en vez de usar la service_role key: así no
// depende de que SUPABASE_SERVICE_ROLE_KEY esté configurada en el hosting
// (si faltaba, el login de comercio explotaba con "This page couldn't load").

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

  await confirmarEmailAuth(idAuth);
  return true;
}

/** Marca el email de un usuario de Auth como confirmado. */
export async function confirmarEmailAuth(idAuth: string): Promise<void> {
  await prisma.$executeRaw`
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id::text = ${idAuth}`;
}

/** Borra un usuario de Auth (rollback de un registro que falló a medias). */
export async function borrarUsuarioAuth(idAuth: string): Promise<void> {
  await prisma.$executeRaw`delete from auth.users where id::text = ${idAuth}`;
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
