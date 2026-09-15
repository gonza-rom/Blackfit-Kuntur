import type { CampoComposicionCorporal } from "./composicion-corporal";

// ------------------------------------------------------------
// Lee el texto plano de un reporte de balanza/InBody (ya extraído de un
// PDF o Word por quien llama a esta función) y adivina, por etiqueta, qué
// número corresponde a cada campo de ProgresoFisico. Es un parser por
// heurística de texto — nunca una lectura garantizada — porque cada marca
// y modelo de balanza imprime el reporte con su propio layout y sus
// propias etiquetas. Por eso el resultado siempre se vuelca a un
// formulario editable: el coach revisa y corrige antes de guardar, nunca
// se guarda directo lo que devuelve este parser.
// ------------------------------------------------------------

type DefinicionCampo = {
  campo: CampoComposicionCorporal;
  // Etiquetas ya normalizadas (minúsculas, sin tildes), de la más
  // específica a la más genérica — se prueban en ese orden.
  etiquetas: string[];
  // Rango plausible para descartar capturas absurdas (ej. un número de
  // página o un año pegado a la etiqueta por casualidad del layout).
  rango: [number, number];
  requierePorcentaje?: boolean;
  // Palabras que, si aparecen en la misma línea, invalidan la coincidencia
  // (ej. "peso ideal" no es el peso medido real).
  excluir?: string[];
};

const DEFINICIONES: DefinicionCampo[] = [
  {
    campo: "peso_corporal",
    etiquetas: ["peso corporal", "body weight", "weight", "peso"],
    rango: [20, 300],
    excluir: ["ideal", "objetivo", "meta", "recomendado", "deseado", "target", "control"],
  },
  {
    campo: "imc",
    etiquetas: ["indice de masa corporal", "imc", "bmi"],
    rango: [10, 60],
  },
  {
    campo: "pulso",
    etiquetas: ["frecuencia cardiaca", "pulso", "heart rate", "pulse", "bpm"],
    rango: [30, 220],
  },
  {
    campo: "porcentaje_graso",
    etiquetas: [
      "porcentaje de grasa corporal",
      "porcentaje de grasa",
      "grasa corporal (%)",
      "pgc",
      "percent body fat",
      "body fat percentage",
      "body fat %",
      "% grasa",
      "grasa corporal",
    ],
    rango: [1, 70],
    requierePorcentaje: true,
  },
  {
    campo: "porcentaje_agua",
    etiquetas: [
      "porcentaje de agua corporal",
      "agua corporal total",
      "total body water",
      "tbw",
      "porcentaje de agua",
      "% agua",
      "agua corporal",
      "body water",
    ],
    rango: [1, 90],
    requierePorcentaje: true,
  },
  {
    campo: "porcentaje_musculo",
    etiquetas: [
      "porcentaje de musculo",
      "porcentaje muscular",
      "% musculo",
      "muscle percentage",
    ],
    rango: [1, 90],
    requierePorcentaje: true,
  },
  {
    campo: "masa_osea",
    etiquetas: ["masa osea", "mineral oseo", "bone mineral", "bone mass", "huesos"],
    rango: [0.5, 10],
  },
  {
    campo: "metabolismo_basal",
    etiquetas: [
      "tasa metabolica basal",
      "metabolismo basal",
      "basal metabolic rate",
      "tmb",
      "bmr",
    ],
    rango: [500, 5000],
  },
  {
    campo: "metabolismo_activo",
    etiquetas: ["metabolismo activo", "gasto energetico total", "total energy expenditure", "tdee"],
    rango: [500, 6000],
  },
  {
    campo: "grasa_visceral",
    etiquetas: ["nivel de grasa visceral", "grasa visceral", "visceral fat level", "visceral fat"],
    rango: [1, 30],
  },
  {
    campo: "edad_metabolica",
    etiquetas: ["edad metabolica", "edad corporal", "metabolic age", "body age"],
    rango: [5, 100],
  },
  {
    campo: "soft_lean_mass",
    etiquetas: ["soft lean mass"],
    rango: [1, 150],
  },
  {
    campo: "lean_body_mass",
    etiquetas: ["lean body mass", "lbm"],
    rango: [1, 150],
  },
  {
    campo: "proteina",
    etiquetas: ["proteinas", "proteina", "protein"],
    rango: [1, 30],
  },
  {
    campo: "masa_muscular",
    etiquetas: [
      "masa muscular esqueletica",
      "smm",
      "skeletal muscle mass",
      "masa muscular",
    ],
    rango: [1, 150],
  },
];

const RANGO_DIACRITICOS = /[\u0300-\u036f]/g;

function quitarTildes(texto: string): string {
  return texto.normalize("NFD").replace(RANGO_DIACRITICOS, "");
}

function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineaDelIndice(texto: string, indice: number): string {
  const inicio = texto.lastIndexOf("\n", indice) + 1;
  const finRelativo = texto.indexOf("\n", indice);
  const fin = finRelativo === -1 ? texto.length : finRelativo;
  return texto.slice(inicio, fin);
}

/** Extrae, campo por campo, los valores que aparezcan en el texto de un reporte de composición corporal. */
export function extraerComposicionDeTexto(
  textoOriginal: string
): Partial<Record<CampoComposicionCorporal, string>> {
  const texto = quitarTildes(textoOriginal.toLowerCase());
  const resultado: Partial<Record<CampoComposicionCorporal, string>> = {};

  for (const def of DEFINICIONES) {
    let encontrado: string | null = null;

    for (const etiqueta of def.etiquetas) {
      if (encontrado) break;

      // Entre la etiqueta y el número puede haber ":" ", " o un salto de
      // línea (las tablas de un PDF suelen perder la alineación real) —
      // por eso la ventana tolera hasta ~25 caracteres que no sean dígitos.
      const patron = new RegExp(
        `${escaparRegExp(etiqueta)}[^0-9]{0,25}([0-9]+(?:[.,][0-9]+)?)\\s*(%)?`,
        "gi"
      );

      let coincidencia: RegExpExecArray | null;
      while ((coincidencia = patron.exec(texto)) !== null) {
        const [, numeroCrudo, porcentajeInmediato] = coincidencia;
        const linea = lineaDelIndice(texto, coincidencia.index);

        if (def.excluir?.some((palabra) => linea.includes(palabra))) continue;

        const tienePorcentaje = Boolean(porcentajeInmediato) || linea.includes("%");
        if (def.requierePorcentaje && !tienePorcentaje) continue;

        const numero = Number(numeroCrudo.replace(",", "."));
        if (!Number.isFinite(numero) || numero < def.rango[0] || numero > def.rango[1]) continue;

        encontrado = numeroCrudo.replace(",", ".");
        break;
      }
    }

    if (encontrado) resultado[def.campo] = encontrado;
  }

  return resultado;
}

/** Busca una fecha "dd/mm/aaaa" (o con "-"/".") cerca de la palabra "fecha"/"date". Devuelve YYYY-MM-DD o null. */
export function extraerFechaDeTexto(textoOriginal: string): string | null {
  const texto = quitarTildes(textoOriginal.toLowerCase());
  const patron = /(?:fecha|date)[^0-9]{0,20}([0-9]{1,2})[/\-.]([0-9]{1,2})[/\-.]([0-9]{2,4})/i;
  const coincidencia = texto.match(patron);
  if (!coincidencia) return null;

  const dia = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  let anio = coincidencia[3];
  if (anio.length === 2) anio = `20${anio}`;
  const anioNum = Number(anio);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const fecha = new Date(anioNum, mes - 1, dia);
  if (Number.isNaN(fecha.getTime())) return null;

  return `${anioNum}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
