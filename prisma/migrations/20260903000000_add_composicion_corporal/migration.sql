-- ============================================================
-- COMPOSICIÓN CORPORAL COMPLETA en progreso_fisico
-- ============================================================
-- El coach puede cargar la medición completa de balanza/InBody de cada
-- alumno desde su panel. Todas las columnas nuevas son NULLABLE y sin
-- DEFAULT: la migración no reescribe ninguna fila existente.
-- ============================================================

-- AlterTable
ALTER TABLE "progreso_fisico" ADD COLUMN     "imc" DECIMAL(4,2),
ADD COLUMN     "pulso" INTEGER,
ADD COLUMN     "porcentaje_agua" DECIMAL(4,2),
ADD COLUMN     "porcentaje_musculo" DECIMAL(4,2),
ADD COLUMN     "masa_osea" DECIMAL(4,2),
ADD COLUMN     "metabolismo_basal" INTEGER,
ADD COLUMN     "metabolismo_activo" INTEGER,
ADD COLUMN     "grasa_visceral" INTEGER,
ADD COLUMN     "edad_metabolica" INTEGER,
ADD COLUMN     "soft_lean_mass" DECIMAL(5,2),
ADD COLUMN     "lean_body_mass" DECIMAL(5,2),
ADD COLUMN     "proteina" DECIMAL(5,2),
ADD COLUMN     "origen" TEXT;
