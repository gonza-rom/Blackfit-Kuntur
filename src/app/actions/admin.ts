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
import { leerBeneficio, asegurarCredencial } from "@/lib/beneficios";
import { crearUsuarioAuth, cambiarEmailAuth, emailTomado, establecerContrasena } from "@/lib/cuentas";
import { crearNotificacion } from "@/lib/notificaciones";
import { avisar } from "@/lib/aviso";
import { otorgarLogrosManualesIniciales } from "@/lib/gamificacion";
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

const ESTADOS_COMERCIO: EstadoComercio[] = ["activo", "inactivo", "pendiente", "rechazado"];
// "activo" desde la administración = aprobado y publicado en el catálogo.
const ESTADOS_BENEFICIO: EstadoBeneficio[] = ["activo", "inactivo", "vencido", "rechazado"];

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
    // Vincular una cuenta existente a Kuntur: queda como socio (con su
    // propia membresía de Kuntur, independiente de Blackfit).
    if (rol === "beneficiario" || rol === "miembro_kuntur") {
      await prisma.socioKuntur.upsert({
        where: { id_usuario },
        update: {},
        create: { id_usuario, fecha_alta_gimnasio: new Date(), cuenta_activada: true },
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

  await avisar(`Rol "${rol}" asignado.`);
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

  await avisar(`Rol "${rol}" quitado.`, "eliminado");
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

  await avisar(`Usuario marcado como ${estado_usuario}.`);
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
// Alta manual de un usuario (coach, alumno, admin, socio...). La
// contraseña inicial la define quien lo crea (nunca una predeterminada
// como el DNI) y se la pasa a la persona. Cada admin recortado solo crea
// usuarios de su dominio; los roles de administración, solo el general.
// Los comercios se crean desde Comercios (necesitan su ficha comercial).
export async function crearUsuario(_prev: EstadoAdmin, formData: FormData): Promise<EstadoAdmin> {
  const actor = await obtenerUsuarioActual();
  if (!actor) return { error: "No autorizado." };
  const esGeneral = tieneRol(actor, "administrador");
  const puedeComercios = esGeneral || tieneRol(actor, "admin_comercios");
  const puedeBlackfit = esGeneral || tieneRol(actor, "admin_blackfit");
  if (!puedeComercios && !puedeBlackfit) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 80);
  const apellido = String(formData.get("apellido") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const dni = String(formData.get("dni") ?? "").replace(/\D/g, "") || null;
  const telefono = String(formData.get("telefono") ?? "").trim().slice(0, 40) || null;
  const rol = String(formData.get("rol") ?? "") as RolUsuario;
  const password = String(formData.get("password") ?? "");

  if (!nombre || !apellido || !email) return { error: "Completá nombre, apellido y email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no es válido." };
  if (dni && (dni.length < 6 || dni.length > 9)) return { error: "El DNI no es válido." };
  if (password.length < 8 || password.length > 72 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { error: "La contraseña inicial debe tener entre 8 y 72 caracteres, con al menos una letra y un número." };
  }
  if (dni && password.replace(/\D/g, "") === dni) return { error: "La contraseña no puede ser el DNI." };

  const rolesPermitidos: RolUsuario[] = [
    ...(esGeneral ? ROLES_ADMIN : []),
    ...(puedeBlackfit ? ROLES_DOMINIO_BLACKFIT : []),
    ...(puedeComercios ? (["beneficiario", "miembro_kuntur"] as RolUsuario[]) : []),
  ];
  if (!rolesPermitidos.includes(rol)) return { error: "No podés crear usuarios con ese rol." };

  if (await emailTomado(email)) return { error: "Ya existe un usuario con ese email." };
  if (dni && (await prisma.usuario.findUnique({ where: { dni }, select: { id_usuario: true } }))) {
    return { error: "Ya existe un usuario con ese DNI." };
  }

  let id_usuario: string;
  try {
    id_usuario = await crearUsuarioAuth(email, { nombre, apellido, dni });
    await establecerContrasena(id_usuario, password);
  } catch (e) {
    console.error("[admin] crearUsuario auth:", e);
    return { error: "No se pudo crear la cuenta de acceso. Probá de nuevo." };
  }

  try {
    await prisma.usuario.create({
      data: {
        id_usuario,
        email,
        dni,
        nombre,
        apellido,
        telefono,
        roles: { create: { rol } },
        ...(rol === "alumno" ? { alumno: { create: {} } } : {}),
        ...(rol === "entrenador" ? { entrenador: { create: {} } } : {}),
        ...(rol === "beneficiario" || rol === "miembro_kuntur"
          ? { socio_kuntur: { create: { fecha_alta_gimnasio: new Date(), cuenta_activada: true } } }
          : {}),
      },
    });
  } catch (e) {
    // Que no quede una cuenta de acceso sin perfil.
    await prisma.$executeRaw`delete from auth.users where id::text = ${id_usuario}`.catch(() => {});
    console.error("[admin] crearUsuario perfil:", e);
    return { error: "No se pudo crear el usuario. Revisá que el email y el DNI no estén usados." };
  }

  if (rol === "alumno") {
    const alumno = await prisma.alumno.findUnique({ where: { id_usuario }, select: { id_alumno: true } });
    if (alumno) await otorgarLogrosManualesIniciales(alumno.id_alumno);
  }

  await registrarAuditoria({
    id_usuario_actor: actor.id_usuario,
    accion: "alta_usuario_admin",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `creado:${rol}`,
  });

  await avisar("Usuario creado. Pasale su email y la contraseña inicial.");
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios/${id_usuario}`);
}

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

  if (email.toLowerCase() !== usuarioActual.email.toLowerCase()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email no es válido." };
    if (await emailTomado(email, id_usuario)) return { error: "Ese email ya lo usa otro usuario." };
    // Por SQL (mismo mecanismo que la activación de socios): no depende de
    // que SUPABASE_SERVICE_ROLE_KEY esté configurada en el hosting.
    await cambiarEmailAuth(id_usuario, email);
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

  await avisar("Usuario actualizado.");
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

  // Perfil y cuenta de acceso juntos (todo o nada): antes, si faltaba la
  // service_role key, se borraba el perfil y la cuenta de Auth quedaba suelta.
  try {
    await prisma.$transaction([
      prisma.usuario.delete({ where: { id_usuario } }),
      prisma.$executeRaw`delete from auth.users where id::text = ${id_usuario}`,
    ]);
  } catch (err) {
    if (esErrorDeIntegridadReferencial(err)) {
      return {
        error:
          "No se puede eliminar: tiene mensajes, validaciones de beneficios u otro historial asociado. Usá el estado \"Suspendido\" en vez de eliminarlo.",
      };
    }
    throw err;
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "eliminacion_admin",
    recurso: "usuario",
    id_recurso: id_usuario,
    resultado: `eliminado:${usuario.email}`,
  });

  await avisar("Usuario eliminado.", "eliminado");
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

  await avisar("Membresía actualizada.");
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

  await avisar("Membresía eliminada.", "eliminado");
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

  // Cada plan es de UNA organización (membresías independientes).
  const organizacion = String(formData.get("organizacion") ?? "kuntur") === "blackfit" ? "blackfit" : "kuntur";
  await prisma.planMembresia.create({
    data: {
      nombre,
      descripcion,
      precio,
      duracion_dias: Number(duracion_diasRaw),
      organizacion,
    },
  });

  await avisar(`Plan "${nombre}" creado.`);
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

  await avisar(`Plan "${nombre}" actualizado.`);
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

  await avisar(`Plan "${plan.nombre}" eliminado.`, "eliminado");
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

  await avisar(`Membresía "${plan.nombre}" activada.`);
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

  await avisar(`Membresía marcada como ${estado_membresia}.`);
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
  | { tipo: "sin_cambios" }
  | { tipo: "error"; motivo: string };

// Ya tiene una membresía Kuntur que vence ese día o después: reimportar
// el mismo archivo no crea nada (idempotente).
const MARGEN_MISMO_DIA_MS = 12 * 60 * 60 * 1000;

/**
 * Vista previa ANTES de importar: qué haría cada fila, sin escribir nada.
 * Así se revisan altas, renovaciones y duplicados antes de confirmar.
 */
export async function previsualizarImportBeneficiarios(
  filas: { dni: string; fecha_vencimiento_membresia: Date }[]
): Promise<{ nuevos: number; renovaciones: number; sin_cambios: number; cuentas_blackfit: number } | { error: string }> {
  if (!(await obtenerAdminComerciosActual())) return { error: "No autorizado." };
  const dnis = filas.map((f) => f.dni);
  const existentes = await prisma.usuario.findMany({
    where: { dni: { in: dnis } },
    select: {
      dni: true,
      roles: { select: { rol: true } },
      membresias: {
        where: { plan_membresia: { organizacion: "kuntur" } },
        orderBy: { fecha_vencimiento_membresia: "desc" },
        take: 1,
        select: { fecha_vencimiento_membresia: true },
      },
    },
  });
  const porDni = new Map(existentes.map((u) => [u.dni, u]));
  let nuevos = 0, renovaciones = 0, sin_cambios = 0, cuentas_blackfit = 0;
  for (const f of filas) {
    const u = porDni.get(f.dni);
    if (!u) { nuevos++; continue; }
    if (u.roles.some((r) => r.rol === "alumno" || r.rol === "entrenador")) cuentas_blackfit++;
    const ultima = u.membresias[0]?.fecha_vencimiento_membresia;
    if (ultima && ultima.getTime() >= new Date(f.fecha_vencimiento_membresia).getTime() - MARGEN_MISMO_DIA_MS) sin_cambios++;
    else renovaciones++;
  }
  return { nuevos, renovaciones, sin_cambios, cuentas_blackfit };
}

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
    const existente = await prisma.usuario.findUnique({
      where: { dni: fila.dni },
      include: { roles: { select: { rol: true } } },
    });

    let id_usuario: string;
    if (existente) {
      // Ya existe (reimportación, o alguien que ya tenía cuenta): NO se pisan
      // nombre ni otros datos que pudo haber corregido la administración.
      id_usuario = existente.id_usuario;
      const esBlackfit = existente.roles.some((r) => r.rol === "alumno" || r.rol === "entrenador");
      const rol = esBlackfit ? "miembro_kuntur" : "beneficiario";
      await prisma.usuarioRol.upsert({
        where: { usuario_rol_unico: { id_usuario, rol } },
        update: {},
        create: { id_usuario, rol },
      });
    } else {
      // Cuenta nueva con contraseña ALEATORIA (nunca el DNI): el socio
      // activa su acceso con un código (ver /kuntur/activar).
      const email = emailSinteticoBeneficiario(fila.dni);
      id_usuario = await crearUsuarioAuth(email, { nombre: fila.nombre, apellido: fila.apellido, dni: fila.dni });
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

    await prisma.socioKuntur.upsert({
      where: { id_usuario },
      update: {},
      create: { id_usuario, fecha_alta_gimnasio: new Date(), cuenta_activada: false },
    });

    // Idempotente: si ya tiene una membresía Kuntur que vence ese día (o
    // después), no se crea otra. Si el archivo trae un vencimiento
    // posterior, se registra como renovación (el historial queda).
    const ultima = await prisma.membresia.findFirst({
      where: { id_usuario, plan_membresia: { organizacion: "kuntur" } },
      orderBy: { fecha_vencimiento_membresia: "desc" },
    });
    const yaCubierto =
      ultima &&
      ultima.fecha_vencimiento_membresia.getTime() >= fila.fecha_vencimiento_membresia.getTime() - MARGEN_MISMO_DIA_MS;
    if (!yaCubierto) {
      await prisma.membresia.create({
        data: {
          id_usuario,
          id_plan_membresia,
          estado_membresia: "activa",
          fecha_inicio_membresia: new Date(),
          fecha_vencimiento_membresia: fila.fecha_vencimiento_membresia,
        },
      });
    }

    await asegurarCredencial(id_usuario);

    if (!existente) return { tipo: "creado" };
    return yaCubierto ? { tipo: "sin_cambios" } : { tipo: "actualizado" };
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

  await avisar(
    `Importación finalizada: ${resumen.creados} creado(s), ${resumen.actualizados} actualizado(s), ${resumen.errores} error(es).`
  );
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

  await avisar(`Comercio "${comercio.nombre}" creado.`);
  revalidatePath("/admin/comercios");
  redirect(`/admin/comercios/${comercio.id_comercio}`);
}

export async function cambiarEstadoComercio(formData: FormData): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  const id_comercio = String(formData.get("id_comercio") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoComercio;
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 300) || null;

  if (!id_comercio || !ESTADOS_COMERCIO.includes(estado)) return;

  const anterior = await prisma.comercio.findUnique({ where: { id_comercio }, select: { estado: true } });
  const comercio = await prisma.comercio.update({
    where: { id_comercio },
    data: { estado, motivo_rechazo: estado === "rechazado" ? motivo : null },
  });
  if (anterior?.estado === "pendiente" && estado === "activo") {
    await notificarComercio(id_comercio, "¡Tu comercio fue aprobado!", "Ya podés cargar beneficios para la comunidad Blackfit y Kuntur.", "/comercio");
  } else if (estado === "rechazado") {
    await notificarComercio(id_comercio, "Solicitud de adhesión no aprobada", motivo ?? "Contactá a la administración para más información.", "/comercio");
  }

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_comercio",
    recurso: "comercio",
    id_recurso: id_comercio,
    resultado: `estado:${estado}`,
  });

  await avisar(
    estado === "activo"
      ? `Comercio "${comercio.nombre}" activado.`
      : estado === "inactivo"
        ? `Comercio "${comercio.nombre}" desactivado.`
        : estado === "rechazado"
          ? `Solicitud de "${comercio.nombre}" rechazada.`
          : `Comercio "${comercio.nombre}" marcado como pendiente.`,
    estado === "activo" ? "exito" : "info"
  );
  revalidarCatalogo(id_comercio);
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

  await avisar(`Comercio "${comercio.nombre}" actualizado.`);
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
  const comercio = id_comercio ? await prisma.comercio.findUnique({ where: { id_comercio } }) : null;
  if (!comercio) return { error: "Comercio inválido." };

  const datos = leerBeneficio(formData);
  if ("error" in datos) return datos;

  // Cargado por la administración: ya revisado, se publica directo.
  const beneficio = await prisma.beneficio.create({ data: { ...datos, id_comercio, estado: "activo" } });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: beneficio.id_beneficio,
    resultado: `creado:${beneficio.titulo}`,
  });

  await avisar(`Beneficio "${beneficio.titulo}" publicado.`);
  revalidarCatalogo(id_comercio);
  redirect(`/admin/comercios/${id_comercio}`);
}

// El catálogo es único: un cambio se ve en Blackfit, en Kuntur y en el
// panel del comercio.
function revalidarCatalogo(id_comercio: string) {
  revalidatePath(`/admin/comercios/${id_comercio}`);
  revalidatePath("/admin/comercios");
  revalidatePath("/panel/beneficios");
  revalidatePath("/beneficiario", "layout");
  revalidatePath("/comercio/beneficios");
}

async function notificarComercio(id_comercio: string, titulo: string, contenido: string, url: string) {
  const comercio = await prisma.comercio.findUnique({ where: { id_comercio }, select: { id_usuario: true } });
  if (!comercio) return;
  await crearNotificacion({ id_usuario: comercio.id_usuario, titulo, contenido, tipo: "comercio", url }).catch(() => {});
}

export async function cambiarEstadoBeneficio(formData: FormData): Promise<void> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return;

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  const estado = String(formData.get("estado") ?? "") as EstadoBeneficio;
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 300) || null;

  if (!id_beneficio || !ESTADOS_BENEFICIO.includes(estado)) return;

  const anterior = await prisma.beneficio.findUnique({ where: { id_beneficio }, select: { estado: true } });
  if (!anterior) return;

  const beneficio = await prisma.beneficio.update({
    where: { id_beneficio },
    data: { estado, motivo_rechazo: estado === "rechazado" ? motivo : null },
  });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `estado:${anterior.estado}->${estado}${motivo ? `:${motivo}` : ""}`,
  });

  const url = `/comercio/beneficios/${id_beneficio}/editar`;
  if (anterior.estado === "pendiente" && estado === "activo") {
    await notificarComercio(beneficio.id_comercio, "Beneficio aprobado", `"${beneficio.titulo}" ya está publicado en el catálogo.`, url);
  } else if (estado === "rechazado") {
    await notificarComercio(
      beneficio.id_comercio,
      "Beneficio no aprobado",
      `"${beneficio.titulo}"${motivo ? `: ${motivo}` : " no fue aprobado."}`,
      url
    );
  }

  await avisar(
    estado === "activo"
      ? `Beneficio "${beneficio.titulo}" ${anterior.estado === "pendiente" ? "aprobado y publicado" : "publicado"}.`
      : estado === "rechazado"
        ? `Beneficio "${beneficio.titulo}" rechazado.`
        : `Beneficio "${beneficio.titulo}" marcado como ${estado}.`,
    estado === "activo" ? "exito" : "info"
  );
  revalidarCatalogo(beneficio.id_comercio);
}

export async function editarBeneficio(
  _prev: EstadoAdmin,
  formData: FormData
): Promise<EstadoAdmin> {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) return { error: "No autorizado." };

  const id_beneficio = String(formData.get("id_beneficio") ?? "");
  if (!id_beneficio) return { error: "Beneficio inválido." };
  const datos = leerBeneficio(formData);
  if ("error" in datos) return datos;

  const beneficio = await prisma.beneficio.update({ where: { id_beneficio }, data: datos });

  await registrarAuditoria({
    id_usuario_actor: contexto.usuario.id_usuario,
    accion: "cambio_beneficio",
    recurso: "beneficio",
    id_recurso: id_beneficio,
    resultado: `editado:${beneficio.titulo}`,
  });

  await avisar(`Beneficio "${beneficio.titulo}" actualizado.`);
  revalidarCatalogo(beneficio.id_comercio);
  redirect(`/admin/comercios/${beneficio.id_comercio}`);
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

  await avisar(`Beneficio "${beneficio.titulo}" eliminado.`, "eliminado");
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

  await avisar(`Comercio "${comercio.nombre}" eliminado.`, "eliminado");
  revalidatePath("/admin/comercios");
  redirect("/admin/comercios");
}
