import { CATEGORIAS_BENEFICIO, ETIQUETA_AUDIENCIA } from "@/lib/beneficios-constantes";

const LABEL =
  "font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface";
const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors";

// Campos del catálogo único que comparten los formularios de beneficio
// (comercio y administración): para quién es, categoría y límite de usos.
export function CamposBeneficio({
  audiencia = "ambos",
  categoria = "",
  limiteUsos = null,
}: {
  audiencia?: string;
  categoria?: string | null;
  limiteUsos?: number | null;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="audiencia" className={LABEL}>
          ¿Para quién es?
        </label>
        <select id="audiencia" name="audiencia" defaultValue={audiencia} className={INPUT}>
          {(Object.keys(ETIQUETA_AUDIENCIA) as (keyof typeof ETIQUETA_AUDIENCIA)[]).map((a) => (
            <option key={a} value={a}>
              {ETIQUETA_AUDIENCIA[a]}
            </option>
          ))}
        </select>
        <p className="text-xs text-on-surface-variant">
          Se publica una sola vez y aparece en la sección Beneficios de cada comunidad elegida.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="categoria" className={LABEL}>
            Categoría
          </label>
          <input
            id="categoria"
            name="categoria"
            list="categorias-beneficio"
            defaultValue={categoria ?? ""}
            placeholder="Gastronomía, ..."
            className={INPUT}
          />
          <datalist id="categorias-beneficio">
            {CATEGORIAS_BENEFICIO.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="limite_usos" className={LABEL}>
            Usos por persona
          </label>
          <input
            id="limite_usos"
            name="limite_usos"
            type="number"
            min={1}
            max={1000}
            defaultValue={limiteUsos ?? ""}
            placeholder="Ilimitado"
            className={INPUT}
          />
        </div>
      </div>
    </>
  );
}
