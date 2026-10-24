import { cache } from "react";
import type { Organizacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearNotificacion } from "@/lib/notificaciones";

const DIA_MS = 1000 * 60 * 60 * 24;
const VENTANA_AVISO_DIAS = 5;

// El coach de Blackfit activa/renueva entre 1 y 30 días (30 sugerido).
// Los días son exactos: N × 24 h desde la fecha y hora del servidor.
export const DIAS_MEMBRESIA_MIN = 1;
export const DIAS_MEMBRESIA_MAX = 30;
export const DIAS_MEMBRESIA_SUGERIDOS = 30;

// Argentina no tiene horario de verano: UTC-3 fijo todo el año. Los días
// del contador se cuentan en hora local, no en UTC (si no, alguien que
// activa a las 22hs vería "29 días" esa misma noche).
const OFFSET_AR_MS = -3 * 60 * 60 * 1000;

function claveDiaAR(ms: number): string {
  return new Date(ms + OFFSET_AR_MS).toISOString().slice(0, 10);
}

function medianocheAR(clave: string): number {
  return Date.parse(`${clave}T00:00:00-03:00`);
}

/**
 * Vencimiento para una activación hecha ahora: la medianoche (hora AR)
 * del día de activación + 30. Ej. activada el 04/10 a cualquier hora →
 * vence el 03/11 a las 00:00, así el 02/11 es el último día con acceso.
 * (Lo usan las membresías de Kuntur; Blackfit usa calcularPeriodoMembresia.)
 */
export function calcularVencimiento30Dias(ahora: Date = new Date()): Date {
  const inicioHoy = medianocheAR(claveDiaAR(ahora.getTime()));
  return new Date(inicioHoy + 30 * DIA_MS);
}

/** Duración válida para una membresía de Blackfit: entero de 1 a 30, o null. */
export function diasMembresiaValidos(valor: unknown): number | null {
  const crudo = String(valor ?? "").trim();
  const n = Number(crudo);
  return crudo !== "" && Number.isInteger(n) && n >= DIAS_MEMBRESIA_MIN && n <= DIAS_MEMBRESIA_MAX ? n : null;
}

/**
 * Período de una activación/renovación de Blackfit hecha `ahora`:
 * - Con una membresía vigente (renovación anticipada), los días nuevos se
 *   suman al vencimiento actual: no se pierde ningún día ya contratado.
 * - Vencida, suspendida o sin membresía: empieza ahora.
 */
export function calcularPeriodoMembresia(
  dias: number,
  vencimientoVigente: Date | null,
  ahora: Date = new Date()
): { inicio: Date; vencimiento: Date; renovacion: boolean } {
  const vigente =
    vencimientoVigente && vencimientoVigente.getTime() > ahora.getTime() ? vencimientoVigente : null;
  const inicio = vigente ?? ahora;
  return { inicio, vencimiento: new Date(inicio.getTime() + dias * DIA_MS), renovacion: vigente !== null };
}

/**
 * Días de acceso que le quedan, contando hoy: el día de activación da 30,
 * el siguiente 29, … el último día 1. 0 = vencida. (Conteo por día
 * calendario, para vencimientos a medianoche como los de Kuntur.)
 */
export function diasRestantesMembresia(vencimiento: Date, ahora: Date = new Date()): number {
  if (vencimiento.getTime() <= ahora.getTime()) return 0;
  const ultimoDia = medianocheAR(claveDiaAR(vencimiento.getTime() - 1));
  const hoy = medianocheAR(claveDiaAR(ahora.getTime()));
  return Math.round((ultimoDia - hoy) / DIA_MS) + 1;
}

/**
 * Días restantes exactos (Blackfit, vencimiento con hora): 30 días recién
 * activados → 30, y el último tramo de menos de 24 h → 1. 0 = vencida.
 */
export function diasRestantesExactos(vencimiento: Date, ahora: Date = new Date()): number {
  const resto = vencimiento.getTime() - ahora.getTime();
  return resto <= 0 ? 0 : Math.ceil(resto / DIA_MS);
}

export function membresiaVigente(m: {
  estado_membresia: string;
  fecha_vencimiento_membresia: Date;
}): boolean {
  return m.estado_membresia === "activa" && diasRestantesMembresia(m.fecha_vencimiento_membresia) > 0;
}

