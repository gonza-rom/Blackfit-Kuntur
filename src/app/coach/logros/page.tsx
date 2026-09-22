import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerEntrenadorActual } from "@/lib/auth";
import { GestorLogros, type LogroSerializado } from "./_components/gestor-logros";

export default async function LogrosCoachPage() {
  const contexto = await obtenerEntrenadorActual();
  if (!contexto) redirect("/panel");

  const logros = await prisma.logro.findMany({
    orderBy: [{ activo: "desc" }, { fecha_creacion: "asc" }],
    include: { _count: { select: { alumnos: true } } },
  });

  const logrosSerializados: LogroSerializado[] = logros.map((l) => ({
    id_logro: l.id_logro,
    titulo: l.titulo,
    descripcion: l.descripcion,
    icono: l.icono,
    color: l.color,
    categoria: l.categoria,
    activo: l.activo,
    automatico: l.criterio !== null,
    otorgados: l._count.alumnos,
  }));

  return (
    <main className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-6 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Biblioteca de logros
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Este catálogo es único: lo armás una vez y después lo usás con &ldquo;+ Otorgar
          logro&rdquo; desde el perfil de cualquier alumno.
        </p>
      </div>

      <GestorLogros logros={logrosSerializados} />

      <Link
        href="/coach"
        className="text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1 self-start"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Volver al inicio
      </Link>
    </main>
  );
}
