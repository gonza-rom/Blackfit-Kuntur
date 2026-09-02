# Cambios de esta entrega

## 1. Gamificación — objetivos, puntos diarios y logros
Sistema **independiente** del motor de alertas (`src/lib/alertas.ts`): no
lo modifica ni depende de él. Vive aparte.

- **Schema** (`prisma/schema.prisma`) + migración
  `prisma/migrations/20260901000000_add_gamificacion/`. No toca datos
  existentes — lo único que agrega a una tabla ya existente es
  `alumnos.puntos_totales` (`INTEGER NOT NULL DEFAULT 0`, no reescribe
  filas). Modelos nuevos:
  - `Objetivo`: objetivos configurables por alumno (`tipo` enum
    `TipoObjetivo`: volumen / frecuencia / habito / peso_corporal /
    custom; `meta` y `progreso_actual` Decimal; `estado` enum
    `EstadoObjetivo`: activo / cumplido / vencido / cancelado;
    `fecha_inicio`, `fecha_objetivo`).
  - `Logro`: catálogo maestro (`codigo` estable, `titulo`, `descripcion`,
    `icono` = Material Symbol, `criterio` JSON con la regla evaluable, ej.
    `{"tipo":"racha_dias","valor":7}`). La migración **siembra 9 logros**
    con `ON CONFLICT DO NOTHING` (re-aplicarla es inocuo).
  - `LogroAlumno`: N:N Alumno↔Logro con `fecha_obtenido` y
    `@@unique(id_alumno, id_logro)`.
  - `MovimientoPuntos`: historial de puntos ganados. El
    `@@unique(id_alumno, motivo)` es la **garantía de idempotencia**:
    `motivo` es una clave estable del evento (`entrenamiento:<id>`,
    `habito:2026-09-01`, `feedback_diario:2026-09-01`), así el mismo
    evento nunca suma puntos dos veces.
  - RLS para las cuatro tablas siguiendo el patrón de
    `20260814000000_enable_rls` (alumno ve lo suyo, entrenador vía
    `entrenador_tiene_alumno`, admin todo; catálogo `logros` legible por
    cualquier autenticado).

- **Lógica** (`src/lib/gamificacion.ts`, mismo estilo que `alertas.ts` /
  `membresia.ts`):
  - `otorgarPuntos(id_alumno, motivo, cantidad)` — punto **único**: crea
    el `MovimientoPuntos` y actualiza `puntos_totales` en una sola
    transacción. Idempotente por `motivo` (si el evento ya sumó, no hace
    nada y no lanza).
  - `evaluarLogros(id_alumno)` — chequea cada `criterio` del catálogo
    contra el estado real del alumno (racha de días, entrenamientos
    completados, puntos totales, objetivos cumplidos, volumen acumulado)
    y asigna los que correspondan vía `LogroAlumno`, disparando
    notificación in-app + push con el mismo `crearNotificacion` de
    `src/lib/notificaciones.ts`.
  - `registrarActividad()` — otorga + reevalúa; nunca lanza (la
    gamificación es un extra, no puede tumbar la acción que la disparó).
  - Enganchada en los flujos que **ya** registran actividad del alumno,
    sin cambiar su comportamiento:
    - `guardarSesionEntrenamiento` (`src/lib/alumno.ts`) — al completar un
      entrenamiento: **+20**.
    - `registrarHabito` (`src/app/actions/alumno.ts`) — hábitos del día:
      **+10**, una sola vez por día.
    - `registrarFeedbackDiario` — feedback diario: **+5**, una sola vez
      por día aunque cargue varios.

- **UI**:
  - Alumno: nueva pantalla **`/panel/logros`** (objetivos activos con
    barra de progreso, puntos totales + últimos movimientos, grilla de
    logros obtenidos vs. bloqueados) + tarjeta resumen en el dashboard
    (`/panel`). Los logros se reevalúan de forma **oportunista** al
    visitar la pantalla (igual que el recordatorio de membresía en el
    layout).
  - Coach: sección **"Objetivos"** en la ficha del alumno
    (`/coach/alumnos/[id_alumno]`) para crear y editar objetivos
    (progreso, estado, meta, fecha). Acciones `crearObjetivo` /
    `actualizarObjetivo` en `src/app/actions/coach.ts`, que validan en el
    servidor que el alumno esté en la cartera **activa** del entrenador.

