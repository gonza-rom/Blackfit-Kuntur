"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { encolarSesion, sincronizarPendientes } from "@/lib/offline-queue";
import { ModalVideoEjercicio, type EjercicioDetalle } from "./modal-video-ejercicio";

type EjercicioPrograma = {
  id_ejercicio_programa: string;
  series: number;
  repeticiones: string;
  peso_sugerido: string | null;
  tempo: string | null;
  descanso: string | null;
  metodo_entrenamiento: string | null;
  tiempo_bajo_tension_sugerido: number | null;
  ejercicio: EjercicioDetalle;
};

const SENSACIONES = [
  { valor: 1, emoji: "😫", etiqueta: "Muy duro" },
  { valor: 2, emoji: "😕", etiqueta: "Costó" },
  { valor: 3, emoji: "🙂", etiqueta: "Bien" },
  { valor: 4, emoji: "😃", etiqueta: "Muy bien" },
  { valor: 5, emoji: "🤩", etiqueta: "Excelente" },
] as const;

function numeroOpcional(valor: FormDataEntryValue | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isNaN(n) ? null : n;
}

function textoOpcional(valor: FormDataEntryValue | string | null): string | null {
  const s = String(valor ?? "").trim();
  return s === "" ? null : s;
}

export function FormRegistrarEntrenamiento({
  idBloque,
  ejercicios,
}: {
  idBloque: string;
  ejercicios: EjercicioPrograma[];
}) {
  const router = useRouter();
  const inicioRef = useRef<number>(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    inicioRef.current = Date.now();
  }, []);

  const [paso, setPaso] = useState<"registrar" | "resumen">("registrar");
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [filasPorEjercicio, setFilasPorEjercicio] = useState<Record<string, number>>(() => {
    const inicial: Record<string, number> = {};
    for (const ep of ejercicios) inicial[ep.id_ejercicio_programa] = Math.max(1, ep.series);
    return inicial;
  });

  function agregarFila(id: string) {
    setFilasPorEjercicio((prev) => ({ ...prev, [id]: Math.min(15, (prev[id] ?? 1) + 1) }));
  }

  function quitarFila(id: string) {
    setFilasPorEjercicio((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] ?? 1) - 1) }));
  }
  const [videoAbierto, setVideoAbierto] = useState<EjercicioDetalle | null>(null);
  const [resumen, setResumen] = useState<{ volumen: number; duracion: number; calorias: number } | null>(
    null
  );
  const [sensacion, setSensacion] = useState<number | null>(null);
  const [comentarioGeneral, setComentarioGeneral] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [avisoOffline, setAvisoOffline] = useState(false);

  function alternarCompletado(id: string) {
    setCompletados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function irAResumen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);

    let volumen = 0;
    for (const ep of ejercicios) {
      const filas = filasPorEjercicio[ep.id_ejercicio_programa] ?? ep.series;
      for (let n = 1; n <= filas; n++) {
        const peso = Number(formData.get(`peso_${ep.id_ejercicio_programa}_${n}`)) || 0;
        const reps = Number(formData.get(`reps_${ep.id_ejercicio_programa}_${n}`)) || 0;
        volumen += peso * reps;
      }
    }
    const duracion = Math.max(1, Math.round((Date.now() - inicioRef.current) / 60000));
    // Estimación gruesa (~6 kcal/min de trabajo con pesas) — se muestra
    // siempre como "estimadas", nunca como un dato médico exacto.
    const calorias = Math.round(duracion * 6);

    setResumen({ volumen, duracion, calorias });
    setPaso("resumen");
  }

  async function confirmarYVolver() {
    if (!formRef.current || !resumen) return;
    setEnviando(true);
    setError(null);

    const formData = new FormData(formRef.current);
    const sesion = {
      id_bloque: idBloque,
      comentario_general: textoOpcional(comentarioGeneral),
      duracion_minutos: resumen.duracion,
      calorias_estimadas: resumen.calorias,
      sensacion_general: sensacion,
      series: ejercicios.flatMap((ep) => {
        const filas = filasPorEjercicio[ep.id_ejercicio_programa] ?? ep.series;
        const rpe = numeroOpcional(formData.get(`rpe_${ep.id_ejercicio_programa}`));
        const descanso_real = numeroOpcional(formData.get(`descanso_${ep.id_ejercicio_programa}`));
        const tiempo_bajo_tension = numeroOpcional(formData.get(`tut_${ep.id_ejercicio_programa}`));
        const comentarios = textoOpcional(formData.get(`comentario_${ep.id_ejercicio_programa}`));
        return Array.from({ length: filas }, (_, i) => {
          const n = i + 1;
          return {
            id_ejercicio_programa: ep.id_ejercicio_programa,
            numero_serie: n,
            peso_utilizado: numeroOpcional(formData.get(`peso_${ep.id_ejercicio_programa}_${n}`)),
            repeticiones_realizadas: numeroOpcional(
              formData.get(`reps_${ep.id_ejercicio_programa}_${n}`)
            ),
            series_completadas: null,
            rpe,
            descanso_real,
            tiempo_bajo_tension,
            comentarios,
          };
        });
      }),
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      encolarSesion(sesion);
      setAvisoOffline(true);
      setEnviando(false);
      setTimeout(() => router.push("/panel"), 1200);
      return;
    }

    try {
      const res = await fetch("/api/entrenamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sesion),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar. Probá de nuevo.");
        setEnviando(false);
        return;
      }
      sincronizarPendientes();
      router.push("/panel");
    } catch {
      encolarSesion(sesion);
      setAvisoOffline(true);
      setEnviando(false);
      setTimeout(() => router.push("/panel"), 1200);
    }
  }

  if (paso === "resumen" && resumen) {
    return (
      <div className="flex flex-col gap-5">
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 flex flex-col gap-4">
          <h2 className="font-[family-name:var(--font-sora)] text-lg font-bold text-on-surface">
            Resumen de la sesión
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#131313] border border-[#262626] rounded-lg p-3">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                Ejercicios
              </p>
              <p className="font-[family-name:var(--font-sora)] text-xl font-bold text-on-surface tabular-nums">
                {completados.size}/{ejercicios.length}
              </p>
            </div>
            <div className="bg-[#131313] border border-[#262626] rounded-lg p-3">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                Volumen total
              </p>
              <p className="font-[family-name:var(--font-sora)] text-xl font-bold text-on-surface tabular-nums">
                {resumen.volumen.toLocaleString("es-AR")} kg
              </p>
            </div>
            <div className="bg-[#131313] border border-[#262626] rounded-lg p-3">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                Duración
              </p>
              <p className="font-[family-name:var(--font-sora)] text-xl font-bold text-on-surface tabular-nums">
                {resumen.duracion} min
              </p>
            </div>
            <div className="bg-[#131313] border border-[#262626] rounded-lg p-3">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase">
                Calorías (estimadas)
              </p>
              <p className="font-[family-name:var(--font-sora)] text-xl font-bold text-on-surface tabular-nums">
                {resumen.calorias} kcal
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase">
            ¿Cómo te sentiste?
          </label>
          <div className="flex justify-between gap-1">
            {SENSACIONES.map((s) => (
              <button
                key={s.valor}
                type="button"
                onClick={() => setSensacion(s.valor)}
                aria-label={s.etiqueta}
                aria-pressed={sensacion === s.valor}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${
                  sensacion === s.valor
                    ? "border-primary-container bg-primary-container/10"
                    : "border-[#262626] hover:border-outline-variant"
                }`}
              >
                <span className="text-2xl leading-none">{s.emoji}</span>
              </button>
            ))}
          </div>
          <textarea
            value={comentarioGeneral}
            onChange={(e) => setComentarioGeneral(e.target.value)}
            rows={2}
            placeholder="Contale algo más a tu coach (opcional)"
            className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-base p-3 transition-colors"
          />
        </div>

        {error && (
          <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">{error}</p>
        )}
        {avisoOffline && (
          <p className="font-[family-name:var(--font-inter)] text-sm text-primary-container">
            Sin conexión: guardamos tu sesión en el teléfono y se sincroniza sola cuando
            vuelva la señal.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={confirmarYVolver}
            disabled={enviando}
            className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {enviando ? "Guardando..." : "Volver al inicio"}
          </button>
          <button
            type="button"
            onClick={() => setPaso("registrar")}
            disabled={enviando}
            className="w-full text-on-surface-variant text-sm py-2"
          >
            Volver a editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <form ref={formRef} onSubmit={irAResumen} className="flex flex-col gap-4">
        {ejercicios.map((ep) => {
          const completo = completados.has(ep.id_ejercicio_programa);
          return (
            <div
              key={ep.id_ejercicio_programa}
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setVideoAbierto(ep.ejercicio)}
                    className="font-[family-name:var(--font-sora)] text-base font-semibold text-primary-container underline underline-offset-2 decoration-primary-container/40 text-left"
                  >
                    {ep.ejercicio.nombre}
                  </button>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Prescrito: {ep.series}×{ep.repeticiones}
                    {ep.peso_sugerido ? ` · ${ep.peso_sugerido}kg sugerido` : ""}
                    {ep.tempo ? ` · tempo ${ep.tempo}` : ""}
                    {ep.descanso ? ` · descanso ${ep.descanso}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alternarCompletado(ep.id_ejercicio_programa)}
                  aria-label={completo ? "Marcar como no completado" : "Marcar como completado"}
                  aria-pressed={completo}
                  className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                    completo
                      ? "bg-primary-container border-primary-container text-black"
                      : "border-outline-variant text-transparent"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {Array.from({ length: filasPorEjercicio[ep.id_ejercicio_programa] ?? ep.series }).map(
                  (_, i) => {
                    const n = i + 1;
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-on-surface-variant">
                          Serie {n}
                        </span>
                        <input
                          name={`peso_${ep.id_ejercicio_programa}_${n}`}
                          type="number"
                          step="0.01"
                          placeholder="Peso (kg)"
                          className="min-w-0 flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
                        />
                        <input
                          name={`reps_${ep.id_ejercicio_programa}_${n}`}
                          type="number"
                          placeholder="Reps"
                          className="min-w-0 flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
                        />
                      </div>
                    );
                  }
                )}
                <div className="flex gap-3 mt-0.5">
                  <button
                    type="button"
                    onClick={() => agregarFila(ep.id_ejercicio_programa)}
                    className="text-xs text-primary-container"
                  >
                    + Serie
                  </button>
                  {(filasPorEjercicio[ep.id_ejercicio_programa] ?? ep.series) > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarFila(ep.id_ejercicio_programa)}
                      className="text-xs text-on-surface-variant"
                    >
                      − Serie
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  name={`rpe_${ep.id_ejercicio_programa}`}
                  type="number"
                  step="0.5"
                  min={1}
                  max={10}
                  placeholder="RPE (1-10)"
                  className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
                />
                <input
                  name={`descanso_${ep.id_ejercicio_programa}`}
                  type="number"
                  placeholder="Descanso (seg)"
                  className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
                />
                <input
                  name={`tut_${ep.id_ejercicio_programa}`}
                  type="number"
                  placeholder="TUT (seg)"
                  className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
                />
              </div>
              <input
                name={`comentario_${ep.id_ejercicio_programa}`}
                type="text"
                placeholder="Comentario (opcional)"
                className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
              />
            </div>
          );
        })}

        <button
          type="submit"
          className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Finalizar entrenamiento
        </button>
      </form>

      {videoAbierto && (
        <ModalVideoEjercicio ejercicio={videoAbierto} onClose={() => setVideoAbierto(null)} />
      )}
    </>
  );
}
