"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import type {
  RolUsuario,
  EstadoUsuario,
  EstadoMembresia,
  EstadoComercio,
  EstadoBeneficio,
} from "@prisma/client";
import { TAG_CATALOGO_PLANES } from "@/lib/catalogos";
import { prisma } from "@/lib/prisma";
import {
  obtenerUsuarioActual,
  obtenerAdminComerciosActual,
  obtenerAdminBlackfitActual,
  tieneRol,
  ROLES_DOMINIO_COMERCIOS,
  ROLES_DOMINIO_BLACKFIT,
  ROLES_ADMIN,
  type UsuarioActual,
} from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { otorgarLogrosManualesIniciales } from "@/lib/gamificacion";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailSinteticoBeneficiario,
  type FilaBeneficiarioParseada,
} from "@/lib/importarBeneficiarios";

export type EstadoAdmin = { error?: string; message?: string } | undefined;

const ROLES_ASIGNABLES: RolUsuario[] = [
  "alumno",
  "entrenador",
  "miembro_kuntur",
  "beneficiario",
  "administrador",
  "admin_comercios",
  "admin_blackfit",
];

const ESTADOS_USUARIO: EstadoUsuario[] = ["activo", "inactivo", "suspendido"];

const ESTADOS_MEMBRESIA: EstadoMembresia[] = [
  "activa",
  "vencida",
  "cancelada",
  "suspendida",
  "pendiente",
];

const ESTADOS_COMERCIO: EstadoComercio[] = ["activo", "inactivo"];
const ESTADOS_BENEFICIO: EstadoBeneficio[] = ["activo", "inactivo", "vencido"];

// Número de socio legible, ej. "K-000123". No es criptográficamente
// robusto ante alta concurrencia, pero alcanza para el volumen de un
// gimnasio/comunidad — el identificador que realmente protege el acceso
// a Benefits es el `codigo_qr_token` (uuid) embebido en el QR.
async function generarNumeroSocio(): Promise<string> {
  const total = await prisma.credencial.count();
  return `K-${String(total + 1).padStart(6, "0")}`;
}

// Autorización para acciones que operan sobre UN usuario puntual ya
// existente (editar, eliminar, cambiar estado, gestionar sus membresías):
// el admin general entra siempre; un admin recortado (comercios/black
// fit) solo si el usuario objetivo tiene al menos un rol de su dominio.
// Sin este chequeo, un admin recortado podría mandar el id_usuario de
// alguien fuera de lo que ve en /admin/usuarios a mano y gestionarlo
// igual — la UI ya lo esconde, pero la acción tiene que revalidarlo.
async function autorizarSobreUsuario(
  id_usuario: string
): Promise<{ usuario: UsuarioActual } | null> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return null;
  if (tieneRol(usuario, "administrador")) return { usuario };

  const puedeComercios = tieneRol(usuario, "admin_comercios");
  const puedeBlackfit = tieneRol(usuario, "admin_blackfit");
  if (!puedeComercios && !puedeBlackfit) return null;

  const objetivo = await prisma.usuario.findUnique({
    where: { id_usuario },
    include: { roles: true },
  });
  if (!objetivo) return null;

  const rolesObjetivo = objetivo.roles.map((r) => r.rol);
  const enDominio =
    (puedeComercios && rolesObjetivo.some((r) => ROLES_DOMINIO_COMERCIOS.includes(r))) ||
    (puedeBlackfit && rolesObjetivo.some((r) => ROLES_DOMINIO_BLACKFIT.includes(r)));

  return enDominio ? { usuario } : null;
}

