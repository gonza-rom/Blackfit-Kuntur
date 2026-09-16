-- El feedback semanal era de solo lectura para el coach: lo escribía el
-- alumno y la devolución real pasaba por WhatsApp. Estas columnas permiten
-- responder dentro de la misma app. Nullable porque el feedback ya
-- cargado nunca tuvo respuesta.

-- AlterTable
ALTER TABLE "feedback_semanal" ADD COLUMN "respuesta_coach" TEXT;
ALTER TABLE "feedback_semanal" ADD COLUMN "fecha_respuesta" TIMESTAMP(3);
