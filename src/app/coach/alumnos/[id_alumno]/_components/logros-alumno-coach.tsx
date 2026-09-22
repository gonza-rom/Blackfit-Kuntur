"use client";

import { useActionState, useState } from "react";
import { otorgarLogroManual, quitarLogroAlumno } from "@/app/actions/coach";
import { ConfirmForm } from "@/components/confirm-form";

export type LogroCatalogoItem = {
  id_logro: string;
  titulo: string;
  icono: string | null;
  color: string | null;
};

export type LogroObtenidoItem = LogroCatalogoItem & { fechaLabel: string };

export function LogrosAlumnoCoach({
  idAlumno,
  catalogoDisponible,
  obtenidos,
}: {
  idAlumno: string;
  catalogoDisponible: LogroCatalogoItem[];
  obtenidos: LogroObtenidoItem[];
}) {
  const [abiertoPicker, setAbiertoPicker] = useState(false);
  const [state, action, pending] = useActionState(otorgarLogroManual, undefined);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
          Logros
        </h2>
        <button
          type="button"
          onClick={() => setAbiertoPicker((v) => !v)}
          className="flex items-center gap-1.5 bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold px-3 py-1.5 rounded-full"
        >
          <span className="material-symbols-outlined text-[16px]">
            {abiertoPicker ? "close" : "add"}
          </span>
          Otorgar logro
        </button>
      </div>

      {abiertoPicker && (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex flex-col gap-2">
          {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
          {catalogoDisponible.length === 0 ? (
            <p className="text-sm text-on-surface-variant p-1">
              Ya tiene todos los logros de la biblioteca, o todavía no creaste ninguno en{" "}
              <span className="text-primary-container">Perfil → Biblioteca de logros</span>.
            </p>
          ) : (
            catalogoDisponible.map((logro) => (
              <form key={logro.id_logro} action={action} className="flex items-center gap-3">
                <input type="hidden" name="id_alumno" value={idAlumno} />
                <input type="hidden" name="id_logro" value={logro.id_logro} />
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 border"
                  style={{
                    borderColor: logro.color ?? "#262626",
                    backgroundColor: logro.color ? `${logro.color}1a` : "#131313",
                  }}
                >
                  {logro.icono ?? "🏆"}
                </span>
                <span className="flex-1 text-sm text-on-surface truncate">{logro.titulo}</span>
                <button
                  type="submit"
                  disabled={pending}
                  className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] uppercase text-primary-container disabled:opacity-50 shrink-0"
                >
                  Otorgar
                </button>
              </form>
            ))
          )}
        </div>
      )}

      {obtenidos.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no tiene ningún logro.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {obtenidos.map((logro) => (
            <ConfirmForm
              key={logro.id_logro}
              action={quitarLogroAlumno}
              mensaje={`¿Quitarle "${logro.titulo}" a este alumno?`}
              confirmLabel="Quitar"
              className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex flex-col items-center gap-1 text-center"
            >
              <input type="hidden" name="id_alumno" value={idAlumno} />
              <input type="hidden" name="id_logro" value={logro.id_logro} />
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg border"
                style={{
                  borderColor: logro.color ?? "#262626",
                  backgroundColor: logro.color ? `${logro.color}1a` : "#131313",
                }}
              >
                {logro.icono ?? "🏆"}
              </span>
              <p className="text-[11px] text-on-surface leading-tight">{logro.titulo}</p>
              <p className="text-[9px] text-on-surface-variant">{logro.fechaLabel}</p>
              <button
                type="submit"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] tracking-[0.06em] uppercase text-on-surface-variant hover:text-[#ffb4ab]"
              >
                Quitar
              </button>
            </ConfirmForm>
          ))}
        </div>
      )}
    </section>
  );
}
