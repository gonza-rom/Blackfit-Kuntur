import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { FormNuevoPrograma } from "./_components/form-nuevo-programa";

export default async function NuevoProgramaPage(
  props: PageProps<"/coach/alumnos/[id_alumno]/programas/nuevo">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
    include: { alumno: { include: { usuario: true } } },
  });

  if (!relacion || relacion.estado_relacion !== "activa") {
    notFound();
  }

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Nuevo programa
        </h1>
        <p className="text-sm text-on-surface-variant">
          Para {relacion.alumno.usuario.nombre} {relacion.alumno.usuario.apellido}
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormNuevoPrograma idAlumno={id_alumno} />
      </div>

      <p className="text-sm text-on-surface-variant text-center">
        ¿Ya tenés una rutina armada?{" "}
        <Link
          href="/coach/programas/plantillas"
          className="text-primary-container underline underline-offset-2"
        >
          Aplicá una plantilla
        </Link>{" "}
        en vez de repetirla desde cero.
      </p>
    </main>
  );
}
