import { redirect } from "next/navigation";
import { obtenerUsuarioActual, cuentaActiva, accesoAlumnoBloqueado } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkWhatsapp } from "@/lib/telefono";
import { cerrarSesion } from "@/app/actions/auth";

export default async function MembresiaVencidaPage() {
  const usuario = await obtenerUsuarioActual();

  // Sin sesión, cuenta inactiva (tiene su propia pantalla) o membresía ya
  // renovada por el coach: no hay nada que mostrar acá.
  if (!usuario) redirect("/iniciar-sesion");
  if (!cuentaActiva(usuario)) redirect("/cuenta-inactiva");
  if (!(await accesoAlumnoBloqueado(usuario))) redirect("/panel");

  // Solo el coach con la relación ACTIVA con este alumno.
  const relacion = usuario.alumno
    ? await prisma.relacionEntrenadorAlumno.findFirst({
        where: { id_alumno: usuario.alumno.id_alumno, estado_relacion: "activa" },
        include: { entrenador: { include: { usuario: true } } },
      })
    : null;

  const entrenador = relacion?.entrenador ?? null;
  const wa = entrenador
    ? linkWhatsapp(
        entrenador.usuario.telefono,
        `Hola ${entrenador.usuario.nombre}, quiero renovar mi membresía de Black Hub.`
      )
    : null;

  return (
    <div className="min-h-dvh flex flex-1 items-center justify-center bg-black px-[max(1.25rem,env(safe-area-inset-left))] py-10">
      <main className="w-full max-w-md text-center flex flex-col items-center gap-4">
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-[#ffb4ab]/10 text-[#ffb4ab]">
          <span className="material-symbols-outlined text-4xl">lock</span>
        </span>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface uppercase">
          Membresía vencida
        </h1>
        <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant">
          Tu acceso a Black Hub Coach se encuentra vencido.
          <br />
          Para continuar utilizando la plataforma, contactá a tu Coach para renovar tu acceso.
        </p>

        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-[15px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all uppercase"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Contactar a mi coach
          </a>
        )}

        {(entrenador?.alias_pago || entrenador?.mensaje_membresia) && (
          <div className="w-full bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-2">
            {entrenador.alias_pago && (
              <div>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                  Alias de pago
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-base text-on-surface select-all break-all">
                  {entrenador.alias_pago}
                </p>
              </div>
            )}
            {entrenador.mensaje_membresia && (
              <p className="text-sm text-on-surface-variant whitespace-pre-line">
                {entrenador.mensaje_membresia}
              </p>
            )}
          </div>
        )}

        <form action={cerrarSesion} className="mt-2">
          <button
            type="submit"
            className="flex items-center gap-2 py-3 px-8 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-variant/20 transition-all font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar sesión
          </button>
        </form>
      </main>
    </div>
  );
}
