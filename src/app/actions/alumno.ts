"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { guardarSesionEntrenamiento, type SerieRegistrada } from "@/lib/alumno";
import { registrarActividad, PUNTOS, claveDia } from "@/lib/gamificacion";
import {
  subirFotoProgreso,
  borrarFotoProgreso,
} from "@/lib/storage";

function archivoOpcional(valor: FormDataEntryValue | null): File | null {
  return valor instanceof File && valor.size > 0 ? valor : null;
}

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

// Solo borra — editar una sesión ya registrada (con sus series por
// ejercicio) es un form mucho más grande que el resto de este archivo;
// si se cargó mal, se borra y se vuelve a registrar. Cascade se lleva
// las series solas (ver onDelete: Cascade en SerieEntrenamiento).
export async function eliminarEntrenamiento(formData: FormData): Promise<void> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return;

  const id_entrenamiento = String(formData.get("id_entrenamiento") ?? "");
  if (!id_entrenamiento) return;

  const entrenamiento = await prisma.entrenamiento.findUnique({
    where: { id_entrenamiento },
  });
  if (!entrenamiento || entrenamiento.id_alumno !== contexto.id_alumno) return;

  await prisma.entrenamiento.delete({ where: { id_entrenamiento } });
  revalidatePath("/panel/entrenamientos/historial");
  revalidatePath("/panel/entrenamientos");
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

  // Gamificación: puntos una sola vez por día (el `motivo` lleva la fecha).
  await registrarActividad(
    contexto.id_alumno,
    `habito:${claveDia(hoy)}`,
    PUNTOS.habito_registrado,
    "Hábitos del día registrados"
  );

  revalidatePath("/panel/seguimiento/habitos");
  return { message: "Hábitos de hoy guardados." };
}

// No hace falta un "editar" separado: registrarHabito ya hace upsert por
// día (id_alumno_fecha), así que volver a cargar el form de un día lo
// sobreescribe. Esto es solo para borrar un día cargado mal.
export async function eliminarHabito(formData: FormData): Promise<void> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return;

  const id_habito = String(formData.get("id_habito") ?? "");
  if (!id_habito) return;

  const habito = await prisma.habito.findUnique({ where: { id_habito } });
  if (!habito || habito.id_alumno !== contexto.id_alumno) return;

  await prisma.habito.delete({ where: { id_habito } });
  revalidatePath("/panel/seguimiento/habitos");
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

  // Gamificación: puntos una sola vez por día aunque cargue varios feedbacks.
  await registrarActividad(
    contexto.id_alumno,
    `feedback_diario:${claveDia()}`,
    PUNTOS.feedback_diario,
    "Feedback diario cargado"
  );

  revalidatePath("/panel/seguimiento/feedback");
  return { message: "Feedback diario guardado." };
}

