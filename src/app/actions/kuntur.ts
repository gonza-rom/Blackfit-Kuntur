"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { obtenerAdminComerciosActual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisar } from "@/lib/aviso";
import { crearNotificacion } from "@/lib/notificaciones";
import { asegurarCredencial } from "@/lib/beneficios";
import { calcularVencimiento30Dias, membresiaVigente } from "@/lib/membresia";
import { loginBloqueado, registrarLoginFallido } from "@/lib/limite-intentos";
import {
  cambiarEmailAuth,
  crearUsuarioAuth,
  emailSinteticoSocio,
  emailTomado,
  establecerContrasena,
  generarCodigoActivacion,
  hashCodigo,
  VIGENCIA_CODIGO_DIAS,
} from "@/lib/cuentas";

// ------------------------------------------------------------
// KUNTUR TRAINING CLUB — socios, sus cuentas y sus membresías.
// Tres cosas independientes: el socio registrado (SocioKuntur), su cuenta
// de acceso activada y su membresía vigente (plan de Kuntur). La gestión
// es de la administración de Kuntur (admin_comercios) o del administrador
// general; nunca del propio socio ni de un comercio.
// ------------------------------------------------------------

export type EstadoKuntur = { error?: string; message?: string; codigo?: string; id_usuario?: string } | undefined;

const DIA_MS = 24 * 60 * 60 * 1000;

