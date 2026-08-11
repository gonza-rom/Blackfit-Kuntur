"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { EstadoPrograma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";

export type EstadoCoach = { error?: string; message?: string } | undefined;

export async function vincularAlumno(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Ingresá un email." };

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { roles: true, alumno: true },
  });

  if (!usuario) {
    return { error: "No existe un usuario con ese email." };
  }
  const esAlumno = usuario.roles.some((r) => r.rol === "alumno");
  if (!esAlumno || !usuario.alumno) {
    return { error: "Ese usuario no tiene un perfil de alumno activo." };
  }

  const relacionExistente = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: {
        id_entrenador: contexto.id_entrenador,
        id_alumno: usuario.alumno.id_alumno,
      },
    },
  });

  if (relacionExistente?.estado_relacion === "activa") {
    return { error: "Ese alumno ya está vinculado a tu cartera." };
  }

  if (relacionExistente) {
    await prisma.relacionEntrenadorAlumno.update({
      where: { id_relacion: relacionExistente.id_relacion },
      data: { estado_relacion: "activa", fecha_fin: null },
    });
  } else {
    await prisma.relacionEntrenadorAlumno.create({
      data: {
        id_entrenador: contexto.id_entrenador,
        id_alumno: usuario.alumno.id_alumno,
      },
    });
  }

  redirect("/coach/alumnos");
}

export async function crearEjercicio(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const grupo_muscular = String(formData.get("grupo_muscular") ?? "").trim() || null;
  const video_url = String(formData.get("video_url") ?? "").trim() || null;
  const instrucciones = String(formData.get("instrucciones") ?? "").trim() || null;

  await prisma.ejercicio.create({
    data: { nombre, descripcion, grupo_muscular, video_url, instrucciones },
  });

  redirect("/coach/ejercicios");
}

export async function crearPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const fecha_inicio = String(formData.get("fecha_inicio") ?? "");
  const fecha_finRaw = String(formData.get("fecha_fin") ?? "");
  const estado_programa = String(formData.get("estado_programa") ?? "activo") as EstadoPrograma;

  if (!id_alumno || !nombre || !fecha_inicio) {
    return { error: "Completá alumno, nombre y fecha de inicio." };
  }

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
  });
  if (!relacion || relacion.estado_relacion !== "activa") {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const programa = await prisma.programaEntrenamiento.create({
    data: {
      id_alumno,
      id_entrenador: contexto.id_entrenador,
      nombre,
      descripcion,
      objetivo,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_finRaw ? new Date(fecha_finRaw) : null,
      estado_programa,
    },
  });

  redirect(`/coach/programas/${programa.id_programa}`);
}

export async function crearBloque(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const semana_inicioRaw = String(formData.get("semana_inicio") ?? "").trim();
  const semana_finRaw = String(formData.get("semana_fin") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim() || null;

  if (!id_programa || !nombre) {
    return { error: "Completá el nombre del bloque." };
  }

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
  });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador) {
    return { error: "No autorizado sobre este programa." };
  }

  const cantidadBloques = await prisma.bloqueEntrenamiento.count({
    where: { id_programa },
  });

  await prisma.bloqueEntrenamiento.create({
    data: {
      id_programa,
      nombre,
      orden: cantidadBloques + 1,
      semana_inicio: semana_inicioRaw ? Number(semana_inicioRaw) : null,
      semana_fin: semana_finRaw ? Number(semana_finRaw) : null,
      tipo,
    },
  });

  revalidatePath(`/coach/programas/${id_programa}`);
  return { message: "Bloque creado." };
}

export async function crearEjercicioPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_bloque = String(formData.get("id_bloque") ?? "");
  const id_ejercicio = String(formData.get("id_ejercicio") ?? "");
  const seriesRaw = String(formData.get("series") ?? "").trim();
  const repeticiones = String(formData.get("repeticiones") ?? "").trim();
  const peso_sugeridoRaw = String(formData.get("peso_sugerido") ?? "").trim();
  const tempo = String(formData.get("tempo") ?? "").trim() || null;
  const descanso = String(formData.get("descanso") ?? "").trim() || null;
  const metodo_entrenamiento =
    String(formData.get("metodo_entrenamiento") ?? "").trim() || null;
  const tutRaw = String(formData.get("tiempo_bajo_tension_sugerido") ?? "").trim();

  if (!id_bloque || !id_ejercicio || !seriesRaw || !repeticiones) {
    return { error: "Completá ejercicio, series y repeticiones." };
  }

  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true },
  });
  if (!bloque || bloque.programa.id_entrenador !== contexto.id_entrenador) {
    return { error: "No autorizado sobre este bloque." };
  }

  const cantidadEjercicios = await prisma.ejercicioPrograma.count({
    where: { id_bloque },
  });

  await prisma.ejercicioPrograma.create({
    data: {
      id_bloque,
      id_ejercicio,
      series: Number(seriesRaw),
      repeticiones,
      peso_sugerido: peso_sugeridoRaw || null,
      tempo,
      descanso,
      metodo_entrenamiento,
      tiempo_bajo_tension_sugerido: tutRaw ? Number(tutRaw) : null,
      orden: cantidadEjercicios + 1,
    },
  });

  revalidatePath(`/coach/programas/${bloque.id_programa}`);
  return { message: "Ejercicio agregado al bloque." };
}
