-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- IMPORTANTE — leer antes de aplicar en producción:
--
-- La app (server actions de Next.js) se conecta a Postgres con la
-- `DATABASE_URL` de Prisma. Si esa conexión usa el rol `postgres` (el
-- que da Supabase por defecto para Prisma) o la `service_role key`, ese
-- rol es SUPERUSER/BYPASSRLS y estas políticas NO lo afectan: la app
-- sigue funcionando exactamente igual que hoy.
--
-- Lo que esto agrega es una segunda capa de defensa para cualquier
-- acceso que NO pase por las server actions: uso directo de supabase-js
-- desde el cliente con la anon/authenticated key, la API REST de
-- Supabase (PostgREST), o Realtime. Hoy la app no usa nada de eso, pero
-- si en el futuro se agrega (por ejemplo Realtime para el chat), esta
-- es la protección que impide que un usuario autenticado lea datos de
-- otro usuario aunque tenga la URL/API key pública.
--
-- Para aplicar: `npx prisma migrate deploy` (o `migrate dev` en
-- desarrollo) contra la base de Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM roles_usuario
    WHERE id_usuario = auth.uid()::text AND rol = 'administrador'
  );
$$;

CREATE OR REPLACE FUNCTION public.id_alumno_actual()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_alumno FROM alumnos WHERE id_usuario = auth.uid()::text;
$$;

CREATE OR REPLACE FUNCTION public.id_entrenador_actual()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_entrenador FROM entrenadores WHERE id_usuario = auth.uid()::text;
$$;

CREATE OR REPLACE FUNCTION public.id_comercio_actual()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_comercio FROM comercios WHERE id_usuario = auth.uid()::text;
$$;

CREATE OR REPLACE FUNCTION public.entrenador_tiene_alumno(alumno_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM relaciones_entrenador_alumno
    WHERE id_entrenador = public.id_entrenador_actual()
      AND id_alumno = alumno_id
      AND estado_relacion = 'activa'
  );
$$;

-- usuarios ------------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_select_propio ON usuarios
  FOR SELECT USING (id_usuario = auth.uid()::text OR public.es_administrador());

CREATE POLICY usuarios_update_propio ON usuarios
  FOR UPDATE USING (id_usuario = auth.uid()::text OR public.es_administrador());

CREATE POLICY usuarios_admin_all ON usuarios
  FOR ALL USING (public.es_administrador());

-- roles_usuario ---------------------------------------------------------
ALTER TABLE roles_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_usuario_select_propio ON roles_usuario
  FOR SELECT USING (id_usuario = auth.uid()::text OR public.es_administrador());

CREATE POLICY roles_usuario_admin_write ON roles_usuario
  FOR INSERT WITH CHECK (public.es_administrador());

CREATE POLICY roles_usuario_admin_delete ON roles_usuario
  FOR DELETE USING (public.es_administrador());

-- alumnos / entrenadores / comercios ------------------------------------
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY alumnos_select ON alumnos
  FOR SELECT USING (
    id_usuario = auth.uid()::text
    OR public.es_administrador()
    OR public.entrenador_tiene_alumno(id_alumno)
  );

ALTER TABLE entrenadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY entrenadores_select ON entrenadores
  FOR SELECT USING (true);

ALTER TABLE comercios ENABLE ROW LEVEL SECURITY;
CREATE POLICY comercios_select_propio_o_admin ON comercios
  FOR SELECT USING (id_usuario = auth.uid()::text OR public.es_administrador());
CREATE POLICY comercios_select_alumnos ON comercios
  FOR SELECT USING (estado = 'activo');

-- relaciones_entrenador_alumno ------------------------------------------
ALTER TABLE relaciones_entrenador_alumno ENABLE ROW LEVEL SECURITY;
CREATE POLICY relaciones_select ON relaciones_entrenador_alumno
  FOR SELECT USING (
    id_entrenador = public.id_entrenador_actual()
    OR id_alumno = public.id_alumno_actual()
    OR public.es_administrador()
  );

-- membresias --------------------------------------------------------------
ALTER TABLE membresias ENABLE ROW LEVEL SECURITY;
CREATE POLICY membresias_select_propia ON membresias
  FOR SELECT USING (id_usuario = auth.uid()::text OR public.es_administrador());

-- credenciales (QR) -------------------------------------------------------
ALTER TABLE credenciales ENABLE ROW LEVEL SECURITY;
CREATE POLICY credenciales_select_propia ON credenciales
  FOR SELECT USING (id_usuario = auth.uid()::text OR public.es_administrador());

-- programas / bloques / ejercicios de programa ----------------------------
ALTER TABLE programas_entrenamiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY programas_select ON programas_entrenamiento
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR id_entrenador = public.id_entrenador_actual()
    OR public.es_administrador()
  );
CREATE POLICY programas_write_entrenador ON programas_entrenamiento
  FOR ALL USING (id_entrenador = public.id_entrenador_actual() OR public.es_administrador());

ALTER TABLE bloques_entrenamiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY bloques_select ON bloques_entrenamiento
  FOR SELECT USING (
    id_programa IN (
      SELECT id_programa FROM programas_entrenamiento
      WHERE id_alumno = public.id_alumno_actual()
         OR id_entrenador = public.id_entrenador_actual()
    )
    OR public.es_administrador()
  );

