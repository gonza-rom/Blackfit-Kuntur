"use client";

import dynamic from "next/dynamic";

// El formulario arranca desde la sesión en curso guardada en el teléfono
// (lib/sesion-en-curso.ts), que solo existe en el navegador: se renderiza
// sin SSR para no generar un HTML de servidor "vacío" que después no
// coincida con lo restaurado.
export const FormRegistrarEntrenamientoCliente = dynamic(
  () => import("./form-registrar-entrenamiento").then((m) => m.FormRegistrarEntrenamiento),
  {
    ssr: false,
    loading: () => (
      <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
        Cargando tu sesión...
      </div>
    ),
  }
);