function fechaAR(crudo: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(crudo.trim())) return null;
  const d = new Date(`${crudo.trim()}T12:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dniLimpio(crudo: FormDataEntryValue | null): string | null {
  const d = String(crudo ?? "").replace(/\D/g, "");
  return d.length >= 6 && d.length <= 9 ? d : null;
}

function textoOpcional(crudo: FormDataEntryValue | null, max = 200): string | null {
  return String(crudo ?? "").trim().slice(0, max) || null;
}

// ------------------------------------------------------------
// Activación de cuenta por el socio (pública)
// ------------------------------------------------------------

export async function activarCuentaSocio(_prev: EstadoKuntur, formData: FormData): Promise<EstadoKuntur> {
  const dni = dniLimpio(formData.get("dni"));
  const codigo = String(formData.get("codigo") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmPassword") ?? "");

  if (!dni || !codigo) return { error: "Completá tu DNI y el código que te dieron en Kuntur." };
  if (password.length < 8 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { error: "La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número." };
  }
  if (password !== confirmar) return { error: "Las contraseñas no coinciden." };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { error: "Ingresá un email válido (o dejalo vacío)." };
  }

  // Mismo freno que el login contra la fuerza bruta (por DNI e IP).
  const clave = `activacion:${dni}`;
  if (await loginBloqueado(clave).catch(() => false)) {
    return { error: "Demasiados intentos. Esperá 15 minutos y probá de nuevo." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { dni },
    select: { id_usuario: true, email: true, socio_kuntur: true },
  });
  const socio = usuario?.socio_kuntur;
  const valido =
    socio?.codigo_activacion_hash &&
    socio.codigo_activacion_vence &&
    socio.codigo_activacion_vence > new Date() &&
    socio.codigo_activacion_hash === hashCodigo(codigo);
  if (!usuario || !socio || !valido) {
    await registrarLoginFallido(clave).catch(() => {});
    return { error: "DNI o código incorrectos (o el código venció). Pedí uno nuevo en recepción." };
  }

  if (email && email !== usuario.email.toLowerCase() && (await emailTomado(email, usuario.id_usuario))) {
    return {
      error: "Ese email ya pertenece a otra cuenta. Si es tuya, pedí en recepción que la vinculen como socio.",
    };
  }

  await establecerContrasena(usuario.id_usuario, password);
  let emailAcceso = usuario.email;
  if (email && email !== usuario.email.toLowerCase()) {
    await cambiarEmailAuth(usuario.id_usuario, email);
    await prisma.usuario.update({ where: { id_usuario: usuario.id_usuario }, data: { email } });
    emailAcceso = email;
  }
  await prisma.socioKuntur.update({
    where: { id_socio: socio.id_socio },
    data: { cuenta_activada: true, codigo_activacion_hash: null, codigo_activacion_vence: null },
  });
  await registrarAuditoria({
    id_usuario_actor: usuario.id_usuario,
    accion: "activacion_cuenta_socio",
    recurso: "usuario",
    id_recurso: usuario.id_usuario,
    resultado: email ? "con_email" : "con_dni",
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: emailAcceso, password });
  if (error) return { message: "¡Cuenta activada! Ya podés iniciar sesión con tu DNI o email." };
  await avisar("¡Cuenta activada! Bienvenido/a a Kuntur Training Club.");
  redirect("/beneficiario");
}

// ------------------------------------------------------------
// Administración
// ------------------------------------------------------------

async function adminKuntur() {
  return obtenerAdminComerciosActual();
}

async function planesKuntur() {
  return prisma.planMembresia.findMany({
    where: { organizacion: "kuntur" },
    orderBy: { duracion_dias: "asc" },
  });
}

/** Genera (o regenera) el código de activación. Sirve también para "olvidé mi contraseña". */
export async function generarCodigoSocio(_prev: EstadoKuntur, formData: FormData): Promise<EstadoKuntur> {
  const contexto = await adminKuntur();
  if (!contexto) return { error: "No autorizado." };
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const socio = await prisma.socioKuntur.findUnique({ where: { id_usuario }, include: { usuario: { select: { dni: true } } } });
  if (!socio) return { error: "Socio inválido." };
  if (!socio.usuario.dni) return { error: "Cargale el DNI al socio: lo necesita para activar su cuenta." };

  const codigo = generarCodigoActivacion();
  await prisma.socioKuntur.update({
    where: { id_socio: socio.id_socio },
    data: {
      codigo_activacion_hash: hashCodigo(codigo),
      codigo_activacion_vence: new Date(Date.now() + VIGENCIA_CODIGO_DIAS * DIA_MS),
    },
  });
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "codigo_activacion_socio",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: "generado",
  });
  revalidatePath(`/admin/socios/${id_usuario}`);
  return { codigo, message: `Código válido por ${VIGENCIA_CODIGO_DIAS} días. Se muestra una sola vez.` };
}

/**
 * Alta manual de un socio (no hace falta que esté en el Excel ni que ya
 * tenga cuenta). Si su DNI o email ya existen, NO se duplica: se vincula
 * esa cuenta como socio (conserva sus perfiles y membresías de Blackfit).
 */
export async function crearSocio(_prev: EstadoKuntur, formData: FormData): Promise<EstadoKuntur> {
  const contexto = await adminKuntur();
  if (!contexto) return { error: "No autorizado." };

  const nombre = textoOpcional(formData.get("nombre"), 80);
  const apellido = textoOpcional(formData.get("apellido"), 80) ?? "";
  const dni = dniLimpio(formData.get("dni"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const telefono = textoOpcional(formData.get("telefono"), 40);
  const fecha_nacimiento = fechaAR(String(formData.get("fecha_nacimiento") ?? ""));
  const fecha_alta = fechaAR(String(formData.get("fecha_alta") ?? "")) ?? new Date();
  const observaciones = textoOpcional(formData.get("observaciones"), 1000);
  const id_plan = String(formData.get("id_plan_membresia") ?? "");
  const vencimiento = fechaAR(String(formData.get("fecha_vencimiento") ?? ""));
  const estadoMembresia = String(formData.get("estado_membresia") ?? "activa");

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!dni && !email) return { error: "Cargá el DNI o el email: es lo que lo identifica para activar su cuenta." };
  if (String(formData.get("dni") ?? "").trim() && !dni) return { error: "El DNI no es válido." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no es válido." };
  if (!["activa", "suspendida", "pendiente"].includes(estadoMembresia)) return { error: "Estado de membresía inválido." };

  const plan = id_plan ? await prisma.planMembresia.findFirst({ where: { id_plan_membresia: id_plan, organizacion: "kuntur" } }) : null;
  if (id_plan && !plan) return { error: "Elegí un plan de Kuntur." };

  // ¿Ya existe esa persona? (por DNI o email) → se vincula, no se duplica.
  const existente = await prisma.usuario.findFirst({
    where: { OR: [...(dni ? [{ dni }] : []), ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : [])] },
    include: { socio_kuntur: true, roles: true },
  });
  if (existente?.socio_kuntur) {
    return { error: "Esa persona ya es socio de Kuntur.", id_usuario: existente.id_usuario };
  }
  if (existente && dni && existente.dni && existente.dni !== dni) {
    return { error: "Ese email pertenece a otra persona (otro DNI). Revisá los datos." };
  }

  let id_usuario: string;
  let vinculado = false;
  try {
    if (existente) {
      // Cuenta existente (ej. alumno de Blackfit): pasa a ser también socio.
      id_usuario = existente.id_usuario;
      vinculado = true;
      const rol = existente.roles.some((r) => ["alumno", "entrenador"].includes(r.rol)) ? "miembro_kuntur" : "beneficiario";
      await prisma.$transaction([
        prisma.usuarioRol.upsert({
          where: { usuario_rol_unico: { id_usuario, rol } },
          update: {},
          create: { id_usuario, rol },
        }),
        prisma.socioKuntur.create({
          data: { id_usuario, fecha_alta_gimnasio: fecha_alta, fecha_nacimiento, observaciones, cuenta_activada: true },
        }),
        prisma.usuario.update({
          where: { id_usuario },
          data: { ...(dni && !existente.dni ? { dni } : {}), ...(telefono && !existente.telefono ? { telefono } : {}) },
        }),
      ]);
    } else {
      const emailAcceso = email ?? emailSinteticoSocio(dni);
      id_usuario = await crearUsuarioAuth(emailAcceso, { nombre, apellido, dni });
      await prisma.usuario.create({
        data: {
          id_usuario,
          email: emailAcceso,
          dni,
          nombre,
          apellido,
          telefono,
          roles: { create: { rol: "beneficiario" } },
          // Alta administrativa: la persona todavía no eligió su contraseña.
          socio_kuntur: { create: { fecha_alta_gimnasio: fecha_alta, fecha_nacimiento, observaciones, cuenta_activada: false } },
        },
      });
    }
  } catch (e) {
    console.error("[kuntur] crearSocio:", e);
    return { error: "No se pudo crear el socio. Revisá que el DNI y el email no estén usados." };
  }

  if (plan) {
    const inicio = new Date();
    await prisma.membresia.create({
      data: {
        id_usuario,
        id_plan_membresia: plan.id_plan_membresia,
        estado_membresia: estadoMembresia as "activa" | "suspendida" | "pendiente",
        fecha_inicio_membresia: inicio,
        fecha_vencimiento_membresia: vencimiento ?? new Date(calcularVencimiento30Dias(inicio).getTime() + (plan.duracion_dias - 30) * DIA_MS),
      },
    });
  }
  await asegurarCredencial(id_usuario);

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "alta_socio_kuntur",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: vinculado ? "vinculado_cuenta_existente" : "creado",
  });
  await avisar(vinculado ? "La cuenta existente quedó vinculada como socio de Kuntur." : "Socio creado.");
  revalidatePath("/admin/socios");
  redirect(`/admin/socios/${id_usuario}`);
}

export async function editarSocio(_prev: EstadoKuntur, formData: FormData): Promise<EstadoKuntur> {
  const contexto = await adminKuntur();
  if (!contexto) return { error: "No autorizado." };
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const socio = await prisma.socioKuntur.findUnique({ where: { id_usuario } });
  if (!socio) return { error: "Socio inválido." };

  const nombre = textoOpcional(formData.get("nombre"), 80);
  const apellido = textoOpcional(formData.get("apellido"), 80) ?? "";
  const dniCrudo = String(formData.get("dni") ?? "").trim();
  const dni = dniLimpio(dniCrudo);
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (dniCrudo && !dni) return { error: "El DNI no es válido." };
  if (dni) {
    const otro = await prisma.usuario.findFirst({ where: { dni, NOT: { id_usuario } }, select: { id_usuario: true } });
    if (otro) return { error: "Ese DNI ya pertenece a otra persona." };
  }

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id_usuario },
      data: { nombre, apellido, dni, telefono: textoOpcional(formData.get("telefono"), 40) },
    }),
    prisma.socioKuntur.update({
      where: { id_usuario },
      data: {
        fecha_nacimiento: fechaAR(String(formData.get("fecha_nacimiento") ?? "")),
        fecha_alta_gimnasio: fechaAR(String(formData.get("fecha_alta") ?? "")) ?? socio.fecha_alta_gimnasio,
        observaciones: textoOpcional(formData.get("observaciones"), 1000),
      },
    }),
  ]);
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "edicion_socio_kuntur",
    recurso: "usuario",
    id_recurso: id_usuario,
  });
  await avisar("Datos del socio actualizados.");
  revalidatePath(`/admin/socios/${id_usuario}`);
  revalidatePath("/admin/socios");
  return { message: "Datos actualizados." };
}

/**
 * Renovación: un período más del plan elegido. Si la membresía de Kuntur
 * sigue vigente, el nuevo período empieza cuando termina el actual (no
 * pierde días); si venció, desde hoy. La antigüedad NO se reinicia y el
 * historial queda completo. No toca nada de Blackfit.
 */
export async function renovarMembresiaSocio(formData: FormData): Promise<void> {
  const contexto = await adminKuntur();
  if (!contexto) return;
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const id_plan = String(formData.get("id_plan_membresia") ?? "");
  const [socio, plan] = await Promise.all([
    prisma.socioKuntur.findUnique({ where: { id_usuario }, select: { id_socio: true } }),
    prisma.planMembresia.findFirst({ where: { id_plan_membresia: id_plan, organizacion: "kuntur" } }),
  ]);
  if (!socio || !plan) return;

  const ahora = new Date();
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membresia_kuntur:${id_usuario}`}))`;
    const reciente = await tx.membresia.findFirst({
      where: { id_usuario, plan_membresia: { organizacion: "kuntur" }, fecha_creacion: { gte: new Date(ahora.getTime() - 2 * 60 * 1000) } },
    });
    if (reciente) return "duplicada" as const;
    const vigentes = (
      await tx.membresia.findMany({
        where: { id_usuario, estado_membresia: "activa", plan_membresia: { organizacion: "kuntur" } },
      })
    ).filter(membresiaVigente);
    const fin = vigentes.length ? new Date(Math.max(...vigentes.map((m) => m.fecha_vencimiento_membresia.getTime()))) : null;
    const inicio = fin ?? ahora;
    const vence = fin
      ? new Date(fin.getTime() + plan.duracion_dias * DIA_MS)
      : new Date(calcularVencimiento30Dias(ahora).getTime() + (plan.duracion_dias - 30) * DIA_MS);
    await tx.membresia.updateMany({
      where: { id_usuario, estado_membresia: "activa", fecha_vencimiento_membresia: { lte: ahora }, plan_membresia: { organizacion: "kuntur" } },
      data: { estado_membresia: "vencida" },
    });
    await tx.membresia.create({
      data: { id_usuario, id_plan_membresia: plan.id_plan_membresia, estado_membresia: "activa", fecha_inicio_membresia: inicio, fecha_vencimiento_membresia: vence },
    });
    return "ok" as const;
  });

  if (resultado === "duplicada") {
    await avisar("La membresía ya se renovó recién. No se sumó otro período.", "info");
  } else {
    await registrarAuditoria({
      id_usuario_actor: contexto.usuario.id_usuario,
      accion: "renovacion_membresia_kuntur",
      recurso: "usuario",
      id_recurso: id_usuario,
      resultado: plan.nombre,
    });
    await crearNotificacion({
      id_usuario,
      titulo: "Membresía Kuntur renovada",
      contenido: `Se renovó tu plan ${plan.nombre}.`,
      tipo: "membresia_kuntur",
      url: "/beneficiario",
    }).catch(() => {});
    await avisar(`Membresía renovada: ${plan.nombre}.`);
  }
  revalidatePath(`/admin/socios/${id_usuario}`);
  revalidatePath("/admin/socios");
}

/** Suspender, reactivar o dar de baja la membresía Kuntur actual (no toca Blackfit). */
export async function cambiarEstadoSocio(formData: FormData): Promise<void> {
  const contexto = await adminKuntur();
  if (!contexto) return;
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!["activa", "suspendida", "cancelada"].includes(estado)) return;
  const actual = await prisma.membresia.findFirst({
    where: { id_usuario, plan_membresia: { organizacion: "kuntur" } },
    orderBy: { fecha_vencimiento_membresia: "desc" },
  });
  if (!actual) return;
  await prisma.membresia.update({
    where: { id_membresia: actual.id_membresia },
    data: { estado_membresia: estado as "activa" | "suspendida" | "cancelada" },
  });
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "estado_membresia_kuntur",
    recurso: "membresia",
    id_recurso: actual.id_membresia,
    resultado: estado,
  });
  await avisar(estado === "activa" ? "Membresía reactivada." : estado === "suspendida" ? "Membresía suspendida." : "Socio dado de baja.", "info");
  revalidatePath(`/admin/socios/${id_usuario}`);
  revalidatePath("/admin/socios");
}

/**
 * Corrección de una cuenta que se registró para Kuntur pero quedó como
 * alumno de Blackfit (el registro viejo mandaba a todos a Blackfit). Solo
 * si NO tiene nada de entrenamiento (sin coach, sin entrenamientos, sin
 * membresía Blackfit): se le quita el perfil de alumno vacío y queda como
 * socio. Conserva su cuenta, credenciales y datos personales.
 */
export async function pasarCuentaAKuntur(_prev: EstadoKuntur, formData: FormData): Promise<EstadoKuntur> {
  const contexto = await adminKuntur();
  if (!contexto) return { error: "No autorizado." };
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const dni = dniLimpio(formData.get("dni"));

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario },
    include: {
      roles: true,
      socio_kuntur: true,
      alumno: { include: { _count: { select: { relaciones: true, entrenamientos: true, programas: true } } } },
      _count: { select: { membresias: { where: { plan_membresia: { organizacion: "blackfit" } } } } },
    },
  });
  if (!usuario) return { error: "Usuario inválido." };
  if (usuario.socio_kuntur) return { error: "Ya es socio de Kuntur." };
  const a = usuario.alumno?._count;
  if (a && (a.relaciones || a.entrenamientos || a.programas || usuario._count.membresias)) {
    return {
      error:
        "Esta cuenta tiene actividad de Blackfit (coach, entrenamientos o membresía): no se mueve. Vinculala como socio desde \"Agregar socio\" con su email, así conserva los dos servicios.",
    };
  }
  if (dni) {
    const otro = await prisma.usuario.findFirst({ where: { dni, NOT: { id_usuario } }, select: { id_usuario: true } });
    if (otro) {
      return { error: "Ese DNI ya pertenece a otro socio (por ejemplo, importado del Excel). Usá \"Unir con socio existente\"." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuarioRol.deleteMany({ where: { id_usuario, rol: "alumno" } });
    if (usuario.alumno) await tx.alumno.delete({ where: { id_alumno: usuario.alumno.id_alumno } });
    await tx.usuarioRol.upsert({
      where: { usuario_rol_unico: { id_usuario, rol: "beneficiario" } },
      update: {},
      create: { id_usuario, rol: "beneficiario" },
    });
    await tx.socioKuntur.create({ data: { id_usuario, fecha_alta_gimnasio: usuario.fecha_creacion, cuenta_activada: true } });
    if (dni && !usuario.dni) await tx.usuario.update({ where: { id_usuario }, data: { dni } });
  });
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "correccion_cuenta_a_kuntur",
    recurso: "usuario",
    id_recurso: id_usuario,
  });
  await avisar("Cuenta corregida: ahora entra a Kuntur Training Club.");
  revalidatePath("/admin/socios");
  redirect(`/admin/socios/${id_usuario}`);
}

/**
 * La persona tiene DOS registros: su cuenta real (se registró sola) y el
 * socio importado del Excel (mismo DNI, sin acceso). Se unen en la cuenta
 * real: pasan a ella la ficha de socio, las membresías de Kuntur, la
 * credencial y las validaciones; el registro importado (sin cuenta usable)
 * se elimina. Así no quedan perfiles duplicados.
 */
export async function unirConSocioImportado(_prev: EstadoKuntur, formData: FormData): Promise<EstadoKuntur> {
  const contexto = await adminKuntur();
  if (!contexto) return { error: "No autorizado." };
  const id_cuenta = String(formData.get("id_usuario") ?? "");
  const dni = dniLimpio(formData.get("dni"));
  if (!dni) return { error: "Ingresá el DNI del socio importado." };

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
  if (!cuenta || !importado || importado.id_usuario === id_cuenta) return { error: "No se encontró otro socio con ese DNI." };
  if (!importado.email.endsWith("@beneficiario.blackhub.local") || importado.socio_kuntur?.cuenta_activada) {
    return { error: "Ese socio ya tiene una cuenta propia activada: no se puede unir automáticamente." };
  }
  if (importado.roles.some((r) => r.rol !== "beneficiario")) {
    return { error: "El registro importado tiene otros roles: revisalo a mano." };
  }

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
    await tx.usuarioRol.upsert({
      where: { usuario_rol_unico: { id_usuario: id_cuenta, rol: "beneficiario" } },
      update: {},
      create: { id_usuario: id_cuenta, rol: "beneficiario" },
    });
    // Si la cuenta real había quedado como alumno de Blackfit SIN actividad
    // (el registro viejo), se quita ese perfil vacío: ahora es socio.
    const a = cuenta.alumno?._count;
    if (cuenta.alumno && a && !a.relaciones && !a.entrenamientos && !a.programas && !cuenta._count.membresias) {
      await tx.usuarioRol.deleteMany({ where: { id_usuario: id_cuenta, rol: "alumno" } });
      await tx.alumno.delete({ where: { id_alumno: cuenta.alumno.id_alumno } });
    }
    await tx.usuario.delete({ where: { id_usuario: de } });
    await tx.$executeRaw`delete from auth.users where id::text = ${de}`;
  });
  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "union_socio_importado",
    recurso: "usuario",
    id_recurso: id_cuenta,
    resultado: `dni:${dni}`,
  });
  await avisar("Registros unidos: la cuenta quedó como socio con su historial.");
  revalidatePath("/admin/socios");
  redirect(`/admin/socios/${id_cuenta}`);
}

export async function listarPlanesKuntur() {
  if (!(await adminKuntur())) return [];
  return planesKuntur();
}