export async function asignarRol(formData: FormData): Promise<void> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const esGeneral = tieneRol(usuario, "administrador");
  const puedeComercios = esGeneral || tieneRol(usuario, "admin_comercios");
  const puedeBlackfit = esGeneral || tieneRol(usuario, "admin_blackfit");
  if (!esGeneral && !puedeComercios && !puedeBlackfit) return;

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const rol = String(formData.get("rol") ?? "") as RolUsuario;

  if (!id_usuario || !ROLES_ASIGNABLES.includes(rol)) {
    return;
  }

  // Roles de administración: solo el admin general los toca. Fuera de
  // eso, cada admin recortado solo puede asignar roles de su dominio.
  if (ROLES_ADMIN.includes(rol) && !esGeneral) return;
  if (
    !esGeneral &&
    !(puedeComercios && ROLES_DOMINIO_COMERCIOS.includes(rol)) &&
    !(puedeBlackfit && ROLES_DOMINIO_BLACKFIT.includes(rol))
  ) {
    return;
  }

  const contexto = { usuario };

  const existente = await prisma.usuarioRol.findUnique({
    where: { usuario_rol_unico: { id_usuario, rol } },
  });

  if (!existente) {
    await prisma.usuarioRol.create({ data: { id_usuario, rol } });

    if (rol === "alumno") {
      const alumno = await prisma.alumno.upsert({
        where: { id_usuario },
        update: {},
        create: { id_usuario },
      });
      // Arranca con todos los logros manuales de la biblioteca — ver
      // otorgarLogrosManualesIniciales en lib/gamificacion.ts. Idempotente
      // (skipDuplicates), así que no importa si ya los tenía.
      await otorgarLogrosManualesIniciales(alumno.id_alumno);
    }
    if (rol === "entrenador") {
      await prisma.entrenador.upsert({
        where: { id_usuario },
        update: {},
        create: { id_usuario },
      });
    }
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_rol",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `asignado:${rol}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
}

