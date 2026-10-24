"use client";

import { useActionState, useEffect, useState } from "react";
import { activarMembresiaBlackfit, type EstadoMembresiaCoach } from "@/app/actions/coach";

const DIA_MS = 24 * 60 * 60 * 1000;
const MIN = 1;
const MAX = 30;
const SUGERIDOS = 30;
const ATAJOS = [1, 7, 10, 15, 20, 25, 30];

const FORMATO = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

// "Activar membresía" / "Renovar membresía" del panel del coach. Abre un
// formulario con la duración (cualquier entero de 1 a 30, sugerido 30) y
// muestra inicio y vencimiento antes de confirmar. Nada se activa hasta
// "Confirmar activación"; el servidor vuelve a calcular todo con su hora.
export function ActivarMembresia({
  idAlumno,
  nombreAlumno,
  vencimientoVigente,
  etiqueta,
  compacto = false,
}: {
  idAlumno: string;
  nombreAlumno: string;
  // Vencimiento de la membresía vigente (ms), o null si no tiene una vigente.
  vencimientoVigente: number | null;
  etiqueta: string;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [dias, setDias] = useState(String(SUGERIDOS));
  const [ahora, setAhora] = useState(0);
  const [clave, setClave] = useState("");
  // Cierra el formulario cuando la operación terminó bien.
  const [state, action, pending] = useActionState(
    async (prev: EstadoMembresiaCoach, formData: FormData) => {
      const resultado = await activarMembresiaBlackfit(prev, formData);
      if (resultado?.ok) setAbierto(false);
      return resultado;
    },
    undefined
  );

  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setAbierto(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, pending]);

  function abrir() {
    setDias(String(SUGERIDOS));
    setAhora(Date.now());
    // Una clave por apertura: si el mismo pedido llega dos veces, el
    // servidor no suma los días de nuevo.
    setClave(crypto.randomUUID());
    setAbierto(true);
  }

  const n = Number(dias);
  const valido = Number.isInteger(n) && n >= MIN && n <= MAX;
  const renovacion = vencimientoVigente !== null && vencimientoVigente > ahora;
  const inicio = renovacion ? vencimientoVigente : ahora;
  const vencimiento = valido ? inicio + n * DIA_MS : null;

  const boton = compacto
    ? "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.06em] uppercase px-2.5 py-1 rounded-full bg-primary-container text-black font-bold hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
    : "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-4 py-2 rounded-full bg-primary-container text-black font-bold hover:opacity-90 active:scale-95 transition-all";

  return (
    <>
      <button type="button" onClick={abrir} className={boton}>
        {etiqueta}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`titulo-membresia-${idAlumno}`}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setAbierto(false);
          }}
        >
          <form
            action={action}
            className="w-full max-w-sm bg-[#1A1A1A] border border-[#262626] rounded-xl p-5 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto"
          >
            <input type="hidden" name="id_alumno" value={idAlumno} />
            <input type="hidden" name="clave_operacion" value={clave} />

            <div className="flex flex-col gap-1">
              <h2
                id={`titulo-membresia-${idAlumno}`}
                className="font-[family-name:var(--font-sora)] text-lg font-bold text-on-surface"
              >
                {renovacion ? "Renovar membresía" : "Activar membresía"}
              </h2>
              <p className="text-sm text-on-surface-variant">{nombreAlumno}</p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor={`dias-${idAlumno}`}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase"
              >
                Duración (1 a 30 días)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDias(String(Math.max(MIN, (valido ? n : SUGERIDOS) - 1)))}
                  aria-label="Un día menos"
                  className="w-10 h-10 shrink-0 rounded-full border border-outline-variant text-on-surface flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <input
                  id={`dias-${idAlumno}`}
                  name="dias"
                  type="number"
                  inputMode="numeric"
                  min={MIN}
                  max={MAX}
                  step={1}
                  required
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  className="min-w-0 flex-1 text-center bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-lg font-bold tabular-nums p-2"
                />
                <button
                  type="button"
                  onClick={() => setDias(String(Math.min(MAX, (valido ? n : SUGERIDOS) + 1)))}
                  aria-label="Un día más"
                  className="w-10 h-10 shrink-0 rounded-full border border-outline-variant text-on-surface flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ATAJOS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setDias(String(a))}
                    aria-pressed={n === a}
                    className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] px-2.5 py-1 rounded-full border tabular-nums ${
                      n === a
                        ? "border-primary-container text-primary-container bg-primary-container/10"
                        : "border-[#262626] text-on-surface-variant"
                    }`}
                  >
                    {a} d
                  </button>
                ))}
              </div>
              {!valido && <p className="text-xs text-[#ffb4ab]">Elegí un número entero entre 1 y 30.</p>}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm bg-[#131313] border border-[#262626] rounded-lg p-3">
              <dt className="text-on-surface-variant">Duración</dt>
              <dd className="text-on-surface tabular-nums text-right">
                {valido ? `${n} día${n === 1 ? "" : "s"}` : "—"}
              </dd>
              <dt className="text-on-surface-variant">Inicio</dt>
              <dd className="text-on-surface tabular-nums text-right">{ahora ? FORMATO.format(inicio) : "—"}</dd>
              <dt className="text-on-surface-variant">Vence</dt>
              <dd className="text-primary-container font-semibold tabular-nums text-right">
                {vencimiento ? FORMATO.format(vencimiento) : "—"}
              </dd>
            </dl>
            <p className="text-[11px] text-on-surface-variant -mt-2">
              {renovacion
                ? "Tiene una membresía vigente: los días nuevos se suman a su vencimiento actual, no se pierde ninguno."
                : "Empieza a contar al confirmar. La hora exacta la toma el servidor."}
            </p>

            {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                disabled={pending}
                className="flex-1 border border-outline-variant text-on-surface font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !valido}
                className="flex-1 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Confirmar activación"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
