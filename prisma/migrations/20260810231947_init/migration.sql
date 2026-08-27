-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('alumno', 'entrenador', 'miembro_kuntur', 'comercio', 'administrador');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('activo', 'inactivo', 'suspendido');

-- CreateEnum
CREATE TYPE "EstadoMembresia" AS ENUM ('activa', 'vencida', 'cancelada', 'suspendida', 'pendiente');

-- CreateEnum
CREATE TYPE "EstadoRelacion" AS ENUM ('activa', 'inactiva', 'finalizada');

-- CreateEnum
CREATE TYPE "EstadoPrograma" AS ENUM ('activo', 'pausado', 'finalizado');

-- CreateEnum
CREATE TYPE "EstadoEntrenamiento" AS ENUM ('pendiente', 'completado', 'omitido');

-- CreateEnum
CREATE TYPE "EstadoComercio" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "EstadoBeneficio" AS ENUM ('activo', 'inactivo', 'vencido');

-- CreateEnum
CREATE TYPE "ResultadoValidacion" AS ENUM ('aprobado', 'rechazado');

-- CreateEnum
CREATE TYPE "CategoriaBiblioteca" AS ENUM ('ejercicios', 'tecnicas', 'movilidad', 'recuperacion', 'nutricion', 'metodologia');

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "foto_perfil" TEXT,
    "estado_usuario" "EstadoUsuario" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "roles_usuario" (
    "id_rol_usuario" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_usuario_pkey" PRIMARY KEY ("id_rol_usuario")
);

-- CreateTable
CREATE TABLE "alumnos" (
    "id_alumno" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3),
    "objetivo" TEXT,
    "fecha_alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumnos_pkey" PRIMARY KEY ("id_alumno")
);

-- CreateTable
CREATE TABLE "entrenadores" (
    "id_entrenador" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "especialidad" TEXT,
    "biografia" TEXT,
    "fecha_alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrenadores_pkey" PRIMARY KEY ("id_entrenador")
);

-- CreateTable
CREATE TABLE "relaciones_entrenador_alumno" (
    "id_relacion" TEXT NOT NULL,
    "id_entrenador" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "estado_relacion" "EstadoRelacion" NOT NULL DEFAULT 'activa',
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMP(3),

    CONSTRAINT "relaciones_entrenador_alumno_pkey" PRIMARY KEY ("id_relacion")
);

-- CreateTable
CREATE TABLE "planes_membresia" (
    "id_plan_membresia" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "duracion_dias" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planes_membresia_pkey" PRIMARY KEY ("id_plan_membresia")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id_membresia" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "id_plan_membresia" TEXT NOT NULL,
    "estado_membresia" "EstadoMembresia" NOT NULL DEFAULT 'pendiente',
    "fecha_inicio_membresia" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento_membresia" TIMESTAMP(3) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id_membresia")
);

-- CreateTable
CREATE TABLE "programas_entrenamiento" (
    "id_programa" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_entrenador" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "objetivo" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "estado_programa" "EstadoPrograma" NOT NULL DEFAULT 'activo',

    CONSTRAINT "programas_entrenamiento_pkey" PRIMARY KEY ("id_programa")
);

-- CreateTable
CREATE TABLE "bloques_entrenamiento" (
    "id_bloque" TEXT NOT NULL,
    "id_programa" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "semana_inicio" INTEGER,
    "semana_fin" INTEGER,
    "tipo" TEXT,

    CONSTRAINT "bloques_entrenamiento_pkey" PRIMARY KEY ("id_bloque")
);

-- CreateTable
CREATE TABLE "ejercicios" (
    "id_ejercicio" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "grupo_muscular" TEXT,
    "video_url" TEXT,
    "instrucciones" TEXT,

    CONSTRAINT "ejercicios_pkey" PRIMARY KEY ("id_ejercicio")
);

