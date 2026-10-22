-- Multiorganización: membresías independientes Blackfit / Kuntur, ficha de
-- socio Kuntur, catálogo único de beneficios con audiencia y aprobación.
-- Aditivo: no se borra ningún usuario, socio, membresía ni beneficio.

-- CreateEnum
CREATE TYPE "AudienciaBeneficio" AS ENUM ('blackfit', 'kuntur', 'ambos');

-- CreateEnum
CREATE TYPE "Organizacion" AS ENUM ('blackfit', 'kuntur');

-- AlterEnum


ALTER TYPE "EstadoBeneficio" ADD VALUE 'pendiente';
ALTER TYPE "EstadoBeneficio" ADD VALUE 'rechazado';

-- AlterEnum
ALTER TYPE "EstadoComercio" ADD VALUE 'rechazado';

-- AlterTable
ALTER TABLE "beneficios" ADD COLUMN     "audiencia" "AudienciaBeneficio" NOT NULL DEFAULT 'kuntur',
ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "limite_usos" INTEGER,
ADD COLUMN     "motivo_rechazo" TEXT;

-- AlterTable
ALTER TABLE "comercios" ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "motivo_rechazo" TEXT,
ADD COLUMN     "razon_social" TEXT,
ADD COLUMN     "responsable" TEXT;

-- AlterTable
ALTER TABLE "planes_membresia" ADD COLUMN     "organizacion" "Organizacion" NOT NULL DEFAULT 'kuntur';

-- AlterTable
ALTER TABLE "validaciones_beneficios" ADD COLUMN     "motivo" TEXT;

-- CreateTable
CREATE TABLE "socios_kuntur" (
    "id_socio" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "fecha_alta_gimnasio" TIMESTAMP(3) NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3),
    "observaciones" TEXT,
    "cuenta_activada" BOOLEAN NOT NULL DEFAULT false,
    "codigo_activacion_hash" TEXT,
    "codigo_activacion_vence" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "socios_kuntur_pkey" PRIMARY KEY ("id_socio")
);

-- CreateIndex
CREATE UNIQUE INDEX "socios_kuntur_id_usuario_key" ON "socios_kuntur"("id_usuario");

-- AddForeignKey
ALTER TABLE "socios_kuntur" ADD CONSTRAINT "socios_kuntur_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS como el resto de las tablas (ver 20261009000000).
ALTER TABLE "socios_kuntur" ENABLE ROW LEVEL SECURITY;

-- 1) Plan propio de Blackfit. Hasta ahora el coach activaba los 30 días
--    de entrenamiento con el primer plan de 30 días que encontraba, que
--    era "Kuntur Mensual": las membresías quedaban mezcladas.
INSERT INTO "planes_membresia" (id_plan_membresia, nombre, descripcion, precio, duracion_dias, organizacion)
SELECT gen_random_uuid()::text, 'Blackfit — Entrenamiento 30 días',
       'Acceso al entrenamiento personalizado (lo activa el coach).', 0, 30, 'blackfit'
WHERE NOT EXISTS (SELECT 1 FROM "planes_membresia" WHERE organizacion = 'blackfit');

-- 2) Las membresías de alumnos de Blackfit que NO son socios de Kuntur
--    pasan al plan de Blackfit (fechas, estado e historial intactos).
UPDATE "membresias" m
SET id_plan_membresia = (SELECT id_plan_membresia FROM "planes_membresia" WHERE organizacion = 'blackfit' ORDER BY fecha_creacion LIMIT 1)
WHERE EXISTS (SELECT 1 FROM "roles_usuario" r WHERE r.id_usuario = m.id_usuario AND r.rol = 'alumno')
  AND NOT EXISTS (SELECT 1 FROM "roles_usuario" r WHERE r.id_usuario = m.id_usuario AND r.rol IN ('beneficiario', 'miembro_kuntur'))
  AND m.id_plan_membresia IN (SELECT id_plan_membresia FROM "planes_membresia" WHERE organizacion = 'kuntur');

-- 3) Ficha de socio para cada persona de Kuntur. La antigüedad arranca en
--    su primera membresía (o en su alta, si no tiene). Los importados del
--    Excel (email sintético) todavía no activaron su cuenta.
INSERT INTO "socios_kuntur" (id_socio, id_usuario, fecha_alta_gimnasio, cuenta_activada)
SELECT gen_random_uuid()::text, u.id_usuario,
       LEAST(u.fecha_creacion, COALESCE((SELECT MIN(m.fecha_inicio_membresia) FROM "membresias" m WHERE m.id_usuario = u.id_usuario), u.fecha_creacion)),
       u.email NOT LIKE '%@beneficiario.blackhub.local'
FROM "usuarios" u
WHERE EXISTS (SELECT 1 FROM "roles_usuario" r WHERE r.id_usuario = u.id_usuario AND r.rol IN ('beneficiario', 'miembro_kuntur'))
  AND NOT EXISTS (SELECT 1 FROM "socios_kuntur" s WHERE s.id_usuario = u.id_usuario);

-- 4) Seguridad: los socios importados del Excel quedaron con contraseña =
--    DNI (cualquiera que supiera un DNI podía entrar). Se reemplaza por una
--    contraseña aleatoria que nadie conoce; cada socio activa su acceso con
--    un código que le da Kuntur (ver /kuntur/activar).
UPDATE auth.users
SET encrypted_password = extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf'))
WHERE email LIKE '%@beneficiario.blackhub.local';

-- 5) El beneficio existente estaba atado a planes Kuntur: es para Kuntur.
UPDATE "beneficios" SET audiencia = 'kuntur';
