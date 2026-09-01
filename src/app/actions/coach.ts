"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import type { EstadoPrograma, TipoObjetivo, EstadoObjetivo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import { evaluarLogros } from "@/lib/gamificacion";
import { TAG_CATALOGO_EJERCICIOS } from "@/lib/catalogos";

const TIPOS_OBJETIVO: TipoObjetivo[] = [
  "volumen",
  "frecuencia",
  "habito",
  "peso_corporal",
  "custom",
];
const ESTADOS_OBJETIVO: EstadoObjetivo[] = [
  "activo",
  "cumplido",
  "vencido",
  "cancelado",
];

export type EstadoCoach = { error?: string; message?: string } | undefined;

// especialidad/biografía son propias de Entrenador (no de Usuario, que ya
// se edita con actualizarInformacionPersonal en actions/usuario.ts).
export async function actualizarPerfilEntrenador(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const especialidad = String(formData.get("especialidad") ?? "").trim() || null;
  const biografia = String(formData.get("biografia") ?? "").trim() || null;

  await prisma.entrenador.update({
    where: { id_entrenador: contexto.id_entrenador },
    data: { especialidad, biografia },
  });

  revalidatePath("/coach/perfil");
  return { message: "Perfil actualizado." };
}

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

// No borra la relación ni el historial del alumno — solo corta el
// vínculo activo (mismo criterio que ya usa el resto de la app: nunca
// destruir datos reales por una acción de baja). vincularAlumno ya sabe
// reactivar una relación "finalizada" si el alumno vuelve.
export async function desvincularAlumno(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_alumno = String(formData.get("id_alumno") ?? "");
  if (!id_alumno) return;

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
  });
  if (!relacion || relacion.estado_relacion !== "activa") return;

  await prisma.relacionEntrenadorAlumno.update({
    where: { id_relacion: relacion.id_relacion },
    data: { estado_relacion: "finalizada", fecha_fin: new Date() },
  });

  revalidatePath("/coach/alumnos");
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

  const series_defaultRaw = String(formData.get("series_default") ?? "").trim();
  const repeticiones_default = String(formData.get("repeticiones_default") ?? "").trim() || null;
  const peso_sugerido_defaultRaw = String(formData.get("peso_sugerido_default") ?? "").trim();
  const tempo_default = String(formData.get("tempo_default") ?? "").trim() || null;
  const descanso_default = String(formData.get("descanso_default") ?? "").trim() || null;
  const metodo_entrenamiento_default =
    String(formData.get("metodo_entrenamiento_default") ?? "").trim() || null;
  const tut_defaultRaw = String(formData.get("tiempo_bajo_tension_default") ?? "").trim();

  await prisma.ejercicio.create({
    data: {
      nombre,
      descripcion,
      grupo_muscular,
      video_url,
      instrucciones,
      series_default: series_defaultRaw ? Number(series_defaultRaw) : null,
      repeticiones_default,
      peso_sugerido_default: peso_sugerido_defaultRaw || null,
      tempo_default,
      descanso_default,
      metodo_entrenamiento_default,
      tiempo_bajo_tension_default: tut_defaultRaw ? Number(tut_defaultRaw) : null,
    },
  });

  updateTag(TAG_CATALOGO_EJERCICIOS);
  redirect("/coach/ejercicios");
}

