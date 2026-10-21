-- Planificación por sesiones secuenciales (Día 1, Día 2, ...) en vez de días
-- de la semana. Aditivo: no se borra ningún plan, ejercicio ni historial.

-- AlterTable
ALTER TABLE "bloques_entrenamiento" ADD COLUMN     "numero_dia" INTEGER;

-- AlterTable
ALTER TABLE "entrenamientos" ADD COLUMN     "id_bloque" TEXT,
ADD COLUMN     "numero_dia" INTEGER;

-- CreateIndex
CREATE INDEX "entrenamientos_id_programa_id_bloque_idx" ON "entrenamientos"("id_programa", "id_bloque");

-- AddForeignKey
ALTER TABLE "entrenamientos" ADD CONSTRAINT "entrenamientos_id_bloque_fkey" FOREIGN KEY ("id_bloque") REFERENCES "bloques_entrenamiento"("id_bloque") ON DELETE SET NULL ON UPDATE CASCADE;


-- 1) Numerar los días que ya existen, respetando su orden original
--    (lunes → martes → ... → domingo) dentro de cada rango de semanas.
--    Solo los que tienen ejercicios: los días vacíos eran "descanso" y no
--    son sesiones (quedan sin número y no se muestran; no se borran).
WITH numerados AS (
  SELECT b.id_bloque,
         ROW_NUMBER() OVER (
           PARTITION BY b.id_programa, b.semana_inicio, b.semana_fin
           ORDER BY CASE b.dia_semana
             WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3
             WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6
             WHEN 'domingo' THEN 7 END
         ) AS n
  FROM "bloques_entrenamiento" b
  WHERE b.dia_semana IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "ejercicios_programa" e
      WHERE e.id_bloque = b.id_bloque AND e.archivado = false
    )
)
UPDATE "bloques_entrenamiento" b
SET numero_dia = numerados.n
FROM numerados
WHERE b.id_bloque = numerados.id_bloque;

-- 2) Vincular los entrenamientos ya hechos a su sesión. Se guardaban con
--    el nombre del día ("Lunes") y sin referencia al bloque: se empareja
--    por programa + nombre + la semana en la que se hizo (calendario, que
--    era la lógica vigente cuando se entrenó). Si no hay coincidencia
--    única, queda sin vincular (el historial sigue igual).
WITH candidatos AS (
  SELECT e.id_entrenamiento, b.id_bloque, b.numero_dia,
         LEAST(4, GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (e.fecha - p.fecha_inicio)) / 604800)::int + 1)) AS semana,
         COUNT(*) OVER (PARTITION BY e.id_entrenamiento) AS coincidencias
  FROM "entrenamientos" e
  JOIN "programas_entrenamiento" p ON p.id_programa = e.id_programa
  JOIN "bloques_entrenamiento" b
    ON b.id_programa = e.id_programa
   AND b.numero_dia IS NOT NULL
   AND b.nombre = e.nombre
   AND LEAST(4, GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (e.fecha - p.fecha_inicio)) / 604800)::int + 1))
       BETWEEN COALESCE(b.semana_inicio, 1) AND COALESCE(b.semana_fin, 4)
  WHERE e.id_bloque IS NULL
)
UPDATE "entrenamientos" e
SET id_bloque = c.id_bloque,
    numero_dia = c.numero_dia,
    semana_programa = COALESCE(e.semana_programa, c.semana)
FROM candidatos c
WHERE e.id_entrenamiento = c.id_entrenamiento AND c.coincidencias = 1;

-- 3) Los días se identifican por número, no por "Lunes"/"Martes": el
--    nombre por defecto de la sesión pasa a "Día N" (el coach lo puede
--    cambiar, ej. "Tren inferior"). El historial guarda su propio nombre.
UPDATE "bloques_entrenamiento"
SET nombre = 'Día ' || numero_dia
WHERE numero_dia IS NOT NULL
  AND nombre IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo');