export async function editarFeedbackDiario(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const id_feedback_diario = String(formData.get("id_feedback_diario") ?? "");
  const comentario_diario = String(formData.get("comentario_diario") ?? "").trim();
  if (!id_feedback_diario || !comentario_diario) {
    return { error: "Escribí algo antes de guardar." };
  }

  const existente = await prisma.feedbackDiario.findUnique({ where: { id_feedback_diario } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) {
    return { error: "No autorizado." };
  }

  await prisma.feedbackDiario.update({
    where: { id_feedback_diario },
    data: { comentario_diario },
  });

  revalidatePath("/panel/seguimiento/feedback");
  return { message: "Feedback actualizado." };
}

export async function eliminarFeedbackDiario(formData: FormData): Promise<void> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return;

  const id_feedback_diario = String(formData.get("id_feedback_diario") ?? "");
  if (!id_feedback_diario) return;

  const existente = await prisma.feedbackDiario.findUnique({ where: { id_feedback_diario } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) return;

  await prisma.feedbackDiario.delete({ where: { id_feedback_diario } });
  revalidatePath("/panel/seguimiento/feedback");
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

export async function editarFeedbackSemanal(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const id_feedback_semanal = String(formData.get("id_feedback_semanal") ?? "");
  const comentario_semanal = String(formData.get("comentario_semanal") ?? "").trim();
  if (!id_feedback_semanal || !comentario_semanal) {
    return { error: "Escribí un comentario." };
  }

  const existente = await prisma.feedbackSemanal.findUnique({ where: { id_feedback_semanal } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) {
    return { error: "No autorizado." };
  }

  await prisma.feedbackSemanal.update({
    where: { id_feedback_semanal },
    data: { comentario_semanal },
  });

  revalidatePath("/panel/seguimiento/feedback");
  return { message: "Feedback actualizado." };
}

export async function eliminarFeedbackSemanal(formData: FormData): Promise<void> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return;

  const id_feedback_semanal = String(formData.get("id_feedback_semanal") ?? "");
  if (!id_feedback_semanal) return;

  const existente = await prisma.feedbackSemanal.findUnique({ where: { id_feedback_semanal } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) return;

  await prisma.feedbackSemanal.delete({ where: { id_feedback_semanal } });
  revalidatePath("/panel/seguimiento/feedback");
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

export async function editarProgresoFisico(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const id_progreso = String(formData.get("id_progreso") ?? "");
  if (!id_progreso) return { error: "Registro inválido." };

  const peso_corporal = textoOpcional(formData.get("peso_corporal"));
  const porcentaje_graso = textoOpcional(formData.get("porcentaje_graso"));
  const masa_muscular = textoOpcional(formData.get("masa_muscular"));

  if (!peso_corporal && !porcentaje_graso && !masa_muscular) {
    return { error: "Cargá al menos un dato." };
  }

  const existente = await prisma.progresoFisico.findUnique({ where: { id_progreso } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) {
    return { error: "No autorizado." };
  }

  await prisma.progresoFisico.update({
    where: { id_progreso },
    data: { peso_corporal, porcentaje_graso, masa_muscular },
  });

  revalidatePath("/panel/seguimiento/progreso");
  return { message: "Progreso actualizado." };
}

export async function eliminarProgresoFisico(formData: FormData): Promise<void> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return;

  const id_progreso = String(formData.get("id_progreso") ?? "");
  if (!id_progreso) return;

  const existente = await prisma.progresoFisico.findUnique({ where: { id_progreso } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) return;

  await prisma.progresoFisico.delete({ where: { id_progreso } });
  revalidatePath("/panel/seguimiento/progreso");
}

export async function registrarMedidaCorporal(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const tipo_medida = String(formData.get("tipo_medida") ?? "").trim();
  const valor_cm = textoOpcional(formData.get("valor_cm"));
  const foto = archivoOpcional(formData.get("foto"));

  if (!tipo_medida || !valor_cm) {
    return { error: "Completá el tipo de medida y el valor." };
  }

  const medida = await prisma.medidaCorporal.create({
    data: { id_alumno: contexto.id_alumno, tipo_medida, valor_cm },
  });

  // La foto es opcional y su subida no es crítica: si falla (Storage sin
  // configurar, archivo inválido), la medida queda igual guardada.
  if (foto) {
    const path = await subirFotoProgreso(contexto.id_alumno, medida.id_medida, foto);
    if (path) {
      await prisma.medidaCorporal.update({
        where: { id_medida: medida.id_medida },
        data: { foto_url: path },
      });
    }
  }

  revalidatePath("/panel/seguimiento/progreso");
  return {
    message: foto
      ? "Medida y foto guardadas."
      : "Medida guardada.",
  };
}

export async function editarMedidaCorporal(
  _prev: EstadoAlumno,
  formData: FormData
): Promise<EstadoAlumno> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return { error: "No autorizado." };

  const id_medida = String(formData.get("id_medida") ?? "");
  const tipo_medida = String(formData.get("tipo_medida") ?? "").trim();
  const valor_cm = textoOpcional(formData.get("valor_cm"));
  const foto = archivoOpcional(formData.get("foto"));
  const quitarFoto = formData.get("quitar_foto") === "on";

  if (!id_medida || !tipo_medida || !valor_cm) {
    return { error: "Completá el tipo de medida y el valor." };
  }

  const existente = await prisma.medidaCorporal.findUnique({ where: { id_medida } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) {
    return { error: "No autorizado." };
  }

  let foto_url = existente.foto_url;
  if (quitarFoto) {
    await borrarFotoProgreso(existente.foto_url);
    foto_url = null;
  } else if (foto) {
    const path = await subirFotoProgreso(contexto.id_alumno, id_medida, foto);
    if (path) {
      // Reemplaza la anterior si había una en otro path.
      if (existente.foto_url && existente.foto_url !== path) {
        await borrarFotoProgreso(existente.foto_url);
      }
      foto_url = path;
    }
  }

  await prisma.medidaCorporal.update({
    where: { id_medida },
    data: { tipo_medida, valor_cm, foto_url },
  });

  revalidatePath("/panel/seguimiento/progreso");
  return { message: "Medida actualizada." };
}

export async function eliminarMedidaCorporal(formData: FormData): Promise<void> {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) return;

  const id_medida = String(formData.get("id_medida") ?? "");
  if (!id_medida) return;

  const existente = await prisma.medidaCorporal.findUnique({ where: { id_medida } });
  if (!existente || existente.id_alumno !== contexto.id_alumno) return;

  await borrarFotoProgreso(existente.foto_url);
  await prisma.medidaCorporal.delete({ where: { id_medida } });
  revalidatePath("/panel/seguimiento/progreso");
}