export async function editarEjercicio(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_ejercicio = String(formData.get("id_ejercicio") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id_ejercicio || !nombre) return { error: "El nombre es obligatorio." };

  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const grupo_muscular = String(formData.get("grupo_muscular") ?? "").trim() || null;
  const video_url = String(formData.get("video_url") ?? "").trim() || null;
  const instrucciones = String(formData.get("instrucciones") ?? "").trim() || null;

  const series_defaultRaw = String(formData.get("series_default") ?? "").trim();
  const repeticiones_default = String(formData.get("repeticiones_default") ?? "").trim() || null;
  const peso_sugerido_defaultRaw = String(formData.get("peso_sugerido_default") ?? "").trim();
  const tempo_default = String(formData.get("tempo_default") ?? "").trim() || null;
  const descanso_default = String(formData.get("descanso_default") ?? "").trim() || null;
  const metodo_entrenamiento_default =
    String(formData.get("metodo_entrenamiento_default") ?? "").trim() || null;
  const tut_defaultRaw = String(formData.get("tiempo_bajo_tension_default") ?? "").trim();

  await prisma.ejercicio.update({
    where: { id_ejercicio },
    data: {
      nombre,
      descripcion,
      grupo_muscular,
      video_url,
      instrucciones,
      series_default: series_defaultRaw ? Number(series_defaultRaw) : null,
      repeticiones_default,
      peso_sugerido_default: peso_sugerido_defaultRaw || null,
      tempo_default,
      descanso_default,
      metodo_entrenamiento_default,
      tiempo_bajo_tension_default: tut_defaultRaw ? Number(tut_defaultRaw) : null,
    },
  });

  updateTag(TAG_CATALOGO_EJERCICIOS);
  redirect("/coach/ejercicios");
}