export async function quitarRol(formData: FormData): Promise<void> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return;

  const esGeneral = tieneRol(usuario, "administrador");
  const puedeComercios = esGeneral || tieneRol(usuario, "admin_comercios");
  const puedeBlackfit = esGeneral || tieneRol(usuario, "admin_blackfit");
  if (!esGeneral && !puedeComercios && !puedeBlackfit) return;

  const id_usuario = String(formData.get("id_usuario") ?? "");
  const rol = String(formData.get("rol") ?? "") as RolUsuario;

  if (!id_usuario || !ROLES_ASIGNABLES.includes(rol)) {
    return;
  }

  if (ROLES_ADMIN.includes(rol) && !esGeneral) return;
  if (
    !esGeneral &&
    !(puedeComercios && ROLES_DOMINIO_COMERCIOS.includes(rol)) &&
    !(puedeBlackfit && ROLES_DOMINIO_BLACKFIT.includes(rol))
  ) {
    return;
  }

  const contexto = { usuario };

  await prisma.usuarioRol.deleteMany({ where: { id_usuario, rol } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_rol",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `quitado:${rol}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
}

// Baja "blanda" de un usuario: cambia estado_usuario a inactivo/suspendido
// sin borrar nada. Un usuario que no esté "activo" no puede iniciar sesión
// (ver iniciarSesion en actions/auth.ts) y es expulsado de cualquier
// sección protegida (ver cuentaActiva() usado en los layouts).
export async function cambiarEstadoUsuario(formData: FormData): Promise<void> {
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const estado_usuario = String(formData.get("estado_usuario") ?? "") as EstadoUsuario;

  if (!id_usuario || !ESTADOS_USUARIO.includes(estado_usuario)) return;

  const contexto = await autorizarSobreUsuario(id_usuario);
  if (!contexto) return;
  // Un admin no puede desactivarse a sí mismo (se quedaría sin poder
  // volver a entrar para revertirlo).
  if (id_usuario === contexto.usuario.id_usuario) return;

  await prisma.usuario.update({
    where: { id_usuario },
    data: { estado_usuario },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_estado_usuario",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: estado_usuario,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
  revalidatePath("/admin/usuarios");
}

// Postgres valida las FK con ON DELETE NO ACTION (el default de Prisma
// cuando no se declara onDelete) al final del statement, dentro de la
// misma transacción implícita del delete/cascada — si algo choca, el
// borrado completo se revierte solo. Por eso alcanza con intentarlo y
// capturar P2003 en vez de contar a mano cada tabla que podría bloquearlo.
function esErrorDeIntegridadReferencial(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003"
  );
}

// Edición de los datos personales del usuario. El email también es el
// login (auth.uid() de Supabase Auth se resuelve por email en signIn), así
// que si cambia hay que sincronizarlo en Supabase Auth antes de tocar
// nuestra tabla — si esa sincronización falla, no se guarda nada acá.
export async function editarUsuario(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const dni = String(formData.get("dni") ?? "").trim() || null;

  if (!id_usuario || !nombre || !apellido || !email) {
    return { error: "Completá nombre, apellido y email." };
  }

  const contexto = await autorizarSobreUsuario(id_usuario);
  if (!contexto) return { error: "No autorizado." };

  const usuarioActual = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuarioActual) return { error: "Usuario inválido." };

  if (email !== usuarioActual.email) {
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id_usuario, { email });
    if (error) {
      return { error: `No se pudo actualizar el email en Supabase Auth: ${error.message}` };
    }
  }

  try {
    await prisma.usuario.update({
      where: { id_usuario },
      data: { nombre, apellido, email, telefono, dni },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Ese email o DNI ya lo usa otro usuario." };
    }
    throw err;
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "modificacion_admin",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `editado:${email}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios/${id_usuario}`);
}

// Borrado definitivo. Para la gran mayoría de los casos conviene
// cambiarEstadoUsuario a "suspendido" (no destruye nada e igual bloquea el
// acceso) — esto queda para cuentas cargadas por error, sin historial real.
// Si el usuario tiene membresías, mensajes, validaciones u otro historial
// con integridad referencial (ON DELETE NO ACTION), Postgres rechaza el
// borrado completo y no se pierde nada.
export async function eliminarUsuario(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const id_usuario = String(formData.get("id_usuario") ?? "");
  if (!id_usuario) return { error: "Usuario inválido." };

  const contexto = await autorizarSobreUsuario(id_usuario);
  if (!contexto) return { error: "No autorizado." };
  if (id_usuario === contexto.usuario.id_usuario) {
    return { error: "No podés eliminar tu propia cuenta de administrador." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
  if (!usuario) return { error: "Usuario inválido." };

  try {
    await prisma.usuario.delete({ where: { id_usuario } });
  } catch (err) {
    if (esErrorDeIntegridadReferencial(err)) {
      return {
        error:
          "No se puede eliminar: tiene membresías, mensajes, validaciones u otro historial asociado. Usá el estado \"Suspendido\" en vez de eliminarlo.",
      };
    }
    throw err;
  }

  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.auth.admin.deleteUser(id_usuario).catch(() => {});

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "eliminacion_admin",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `eliminado:${usuario.email}`,
  });

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function editarMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const id_membresia = String(formData.get("id_membresia") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");
  const fecha_vencimientoRaw = String(formData.get("fecha_vencimiento") ?? "");

  if (!id_membresia || !id_plan_membresia || !fecha_inicioRaw || !fecha_vencimientoRaw) {
    return { error: "Completá plan, fecha de inicio y de vencimiento." };
  }

  const membresiaActual = await prisma.membresia.findUnique({ where: { id_membresia } });
  if (!membresiaActual) return { error: "Membresía inválida." };

  const contexto = await autorizarSobreUsuario(membresiaActual.id_usuario);
  if (!contexto) return { error: "No autorizado." };

  const plan = await prisma.planMembresia.findUnique({ where: { id_plan_membresia } });
  if (!plan) return { error: "Plan inválido." };

  const membresia = await prisma.membresia.update({
    where: { id_membresia },
    data: {
      id_plan_membresia,
      fecha_inicio_membresia: new Date(fecha_inicioRaw),
      fecha_vencimiento_membresia: new Date(fecha_vencimientoRaw),
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: id_membresia,
    resultado: `editada:${plan.nombre}`,
  });

  revalidatePath(`/admin/usuarios/${membresia.id_usuario}`);
  redirect(`/admin/usuarios/${membresia.id_usuario}`);
}

// Borra el registro de una membresía puntual (ej. una activación hecha por
// error). No toca la credencial digital: si el usuario tiene otras
// membresías, sigue necesitándola.
export async function eliminarMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const id_membresia = String(formData.get("id_membresia") ?? "");
  if (!id_membresia) return { error: "Membresía inválida." };

  const membresia = await prisma.membresia.findUnique({ where: { id_membresia } });
  if (!membresia) return { error: "Membresía inválida." };

  const contexto = await autorizarSobreUsuario(membresia.id_usuario);
  if (!contexto) return { error: "No autorizado." };

  await prisma.membresia.delete({ where: { id_membresia } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: id_membresia,
    resultado: "eliminada",
  });

  revalidatePath(`/admin/usuarios/${membresia.id_usuario}`);
  redirect(`/admin/usuarios/${membresia.id_usuario}`);
}

export async function crearPlanMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminBlackfitActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = String(formData.get("precio") ?? "").trim();
  const duracion_diasRaw = String(formData.get("duracion_dias") ?? "").trim();

  if (!nombre || !precio || !duracion_diasRaw) {
    return { error: "Completá nombre, precio y duración." };
  }

  await prisma.planMembresia.create({
    data: {
      nombre,
      descripcion,
      precio,
      duracion_dias: Number(duracion_diasRaw),
    },
  });

  updateTag(TAG_CATALOGO_PLANES);
  redirect("/admin/planes");
}

export async function editarPlanMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminBlackfitActual();
  if (!contexto) return { error: "No autorizado." };

  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = String(formData.get("precio") ?? "").trim();
  const duracion_diasRaw = String(formData.get("duracion_dias") ?? "").trim();

  if (!id_plan_membresia || !nombre || !precio || !duracion_diasRaw) {
    return { error: "Completá nombre, precio y duración." };
  }

  await prisma.planMembresia.update({
    where: { id_plan_membresia },
    data: { nombre, descripcion, precio, duracion_dias: Number(duracion_diasRaw) },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "modificacion_admin",
    recurso: "plan_membresia",
    id_recurso: id_plan_membresia,
    resultado: `editado:${nombre}`,
  });

  updateTag(TAG_CATALOGO_PLANES);
  revalidatePath(`/admin/planes/${id_plan_membresia}`);
  redirect("/admin/planes");
}

