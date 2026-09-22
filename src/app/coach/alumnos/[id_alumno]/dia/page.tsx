import { notFound, redirect } from "next/navigation";
import type { DiaSemana } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { obtenerEjerciciosCatalogoConDefaults } from "@/lib/catalogos";
import { FormDiaPlan } from "./_components/form-dia-plan";

const DIAS_VALIDOS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const ETIQUETA_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export default async function DiaPlanPage(
  props: PageProps<"/coach/alumnos/[id_alumno]/dia">
) {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const { id_alumno } = await props.params;
  const sp = await props.searchParams;

  const id_programa = typeof sp.programa === "string" ? sp.programa : "";
  const semana_inicio = Number(sp.semana_inicio);
  const semana_fin = Number(sp.semana_fin);
  const dia = typeof sp.dia === "string" ? sp.dia : "";

  if (
    !id_programa ||
    !Number.isFinite(semana_inicio) ||
    !Number.isFinite(semana_fin) ||
    !DIAS_VALIDOS.includes(dia as (typeof DIAS_VALIDOS)[number])
  ) {
    notFound();
  }

  const [programa, ejercicioExistente, catalogo] = await Promise.all([
    prisma.programaEntrenamiento.findUnique({ where: { id_programa } }),
    prisma.bloqueEntrenamiento.findFirst({
      where: { id_programa, semana_inicio, semana_fin, dia_semana: dia as DiaSemana },
      include: { ejercicios_programa: { orderBy: { orden: "asc" }, include: { ejercicio: true } } },
    }),
    obtenerEjerciciosCatalogoConDefaults(),
  ]);

  if (
    !programa ||
    programa.id_entrenador !== contexto.id_entrenador ||
    programa.id_alumno !== id_alumno
  ) {
    notFound();
  }

  const alumno = await prisma.alumno.findUnique({
    where: { id_alumno },
    include: { usuario: { select: { nombre: true, apellido: true } } },
  });
  if (!alumno) notFound();

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {ETIQUETA_DIA[dia]}
        </h1>
        <p className="text-sm text-on-surface-variant">
          {alumno.usuario.nombre} {alumno.usuario.apellido} · semana
          {semana_inicio === semana_fin ? ` ${semana_inicio}` : `s ${semana_inicio}-${semana_fin}`}
        </p>
      </div>

      <FormDiaPlan
        idPrograma={id_programa}
        idAlumno={id_alumno}
        semanaInicio={semana_inicio}
        semanaFin={semana_fin}
        diaSemana={dia}
        catalogo={catalogo}
        ejerciciosIniciales={ejercicioExistente?.ejercicios_programa.map((ep) => ({
          id_ejercicio: ep.id_ejercicio,
          nombre: ep.ejercicio.nombre,
          series: String(ep.series),
          repeticiones: ep.repeticiones,
          peso_sugerido: ep.peso_sugerido?.toString() ?? "",
          descanso: ep.descanso ?? "",
          tempo: ep.tempo ?? "",
          metodo_entrenamiento: ep.metodo_entrenamiento ?? "",
          tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido?.toString() ?? "",
          nota: ep.nota ?? "",
        })) ?? []}
      />
    </main>
  );
}
