-- Idempotencia del guardado de entrenamientos: el id de sesión que genera
-- el teléfono evita duplicados por reintentos o por la cola offline.
-- Aditivo: los entrenamientos existentes quedan con NULL.

ALTER TABLE "entrenamientos" ADD COLUMN "id_sesion_cliente" TEXT;

CREATE UNIQUE INDEX "entrenamientos_id_sesion_cliente_key" ON "entrenamientos"("id_sesion_cliente");
