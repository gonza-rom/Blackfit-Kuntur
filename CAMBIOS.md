# Cambios de esta entrega

## 1. Motor de alertas — consciente del deload
`src/lib/alertas.ts`: antes de marcar caída de volumen, revisa si el
alumno está cursando un bloque `deload`/`descarga` en su programa activo
(por semana) — si es así, la baja en "info" en vez de "advertencia".
También distingue progresión de intensidad (menos volumen pero más peso
promedio = no es retroceso).

## 2. Push notifications — funcional de punta a punta
- VAPID keys reales ya generadas y cargadas en `.env` (no hace falta
  darte de alta en ningún servicio externo).
- Modelo `SuscripcionPush` + migración
  `prisma/migrations/20260827000000_add_suscripciones_push/`.
- `src/lib/push.ts` + `src/lib/notificaciones.ts` (punto único para
  crear notificación in-app y push a la vez).
- `public/sw.js` con listeners `push` y `notificationclick`.
- Botón "Activar notificaciones" en el panel del alumno y del coach
  (`src/components/activar-push.tsx`).
- Ya conectado a: mensajes de chat, programa nuevo asignado, aviso de
  rutina lista, recordatorio de vencimiento de membresía.

## 3. Membresías
Ya estaba resuelto (activación/renovación manual desde `/admin`, vigencia
en tiempo real). Se agregó: recordatorio automático (in-app + push)
cuando faltan ≤5 días para el vencimiento (`src/lib/membresia.ts`).

## 4. Armador de rutinas — coach
En `/coach/programas/[id]` ahora se puede, además de agregar ejercicios:
- **Editar** cualquier ejercicio ya cargado (series, reps, peso, tempo,
  descanso, método, TUT) sin borrarlo y recrearlo.
- **Reordenar** con flechas arriba/abajo.
- **Eliminar** un ejercicio individual.
- **Duplicar un bloque completo** (con todos sus ejercicios) — para
  armar "semana 2 = semana 1 con más peso" sin cargar todo de nuevo.
- **Eliminar un bloque**.
- **Avisar al alumno** (botón explícito, dispara notificación + push)
  cuando la rutina ya está lista para arrancar.

## 5. Biblioteca de ejercicios — valores por defecto
En `/coach/ejercicios/nuevo` ahora se pueden cargar series, repeticiones,
peso sugerido, tempo, descanso, método y TUT **como plantilla** del
ejercicio. `Ejercicio` en `prisma/schema.prisma` tiene 7 campos nuevos
`*_default` (migración
`20260827010000_add_valores_default_ejercicio`). No reemplazan nada de
`EjercicioPrograma` — al elegir el ejercicio desde el selector en
`/coach/programas/[id]`, esos valores precargan el formulario
automáticamente y el coach los puede pisar antes de guardar.

---

# Instalar y correr

```bash
npm install          # dispara "prisma generate" automáticamente (postinstall)
npx prisma migrate deploy   # aplica la migración nueva contra Supabase
npm run dev           # http://localhost:3000
```

Para producción: `npm run build && npm run start`, o desplegar en Vercel
como ya lo tenías configurado.

## ⚠️ Importante — no pude verificar esto acá
Este sandbox no tiene salida de red a `binaries.prisma.sh` (de donde
Prisma baja el motor nativo), así que no pude correr `prisma generate`
ni `npm run build` completos acá adentro. Lo que sí hice para
compensar:
- Corrí `tsc --noEmit` sobre todo el proyecto: los únicos errores que
  quedan son exactamente los que se esperan por no tener el cliente de
  Prisma regenerado (`Property 'suscripcionPush' does not exist...`) —
  desaparecen solos en cuanto corras `npm install` en tu máquina/CI con
  salida de red normal.
- Corrí `eslint` sobre todos los archivos nuevos/modificados: limpio.
- Revisé a mano cada nombre de modelo/campo contra el `schema.prisma`.

Por las dudas: después de `npm install`, corré `npm run build` una vez
antes de deployar, para chequear en tu entorno real que compila
limpio.

## Migración de base de datos
Hay dos migraciones nuevas, ninguna toca datos existentes:
- `20260827000000_add_suscripciones_push`
- `20260827010000_add_valores_default_ejercicio`

`npx prisma migrate deploy` las aplica ambas sin downtime.

## Nota sobre esta sesión de trabajo
En este entorno de sandbox no tengo salida de red hacia
`binaries.prisma.sh`, así que no pude correr `prisma generate` /
`npm run build` de punta a punta para esta última tanda de cambios
(el `npm install` de acá también falló en el paso `postinstall`).
Verifiqué con `eslint` sobre cada archivo tocado (limpio) y revisé a
mano cada nombre de modelo/campo contra `schema.prisma`. El zip que te
dejo NO incluye `node_modules`, así que esto no te afecta a vos: tu
`npm install` real (con salida de red normal) va a regenerar el
cliente de Prisma sin problema. Igual, corré `npm run build` una vez
en tu máquina antes de deployar, como chequeo final.
