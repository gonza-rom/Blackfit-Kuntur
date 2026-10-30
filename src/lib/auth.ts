import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { obtenerMembresiaBlackfit, type EstadoMembresiaBlackfit } from "@/lib/membresia";
import type {
  RolUsuario,
  Usuario,
  UsuarioRol,
  Alumno,
  Entrenador,
  Comercio,
} from "@prisma/client";

export type UsuarioActual = Usuario & {
  roles: UsuarioRol[];
  alumno: Alumno | null;
  entrenador: Entrenador | null;
  comercio: Comercio | null;
};

// A qué usuarios (por sus roles) llega cada admin recortado. Se reusa
// tanto en las server actions (actions/admin.ts, para autorizar) como en
// las páginas de /admin/usuarios (para filtrar qué se lista/asigna) — una
// sola fuente de verdad para no desalinear ambos lados.
export const ROLES_DOMINIO_COMERCIOS: RolUsuario[] = [
  "comercio",
  "beneficiario",
  "miembro_kuntur",
];
export const ROLES_DOMINIO_BLACKFIT: RolUsuario[] = ["alumno", "entrenador"];
export const ROLES_ADMIN: RolUsuario[] = ["administrador", "admin_comercios", "admin_blackfit"];

// Layout + page (+ a veces componentes anidados) piden la identidad del
// usuario por separado, cada uno como defensa en profundidad — así debe
// ser. Sin `cache()` eso significaba repetir la ida y vuelta a Supabase
// Auth y la query a Prisma 2-3 veces por navegación. `cache()` memoiza
// por request: la primera llamada hace el trabajo real, el resto en la
// misma pasada de render reutiliza el resultado. No cachea entre
// requests distintos, así que la sesión se sigue revalidando en cada
// navegación real.
export const obtenerUsuarioActual = cache(
  async (): Promise<UsuarioActual | null> => {
    const supabase = await createClient();
    // `getClaims()` verifica la FIRMA del access token (localmente con las
    // claves públicas del proyecto si usa claves asimétricas; si no, contra
    // el servidor de Supabase) y la identidad sale de `claims.sub`.
    //
    // Nunca usar `getSession()` acá: su `session.user` se lee tal cual de
    // la cookie, sin verificar nada — cualquiera podía editar ese objeto y
    // poner el id de otro usuario (un admin) junto a su propio token
    // válido. El proxy no alcanza como defensa: valida el token, no ese
    // objeto, y las server actions se pueden invocar desde cualquier ruta
    // (incluidas las que el proxy no protege, como /registro o /api).
    const { data, error } = await supabase.auth.getClaims();
    const id_usuario = error ? undefined : data?.claims.sub;

    if (!id_usuario) return null;

    // `relationLoadStrategy: "join"` (requiere el preview `relationJoins` en
    // el generator del schema): sin esto, Prisma resuelve cada relación del
    // `include` como una consulta SQL separada — acá eran 4 relaciones, y
    // como el pool de Supabase está en modo transacción, cada ida y vuelta
    // adicional cuesta ~100ms. Con "join" todo sale en un solo SELECT.
    // Medido: 8 queries/~1.2s → 4 queries/~0.75s en esta función, que se
    // llama en casi todas las páginas.
    return prisma.usuario.findUnique({
      where: { id_usuario },
      include: { roles: true, alumno: true, entrenador: true, comercio: true },
      relationLoadStrategy: "join",
    });
  }
);

export function tieneRol(usuario: UsuarioActual | null, rol: RolUsuario): boolean {
  return usuario?.roles.some((r) => r.rol === rol) ?? false;
}

// Un usuario con estado inactivo/suspendido conserva su sesión de Supabase
// Auth pero no debe poder usar la app. Los layouts protegidos lo mandan a
// /cuenta-inactiva; el login lo rechaza de entrada (ver actions/auth.ts).
export function cuentaActiva(usuario: UsuarioActual | null): boolean {
  return usuario?.estado_usuario === "activo";
}

export const obtenerEntrenadorActual = cache(
  async (): Promise<{ usuario: UsuarioActual; id_entrenador: string } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "entrenador") || !usuario.entrenador) {
      return null;
    }
    return { usuario, id_entrenador: usuario.entrenador.id_entrenador };
  }
);

