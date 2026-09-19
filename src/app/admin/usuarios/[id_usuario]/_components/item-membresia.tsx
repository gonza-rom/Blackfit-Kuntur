"use client";

import { useActionState, useState } from "react";
import {
  cambiarEstadoMembresia,
  editarMembresia,
  eliminarMembresia,
} from "@/app/actions/admin";
import { ConfirmForm } from "@/components/confirm-form";

const ESTADOS_MEMBRESIA = ["activa", "vencida", "cancelada", "suspendida", "pendiente"] as const;

type Plan = { id_plan_membresia: string; nombre: string; duracion_dias: number };

type Membresia = {
  id_membresia: string;
  id_plan_membresia: string;
  estado_membresia: string;
  fecha_inicio_membresia: Date;
  fecha_vencimiento_membresia: Date;
  plan_membresia: { nombre: string };
};

const FORMATEADOR_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function aFechaInput(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function ItemMembresia({ membresia, planes }: { membresia: Membresia; planes: Plan[] }) {
  const [editando, setEditando] = useState(false);
  const [estadoEdit, accionEdit, pendingEdit] = useActionState(editarMembresia, undefined);
  const [estadoDelete, accionDelete, pendingDelete] = useActionState(eliminarMembresia, undefined);

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-on-surface">{membresia.plan_membresia.nombre}</span>
        <span className="text-on-surface-variant">
          hasta {FORMATEADOR_FECHA.format(membresia.fecha_vencimiento_membresia)}
        </span>
      </div>

      <form action={cambiarEstadoMembresia} className="flex items-center gap-2">
        <input type="hidden" name="id_membresia" value={membresia.id_membresia} />
        <select
          name="estado_membresia"
          defaultValue={membresia.estado_membresia}
          className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
        >
          {ESTADOS_MEMBRESIA.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant"
        >
          Actualizar
        </button>
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant ml-auto"
        >
          {editando ? "Cerrar" : "Editar"}
        </button>
      </form>

      {editando && (
        <form action={accionEdit} className="flex flex-col gap-2 border-t border-[#262626] pt-2">
          <input type="hidden" name="id_membresia" value={membresia.id_membresia} />
          <select
            name="id_plan_membresia"
            defaultValue={membresia.id_plan_membresia}
            className="bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
          >
            {planes.map((plan) => (
              <option key={plan.id_plan_membresia} value={plan.id_plan_membresia}>
                {plan.nombre}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              name="fecha_inicio"
              type="date"
              defaultValue={aFechaInput(membresia.fecha_inicio_membresia)}
              className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
            />
            <input
              name="fecha_vencimiento"
              type="date"
              defaultValue={aFechaInput(membresia.fecha_vencimiento_membresia)}
              className="flex-1 bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-xs p-2"
            />
          </div>
          {estadoEdit?.error && (
            <p className="text-xs text-[#ffb4ab]">{estadoEdit.error}</p>
          )}
          <button
            type="submit"
            disabled={pendingEdit}
            className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full bg-primary-container text-black disabled:opacity-60 self-start"
          >
            {pendingEdit ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      {editando && (
        <ConfirmForm action={accionDelete} mensaje="¿Eliminar esta membresía? No se puede deshacer.">
          <input type="hidden" name="id_membresia" value={membresia.id_membresia} />
          <button
            type="submit"
            disabled={pendingDelete}
            className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full border border-[#ffb4ab] text-[#ffb4ab] disabled:opacity-40"
          >
            {pendingDelete ? "Eliminando..." : "Eliminar membresía"}
          </button>
          {estadoDelete?.error && (
            <p className="text-xs text-[#ffb4ab] mt-1">{estadoDelete.error}</p>
          )}
        </ConfirmForm>
      )}
    </div>
  );
}
