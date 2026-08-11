export default function PanelPage() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
      {/* Protocolo de hoy */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Protocolo de Hoy
        </h2>
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 relative overflow-hidden [border:1px_solid_#61edda] shadow-[inset_0_0_20px_rgba(97,237,218,0.05)]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-[#262626]/50 pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-[family-name:var(--font-sora)] text-[24px] leading-8 tracking-[-0.01em] font-semibold text-on-surface">
                  Fuerza y Potencia
                </h3>
                <p className="font-[family-name:var(--font-inter)] text-base text-on-surface-variant flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-[16px]">
                    schedule
                  </span>{" "}
                  60 min
                </p>
              </div>
              <span
                className="material-symbols-outlined text-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                fitness_center
              </span>
            </div>
            <button
              type="button"
              className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] leading-6 rounded-lg py-3 mt-2 active:scale-[0.98] transition-transform font-bold flex items-center justify-center"
            >
              COMENZAR SESIÓN
            </button>
          </div>
        </div>
      </section>

      {/* Métricas de rendimiento */}
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Métricas de Rendimiento
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {/* Peso */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-on-surface-variant absolute top-4 right-4 text-[20px]">
              monitor_weight
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              PESO ACTUAL
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
                78<span className="text-[16px] text-on-surface-variant">kg</span>
              </div>
              <div className="font-[family-name:var(--font-inter)] text-[12px] text-primary-container mt-1">
                -0.5kg este ciclo
              </div>
            </div>
          </div>

          {/* Adherencia */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-on-surface-variant absolute top-4 right-4 text-[20px]">
              track_changes
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              ADHERENCIA
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
                92<span className="text-[16px] text-on-surface-variant">%</span>
              </div>
              <div className="w-full h-1 bg-[#262626] rounded-full mt-2">
                <div
                  className="h-full bg-primary-container rounded-full"
                  style={{ width: "92%" }}
                />
              </div>
            </div>
          </div>

          {/* Hábitos */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-on-surface-variant absolute top-4 right-4 text-[20px]">
              check_circle
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              HÁBITOS
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-on-surface">
                5<span className="text-[16px] text-on-surface-variant">/7</span>
              </div>
              <div className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant mt-1">
                Meta Semanal
              </div>
            </div>
          </div>

          {/* Momentum */}
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between aspect-square relative overflow-hidden">
            <span className="material-symbols-outlined text-primary-container absolute top-4 right-4 text-[20px]">
              trending_up
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
              MOMENTUM
            </span>
            <div>
              <div className="font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold text-primary-container">
                +2<span className="text-[16px] text-primary-container">%</span>
              </div>
              <div className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant mt-1">
                Rendimiento vs Sem. Anterior
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Siguiente sesión y beneficios */}
      <section className="flex flex-col gap-1">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-[#262626] flex items-center justify-center bg-[#131313]">
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                calendar_month
              </span>
            </div>
            <div>
              <h4 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface">
                SIGUIENTE: CARRERA DE RECUPERACIÓN
              </h4>
              <p className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant">
                Mañana, 06:00 AM
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            chevron_right
          </span>
        </div>

        <a
          href="/panel/beneficios"
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex items-center justify-between border-l-2 border-l-primary-container"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-primary-container flex items-center justify-center bg-[#131313]">
              <span className="material-symbols-outlined text-primary-container text-[20px]">
                loyalty
              </span>
            </div>
            <div>
              <h4 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-primary-container">
                ESTADO KUNTUR ACTIVO
              </h4>
              <p className="font-[family-name:var(--font-inter)] text-[12px] text-on-surface-variant">
                Toca para ver tus beneficios Kuntur
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            qr_code_scanner
          </span>
        </a>
      </section>
    </main>
  );
}