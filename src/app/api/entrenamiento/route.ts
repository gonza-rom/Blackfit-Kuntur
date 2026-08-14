import { NextResponse } from "next/server";
import { obtenerAlumnoActual } from "@/lib/auth";
import { guardarSesionEntrenamiento, type SerieRegistrada } from "@/lib/alumno";

// Usado por la cola offline (src/lib/offline-queue.ts): cuando el
// dispositivo recupera conexión, cada sesión de entrenamiento guardada
// localmente se reenvía acá como JSON. La cookie de sesión de Supabase
// viaja sola en el fetch (mismo origen), así que la autorización se
// valida igual que en la server action normal.
export async function POST(request: Request) {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: {
    id_bloque?: string;
    comentario_general?: string | null;
    series?: SerieRegistrada[];
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
    body.series
  );

  if (resultado.error) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