## 2. Mensajería — se retira el chat interno, entra WhatsApp
**Diagnóstico del chat actual**: `ChatBox`
(`src/components/chat-box.tsx`) recibe los mensajes como prop del server
component y **no tiene capa de tiempo real ni polling** — un mensaje que
manda la otra parte no aparece hasta recargar la página entera
(`enviarMensaje` hacía `revalidatePath`, pero eso solo refresca la vista
del que envía, y `useActionState` mantiene la lista vieja). Además duplica
un canal que coaches y alumnos ya usan todos los días. En vez de
construir infraestructura de realtime (Supabase Realtime + RLS, como
anticipa el comentario de `20260814000000_enable_rls`), se reemplaza por
un enlace directo a WhatsApp.

- Los modelos `Conversacion` / `Mensaje` y sus migraciones **no se
  tocan**: se conservan para no perder el historial ya cargado ni romper
  las políticas RLS. Solo se deja de usarlos en la UI.
- `src/lib/telefono.ts` (nuevo): `normalizarTelefonoWhatsapp()` /
  `linkWhatsapp()` — limpieza best-effort para números argentinos (saca
  espacios, guiones, el `0` nacional y el `15` de celular; agrega código
  de país `54`/`549`). Si el número guardado está muy incompleto devuelve
  `null` y la UI muestra el aviso en vez de un link roto.
- Alumno: se elimina `/panel/chat`; nueva **`/panel/coach`** muestra la
  ficha del entrenador con relación **activa**
  (`RelacionEntrenadorAlumno.estado_relacion = activa`) y un botón
  **"Escribir por WhatsApp"** armado con `Usuario.telefono` de ese coach.
  Si el coach no cargó teléfono, el botón se reemplaza por un aviso.
  Nunca se expone el contacto de ningún otro coach. La tarjeta
  "Mensajes" del dashboard pasa a "Tu coach".
- Coach: `/coach/mensajes` pasa a ser una lista de alumnos con botón de
  WhatsApp (usa `Usuario.telefono` del alumno); se elimina el hilo
  `/coach/mensajes/[id_alumno]`. El ítem de nav "Mensajes" pasa a
  "WhatsApp".
- `src/components/chat-box.tsx` eliminado.
- `src/app/actions/comunicacion.ts`: se quitan `enviarMensaje`,
  `obtenerOCrearConversacion` y `marcarConversacionLeida`. **Con eso se
  retira el trigger de push `tipo: "mensaje"`** que figuraba en el punto
  2 de la entrega anterior — el resto de los triggers de push (programa
  nuevo, rutina lista, vencimiento de membresía) y las notificaciones de
  logros nuevas siguen funcionando igual.

## 3. Nuevo rol: `beneficiario`
**Decisión: rol nuevo separado, no un alias de `miembro_kuntur`.** Motivo:
`miembro_kuntur` hoy funciona como *add-on* sobre un usuario Black Fit (el
propio schema lo documenta: "ej. alumno + miembro_kuntur") y las rutas
`/panel` lo tratan así. El pedido es un usuario que **no** tenga nada que
ver con Black Fit, así que conviene un rol propio con su layout aislado,
que no pueda heredar rutas de Black Fit por accidente.

- **Schema** + migración
  `prisma/migrations/20260901010000_add_rol_beneficiario/`: solo
  `ALTER TYPE "RolUsuario" ADD VALUE 'beneficiario'`. No toca datos.