// No se borra si ya se usó en algún bloque de algún programa (real o
// plantilla) — eso rompería el historial de series ya registradas contra
// ese ejercicio. Se puede seguir editando igual.
export async function eliminarEjercicio(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_ejercicio = String(formData.get("id_ejercicio") ?? "");
  if (!id_ejercicio) return { error: "Ejercicio inválido." };

  const usos = await prisma.ejercicioPrograma.count({ where: { id_ejercicio } });
  if (usos > 0) {
    return {
      error: `No se puede eliminar: ya se usó en ${usos} programa(s)/plantilla(s). Editalo si hace falta corregirlo.`,
    };
  }

  await prisma.ejercicio.delete({ where: { id_ejercicio } });
  updateTag(TAG_CATALOGO_EJERCICIOS);
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
    include: { alumno: { include: { usuario: true } } },
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

  await crearNotificacion({
    id_usuario: relacion.alumno.usuario.id_usuario,
    titulo: "Tenés un programa nuevo",
    contenido: `${contexto.usuario.nombre} te asignó "${nombre}". Todavía no tiene ejercicios cargados — te va a avisar cuando esté lista.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  redirect(`/coach/programas/${programa.id_programa}`);
}

export async function editarPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_programa = String(formData.get("id_programa") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const fecha_inicio = String(formData.get("fecha_inicio") ?? "");
  const fecha_finRaw = String(formData.get("fecha_fin") ?? "");
  const estado_programa = String(formData.get("estado_programa") ?? "activo") as EstadoPrograma;

  if (!id_programa || !nombre || !fecha_inicio) {
    return { error: "Completá nombre y fecha de inicio." };
  }

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
  });
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || programa.es_plantilla) {
    return { error: "No autorizado sobre este programa." };
  }

  await prisma.programaEntrenamiento.update({
    where: { id_programa },
    data: {
      nombre,
      descripcion,
      objetivo,
      fecha_inicio: new Date(fecha_inicio),
      fecha_fin: fecha_finRaw ? new Date(fecha_finRaw) : null,
      estado_programa,
    },
  });

  revalidatePath(`/coach/programas/${id_programa}`);
  redirect(`/coach/programas/${id_programa}`);
}

// ------------------------------------------------------------
// BIBLIOTECA DE PROGRAMAS (plantillas)
// ------------------------------------------------------------
// Una plantilla es un ProgramaEntrenamiento sin alumno todavía
// (id_alumno null, es_plantilla true). Se arma una sola vez — con sus
// bloques y ejercicios — y se "aplica" a cada alumno que la necesite, en
// vez de rehacer todo desde cero para cada uno. crearBloque,
// crearEjercicioPrograma, duplicarBloque, eliminarBloque, etc. funcionan
// sin cambios sobre una plantilla: solo validan `programa.id_entrenador`,
// nunca al alumno.

export async function crearPlantillaPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;

  if (!nombre) return { error: "Completá el nombre de la plantilla." };

  const plantilla = await prisma.programaEntrenamiento.create({
    data: {
      id_entrenador: contexto.id_entrenador,
      nombre,
      descripcion,
      objetivo,
      fecha_inicio: new Date(),
      es_plantilla: true,
    },
  });

  redirect(`/coach/programas/plantillas/${plantilla.id_programa}`);
}

export async function eliminarPlantilla(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_plantilla = String(formData.get("id_plantilla") ?? "");
  if (!id_plantilla) return;

  const plantilla = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa: id_plantilla },
  });
  if (!plantilla || plantilla.id_entrenador !== contexto.id_entrenador || !plantilla.es_plantilla) {
    return;
  }

  await prisma.programaEntrenamiento.delete({ where: { id_programa: id_plantilla } });
  revalidatePath("/coach/programas/plantillas");
}

/**
 * Clona una plantilla (bloques + ejercicios incluidos) en un programa
 * real para un alumno puntual. La plantilla original queda intacta,
 * lista para aplicarse de nuevo con el próximo alumno.
 */
export async function aplicarPlantilla(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_plantilla = String(formData.get("id_plantilla") ?? "");
  const id_alumno = String(formData.get("id_alumno") ?? "");
  const fecha_inicioRaw = String(formData.get("fecha_inicio") ?? "");

  if (!id_plantilla || !id_alumno) {
    return { error: "Elegí un alumno." };
  }

  const [plantilla, relacion] = await Promise.all([
    prisma.programaEntrenamiento.findUnique({
      where: { id_programa: id_plantilla },
      include: {
        bloques: { include: { ejercicios_programa: true }, orderBy: { orden: "asc" } },
      },
    }),
    prisma.relacionEntrenadorAlumno.findUnique({
      where: {
        id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
      },
      include: { alumno: { include: { usuario: true } } },
    }),
  ]);

  if (!plantilla || plantilla.id_entrenador !== contexto.id_entrenador || !plantilla.es_plantilla) {
    return { error: "Plantilla inválida." };
  }
  if (!relacion || relacion.estado_relacion !== "activa") {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  const programa = await prisma.programaEntrenamiento.create({
    data: {
      id_alumno,
      id_entrenador: contexto.id_entrenador,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      objetivo: plantilla.objetivo,
      fecha_inicio: fecha_inicioRaw ? new Date(fecha_inicioRaw) : new Date(),
      estado_programa: "activo",
      bloques: {
        create: plantilla.bloques.map((b) => ({
          nombre: b.nombre,
          orden: b.orden,
          semana_inicio: b.semana_inicio,
          semana_fin: b.semana_fin,
          tipo: b.tipo,
          ejercicios_programa: {
            create: b.ejercicios_programa.map((ep) => ({
              id_ejercicio: ep.id_ejercicio,
              series: ep.series,
              repeticiones: ep.repeticiones,
              peso_sugerido: ep.peso_sugerido,
              tempo: ep.tempo,
              descanso: ep.descanso,
              metodo_entrenamiento: ep.metodo_entrenamiento,
              tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
              orden: ep.orden,
            })),
          },
        })),
      },
    },
  });

  await crearNotificacion({
    id_usuario: relacion.alumno.usuario.id_usuario,
    titulo: "Tenés un programa nuevo",
    contenido: `${contexto.usuario.nombre} te asignó "${plantilla.nombre}", ya con los ejercicios cargados — arrancá cuando quieras.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
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

/** Trae el id_programa a partir de un id_bloque, validando que sea del entrenador logueado. */
async function bloqueDelEntrenador(id_bloque: string, id_entrenador: string) {
  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true },
  });
  if (!bloque || bloque.programa.id_entrenador !== id_entrenador) return null;
  return bloque;
}