// Acceso al ENTRENAMIENTO de Blackfit: solo con una membresía activa,
// vigente y no suspendida. Aplica a TODOS los alumnos, sin excepciones
// (un coach o admin que además es alumno tampoco entrena sin membresía:
// su panel de trabajo vive en /coach y /admin, que no se bloquean).
// Sin acceso, el alumno conserva su cuenta, su perfil personal y todos sus
// datos — /panel lo manda a /membresia-vencida y obtenerAlumnoActual() le
// devuelve null, así toda server action / API de entrenamiento lo rechaza
// aunque la llame directo. Se evalúa en cada request (nunca se cachea
// entre requests), así el vencimiento corta el acceso en el momento.
export type EstadoAccesoEntrenamiento = "permitido" | Exclude<EstadoMembresiaBlackfit, "activa">;

export const estadoAccesoEntrenamiento = cache(
  async (usuario: UsuarioActual): Promise<EstadoAccesoEntrenamiento> => {
    if (!tieneRol(usuario, "alumno") || !usuario.alumno) return "permitido";
    const { estado } = await obtenerMembresiaBlackfit(usuario.id_usuario);
    return estado === "activa" ? "permitido" : estado;
  }
);

export const accesoAlumnoBloqueado = cache(
  async (usuario: UsuarioActual): Promise<boolean> => {
    return (await estadoAccesoEntrenamiento(usuario)) !== "permitido";
  }
);

/**
 * Pantallas de ENTRENAMIENTO (Inicio, Entrenar, sesión, planificación,
 * historial, progreso, logros, hábitos...): sin membresía vigente, a la
 * pantalla de bloqueo. Se llama en cada página (no solo en el layout: en
 * Next los layouts no se vuelven a ejecutar al navegar dentro de la app,
 * así que un link guardado o una pantalla ya cargada podría saltear el
 * bloqueo).
 */
export async function exigirMembresiaActiva(): Promise<void> {
  const usuario = await obtenerUsuarioActual();
  if (usuario && (await accesoAlumnoBloqueado(usuario))) redirect("/membresia-vencida");
}

/**
 * Alumno aunque no tenga acceso al entrenamiento, con `bloqueado` para que
 * la pantalla (solo el PERFIL personal) oculte todo dato de entrenamiento.
 * Las acciones de entrenamiento siguen usando obtenerAlumnoActual(), que
 * lo rechaza.
 */
export const obtenerAlumnoLectura = cache(
  async (): Promise<{ usuario: UsuarioActual; id_alumno: string; bloqueado: boolean } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "alumno") || !usuario.alumno) return null;
    return {
      usuario,
      id_alumno: usuario.alumno.id_alumno,
      bloqueado: await accesoAlumnoBloqueado(usuario),
    };
  }
);

export const obtenerAlumnoActual = cache(
  async (): Promise<{ usuario: UsuarioActual; id_alumno: string } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "alumno") || !usuario.alumno) {
      return null;
    }
    if (await accesoAlumnoBloqueado(usuario)) return null;
    return { usuario, id_alumno: usuario.alumno.id_alumno };
  }
);

// Socio de Kuntur Training Club: "beneficiario" (solo Kuntur) o
// "miembro_kuntur" (alumno/coach de Blackfit que además es socio). Ambos
// entran al panel de Kuntur (/beneficiario); el rol lo asigna la
// administración, nunca el cliente.
export function esSocioKuntur(usuario: UsuarioActual | null): boolean {
  return tieneRol(usuario, "beneficiario") || tieneRol(usuario, "miembro_kuntur");
}

export const obtenerBeneficiarioActual = cache(
  async (): Promise<{ usuario: UsuarioActual } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !esSocioKuntur(usuario)) return null;
    return { usuario };
  }
);

// ------------------------------------------------------------
// Entornos: una app, tres rutas (Blackfit, Kuntur, Comercios) más la
// administración. A qué entornos entra cada persona lo deciden SOLO sus
// roles en la base; la ruta que eligió en el login es una preferencia,
// nunca un permiso.
// ------------------------------------------------------------
export type ClaveEntorno = "alumno" | "coach" | "kuntur" | "comercio" | "admin";
export type EntornoDisponible = { clave: ClaveEntorno; href: string; etiqueta: string };

