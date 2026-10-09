import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Freno a la fuerza bruta (adivinar contraseñas) y a las altas masivas.
// En serverless no sirve un contador en memoria (cada request puede caer
// en otra instancia), así que los intentos se anotan en
// registros_auditoria, que ya tiene índice por (accion, fecha). Nunca se
// guarda el email/DNI ni la IP en claro: solo un hash.

const VENTANA_MS = 15 * 60 * 1000;

function hash(valor: string): string {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex").slice(0, 32);
}

async function ipCliente(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "desconocida"
  );
}

async function contar(accion: string, recurso: string, desde: Date): Promise<number> {
  return prisma.registroAuditoria.count({
    where: { accion, recurso, fecha: { gte: desde } },
  });
}

async function anotar(accion: string, recurso: string): Promise<void> {
  await prisma.registroAuditoria.create({ data: { accion, recurso, resultado: "denegado" } });
}

/** true si hay que frenar el login (demasiados fallos recientes). */
export async function loginBloqueado(identificador: string): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_MS);
  const [porCuenta, porIp] = await Promise.all([
    contar("login_fallido", `id:${hash(identificador)}`, desde),
    contar("login_fallido", `ip:${hash(await ipCliente())}`, desde),
  ]);
  return porCuenta >= 5 || porIp >= 30;
}

export async function registrarLoginFallido(identificador: string): Promise<void> {
  const ip = hash(await ipCliente());
  await Promise.all([
    anotar("login_fallido", `id:${hash(identificador)}`),
    anotar("login_fallido", `ip:${ip}`),
  ]);
}

/** true si esta IP ya creó demasiadas cuentas en la última hora. */
export async function registroBloqueado(): Promise<boolean> {
  const desde = new Date(Date.now() - 4 * VENTANA_MS);
  return (await contar("registro", `ip:${hash(await ipCliente())}`, desde)) >= 5;
}

export async function registrarIntentoRegistro(): Promise<void> {
  await anotar("registro", `ip:${hash(await ipCliente())}`);
}
