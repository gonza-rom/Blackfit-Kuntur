import Link from "next/link";

const SECCIONES = [
  {
    href: "/panel/seguimiento/progreso",
    label: "Progreso físico",
    icon: "monitor_weight",
    descripcion: "Peso corporal, medidas y composición.",
  },
  {
    href: "/panel/seguimiento/habitos",
    label: "Hábitos",
    icon: "check_circle",
    descripcion: "Sueño, agua, nutrición, cardio, movilidad.",
  },
  {
    href: "/panel/seguimiento/feedback",
    label: "Feedback",
    icon: "chat",
    descripcion: "Cómo te sentiste hoy y en la semana.",
  },
];

export default function SeguimientoPage() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
        Seguimiento
      </h1>

      <div className="flex flex-col gap-3">
        {SECCIONES.map((seccion) => (
          <Link
            key={seccion.href}
            href={seccion.href}
            className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between hover:border-primary-container/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#262626] flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined">{seccion.icon}</span>
              </div>
              <div>
                <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
                  {seccion.label}
                </p>
                <p className="text-sm text-on-surface-variant">{seccion.descripcion}</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">
              chevron_right
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
