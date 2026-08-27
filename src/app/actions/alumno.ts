"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { guardarSesionEntrenamiento, type SerieRegistrada } from "@/lib/alumno";

export type EstadoAlumno = { error?: string; message?: string } | undefined;

function inicioDelDia(fecha = new Date()): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function numeroOpcional(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  return texto ? Number(texto) : null;
}

function textoOpcional(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? "").trim();
  return texto || null;
}

export async function registrarEntrenamiento(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const id_bloque = String(formData.get("id_bloque") ?? "");
  if (!id_bloque) return { error: "Falta el bloque." };

  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { ejercicios_programa: true },
  });
  if (!bloque) return { error: "Bloque inválido." };

  const comentarioGeneral = textoOpcional(formData.get("comentario_general"));

  const series: SerieRegistrada[] = bloque.ejercicios_programa.map((ep) => ({
    id_ejercicio_programa: ep.id_ejercicio_programa,
    peso_utilizado: numeroOpcional(formData.get(`peso_${ep.id_ejercicio_programa}`)),
    repeticiones_realizadas: numeroOpcional(formData.get(`reps_${ep.id_ejercicio_programa}`)),
    series_completadas: numeroOpcional(formData.get(`series_${ep.id_ejercicio_programa}`)),
    rpe: numeroOpcional(formData.get(`rpe_${ep.id_ejercicio_programa}`)),
    descanso_real: numeroOpcional(formData.get(`descanso_${ep.id_ejercicio_programa}`)),
    tiempo_bajo_tension: numeroOpcional(formData.get(`tut_${ep.id_ejercicio_programa}`)),
    comentarios: textoOpcional(formData.get(`comentario_${ep.id_ejercicio_programa}`)),
  }));

  const resultado = await guardarSesionEntrenamiento(
    contexto.id_alumno,
    id_bloque,
    comentarioGeneral,
    series
  );
  if (resultado.error) return { error: resultado.error };

  redirect("/panel/entrenamientos");
}

export async function registrarHabito(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const hoy = inicioDelDia();

  const sueno = numeroOpcional(formData.get("sueno"));
  const agua = textoOpcional(formData.get("agua"));
  const nutricion = numeroOpcional(formData.get("nutricion"));
  const suplementacion = formData.get("suplementacion") === "on";
  const cardio = formData.get("cardio") === "on";
  const movilidad = formData.get("movilidad") === "on";
  const recuperacion = numeroOpcional(formData.get("recuperacion"));

  await prisma.habito.upsert({
    where: {
      id_alumno_fecha: { id_alumno: contexto.id_alumno, fecha: hoy },
    },
    update: { sueno, agua, nutricion, suplementacion, cardio, movilidad, recuperacion },
    create: {
      id_alumno: contexto.id_alumno,
      fecha: hoy,
      sueno,
      agua,
      nutricion,
      suplementacion,
      cardio,
      movilidad,
      recuperacion,
    },
  });

  revalidatePath("/panel/seguimiento/habitos");
  return { message: "Hábitos de hoy guardados." };
}

export async function registrarFeedbackDiario(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const comentario_diario = String(formData.get("comentario_diario") ?? "").trim();
  if (!comentario_diario) return { error: "Escribí algo antes de guardar." };

  await prisma.feedbackDiario.create({
    data: { id_alumno: contexto.id_alumno, comentario_diario },
  });

  revalidatePath("/panel/seguimiento/feedback");
  return { message: "Feedback diario guardado." };
}

export async function registrarFeedbackSemanal(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const semana_inicio = String(formData.get("semana_inicio") ?? "");
  const comentario_semanal = String(formData.get("comentario_semanal") ?? "").trim();
  if (!semana_inicio || !comentario_semanal) {
    return { error: "Completá la semana y el comentario." };
  }

  await prisma.feedbackSemanal.create({
    data: {
      id_alumno: contexto.id_alumno,
      semana_inicio: new Date(semana_inicio),
      comentario_semanal,
    },
  });

  revalidatePath("/panel/seguimiento/feedback");
  return { message: "Feedback semanal guardado." };
}

export async function registrarProgresoFisico(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const peso_corporal = textoOpcional(formData.get("peso_corporal"));
  const porcentaje_graso = textoOpcional(formData.get("porcentaje_graso"));
  const masa_muscular = textoOpcional(formData.get("masa_muscular"));

  if (!peso_corporal && !porcentaje_graso && !masa_muscular) {
    return { error: "Cargá al menos un dato." };
  }

  await prisma.progresoFisico.create({
    data: {
      id_alumno: contexto.id_alumno,
      peso_corporal,
      porcentaje_graso,
      masa_muscular,
    },
  });

  revalidatePath("/panel/seguimiento/progreso");
  return { message: "Progreso físico guardado." };
}

export async function registrarMedidaCorporal(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const tipo_medida = String(formData.get("tipo_medida") ?? "").trim();
  const valor_cm = textoOpcional(formData.get("valor_cm"));

  if (!tipo_medida || !valor_cm) {
    return { error: "Completá el tipo de medida y el valor." };
  }

  await prisma.medidaCorporal.create({
    data: { id_alumno: contexto.id_alumno, tipo_medida, valor_cm },
  });

  revalidatePath("/panel/seguimiento/progreso");
  return { message: "Medida guardada." };
}
