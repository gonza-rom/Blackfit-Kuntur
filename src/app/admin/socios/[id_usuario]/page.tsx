import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerAdminComerciosActual } from "@/lib/auth";
import { resumenSocio, ETIQUETA_ESTADO_SOCIO } from "@/lib/kuntur";
import { renovarMembresiaSocio, cambiarEstadoSocio } from "@/app/actions/kuntur";
import { ConfirmForm } from "@/components/confirm-form";
import { CodigoActivacion, CorreccionCuenta, FormSocio } from "../_components/formularios-socio";

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});
const ISO = (d: Date | null | undefined) => (d ? new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10) : "");

const TARJETA = "bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3";
const TITULO = "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase";
const INPUT = "bg-[#262626] border border-transparent rounded text-on-surface text-sm p-2";
const BOTON = "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-2 rounded-full";

// Ficha de un socio de Kuntur: datos, membresía (renovar, suspender, baja),
// activación de cuenta e historial. Si la cuenta NO es socio pero quedó
// como alumno de Blackfit sin actividad, muestra las herramientas para
// corregirla.
export default async function FichaSocioPage(props: { params: Promise<{ id_usuario: string }> }) {
  if (!(await obtenerAdminComerciosActual())) notFound();
  const { id_usuario } = await props.params;

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario },
    include: {
      roles: { select: { rol: true } },
      socio_kuntur: true,
      credencial: { select: { numero_socio: true } },
      alumno: { include: { _count: { select: { relaciones: true, entrenamientos: true } } } },
      membresias: {
        where: { plan_membresia: { organizacion: "kuntur" } },
        orderBy: { fecha_vencimiento_membresia: "desc" },
        include: { plan_membresia: { select: { nombre: true } } },
      },
      _count: { select: { validaciones: true } },
    },
  });
  if (!usuario) notFound();

  const emailVisible = usuario.email.endsWith(".blackhub.local") ? "—" : usuario.email;
  const tambienBlackfit = usuario.roles.some((r) => r.rol === "alumno" || r.rol === "entrenador");

  if (!usuario.socio_kuntur) {
    const esCandidato =
      usuario.roles.some((r) => r.rol === "alumno") &&
      !usuario.alumno?._count.relaciones &&
      !usuario.alumno?._count.entrenamientos;
    if (!esCandidato) notFound();
    return (
      <main className="flex-1 w-full max-w-md sm:max-w-2xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
        <div>
          <Link href="/admin/socios" className="text-sm text-on-surface-variant">← Socios</Link>
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
            {usuario.nombre} {usuario.apellido}
          </h1>
          <p className="text-sm text-on-surface-variant">{emailVisible} · registrada como alumno de Blackfit, sin actividad</p>
        </div>
        <section className={TARJETA}>
          <CorreccionCuenta idUsuario={id_usuario} />
        </section>
      </main>
    );
  }

  const [r, planes] = await Promise.all([
    resumenSocio(id_usuario),
    prisma.planMembresia.findMany({ where: { organizacion: "kuntur" }, orderBy: { duracion_dias: "asc" } }),
  ]);

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <Link href="/admin/socios" className="text-sm text-on-surface-variant">← Socios</Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          {usuario.nombre} {usuario.apellido}
        </h1>
        <p className="text-sm text-on-surface-variant">
          DNI {usuario.dni ?? "—"} · {emailVisible} · credencial {usuario.credencial?.numero_socio ?? "—"}
        </p>
        <p className="text-xs text-on-surface-variant mt-1">
          Socio desde {FECHA.format(r.altaGimnasio)} ({r.antiguedad}) · cuenta {usuario.socio_kuntur.cuenta_activada ? "activada" : "sin activar"} ·{" "}
          {usuario._count.validaciones} beneficios validados
          {tambienBlackfit ? " · también usa Blackfit (membresías independientes)" : ""}
        </p>
      </div>

      <section className={TARJETA}>
        <h2 className={TITULO}>Membresía Kuntur</h2>
        <p className="text-sm text-on-surface">
          {ETIQUETA_ESTADO_SOCIO[r.estado]}
          {r.membresia ? ` · ${r.membresia.plan_membresia.nombre}` : ""}
          {r.estado === "vigente" ? ` · ${r.diasRestantes} días restantes` : ""}
          {r.membresia ? ` · ${r.estado === "vigente" ? "vence" : "venció"} ${FECHA.format(r.membresia.fecha_vencimiento_membresia)}` : ""}
        </p>
        <ConfirmForm
          action={renovarMembresiaSocio}
          titulo="Renovar membresía"
          mensaje="¿Renovar un período del plan elegido? Si la membresía sigue vigente, empieza cuando termine la actual."
          confirmLabel="Renovar"
          variante="positiva"
          className="flex flex-wrap gap-2 items-center"
        >
          <input type="hidden" name="id_usuario" value={id_usuario} />
          <select name="id_plan_membresia" className={INPUT}>
            {planes.map((p) => (
              <option key={p.id_plan_membresia} value={p.id_plan_membresia}>
                {p.nombre} ({p.duracion_dias} días)
              </option>
            ))}
          </select>
          <button type="submit" className={`${BOTON} bg-primary-container text-black font-bold`}>
            {r.estado === "sin_membresia" ? "Activar" : "Renovar"}
          </button>
        </ConfirmForm>
        {r.membresia && (
          <div className="flex flex-wrap gap-2">
            {r.estado === "suspendida" || r.estado === "baja" ? (
              <form action={cambiarEstadoSocio}>
                <input type="hidden" name="id_usuario" value={id_usuario} />
                <input type="hidden" name="estado" value="activa" />
                <button type="submit" className={`${BOTON} border border-outline-variant text-on-surface-variant`}>Reactivar</button>
              </form>
            ) : (
              <form action={cambiarEstadoSocio}>
                <input type="hidden" name="id_usuario" value={id_usuario} />
                <input type="hidden" name="estado" value="suspendida" />
                <button type="submit" className={`${BOTON} border border-outline-variant text-on-surface-variant`}>Suspender</button>
              </form>
            )}
            {r.estado !== "baja" && (
              <ConfirmForm action={cambiarEstadoSocio} mensaje="¿Dar de baja la membresía Kuntur? La cuenta y el historial se conservan." confirmLabel="Dar de baja">
                <input type="hidden" name="id_usuario" value={id_usuario} />
                <input type="hidden" name="estado" value="cancelada" />
                <button type="submit" className={`${BOTON} border border-[#ffb4ab]/50 text-[#ffb4ab]`}>Dar de baja</button>
              </ConfirmForm>
            )}
          </div>
        )}
        {usuario.membresias.length > 0 && (
          <details className="text-xs text-on-surface-variant">
            <summary className="cursor-pointer">Historial ({usuario.membresias.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {usuario.membresias.map((m) => (
                <li key={m.id_membresia} className="flex justify-between gap-2">
                  <span>{m.plan_membresia.nombre} · {m.estado_membresia}</span>
                  <span className="tabular-nums">{FECHA.format(m.fecha_inicio_membresia)} → {FECHA.format(m.fecha_vencimiento_membresia)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className={TARJETA}>
        <h2 className={TITULO}>Acceso a la app</h2>
        <CodigoActivacion idUsuario={id_usuario} activada={usuario.socio_kuntur.cuenta_activada} />
      </section>

      <section className={TARJETA}>
        <h2 className={TITULO}>Datos del socio</h2>
        <FormSocio
          datos={{
            id_usuario,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            dni: usuario.dni,
            telefono: usuario.telefono,
            fecha_nacimiento: ISO(usuario.socio_kuntur.fecha_nacimiento),
            fecha_alta: ISO(usuario.socio_kuntur.fecha_alta_gimnasio),
            observaciones: usuario.socio_kuntur.observaciones,
          }}
        />
      </section>
    </main>
  );
}
