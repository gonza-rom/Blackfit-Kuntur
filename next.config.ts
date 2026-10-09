import type { NextConfig } from "next";

const esDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy: limita de dónde puede cargar cosas la página,
// así un script inyectado (XSS) no puede traer código de afuera ni mandar
// datos a otro dominio. Orígenes externos que usa la app hoy:
// - Google Fonts (Material Symbols), en el layout raíz.
// - Videos de ejercicios embebidos: YouTube, Vimeo, Google Drive.
// - Imágenes: Cloudinary (URLs firmadas), avatares, etc. → https: en img-src.
// Next inyecta scripts inline para hidratar, por eso 'unsafe-inline' en
// script-src (sin nonces); 'unsafe-eval' solo en desarrollo (React Refresh).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self'",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(esDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const encabezadosSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  // Solo HTTPS durante 2 años, incluidos subdominios.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Nadie puede meter la app en un iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La cámara la usa el escáner QR de /comercio/validar; el resto, nada.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // No anunciar "X-Powered-By: Next.js" (da pistas de versión a un atacante).
  poweredByHeader: false,
  experimental: {
    // El default (1mb) no alcanza para subir el PDF/Word de una balanza
    // InBody desde /coach — ver extraerComposicionDeDocumento en
    // src/app/actions/coach.ts.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: encabezadosSeguridad }];
  },
};

export default nextConfig;
