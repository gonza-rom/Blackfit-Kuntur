// Copia el motor OCR (Tesseract, código abierto, sin IA ni servicios
// externos) y el idioma español a public/ocr, para que el navegador del
// coach los cargue desde la propia app (ver src/lib/ocr-cliente.ts). Corre
// en cada `npm install` (postinstall); public/ocr está en .gitignore.
import { cpSync, mkdirSync } from "node:fs";

const destino = "public/ocr";
mkdirSync(`${destino}/lang`, { recursive: true });

cpSync("node_modules/tesseract.js/dist/worker.min.js", `${destino}/worker.min.js`);
for (const archivo of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"]) {
  cpSync(`node_modules/tesseract.js-core/${archivo}`, `${destino}/${archivo}`);
}
// "best_int": modelo LSTM preciso y liviano (~2 MB).
cpSync(
  "node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz",
  `${destino}/lang/spa.traineddata.gz`
);
console.log("OCR copiado a public/ocr");
