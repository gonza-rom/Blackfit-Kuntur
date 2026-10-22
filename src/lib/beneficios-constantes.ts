import type { AudienciaBeneficio } from "@prisma/client";

// Constantes del catálogo de beneficios sin dependencias de servidor: las
// usan tanto los formularios (navegador) como lib/beneficios.ts.

export const ETIQUETA_AUDIENCIA: Record<AudienciaBeneficio, string> = {
  blackfit: "Solo Blackfit",
  kuntur: "Solo socios Kuntur",
  ambos: "Blackfit y Kuntur",
};

export const CATEGORIAS_BENEFICIO = [
  "Gastronomía",
  "Indumentaria",
  "Suplementación",
  "Salud y bienestar",
  "Estética",
  "Servicios",
  "Otros comercios",
] as const;
