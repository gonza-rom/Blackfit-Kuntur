-- Récords personales automáticos (PR de carga / repeticiones) y origen
-- de cada 1RM. Aditivo y no destructivo: una tabla nueva y columnas
-- nulas / con default en rm_referencia (lo existente queda como "coach").

-- AlterTable
ALTER TABLE "rm_referencia" ADD COLUMN     "clave_operacion" TEXT,
ADD COLUMN     "id_entrenamiento" TEXT,
ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'coach',
ADD COLUMN     "peso_registrado" DECIMAL(6,2),
ADD COLUMN     "repeticiones_registradas" INTEGER;

-- CreateTable
CREATE TABLE "records_personales" (
    "id_record" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "levantamiento" "Levantamiento" NOT NULL,
    "tipo" TEXT NOT NULL,
    "peso_kg" DECIMAL(6,2) NOT NULL,
    "repeticiones" INTEGER NOT NULL,
    "valor_anterior" DECIMAL(6,2),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_entrenamiento" TEXT,
    "id_serie" TEXT,
    "clave_operacion" TEXT,

    CONSTRAINT "records_personales_pkey" PRIMARY KEY ("id_record")
);

-- CreateIndex
CREATE UNIQUE INDEX "records_personales_clave_operacion_key" ON "records_personales"("clave_operacion");

-- CreateIndex
CREATE INDEX "records_personales_id_alumno_levantamiento_fecha_idx" ON "records_personales"("id_alumno", "levantamiento", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "records_personales_id_entrenamiento_levantamiento_tipo_key" ON "records_personales"("id_entrenamiento", "levantamiento", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "rm_referencia_clave_operacion_key" ON "rm_referencia"("clave_operacion");

-- CreateIndex
CREATE UNIQUE INDEX "rm_referencia_id_entrenamiento_levantamiento_key" ON "rm_referencia"("id_entrenamiento", "levantamiento");

-- AddForeignKey
ALTER TABLE "records_personales" ADD CONSTRAINT "records_personales_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;


-- Misma política que el resto de las tablas (ver 20261009000000).
ALTER TABLE "records_personales" ENABLE ROW LEVEL SECURITY;