/**
 * Días de membresía de un usuario a partir de sus membresías: null = nunca
 * tuvo una, 0 = vencida, si no los días restantes de la vigente. ÚNICA
 * fuente del número que ven el alumno (Inicio, Perfil) y el coach
 * (Coach → Alumnos), así siempre coinciden.
 */
export function diasMembresiaDe(
  membresias: { estado_membresia: string; fecha_vencimiento_membresia: Date }[],
  contarDias: (vencimiento: Date) => number = diasRestantesMembresia
): number | null {
  if (membresias.length === 0) return null;
  return Math.max(
    0,
    ...membresias.map((m) => (membresiaVigente(m) ? contarDias(m.fecha_vencimiento_membresia) : 0))
  );
}

// Memoizado por request: el layout (bloqueo) y la página (Inicio/Perfil)
// comparten la misma consulta. Las membresías de Blackfit y de Kuntur son
// INDEPENDIENTES: cada una se cuenta solo con los planes de su
// organización (una membresía de Kuntur nunca habilita el entrenamiento
// de Blackfit, ni al revés).
export const obtenerDiasMembresia = cache(
  async (id_usuario: string, organizacion: Organizacion = "blackfit"): Promise<number | null> => {
    const membresias = await prisma.membresia.findMany({
      where: { id_usuario, plan_membresia: { organizacion } },
      select: { estado_membresia: true, fecha_vencimiento_membresia: true },
    });
    return diasMembresiaDe(
      membresias,
      organizacion === "blackfit" ? diasRestantesExactos : diasRestantesMembresia
    );
  }
);

// ------------------------------------------------------------
// Estado de la membresía de ENTRENAMIENTO de Blackfit
// ------------------------------------------------------------

export type EstadoMembresiaBlackfit = "sin_membresia" | "activa" | "vencida" | "suspendida";

export type ResumenMembresiaBlackfit = {
  estado: EstadoMembresiaBlackfit;
  // Días restantes (solo "activa"; 0 en el resto).
  dias: number;
  // Vencimiento de la vigente ("activa"), o de la última en el resto.
  vencimiento: Date | null;
};

type MembresiaParaEstado = {
  estado_membresia: string;
  fecha_vencimiento_membresia: Date;
  fecha_creacion: Date;
};

/**
 * Estado a partir de las membresías de Blackfit de una persona. ÚNICA regla
 * de acceso al entrenamiento (servidor, panel del coach y pantalla del
 * alumno la comparten):
 * - "activa": alguna activa con vencimiento futuro → acceso permitido.
 * - "suspendida": la última operación es una suspensión manual (todavía
 *   dentro de su período) → bloqueado.
 * - "vencida": tuvo membresía pero ninguna vigente → bloqueado.
 * - "sin_membresia": nunca se la activaron → bloqueado.
 * Las "pendiente" no cuentan (nunca se activaron).
 */
export function resumenMembresiaBlackfit(
  membresias: MembresiaParaEstado[],
  ahora: Date = new Date()
): ResumenMembresiaBlackfit {
  const reales = membresias.filter((m) => m.estado_membresia !== "pendiente");
  if (reales.length === 0) return { estado: "sin_membresia", dias: 0, vencimiento: null };

  const vigentes = reales.filter(
    (m) => m.estado_membresia === "activa" && m.fecha_vencimiento_membresia.getTime() > ahora.getTime()
  );
  if (vigentes.length > 0) {
    const vencimiento = new Date(Math.max(...vigentes.map((m) => m.fecha_vencimiento_membresia.getTime())));
    return { estado: "activa", dias: diasRestantesExactos(vencimiento, ahora), vencimiento };
  }

  const ultima = [...reales].sort((a, b) => b.fecha_creacion.getTime() - a.fecha_creacion.getTime())[0];
  const suspendida =
    ultima.estado_membresia === "suspendida" &&
    ultima.fecha_vencimiento_membresia.getTime() > ahora.getTime();
  return {
    estado: suspendida ? "suspendida" : "vencida",
    dias: 0,
    vencimiento: ultima.fecha_vencimiento_membresia,
  };
}

/** Estado de la membresía de entrenamiento (Blackfit), memoizado por request. */
export const obtenerMembresiaBlackfit = cache(
  async (id_usuario: string): Promise<ResumenMembresiaBlackfit> => {
    const membresias = await prisma.membresia.findMany({
      where: { id_usuario, plan_membresia: { organizacion: "blackfit" } },
      select: { estado_membresia: true, fecha_vencimiento_membresia: true, fecha_creacion: true },
    });
    return resumenMembresiaBlackfit(membresias);
  }
);

