"use client";

import { useState } from "react";

type EstadoAccion = { error?: string } | undefined;
type SetAbierto = (valor: boolean | ((abierto: boolean) => boolean)) => void;

// Reemplazo de `useState(false)` para los editores en línea ("lápiz" que
// abre un form con useActionState dentro de una tarjeta). Antes, después de
// guardar bien, el form quedaba abierto para siempre con los datos viejos
// como defaultValue; ahora se cierra solo cuando la acción devuelve un
// estado nuevo sin error. Si la acción falla, queda abierto mostrando el
// error. Mismo contrato que useState: [abierto, setAbierto(v | fn)].
export function useEditorEnLinea(state: EstadoAccion, pending: boolean): [boolean, SetAbierto] {
  const [abiertoCon, setAbiertoCon] = useState<{ estado: EstadoAccion } | null>(null);
  const abierto =
    abiertoCon !== null && (pending || state === abiertoCon.estado || Boolean(state?.error));

  const setAbierto: SetAbierto = (valor) => {
    const nuevo = typeof valor === "function" ? valor(abierto) : valor;
    setAbiertoCon(nuevo ? { estado: state } : null);
  };

  return [abierto, setAbierto];
}