// Un plan nunca se borra si alguna vez tuvo una membresía real asociada
// — eso destruiría el historial de esa membresía (activa o vencida). Las
// asociaciones a beneficios (beneficios_planes) sí se limpian solas: son
// solo el mapeo "vivo" de qué beneficio aplica a qué plan, no un registro
// histórico.
export async function eliminarPlanMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminBlackfitActual();
  if (!contexto) return { error: "No autorizado." };

  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  if (!id_plan_membresia) return { error: "Plan inválido." };

  const plan = await prisma.planMembresia.findUnique({
    where: { id_plan_membresia },
    include: { _count: { select: { membresias: true } } },
  });
  if (!plan) return { error: "Plan inválido." };

  if (plan._count.membresias > 0) {
    return {
      error: `No se puede eliminar: ${plan._count.membresias} membresía(s) ya usaron este plan. Editalo si hace falta corregirlo, o dejá de ofrecerlo desde /admin/planes en vez de borrarlo.`,
    };
  }

  await prisma.$transaction([
    prisma.beneficioPlan.deleteMany({ where: { id_plan_membresia } }),
    prisma.planMembresia.delete({ where: { id_plan_membresia } }),
  ]);

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "modificacion_admin",
    recurso: "plan_membresia",
    id_recurso: id_plan_membresia,
    resultado: `eliminado:${plan.nombre}`,
  });

  updateTag(TAG_CATALOGO_PLANES);
  redirect("/admin/planes");
}

