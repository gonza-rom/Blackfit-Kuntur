"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerUsuarioActual } from "@/lib/auth";

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

  if (!nombre || !apellido) {
    return { error: "Nombre y apellido son obligatorios." };
  }

  await prisma.usuario.update({
    where: { id_usuario: usuario.id_usuario },
    data: { nombre, apellido, telefono },
  });

  revalidatePath("/panel/perfil");
  revalidatePath("/panel/perfil/informacion-personal");
  revalidatePath("/beneficiario/perfil");
  return { message: "Tus datos se actualizaron." };
}
