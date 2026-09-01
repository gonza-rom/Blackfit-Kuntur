import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { FormEditarEjercicio } from "./_components/form-editar-ejercicio";
import { BotonEliminarEjercicio } from "./_components/boton-eliminar-ejercicio";

export default async function EditarEjercicioPage(
  props: PageProps<"/coach/ejercicios/[id_ejercicio]/editar">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_ejercicio } = await props.params;

  const ejercicio = await prisma.ejercicio.findUnique({ where: { id_ejercicio } });
  if (!ejercicio) notFound();

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Editar ejercicio
      </h1>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarEjercicio
          ejercicio={{
            id_ejercicio: ejercicio.id_ejercicio,
            nombre: ejercicio.nombre,
            descripcion: ejercicio.descripcion,
            grupo_muscular: ejercicio.grupo_muscular,
            video_url: ejercicio.video_url,
            instrucciones: ejercicio.instrucciones,
            series_default: ejercicio.series_default,
            repeticiones_default: ejercicio.repeticiones_default,
            peso_sugerido_default: ejercicio.peso_sugerido_default
              ? ejercicio.peso_sugerido_default.toString()
              : null,
            tempo_default: ejercicio.tempo_default,
            descanso_default: ejercicio.descanso_default,
            metodo_entrenamiento_default: ejercicio.metodo_entrenamiento_default,
            tiempo_bajo_tension_default: ejercicio.tiempo_bajo_tension_default,
          }}
        />
      </div>

      <BotonEliminarEjercicio idEjercicio={ejercicio.id_ejercicio} nombre={ejercicio.nombre} />
    </main>
  );
}
