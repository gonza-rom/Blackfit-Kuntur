"use client";

import { useActionState, useState } from "react";
import { buscarSocio, validarBeneficio } from "@/app/actions/comercio";

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function FormValidar() {
  const [busqueda, buscarAction, buscando] = useActionState(buscarSocio, undefined);
  const [resultado, validarAction, validando] = useActionState(validarBeneficio, undefined);
  const [idBeneficioElegido, setIdBeneficioElegido] = useState<string | null>(null);

  const socioEncontrado = busqueda && !("error" in busqueda) ? busqueda : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Paso 1: buscar socio */}
      <form action={buscarAction} className="flex flex-col gap-3">
        <label
          htmlFor="identificador"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface uppercase"
        >
          Código QR, número de socio o email
        </label>
        <div className="flex gap-2">
          <input
            id="identificador"
            name="identificador"
            type="text"
            required
            autoFocus
            placeholder="Escaneá o ingresá el código"
            className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface font-[family-name:var(--font-inter)] text-base p-3 transition-colors"
          />
          <button
            type="submit"
            disabled={buscando}
            className="bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-5 rounded disabled:opacity-60"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </form>

      {busqueda && "error" in busqueda && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {busqueda.error}
        </p>
      )}

      {/* Paso 2: elegir beneficio y validar */}
      {socioEncontrado && (
        <div className="bg-[#1a1a1a] border border-outline-variant rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-[family-name:var(--font-sora)] text-lg font-semibold text-on-surface">
                {socioEncontrado.nombre} {socioEncontrado.apellido}
              </p>
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant">
                SOCIO #{socioEncontrado.numero_socio}
              </p>
            </div>
            <span
              className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border ${
                socioEncontrado.membresia_activa
                  ? "border-primary-container text-primary-container"
                  : "border-[#ffb4ab] text-[#ffb4ab]"
              }`}
            >
              {socioEncontrado.membresia_activa ? "Activa" : "Sin membresía"}
            </span>
          </div>

          {socioEncontrado.nombre_plan && (
            <p className="text-sm text-on-surface-variant">
              Plan {socioEncontrado.nombre_plan}
              {socioEncontrado.fecha_vencimiento &&
                ` · vence ${FORMATEADOR_FECHA.format(new Date(socioEncontrado.fecha_vencimiento))}`}
            </p>
          )}

          {!socioEncontrado.membresia_activa ? (
            <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
              Este socio no tiene una membresía Kuntur activa: no se le puede validar
              ningún beneficio.
            </p>
          ) : socioEncontrado.beneficios.length === 0 ? (
            <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant">
              Este socio no tiene beneficios vigentes de tu comercio para su plan.
            </p>
          ) : (
            <form action={validarAction} className="flex flex-col gap-3">
              <input type="hidden" name="id_usuario" value={socioEncontrado.id_usuario} />
              <div className="flex flex-col gap-2">
                {socioEncontrado.beneficios.map((beneficio) => (
                  <label
                    key={beneficio.id_beneficio}
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                      idBeneficioElegido === beneficio.id_beneficio
                        ? "border-primary-container bg-primary-container/10"
                        : "border-outline-variant"
                    }`}
                  >
                    <input
                      type="radio"
                      name="id_beneficio"
                      value={beneficio.id_beneficio}
                      onChange={() => setIdBeneficioElegido(beneficio.id_beneficio)}
                      required
                      className="accent-[var(--color-primary-container)]"
                    />
                    <span className="flex-1 text-sm text-on-surface">{beneficio.titulo}</span>
                    {beneficio.descuento && (
                      <span className="font-[family-name:var(--font-sora)] text-sm font-bold text-primary-container">
                        {beneficio.descuento}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={validando || !idBeneficioElegido}
                className="w-full bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {validando ? "Validando..." : "Validar beneficio"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Resultado de la validación */}
      {resultado && "error" in resultado && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">
          {resultado.error}
        </p>
      )}
      {resultado && !("error" in resultado) && (
        <div
          className={`rounded-lg p-5 flex flex-col items-center gap-2 text-center border ${
            resultado.resultado === "aprobado"
              ? "border-primary-container bg-primary-container/10"
              : "border-[#ffb4ab] bg-[#ffb4ab]/10"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[40px] ${
              resultado.resultado === "aprobado" ? "text-primary-container" : "text-[#ffb4ab]"
            }`}
          >
            {resultado.resultado === "aprobado" ? "check_circle" : "cancel"}
          </span>
          <p className="font-[family-name:var(--font-sora)] text-lg font-bold text-on-surface uppercase">
            {resultado.resultado === "aprobado" ? "Socio activo" : "Beneficio no habilitado"}
          </p>
          <p className="text-sm text-on-surface-variant">{resultado.mensaje}</p>
          <p className="text-sm text-on-surface">
            {resultado.nombre_socio} · {resultado.titulo_beneficio}
          </p>
          {resultado.resultado === "aprobado" && resultado.fecha_vencimiento && (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-on-surface-variant uppercase">
              Válido hasta {FORMATEADOR_FECHA.format(new Date(resultado.fecha_vencimiento))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
