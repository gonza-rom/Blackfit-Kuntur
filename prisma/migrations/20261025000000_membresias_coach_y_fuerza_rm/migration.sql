-- Membresías de Blackfit configurables (1 a 30 días, renovación y
-- suspensión manual), progresión semanal de fuerza con % por semana que
-- fija el coach, redondeo configurable y 1RM con fuente / validación.
-- Aditivo y no destructivo: solo agrega columnas con default o nulas; no
-- reescribe ni borra datos existentes.

-- AlterTable
ALTER TABLE "entrenadores" ADD COLUMN "redondeo_carga_kg" DECIMAL(4,2) NOT NULL DEFAULT 0.5;

-- AlterTable
ALTER TABLE "membresias" ADD COLUMN "dias_contratados" INTEGER,
ADD COLUMN "tipo_operacion" TEXT,
ADD COLUMN "id_usuario_operador" TEXT,
ADD COLUMN "clave_operacion" TEXT,
ADD COLUMN "fecha_suspension" TIMESTAMP(3),
ADD COLUMN "motivo_suspension" TEXT,
ADD COLUMN "id_usuario_suspension" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membresias_clave_operacion_key" ON "membresias"("clave_operacion");

-- AlterTable
ALTER TABLE "programas_entrenamiento" ADD COLUMN "fecha_inicio_ciclo" TIMESTAMP(3),
ADD COLUMN "fecha_pausa" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ejercicios_programa" ADD COLUMN "porcentajes_semana" JSONB,
ADD COLUMN "cargas_fijas" JSONB;

-- AlterTable
ALTER TABLE "rm_referencia" ADD COLUMN "fuente" TEXT NOT NULL DEFAULT 'medido',
ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'validado',
ADD COLUMN "valor_anterior" DECIMAL(6,2),
ADD COLUMN "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "id_usuario_validador" TEXT;