-- CreateTable
CREATE TABLE "ejercicios_programa" (
    "id_ejercicio_programa" TEXT NOT NULL,
    "id_bloque" TEXT NOT NULL,
    "id_ejercicio" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "repeticiones" TEXT NOT NULL,
    "peso_sugerido" DECIMAL(6,2),
    "tempo" TEXT,
    "descanso" TEXT,
    "metodo_entrenamiento" TEXT,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "ejercicios_programa_pkey" PRIMARY KEY ("id_ejercicio_programa")
);

-- CreateTable
CREATE TABLE "entrenamientos" (
    "id_entrenamiento" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "id_programa" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombre" TEXT,
    "comentarios" TEXT,
    "estado" "EstadoEntrenamiento" NOT NULL DEFAULT 'pendiente',

    CONSTRAINT "entrenamientos_pkey" PRIMARY KEY ("id_entrenamiento")
);

-- CreateTable
CREATE TABLE "series_entrenamiento" (
    "id_serie" TEXT NOT NULL,
    "id_entrenamiento" TEXT NOT NULL,
    "id_ejercicio_programa" TEXT NOT NULL,
    "peso_utilizado" DECIMAL(6,2),
    "repeticiones_realizadas" INTEGER,
    "series_completadas" INTEGER,
    "rpe" DECIMAL(3,1),
    "descanso_real" INTEGER,
    "tiempo_bajo_tension" INTEGER,
    "comentarios" TEXT,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_entrenamiento_pkey" PRIMARY KEY ("id_serie")
);

-- CreateTable
CREATE TABLE "progreso_fisico" (
    "id_progreso" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso_corporal" DECIMAL(5,2),
    "porcentaje_graso" DECIMAL(4,2),
    "masa_muscular" DECIMAL(5,2),

    CONSTRAINT "progreso_fisico_pkey" PRIMARY KEY ("id_progreso")
);

-- CreateTable
CREATE TABLE "medidas_corporales" (
    "id_medida" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_medida" TEXT NOT NULL,
    "valor_cm" DECIMAL(5,2) NOT NULL,
    "foto_url" TEXT,

    CONSTRAINT "medidas_corporales_pkey" PRIMARY KEY ("id_medida")
);

-- CreateTable
CREATE TABLE "habitos" (
    "id_habito" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sueno" INTEGER,
    "agua" DECIMAL(4,2),
    "nutricion" INTEGER,
    "suplementacion" BOOLEAN,
    "cardio" BOOLEAN,
    "movilidad" BOOLEAN,
    "recuperacion" INTEGER,

    CONSTRAINT "habitos_pkey" PRIMARY KEY ("id_habito")
);

-- CreateTable
CREATE TABLE "feedback_diario" (
    "id_feedback_diario" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario_diario" TEXT NOT NULL,

    CONSTRAINT "feedback_diario_pkey" PRIMARY KEY ("id_feedback_diario")
);

-- CreateTable
CREATE TABLE "feedback_semanal" (
    "id_feedback_semanal" TEXT NOT NULL,
    "id_alumno" TEXT NOT NULL,
    "semana_inicio" TIMESTAMP(3) NOT NULL,
    "comentario_semanal" TEXT NOT NULL,

    CONSTRAINT "feedback_semanal_pkey" PRIMARY KEY ("id_feedback_semanal")
);

-- CreateTable
CREATE TABLE "biblioteca" (
    "id_recurso" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "CategoriaBiblioteca" NOT NULL,
    "url_contenido" TEXT,
    "tipo_contenido" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biblioteca_pkey" PRIMARY KEY ("id_recurso")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id_conversacion" TEXT NOT NULL,
    "id_usuario_1" TEXT NOT NULL,
    "id_usuario_2" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id_conversacion")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id_mensaje" TEXT NOT NULL,
    "id_conversacion" TEXT NOT NULL,
    "id_usuario_emisor" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipo" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "comercios" (
    "id_comercio" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "categoria" TEXT,
    "estado" "EstadoComercio" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comercios_pkey" PRIMARY KEY ("id_comercio")
);

