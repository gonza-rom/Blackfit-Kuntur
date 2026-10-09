-- Seguridad: la app accede a la base SOLO desde el servidor con Prisma
-- (rol postgres, que no pasa por RLS). Nunca usa supabase-js desde el
-- navegador para leer/escribir tablas. Pero la anon key es pública (viaja
-- en el bundle), y con ella cualquiera podía pegarle directo a la API REST
-- de Supabase (PostgREST):
--   - grupos_ejercicios y _prisma_migrations no tenían RLS → lectura,
--     escritura y borrado libres para cualquiera.
--   - usuarios_update_propio dejaba a cada usuario editar su propia fila
--     (estado_usuario, dni, email...), por ej. reactivarse si estaba
--     suspendido; entrenamientos/programas tenían políticas de escritura
--     sin WITH CHECK.
-- Se cierra todo: RLS en todas las tablas y sin ningún privilegio para
-- los roles de la API (anon / authenticated), ni ahora ni para tablas
-- futuras. Las políticas existentes quedan, pero sin GRANT no aplican.

ALTER TABLE "grupos_ejercicios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, public;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, public;
