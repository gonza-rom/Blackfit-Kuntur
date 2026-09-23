import { v2 as cloudinary } from "cloudinary";

// Configuración perezosa: se arma una sola vez con las keys de .env
// (CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME).
// El SDK firma las subidas con el api_secret del lado del servidor, así que
// nunca se expone al navegador — el mismo patrón que ya usa storage.ts con
// la service role key de Supabase.
let configurado = false;

function asegurarConfig(): boolean {
  if (!configurado) {
    const cloud_name = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (cloud_name && api_key && api_secret) {
      cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    }
    configurado = true;
  }
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function cloudinaryDisponible(): boolean {
  return asegurarConfig();
}

export { cloudinary };
