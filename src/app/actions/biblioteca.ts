"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { CategoriaBiblioteca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual, obtenerAdministradorActual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { TAG_CATALOGO_BIBLIOTECA } from "@/lib/catalogos";

export type EstadoBiblioteca = { error?: string; message?: string } | undefined;

const CATEGORIAS: CategoriaBiblioteca[] = [
  "ejercicios",
  "tecnicas",
  "movilidad",
  "recuperacion",
  "nutricion",
  "metodologia",
];

async function obtenerActorConPermiso() {
  const admin = await obtenerAdministradorActual();
  if (admin) return admin.usuario.id_usuario;

  const coach = await obtenerEntrenadorActual();
  if (coach) return coach.usuario.id_usuario;

  return null;
}

export async function crearRecursoBiblioteca(
  _prev: EstadoBiblioteca,
  formData: FormData
): Promise<EstadoBiblioteca> {
  const idActor = await obtenerActorConPermiso();
  if (!idActor) return { error: "No autorizado." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "") as CategoriaBiblioteca;
  const tipo_contenido = String(formData.get("tipo_contenido") ?? "").trim() || null;
  const url_contenido = String(formData.get("url_contenido") ?? "").trim() || null;

  if (!titulo || !CATEGORIAS.includes(categoria)) {
    return { error: "Completá título y categoría." };
  }

  const recurso = await prisma.biblioteca.create({
    data: { titulo, descripcion, categoria, tipo_contenido, url_contenido },
  });

  await registrarAuditoria({
    id_usuario_actor: idActor,
    accion: "modificacion_admin",
    recurso: "biblioteca",
    id_recurso: recurso.id_recurso,
    resultado: `creado:${recurso.titulo}`,
  });

  updateTag(TAG_CATALOGO_BIBLIOTECA);
  revalidatePath("/coach/biblioteca");
  revalidatePath("/panel/biblioteca");
  return { message: "Recurso publicado." };
}

export async function eliminarRecursoBiblioteca(formData: FormData): Promise<void> {
  const idActor = await obtenerActorConPermiso();
  if (!idActor) return;

  const id_recurso = String(formData.get("id_recurso") ?? "");
  if (!id_recurso) return;

  await prisma.biblioteca.delete({ where: { id_recurso } });

  await registrarAuditoria({
    id_usuario_actor: idActor,
    accion: "modificacion_admin",
    recurso: "biblioteca",
    id_recurso,
    resultado: "eliminado",
  });

  updateTag(TAG_CATALOGO_BIBLIOTECA);
  revalidatePath("/coach/biblioteca");
  revalidatePath("/panel/biblioteca");
}
