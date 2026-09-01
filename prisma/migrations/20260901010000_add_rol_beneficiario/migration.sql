-- Nuevo rol "beneficiario": Kuntur puro (solo beneficios + perfil), sin
-- acceso a nada de Black Fit. Separado de "miembro_kuntur" porque ese rol
-- hoy convive con roles de Black Fit sobre el mismo usuario (ej. alumno +
-- miembro_kuntur), y este usuario no debe tener ninguna relación con
-- Black Fit.
--
-- No toca datos existentes: solo agrega un valor al enum.

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'beneficiario';
