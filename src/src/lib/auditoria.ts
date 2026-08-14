import { prisma } from "@/lib/prisma";

export async function registrarAuditoria(datos: {
  id_usuario_actor: string;
  accion: string;
  recurso?: string;
  id_recurso?: string;
  resultado?: string;
}) {
  await prisma.registroAuditoria.create({
    data: {
      id_usuario: datos.id_usuario_actor,
      accion: datos.accion,
      recurso: datos.recurso,
      id_recurso: datos.id_recurso,
      resultado: datos.resultado,
    },
  });
}
