import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Fotos de progreso de los alumnos (MedidaCorporal.foto_url). Van a un
// bucket PRIVADO de Supabase Storage: nunca se sirve la URL pública, cada
// vez que se muestra una foto se genera una URL firmada de corta duración.
//
// Todo el acceso pasa por el cliente admin (service role), igual que el
// resto del backend (Prisma vía DIRECT_URL). El navegador nunca sube ni
// lee directo del bucket.

export const BUCKET_FOTOS = "fotos-progreso";
const TAM_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB
const TTL_URL_FIRMADA = 60 * 60; // 1 hora

// Fotos de perfil (Usuario.foto_perfil) y logos de comercio (Comercio.logo).
// A diferencia de las fotos de progreso, acá no hay nada sensible — es un
// avatar que se muestra todo el tiempo en la app — así que el bucket es
// PÚBLICO: se guarda la URL pública directa en la base, sin necesidad de
// regenerar una URL firmada cada vez que se muestra.
export const BUCKET_AVATARES = "avatares";
const TAM_MAXIMO_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB

let cliente: SupabaseClient | null | undefined;

function clienteAdmin(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    cliente = null;
    return cliente;
  }
  cliente = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cliente;
}

let bucketAsegurado = false;
async function asegurarBucket(sb: SupabaseClient): Promise<void> {
  if (bucketAsegurado) return;
  const { data } = await sb.storage.getBucket(BUCKET_FOTOS);
  if (!data) {
    // Si otro request lo crea en paralelo, el error de "ya existe" se
    // ignora — lo importante es que exista.
    await sb.storage
      .createBucket(BUCKET_FOTOS, { public: false, fileSizeLimit: TAM_MAXIMO_BYTES })
      .catch(() => {});
  }
  bucketAsegurado = true;
}

let bucketAvataresAsegurado = false;
async function asegurarBucketAvatares(sb: SupabaseClient): Promise<void> {
  if (bucketAvataresAsegurado) return;
  const { data } = await sb.storage.getBucket(BUCKET_AVATARES);
  if (!data) {
    await sb.storage
      .createBucket(BUCKET_AVATARES, { public: true, fileSizeLimit: TAM_MAXIMO_AVATAR_BYTES })
      .catch(() => {});
  }
  bucketAvataresAsegurado = true;
}

function extensionDe(nombre: string, tipo: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nombre);
  if (m) return m[1].toLowerCase();
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";
  return "jpg";
}

/**
 * Sube la foto de una medida corporal y devuelve el PATH del objeto dentro
 * del bucket (que es lo que se guarda en MedidaCorporal.foto_url), o null
 * si no hay archivo, el archivo no sirve o Storage no está configurado.
 * Nunca lanza.
 */
export async function subirFotoProgreso(
  idAlumno: string,
  idMedida: string,
  archivo: File | null
): Promise<string | null> {
  if (!archivo || archivo.size === 0) return null;
  if (!archivo.type.startsWith("image/")) return null;
  if (archivo.size > TAM_MAXIMO_BYTES) return null;

  const sb = clienteAdmin();
  if (!sb) return null;

  try {
    await asegurarBucket(sb);
    const ext = extensionDe(archivo.name, archivo.type);
    const path = `${idAlumno}/${idMedida}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await archivo.arrayBuffer());

    const { error } = await sb.storage
      .from(BUCKET_FOTOS)
      .upload(path, buffer, { contentType: archivo.type, upsert: true });
    if (error) return null;

    return path;
  } catch {
    return null;
  }
}

/** Borra un objeto del bucket. Silencioso: si falla, no rompe el flujo. */
export async function borrarFotoProgreso(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const sb = clienteAdmin();
  if (!sb) return;
  await sb.storage.from(BUCKET_FOTOS).remove([path]).catch(() => {});
}

/**
 * URL firmada de corta duración para mostrar una foto. Devuelve null si el
 * path es vacío, Storage no está configurado o el objeto ya no existe.
 */
export async function urlFirmadaFoto(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const sb = clienteAdmin();
  if (!sb) return null;
  const { data } = await sb.storage
    .from(BUCKET_FOTOS)
    .createSignedUrl(path, TTL_URL_FIRMADA);
  return data?.signedUrl ?? null;
}

/** Igual que urlFirmadaFoto pero para varias, en una sola llamada. */
export async function urlesFirmadasFotos(
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const limpios = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const mapa = new Map<string, string>();
  if (limpios.length === 0) return mapa;

  const sb = clienteAdmin();
  if (!sb) return mapa;

  const { data } = await sb.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(limpios, TTL_URL_FIRMADA);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}

/**
 * Sube una foto de perfil (alumno/coach/beneficiario) o el logo de un
 * comercio y devuelve la URL PÚBLICA lista para guardar directo en
 * Usuario.foto_perfil / Comercio.logo (a diferencia de subirFotoProgreso,
 * acá no hace falta firmar nada para mostrarla). `prefijo` es solo para
 * separar carpetas dentro del bucket (ej. "usuarios" o "comercios") — el
 * path completo es `${prefijo}/${id}.${ext}`, siempre el mismo nombre
 * para un mismo id, así una foto nueva pisa la anterior sola (upsert) sin
 * dejar huérfanos ni necesitar borrar aparte.
 */
export async function subirAvatar(
  prefijo: "usuarios" | "comercios",
  id: string,
  archivo: File | null
): Promise<string | null> {
  if (!archivo || archivo.size === 0) return null;
  if (!archivo.type.startsWith("image/")) return null;
  if (archivo.size > TAM_MAXIMO_AVATAR_BYTES) return null;

  const sb = clienteAdmin();
  if (!sb) return null;

  try {
    await asegurarBucketAvatares(sb);
    const ext = extensionDe(archivo.name, archivo.type);
    const path = `${prefijo}/${id}.${ext}`;
    const buffer = Buffer.from(await archivo.arrayBuffer());

    const { error } = await sb.storage
      .from(BUCKET_AVATARES)
      .upload(path, buffer, { contentType: archivo.type, upsert: true });
    if (error) return null;

    const { data } = sb.storage.from(BUCKET_AVATARES).getPublicUrl(path);
    // Cache-busting: la URL pública es siempre la misma para este id (el
    // path no cambia), así que sin esto el navegador podría seguir
    // mostrando la imagen vieja cacheada después de subir una nueva.
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch {
    return null;
  }
}
