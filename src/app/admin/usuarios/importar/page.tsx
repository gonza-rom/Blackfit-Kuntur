"use client";

import { useRef, useState } from "react";
import {
  iniciarImportBeneficiarios,
  importarFilaBeneficiario,
  finalizarImportBeneficiarios,
} from "@/app/actions/admin";
import {
  parsearCsvBeneficiarios,
  type FilaOmitida,
} from "@/lib/importarBeneficiarios";

type FilaError = { linea: number; motivo: string };

type EstadoImport = {
  total: number;
  procesadas: number;
  creados: number;
  actualizados: number;
  omitidas: FilaOmitida[];
  errores: FilaError[];
  filaActual: string | null;
  terminado: boolean;
};

export default function ImportarBeneficiariosPage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [estado, setEstado] = useState<EstadoImport | null>(null);

  async function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    // El CSV que manda Kuntur suele venir en Windows-1252 (exportado desde
    // Excel en Windows) — decodificarlo como UTF-8 rompe tildes y ñ.
    const buffer = await archivo.arrayBuffer();
    const texto = new TextDecoder("windows-1252").decode(buffer);
    if (textareaRef.current) textareaRef.current.value = texto;
    setNombreArchivo(archivo.name);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (corriendo) return;

    setErrorGeneral(null);
    const texto = textareaRef.current?.value ?? "";
    if (!texto.trim()) {
      setErrorGeneral("Pegá o subí el archivo CSV.");
      return;
    }

    const { filas, omitidas } = parsearCsvBeneficiarios(texto);
    if (filas.length === 0) {
      setErrorGeneral("No se encontró ninguna fila válida para importar.");
      return;
    }

    setCorriendo(true);
    setEstado({
      total: filas.length,
      procesadas: 0,
      creados: 0,
      actualizados: 0,
      omitidas,
      errores: [],
      filaActual: null,
      terminado: false,
    });

    const preparacion = await iniciarImportBeneficiarios();
    if ("error" in preparacion) {
      setErrorGeneral(preparacion.error);
      setCorriendo(false);
      setEstado(null);
      return;
    }

    let creados = 0;
    let actualizados = 0;
    const errores: FilaError[] = [];

    for (const fila of filas) {
      const nombreCompleto = `${fila.nombre} ${fila.apellido}`.trim();
      setEstado((prev) => (prev ? { ...prev, filaActual: nombreCompleto } : prev));

      const resultado = await importarFilaBeneficiario(fila, preparacion.id_plan_membresia);
      if (resultado.tipo === "creado") creados++;
      else if (resultado.tipo === "actualizado") actualizados++;
      else errores.push({ linea: fila.linea, motivo: resultado.motivo });

      setEstado((prev) =>
        prev
          ? {
              ...prev,
              procesadas: prev.procesadas + 1,
              creados,
              actualizados,
              errores: [...errores],
            }
          : prev
      );
    }

    await finalizarImportBeneficiarios({
      creados,
      actualizados,
      omitidos: omitidas.length,
      errores: errores.length,
    });

    setEstado((prev) => (prev ? { ...prev, filaActual: null, terminado: true } : prev));
    setCorriendo(false);
  }

  const porcentaje = estado && estado.total > 0 ? Math.round((estado.procesadas / estado.total) * 100) : 0;

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-on-surface">
          Importar beneficiarios
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Subí o pegá el CSV de socios de Kuntur (columnas SOCIO;DNI;MEMBRESIA). Cada fila
          crea una cuenta con rol beneficiario — el login es por DNI y la contraseña inicial
          es el propio DNI. Si el DNI ya existe, se actualiza la membresía en vez de duplicar
          la cuenta.
        </p>
      </div>

      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 md:p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="archivo"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              Archivo CSV
            </label>
            <input
              id="archivo"
              type="file"
              accept=".csv,text/csv"
              disabled={corriendo}
              onChange={onArchivoSeleccionado}
              className="w-full text-sm text-on-surface-variant file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-primary-container file:text-black file:font-[family-name:var(--font-sora)] file:font-bold file:text-sm disabled:opacity-60"
            />
            {nombreArchivo && (
              <p className="text-xs text-on-surface-variant">Cargado: {nombreArchivo}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="csv"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
            >
              O pegá el contenido acá
            </label>
            <textarea
              ref={textareaRef}
              id="csv"
              name="csv"
              rows={10}
              disabled={corriendo}
              placeholder={"SOCIO;DNI;MEMBRESIA\nveronica mercado;23024823;vence en 27 dias"}
              className="w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-jetbrains-mono)] text-xs p-3 transition-colors disabled:opacity-60"
            />
          </div>

          {errorGeneral && (
            <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
              {errorGeneral}
            </p>
          )}

          <button
            type="submit"
            disabled={corriendo}
            className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded mt-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {corriendo ? "Importando..." : "Importar"}
          </button>
        </form>
      </div>

      {estado && (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">
              {estado.terminado ? "Importación terminada" : "Importando..."}
            </p>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-on-surface-variant">
              {estado.procesadas}/{estado.total}
            </span>
          </div>

          <div className="w-full h-2 bg-[#262626] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container transition-all duration-150"
              style={{ width: `${porcentaje}%` }}
            />
          </div>

          {!estado.terminado && estado.filaActual && (
            <p className="text-xs text-on-surface-variant">Procesando: {estado.filaActual}...</p>
          )}

          <p className="text-sm text-on-surface-variant">
            {estado.creados} cuenta(s) nueva(s), {estado.actualizados} membresía(s) actualizada(s)
            {estado.omitidas.length > 0 && `, ${estado.omitidas.length} fila(s) omitida(s)`}
            {estado.errores.length > 0 && `, ${estado.errores.length} error(es)`}.
          </p>
        </div>
      )}

      {estado && estado.omitidas.length > 0 && (
        <details className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <summary className="font-[family-name:var(--font-sora)] text-sm font-semibold text-on-surface cursor-pointer">
            Filas omitidas ({estado.omitidas.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {estado.omitidas.map((f) => (
              <li key={f.linea} className="text-xs text-on-surface-variant">
                Línea {f.linea}: {f.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}

      {estado && estado.errores.length > 0 && (
        <details open className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4">
          <summary className="font-[family-name:var(--font-sora)] text-sm font-semibold text-[#ffb4ab] cursor-pointer">
            Errores ({estado.errores.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {estado.errores.map((f, i) => (
              <li key={`${f.linea}-${i}`} className="text-xs text-[#ffb4ab]">
                Línea {f.linea}: {f.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