export async function actualizarEjercicioPrograma(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_ejercicio_programa = String(formData.get("id_ejercicio_programa") ?? "");
  const seriesRaw = String(formData.get("series") ?? "").trim();
  const repeticiones = String(formData.get("repeticiones") ?? "").trim();
  const peso_sugeridoRaw = String(formData.get("peso_sugerido") ?? "").trim();
  const tempo = String(formData.get("tempo") ?? "").trim() || null;
  const descanso = String(formData.get("descanso") ?? "").trim() || null;
  const metodo_entrenamiento = String(formData.get("metodo_entrenamiento") ?? "").trim() || null;
  const tutRaw = String(formData.get("tiempo_bajo_tension_sugerido") ?? "").trim();

  if (!id_ejercicio_programa || !seriesRaw || !repeticiones) {
    return { error: "Completá series y repeticiones." };
  }

  const existente = await prisma.ejercicioPrograma.findUnique({
    where: { id_ejercicio_programa },
    include: { bloque: { include: { programa: true } } },
  });
  if (!existente || existente.bloque.programa.id_entrenador !== contexto.id_entrenador) {
    return { error: "No autorizado sobre este ejercicio." };
  }

  await prisma.ejercicioPrograma.update({
    where: { id_ejercicio_programa },
    data: {
      series: Number(seriesRaw),
      repeticiones,
      peso_sugerido: peso_sugeridoRaw || null,
      tempo,
      descanso,
      metodo_entrenamiento,
      tiempo_bajo_tension_sugerido: tutRaw ? Number(tutRaw) : null,
    },
  });

  revalidatePath(`/coach/programas/${existente.bloque.id_programa}`);
  return { message: "Ejercicio actualizado." };
}

export async function eliminarEjercicioPrograma(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_ejercicio_programa = String(formData.get("id_ejercicio_programa") ?? "");
  if (!id_ejercicio_programa) return;

  const existente = await prisma.ejercicioPrograma.findUnique({
    where: { id_ejercicio_programa },
    include: { bloque: { include: { programa: true } } },
  });
  if (!existente || existente.bloque.programa.id_entrenador !== contexto.id_entrenador) return;

  await prisma.ejercicioPrograma.delete({ where: { id_ejercicio_programa } });
  revalidatePath(`/coach/programas/${existente.bloque.id_programa}`);
}

/** Sube o baja un ejercicio dentro de su bloque, intercambiando `orden` con el vecino. */
export async function moverEjercicioPrograma(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_ejercicio_programa = String(formData.get("id_ejercicio_programa") ?? "");
  const direccion = String(formData.get("direccion") ?? "");
  if (!id_ejercicio_programa || (direccion !== "arriba" && direccion !== "abajo")) return;

  const actual = await prisma.ejercicioPrograma.findUnique({
    where: { id_ejercicio_programa },
    include: { bloque: { include: { programa: true } } },
  });
  if (!actual || actual.bloque.programa.id_entrenador !== contexto.id_entrenador) return;

  const hermanos = await prisma.ejercicioPrograma.findMany({
    where: { id_bloque: actual.id_bloque },
    orderBy: { orden: "asc" },
  });
  const idx = hermanos.findIndex((e) => e.id_ejercicio_programa === id_ejercicio_programa);
  const idxVecino = direccion === "arriba" ? idx - 1 : idx + 1;
  if (idxVecino < 0 || idxVecino >= hermanos.length) return;

  const vecino = hermanos[idxVecino];

  await prisma.$transaction([
    prisma.ejercicioPrograma.update({
      where: { id_ejercicio_programa: actual.id_ejercicio_programa },
      data: { orden: vecino.orden },
    }),
    prisma.ejercicioPrograma.update({
      where: { id_ejercicio_programa: vecino.id_ejercicio_programa },
      data: { orden: actual.orden },
    }),
  ]);

  revalidatePath(`/coach/programas/${actual.bloque.id_programa}`);
}

