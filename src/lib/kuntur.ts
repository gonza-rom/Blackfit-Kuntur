import { prisma } from "@/lib/prisma";
import { obtenerDiasMembresia, calcularVencimiento30Dias } from "@/lib/membresia";

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
    // La última OPERACIÓN (alta, renovación, baja) manda sobre el estado.
    prisma.membresia.findFirst({
      where: { id_usuario, plan_membresia: { organizacion: "kuntur" } },
      orderBy: { fecha_creacion: "desc" },
      include: { plan_membresia: { select: { nombre: true, duracion_dias: true } } },
    }),
    obtenerDiasMembresia(id_usuario, "kuntur"),
    prisma.usuario.findUnique({ where: { id_usuario }, select: { fecha_creacion: true } }),
  ]);

  let estado: EstadoSocio = "sin_membresia";
  if ((dias ?? 0) > 0) estado = "vigente";
  else if (membresia?.estado_membresia === "suspendida") estado = "suspendida";
  else if (membresia?.estado_membresia === "cancelada") estado = "baja";
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

// ------------------------------------------------------------
// Altas de socios: 30 días de membresía y unión con el padrón (Excel)
// ------------------------------------------------------------

export const DIAS_ALTA_SOCIO = 30;

/**
 * Plan de 30 días de Kuntur. El alta propia usa el plan sin costo
 * ("Kuntur — Beneficiario") si existe; la administración, el mensual.
 * Si no hay ninguno de 30 días, se crea el que corresponde.
 */
export async function planKunturDe30Dias(gratuito: boolean) {
  const planes = await prisma.planMembresia.findMany({
    where: { organizacion: "kuntur", duracion_dias: DIAS_ALTA_SOCIO },
    orderBy: { fecha_creacion: "asc" },
  });
  const elegido =
    planes.find((p) => (gratuito ? Number(p.precio) === 0 : Number(p.precio) > 0)) ?? planes[0];
  if (elegido) return elegido;
  return prisma.planMembresia.create({
    data: {
      nombre: gratuito ? "Kuntur — Beneficiario" : "Kuntur Mensual",
      precio: 0,
      duracion_dias: DIAS_ALTA_SOCIO,
      organizacion: "kuntur",
    },
  });
}

/**
 * 30 días de membresía Kuntur desde hoy para quien NO tiene una vigente
 * (alta de un socio nuevo). Si ya tiene una vigente no hace nada: nunca
 * pisa ni acorta un período. Devuelve true si creó la membresía.
 */
export async function otorgarAltaKunturSiNoTiene(id_usuario: string, gratuito = true): Promise<boolean> {
  const ahora = new Date();
  const plan = await planKunturDe30Dias(gratuito);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membresia_kuntur:${id_usuario}`}))`;
    const vigente = await tx.membresia.findFirst({
      where: {
        id_usuario,
        estado_membresia: "activa",
        fecha_vencimiento_membresia: { gt: ahora },
        plan_membresia: { organizacion: "kuntur" },
      },
      select: { id_membresia: true },
    });
    if (vigente) return false;
    await tx.membresia.create({
      data: {
        id_usuario,
        id_plan_membresia: plan.id_plan_membresia,
        estado_membresia: "activa",
        fecha_inicio_membresia: ahora,
        fecha_vencimiento_membresia: calcularVencimiento30Dias(ahora),
      },
    });
    return true;
  });
}

function normalizarNombre(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-zñ]+/)
    .filter((t) => t.length >= 3);
}

/**
 * ¿El apellido que escribió la persona coincide con el del padrón? Basta
 * una palabra en común (sin tildes ni mayúsculas): "Pérez" ↔ "PEREZ GARCIA".
 * Es la comprobación para reclamar una ficha del Excel sin código.
 */
export function apellidoCoincide(escrito: string, padron: string): boolean {
  const a = new Set(normalizarNombre(escrito));
  return normalizarNombre(padron).some((t) => a.has(t));
}

