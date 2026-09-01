import { redirect } from "next/navigation";
import { obtenerUsuarioActual, tieneRol } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkWhatsapp } from "@/lib/telefono";

export default async function PanelCoachPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneRol(usuario, "alumno") || !usuario.alumno) redirect("/panel");

  // Solo el entrenador con la relación ACTIVA con este alumno. Nunca se
  // expone el contacto de ningún otro coach.
  const relacion = await prisma.relacionEntrenadorAlumno.findFirst({
    where: { id_alumno: usuario.alumno.id_alumno, estado_relacion: "activa" },
    include: { entrenador: { include: { usuario: true } } },
  });

  if (!relacion) {
    return (
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-8">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no tenés un entrenador asignado — cuando el equipo de Kuntur te
          asigne uno, vas a poder contactarlo desde acá.
        </div>
      </main>
    );
  }

  const coach = relacion.entrenador.usuario;
  const nombreCoach = `${coach.nombre} ${coach.apellido}`;
  const inicial = coach.nombre.charAt(0).toUpperCase();
  const wa = linkWhatsapp(
    coach.telefono,
    `Hola ${coach.nombre}, te escribo desde Black Hub.`
  );

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Tu coach
      </h1>

      <section className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-full border border-[#262626] bg-[#131313] flex items-center justify-center">
          <span className="font-[family-name:var(--font-sora)] text-[32px] font-bold text-primary-container">
            {inicial}
          </span>
        </div>
        <div>
          <p className="font-[family-name:var(--font-sora)] text-lg font-semibold text-on-surface">
            {nombreCoach}
          </p>
          {relacion.entrenador.especialidad && (
            <p className="text-sm text-on-surface-variant">
              {relacion.entrenador.especialidad}
            </p>
          )}
        </div>

        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full max-w-xs flex items-center justify-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold py-3 rounded-lg active:scale-[0.98] transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Escribir por WhatsApp
          </a>
        ) : (
          <div className="mt-2 w-full max-w-xs bg-[#141414] border border-[#262626] rounded-lg py-3 px-4 text-xs text-on-surface-variant">
            Tu coach todavía no configuró su WhatsApp. Pedile que lo cargue en su
            perfil para poder escribirle desde acá.
          </div>
        )}
      </section>

      <p className="text-xs text-on-surface-variant text-center">
        La comunicación con tu coach es por WhatsApp. El chat interno de la app
        fue dado de baja.
      </p>
    </main>
  );
}