export async function eliminarBloque(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_bloque = String(formData.get("id_bloque") ?? "");
  if (!id_bloque) return;

  const bloque = await bloqueDelEntrenador(id_bloque, contexto.id_entrenador);
  if (!bloque) return;

  await prisma.bloqueEntrenamiento.delete({ where: { id_bloque } });
  revalidatePath(`/coach/programas/${bloque.id_programa}`);
}

/**
 * Duplica un bloque completo (con todos sus ejercicios, series, reps,
 * tempo, descanso, etc.) al final del programa — el flujo real de armar
 * una rutina es "semana 2 = semana 1 pero con más peso", no escribir todo
 * de cero cada vez. Las semanas del bloque nuevo se corren automáticamente
 * si el original tenía semana_inicio/semana_fin definidas.
 */
export async function duplicarBloque(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_bloque = String(formData.get("id_bloque") ?? "");
  if (!id_bloque) return;

  const original = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: { programa: true, ejercicios_programa: { orderBy: { orden: "asc" } } },
  });
  if (!original || original.programa.id_entrenador !== contexto.id_entrenador) return;

  const cantidadBloques = await prisma.bloqueEntrenamiento.count({
    where: { id_programa: original.id_programa },
  });

  const duracionSemanas =
    original.semana_inicio != null && original.semana_fin != null
      ? original.semana_fin - original.semana_inicio + 1
      : null;

  await prisma.bloqueEntrenamiento.create({
    data: {
      id_programa: original.id_programa,
      nombre: `${original.nombre} (copia)`,
      orden: cantidadBloques + 1,
      tipo: original.tipo,
      semana_inicio: original.semana_fin != null ? original.semana_fin + 1 : null,
      semana_fin:
        original.semana_fin != null && duracionSemanas != null
          ? original.semana_fin + duracionSemanas
          : null,
      ejercicios_programa: {
        create: original.ejercicios_programa.map((ep) => ({
          id_ejercicio: ep.id_ejercicio,
          series: ep.series,
          repeticiones: ep.repeticiones,
          peso_sugerido: ep.peso_sugerido,
          tempo: ep.tempo,
          descanso: ep.descanso,
          metodo_entrenamiento: ep.metodo_entrenamiento,
          tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
          orden: ep.orden,
        })),
      },
    },
  });

  revalidatePath(`/coach/programas/${original.id_programa}`);
}

/** Avisa al alumno (in-app + push) que la rutina está lista para arrancar. */
export async function avisarAlumnoRutinaLista(formData: FormData): Promise<void> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return;

  const id_programa = String(formData.get("id_programa") ?? "");
  if (!id_programa) return;

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
    include: { alumno: { include: { usuario: true } } },
  });
  // Una plantilla (alumno null) nunca debería llegar acá — el botón no se
  // muestra en esa vista — pero se valida igual por si el id vino
  // manipulado directamente.
  if (!programa || programa.id_entrenador !== contexto.id_entrenador || !programa.alumno) return;

  await crearNotificacion({
    id_usuario: programa.alumno.usuario.id_usuario,
    titulo: "Tu rutina está lista",
    contenido: `"${programa.nombre}" ya tiene todos los ejercicios cargados — arrancá cuando quieras.`,
    tipo: "programa",
    url: "/panel/entrenamientos",
  });

  revalidatePath(`/coach/programas/${id_programa}`);
}

// ------------------------------------------------------------
// GAMIFICACIÓN — objetivos del alumno (los crea/edita el coach)
// ------------------------------------------------------------

/** Valida que el alumno esté en la cartera activa del entrenador logueado. */
async function alumnoDelEntrenador(id_alumno: string, id_entrenador: string) {
  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: { id_entrenador_id_alumno: { id_entrenador, id_alumno } },
  });
  return relacion?.estado_relacion === "activa" ? relacion : null;
}

