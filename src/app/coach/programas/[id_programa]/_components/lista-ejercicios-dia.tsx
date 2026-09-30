import type { Prisma } from "@prisma/client";
import { ETIQUETA_TIPO_BLOQUE, agruparItemsDia, nombreDeBloque, tipoDeBloque } from "@/lib/plan-dia";
import { EjercicioProgramaItem } from "./ejercicio-programa-item";

type EjercicioConDetalle = Prisma.EjercicioProgramaGetPayload<{ include: { ejercicio: true } }>;
type Grupo = Prisma.GrupoEjerciciosGetPayload<object>;

// Lista de ejercicios de un día/bloque del programa, respetando la
// estructura que ve el alumno: los ejercicios sueltos como filas y los
// bloques (superserie/triserie/circuito) enmarcados con su encabezado.
// Los bloques se arman desde el editor del día (perfil del alumno →
// Planificación); acá se ven y se ajustan ejercicio por ejercicio.
export function ListaEjerciciosDia({
  ejercicios,
  grupos,
}: {
  ejercicios: EjercicioConDetalle[];
  grupos: Grupo[];
}) {
  if (ejercicios.length === 0) return null;

  const posicion = new Map(ejercicios.map((ep, i) => [ep.id_ejercicio_programa, i]));

  function fila(ep: EjercicioConDetalle) {
    const idx = posicion.get(ep.id_ejercicio_programa) ?? 0;
    return (
      <EjercicioProgramaItem
        key={ep.id_ejercicio_programa}
        ejercicio={{
          id_ejercicio_programa: ep.id_ejercicio_programa,
          nombre: ep.ejercicio.nombre,
          series: ep.series,
          repeticiones: ep.repeticiones,
          peso_sugerido: ep.peso_sugerido ? ep.peso_sugerido.toString() : null,
          tempo: ep.tempo,
          descanso: ep.descanso,
          metodo_entrenamiento: ep.metodo_entrenamiento,
          tiempo_bajo_tension_sugerido: ep.tiempo_bajo_tension_sugerido,
        }}
        esPrimero={idx === 0}
        esUltimo={idx === ejercicios.length - 1}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {agruparItemsDia(ejercicios, grupos).map((item) => {
        if (item.tipo === "ejercicio") return fila(item.ejercicio);
        const tipo = tipoDeBloque(item.ejercicios.length);
        return (
          <div
            key={item.grupo.id_grupo}
            className="border-2 border-primary-container/30 rounded-lg overflow-hidden my-1"
          >
            <div className="bg-primary-container/10 px-3 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase text-primary-container">
                {nombreDeBloque(item.grupo.nombre, item.indiceBloque)} ·{" "}
                {tipo === "individual" ? "Bloque" : ETIQUETA_TIPO_BLOQUE[tipo]} · {item.grupo.rondas} rondas
              </span>
              {(item.grupo.descanso_entre_ejercicios || item.grupo.descanso_entre_rondas) && (
                <span className="text-[11px] text-on-surface-variant">
                  {item.grupo.descanso_entre_ejercicios ? `Entre ejercicios ${item.grupo.descanso_entre_ejercicios}` : ""}
                  {item.grupo.descanso_entre_ejercicios && item.grupo.descanso_entre_rondas ? " · " : ""}
                  {item.grupo.descanso_entre_rondas ? `Entre rondas ${item.grupo.descanso_entre_rondas}` : ""}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 p-1.5">{item.ejercicios.map(fila)}</div>
          </div>
        );
      })}
    </div>
  );
}