/** Texto corto del estado para el panel del coach ("25 días", "Vencida"...). */
export function textoEstadoMembresia(r: ResumenMembresiaBlackfit): string {
  if (r.estado === "sin_membresia") return "Sin membresía";
  if (r.estado === "vencida") return "Vencida";
  if (r.estado === "suspendida") return "Suspendida";
  return `${r.dias} día${r.dias === 1 ? "" : "s"}`;
}

/** Plan con el que el coach activa las membresías de Blackfit (se crea una sola vez). */
export async function obtenerPlanBlackfit() {
  return (
    (await prisma.planMembresia.findFirst({
      where: { organizacion: "blackfit" },
      orderBy: { fecha_creacion: "asc" },
    })) ??
    (await prisma.planMembresia.create({
      data: {
        nombre: "Blackfit — Entrenamiento",
        precio: 0,
        duracion_dias: DIAS_MEMBRESIA_SUGERIDOS,
        organizacion: "blackfit",
      },
    }))
  );
}

/**
 * Color del estado, igual en todas las pantallas: más de 7 días verde,
 * 4–7 amarillo, 1–3 naranja, vencida rojo. Clase de texto: los puntos
 * indicadores usan `bg-current` para heredarla.
 */
export function claseColorMembresia(dias: number | null): string {
  if (dias === null) return "text-on-surface-variant";
  if (dias <= 0) return "text-error";
  if (dias <= 3) return "text-[#ff8a3d]";
  if (dias <= 7) return "text-[#eda100]";
  return "text-primary-container";
}

/** Clase de color de un estado de Blackfit (mismos colores que claseColorMembresia). */
export function claseEstadoMembresia(r: ResumenMembresiaBlackfit): string {
  if (r.estado === "sin_membresia") return "text-on-surface-variant";
  if (r.estado === "suspendida") return "text-[#ff8a3d]";
  if (r.estado === "vencida") return "text-error";
  return claseColorMembresia(r.dias);
}

/**
 * La activación/renovación de membresía es manual (el admin la activa
 * desde /admin/usuarios/[id], o el coach con "Activar membresía" desde
 * /coach/alumnos) y la vigencia ya se valida en tiempo real
 * en cada lugar que la consulta (estado === "activa" AND
 * fecha_vencimiento >= hoy — ver src/app/actions/comercio.ts y
 * /panel/beneficios). Lo único que faltaba era avisar ANTES de que
 * venza, para que el alumno/socio la renueve a tiempo.
 *
 * Sin infraestructura de cron: se llama de forma oportunista desde el
 * layout en cada visita autenticada, y usa una notificación existente
 * como "ya avisé esta semana" para no duplicar el aviso en cada request.
 */
export async function verificarRecordatorioMembresia(
  id_usuario: string,
  organizacion: Organizacion = "blackfit"
): Promise<void> {
  const membresia = await prisma.membresia.findFirst({
    where: { id_usuario, estado_membresia: "activa", plan_membresia: { organizacion } },
    orderBy: { fecha_vencimiento_membresia: "desc" },
    include: { plan_membresia: true },
  });
  if (!membresia) return;

  const diasParaVencer =
    organizacion === "blackfit"
      ? diasRestantesExactos(membresia.fecha_vencimiento_membresia)
      : diasRestantesMembresia(membresia.fecha_vencimiento_membresia);
  if (diasParaVencer <= 0 || diasParaVencer > VENTANA_AVISO_DIAS) return;

  const avisoReciente = await prisma.notificacion.findFirst({
    where: {
      id_usuario,
      tipo: `membresia_vencimiento_${organizacion}`,
      fecha_creacion: { gte: new Date(Date.now() - VENTANA_AVISO_DIAS * DIA_MS) },
    },
  });
  if (avisoReciente) return;

  const mensaje =
    diasParaVencer === 1
      ? `Hoy es el último día de tu membresía "${membresia.plan_membresia.nombre}".`
      : `A tu membresía "${membresia.plan_membresia.nombre}" le quedan ${diasParaVencer} días.`;

  await crearNotificacion({
    id_usuario,
    titulo: "Tu membresía está por vencer",
    contenido: mensaje,
    tipo: "membresia_vencimiento",
    url: organizacion === "kuntur" ? "/beneficiario" : "/panel",
  });
}