export async function activarMembresia(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const id_usuario = String(formData.get("id_usuario") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");

  if (!id_usuario || !id_plan_membresia) {
    return { error: "Elegí un plan." };
  }

  const contexto = await autorizarSobreUsuario(id_usuario);
  if (!contexto) return { error: "No autorizado." };

  const plan = await prisma.planMembresia.findUnique({
    where: { id_plan_membresia },
  });
  if (!plan) return { error: "Plan inválido." };

  const fecha_inicio_membresia = fecha_inicioRaw ? new Date(fecha_inicioRaw) : new Date();
  const fecha_vencimiento_membresia = new Date(fecha_inicio_membresia);
  fecha_vencimiento_membresia.setDate(
    fecha_vencimiento_membresia.getDate() + plan.duracion_dias
  );

  await prisma.membresia.create({
    data: {
      id_usuario,
      id_plan_membresia,
      estado_membresia: "activa",
      fecha_inicio_membresia,
      fecha_vencimiento_membresia,
    },
  });

  // Todo miembro activo tiene credencial digital (número de socio + QR).
  // Se crea una sola vez; si ya existía, no se toca (el token del QR no
  // debe cambiar cada vez que se renueva la membresía).
  await prisma.credencial.upsert({
    where: { id_usuario },
    update: {},
    create: { id_usuario, numero_socio: await generarNumeroSocio() },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: id_usuario,
    resultado: `activada:${plan.nombre}`,
  });

  revalidatePath(`/admin/usuarios/${id_usuario}`);
  return { message: "Membresía activada." };
}

export async function cambiarEstadoMembresia(formData: FormData): Promise<void> {
  const id_membresia = String(formData.get("id_membresia") ?? "");
  const estado_membresia = String(formData.get("estado_membresia") ?? "") as EstadoMembresia;

  if (!id_membresia || !ESTADOS_MEMBRESIA.includes(estado_membresia)) {
    return;
  }

  const membresiaActual = await prisma.membresia.findUnique({ where: { id_membresia } });
  if (!membresiaActual) return;

  const contexto = await autorizarSobreUsuario(membresiaActual.id_usuario);
  if (!contexto) return;

  const membresia = await prisma.membresia.update({
    where: { id_membresia },
    data: { estado_membresia },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_membresia",
    recurso: "membresia",
    id_recurso: membresia.id_usuario,
    resultado: `estado:${estado_membresia}`,
  });

  revalidatePath(`/admin/usuarios/${membresia.id_usuario}`);
}

// ------------------------------------------------------------
// IMPORTACIÓN DE BENEFICIARIOS (Kuntur)
// ------------------------------------------------------------
// Kuntur manda periódicamente un CSV de sus socios (nombre, DNI y
// vencimiento — sin email). No pasan por el registro normal: el admin los
// importa acá. Cada fila nueva se convierte en un Usuario con rol
// "beneficiario", con un email sintético (nunca se envía correo ahí) y
// contraseña = DNI — el login real de estos usuarios es por DNI, ver
// iniciarSesion() en src/app/actions/auth.ts. Una fila cuyo DNI ya existe
// actualiza nombre/apellido y renueva la membresía en vez de duplicar la
// cuenta, así el mismo botón sirve tanto para el alta inicial como para
// las actualizaciones que mande Kuntur más adelante.
//
// El procesamiento se dispara fila por fila desde el cliente (ver
// src/app/admin/usuarios/importar/page.tsx), no en una sola acción que
// procese las 200+ filas de un tirón: así la persona que lo corre ve una
// barra de progreso real en vez de un botón "Importando..." colgado.
// parsearCsvBeneficiarios() (src/lib/importarBeneficiarios.ts) es pura —
// sin nada server-only — así que corre directo en el browser para tener
// el total de filas al instante, sin ida y vuelta al servidor solo para
// contarlas.

export type ResultadoFilaImport =
  | { tipo: "creado" }
  | { tipo: "actualizado" }
  | { tipo: "error"; motivo: string };

const NOMBRE_PLAN_BENEFICIARIO_KUNTUR = "Kuntur — Beneficiario";

async function obtenerOCrearPlanBeneficiarioKuntur() {
  const existente = await prisma.planMembresia.findFirst({
    where: { nombre: NOMBRE_PLAN_BENEFICIARIO_KUNTUR },
  });
  if (existente) return existente;

  return prisma.planMembresia.create({
    data: {
      nombre: NOMBRE_PLAN_BENEFICIARIO_KUNTUR,
      descripcion:
        "Plan generado automáticamente para los socios de Kuntur importados por CSV desde /admin/usuarios/importar.",
      precio: 0,
      duracion_dias: 30,
    },
  });
}

// Primer paso del import: valida que quien lo corre sea admin y
// resuelve/crea el plan una sola vez (evita que cada una de las 200+
// llamadas de importarFilaBeneficiario tenga que buscarlo o crearlo).
export async function iniciarImportBeneficiarios(): Promise<
  { id_plan_membresia: string } | { error: string }
> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const plan = await obtenerOCrearPlanBeneficiarioKuntur();
  return { id_plan_membresia: plan.id_plan_membresia };
}