export async function crearObjetivo(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_alumno = String(formData.get("id_alumno") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "custom") as TipoObjetivo;
  const metaRaw = String(formData.get("meta") ?? "").trim();
  const fecha_objetivoRaw = String(formData.get("fecha_objetivo") ?? "").trim();

  if (!id_alumno || !titulo || !metaRaw) {
    return { error: "Completá alumno, título y meta." };
  }
  if (!TIPOS_OBJETIVO.includes(tipo)) {
    return { error: "Tipo de objetivo inválido." };
  }
  const meta = Number(metaRaw);
  if (!Number.isFinite(meta) || meta <= 0) {
    return { error: "La meta tiene que ser un número mayor a 0." };
  }

  if (!(await alumnoDelEntrenador(id_alumno, contexto.id_entrenador))) {
    return { error: "Ese alumno no está vinculado a tu cartera." };
  }

  await prisma.objetivo.create({
    data: {
      id_alumno,
      titulo,
      descripcion,
      tipo,
      meta: metaRaw,
      fecha_objetivo: fecha_objetivoRaw ? new Date(fecha_objetivoRaw) : null,
    },
  });

  revalidatePath(`/coach/alumnos/${id_alumno}`);
  return { message: "Objetivo creado." };
}

export async function actualizarObjetivo(
  _prev: EstadoCoach,
  formData: FormData
): Promise<EstadoCoach> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const id_objetivo = String(formData.get("id_objetivo") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "custom") as TipoObjetivo;
  const metaRaw = String(formData.get("meta") ?? "").trim();
  const progresoRaw = String(formData.get("progreso_actual") ?? "").trim();
  const estado = String(formData.get("estado") ?? "activo") as EstadoObjetivo;
  const fecha_objetivoRaw = String(formData.get("fecha_objetivo") ?? "").trim();

  if (!id_objetivo || !titulo || !metaRaw) {
    return { error: "Completá título y meta." };
  }
  if (!TIPOS_OBJETIVO.includes(tipo) || !ESTADOS_OBJETIVO.includes(estado)) {
    return { error: "Tipo o estado inválido." };
  }
  const meta = Number(metaRaw);
  const progreso = progresoRaw ? Number(progresoRaw) : 0;
  if (!Number.isFinite(meta) || meta <= 0 || !Number.isFinite(progreso) || progreso < 0) {
    return { error: "Meta y progreso tienen que ser números válidos." };
  }

  const objetivo = await prisma.objetivo.findUnique({
    where: { id_objetivo },
  });
  if (
    !objetivo ||
    !(await alumnoDelEntrenador(objetivo.id_alumno, contexto.id_entrenador))
  ) {
    return { error: "No autorizado sobre este objetivo." };
  }

  await prisma.objetivo.update({
    where: { id_objetivo },
    data: {
      titulo,
      descripcion,
      tipo,
      meta: metaRaw,
      progreso_actual: progresoRaw || "0",
      estado,
      fecha_objetivo: fecha_objetivoRaw ? new Date(fecha_objetivoRaw) : null,
    },
  });

  // Si el objetivo pasó a "cumplido", puede haber destrabado un logro.
  if (estado === "cumplido" && objetivo.estado !== "cumplido") {
    await evaluarLogros(objetivo.id_alumno).catch(() => {});
    const alumno = await prisma.alumno.findUnique({
      where: { id_alumno: objetivo.id_alumno },
      select: { id_usuario: true },
    });
    if (alumno) {
      await crearNotificacion({
        id_usuario: alumno.id_usuario,
        titulo: "Objetivo cumplido",
        contenido: `Marcaste "${titulo}" como cumplido. ¡Bien ahí!`,
        tipo: "objetivo",
        url: "/panel/logros",
      }).catch(() => {});
    }
  }

  revalidatePath(`/coach/alumnos/${objetivo.id_alumno}`);
  return { message: "Objetivo actualizado." };
}
