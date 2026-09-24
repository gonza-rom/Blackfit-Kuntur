"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  otorgarLogrosManualesIniciales,
  registrarLogin,
  evaluarLogros,
} from "@/lib/gamificacion";
import { crearNotificacion } from "@/lib/notificaciones";

export type EstadoAuth = { error?: string; message?: string } | undefined;

export async function iniciarSesion(
  _prevState: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const identificador = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identificador || !password) {
    return { error: "Completá email/DNI y contraseña." };
  }

  // Cuentas dadas de alta sin email propio (beneficiarios importados de
  // Kuntur, o alumnos que carga el coach desde /coach/alumnos/nuevo) se
  // loguean con su DNI. En vez de reconstruir el email sintético con el
  // que se creó la cuenta (dependería de saber qué alta lo generó), se
  // busca directo por DNI el email real con el que quedó registrado.
  let email = identificador;
  if (!identificador.includes("@")) {
    const dni = identificador.replace(/\D/g, "");
    const usuario = await prisma.usuario.findUnique({
      where: { dni },
      select: { email: true },
    });
    if (!usuario) {
      return { error: "Email o contraseña incorrectos." };
    }
    email = usuario.email;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
  }

  // Un usuario dado de baja (inactivo/suspendido) tiene credenciales
  // válidas pero no puede entrar: se cierra la sesión que se acaba de
  // abrir y se devuelve el motivo.
  if (data.user) {
    const perfil = await prisma.usuario.findUnique({
      where: { id_usuario: data.user.id },
      select: { estado_usuario: true, alumno: { select: { id_alumno: true } } },
    });
    if (perfil && perfil.estado_usuario !== "activo") {
      await supabase.auth.signOut();
      return {
        error:
          perfil.estado_usuario === "suspendido"
            ? "Tu cuenta está suspendida. Contactá al equipo de Black Hub."
            : "Tu cuenta está inactiva. Contactá al equipo de Black Hub.",
      };
    }

    // Racha de login (para los logros automáticos de actividad de uso) y
    // re-evaluación de logros oportunista — nunca bloquea el login si algo
    // de esto falla (ambas funciones son silenciosas por diseño).
    await registrarLogin(data.user.id);
    if (perfil?.alumno) {
      await evaluarLogros(perfil.alumno.id_alumno).catch(() => {});
    }
  }

  redirect("/panel");
}

export async function registrarse(
  _prevState: EstadoAuth,
  formData: FormData
): Promise<EstadoAuth> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  // Tres altas posibles desde el mismo form: alumno (default), beneficiario
  // Kuntur puro, o comercio (ver bloque de campos de negocio más abajo).
  const tipo = String(formData.get("tipo") ?? "");
  const esBeneficiario = tipo === "beneficiario";
  const esComercio = tipo === "comercio";

  if (!nombre || !apellido || !email || !password) {
    return { error: "Completá todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const nombreComercio = String(formData.get("nombre_comercio") ?? "").trim();
  const categoriaComercio = String(formData.get("categoria") ?? "").trim() || null;
  const telefonoComercio = String(formData.get("telefono") ?? "").trim() || null;
  const direccionComercio = String(formData.get("direccion") ?? "").trim() || null;
  const descripcionComercio = String(formData.get("descripcion") ?? "").trim() || null;

  if (esComercio && !nombreComercio) {
    return { error: "Completá el nombre de tu comercio." };
  }

  // Sin esto, GoTrue usa el Site URL configurado en Supabase como destino
  // del link del mail de confirmación (ver /auth/confirm), que en el
  // dashboard puede estar apuntando a localhost. Construir el origin acá
  // asegura que el link siempre vuelva al mismo host desde el que se
  // registró el usuario, sea local o producción.
  const encabezados = await headers();
  const origin = `${encabezados.get("x-forwarded-proto") ?? "http"}://${encabezados.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, apellido },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  const nuevoUsuario = await prisma.usuario.create({
    data: {
      id_usuario: data.user.id,
      email,
      nombre,
      apellido,
      // El beneficiario no recibe perfil de Alumno ni ningún rol de Black
      // Fit: solo el rol "beneficiario". El comercio se crea junto con su
      // perfil de Comercio en el mismo paso — nunca queda el rol suelto
      // sin fila Comercio (mismo cuidado que crearComercio en admin.ts).
      // Arranca en "pendiente": un admin lo revisa antes de que sus
      // beneficios puedan quedar visibles para los socios.
      roles: {
        create: { rol: esComercio ? "comercio" : esBeneficiario ? "beneficiario" : "alumno" },
      },
      ...(esComercio
        ? {
            comercio: {
              create: {
                nombre: nombreComercio,
                categoria: categoriaComercio,
                telefono: telefonoComercio,
                direccion: direccionComercio,
                descripcion: descripcionComercio,
                estado: "pendiente",
              },
            },
          }
        : esBeneficiario
          ? {}
          : { alumno: { create: {} } }),
    },
    include: { alumno: true, comercio: true },
  });

  // Arranca con todos los logros manuales de la biblioteca (ver
  // otorgarLogrosManualesIniciales) — así nadie queda con menos insignias
  // que el resto solo por registrarse después.
  if (nuevoUsuario.alumno) {
    await otorgarLogrosManualesIniciales(nuevoUsuario.alumno.id_alumno);
  }

  // Avisa a los admins que hay un comercio nuevo esperando revisión.
  // Best-effort: nunca bloquea el alta si falla.
  if (nuevoUsuario.comercio) {
    try {
      const admins = await prisma.usuario.findMany({
        where: { roles: { some: { rol: { in: ["administrador", "admin_comercios"] } } } },
        select: { id_usuario: true },
      });
      await Promise.all(
        admins.map((a) =>
          crearNotificacion({
            id_usuario: a.id_usuario,
            titulo: "Nuevo comercio para revisar",
            contenido: `${nombreComercio} se registró y está esperando aprobación.`,
            tipo: "comercio",
            url: `/admin/comercios/${nuevoUsuario.comercio!.id_comercio}`,
          })
        )
      );
    } catch {
      // Silencioso a propósito.
    }
  }

  if (!data.session) {
    return { message: "Cuenta creada. Revisá tu email para confirmarla." };
  }

  redirect(esComercio ? "/comercio" : esBeneficiario ? "/beneficiario" : "/panel");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/iniciar-sesion");
}