ALTER TABLE ejercicios_programa ENABLE ROW LEVEL SECURITY;
CREATE POLICY ejercicios_programa_select ON ejercicios_programa
  FOR SELECT USING (
    id_bloque IN (
      SELECT b.id_bloque FROM bloques_entrenamiento b
      JOIN programas_entrenamiento p ON p.id_programa = b.id_programa
      WHERE p.id_alumno = public.id_alumno_actual()
         OR p.id_entrenador = public.id_entrenador_actual()
    )
    OR public.es_administrador()
  );

-- biblioteca de ejercicios (catálogo global, lectura para autenticados) ---
ALTER TABLE ejercicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY ejercicios_select_autenticados ON ejercicios
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- entrenamientos / series ---------------------------------------------------
ALTER TABLE entrenamientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY entrenamientos_select ON entrenamientos
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );
CREATE POLICY entrenamientos_write_alumno ON entrenamientos
  FOR ALL USING (id_alumno = public.id_alumno_actual() OR public.es_administrador());

ALTER TABLE series_entrenamiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY series_select ON series_entrenamiento
  FOR SELECT USING (
    id_entrenamiento IN (
      SELECT id_entrenamiento FROM entrenamientos
      WHERE id_alumno = public.id_alumno_actual()
         OR public.entrenador_tiene_alumno(id_alumno)
    )
    OR public.es_administrador()
  );

-- progreso físico / medidas / hábitos / feedback (datos sensibles) --------
ALTER TABLE progreso_fisico ENABLE ROW LEVEL SECURITY;
CREATE POLICY progreso_fisico_select ON progreso_fisico
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

ALTER TABLE medidas_corporales ENABLE ROW LEVEL SECURITY;
CREATE POLICY medidas_corporales_select ON medidas_corporales
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

ALTER TABLE habitos ENABLE ROW LEVEL SECURITY;
CREATE POLICY habitos_select ON habitos
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

ALTER TABLE feedback_diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_diario_select ON feedback_diario
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

ALTER TABLE feedback_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_semanal_select ON feedback_semanal
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

-- biblioteca educativa (catálogo, lectura para autenticados) --------------
ALTER TABLE biblioteca ENABLE ROW LEVEL SECURITY;
CREATE POLICY biblioteca_select_autenticados ON biblioteca
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- comunicación: solo los dos participantes de la conversación -------------
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversaciones_select ON conversaciones
  FOR SELECT USING (
    id_usuario_1 = auth.uid()::text OR id_usuario_2 = auth.uid()::text OR public.es_administrador()
  );

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY mensajes_select ON mensajes
  FOR SELECT USING (
    id_conversacion IN (
      SELECT id_conversacion FROM conversaciones
      WHERE id_usuario_1 = auth.uid()::text OR id_usuario_2 = auth.uid()::text
    )
    OR public.es_administrador()
  );
CREATE POLICY mensajes_insert ON mensajes
  FOR INSERT WITH CHECK (
    id_usuario_emisor = auth.uid()::text
    AND id_conversacion IN (
      SELECT id_conversacion FROM conversaciones
      WHERE id_usuario_1 = auth.uid()::text OR id_usuario_2 = auth.uid()::text
    )
  );

-- notificaciones: solo las propias ------------------------------------------
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificaciones_select_propia ON notificaciones
  FOR SELECT USING (id_usuario = auth.uid()::text OR public.es_administrador());
CREATE POLICY notificaciones_update_propia ON notificaciones
  FOR UPDATE USING (id_usuario = auth.uid()::text);

-- planes de membresía (catálogo público para autenticados) -----------------
ALTER TABLE planes_membresia ENABLE ROW LEVEL SECURITY;
CREATE POLICY planes_membresia_select ON planes_membresia
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- beneficios / beneficios_planes --------------------------------------------
ALTER TABLE beneficios ENABLE ROW LEVEL SECURITY;
CREATE POLICY beneficios_select_comercio_o_admin ON beneficios
  FOR SELECT USING (id_comercio = public.id_comercio_actual() OR public.es_administrador());
CREATE POLICY beneficios_select_miembro_activo ON beneficios
  FOR SELECT USING (
    estado = 'activo'
    AND EXISTS (
      SELECT 1 FROM membresias m
      WHERE m.id_usuario = auth.uid()::text
        AND m.estado_membresia = 'activa'
        AND m.fecha_vencimiento_membresia >= now()
    )
  );

ALTER TABLE beneficios_planes ENABLE ROW LEVEL SECURITY;
CREATE POLICY beneficios_planes_select ON beneficios_planes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- validaciones_beneficios: comercio ve las suyas, alumno ve las propias ----
ALTER TABLE validaciones_beneficios ENABLE ROW LEVEL SECURITY;
CREATE POLICY validaciones_select ON validaciones_beneficios
  FOR SELECT USING (
    id_comercio = public.id_comercio_actual()
    OR id_usuario = auth.uid()::text
    OR public.es_administrador()
  );
CREATE POLICY validaciones_insert_comercio ON validaciones_beneficios
  FOR INSERT WITH CHECK (id_comercio = public.id_comercio_actual());

-- registros_auditoria: nadie del cliente puede leer ni escribir -----------
ALTER TABLE registros_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY registros_auditoria_admin_select ON registros_auditoria
  FOR SELECT USING (public.es_administrador());
