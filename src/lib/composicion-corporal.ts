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
