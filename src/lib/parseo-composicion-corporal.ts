import type { CampoPerfilComposicion } from "./composicion-corporal";

// ------------------------------------------------------------
// Lee el texto plano de un reporte de bioimpedancia (ya extraído de un
// PDF o Word por quien llama — pdf-parse / mammoth, sin IA) y reconoce
// SOLO los 5 indicadores que muestra el perfil del alumno: peso, IMC,
// % grasa, grasa visceral y % músculo.
//
// Formatos contemplados (sin que el coach tenga que elegir):
// - Lista simple: "Peso 58,6 kg", "Músculos 43,1 %", "Grasa visceral 5"...
// - Informe de evolución: tabla con valor actual, anterior y diferencia,
//   con encabezado "Actual / Anterior / Diferencia" o con fechas por
//   columna. Se toma SIEMPRE el valor actual, nunca la variación (los
//   números con signo + / − se tratan como diferencias) ni el anterior.
//
// Reglas de unidades (críticas):
// - % grasa y % músculo solo aceptan un número marcado como porcentaje
//   ("43,1 %" o una etiqueta "(%)"). Un valor en kg (ej. "Masa muscular
//   26,7 kg") NUNCA se guarda como porcentaje, ni se convierte.
// - Peso, IMC y grasa visceral rechazan valores con "%".
//
// Es una lectura por heurística: el resultado se vuelca a un formulario
// editable y el coach confirma antes de guardar. Lo dudoso se marca para
// revisión y lo que no se encuentra queda vacío — nunca se inventa.
// ------------------------------------------------------------

type Unidad = "%" | "kg" | "otra" | null;

type Definicion = {
  campo: CampoPerfilComposicion;
  // Normalizadas (minúsculas, sin tildes), de la más específica a la más
  // genérica: se prueban en ese orden.
  etiquetas: string[];
  rango: [number, number];
  unidad: "porcentaje" | "kg" | "sin_unidad";
  // Si el texto que sigue a la etiqueta empieza así, no es este campo
  // (ej. "grasa visceral" no es "% grasa"; "peso ideal" no es el peso).
  noSeguidoDe?: RegExp;
};

const DEFINICIONES: Definicion[] = [
  {
    campo: "peso_corporal",
    etiquetas: ["peso corporal", "peso actual", "peso", "body weight", "weight"],
    rango: [20, 300],
    unidad: "kg",
    noSeguidoDe:
      /^\s*(ideal|objetivo|meta|recomendado|deseado|magro|graso|de grasa|muscular|oseo|del agua|de agua|sin grasa|libre|control|target)/,
  },
  {
    campo: "imc",
    etiquetas: ["indice de masa corporal", "imc", "bmi"],
    rango: [10, 70],
    unidad: "sin_unidad",
  },
  {
    campo: "porcentaje_graso",
    etiquetas: [
      "porcentaje de grasa corporal",
      "porcentaje de grasa",
      "% de grasa corporal",
      "% de grasa",
      "% grasa",
      "grasa corporal",
      "masa grasa",
      "body fat",
      "pgc",
      "grasa",
    ],
    rango: [2, 75],
    unidad: "porcentaje",
    noSeguidoDe: /^\s*(visceral|subcutanea)/,
  },
  {
    campo: "grasa_visceral",
    etiquetas: ["nivel de grasa visceral", "grasa visceral", "visceral fat level", "visceral fat"],
    rango: [1, 60],
    unidad: "sin_unidad",
  },
  {
    campo: "porcentaje_musculo",
    etiquetas: [
      "porcentaje de musculo",
      "porcentaje muscular",
      "% de musculo",
      "% musculo",
      "musculo esqueletico",
      "masa muscular",
      "musculos",
      "musculo",
      "muscle",
    ],
    rango: [10, 80],
    unidad: "porcentaje",
  },
];

type Token = { valor: number; crudo: string; signo: boolean; unidad: Unidad };

const RE_FECHA = /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g;
const RE_TOKEN = /([+\-])?\s?(\d{1,4}(?:[.,]\d{1,3})?)\s*(%|kg|kcal|cm|lpm|anos)?/g;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/\r/g, "");
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokens(segmento: string): Token[] {
  const limpio = segmento
    .replace(RE_FECHA, " ")
    // Rangos de referencia entre paréntesis: "(18,5 - 24,9)".
    .replace(/\(\s*\d[^)]*\)/g, " ");
  const salida: Token[] = [];
  for (const m of limpio.matchAll(RE_TOKEN)) {
    const crudo = m[2].replace(",", ".");
    const valor = Number(crudo);
    if (!Number.isFinite(valor)) continue;
    const u = m[3];
    salida.push({
      valor,
      crudo,
      signo: Boolean(m[1]),
      unidad: u === "%" ? "%" : u === "kg" ? "kg" : u ? "otra" : null,
    });
  }
  return salida;
}

