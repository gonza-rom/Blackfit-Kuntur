-- Racha de días logueándose (para logros automáticos por actividad de
-- uso de la app, no solo por entrenar) — ver registrarLogin() en
-- src/lib/gamificacion.ts, llamado desde iniciarSesion().
ALTER TABLE "usuarios" ADD COLUMN "ultimo_login" TIMESTAMP(3);
ALTER TABLE "usuarios" ADD COLUMN "racha_login_dias" INTEGER NOT NULL DEFAULT 0;

-- Dos logros automáticos nuevos con el criterio "racha_login_dias"
-- (nuevo tipo, evaluado en cumpleCriterio() de lib/gamificacion.ts).
-- No toca datos existentes.
INSERT INTO "logros" ("id_logro", "codigo", "titulo", "descripcion", "icono", "criterio") VALUES
  (gen_random_uuid(), 'racha_login_7', 'Fiel a la app', '7 días seguidos entrando a Black Hub.', 'calendar_month', '{"tipo":"racha_login_dias","valor":7}'),
  (gen_random_uuid(), 'racha_login_30', 'Un mes con nosotros', '30 días seguidos entrando a Black Hub.', 'event_available', '{"tipo":"racha_login_dias","valor":30}')
ON CONFLICT ("codigo") DO NOTHING;
