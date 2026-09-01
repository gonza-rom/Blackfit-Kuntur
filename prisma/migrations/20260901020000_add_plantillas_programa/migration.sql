-- Biblioteca de programas: una plantilla es un ProgramaEntrenamiento sin
-- alumno todavía (id_alumno nulo, es_plantilla = true). Bloques y
-- ejercicios_programa funcionan exactamente igual sobre una plantilla que
-- sobre un programa real (nunca referencian al alumno directamente, solo
-- a través del programa) — no hace falta tocar esas tablas.
--
-- "Aplicar" una plantilla clona programa + bloques + ejercicios en un
-- programa real con id_alumno seteado; la plantilla original queda
-- intacta para reusar con el próximo alumno.

-- AlterTable
ALTER TABLE "programas_entrenamiento" ALTER COLUMN "id_alumno" DROP NOT NULL;
ALTER TABLE "programas_entrenamiento" ADD COLUMN "es_plantilla" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "programas_entrenamiento_id_entrenador_es_plantilla_idx" ON "programas_entrenamiento"("id_entrenador", "es_plantilla");
