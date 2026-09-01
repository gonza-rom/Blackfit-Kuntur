import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
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
    // `proxy.ts` ya corrió `auth.getUser()` — la verificación real contra
    // el servidor de Supabase — para esta misma request antes de llegar
    // acá (ver RUTAS_PROTEGIDAS). Repetir esa ida y vuelta de red en cada
    // Server Component que pide la identidad no suma seguridad, solo
    // duplica el costo: la cookie de sesión ya fue validada server-side
    // para este request. `getSession()` la lee local (sin red, salvo que
    // el token esté vencido y haga falta refrescarlo).
    //
    // Lo único que se pierde respecto a `getUser()` acá: si alguien
    // revoca la sesión de este usuario en Supabase Auth a mitad de su
    // token todavía vigente (borrado forzado, "cerrar sesión en todos
    // los dispositivos"), esta capa no se entera hasta que el token
    // expire — el próximo `getUser()` del proxy en su siguiente
    // navegación sí lo va a detectar.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) return null;

    // `relationLoadStrategy: "join"` (requiere el preview `relationJoins` en
    // el generator del schema): sin esto, Prisma resuelve cada relación del
    // `include` como una consulta SQL separada — acá eran 4 relaciones, y
    // como el pool de Supabase está en modo transacción, cada ida y vuelta
    // adicional cuesta ~100ms. Con "join" todo sale en un solo SELECT.
    // Medido: 8 queries/~1.2s → 4 queries/~0.75s en esta función, que se
    // llama en casi todas las páginas.
    return prisma.usuario.findUnique({
      where: { id_usuario: user.id },
      include: { roles: true, alumno: true, entrenador: true, comercio: true },
      relationLoadStrategy: "join",
    });
  }
);

export function tieneRol(usuario: UsuarioActual | null, rol: RolUsuario): boolean {
  return usuario?.roles.some((r) => r.rol === rol) ?? false;
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

export const obtenerAlumnoActual = cache(
  async (): Promise<{ usuario: UsuarioActual; id_alumno: string } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "alumno") || !usuario.alumno) {
      return null;
    }
    return { usuario, id_alumno: usuario.alumno.id_alumno };
  }
);

// Un "beneficiario" es Kuntur puro: solo accede a /beneficiario (beneficios
// + su perfil). No tiene perfil de Alumno/Entrenador ni debe tener otros
// roles de Black Fit — si los tuviera, esos otros roles mandan y el usuario
// entra por /panel|/coach|/admin como corresponda.
export const obtenerBeneficiarioActual = cache(
  async (): Promise<{ usuario: UsuarioActual } | null> => {
    const usuario = await obtenerUsuarioActual();
    if (!usuario || !tieneRol(usuario, "beneficiario")) {
      return null;
    }
    return { usuario };
  }
);

// True si el usuario es beneficiario y NO tiene ningún rol de Black Fit ni
// operativo: en ese caso su única casa es /beneficiario.
export function soloBeneficiario(usuario: UsuarioActual | null): boolean {
  if (!usuario || !tieneRol(usuario, "beneficiario")) return false;
  return !(
    tieneRol(usuario, "alumno") ||
    tieneRol(usuario, "entrenador") ||
    tieneRol(usuario, "administrador") ||
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
