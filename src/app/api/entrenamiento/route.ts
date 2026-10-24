import { NextResponse } from "next/server";
import { obtenerAlumnoActual, obtenerUsuarioActual, accesoAlumnoBloqueado } from "@/lib/auth";
import { avisar } from "@/lib/aviso";
import { guardarSesionEntrenamiento, type SerieRegistrada } from "@/lib/alumno";

// Usado por la cola offline (src/lib/offline-queue.ts): cuando el
// dispositivo recupera conexión, cada sesión de entrenamiento guardada
// localmente se reenvía acá como JSON. La cookie de sesión de Supabase
// viaja sola en el fetch (mismo origen), así que la autorización se
// valida igual que en la server action normal.
export async function POST(request: Request) {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) {
    // Sin sesión → 401. Con sesión pero sin membresía vigente → 403: la
    // sesión queda en la cola del teléfono (no se pierde) y se sincroniza
    // cuando el coach active o renueve la membresía.
    const usuario = await obtenerUsuarioActual();
    if (usuario && (await accesoAlumnoBloqueado(usuario))) {
      return NextResponse.json({ error: "Tu membresía de entrenamiento no está activa." }, { status: 403 });
    }
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: {
    id_bloque?: string;
    comentario_general?: string | null;
    series?: SerieRegistrada[];
    duracion_minutos?: number | null;
    calorias_estimadas?: number | null;
    sensacion_general?: number | null;
    id_sesion?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.id_bloque || !Array.isArray(body.series)) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const resultado = await guardarSesionEntrenamiento(
    contexto.id_alumno,
    body.id_bloque,
    body.comentario_general ?? null,
    body.series,
    {
      duracionMinutos: body.duracion_minutos ?? null,
      caloriasEstimadas: body.calorias_estimadas ?? null,
      sensacionGeneral: body.sensacion_general ?? null,
      // Solo un UUID: cualquier otra cosa se ignora (se guarda sin idempotencia).
      idSesion:
        typeof body.id_sesion === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id_sesion)
          ? body.id_sesion
          : null,
    }
  );

  if (resultado.error) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  await avisar("¡Entrenamiento registrado!");
  return NextResponse.json({ ok: true });
}
