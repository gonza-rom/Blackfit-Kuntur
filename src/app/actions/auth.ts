"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { emailSinteticoBeneficiario } from "@/lib/importarBeneficiarios";

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

  // Los beneficiarios importados de Kuntur (ver importarBeneficiarios en
  // src/app/actions/admin.ts) no tienen email propio: se loguean con su
  // DNI, que se resuelve acá al email sintético con el que se creó su
  // cuenta. Cualquier valor sin "@" se trata como DNI.
  const email = identificador.includes("@")
    ? identificador
    : emailSinteticoBeneficiario(identificador.replace(/\D/g, ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos." };
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
  // Diferencia el alta de un alumno Black Fit del alta de un beneficiario
  // Kuntur puro. Cualquier valor que no sea "beneficiario" cae en el alta
  // de alumno (comportamiento por defecto de siempre).
  const esBeneficiario = String(formData.get("tipo") ?? "") === "beneficiario";

  if (!nombre || !apellido || !email || !password) {
    return { error: "Completá todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido } },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  await prisma.usuario.create({
    data: {
      id_usuario: data.user.id,
      email,
      nombre,
      apellido,
      // El beneficiario NO recibe perfil de Alumno ni ningún rol de Black
      // Fit: solo el rol "beneficiario".
      roles: { create: { rol: esBeneficiario ? "beneficiario" : "alumno" } },
      ...(esBeneficiario ? {} : { alumno: { create: {} } }),
    },
  });

  if (!data.session) {
    return { message: "Cuenta creada. Revisá tu email para confirmarla." };
  }

  redirect(esBeneficiario ? "/beneficiario" : "/panel");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/iniciar-sesion");
}
