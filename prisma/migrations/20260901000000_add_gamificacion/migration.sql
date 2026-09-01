-- ============================================================
-- GAMIFICACIÓN — objetivos, puntos diarios y logros
-- ============================================================
-- No toca ninguna tabla ni dato existente salvo `alumnos`, donde solo
-- agrega una columna nueva con DEFAULT 0 (no reescribe filas). El sistema
-- es independiente del motor de alertas.
-- ============================================================

-- CreateEnum
CREATE TYPE "TipoObjetivo" AS ENUM ('volumen', 'frecuencia', 'habito', 'peso_corporal', 'custom');

-- CreateEnum
CREATE TYPE "EstadoObjetivo" AS ENUM ('activo', 'cumplido', 'vencido', 'cancelado');

-- AlterTable
ALTER TABLE "alumnos" ADD COLUMN     "puntos_totales" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "objetivos" (
    "id_objetivo" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoObjetivo" NOT NULL DEFAULT 'custom',
    "meta" DECIMAL(10,2) NOT NULL,
    "progreso_actual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_objetivo" TIMESTAMP(3),
    "estado" "EstadoObjetivo" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objetivos_pkey" PRIMARY KEY ("id_objetivo")
);

-- CreateTable
CREATE TABLE "logros" (
    "id_logro" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "icono" TEXT,
    "criterio" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logros_pkey" PRIMARY KEY ("id_logro")
);

-- CreateTable
CREATE TABLE "logros_alumno" (
    "id_logro_alumno" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_logro" TEXT NOT NULL,
    "fecha_obtenido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logros_alumno_pkey" PRIMARY KEY ("id_logro_alumno")
);

-- CreateTable
CREATE TABLE "movimientos_puntos" (
    "id_movimiento" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_puntos_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateIndex
CREATE INDEX "objetivos_id_alumno_estado_idx" ON "objetivos"("id_alumno", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "logros_codigo_key" ON "logros"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "logros_alumno_id_alumno_id_logro_key" ON "logros_alumno"("id_alumno", "id_logro");

-- CreateIndex
CREATE INDEX "movimientos_puntos_id_alumno_fecha_idx" ON "movimientos_puntos"("id_alumno", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_puntos_id_alumno_motivo_key" ON "movimientos_puntos"("id_alumno", "motivo");

-- AddForeignKey
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logros_alumno" ADD CONSTRAINT "logros_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logros_alumno" ADD CONSTRAINT "logros_alumno_id_logro_fkey" FOREIGN KEY ("id_logro") REFERENCES "logros"("id_logro") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_puntos" ADD CONSTRAINT "movimientos_puntos_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- ROW LEVEL SECURITY  (mismo patrón que 20260814000000_enable_rls)
-- El backend (Prisma vía DIRECT_URL / service role) mantiene acceso pleno;
-- esto solo restringe accesos directos vía Supabase client-side.
-- ============================================================
ALTER TABLE objetivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY objetivos_select ON objetivos
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

ALTER TABLE logros_alumno ENABLE ROW LEVEL SECURITY;
CREATE POLICY logros_alumno_select ON logros_alumno
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

ALTER TABLE movimientos_puntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY movimientos_puntos_select ON movimientos_puntos
  FOR SELECT USING (
    id_alumno = public.id_alumno_actual()
    OR public.entrenador_tiene_alumno(id_alumno)
    OR public.es_administrador()
  );

-- Catálogo de logros: lectura para cualquier autenticado (igual que
-- `ejercicios` y `biblioteca`).
ALTER TABLE logros ENABLE ROW LEVEL SECURITY;
CREATE POLICY logros_select_autenticados ON logros
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- SEED del catálogo de logros (filas nuevas, ON CONFLICT DO NOTHING para
-- que re-aplicar la migración sea inocuo).
-- ============================================================
INSERT INTO "logros" ("id_logro", "codigo", "titulo", "descripcion", "icono", "criterio") VALUES
  (gen_random_uuid(), 'primer_entrenamiento', 'Primer paso', 'Completaste tu primer entrenamiento.', 'footprint', '{"tipo":"entrenamientos_totales","valor":1}'),
  (gen_random_uuid(), 'racha_7', 'Semana perfecta', '7 días seguidos entrenando.', 'local_fire_department', '{"tipo":"racha_dias","valor":7}'),
  (gen_random_uuid(), 'racha_30', 'Mes de acero', '30 días seguidos entrenando.', 'whatshot', '{"tipo":"racha_dias","valor":30}'),
  (gen_random_uuid(), 'entrenamientos_25', 'Constancia', '25 entrenamientos completados.', 'military_tech', '{"tipo":"entrenamientos_totales","valor":25}'),
  (gen_random_uuid(), 'entrenamientos_100', 'Centenario', '100 entrenamientos completados.', 'workspace_premium', '{"tipo":"entrenamientos_totales","valor":100}'),
  (gen_random_uuid(), 'puntos_500', 'Quinientos', 'Acumulaste 500 puntos.', 'stars', '{"tipo":"puntos_totales","valor":500}'),
  (gen_random_uuid(), 'puntos_2000', 'Dos mil', 'Acumulaste 2000 puntos.', 'auto_awesome', '{"tipo":"puntos_totales","valor":2000}'),
  (gen_random_uuid(), 'objetivo_1', 'Objetivo cumplido', 'Cumpliste tu primer objetivo.', 'target', '{"tipo":"objetivos_cumplidos","valor":1}'),
  (gen_random_uuid(), 'objetivos_5', 'Enfocado', 'Cumpliste 5 objetivos.', 'flag', '{"tipo":"objetivos_cumplidos","valor":5}')
ON CONFLICT ("codigo") DO NOTHING;