-- CreateTable
CREATE TABLE "beneficios" (
    "id_beneficio" TEXT NOT NULL,
    "id_comercio" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "descuento" TEXT,
    "condiciones" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoBeneficio" NOT NULL DEFAULT 'activo',

    CONSTRAINT "beneficios_pkey" PRIMARY KEY ("id_beneficio")
);

-- CreateTable
CREATE TABLE "beneficios_planes" (
    "id_beneficio" TEXT NOT NULL,
    "id_plan_membresia" TEXT NOT NULL,

    CONSTRAINT "beneficios_planes_pkey" PRIMARY KEY ("id_beneficio","id_plan_membresia")
);

-- CreateTable
CREATE TABLE "credenciales" (
    "id_credencial" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "numero_socio" TEXT NOT NULL,
    "codigo_qr_token" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credenciales_pkey" PRIMARY KEY ("id_credencial")
);

-- CreateTable
CREATE TABLE "validaciones_beneficios" (
    "id_validacion" TEXT NOT NULL,
    "id_comercio" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "id_beneficio" TEXT NOT NULL,
    "fecha_validacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "ResultadoValidacion" NOT NULL,

    CONSTRAINT "validaciones_beneficios_pkey" PRIMARY KEY ("id_validacion")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id_registro" TEXT NOT NULL,
    "id_usuario" TEXT,
    "accion" TEXT NOT NULL,
    "recurso" TEXT,
    "id_recurso" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" TEXT,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id_registro")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_usuario_id_usuario_rol_key" ON "roles_usuario"("id_usuario", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "alumnos_id_usuario_key" ON "alumnos"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "entrenadores_id_usuario_key" ON "entrenadores"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "relaciones_entrenador_alumno_id_entrenador_id_alumno_key" ON "relaciones_entrenador_alumno"("id_entrenador", "id_alumno");

-- CreateIndex
CREATE INDEX "membresias_id_usuario_estado_membresia_idx" ON "membresias"("id_usuario", "estado_membresia");

-- CreateIndex
CREATE INDEX "entrenamientos_id_alumno_fecha_idx" ON "entrenamientos"("id_alumno", "fecha");

-- CreateIndex
CREATE INDEX "progreso_fisico_id_alumno_fecha_idx" ON "progreso_fisico"("id_alumno", "fecha");

