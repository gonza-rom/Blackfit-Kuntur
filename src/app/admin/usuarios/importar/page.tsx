"use client";

import { useRef, useState } from "react";
import {
  iniciarImportBeneficiarios,
  importarFilaBeneficiario,
  finalizarImportBeneficiarios,
  previsualizarImportBeneficiarios,
} from "@/app/actions/admin";
import {
  parsearCsvBeneficiarios,
  type FilaBeneficiarioParseada,
  type FilaOmitida,
} from "@/lib/importarBeneficiarios";

type VistaPrevia = {
  filas: FilaBeneficiarioParseada[];
  omitidas: FilaOmitida[];
  nuevos: number;
  renovaciones: number;
  sin_cambios: number;
  cuentas_blackfit: number;
};

type FilaError = { linea: number; motivo: string };

type EstadoImport = {
  total: number;
  procesadas: number;
  creados: number;
  actualizados: number;
  sinCambios: number;
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
  const [vistaPrevia, setVistaPrevia] = useState<VistaPrevia | null>(null);

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

  // Paso 1: leer el archivo y mostrar qué va a pasar, sin escribir nada.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (corriendo) return;
    setVistaPrevia(null);
    setEstado(null);

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

    const resumen = await previsualizarImportBeneficiarios(
      filas.map((f) => ({ dni: f.dni, fecha_vencimiento_membresia: f.fecha_vencimiento_membresia }))
    );
    if ("error" in resumen) {
      setErrorGeneral(resumen.error);
      return;
    }
    setVistaPrevia({ filas, omitidas, ...resumen });
  }

  // Paso 2: importar lo revisado (idempotente: reprocesar no duplica).
  async function confirmarImport() {
    if (!vistaPrevia || corriendo) return;
    const { filas, omitidas } = vistaPrevia;
    setVistaPrevia(null);
    setCorriendo(true);
    setEstado({
      total: filas.length,
      procesadas: 0,
      creados: 0,
      actualizados: 0,
      sinCambios: 0,
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
    let sinCambios = 0;
    const errores: FilaError[] = [];

    for (const fila of filas) {
      const nombreCompleto = `${fila.nombre} ${fila.apellido}`.trim();
      setEstado((prev) => (prev ? { ...prev, filaActual: nombreCompleto } : prev));

      const resultado = await importarFilaBeneficiario(fila, preparacion.id_plan_membresia);
      if (resultado.tipo === "creado") creados++;
      else if (resultado.tipo === "actualizado") actualizados++;
      else if (resultado.tipo === "sin_cambios") sinCambios++;
      else errores.push({ linea: fila.linea, motivo: resultado.motivo });

      setEstado((prev) =>
        prev
          ? {
              ...prev,
              procesadas: prev.procesadas + 1,
              creados,
              actualizados,
              sinCambios,
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
          crea el socio (sin contraseña: cada uno activa su acceso con un código desde la
          ficha del socio). Si el DNI ya existe no se duplica, y volver a procesar el mismo
          archivo no cambia nada. Antes de importar vas a ver un resumen para confirmar.
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
            {corriendo ? "Importando..." : "Revisar archivo"}
          </button>
        </form>
      </div>

      {vistaPrevia && (
        <div className="bg-[#1A1A1A] border border-primary-container/40 rounded-xl p-4 flex flex-col gap-3">
          <p className="font-[family-name:var(--font-sora)] text-base font-semibold text-on-surface">Resumen antes de importar</p>
          <ul className="text-sm text-on-surface flex flex-col gap-1">
            <li>{vistaPrevia.nuevos} socio(s) nuevo(s)</li>
            <li>{vistaPrevia.renovaciones} renovación(es) de membresía</li>
            <li>{vistaPrevia.sin_cambios} sin cambios (ya estaban al día)</li>
            {vistaPrevia.cuentas_blackfit > 0 && (
              <li className="text-on-surface-variant">
                {vistaPrevia.cuentas_blackfit} ya tienen cuenta de Blackfit: se vinculan como socios sin tocar Blackfit
              </li>
            )}
            {vistaPrevia.omitidas.length > 0 && <li className="text-[#eda100]">{vistaPrevia.omitidas.length} fila(s) con errores, se omiten</li>}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmarImport}
              className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded"
            >
              Confirmar importación
            </button>
            <button type="button" onClick={() => setVistaPrevia(null)} className="text-sm text-on-surface-variant px-3">
              Cancelar
            </button>
          </div>
        </div>
      )}

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
            {estado.creados} socio(s) nuevo(s), {estado.actualizados} renovación(es), {estado.sinCambios} sin cambios
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