/** Socio cargado desde el Excel / por la administración que todavía no activó su cuenta. */
export function esFichaSinReclamar(u: {
  email: string;
  socio_kuntur: { cuenta_activada: boolean } | null;
  roles: { rol: string }[];
}): boolean {
  return (
    u.email.endsWith("@beneficiario.blackhub.local") &&
    Boolean(u.socio_kuntur) &&
    !u.socio_kuntur!.cuenta_activada &&
    u.roles.every((r) => r.rol === "beneficiario")
  );
}

/**
 * Une una cuenta real con el socio importado del Excel (mismo DNI, sin
 * acceso propio): pasan a la cuenta real la ficha, las membresías de
 * Kuntur, la credencial y las validaciones, y el registro importado se
 * elimina. Así no quedan perfiles duplicados. Devuelve un error o null.
 */
export async function unirCuentaConImportado(id_cuenta: string, dni: string): Promise<string | null> {
  const [cuenta, importado] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id_usuario: id_cuenta },
      include: {
        socio_kuntur: true,
        credencial: true,
        roles: true,
        alumno: { include: { _count: { select: { relaciones: true, entrenamientos: true, programas: true } } } },
        _count: { select: { membresias: { where: { plan_membresia: { organizacion: "blackfit" } } } } },
      },
    }),
    prisma.usuario.findUnique({ where: { dni }, include: { socio_kuntur: true, credencial: true, roles: true } }),
  ]);
  if (!cuenta || !importado || importado.id_usuario === id_cuenta) return "No se encontró otro socio con ese DNI.";
  if (!esFichaSinReclamar(importado)) {
    return "Ese socio ya tiene una cuenta propia activada: no se puede unir automáticamente.";
  }

  const usaBlackfit = cuenta.roles.some((r) => r.rol === "alumno" || r.rol === "entrenador");
  const a = cuenta.alumno?._count;
  const alumnoVacio =
    cuenta.alumno && a && !a.relaciones && !a.entrenamientos && !a.programas && !cuenta._count.membresias;

  await prisma.$transaction(async (tx) => {
    const de = importado.id_usuario;
    await tx.membresia.updateMany({ where: { id_usuario: de }, data: { id_usuario: id_cuenta } });
    await tx.validacionBeneficio.updateMany({ where: { id_usuario: de }, data: { id_usuario: id_cuenta } });
    if (importado.credencial && !cuenta.credencial) {
      await tx.credencial.update({ where: { id_usuario: de }, data: { id_usuario: id_cuenta } });
    }
    const ficha = importado.socio_kuntur;
    await tx.usuario.update({ where: { id_usuario: de }, data: { dni: null } });
    await tx.usuario.update({ where: { id_usuario: id_cuenta }, data: { dni } });
    if (!cuenta.socio_kuntur) {
      await tx.socioKuntur.create({
        data: {
          id_usuario: id_cuenta,
          fecha_alta_gimnasio: ficha?.fecha_alta_gimnasio ?? cuenta.fecha_creacion,
          fecha_nacimiento: ficha?.fecha_nacimiento,
          observaciones: ficha?.observaciones,
          cuenta_activada: true,
        },
      });
    }
    // Si la cuenta real había quedado como alumno de Blackfit SIN actividad
    // (el registro viejo), se quita ese perfil vacío: ahora es socio.
    if (alumnoVacio) {
      await tx.usuarioRol.deleteMany({ where: { id_usuario: id_cuenta, rol: "alumno" } });
      await tx.alumno.delete({ where: { id_alumno: cuenta.alumno!.id_alumno } });
    }
    const rol = usaBlackfit && !alumnoVacio ? "miembro_kuntur" : "beneficiario";
    await tx.usuarioRol.upsert({
      where: { usuario_rol_unico: { id_usuario: id_cuenta, rol } },
      update: {},
      create: { id_usuario: id_cuenta, rol },
    });
    await tx.usuario.delete({ where: { id_usuario: de } });
    await tx.$executeRaw`delete from auth.users where id::text = ${de}`;
  });
  return null;
}
