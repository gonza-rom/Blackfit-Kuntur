import { Prisma, type AudienciaBeneficio, type Organizacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerDiasMembresia } from "@/lib/membresia";

// ------------------------------------------------------------
// CATÁLOGO ÚNICO DE BENEFICIOS — compartido entre Blackfit y Kuntur.
//
// Cada beneficio se carga UNA vez (lo crea un comercio adherido o la
// administración) y tiene una audiencia: blackfit, kuntur o ambos. El
// mismo registro aparece en la sección Beneficios de cada entorno según
// esa audiencia, así un cambio, vencimiento o desactivación se ve en los
// dos lados sin cargar nada dos veces.
//
// Visibilidad ≠ permiso de uso: un beneficio publicado se VE en su
// entorno, pero USARLO (validación QR en el comercio) exige además la
// membresía vigente de la organización que corresponda y no haber
// superado el límite de usos. Cada organización mira SOLO su membresía:
// vencer Kuntur no afecta lo de Blackfit, ni al revés.
// ------------------------------------------------------------

export type Entorno = Organizacion; // "blackfit" | "kuntur"

export const NOMBRE_ENTORNO: Record<Entorno, string> = {
  blackfit: "Blackfit",
  kuntur: "Kuntur Training Club",
};

// Constantes puras (sin Prisma) en su propio módulo, para poder usarlas en
// formularios del navegador.
export { ETIQUETA_AUDIENCIA, CATEGORIAS_BENEFICIO } from "./beneficios-constantes";

export function audienciasDe(entorno: Entorno): AudienciaBeneficio[] {
  return entorno === "blackfit" ? ["blackfit", "ambos"] : ["kuntur", "ambos"];
}

/** Publicado y dentro de su vigencia (el estado guardado solo no alcanza). */
export function beneficioVigente(
  b: { estado: string; fecha_inicio: Date; fecha_vencimiento: Date },
  ahora: Date = new Date()
): boolean {
  return b.estado === "activo" && b.fecha_inicio <= ahora && b.fecha_vencimiento >= ahora;
}

/** Filtro de Prisma de lo que se ve en el catálogo de un entorno. */
export function filtroCatalogo(entorno: Entorno, ahora: Date = new Date()): Prisma.BeneficioWhereInput {
  return {
    estado: "activo",
    audiencia: { in: audienciasDe(entorno) },
    fecha_inicio: { lte: ahora },
    fecha_vencimiento: { gte: ahora },
    comercio: { estado: "activo" },
  };
}

export async function catalogoBeneficios(
  entorno: Entorno,
  filtros: { texto?: string; categoria?: string } = {}
) {
  const texto = filtros.texto?.trim();
  return prisma.beneficio.findMany({
    where: {
      ...filtroCatalogo(entorno),
      ...(filtros.categoria ? { OR: [{ categoria: filtros.categoria }, { comercio: { categoria: filtros.categoria } }] } : {}),
      ...(texto
        ? {
            AND: [
              {
                OR: [
                  { titulo: { contains: texto, mode: "insensitive" } },
                  { descripcion: { contains: texto, mode: "insensitive" } },
                  { comercio: { nombre: { contains: texto, mode: "insensitive" } } },
                ],
              },
            ],
          }
        : {}),
    },
    include: {
      comercio: { select: { id_comercio: true, nombre: true, categoria: true, logo: true, direccion: true, descripcion: true } },
    },
    orderBy: [{ fecha_vencimiento: "asc" }],
  });
}

export type MembresiasVigentes = Record<Entorno, boolean>;

/** Qué membresías tiene vigentes la persona, cada organización por separado. */
export async function membresiasVigentes(id_usuario: string): Promise<MembresiasVigentes> {
  const [blackfit, kuntur] = await Promise.all([
    obtenerDiasMembresia(id_usuario, "blackfit"),
    obtenerDiasMembresia(id_usuario, "kuntur"),
  ]);
  return { blackfit: (blackfit ?? 0) > 0, kuntur: (kuntur ?? 0) > 0 };
}

export type Evaluacion = { ok: true } | { ok: false; motivo: string };