/** ¿El renglón es solo números/unidades (fila de una tabla partida)? */
function esFilaNumerica(linea: string): boolean {
  return /\d/.test(linea) && !/[a-z]{3,}/.test(linea.replace(/\b(kg|kcal|cm|lpm|anos)\b/g, ""));
}

type Columnas = { tipos: ("actual" | "anterior" | "diferencia")[] } | null;

/**
 * Detecta el encabezado de un informe comparativo para saber en qué
 * posición viene el valor ACTUAL. Dos variantes: palabras ("actual",
 * "anterior", "diferencia") o fechas por columna (la más reciente es la
 * actual).
 */
function detectarColumnas(lineas: string[]): Columnas {
  // Word (mammoth) convierte cada celda de una tabla en su propio renglón:
  // el encabezado llega como "anterior" / "actual" / "diferencia" en
  // renglones seguidos. Se lo reconstruye como una sola línea.
  const RE_SOLO_COLUMNA = /^(actual|hoy|ultima|anterior|previa|previo|inicial|diferencia|variacion|cambio|dif)$/;
  const noVacias = lineas.filter(Boolean);
  for (let i = 0; i < noVacias.length; i++) {
    if (!RE_SOLO_COLUMNA.test(noVacias[i])) continue;
    let j = i;
    while (j < noVacias.length && RE_SOLO_COLUMNA.test(noVacias[j])) j++;
    if (j - i >= 2) {
      lineas = [noVacias.slice(i, j).join(" "), ...lineas];
      break;
    }
  }

  for (const linea of lineas) {
    const palabras = [
      ...linea.matchAll(/\b(actual|hoy|ultima|anterior|previa|previo|inicial|diferencia|variacion|cambio|dif)\b/g),
    ].map((m) => m[1]);
    const tieneActual = palabras.some((p) => ["actual", "hoy", "ultima"].includes(p));
    const tieneOtra = palabras.some((p) => !["actual", "hoy", "ultima"].includes(p));
    if (tieneActual && tieneOtra) {
      return {
        tipos: palabras.map((p) =>
          ["actual", "hoy", "ultima"].includes(p)
            ? "actual"
            : ["diferencia", "variacion", "cambio", "dif"].includes(p)
              ? "diferencia"
              : "anterior"
        ),
      };
    }

    const fechas = [...linea.matchAll(RE_FECHA)].map((m) => fechaISO(m[0]));
    if (fechas.length >= 2 && fechas.every(Boolean) && !/nacim/.test(linea)) {
      const masReciente = [...fechas].sort().at(-1);
      const tipos: ("actual" | "anterior" | "diferencia")[] = fechas.map((f) =>
        f === masReciente ? "actual" : "anterior"
      );
      if (/\b(diferencia|variacion|cambio|dif)\b/.test(linea)) tipos.push("diferencia");
      return { tipos };
    }
  }
  return null;
}

function unidadValida(def: Definicion, t: Token, contexto: string): boolean {
  if (def.unidad === "porcentaje") {
    if (t.unidad === "kg" || t.unidad === "otra") return false;
    // El número tiene que estar marcado como porcentaje, o la etiqueta
    // tiene que decirlo ("Grasa corporal (%)"). Nunca se asume.
    return t.unidad === "%" || contexto.includes("%");
  }
  if (t.unidad === "%") return false;
  if (def.unidad === "sin_unidad" && t.unidad === "kg") return false;
  if (def.unidad === "kg" && t.unidad === "otra") return false;
  return true;
}

type Lectura = { valor: string; revisar: boolean };

function enRango(def: Definicion, valor: number): boolean {
  return valor >= def.rango[0] && valor <= def.rango[1];
}

/**
 * Valor de un número para este campo, o null si no sirve (diferencia con
 * signo, unidad incorrecta, fuera de rango). Si el número quedó fuera de
 * rango porque el OCR de una foto perdió la coma ("431" en vez de "43,1")
 * y con la coma recuperada tiene sentido, se usa pero marcado `reparado`
 * para que el coach lo revise.
 */
function leerToken(
  def: Definicion,
  t: Token | undefined,
  contexto: string
): { valor: string; reparado: boolean } | null {
  if (!t || t.signo || !unidadValida(def, t, contexto)) return null;
  if (enRango(def, t.valor)) return { valor: t.crudo, reparado: false };
  if (/^\d{2,4}$/.test(t.crudo) && enRango(def, t.valor / 10)) {
    return { valor: String(t.valor / 10), reparado: true };
  }
  return null;
}

