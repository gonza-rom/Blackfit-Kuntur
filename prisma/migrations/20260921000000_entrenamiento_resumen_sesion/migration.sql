-- Resumen de la sesión que ve el alumno al finalizar el entrenamiento
-- (duración medida en el cliente, calorías estimadas a partir de esa
-- duración, y la carita de sensación general que elige). Nullable porque
-- las sesiones ya registradas nunca tuvieron esta pantalla.

-- AlterTable
ALTER TABLE "entrenamientos" ADD COLUMN "duracion_minutos" INTEGER;
ALTER TABLE "entrenamientos" ADD COLUMN "calorias_estimadas" INTEGER;
ALTER TABLE "entrenamientos" ADD COLUMN "sensacion_general" INTEGER;
