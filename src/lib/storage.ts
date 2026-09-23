import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { cloudinary, cloudinaryDisponible } from "./cloudinary";

// Todas las imágenes de la app (fotos de progreso, fotos de perfil, logos
// de comercio) suben a Cloudinary. Los nombres/firmas de estas funciones
// se mantuvieron igual que cuando usaban Supabase Storage para no tener
// que tocar ningún caller (actions/alumno.ts, actions/coach.ts,
// actions/usuario.ts, actions/comercio.ts, las páginas que resuelven fotos).

const TAM_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB
const TAM_MAXIMO_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB

// Fotos de progreso de los alumnos (MedidaCorporal.foto_url): son datos
// sensibles, así que se suben con type "authenticated" — a diferencia de
// una subida normal, Cloudinary exige que la URL venga firmada con el
// api_secret para poder verla. Nunca se guarda ni se muestra la URL
// pública directa.
const CARPETA_FOTOS = "fotos-progreso";
// Fotos de perfil (Usuario.foto_perfil) y logos de comercio (Comercio.logo):
// no hay nada sensible acá — se muestran todo el tiempo en la app — así
// que suben públicas y se guarda la URL directa, sin firmar nada.
const CARPETA_AVATARES = "avatares";

function subirBuffer(
  buffer: Buffer,
  opciones: UploadApiOptions
): Promise<UploadApiResponse | null> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opciones, (error, resultado) => {
      if (error) reject(error);
      else resolve(resultado ?? null);
    });
    stream.end(buffer);
  });
}

/**
 * Sube la foto de una medida corporal y devuelve el PUBLIC ID (con
 * extensión) del recurso en Cloudinary — es lo que se guarda en
 * MedidaCorporal.foto_url — o null si no hay archivo, el archivo no sirve
 * o Cloudinary no está configurado. Nunca lanza.
 */
export async function subirFotoProgreso(
  idAlumno: string,
  idMedida: string,
  archivo: File | null
): Promise<string | null> {
  if (!archivo || archivo.size === 0) return null;
  if (!archivo.type.startsWith("image/")) return null;
  if (archivo.size > TAM_MAXIMO_BYTES) return null;
  if (!cloudinaryDisponible()) return null;

  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const public_id = `${CARPETA_FOTOS}/${idAlumno}/${idMedida}-${Date.now()}`;
    const resultado = await subirBuffer(buffer, {
      public_id,
      type: "authenticated",
      resource_type: "image",
      overwrite: true,
    });
    if (!resultado) return null;
    return `${resultado.public_id}.${resultado.format}`;
  } catch {
    return null;
  }
}

/** Borra un recurso de Cloudinary. Silencioso: si falla, no rompe el flujo. */
export async function borrarFotoProgreso(path: string | null | undefined): Promise<void> {
  if (!path) return;
  if (!cloudinaryDisponible()) return;
  await cloudinary.uploader
    .destroy(path, { type: "authenticated", resource_type: "image" })
    .catch(() => {});
}

/**
 * URL firmada para mostrar una foto de progreso. Devuelve null si el path
 * es vacío o Cloudinary no está configurado.
 */
export async function urlFirmadaFoto(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (!cloudinaryDisponible()) return null;
  return cloudinary.url(path, { type: "authenticated", sign_url: true, secure: true });
}

/** Igual que urlFirmadaFoto pero para varias, en una sola pasada. */
export async function urlesFirmadasFotos(
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const limpios = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const mapa = new Map<string, string>();
  if (limpios.length === 0 || !cloudinaryDisponible()) return mapa;

  for (const path of limpios) {
    mapa.set(path, cloudinary.url(path, { type: "authenticated", sign_url: true, secure: true }));
  }
  return mapa;
}

/**
 * Sube una foto de perfil (alumno/coach/beneficiario) o el logo de un
 * comercio y devuelve la URL PÚBLICA lista para guardar directo en
 * Usuario.foto_perfil / Comercio.logo. `prefijo` es solo para separar
 * carpetas dentro de Cloudinary (ej. "usuarios" o "comercios") — el
 * public_id es siempre el mismo para un mismo id, así una foto nueva pisa
 * la anterior sola (overwrite) sin dejar huérfanos ni necesitar borrar
 * aparte.
 */
export async function subirAvatar(
  prefijo: "usuarios" | "comercios",
  id: string,
  archivo: File | null
): Promise<string | null> {
  if (!archivo || archivo.size === 0) return null;
  if (!archivo.type.startsWith("image/")) return null;
  if (archivo.size > TAM_MAXIMO_AVATAR_BYTES) return null;
  if (!cloudinaryDisponible()) return null;

  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const public_id = `${CARPETA_AVATARES}/${prefijo}/${id}`;
    const resultado = await subirBuffer(buffer, {
      public_id,
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });
    if (!resultado) return null;
    // Cache-busting: el public_id es siempre el mismo para este id, así
    // que sin esto el navegador podría seguir mostrando la imagen vieja
    // cacheada después de subir una nueva (invalidate:true limpia el CDN
    // de Cloudinary, pero no el caché del navegador).
    return `${resultado.secure_url}?v=${Date.now()}`;
  } catch {
    return null;
  }
}
