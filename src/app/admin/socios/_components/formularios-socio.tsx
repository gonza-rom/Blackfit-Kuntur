"use client";

import { useActionState } from "react";
import {
  crearSocio,
  editarSocio,
  generarCodigoSocio,
  pasarCuentaAKuntur,
  unirConSocioImportado,
} from "@/app/actions/kuntur";

const LABEL = "font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase";
const INPUT =
  "w-full bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5";
const BOTON =
  "self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-sm font-bold px-4 py-2 rounded disabled:opacity-60";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

export type DatosSocioForm = {
  id_usuario?: string;
  nombre?: string;
  apellido?: string;
  dni?: string | null;
  email?: string;
  telefono?: string | null;
  fecha_nacimiento?: string;
  fecha_alta?: string;
  observaciones?: string | null;
};

type Plan = { id_plan_membresia: string; nombre: string; duracion_dias: number };

/** Alta manual (con plan y membresía) o edición de datos del socio. */
export function FormSocio({ datos, planes }: { datos?: DatosSocioForm; planes?: Plan[] }) {
  const editando = Boolean(datos?.id_usuario);
  const [state, action, pending] = useActionState(editando ? editarSocio : crearSocio, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      {editando && <input type="hidden" name="id_usuario" value={datos!.id_usuario} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Nombre *">
          <input name="nombre" required defaultValue={datos?.nombre} className={INPUT} />
        </Campo>
        <Campo label="Apellido">
          <input name="apellido" defaultValue={datos?.apellido} className={INPUT} />
        </Campo>
        <Campo label={editando ? "DNI" : "DNI (o email) *"}>
          <input name="dni" inputMode="numeric" defaultValue={datos?.dni ?? ""} placeholder="Sin puntos" className={INPUT} />
        </Campo>
        {!editando && (
          <Campo label="Email">
            <input name="email" type="email" placeholder="Opcional" className={INPUT} />
          </Campo>
        )}
        <Campo label="Teléfono">
          <input name="telefono" defaultValue={datos?.telefono ?? ""} className={INPUT} />
        </Campo>
        <Campo label="Fecha de nacimiento">
          <input name="fecha_nacimiento" type="date" defaultValue={datos?.fecha_nacimiento} className={INPUT} />
        </Campo>
        <Campo label="Alta en el gimnasio">
          <input name="fecha_alta" type="date" defaultValue={datos?.fecha_alta ?? new Date().toISOString().slice(0, 10)} className={INPUT} />
        </Campo>
      </div>

      {!editando && planes && (
        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#262626] pt-3">
          <Campo label="Tipo de membresía">
            <select name="id_plan_membresia" defaultValue={planes[0]?.id_plan_membresia ?? ""} className={INPUT}>
              <option value="">Sin membresía por ahora</option>
              {planes.map((p) => (
                <option key={p.id_plan_membresia} value={p.id_plan_membresia}>
                  {p.nombre} ({p.duracion_dias} días)
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Vence (opcional)">
            <input name="fecha_vencimiento" type="date" className={INPUT} />
          </Campo>
          <Campo label="Estado">
            <select name="estado_membresia" defaultValue="activa" className={INPUT}>
              <option value="activa">Activa</option>
              <option value="pendiente">Pendiente de pago</option>
              <option value="suspendida">Suspendida</option>
            </select>
          </Campo>
        </fieldset>
      )}

      <Campo label="Observaciones (solo administración)">
        <textarea name="observaciones" rows={2} defaultValue={datos?.observaciones ?? ""} className={INPUT} />
      </Campo>

      {state?.error && <p className="text-sm text-[#ffb4ab]">{state.error}</p>}
      {state?.message && <p className="text-sm text-primary-container">{state.message}</p>}
      <button type="submit" disabled={pending} className={BOTON}>
        {pending ? "Guardando..." : editando ? "Guardar cambios" : "Agregar socio"}
      </button>
    </form>
  );
}

/** Genera el código de activación (se ve una sola vez). */
export function CodigoActivacion({ idUsuario, activada }: { idUsuario: string; activada: boolean }) {
  const [state, action, pending] = useActionState(generarCodigoSocio, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id_usuario" value={idUsuario} />
      <p className="text-xs text-on-surface-variant">
        {activada
          ? "La cuenta ya está activada. Si el socio perdió su contraseña, generá un código nuevo para que elija otra."
          : "El socio todavía no activó su cuenta. Dale este código: lo usa en \"Ya soy socio: activar mi cuenta\" con su DNI."}
      </p>
      {state?.codigo && (
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-2xl tracking-[0.25em] text-primary-container select-all">
          {state.codigo}
        </p>
      )}
      {state?.message && <p className="text-xs text-on-surface-variant">{state.message}</p>}
      {state?.error && <p className="text-xs text-[#ffb4ab]">{state.error}</p>}
      <button type="submit" disabled={pending} className={BOTON}>
        {pending ? "Generando..." : "Generar código de activación"}
      </button>
    </form>
  );
}

/** Herramientas para corregir una cuenta que quedó en Blackfit por error. */
export function CorreccionCuenta({ idUsuario }: { idUsuario: string }) {
  const [estadoPasar, pasar, pasando] = useActionState(pasarCuentaAKuntur, undefined);
  const [estadoUnir, unir, uniendo] = useActionState(unirConSocioImportado, undefined);
  return (
    <div className="flex flex-col gap-4">
      <form action={pasar} className="flex flex-col gap-2">
        <input type="hidden" name="id_usuario" value={idUsuario} />
        <p className="text-sm text-on-surface">Pasar esta cuenta a Kuntur</p>
        <p className="text-xs text-on-surface-variant">
          Para quien se registró buscando Kuntur y quedó como alumno de Blackfit sin coach ni entrenamientos.
          Conserva su cuenta y su contraseña.
        </p>
        <input name="dni" inputMode="numeric" placeholder="DNI (opcional)" className={INPUT} />
        {estadoPasar?.error && <p className="text-xs text-[#ffb4ab]">{estadoPasar.error}</p>}
        <button type="submit" disabled={pasando} className={BOTON}>
          {pasando ? "Corrigiendo..." : "Pasar a Kuntur"}
        </button>
      </form>
      <form action={unir} className="flex flex-col gap-2 border-t border-[#262626] pt-3">
        <input type="hidden" name="id_usuario" value={idUsuario} />
        <p className="text-sm text-on-surface">Unir con un socio importado del Excel</p>
        <p className="text-xs text-on-surface-variant">
          Si la persona ya figuraba en el Excel (mismo DNI, sin cuenta activada), su ficha, membresías y credencial pasan a
          esta cuenta y el registro duplicado se elimina.
        </p>
        <input name="dni" inputMode="numeric" required placeholder="DNI del socio importado" className={INPUT} />
        {estadoUnir?.error && <p className="text-xs text-[#ffb4ab]">{estadoUnir.error}</p>}
        <button type="submit" disabled={uniendo} className={BOTON}>
          {uniendo ? "Uniendo..." : "Unir registros"}
        </button>
      </form>
    </div>
  );
}
