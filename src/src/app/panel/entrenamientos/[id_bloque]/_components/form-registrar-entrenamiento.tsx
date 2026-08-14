"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { encolarSesion, sincronizarPendientes } from "@/lib/offline-queue";

type EjercicioPrograma = {
  id_ejercicio_programa: string;
  series: number;
  repeticiones: string;
  peso_sugerido: string | null;
  tempo: string | null;
  descanso: string | null;
  metodo_entrenamiento: string | null;
  tiempo_bajo_tension_sugerido: number | null;
  ejercicio: { nombre: string };
};

function numeroOpcional(valor: FormDataEntryValue | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isNaN(n) ? null : n;
}

function textoOpcional(valor: FormDataEntryValue | null): string | null {
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
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [avisoOffline, setAvisoOffline] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const formData = new FormData(e.currentTarget);
    const sesion = {
      id_bloque: idBloque,
      comentario_general: textoOpcional(formData.get("comentario_general")),
      series: ejercicios.map((ep) => ({
        id_ejercicio_programa: ep.id_ejercicio_programa,
        peso_utilizado: numeroOpcional(formData.get(`peso_${ep.id_ejercicio_programa}`)),
        repeticiones_realizadas: numeroOpcional(
          formData.get(`reps_${ep.id_ejercicio_programa}`)
        ),
        series_completadas: numeroOpcional(
          formData.get(`series_${ep.id_ejercicio_programa}`)
        ),
        rpe: numeroOpcional(formData.get(`rpe_${ep.id_ejercicio_programa}`)),
        descanso_real: numeroOpcional(formData.get(`descanso_${ep.id_ejercicio_programa}`)),
        tiempo_bajo_tension: numeroOpcional(formData.get(`tut_${ep.id_ejercicio_programa}`)),
        comentarios: textoOpcional(formData.get(`comentario_${ep.id_ejercicio_programa}`)),
      })),
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      encolarSesion(sesion);
      setAvisoOffline(true);
      setEnviando(false);
      setTimeout(() => router.push("/panel/entrenamientos"), 1200);
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
      router.push("/panel/entrenamientos");
    } catch {
      encolarSesion(sesion);
      setAvisoOffline(true);
      setEnviando(false);
      setTimeout(() => router.push("/panel/entrenamientos"), 1200);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {ejercicios.map((ep) => (
        <div
          key={ep.id_ejercicio_programa}
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
        >
          <div>
            <h3 className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
              {ep.ejercicio.nombre}
            </h3>
            <p className="text-xs text-on-surface-variant">
              Prescrito: {ep.series}×{ep.repeticiones}
              {ep.peso_sugerido ? ` · ${ep.peso_sugerido}kg sugerido` : ""}
              {ep.tempo ? ` · tempo ${ep.tempo}` : ""}
              {ep.descanso ? ` · descanso ${ep.descanso}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <input
              name={`peso_${ep.id_ejercicio_programa}`}
              type="number"
              step="0.01"
              placeholder="Peso usado (kg)"
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
            />
            <input
              name={`reps_${ep.id_ejercicio_programa}`}
              type="number"
              placeholder="Reps realizadas"
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
            />
            <input
              name={`series_${ep.id_ejercicio_programa}`}
              type="number"
              defaultValue={ep.series}
              placeholder="Series completadas"
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
            />
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
              placeholder="Descanso real (seg)"
              className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5"
            />
            <input
              name={`tut_${ep.id_ejercicio_programa}`}
              type="number"
              placeholder="TUT real (seg)"
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
      ))}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="comentario_general"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          ¿Cómo te sentiste hoy?
        </label>
        <textarea
          id="comentario_general"
          name="comentario_general"
          rows={2}
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

      <button
        type="submit"
        disabled={enviando}
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Finalizar sesión"}
      </button>
    </form>
  );
}