export function entornosDisponibles(usuario: UsuarioActual | null): EntornoDisponible[] {
  if (!usuario) return [];
  const entornos: EntornoDisponible[] = [];
  if (tieneRol(usuario, "alumno") && usuario.alumno) {
    entornos.push({ clave: "alumno", href: "/panel", etiqueta: "Blackfit · Entrenamiento" });
  }
  if (tieneRol(usuario, "entrenador") && usuario.entrenador) {
    entornos.push({ clave: "coach", href: "/coach", etiqueta: "Blackfit · Coach" });
  }
  if (esSocioKuntur(usuario)) {
    entornos.push({ clave: "kuntur", href: "/beneficiario", etiqueta: "Kuntur Training Club" });
  }
  if (tieneRol(usuario, "comercio") && usuario.comercio) {
    entornos.push({ clave: "comercio", href: "/comercio", etiqueta: "Comercio adherido" });
  }
  if (tieneAccesoAdmin(usuario)) {
    entornos.push({ clave: "admin", href: "/admin", etiqueta: "Administración" });
  }
  return entornos;
}

export type RutaLogin = "blackfit" | "kuntur" | "comercio";

/**
 * Adónde mandar a alguien después de entrar. Si eligió una ruta en el
 * login y TIENE ese entorno, va ahí; si no, a su entorno principal. Sin
 * ningún entorno (cuenta sin vincular) → /sin-acceso, nunca a Blackfit
 * por defecto.
 */
export function destinoTrasLogin(usuario: UsuarioActual | null, ruta?: string | null): string {
  const entornos = entornosDisponibles(usuario);
  if (entornos.length === 0) return `/sin-acceso${ruta ? `?ruta=${ruta}` : ""}`;
  const preferidos: Record<RutaLogin, ClaveEntorno[]> = {
    blackfit: ["alumno", "coach"],
    kuntur: ["kuntur"],
    comercio: ["comercio"],
  };
  if (ruta && ruta in preferidos) {
    const elegido = entornos.find((e) => preferidos[ruta as RutaLogin].includes(e.clave));
    if (elegido) return elegido.href;
    return `/sin-acceso?ruta=${ruta}`;
  }
  return entornos[0].href;
}

// True si el usuario es beneficiario y NO tiene ningún rol de Black Fit ni
// operativo: en ese caso su única casa es /beneficiario.
export function soloBeneficiario(usuario: UsuarioActual | null): boolean {
  if (!usuario || !tieneRol(usuario, "beneficiario")) return false;
  return !(
    tieneRol(usuario, "alumno") ||
    tieneRol(usuario, "entrenador") ||
    tieneRol(usuario, "administrador") ||
    tieneRol(usuario, "admin_comercios") ||
    tieneRol(usuario, "admin_blackfit") ||
    tieneRol(usuario, "comercio")
  );
}

export const obtenerAdministradorActual = cache(
  async (): Promise<{ usuario: UsuarioActual } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "administrador")) {
      return null;
    }
    return { usuario };
  }
);

// Dos roles administrativos recortados, pensados para delegar sin dar
// acceso total: "admin_comercios" (comercios, beneficios y los usuarios
// beneficiario/comercio/miembro_kuntur — el lado Kuntur) y
// "admin_blackfit" (usuarios alumno/entrenador y sus membresías — el lado
// Black Fit). El admin general ("administrador") entra a los dos.
export const obtenerAdminComerciosActual = cache(
  async (): Promise<{ usuario: UsuarioActual } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario) return null;
    if (!tieneRol(usuario, "administrador") && !tieneRol(usuario, "admin_comercios")) {
      return null;
    }
    return { usuario };
  }
);

export const obtenerAdminBlackfitActual = cache(
  async (): Promise<{ usuario: UsuarioActual } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario) return null;
    if (!tieneRol(usuario, "administrador") && !tieneRol(usuario, "admin_blackfit")) {
      return null;
    }
    return { usuario };
  }
);

// Cualquiera de los tres roles administrativos — usado por el layout de
// /admin para decidir si deja entrar, no para autorizar acciones puntuales
// (eso lo hace cada acción con el check más específico de arriba).
export function tieneAccesoAdmin(usuario: UsuarioActual | null): boolean {
  return (
    tieneRol(usuario, "administrador") ||
    tieneRol(usuario, "admin_comercios") ||
    tieneRol(usuario, "admin_blackfit")
  );
}

// Un usuario "comercio" siempre debe tener, además del rol, un perfil de
// Comercio creado (nombre, categoría, etc.). Ambas cosas se crean juntas
// en `crearComercio` — nunca se asigna el rol "comercio" suelto, así se
// evita un estado inconsistente (rol sin perfil).
export const obtenerComercioActual = cache(
  async (): Promise<{ usuario: UsuarioActual; id_comercio: string } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "comercio") || !usuario.comercio) {
      return null;
    }
    return { usuario, id_comercio: usuario.comercio.id_comercio };
  }
);
