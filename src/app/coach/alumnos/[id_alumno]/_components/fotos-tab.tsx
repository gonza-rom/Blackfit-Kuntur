"use client";

import { useActionState, useState } from "react";
import { subirFotoProgresoAngulo } from "@/app/actions/coach";

const ANGULOS: { valor: string; etiqueta: string }[] = [
  { valor: "frente", etiqueta: "Frente" },
  { valor: "espalda", etiqueta: "Espalda" },
  { valor: "perfil_izquierdo", etiqueta: "Perfil izquierdo" },
  { valor: "perfil_derecho", etiqueta: "Perfil derecho" },
];

export type FotoSerializada = {
  id_medida: string;
  angulo: string;
  fechaLabel: string;
  url: string | null;
};

export function FotosTab({
  idAlumno,
  fotos,
}: {
  idAlumno: string;
  fotos: FotoSerializada[];
}) {
  const [state, action, pending] = useActionState(subirFotoProgresoAngulo, undefined);
  const [anguloElegido, setAnguloElegido] = useState(ANGULOS[0].valor);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Subir foto
        </h2>
        <form
          action={action}
          className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
        >
          <input type="hidden" name="id_alumno" value={idAlumno} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {ANGULOS.map((a) => (
              <button
                key={a.valor}
                type="button"
                onClick={() => setAnguloElegido(a.valor)}
                className={`text-xs px-2 py-2 rounded-lg border ${
                  anguloElegido === a.valor
                    ? "border-primary-container text-primary-container bg-primary-container/5"
                    : "border-[#262626] text-on-surface-variant"
                }`}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
          <input type="hidden" name="angulo" value={anguloElegido} />
          <input
            name="foto"
            type="file"
            accept="image/*"
            required
            className="text-xs text-on-surface-variant file:mr-2 file:rounded file:border-0 file:bg-[#262626] file:px-3 file:py-1.5 file:text-on-surface file:text-xs"
          />
          {state?.error && <p className="text-[#ffb4ab] text-xs">{state.error}</p>}
          {state?.message && <p className="text-primary-container text-xs">{state.message}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60"
          >
            {pending ? "Subiendo..." : "Subir foto"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Historial
        </h2>
        {fotos.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
            Todavía no hay fotos de progreso cargadas.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {fotos.map((f) => (
              <div
                key={f.id_medida}
                className="bg-[#1A1A1A] border border-[#262626] rounded-xl overflow-hidden flex flex-col"
              >
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.angulo} className="w-full aspect-[3/4] object-cover" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-[#262626] flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined">image_not_supported</span>
                  </div>
                )}
                <div className="p-2">
                  <p className="text-[11px] text-on-surface capitalize truncate">
                    {ANGULOS.find((a) => a.valor === f.angulo)?.etiqueta ?? f.angulo}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">{f.fechaLabel}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
