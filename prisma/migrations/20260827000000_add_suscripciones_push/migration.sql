-- CreateTable
CREATE TABLE "suscripciones_push" (
    "id_suscripcion" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "clave_p256dh" TEXT NOT NULL,
    "clave_auth" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_push_pkey" PRIMARY KEY ("id_suscripcion")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_push_endpoint_key" ON "suscripciones_push"("endpoint");

-- CreateIndex
CREATE INDEX "suscripciones_push_id_usuario_idx" ON "suscripciones_push"("id_usuario");

-- AddForeignKey
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: cada usuario ve y gestiona únicamente sus propias suscripciones push.
-- El backend (Prisma vía DIRECT_URL / service role) sigue teniendo acceso
-- pleno para enviar notificaciones; esto solo restringe acceso directo
-- vía Supabase client-side (anon/authenticated key).
ALTER TABLE suscripciones_push ENABLE ROW LEVEL SECURITY;

CREATE POLICY suscripciones_push_propia ON suscripciones_push
  FOR ALL USING (id_usuario = auth.uid()::text)
  WITH CHECK (id_usuario = auth.uid()::text);
