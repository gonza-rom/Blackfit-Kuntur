"use client";

// Lectura de texto de una FOTO del informe de bioimpedancia (jpg, png,
// webp...) con OCR: Tesseract, motor de código abierto que corre en el
// navegador del coach. Sin IA ni servicios externos: la imagen no sale del
// dispositivo y los archivos del motor se sirven desde la propia app
// (public/ocr, ver scripts/copiar-ocr.mjs). El texto resultante pasa por el
// mismo lector de reglas que el PDF/Word.

export const TIPOS_IMAGEN_OCR = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp", "image/gif"];
const EXTENSIONES_IMAGEN = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];

export function esImagen(archivo: File): boolean {
  const nombre = archivo.name.toLowerCase();
  return TIPOS_IMAGEN_OCR.includes(archivo.type) || EXTENSIONES_IMAGEN.some((e) => nombre.endsWith(e));
}

/**
 * Prepara la foto para el OCR: la lleva a un tamaño de trabajo (las fotos
 * chicas se agrandan, las enormes se achican), la pasa a escala de grises
 * y sube el contraste. Mejora mucho la lectura de fotos de pantalla o de
 * papel con poca luz.
 */
async function prepararImagen(archivo: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(archivo);
  const ladoMayor = Math.max(bitmap.width, bitmap.height);
  let escala = 1;
  if (ladoMayor < 2400) escala = Math.min(3, 2400 / ladoMayor);
  else if (ladoMayor > 4000) escala = 4000 / ladoMayor;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Devuelve el texto reconocido en la imagen. `onProgreso` recibe 0..1. */
export async function leerTextoDeImagen(
  archivo: File,
  onProgreso?: (fraccion: number) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr/lang",
    // Worker desde la URL propia (no un blob:), acorde a la CSP de la app.
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgreso?.(m.progress);
    },
  });
  try {
    const imagen = await prepararImagen(archivo);
    const { data } = await worker.recognize(imagen);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
