import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoActual } from "@/lib/auth";
import { FormFeedbackDiario } from "./_components/form-feedback-diario";
import { FormFeedbackSemanal } from "./_components/form-feedback-semanal";
import { FeedbackDiarioItem } from "./_components/feedback-diario-item";
import { FeedbackSemanalItem } from "./_components/feedback-semanal-item";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

export default async function FeedbackPage() {
  const contexto = await obtenerAlumnoActual();
  if (!contexto) redirect("/panel");

  const [diarios, semanales] = await Promise.all([
    prisma.feedbackDiario.findMany({
      where: { id_alumno: contexto.id_alumno },
      orderBy: { fecha: "desc" },
      take: 10,
    }),
    prisma.feedbackSemanal.findMany({
      where: { id_alumno: contexto.id_alumno },
      orderBy: { semana_inicio: "desc" },
      take: 10,
    }),
  ]);

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Feedback
      </h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Diario
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormFeedbackDiario />
        </div>
        {diarios.length > 0 && (
          <div className="flex flex-col gap-1">
            {diarios.map((f) => (
              <FeedbackDiarioItem
                key={f.id_feedback_diario}
                id={f.id_feedback_diario}
                fecha={FORMATEADOR_FECHA.format(f.fecha)}
                comentario={f.comentario_diario}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Semanal
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <FormFeedbackSemanal />
        </div>
        {semanales.length > 0 && (
          <div className="flex flex-col gap-1">
            {semanales.map((f) => (
              <FeedbackSemanalItem
                key={f.id_feedback_semanal}
                id={f.id_feedback_semanal}
                semana={FORMATEADOR_FECHA.format(f.semana_inicio)}
                comentario={f.comentario_semanal}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
