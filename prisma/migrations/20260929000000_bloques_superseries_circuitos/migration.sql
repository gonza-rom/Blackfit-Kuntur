-- Bloques de ejercicios dentro de un día (superseries, triseries,
-- circuitos). Aditivo y no destructivo: todo lo ya armado queda como
-- ejercicios individuales (id_grupo NULL) y sigue funcionando igual.

-- CreateTable
CREATE TABLE "grupos_ejercicios" (
    "id_grupo" TEXT NOT NULL,
    "id_bloque" TEXT NOT NULL,
    "nombre" TEXT,
    "rondas" INTEGER NOT NULL,
    "descanso_entre_ejercicios" TEXT,
    "descanso_entre_rondas" TEXT,
    "tempo" TEXT,
    "nota" TEXT,

    CONSTRAINT "grupos_ejercicios_pkey" PRIMARY KEY ("id_grupo")
);

-- CreateIndex
CREATE INDEX "grupos_ejercicios_id_bloque_idx" ON "grupos_ejercicios"("id_bloque");

-- AddForeignKey
ALTER TABLE "grupos_ejercicios" ADD CONSTRAINT "grupos_ejercicios_id_bloque_fkey" FOREIGN KEY ("id_bloque") REFERENCES "bloques_entrenamiento"("id_bloque") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ejercicios_programa" ADD COLUMN "id_grupo" TEXT;
ALTER TABLE "ejercicios_programa" ADD COLUMN "archivado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ejercicios_programa_id_grupo_idx" ON "ejercicios_programa"("id_grupo");

-- AddForeignKey
ALTER TABLE "ejercicios_programa" ADD CONSTRAINT "ejercicios_programa_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupos_ejercicios"("id_grupo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "series_entrenamiento" ADD COLUMN "numero_ronda" INTEGER;
