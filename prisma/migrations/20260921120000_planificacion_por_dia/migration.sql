-- Planificación mensual por día de la semana. Aditivo y no destructivo:
-- los bloques ya armados quedan con dia_semana NULL y siguen
-- funcionando exactamente como antes (se eligen solo por semana); la
-- planificación nueva por día es opcional, la habilita el coach recién
-- cuando arma un plan con este esquema.

-- CreateEnum
CREATE TYPE "TipoPlanificacion" AS ENUM ('fija', 'semanal', 'personalizada');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

-- AlterTable
ALTER TABLE "programas_entrenamiento" ADD COLUMN "tipo_planificacion" "TipoPlanificacion" NOT NULL DEFAULT 'fija';

-- AlterTable
ALTER TABLE "bloques_entrenamiento" ADD COLUMN "dia_semana" "DiaSemana";

-- AlterTable
ALTER TABLE "ejercicios_programa" ADD COLUMN "nota" TEXT;
