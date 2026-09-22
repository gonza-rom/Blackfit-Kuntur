"use client";

import { useActionState, useState } from "react";
import { crearLogro, editarLogro, alternarActivoLogro } from "@/app/actions/coach";
import { IconoLogro } from "@/components/icono-logro";

export type LogroSerializado = {
  id_logro: string;
  titulo: string;
  descripcion: string;
  icono: string | null;
  color: string | null;
  categoria: string | null;
  activo: boolean;
  automatico: boolean;
  otorgados: number;
};

const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 transition-colors";
const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase";

function FormLogro({
  logro,
  onListo,
}: {
  logro?: LogroSerializado;
  onListo?: () => void;
}) {
  const accion = logro ? editarLogro : crearLogro;
  const [state, action, pending] = useActionState(accion, undefined);
  // Un <input type="color"> nunca está "vacío": el navegador siempre manda
  // algún hexadecimal, así que sin esto guardar cualquier cambio (aunque
  // sea solo el nombre) le pisaba el color a un logro que no tenía uno
  // asignado. Con el checkbox tildado el input queda `disabled` — los
  // campos disabled no se mandan en el submit, así que el server ve
  // "color" ausente y lo guarda como null (ver editarLogro/crearLogro).
  const [sinColor, setSinColor] = useState(!logro?.color);

  return (
    <form
      action={async (fd) => {
        await action(fd);
        onListo?.();
      }}
      className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3"
    >
      {logro && <input type="hidden" name="id_logro" value={logro.id_logro} />}
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Emoji</label>
          <input
            name="icono"
            defaultValue={logro?.icono ?? ""}
            placeholder="🔥"
            maxLength={4}
            className={`${INPUT} text-center text-lg`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Nombre</label>
          <input name="titulo" required defaultValue={logro?.titulo ?? ""} className={INPUT} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={LABEL}>Descripción</label>
        <input
          name="descripcion"
          required
          defaultValue={logro?.descripcion ?? ""}
          className={INPUT}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Categoría (opcional)</label>
          <input
            name="categoria"
            defaultValue={logro?.categoria ?? ""}
            placeholder="Constancia, Fuerza..."
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className={LABEL}>Color (opcional)</label>
            <label className="flex items-center gap-1 text-[10px] text-on-surface-variant normal-case">
              <input
                type="checkbox"
                checked={sinColor}
                onChange={(e) => setSinColor(e.target.checked)}
                className="w-3 h-3 accent-primary-container"
              />
              Sin color
            </label>
          </div>
          <input
            name="color"
            type="color"
            disabled={sinColor}
            defaultValue={logro?.color ?? "#61edda"}
            className={`${INPUT} h-[38px] p-1 disabled:opacity-30`}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
      {state?.message && <p className="text-sm text-primary-container">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold h-10 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {pending ? "Guardando..." : logro ? "Guardar cambios" : "Crear logro"}
      </button>
    </form>
  );
}

export function GestorLogros({ logros }: { logros: LogroSerializado[] }) {
  const [abrirNuevo, setAbrirNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setAbrirNuevo((v) => !v)}
        className="flex items-center justify-center gap-2 bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2.5 rounded-full self-start"
      >
        <span className="material-symbols-outlined text-[18px]">
          {abrirNuevo ? "close" : "add"}
        </span>
        {abrirNuevo ? "Cancelar" : "Nuevo logro"}
      </button>

      {abrirNuevo && <FormLogro onListo={() => setAbrirNuevo(false)} />}

      {logros.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Todavía no creaste ningún logro.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {logros.map((logro) =>
            editando === logro.id_logro ? (
              <FormLogro key={logro.id_logro} logro={logro} onListo={() => setEditando(null)} />
            ) : (
              <div
                key={logro.id_logro}
                className={`bg-[#1A1A1A] border rounded-xl p-4 flex items-center gap-3 ${
                  logro.activo ? "border-[#262626]" : "border-[#262626] opacity-50"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 border"
                  style={{
                    borderColor: logro.color ?? "#262626",
                    backgroundColor: logro.color ? `${logro.color}1a` : "#131313",
                  }}
                >
                  <IconoLogro icono={logro.icono} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface">
                    {logro.titulo}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">{logro.descripcion}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {logro.automatico ? "Automático" : "Manual"} · {logro.otorgados} otorgado
                    {logro.otorgados === 1 ? "" : "s"}
                    {logro.categoria ? ` · ${logro.categoria}` : ""}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditando(logro.id_logro)}
                    className="text-on-surface-variant hover:text-primary-container"
                    aria-label="Editar logro"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <form action={alternarActivoLogro}>
                    <input type="hidden" name="id_logro" value={logro.id_logro} />
                    <button
                      type="submit"
                      className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] tracking-[0.06em] uppercase text-on-surface-variant hover:text-on-surface"
                    >
                      {logro.activo ? "Archivar" : "Reactivar"}
                    </button>
                  </form>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
