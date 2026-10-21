-- Progresión de fuerza: 1RM de referencia con historial, configuración de
-- aproximaciones por ejercicio del plan y copia del objetivo en cada serie
-- registrada. Aditivo y no destructivo: lo existente queda igual.

-- CreateEnum
CREATE TYPE "Levantamiento" AS ENUM ('sentadilla', 'press_banca', 'peso_muerto');

-- AlterTable
ALTER TABLE "ejercicios_programa" ADD COLUMN     "alumno_edita_aproximaciones" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aproximaciones" JSONB,
ADD COLUMN     "progresion_fuerza" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "entrenamientos" ADD COLUMN     "semana_programa" INTEGER;

-- AlterTable
ALTER TABLE "series_entrenamiento" ADD COLUMN     "agregada_por_alumno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aproximaciones_plan" INTEGER,
ADD COLUMN     "peso_objetivo" TEXT,
ADD COLUMN     "porcentaje_objetivo" TEXT,
ADD COLUMN     "repeticiones_objetivo" TEXT,
ADD COLUMN     "tipo_serie" TEXT;

-- CreateTable
CREATE TABLE "rm_referencia" (
    "id_rm" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "levantamiento" "Levantamiento" NOT NULL,
    "valor_kg" DECIMAL(6,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_autor" TEXT,
    "nota" TEXT,

    CONSTRAINT "rm_referencia_pkey" PRIMARY KEY ("id_rm")
);

-- CreateIndex
CREATE INDEX "rm_referencia_id_alumno_levantamiento_fecha_idx" ON "rm_referencia"("id_alumno", "levantamiento", "fecha");

-- AddForeignKey
ALTER TABLE "rm_referencia" ADD CONSTRAINT "rm_referencia_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;


-- Misma política que el resto de las tablas (ver 20261009000000).
ALTER TABLE "rm_referencia" ENABLE ROW LEVEL SECURITY;
