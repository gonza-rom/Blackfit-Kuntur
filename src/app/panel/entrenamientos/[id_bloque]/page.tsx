import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { FormRegistrarEntrenamiento } from "./_components/form-registrar-entrenamiento";

export default async function RegistrarEntrenamientoPage(
  props: PageProps<"/panel/entrenamientos/[id_bloque]">
) {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const { id_bloque } = await props.params;

  const bloque = await prisma.bloqueEntrenamiento.findUnique({
    where: { id_bloque },
    include: {
      programa: true,
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

  const ETIQUETA_DIA: Record<string, string> = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    sabado: "Sábado",
    domingo: "Domingo",
  };

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {bloque.dia_semana ? `Hoy — ${ETIQUETA_DIA[bloque.dia_semana]}` : bloque.nombre}
        </h1>
        <p className="text-sm text-on-surface-variant">{bloque.programa.nombre}</p>
      </div>

      <FormRegistrarEntrenamiento idBloque={id_bloque} ejercicios={ejercicios} grupos={grupos} />
    </main>
  );
}
