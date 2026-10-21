import { notFound, redirect } from "next/navigation";
import { numeroDiaValido } from "@/lib/plan-dia-server";
import { nombrePropioSesion } from "@/lib/secuencia";
import type { DiaSemana } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { obtenerEjerciciosCatalogoConDefaults } from "@/lib/catalogos";
import { agruparItemsDia } from "@/lib/plan-dia";
import {
  FormDiaPlan,
  type ItemInicial,
  type OpcionSemanas,
  type RmPorLevantamiento,
} from "./_components/form-dia-plan";
import { normalizarAproximaciones } from "@/lib/progresion-fuerza";
import { obtenerRmVigentes } from "@/lib/rm-referencia";

// Links viejos (?dia=lunes): se traducen al número de sesión que les tocó
// en la migración a sesiones secuenciales.
const DIAS_SEMANA_LEGADO = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

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

  if (!id_programa || !Number.isFinite(semana_inicio) || !Number.isFinite(semana_fin)) {
    notFound();
  }

  if (DIAS_SEMANA_LEGADO.includes(dia)) {
    const legado = await prisma.bloqueEntrenamiento.findFirst({
      where: { id_programa, semana_inicio, semana_fin, dia_semana: dia as DiaSemana, numero_dia: { not: null } },
      select: { numero_dia: true },
    });
    if (!legado?.numero_dia) notFound();
    redirect(
      `/coach/alumnos/${id_alumno}/dia?programa=${id_programa}&semana_inicio=${semana_inicio}&semana_fin=${semana_fin}&dia=${legado.numero_dia}`
    );
  }

  const numero_dia = numeroDiaValido(dia);
  if (numero_dia === null) notFound();

  const [programa, diaExistente, catalogo] = await Promise.all([
    prisma.programaEntrenamiento.findUnique({
      where: { id_programa },
      include: {
        bloques: {
          where: { numero_dia: { not: null } },
          select: { semana_inicio: true, semana_fin: true },
        },
      },
    }),
    prisma.bloqueEntrenamiento.findFirst({
      where: { id_programa, semana_inicio, semana_fin, numero_dia },
      include: {
        ejercicios_programa: {
          where: { archivado: false },
          orderBy: { orden: "asc" },
          include: { ejercicio: true },
        },
        grupos: true,
      },
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

  const vigentes = await obtenerRmVigentes(id_alumno);
  const rmVigentes: RmPorLevantamiento = Object.fromEntries(
    Object.entries(vigentes).flatMap(([l, rm]) => (rm ? [[l, rm.valor]] : []))
  );

  // Semanas a las que se puede copiar un bloque, según el tipo de
  // planificación del programa (mismo criterio que la pestaña Planificación).
  let opcionesSemanas: OpcionSemanas[];
  if (programa.tipo_planificacion === "fija") {
    opcionesSemanas = [{ semana_inicio: 1, semana_fin: 4, etiqueta: "Semanas 1 a 4" }];
  } else if (programa.tipo_planificacion === "semanal") {
    opcionesSemanas = [1, 2, 3, 4].map((s) => ({ semana_inicio: s, semana_fin: s, etiqueta: `Semana ${s}` }));
  } else {
    const vistos = new Map<string, OpcionSemanas>();
    for (const b of [...programa.bloques, { semana_inicio, semana_fin }]) {
      if (b.semana_inicio == null || b.semana_fin == null) continue;
      vistos.set(`${b.semana_inicio}-${b.semana_fin}`, {
        semana_inicio: b.semana_inicio,
        semana_fin: b.semana_fin,
        etiqueta:
          b.semana_inicio === b.semana_fin
            ? `Semana ${b.semana_inicio}`
            : `Semanas ${b.semana_inicio} a ${b.semana_fin}`,
      });
    }
    opcionesSemanas = [...vistos.values()].sort((a, b) => a.semana_inicio - b.semana_inicio);
  }

  const aFila = (ep: NonNullable<typeof diaExistente>["ejercicios_programa"][number]) => ({
    id_ejercicio_programa: ep.id_ejercicio_programa,
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
    progresion_fuerza: ep.progresion_fuerza,
    aproximaciones: Object.fromEntries(
      Object.entries(normalizarAproximaciones(ep.aproximaciones)).map(([semana, lista]) => [
        semana,
        (lista ?? []).map((a) => ({ reps: a.reps, porcentaje: a.porcentaje?.toString() ?? "" })),
      ])
    ),
    alumno_edita_aproximaciones: ep.alumno_edita_aproximaciones,
  });

  const itemsIniciales: ItemInicial[] = diaExistente
    ? agruparItemsDia(diaExistente.ejercicios_programa, diaExistente.grupos).map((item) =>
        item.tipo === "ejercicio"
          ? { tipo: "ejercicio", ejercicio: aFila(item.ejercicio) }
          : {
              tipo: "grupo",
              id_grupo: item.grupo.id_grupo,
              nombre: item.grupo.nombre ?? "",
              rondas: String(item.grupo.rondas),
              descanso_entre_ejercicios: item.grupo.descanso_entre_ejercicios ?? "",
              descanso_entre_rondas: item.grupo.descanso_entre_rondas ?? "",
              tempo: item.grupo.tempo ?? "",
              nota: item.grupo.nota ?? "",
              ejercicios: item.ejercicios.map(aFila),
            }
      )
    : [];

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Día {numero_dia}
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
        numeroDia={numero_dia}
        nombreSesion={nombrePropioSesion(diaExistente?.nombre)}
        catalogo={catalogo}
        itemsIniciales={itemsIniciales}
        opcionesSemanas={opcionesSemanas}
        rmVigentes={rmVigentes}
      />
    </main>
  );
}