- **Control de acceso** (siempre server-side contra `UsuarioRol`, nunca
  contra un valor del cliente — mismo patrón que el resto):
  - `src/lib/auth.ts`: `obtenerBeneficiarioActual()` y
    `soloBeneficiario()` (beneficiario sin ningún rol de Black Fit ni
    operativo).
  - `src/proxy.ts`: `/beneficiario` agregado a `RUTAS_PROTEGIDAS`.
  - `/panel/layout.tsx`: si `soloBeneficiario(usuario)` → `redirect
    "/beneficiario"`. Un beneficiario puro que caiga en
    `/coach` / `/admin` / `/comercio` ya rebota a `/panel` (le falta el
    rol) y de ahí a `/beneficiario`.
  - `/beneficiario/layout.tsx`: exige el rol `beneficiario` o
    `redirect "/panel"`.
- **Rutas nuevas** (`/beneficiario`, con layout y navegación propios,
  branding "KUNTUR", sin menú de Black Fit):
  - `/beneficiario`: credencial (QR) + beneficios del plan de su
    membresía **activa y vigente** (`estado = activa` AND
    `fecha_vencimiento >= hoy`). Reusa `CredencialCard`.
  - `/beneficiario/perfil`: datos de `Usuario` + cerrar sesión. Reusa
    `FormInformacionPersonal`; `actualizarInformacionPersonal` ahora
    también revalida `/beneficiario/perfil`.
- **Alta**: el formulario de registro se extrajo a
  `src/app/registro/_components/form-registro.tsx` (`tipo`:
  `"alumno" | "beneficiario"`, campo `hidden`). Nueva
  **`/registro/beneficiario`**. `registrarse()` lee `tipo`: si es
  `"beneficiario"` crea el usuario **solo con el rol `beneficiario`**
  (sin perfil de `Alumno`) y redirige a `/beneficiario`. Cualquier otro
  valor = alta de alumno de siempre. Links cruzados entre ambas pantallas
  de registro.
- **Admin**: `beneficiario` agregado a `ROLES_ASIGNABLES` (acción
  `asignarRol` / `quitarRol` y pantalla `/admin/usuarios/[id_usuario]`).
- No hizo falta RLS nueva: los beneficios/credencial se leen vía Prisma
  (`DATABASE_URL` / service role), que ya bypassa RLS, y las políticas
  existentes de `beneficios` / `membresias` / `credenciales` dependen de
  la membresía, no del rol.

## 4. Fotos de progreso — conectadas a Supabase Storage
`MedidaCorporal.foto_url` ya existía en el schema pero nunca se había
enchufado a Storage. Ahora sí.

- `src/lib/storage.ts` (nuevo): bucket **privado** `fotos-progreso`. Todo
  el acceso pasa por el cliente admin (service role), igual que el resto
  del backend — el navegador nunca sube ni lee directo del bucket. Cada
  vez que se muestra una foto se genera una **URL firmada** de 1 hora.
  El bucket se crea solo (lazy) en la primera subida si no existe. Si
  Storage no está configurado (`SUPABASE_SERVICE_ROLE_KEY` ausente), la
  subida degrada en silencio y la medida se guarda igual, sin foto.
- `registrarMedidaCorporal` acepta una foto opcional;
  `editarMedidaCorporal` permite reemplazarla o quitarla;
  `eliminarMedidaCorporal` borra también el objeto del bucket.
- UI: input de archivo en el formulario de medida; miniatura + ampliar en
  el historial del alumno (`/panel/seguimiento/progreso`) y en la ficha
  del alumno del coach.

## 5. CRUD que faltaba
- **Editar recurso de la biblioteca educativa** (modelo `Biblioteca`):
  antes solo tenía crear y eliminar. Nueva acción
  `editarRecursoBiblioteca` + edición inline en `/coach/biblioteca`.
- **Editar `Alumno.objetivo` y `Alumno.fecha_nacimiento`**: antes solo se
  mostraban. Nueva acción `actualizarDatosAlumno` (valida la relación
  entrenador-alumno activa en el servidor) + edición desde la ficha del
  alumno del coach.
- **Perfil propio del comercio**: antes dependía 100% del admin. Nueva
  acción `actualizarPerfilComercio` + `/comercio/perfil` + ítem de nav
  "Perfil".

## 6. Baja de usuarios — `estado_usuario`
`estado_usuario` (activo / inactivo / suspendido) existía en el modelo
pero nadie lo usaba ni lo podía tocar. Ahora es la forma correcta de dar
de baja un usuario **sin borrar nada** (no se toca Supabase Auth ni se
cascada ningún dato).

