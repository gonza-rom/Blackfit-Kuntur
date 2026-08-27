import { prisma } from "@/lib/prisma";
import { crearNotificacion } from "@/lib/notificaciones";

const DIA_MS = 1000 * 60 * 60 * 24;
const VENTANA_AVISO_DIAS = 5;

/**
 * La activación/renovación de membresía es manual (el admin la activa
 * desde /admin/usuarios/[id]) y la vigencia ya se valida en tiempo real
 * en cada lugar que la consulta (estado === "activa" AND
 * fecha_vencimiento >= hoy — ver src/app/actions/comercio.ts y
 * /panel/beneficios). Lo único que faltaba era avisar ANTES de que
 * venza, para que el alumno/socio la renueve a tiempo.
 *
 * Sin infraestructura de cron: se llama de forma oportunista desde el
 * layout en cada visita autenticada, y usa una notificación existente
 * como "ya avisé esta semana" para no duplicar el aviso en cada request.
 */
export async function verificarRecordatorioMembresia(id_usuario: string): Promise<void> {
  const membresia = await prisma.membresia.findFirst({
    where: { id_usuario, estado_membresia: "activa" },
    orderBy: { fecha_vencimiento_membresia: "desc" },
    include: { plan_membresia: true },
  });
  if (!membresia) return;

  const diasParaVencer = Math.ceil(
    (membresia.fecha_vencimiento_membresia.getTime() - Date.now()) / DIA_MS
  );
  if (diasParaVencer < 0 || diasParaVencer > VENTANA_AVISO_DIAS) return;

  const avisoReciente = await prisma.notificacion.findFirst({
    where: {
      id_usuario,
      tipo: "membresia_vencimiento",
      fecha_creacion: { gte: new Date(Date.now() - VENTANA_AVISO_DIAS * DIA_MS) },
    },
  });
  if (avisoReciente) return;

  const mensaje =
    diasParaVencer === 0
      ? `Tu membresía "${membresia.plan_membresia.nombre}" vence hoy.`
      : `Tu membresía "${membresia.plan_membresia.nombre}" vence en ${diasParaVencer} día${
          diasParaVencer === 1 ? "" : "s"
        }.`;

  await crearNotificacion({
    id_usuario,
    titulo: "Tu membresía está por vencer",
    contenido: mensaje,
    tipo: "membresia_vencimiento",
    url: "/panel/beneficios",
  });
}
