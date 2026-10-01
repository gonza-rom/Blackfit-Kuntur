import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { crearNotificacion } from "@/lib/notificaciones";

const DIA_MS = 1000 * 60 * 60 * 24;
const VENTANA_AVISO_DIAS = 5;

// Lo que el coach activa con un clic desde /coach/alumnos. Siempre 30
// días corridos desde el día de activación — no "un mes calendario".
export const DIAS_MEMBRESIA_COACH = 30;

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
 */
export function calcularVencimiento30Dias(ahora: Date = new Date()): Date {
  const inicioHoy = medianocheAR(claveDiaAR(ahora.getTime()));
  return new Date(inicioHoy + DIAS_MEMBRESIA_COACH * DIA_MS);
}

/**
 * Días de acceso que le quedan, contando hoy: el día de activación da 30,
 * el siguiente 29, … el último día 1. 0 = vencida.
 */
export function diasRestantesMembresia(vencimiento: Date, ahora: Date = new Date()): number {
  if (vencimiento.getTime() <= ahora.getTime()) return 0;
  const ultimoDia = medianocheAR(claveDiaAR(vencimiento.getTime() - 1));
  const hoy = medianocheAR(claveDiaAR(ahora.getTime()));
  return Math.round((ultimoDia - hoy) / DIA_MS) + 1;
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
  membresias: { estado_membresia: string; fecha_vencimiento_membresia: Date }[]
): number | null {
  if (membresias.length === 0) return null;
  return Math.max(
    0,
    ...membresias.map((m) =>
      membresiaVigente(m) ? diasRestantesMembresia(m.fecha_vencimiento_membresia) : 0
    )
  );
}

// Memoizado por request: el layout (bloqueo) y la página (Inicio/Perfil)
// comparten la misma consulta.
export const obtenerDiasMembresia = cache(async (id_usuario: string): Promise<number | null> => {
  const membresias = await prisma.membresia.findMany({
    where: { id_usuario },
    select: { estado_membresia: true, fecha_vencimiento_membresia: true },
  });
  return diasMembresiaDe(membresias);
});

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

/**
 * Estado de membresía de un usuario para el acceso a la plataforma:
 * - "sin_membresia": nunca tuvo una (no se bloquea: así nadie queda
 *   afuera de golpe por un alumno que todavía no se dio de alta).
 * - "vigente": tiene una activa con días restantes.
 * - "vencida": tuvo, pero ya no tiene ninguna vigente → acceso bloqueado.
 */
export async function estadoAccesoMembresia(
  id_usuario: string
): Promise<"sin_membresia" | "vigente" | "vencida"> {
  const dias = await obtenerDiasMembresia(id_usuario);
  if (dias === null) return "sin_membresia";
  return dias > 0 ? "vigente" : "vencida";
}

/**
 * La activación/renovación de membresía es manual (el admin la activa
 * desde /admin/usuarios/[id], o el coach con "Activar 30 días" desde
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
export async function verificarRecordatorioMembresia(id_usuario: string): Promise<void> {
  const membresia = await prisma.membresia.findFirst({
    where: { id_usuario, estado_membresia: "activa" },
    orderBy: { fecha_vencimiento_membresia: "desc" },
    include: { plan_membresia: true },
  });
  if (!membresia) return;

  const diasParaVencer = diasRestantesMembresia(membresia.fecha_vencimiento_membresia);
  if (diasParaVencer <= 0 || diasParaVencer > VENTANA_AVISO_DIAS) return;

  const avisoReciente = await prisma.notificacion.findFirst({
    where: {
      id_usuario,
      tipo: "membresia_vencimiento",
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
    url: "/panel/beneficios",
  });
}