// Procesa UNA fila. El cliente la llama en secuencia, una fila a la vez
// (nunca en paralelo — el orden importa para no pisar el numero_socio
// entre filas), y actualiza su barra de progreso con cada resultado.
export async function importarFilaBeneficiario(
  fila: FilaBeneficiarioParseada,
  id_plan_membresia: string
): Promise<ResultadoFilaImport> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { tipo: "error", motivo: "No autorizado." };

  const nombreCompleto = `${fila.nombre} ${fila.apellido}`.trim();

  try {
    const existente = await prisma.usuario.findUnique({ where: { dni: fila.dni } });

    let id_usuario: string;
    if (existente) {
      id_usuario = existente.id_usuario;
      await prisma.usuario.update({
        where: { id_usuario },
        data: { nombre: fila.nombre, apellido: fila.apellido },
      });
    } else {
      const supabaseAdmin = createAdminClient();
      const email = emailSinteticoBeneficiario(fila.dni);
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: fila.dni,
        email_confirm: true,
        user_metadata: { nombre: fila.nombre, apellido: fila.apellido, dni: fila.dni },
      });
      if (error || !data.user) {
        return {
          tipo: "error",
          motivo: `${nombreCompleto}: ${error?.message ?? "no se pudo crear la cuenta"}`,
        };
      }

      id_usuario = data.user.id;
      await prisma.usuario.create({
        data: {
          id_usuario,
          email,
          dni: fila.dni,
          nombre: fila.nombre,
          apellido: fila.apellido,
          roles: { create: { rol: "beneficiario" } },
        },
      });
    }

    // Si el usuario ya existía (ej. re-importación), asegura el rol sin
    // pisar otros roles que ya pudiera tener.
    await prisma.usuarioRol.upsert({
      where: { usuario_rol_unico: { id_usuario, rol: "beneficiario" } },
      update: {},
      create: { id_usuario, rol: "beneficiario" },
    });

    await prisma.membresia.create({
      data: {
        id_usuario,
        id_plan_membresia,
        estado_membresia: "activa",
        fecha_inicio_membresia: new Date(),
        fecha_vencimiento_membresia: fila.fecha_vencimiento_membresia,
      },
    });

    const credencialExistente = await prisma.credencial.findUnique({ where: { id_usuario } });
    if (!credencialExistente) {
      await prisma.credencial.create({
        data: { id_usuario, numero_socio: await generarNumeroSocio() },
      });
    }

    return existente ? { tipo: "actualizado" } : { tipo: "creado" };
  } catch (err) {
    return {
      tipo: "error",
      motivo: `${nombreCompleto}: ${err instanceof Error ? err.message : "error inesperado"}`,
    };
  }
}

// Último paso: el cliente lo llama una vez que terminó de recorrer todas
// las filas, con los totales que fue acumulando.
export async function finalizarImportBeneficiarios(resumen: {
  creados: number;
  actualizados: number;
  omitidos: number;
  errores: number;
}): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "importar_beneficiarios",
    recurso: "usuario",
    resultado: `creados:${resumen.creados},actualizados:${resumen.actualizados},omitidos:${resumen.omitidos},errores:${resumen.errores}`,
  });

  revalidatePath("/admin/usuarios");
}

// ------------------------------------------------------------
// COMERCIOS Y BENEFICIOS
// ------------------------------------------------------------