- Acción `cambiarEstadoUsuario` para el admin (no puede cambiarse su
  propio estado — evita el auto-lockout). Queda en auditoría.
- `iniciarSesion` rechaza a un usuario que no esté activo: cierra la
  sesión recién abierta y devuelve el motivo.
- Los layouts protegidos (`/panel`, `/coach`, `/admin`, `/comercio`,
  `/beneficiario`) mandan a `/cuenta-inactiva` si la cuenta no está
  activa — cubre las sesiones ya abiertas cuando el admin da de baja.
- UI de admin: sección "Estado de la cuenta" en `/admin/usuarios/[id]` +
  chip de estado en el listado.

---

# Instalar y correr

```bash
npm install          # dispara "prisma generate" automáticamente (postinstall)
npx prisma migrate deploy   # aplica las migraciones nuevas contra Supabase
npm run dev           # http://localhost:3000
```

Para producción: `npm run build && npm run start`, o desplegar en Vercel
como ya lo tenías configurado.

## Migración de base de datos
Dos migraciones nuevas, ninguna toca datos existentes:
- `20260901000000_add_gamificacion` — enums + 4 tablas nuevas + la
  columna `alumnos.puntos_totales` (`DEFAULT 0`, no reescribe filas) +
  RLS + seed de 9 logros (`ON CONFLICT DO NOTHING`).
- `20260901010000_add_rol_beneficiario` — `ALTER TYPE "RolUsuario" ADD
  VALUE 'beneficiario'`. En Postgres 12+ (Supabase es 15+) corre sin
  problema dentro de la transacción de la migración porque el valor
  nuevo no se usa en esa misma transacción.

`npx prisma migrate deploy` las aplica ambas sin downtime.

Los puntos 4, 5 y 6 **no traen migraciones nuevas**: `MedidaCorporal.foto_url`
y `Usuario.estado_usuario` ya existían en el schema.

## Supabase Storage (para las fotos de progreso, punto 4)
- El bucket privado `fotos-progreso` se crea solo la primera vez que un
  alumno sube una foto. Si preferís crearlo a mano: en el dashboard de
  Supabase → Storage → New bucket, nombre `fotos-progreso`, **Public =
  off**.
- Requiere que `SUPABASE_SERVICE_ROLE_KEY` esté cargada en el entorno de
  deploy (Vercel). Ya está en `.env` local. Sin esa key la app funciona
  igual pero no guarda fotos.
- No hacen falta políticas de Storage: todo el acceso al bucket es
  server-side con la service role.

## Verificación hecha en esta sesión
En este entorno **sí** hubo salida de red a `binaries.prisma.sh`
(el engine ya estaba cacheado), así que se pudo correr todo el flujo:
- `npx prisma generate` — OK con el schema.
- `npm run build` (`next build` de Next 16 con Turbopack) completo: la
  compilación, el chequeo de **TypeScript** y el **lint** pasan limpios,
  y todas las rutas se generan sin error (incluidas las nuevas
  `/comercio/perfil` y `/cuenta-inactiva`).

Lo que **no** se pudo verificar acá y conviene que corras vos antes de
deployar:
- `npx prisma migrate deploy` contra tu base real de Supabase (acá no se
  tocó la base). Recordá que esta tanda (puntos 4-6) no trae migraciones.
- Prueba de humo con datos reales:
  - subir una foto de progreso (mirá que el bucket `fotos-progreso` se
    haya creado en Supabase y que la miniatura aparezca);
  - dar de baja un usuario y confirmar que no puede loguear y que si ya
    tenía sesión abierta lo saca a `/cuenta-inactiva`;
  - editar un recurso de la biblioteca educativa, editar objetivo/fecha
    de nacimiento de un alumno desde el coach, y el perfil propio de un
    comercio;
  - lo de la entrega anterior: puntos al entrenar / hábitos / feedback,
    desbloqueo de logros y push, alta y login de un `beneficiario`, y el
    botón de WhatsApp con un teléfono de coach cargado.
