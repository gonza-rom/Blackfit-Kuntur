-- Datos opcionales de renovación que el coach configura en su perfil y
-- que ve el alumno con la membresía vencida. Aditivo y no destructivo.

-- AlterTable
ALTER TABLE "entrenadores" ADD COLUMN "alias_pago" TEXT;
ALTER TABLE "entrenadores" ADD COLUMN "mensaje_membresia" TEXT;
