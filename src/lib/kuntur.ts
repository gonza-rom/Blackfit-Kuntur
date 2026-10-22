import { prisma } from "@/lib/prisma";
import { obtenerDiasMembresia } from "@/lib/membresia";

// ------------------------------------------------------------
// Socio de Kuntur Training Club: estado, antigüedad y período actual,
// todo calculado desde las fechas guardadas (zona horaria Argentina).
// La membresía de Kuntur es independiente de la de Blackfit: acá solo se
// miran planes de la organización "kuntur".
// ------------------------------------------------------------

export type EstadoSocio = "vigente" | "vencida" | "suspendida" | "baja" | "sin_membresia";

export const ETIQUETA_ESTADO_SOCIO: Record<EstadoSocio, string> = {
  vigente: "Activa",
  vencida: "Vencida",
  suspendida: "Suspendida",
  baja: "Dada de baja",
  sin_membresia: "Sin membresía",
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** Años, meses y días entre dos fechas (calendario), para "socio hace 1 año y 3 meses". */
export function diferenciaCalendario(desde: Date, hasta: Date = new Date()) {
  let anios = hasta.getFullYear() - desde.getFullYear();
  let meses = hasta.getMonth() - desde.getMonth();
  let dias = hasta.getDate() - desde.getDate();
  if (dias < 0) {
    meses -= 1;
    dias += new Date(hasta.getFullYear(), hasta.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }
  return { anios: Math.max(0, anios), meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

export function textoAntiguedad(desde: Date, hasta: Date = new Date()): string {
  const { anios, meses, dias } = diferenciaCalendario(desde, hasta);
  const partes = [
    anios ? `${anios} año${anios === 1 ? "" : "s"}` : null,
    meses ? `${meses} mes${meses === 1 ? "" : "es"}` : null,
  ].filter(Boolean);
  if (partes.length === 0) return dias <= 1 ? "Desde hoy" : `${dias} días`;
  return partes.join(" y ");
}

export function edad(fechaNacimiento: Date | null | undefined, hoy: Date = new Date()): number | null {
  if (!fechaNacimiento) return null;
  return diferenciaCalendario(fechaNacimiento, hoy).anios;
}

export async function resumenSocio(id_usuario: string) {
  const [socio, membresia, dias, usuario] = await Promise.all([
    prisma.socioKuntur.findUnique({ where: { id_usuario } }),
    prisma.membresia.findFirst({
      where: { id_usuario, plan_membresia: { organizacion: "kuntur" } },
      orderBy: { fecha_vencimiento_membresia: "desc" },
      include: { plan_membresia: { select: { nombre: true, duracion_dias: true } } },
    }),
    obtenerDiasMembresia(id_usuario, "kuntur"),
    prisma.usuario.findUnique({ where: { id_usuario }, select: { fecha_creacion: true } }),
  ]);

  let estado: EstadoSocio = "sin_membresia";
  if (membresia?.estado_membresia === "suspendida") estado = "suspendida";
  else if (membresia?.estado_membresia === "cancelada") estado = "baja";
  else if ((dias ?? 0) > 0) estado = "vigente";
  else if (membresia) estado = "vencida";

  const altaGimnasio = socio?.fecha_alta_gimnasio ?? usuario?.fecha_creacion ?? new Date();
  const periodoDias = membresia
    ? Math.round(
        (membresia.fecha_vencimiento_membresia.getTime() - membresia.fecha_inicio_membresia.getTime()) / DIA_MS
      )
    : null;

  return {
    socio,
    membresia,
    estado,
    diasRestantes: estado === "vigente" ? (dias ?? 0) : 0,
    periodoDias,
    altaGimnasio,
    antiguedad: textoAntiguedad(altaGimnasio),
    edad: edad(socio?.fecha_nacimiento),
  };
}
