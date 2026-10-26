import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual, exigirMembresiaActiva } from "@/lib/auth";
import { FormRegistrarEntrenamientoCliente } from "./_components/form-registrar-entrenamiento-cliente";
import {
  aproximacionesDeSemana,
  cargaDe1RM,
  detectarLevantamiento,
  objetivoEfectiva,
  progresionHabilitada,
  NOMBRE_SEMANA,
} from "@/lib/progresion-fuerza";
import { semanaDeLaSesion } from "@/lib/alumno";
import { etiquetaSesion } from "@/lib/secuencia";
import { obtenerRmVigentes, obtenerPasoRedondeo } from "@/lib/rm-referencia";

export default async function RegistrarEntrenamientoPage(
  props: PageProps<"/panel/entrenamientos/[id_bloque]">
) {
  // Con la membresía vencida solo queda el perfil: acá, aviso de renovación.
  await exigirMembresiaActiva();

  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const { id_bloque } = await props.params;

  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: {
      programa: {
        include: {
          bloques: {
            select: {
              id_bloque: true,
              numero_dia: true,
              semana_inicio: true,
              semana_fin: true,
              _count: { select: { ejercicios_programa: { where: { archivado: false } } } },
            },
          },
        },
      },
      ejercicios_programa: {
        where: { archivado: false },
        orderBy: { orden: "asc" },
        include: { ejercicio: true },
      },
      grupos: true,
    },
  });

  if (!bloque || bloque.programa.id_alumno !== contexto.id_alumno) {
    notFound();
  }

  // Progresión de fuerza: semana del ciclo y 1RM vigente. El servidor
  // vuelve a calcular todo esto al guardar (no confía en el cliente).
  // Semana: en Progresión semanal por calendario (ciclo de 4 que se
  // repite); en otro plan por sesiones, según las completadas.
  const semana = await semanaDeLaSesion(
    bloque.programa,
    bloque,
    bloque.programa.bloques.map((b) => ({ ...b, cantidadEjercicios: b._count.ejercicios_programa }))
  );
  // "Rutina fija" nunca calcula cargas por 1RM.
  const conProgresion =
    progresionHabilitada(bloque.programa.tipo_planificacion) &&
    bloque.ejercicios_programa.some((ep) => ep.progresion_fuerza);
  const [rmVigentes, paso] = conProgresion
    ? await Promise.all([obtenerRmVigentes(contexto.id_alumno), obtenerPasoRedondeo(bloque.programa.id_entrenador)])
    : [null, undefined];

  // Progresión semanal: una semana sin aproximaciones propias repite las de la 1.
  const heredarSemana1 = bloque.programa.tipo_planificacion === "semanal";

  function datosFuerza(ep: NonNullable<typeof bloque>["ejercicios_programa"][number]) {
    if (!conProgresion || !ep.progresion_fuerza || ep.id_grupo) return null;
    const levantamiento = detectarLevantamiento(ep.ejercicio.nombre);
    if (!levantamiento) return null;
    // Cada levantamiento con SU 1RM.
    const rm = rmVigentes?.[levantamiento]?.valor ?? null;
    const efectiva = objetivoEfectiva(
      semana,
      rm,
      { porcentajes: ep.porcentajes_semana, cargasFijas: ep.cargas_fijas },
      paso
    );
    return {
      semana,
      nombreSemana: NOMBRE_SEMANA[semana],
      rm,
      rmEstimado: rmVigentes?.[levantamiento]?.fuente === "estimado",
      efectiva: {
        porcentaje: efectiva.porcentaje,
        peso: efectiva.peso,
        fija: efectiva.fija,
        reps: ep.repeticiones,
        series: Math.max(1, ep.series),
      },
      descanso: ep.descanso,
      tempo: ep.tempo,
      aproximaciones: aproximacionesDeSemana(
        ep.aproximaciones,
        semana,
        heredarSemana1
      ).map((a) => ({
        reps: a.reps,
        porcentaje: a.porcentaje,
        peso: a.porcentaje != null && rm ? cargaDe1RM(rm, a.porcentaje, paso) : null,
      })),
      alumnoEdita: ep.alumno_edita_aproximaciones,
    };
  }

  const ejercicios = bloque.ejercicios_programa.map((ep) => ({
    id_ejercicio_programa: ep.id_ejercicio_programa,
    id_grupo: ep.id_grupo,
    series: ep.series,
    repeticiones: ep.repeticiones,
    peso_sugerido: ep.peso_sugerido ? ep.peso_sugerido.toString() : null,
    tempo: ep.tempo,
    descanso: ep.descanso,
    metodo_entrenamiento: ep.metodo_entrenamiento,
    tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
    nota: ep.nota,
    fuerza: datosFuerza(ep),
    ejercicio: {
      id_ejercicio: ep.ejercicio.id_ejercicio,
      nombre: ep.ejercicio.nombre,
      grupo_muscular: ep.ejercicio.grupo_muscular,
      descripcion: ep.ejercicio.descripcion,
      instrucciones: ep.ejercicio.instrucciones,
      video_url: ep.ejercicio.video_url,
    },
  }));

  const grupos = bloque.grupos.map((g) => ({
    id_grupo: g.id_grupo,
    nombre: g.nombre,
    rondas: g.rondas,
    descanso_entre_ejercicios: g.descanso_entre_ejercicios,
    descanso_entre_rondas: g.descanso_entre_rondas,
    tempo: g.tempo,
    nota: g.nota,
  }));

  // "Día 2 — Tren superior": el orden de la sesión, nunca un día de la semana.
  const titulo = etiquetaSesion(bloque.numero_dia, bloque.nombre);

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {titulo}
        </h1>
        <p className="text-sm text-on-surface-variant">
          {bloque.programa.nombre}
          {bloque.numero_dia != null
            ? ` · Semana ${semana} de 4${bloque.programa.tipo_planificacion === "semanal" ? ` (${NOMBRE_SEMANA[semana]})` : ""}`
            : ""}
        </p>
      </div>

      <FormRegistrarEntrenamientoCliente
        idAlumno={contexto.id_alumno}
        idBloque={id_bloque}
        titulo={titulo}
        ejercicios={ejercicios}
        grupos={grupos}
      />
    </main>
  );
}
