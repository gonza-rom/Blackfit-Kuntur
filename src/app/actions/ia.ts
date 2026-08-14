"use server";

import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { detectarAlertas } from "@/lib/alertas";
import { registrarAuditoria } from "@/lib/auditoria";

export type EstadoSugerenciaIA = { error?: string; sugerencia?: string } | undefined;

// La decisión final siempre es del entrenador — esto solo redacta una
// lectura posible de las señales para agilizar la revisión, nunca
// escribe ni modifica nada del programa por sí sola.
export async function generarSugerenciaIA(id_alumno: string): Promise<EstadoSugerenciaIA> {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) return { error: "No autorizado." };

  const relacion = await prisma.relacionEntrenadorAlumno.findUnique({
    where: {
      id_entrenador_id_alumno: { id_entrenador: contexto.id_entrenador, id_alumno },
    },
  });
  if (!relacion || relacion.estado_relacion !== "activa") {
    return { error: "No autorizado sobre este alumno." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error:
        "El asistente de IA no está configurado todavía: falta la variable de entorno ANTHROPIC_API_KEY.",
    };
  }

  const [alertas, ultimosEntrenamientos, ultimoFeedback] = await Promise.all([
    detectarAlertas(id_alumno),
    prisma.entrenamiento.findMany({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
      take: 5,
      select: { fecha: true, estado: true, comentarios: true },
    }),
    prisma.feedbackDiario.findFirst({
      where: { id_alumno },
      orderBy: { fecha: "desc" },
    }),
  ]);

  if (alertas.length === 0) {
    return { sugerencia: "No hay señales de alerta activas — el alumno viene bien." };
  }

  const contextoTexto = [
    `Alertas detectadas: ${alertas.map((a) => `[${a.severidad}] ${a.mensaje}`).join(" | ")}`,
    `Últimos entrenamientos: ${ultimosEntrenamientos
      .map((e) => `${e.estado} (${e.fecha.toISOString().slice(0, 10)})`)
      .join(", ")}`,
    ultimoFeedback ? `Último feedback diario: "${ultimoFeedback.comentario_diario}"` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system:
          "Sos un asistente para entrenadores de un gimnasio. A partir de alertas automáticas " +
          "sobre un alumno, redactá en español, en 3-4 líneas y tono directo, una posible " +
          "lectura de la situación y 1-2 ajustes concretos a considerar (volumen, descanso, " +
          "deload, contacto personal, etc). Nunca prescribas cargas específicas ni diagnostiques " +
          "lesiones — dejá la decisión clínica o técnica al entrenador humano.",
        messages: [{ role: "user", content: contextoTexto }],
      }),
    });

    if (!res.ok) {
      return { error: "El asistente de IA no pudo responder. Probá de nuevo." };
    }

    const data = await res.json();
    const sugerencia = data.content
      ?.map((bloque: { type: string; text?: string }) =>
        bloque.type === "text" ? bloque.text : ""
      )
      .join("")
      .trim();

    await registrarAuditoria({
      id_usuario_actor: contexto.usuario.id_usuario,
      accion: "modificacion_admin",
      recurso: "sugerencia_ia",
      id_recurso: id_alumno,
      resultado: "generada",
    });

    return { sugerencia: sugerencia || "El asistente no devolvió una respuesta." };
  } catch {
    return { error: "No se pudo conectar con el asistente de IA." };
  }
}
