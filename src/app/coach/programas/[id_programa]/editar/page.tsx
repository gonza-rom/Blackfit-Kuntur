import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { FormEditarPrograma } from "./_components/form-editar-programa";

function aFechaInput(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export default async function EditarProgramaPage(
  props: PageProps<"/coach/programas/[id_programa]/editar">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_programa } = await props.params;

  const programa = await prisma.programaEntrenamiento.findUnique({
    where: { id_programa },
    include: { alumno: { include: { usuario: true } } },
  });

  if (
    !programa ||
    programa.id_entrenador !== contexto.id_entrenador ||
    programa.es_plantilla ||
    !programa.alumno
  ) {
    notFound();
  }

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Editar programa
        </h1>
        <p className="text-sm text-on-surface-variant">
          {programa.alumno.usuario.nombre} {programa.alumno.usuario.apellido}
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormEditarPrograma
          programa={{
            id_programa: programa.id_programa,
            nombre: programa.nombre,
            descripcion: programa.descripcion,
            objetivo: programa.objetivo,
            fecha_inicio: aFechaInput(programa.fecha_inicio),
            fecha_fin: programa.fecha_fin ? aFechaInput(programa.fecha_fin) : null,
            estado_programa: programa.estado_programa,
          }}
        />
      </div>
    </main>
  );
}
