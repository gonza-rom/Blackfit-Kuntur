import { createHash, randomInt, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

// ------------------------------------------------------------
// Cuentas de acceso (Supabase Auth) creadas por la administración y su
// activación. Solo server-side. Nunca hay contraseñas predeterminadas: la
// cuenta nace con una contraseña aleatoria que nadie conoce y la persona
// define la suya al activar con un código de un solo uso.
// ------------------------------------------------------------

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O, 1/I/L
export const VIGENCIA_CODIGO_DIAS = 7;

/** Código de activación legible, ej. "K7PM-3QXA". */
export function generarCodigoActivacion(): string {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Hash del código (solo se guarda esto, nunca el código). */
export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
}

function contrasenaAleatoria(): string {
  return `${randomUUID()}${randomUUID()}`;
}

export function emailSinteticoSocio(dni: string | null): string {
  return dni ? `dni${dni}@beneficiario.blackhub.local` : `socio-${randomUUID()}@beneficiario.blackhub.local`;
}

/**
 * Crea el usuario de Auth (email confirmado, contraseña aleatoria). Usa la
 * API de administración si SUPABASE_SERVICE_ROLE_KEY está configurada; si
 * no, lo crea por SQL con la conexión de Prisma (mismos campos que crea
 * GoTrue), así el alta funciona igual en un hosting sin esa clave.
 */
export async function crearUsuarioAuth(
  email: string,
  metadata: Record<string, string | null>
): Promise<string> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email,
      password: contrasenaAleatoria(),
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data.user) throw new Error(error?.message ?? "No se pudo crear la cuenta de acceso.");
    return data.user.id;
  }

  const id = randomUUID();
  const meta = JSON.stringify(metadata);
  await prisma.$transaction([
    prisma.$executeRaw`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', ${id}::uuid, 'authenticated', 'authenticated', ${email},
        extensions.crypt(${contrasenaAleatoria()}, extensions.gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, ${meta}::jsonb, now(), now(),
        '', '', '', ''
      )`,
    prisma.$executeRaw`
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
      values (
        gen_random_uuid(), ${id}::uuid, ${id},
        jsonb_build_object('sub', ${id}::text, 'email', ${email}::text, 'email_verified', true),
        'email', now(), now()
      )`,
  ]);
  return id;
}

/** Define la contraseña de una cuenta (bcrypt, igual que GoTrue). */
export async function establecerContrasena(idAuth: string, contrasena: string): Promise<void> {
  await prisma.$executeRaw`
    update auth.users
    set encrypted_password = extensions.crypt(${contrasena}, extensions.gen_salt('bf', 10)), updated_at = now()
    where id::text = ${idAuth}`;
}

/** Cambia el email de acceso (ya verificado por el código de activación). */
export async function cambiarEmailAuth(idAuth: string, email: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`
      update auth.users set email = ${email}, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
      where id::text = ${idAuth}`,
    prisma.$executeRaw`
      update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(${email}::text)), updated_at = now()
      where user_id::text = ${idAuth} and provider = 'email'`,
  ]);
}

export async function emailTomado(email: string, salvoIdUsuario?: string): Promise<boolean> {
  const [enUsuarios, enAuth] = await Promise.all([
    prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, ...(salvoIdUsuario ? { NOT: { id_usuario: salvoIdUsuario } } : {}) },
      select: { id_usuario: true },
    }),
    prisma.$queryRaw<{ id: string }[]>`select id::text from auth.users where lower(email) = lower(${email}) limit 1`,
  ]);
  return Boolean(enUsuarios) || enAuth.some((a) => a.id !== salvoIdUsuario);
}
