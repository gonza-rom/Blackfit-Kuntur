import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { cerrarSesion } from "@/app/actions/auth";
import { CredencialCard } from "../beneficios/_components/credencial-card";
import { calcularEstadisticasAlumno } from "@/lib/alumno";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const ETIQUETA_ESTADO: Record<string, string> = {
  activa: "Activa",
  vencida: "Vencida",
  cancelada: "Cancelada",
  suspendida: "Suspendida",
  pendiente: "Pendiente",
};

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const usuario = user
    ? await prisma.usuario.findUnique({
        where: { id_usuario: user.id },
        include: {
          membresias: {
            orderBy: { fecha_vencimiento_membresia: "desc" },
            take: 1,
            include: { plan_membresia: true },
          },
          roles: true,
          alumno: true,
          credencial: true,
        },
      })
    : null;

  const nombreCompleto = usuario
    ? `${usuario.nombre} ${usuario.apellido}`
    : (user?.user_metadata?.nombre as string | undefined) ??
      user?.email?.split("@")[0] ??
      "Atleta";

  const esKuntur =
    usuario?.roles.some((r: { rol: string }) => r.rol === "miembro_kuntur") ??
    false;
  const membresia = usuario?.membresias[0];
  const inicial = nombreCompleto.charAt(0).toUpperCase();

  const estadisticas =
    usuario?.alumno && (await calcularEstadisticasAlumno(usuario.alumno.id_alumno));

  const membresiaVigente = Boolean(
    membresia &&
      membresia.estado_membresia === "activa" &&
      membresia.fecha_vencimiento_membresia >= new Date()
  );

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8">
      {/* Encabezado de perfil */}
      <section className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-4">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border border-[#262626] shadow-[0_0_20px_rgba(97,237,218,0.1)] bg-[#1A1A1A] flex items-center justify-center">
            <span className="font-[family-name:var(--font-sora)] text-[56px] font-bold text-primary-container">
              {inicial}
            </span>
          </div>
          <div className="absolute bottom-0 right-2 w-4 h-4 bg-primary-container rounded-full border-2 border-background" />
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-[24px] leading-8 md:text-[36px] md:leading-[42px] font-bold text-on-surface mb-1">
          {nombreCompleto}
        </h1>
        {esKuntur && (
          <div className="flex items-center justify-center gap-2">
            <span
              className="material-symbols-outlined text-primary-container text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container uppercase">
              Socio Elite Kuntur
            </span>
          </div>
        )}
      </section>

      {/* Fila de estadísticas */}
      <section className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1f1f1f] border border-[#262626] rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
          <span className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface mb-1 group-hover:text-primary-container transition-colors">
            {estadisticas ? estadisticas.sesiones : "—"}
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Sesiones
          </span>
        </div>
        <div className="bg-[#1f1f1f] border border-[#262626] rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
          <span className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface mb-1 group-hover:text-primary-container transition-colors">
            {estadisticas ? estadisticas.rachaDias : "—"}
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Racha (días)
          </span>
        </div>
        <div className="bg-[#1f1f1f] border border-[#262626] rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
          <span className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface mb-1 group-hover:text-primary-container transition-colors">
            {estadisticas ? estadisticas.nuevosRecords : "—"}
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
            Nuevos Récords
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Columna izquierda: acciones */}
        <div className="flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-1 pl-2">
            Gestión de Cuenta
          </h2>
          {[
            { icon: "badge", label: "Información Personal", href: "/panel/perfil/informacion-personal" },
            { icon: "credit_card", label: "Plan de Membresía", href: "/panel/beneficios" },
            { icon: "monitor_heart", label: "Métricas Corporales", href: "/panel/seguimiento/progreso" },
          ].map((item) => (
            <Link
              key={item.label}
              className="flex items-center justify-between bg-[#1f1f1f] border border-[#262626] rounded-lg p-4 hover:border-outline-variant transition-colors group"
              href={item.href}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#353535] flex items-center justify-center text-on-surface-variant group-hover:text-primary-container transition-colors">
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <span className="font-[family-name:var(--font-inter)] text-base text-on-surface">
                  {item.label}
                </span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface transition-colors">
                chevron_right
              </span>
            </Link>
          ))}
        </div>

        {/* Columna derecha: tarjetas */}
        <div className="flex flex-col gap-4">
          {/* Estado de membresía */}
          <div className="bg-[#1f1f1f] [border:1px_solid_#61edda] rounded-xl p-6 relative overflow-hidden shadow-[0_0_15px_rgba(97,237,218,0.05)]">
            <div className="absolute top-0 right-0 p-4">
              <span
                className="material-symbols-outlined text-primary-container opacity-20 text-6xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
            <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase mb-4">
              Estado de Membresía
            </h3>
            <div className="flex items-end gap-3 mb-2">
              <span
                className={`w-3 h-3 rounded-full mb-2 ${
                  membresia?.estado_membresia === "activa"
                    ? "bg-primary-container shadow-[0_0_10px_#61EDDA]"
                    : "bg-on-surface-variant"
                }`}
              />
              <span className="font-[family-name:var(--font-sora)] text-[24px] leading-8 font-semibold text-on-surface">
                {membresia
                  ? ETIQUETA_ESTADO[membresia.estado_membresia]
                  : "Sin membresía"}
              </span>
            </div>
            <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant">
              {membresia
                ? `${membresia.plan_membresia.nombre} · Se renueva el ${FORMATEADOR_FECHA.format(
                    membresia.fecha_vencimiento_membresia
                  )}`
                : "Todavía no tenés un plan activo."}
            </p>
            <Link
              href="/panel/beneficios"
              className="mt-6 w-full py-3 px-4 bg-transparent border border-primary-container text-primary-container font-[family-name:var(--font-sora)] text-sm rounded-lg hover:bg-primary-container/10 transition-colors uppercase tracking-wider flex items-center justify-center"
            >
              Gestionar Plan
            </Link>
          </div>

          {/* Acceso QR — credencial real, la misma que en /panel/beneficios */}
          {usuario?.credencial ? (
            <CredencialCard
              nombreCompleto={nombreCompleto.toUpperCase()}
              numeroSocio={usuario.credencial.numero_socio}
              membresiaActiva={membresiaVigente}
              codigoQrToken={usuario.credencial.codigo_qr_token}
            />
          ) : (
            <div className="bg-[#1f1f1f] border border-[#262626] rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
              <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-2">
                qr_code_2
              </span>
              <h3 className="font-[family-name:var(--font-sora)] text-lg font-semibold text-on-surface mb-1">
                Sin credencial todavía
              </h3>
              <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant">
                Se genera automáticamente cuando se activa tu membresía Kuntur.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cerrar sesión */}
      <div className="flex justify-center mt-8 pt-8 border-t border-outline-variant/30">
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