function elegirValor(def: Definicion, cand: Token[], contexto: string, columnas: Columnas): Lectura | null {
  // Informe comparativo con columnas reconocidas: SOLO el valor de la
  // columna "actual". Si ese valor no se puede leer, el campo queda vacío:
  // nunca se reemplaza por el anterior ni por la diferencia.
  if (columnas && columnas.tipos.length >= 2) {
    let elegido: Token | undefined;
    let ubicado = false;
    if (cand.length === columnas.tipos.length) {
      elegido = cand[columnas.tipos.indexOf("actual")];
      ubicado = true;
    } else {
      // Fila sin la columna de diferencia (o con la diferencia sin signo):
      // se ubica entre los valores sin signo.
      const sinSigno = cand.filter((t) => !t.signo);
      const sinDiferencia = columnas.tipos.filter((x) => x !== "diferencia");
      if (sinSigno.length === sinDiferencia.length) {
        elegido = sinSigno[sinDiferencia.indexOf("actual")];
        ubicado = true;
      }
    }

    if (ubicado) {
      const l = leerToken(def, elegido, contexto);
      return l ? { valor: l.valor, revisar: l.reparado } : null;
    }
    // No se pudo ubicar la columna actual en esta fila: el primer valor
    // válido, siempre marcado para revisión.
    for (const t of cand) {
      const l = leerToken(def, t, contexto);
      if (l) return { valor: l.valor, revisar: true };
    }
    return null;
  }

  // Lista simple: el primer valor válido. Si hay otro con la misma unidad
  // (ej. "58,6 kg 59,5 kg") sin encabezado que diga cuál es el actual, se
  // pide revisión.
  const validos = cand
    .map((t) => ({ t, l: leerToken(def, t, contexto) }))
    .filter((x): x is { t: Token; l: { valor: string; reparado: boolean } } => x.l !== null);
  if (validos.length === 0) return null;
  const [primero, segundo] = validos;
  const dudoso = Boolean(segundo && primero.t.unidad && segundo.t.unidad === primero.t.unidad);
  return { valor: primero.l.valor, revisar: primero.l.reparado || dudoso };
}

export type LecturaComposicion = {
  valores: Partial<Record<CampoPerfilComposicion, string>>;
  // Campos completados que el coach tiene que mirar con atención: no se
  // pudo determinar con certeza cuál era el valor actual.
  revisar: CampoPerfilComposicion[];
};

/** Reconoce los 5 indicadores del perfil en el texto de un reporte de bioimpedancia. */
export function extraerComposicionDeTexto(textoOriginal: string): LecturaComposicion {
  const lineas = normalizar(textoOriginal)
    .split("\n")
    .map((l) => l.replace(/[\t ]+/g, " ").trim());
  const columnas = detectarColumnas(lineas);
  const valores: LecturaComposicion["valores"] = {};
  const revisar: CampoPerfilComposicion[] = [];

  for (const def of DEFINICIONES) {
    let lectura: Lectura | null = null;

    for (const etiqueta of def.etiquetas) {
      if (lectura) break;
      const patron = new RegExp(`(?:^|[^a-z%])(${escapar(etiqueta)})(?![a-z])`, "g");

      for (let i = 0; i < lineas.length && !lectura; i++) {
        for (const m of lineas[i].matchAll(patron)) {
          const resto = lineas[i].slice((m.index ?? 0) + m[0].length);
          if (def.noSeguidoDe?.test(resto)) continue;

          // Lo que hay entre la etiqueta y el primer número: ahí puede
          // venir la unidad del encabezado de la fila, ej. "(%)" o "(kg)".
          const contexto = (etiqueta.includes("%") ? "%" : "") + (resto.match(/^[^0-9+\-]*/)?.[0] ?? "");
          let cand = tokens(resto);

          // Tabla partida: la etiqueta en un renglón y los valores en los
          // siguientes renglones (solo números).
          if (cand.length === 0) {
            for (let j = i + 1; j < lineas.length && j <= i + 4; j++) {
              if (!lineas[j]) continue;
              if (!esFilaNumerica(lineas[j])) break;
              cand = cand.concat(tokens(lineas[j]));
            }
          }

          lectura = elegirValor(def, cand, contexto, columnas);
          if (lectura) break;
        }
      }
    }

    if (lectura) {
      valores[def.campo] = lectura.valor;
      if (lectura.revisar) revisar.push(def.campo);
    }
  }

  return { valores, revisar };
}

function fechaISO(crudo: string): string | null {
  const m = crudo.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 2000 || anio > 2100) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Fecha de la medición (YYYY-MM-DD) o null. En un informe de evolución
 * aparecen varias fechas (la anterior y la actual): se toma la más
 * reciente, ignorando la fecha de nacimiento y fechas futuras.
 */
export function extraerFechaDeTexto(textoOriginal: string): string | null {
  const hoy = new Date().toISOString().slice(0, 10);
  const candidatas = normalizar(textoOriginal)
    .split("\n")
    .filter((l) => !/nacim|\bnac\b|birth/.test(l))
    .flatMap((l) => [...l.matchAll(RE_FECHA)].map((m) => fechaISO(m[0])))
    .filter((f): f is string => Boolean(f) && (f as string) <= hoy);
  return candidatas.sort().at(-1) ?? null;
}