-- CreateIndex
CREATE INDEX "medidas_corporales_id_alumno_fecha_idx" ON "medidas_corporales"("id_alumno", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "habitos_id_alumno_fecha_key" ON "habitos"("id_alumno", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_id_usuario_1_id_usuario_2_key" ON "conversaciones"("id_usuario_1", "id_usuario_2");

-- CreateIndex
CREATE INDEX "mensajes_id_conversacion_fecha_envio_idx" ON "mensajes"("id_conversacion", "fecha_envio");

-- CreateIndex
CREATE INDEX "notificaciones_id_usuario_leido_idx" ON "notificaciones"("id_usuario", "leido");

-- CreateIndex
CREATE UNIQUE INDEX "comercios_id_usuario_key" ON "comercios"("id_usuario");

-- CreateIndex
CREATE INDEX "beneficios_id_comercio_estado_idx" ON "beneficios"("id_comercio", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_id_usuario_key" ON "credenciales"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_numero_socio_key" ON "credenciales"("numero_socio");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_codigo_qr_token_key" ON "credenciales"("codigo_qr_token");

-- CreateIndex
CREATE INDEX "validaciones_beneficios_id_comercio_fecha_validacion_idx" ON "validaciones_beneficios"("id_comercio", "fecha_validacion");

-- CreateIndex
CREATE INDEX "registros_auditoria_id_usuario_fecha_idx" ON "registros_auditoria"("id_usuario", "fecha");

-- CreateIndex
CREATE INDEX "registros_auditoria_accion_fecha_idx" ON "registros_auditoria"("accion", "fecha");

-- AddForeignKey
ALTER TABLE "roles_usuario" ADD CONSTRAINT "roles_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrenadores" ADD CONSTRAINT "entrenadores_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relaciones_entrenador_alumno" ADD CONSTRAINT "relaciones_entrenador_alumno_id_entrenador_fkey" FOREIGN KEY ("id_entrenador") REFERENCES "entrenadores"("id_entrenador") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relaciones_entrenador_alumno" ADD CONSTRAINT "relaciones_entrenador_alumno_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_id_plan_membresia_fkey" FOREIGN KEY ("id_plan_membresia") REFERENCES "planes_membresia"("id_plan_membresia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas_entrenamiento" ADD CONSTRAINT "programas_entrenamiento_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas_entrenamiento" ADD CONSTRAINT "programas_entrenamiento_id_entrenador_fkey" FOREIGN KEY ("id_entrenador") REFERENCES "entrenadores"("id_entrenador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloques_entrenamiento" ADD CONSTRAINT "bloques_entrenamiento_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas_entrenamiento"("id_programa") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_programa" ADD CONSTRAINT "ejercicios_programa_id_bloque_fkey" FOREIGN KEY ("id_bloque") REFERENCES "bloques_entrenamiento"("id_bloque") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios_programa" ADD CONSTRAINT "ejercicios_programa_id_ejercicio_fkey" FOREIGN KEY ("id_ejercicio") REFERENCES "ejercicios"("id_ejercicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrenamientos" ADD CONSTRAINT "entrenamientos_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrenamientos" ADD CONSTRAINT "entrenamientos_id_programa_fkey" FOREIGN KEY ("id_programa") REFERENCES "programas_entrenamiento"("id_programa") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_entrenamiento" ADD CONSTRAINT "series_entrenamiento_id_entrenamiento_fkey" FOREIGN KEY ("id_entrenamiento") REFERENCES "entrenamientos"("id_entrenamiento") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_entrenamiento" ADD CONSTRAINT "series_entrenamiento_id_ejercicio_programa_fkey" FOREIGN KEY ("id_ejercicio_programa") REFERENCES "ejercicios_programa"("id_ejercicio_programa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_fisico" ADD CONSTRAINT "progreso_fisico_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas_corporales" ADD CONSTRAINT "medidas_corporales_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitos" ADD CONSTRAINT "habitos_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_diario" ADD CONSTRAINT "feedback_diario_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_semanal" ADD CONSTRAINT "feedback_semanal_id_alumno_fkey" FOREIGN KEY ("id_alumno") REFERENCES "alumnos"("id_alumno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_id_usuario_1_fkey" FOREIGN KEY ("id_usuario_1") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_id_usuario_2_fkey" FOREIGN KEY ("id_usuario_2") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversaciones"("id_conversacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_id_usuario_emisor_fkey" FOREIGN KEY ("id_usuario_emisor") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comercios" ADD CONSTRAINT "comercios_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios" ADD CONSTRAINT "beneficios_id_comercio_fkey" FOREIGN KEY ("id_comercio") REFERENCES "comercios"("id_comercio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_planes" ADD CONSTRAINT "beneficios_planes_id_beneficio_fkey" FOREIGN KEY ("id_beneficio") REFERENCES "beneficios"("id_beneficio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_planes" ADD CONSTRAINT "beneficios_planes_id_plan_membresia_fkey" FOREIGN KEY ("id_plan_membresia") REFERENCES "planes_membresia"("id_plan_membresia") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credenciales" ADD CONSTRAINT "credenciales_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones_beneficios" ADD CONSTRAINT "validaciones_beneficios_id_comercio_fkey" FOREIGN KEY ("id_comercio") REFERENCES "comercios"("id_comercio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones_beneficios" ADD CONSTRAINT "validaciones_beneficios_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validaciones_beneficios" ADD CONSTRAINT "validaciones_beneficios_id_beneficio_fkey" FOREIGN KEY ("id_beneficio") REFERENCES "beneficios"("id_beneficio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;
