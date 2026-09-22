"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";
import { subirAvatar } from "@/lib/storage";

export type EstadoUsuario = { error?: string; message?: string } | undefined;

export async function actualizarInformacionPersonal(
  _prev: EstadoUsuario,
  formData: FormData
): Promise<EstadoUsuario> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const foto = formData.get("foto_perfil");

  if (!nombre || !apellido) {
    return { error: "Nombre y apellido son obligatorios." };
  }

  // La foto es opcional: si no se elige un archivo nuevo, foto_perfil no
  // se toca (se guarda undefined y Prisma no lo incluye en el UPDATE).
  let foto_perfil: string | undefined;
  if (foto instanceof File && foto.size > 0) {
    const url = await subirAvatar("usuarios", usuario.id_usuario, foto);
    if (!url) return { error: "No se pudo subir la foto. Probá con otra imagen (máx. 4 MB)." };
    foto_perfil = url;
  }

  await prisma.usuario.update({
    where: { id_usuario: usuario.id_usuario },
    data: { nombre, apellido, telefono, ...(foto_perfil ? { foto_perfil } : {}) },
  });

  revalidatePath("/panel/perfil");
  revalidatePath("/panel/perfil/informacion-personal");
  revalidatePath("/coach/perfil");
  revalidatePath("/beneficiario/perfil");
  return { message: "Tus datos se actualizaron." };
}