/** ¿Esta persona puede USAR este beneficio ahora? (lo decide el servidor) */
export function evaluarUso(
  beneficio: { estado: string; fecha_inicio: Date; fecha_vencimiento: Date; audiencia: AudienciaBeneficio; limite_usos: number | null },
  vigentes: MembresiasVigentes,
  usosPrevios: number
): Evaluacion {
  if (!beneficioVigente(beneficio)) return { ok: false, motivo: "El beneficio no está vigente." };
  const habilitado =
    beneficio.audiencia === "ambos"
      ? vigentes.blackfit || vigentes.kuntur
      : vigentes[beneficio.audiencia];
  if (!habilitado) {
    return {
      ok: false,
      motivo:
        beneficio.audiencia === "kuntur"
          ? "Es exclusivo para socios con la membresía Kuntur vigente."
          : beneficio.audiencia === "blackfit"
            ? "Es exclusivo para alumnos con la membresía Blackfit vigente."
            : "Necesita una membresía Blackfit o Kuntur vigente.",
    };
  }
  if (beneficio.limite_usos != null && usosPrevios >= beneficio.limite_usos) {
    return {
      ok: false,
      motivo:
        beneficio.limite_usos === 1
          ? "Es de uso único y ya fue utilizado."
          : `Ya alcanzó el límite de ${beneficio.limite_usos} usos.`,
    };
  }
  return { ok: true };
}

/** Usos ya aprobados de un beneficio por una persona. */
export function contarUsos(id_usuario: string, id_beneficio: string): Promise<number> {
  return prisma.validacionBeneficio.count({ where: { id_usuario, id_beneficio, resultado: "aprobado" } });
}

/**
 * Credencial digital (QR con un token opaco, nunca datos personales) para
 * usar beneficios. Se crea la primera vez que hace falta, para socios de
 * Kuntur y alumnos de Blackfit por igual.
 */
export async function asegurarCredencial(id_usuario: string) {
  const existente = await prisma.credencial.findUnique({ where: { id_usuario } });
  if (existente) return existente;
  for (let intento = 0; intento < 5; intento++) {
    const [ultimo] = await prisma.$queryRaw<{ n: number | null }[]>`
      select max(nullif(regexp_replace(numero_socio, '\\D', '', 'g'), '')::int) as n from credenciales`;
    const numero_socio = `K-${String((ultimo?.n ?? 0) + 1 + intento).padStart(6, "0")}`;
    try {
      return await prisma.credencial.create({ data: { id_usuario, numero_socio } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const otra = await prisma.credencial.findUnique({ where: { id_usuario } });
        if (otra) return otra;
        continue; // número tomado por otro alta simultánea: probar el siguiente
      }
      throw e;
    }
  }
  throw new Error("No se pudo generar el número de socio.");
}

// ------------------------------------------------------------
// Formulario de beneficio
// ------------------------------------------------------------

const AUDIENCIAS: AudienciaBeneficio[] = ["blackfit", "kuntur", "ambos"];

// "YYYY-MM-DD" → mediodía en Argentina (sin corrimiento de día por UTC).
function fecha(crudo: string, finDelDia = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(crudo)) return null;
  const d = new Date(`${crudo}T${finDelDia ? "23:59:59" : "00:00:00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DatosBeneficio = {
  titulo: string;
  descripcion: string | null;
  descuento: string | null;
  condiciones: string | null;
  categoria: string | null;
  audiencia: AudienciaBeneficio;
  limite_usos: number | null;
  fecha_inicio: Date;
  fecha_vencimiento: Date;
};

/** Lee y valida el formulario de un beneficio (mismas reglas para comercio y administración). */
export function leerBeneficio(formData: FormData): DatosBeneficio | { error: string } {
  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 120);
  const audiencia = String(formData.get("audiencia") ?? "ambos") as AudienciaBeneficio;
  const limiteCrudo = String(formData.get("limite_usos") ?? "").trim();
  const limite = limiteCrudo === "" ? null : Number(limiteCrudo);
  const fecha_inicio = fecha(String(formData.get("fecha_inicio") ?? ""));
  const fecha_vencimiento = fecha(String(formData.get("fecha_vencimiento") ?? ""), true);

  if (!titulo || !fecha_inicio || !fecha_vencimiento) {
    return { error: "Completá título y vigencia del beneficio." };
  }
  if (fecha_vencimiento < fecha_inicio) return { error: "El vencimiento tiene que ser posterior al inicio." };
  if (!AUDIENCIAS.includes(audiencia)) return { error: "Elegí para quién es el beneficio." };
  if (limite !== null && (!Number.isInteger(limite) || limite < 1 || limite > 1000)) {
    return { error: "El límite de usos tiene que ser un número entero (o vacío = ilimitado)." };
  }
  return {
    titulo,
    descripcion: String(formData.get("descripcion") ?? "").trim().slice(0, 1000) || null,
    descuento: String(formData.get("descuento") ?? "").trim().slice(0, 60) || null,
    condiciones: String(formData.get("condiciones") ?? "").trim().slice(0, 1000) || null,
    categoria: String(formData.get("categoria") ?? "").trim().slice(0, 60) || null,
    audiencia,
    limite_usos: limite,
    fecha_inicio,
    fecha_vencimiento,
  };
}

