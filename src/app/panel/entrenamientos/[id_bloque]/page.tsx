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
        orderBy: { orden: "asc" },
        include: { ejercicio: true },
      },
    },
  });

  if (!bloque || bloque.programa.id_alumno !== contexto.id_alumno) {
    notFound();
  }

  const ejercicios = bloque.ejercicios_programa.map((ep) => ({
    id_ejercicio_programa: ep.id_ejercicio_programa,
    series: ep.series,
    repeticiones: ep.repeticiones,
    peso_sugerido: ep.peso_sugerido ? ep.peso_sugerido.toString() : null,
    tempo: ep.tempo,
    descanso: ep.descanso,
    metodo_entrenamiento: ep.metodo_entrenamiento,
    tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
    ejercicio: { nombre: ep.ejercicio.nombre },
  }));

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {bloque.nombre}
        </h1>
        <p className="text-sm text-on-surface-variant">{bloque.programa.nombre}</p>
      </div>

      <FormRegistrarEntrenamiento idBloque={id_bloque} ejercicios={ejercicios} />
    </main>
  );
}
