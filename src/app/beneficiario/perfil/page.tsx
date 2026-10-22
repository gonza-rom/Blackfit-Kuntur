import { redirect } from "next/navigation";
import { obtenerBeneficiarioActual } from "@/lib/auth";
import { cerrarSesion } from "@/app/actions/auth";
import { FormInformacionPersonal } from "@/app/panel/perfil/informacion-personal/_components/form-informacion-personal";
import { resumenSocio, ETIQUETA_ESTADO_SOCIO } from "@/lib/kuntur";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function BeneficiarioPerfilPage() {
  const contexto = await obtenerBeneficiarioActual();
  if (!contexto) redirect("/sin-acceso?ruta=kuntur");

  const { usuario } = contexto;
  const inicial = usuario.nombre.charAt(0).toUpperCase();
  const r = await resumenSocio(usuario.id_usuario);
  // Los socios importados tienen un email interno (dni…@beneficiario…): no
  // es un dato suyo, no se muestra.
  const emailVisible = usuario.email.endsWith(".blackhub.local") ? "" : usuario.email;

  // Datos del gimnasio: solo lectura (los carga Kuntur). El socio edita
  // únicamente nombre, teléfono y foto, nunca su rol ni su membresía.
  const datosSocio: [string, string][] = [
    ["Socio desde", `${FORMATEADOR_FECHA.format(r.altaGimnasio)} (${r.antiguedad})`],
    ["Membresía", r.membresia ? r.membresia.plan_membresia.nombre : "—"],
    ["Estado", ETIQUETA_ESTADO_SOCIO[r.estado]],
    [
      r.estado === "vigente" ? "Vence" : "Venció",
      r.membresia ? FORMATEADOR_FECHA.format(r.membresia.fecha_vencimiento_membresia) : "—",
    ],
    ...(r.estado === "vigente" ? ([["Días restantes", String(r.diasRestantes)]] as [string, string][]) : []),
    ...(r.socio?.fecha_nacimiento
      ? ([["Nacimiento", `${FORMATEADOR_FECHA.format(r.socio.fecha_nacimiento)} (${r.edad} años)`]] as [string, string][])
      : []),
    ...(usuario.dni ? ([["DNI", usuario.dni]] as [string, string][]) : []),
  ];

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <section className="flex flex-col items-center text-center gap-3">
        <div className="w-24 h-24 rounded-full overflow-hidden border border-[#262626] bg-[#1A1A1A] flex items-center justify-center">
          {usuario.foto_perfil ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar subido a Supabase Storage, no un asset del build
            <img
              src={usuario.foto_perfil}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-[family-name:var(--font-sora)] text-[40px] font-bold text-primary-container">
              {inicial}
            </span>
          )}
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {usuario.nombre} {usuario.apellido}
        </h1>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container uppercase">
          Socio Kuntur
        </span>
      </section>

      <dl className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col">
        {datosSocio.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-[#262626] last:border-0 py-2 text-sm">
            <dt className="text-on-surface-variant">{k}</dt>
            <dd className="text-on-surface text-right">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <FormInformacionPersonal
          nombre={usuario.nombre}
          apellido={usuario.apellido}
          telefono={usuario.telefono}
          email={emailVisible}
          fotoActual={usuario.foto_perfil}
        />
      </div>

      <div className="flex justify-center pt-4 border-t border-outline-variant/30">
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="flex items-center gap-2 py-3 px-8 rounded-lg border border-outline-variant text-[#ffb4ab] hover:bg-[#ffb4ab]/10 hover:border-[#ffb4ab]/50 transition-all font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar Sesión
          </button>
        </form>
      </div>
    </main>
  );
}
