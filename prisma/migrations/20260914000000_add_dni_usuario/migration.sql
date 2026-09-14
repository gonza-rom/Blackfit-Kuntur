-- Agrega DNI a Usuario: identifica altas administrativas (beneficiarios
-- importados de Kuntur, sin email propio) y habilita login alternativo
-- por DNI en iniciarSesion(). Nullable porque los usuarios existentes,
-- que se registraron solos con email, no tienen DNI cargado.

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "dni" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");
