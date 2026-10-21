// Nombres de campo compartidos entre el formulario de composición corporal
// (src/app/coach/alumnos/[id_alumno]/_components/progreso-fisico-coach.tsx),
// la acción que los guarda (src/app/actions/coach.ts) y el parser de
// documentos (src/lib/parseo-composicion-corporal.ts). Un solo lugar para
// no desincronizar la lista si se agrega o quita un campo.
export type CampoComposicionCorporal =
  | "peso_corporal"
  | "imc"
  | "pulso"
  | "porcentaje_graso"
  | "porcentaje_agua"
  | "porcentaje_musculo"
  | "masa_osea"
  | "metabolismo_basal"
  | "metabolismo_activo"
  | "grasa_visceral"
  | "edad_metabolica"
  | "soft_lean_mass"
  | "lean_body_mass"
  | "proteina"
  | "masa_muscular";

// Los 5 indicadores que muestra el perfil del alumno y que el lector de
// PDF/Word completa. El resto de los campos de arriba se siguen pudiendo
// cargar a mano, pero el lector no los toca.
export const CAMPOS_PERFIL_COMPOSICION = [
  "peso_corporal",
  "imc",
  "porcentaje_graso",
  "grasa_visceral",
  "porcentaje_musculo",
] as const satisfies readonly CampoComposicionCorporal[];

export type CampoPerfilComposicion = (typeof CAMPOS_PERFIL_COMPOSICION)[number];
