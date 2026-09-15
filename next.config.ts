import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El default (1mb) no alcanza para subir el PDF/Word de una balanza
    // InBody desde /coach — ver extraerComposicionDeDocumento en
    // src/app/actions/coach.ts.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
