ALTER TABLE "logros" ALTER COLUMN "criterio" DROP NOT NULL;
ALTER TABLE "logros" ADD COLUMN "color" TEXT;
ALTER TABLE "logros" ADD COLUMN "categoria" TEXT;