// El rol "comercio" nunca se asigna suelto (ver obtenerComercioActual):
// esta acción crea el rol y el perfil de Comercio en un mismo paso, sobre
// un usuario que ya existe (debe haberse registrado antes por su cuenta).
export async function crearComercio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const email = String(formData.get("email") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  if (!email || !nombre) {
    return { error: "Completá el email del usuario y el nombre del comercio." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { comercio: true },
  });

  if (!usuario) {
    return { error: "No existe un usuario con ese email. Debe registrarse primero." };
  }
  if (usuario.comercio) {
    return { error: "Ese usuario ya tiene un perfil de comercio." };
  }

  const comercio = await prisma.$transaction(async (tx) => {
    await tx.usuarioRol.upsert({
      where: { usuario_rol_unico: { id_usuario: usuario.id_usuario, rol: "comercio" } },
      update: {},
      create: { id_usuario: usuario.id_usuario, rol: "comercio" },
    });

    return tx.comercio.create({
      data: {
        id_usuario: usuario.id_usuario,
        nombre,
        descripcion,
        direccion,
        telefono,
        categoria,
      },
    });
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "alta_comercio",
    recurso: "comercio",
    id_recurso: comercio.id_comercio,
    resultado: `creado:${comercio.nombre}`,
  });

  revalidatePath("/admin/comercios");
  redirect(`/admin/comercios/${comercio.id_comercio}`);
}

export async function cambiarEstadoComercio(formData: FormData): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  const id_comercio = String(formData.get("id_comercio") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoComercio;

  if (!id_comercio || !ESTADOS_COMERCIO.includes(estado)) return;

  await prisma.comercio.update({ where: { id_comercio }, data: { estado } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_comercio",
    recurso: "comercio",
    id_recurso: id_comercio,
    resultado: `estado:${estado}`,
  });

  revalidatePath(`/admin/comercios/${id_comercio}`);
  revalidatePath("/admin/comercios");
}

export async function editarComercio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const id_comercio = String(formData.get("id_comercio") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const logo = String(formData.get("logo") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  if (!id_comercio || !nombre) {
    return { error: "Completá el nombre del comercio." };
  }

  const comercio = await prisma.comercio.update({
    where: { id_comercio },
    data: { nombre, descripcion, direccion, telefono, email, logo, categoria },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_comercio",
    recurso: "comercio",
    id_recurso: id_comercio,
    resultado: `editado:${comercio.nombre}`,
  });

  revalidatePath(`/admin/comercios/${id_comercio}`);
  revalidatePath("/admin/comercios");
  redirect(`/admin/comercios/${id_comercio}`);
}

export async function crearBeneficio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const id_comercio = String(formData.get("id_comercio") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const descuento = String(formData.get("descuento") ?? "").trim() || null;
  const condiciones = String(formData.get("condiciones") ?? "").trim() || null;
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");
  const fecha_vencimientoRaw = String(formData.get("fecha_vencimiento") ?? "");

  if (!id_comercio || !titulo || !fecha_inicioRaw || !fecha_vencimientoRaw) {
    return { error: "Completá comercio, título y vigencia del beneficio." };
  }

  const comercio = await prisma.comercio.findUnique({ where: { id_comercio } });
  if (!comercio) return { error: "Comercio inválido." };

  const beneficio = await prisma.beneficio.create({
    data: {
      id_comercio,
      titulo,
      descripcion,
      descuento,
      condiciones,
      fecha_inicio: new Date(fecha_inicioRaw),
      fecha_vencimiento: new Date(fecha_vencimientoRaw),
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: beneficio.id_beneficio,
    resultado: `creado:${beneficio.titulo}`,
  });

  revalidatePath(`/admin/comercios/${id_comercio}`);
  redirect(`/admin/comercios/${id_comercio}`);
}

export async function cambiarEstadoBeneficio(formData: FormData): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoBeneficio;

  if (!id_beneficio || !ESTADOS_BENEFICIO.includes(estado)) return;

  const beneficio = await prisma.beneficio.update({
    where: { id_beneficio },
    data: { estado },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `estado:${estado}`,
  });

  revalidatePath(`/admin/comercios/${beneficio.id_comercio}`);
}

export async function editarBeneficio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const descuento = String(formData.get("descuento") ?? "").trim() || null;
  const condiciones = String(formData.get("condiciones") ?? "").trim() || null;
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");
  const fecha_vencimientoRaw = String(formData.get("fecha_vencimiento") ?? "");

  if (!id_beneficio || !titulo || !fecha_inicioRaw || !fecha_vencimientoRaw) {
    return { error: "Completá título y vigencia del beneficio." };
  }

  const beneficio = await prisma.beneficio.update({
    where: { id_beneficio },
    data: {
      titulo,
      descripcion,
      descuento,
      condiciones,
      fecha_inicio: new Date(fecha_inicioRaw),
      fecha_vencimiento: new Date(fecha_vencimientoRaw),
    },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `editado:${beneficio.titulo}`,
  });

  revalidatePath(`/admin/comercios/${beneficio.id_comercio}`);
  redirect(`/admin/comercios/${beneficio.id_comercio}`);
}

