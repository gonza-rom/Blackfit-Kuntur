-- Dos roles administrativos recortados: "admin_comercios" (comercios,
-- beneficios, usuarios beneficiario/comercio/miembro_kuntur — Kuntur) y
-- "admin_blackfit" (usuarios alumno/entrenador y sus membresías — Black
-- Fit). "administrador" sigue viendo y gestionando todo, incluido asignar
-- estos dos roles nuevos — eso se valida en el servidor (src/lib/auth.ts,
-- src/app/actions/admin.ts), no acá.
--
-- No toca datos existentes: solo agrega dos valores al enum.

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'admin_comercios';
ALTER TYPE "RolUsuario" ADD VALUE 'admin_blackfit';
