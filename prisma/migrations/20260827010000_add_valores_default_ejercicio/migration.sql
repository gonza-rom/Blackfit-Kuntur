-- AlterTable
-- Valores por defecto para cuando el ejercicio se agrega a un bloque de
-- un programa (no reemplazan lo guardado en ejercicios_programa, que
-- sigue siendo el valor real usado en cada rutina).
ALTER TABLE "ejercicios" ADD COLUMN     "series_default" INTEGER,
ADD COLUMN     "repeticiones_default" TEXT,
ADD COLUMN     "peso_sugerido_default" DECIMAL(6,2),
ADD COLUMN     "tempo_default" TEXT,
ADD COLUMN     "descanso_default" TEXT,
ADD COLUMN     "metodo_entrenamiento_default" TEXT,
ADD COLUMN     "tiempo_bajo_tension_default" INTEGER;