export async function asignarBeneficioPlan(formData: FormData): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  const id_comercio = String(formData.get("id_comercio") ?? "");
  if (!id_beneficio || !id_plan_membresia) return;

  await prisma.beneficioPlan.upsert({
    where: { id_beneficio_id_plan_membresia: { id_beneficio, id_plan_membresia } },
    update: {},
    create: { id_beneficio, id_plan_membresia },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `plan_asignado:${id_plan_membresia}`,
  });

  if (id_comercio) revalidatePath(`/admin/comercios/${id_comercio}`);
}

export async function quitarBeneficioPlan(formData: FormData): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const id_plan_membresia = String(formData.get("id_plan_membresia") ?? "");
  const id_comercio = String(formData.get("id_comercio") ?? "");
  if (!id_beneficio || !id_plan_membresia) return;

  await prisma.beneficioPlan.deleteMany({ where: { id_beneficio, id_plan_membresia } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `plan_quitado:${id_plan_membresia}`,
  });

  if (id_comercio) revalidatePath(`/admin/comercios/${id_comercio}`);
}

// Borrado definitivo del beneficio. Si algún comercio ya lo usó para
// validar (validaciones_beneficios), Postgres rechaza el borrado — en ese
// caso conviene marcarlo "inactivo"/"vencido" en vez de eliminarlo, así no
// se pierde el historial de validaciones ya hechas.
export async function eliminarBeneficio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  if (!id_beneficio) return { error: "Beneficio inválido." };

  const beneficio = await prisma.beneficio.findUnique({ where: { id_beneficio } });
  if (!beneficio) return { error: "Beneficio inválido." };

  try {
    await prisma.beneficio.delete({ where: { id_beneficio } });
  } catch (err) {
    if (esErrorDeIntegridadReferencial(err)) {
      return {
        error:
          "No se puede eliminar: ya tiene validaciones registradas. Marcalo como \"inactivo\" o \"vencido\" en vez de borrarlo.",
      };
    }
    throw err;
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `eliminado:${beneficio.titulo}`,
  });

  revalidatePath(`/admin/comercios/${beneficio.id_comercio}`);
  redirect(`/admin/comercios/${beneficio.id_comercio}`);
}

// Borrado definitivo del comercio (y sus beneficios, en cascada). También
// le quita el rol "comercio" al usuario dueño, pero el usuario en sí no se
// toca — puede seguir existiendo con otros roles. Si algún beneficio ya
// tiene validaciones registradas, Postgres rechaza todo el borrado.
export async function eliminarComercio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const id_comercio = String(formData.get("id_comercio") ?? "");
  if (!id_comercio) return { error: "Comercio inválido." };

  const comercio = await prisma.comercio.findUnique({ where: { id_comercio } });
  if (!comercio) return { error: "Comercio inválido." };

  try {
    await prisma.$transaction([
      prisma.usuarioRol.deleteMany({
        where: { id_usuario: comercio.id_usuario, rol: "comercio" },
      }),
      prisma.comercio.delete({ where: { id_comercio } }),
    ]);
  } catch (err) {
    if (esErrorDeIntegridadReferencial(err)) {
      return {
        error:
          "No se puede eliminar: alguno de sus beneficios ya tiene validaciones registradas. Marcalo como \"inactivo\" en vez de borrarlo.",
      };
    }
    throw err;
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_comercio",
    recurso: "comercio",
    id_recurso: id_comercio,
    resultado: `eliminado:${comercio.nombre}`,
  });

  revalidatePath("/admin/comercios");
  redirect("/admin/comercios");
}
