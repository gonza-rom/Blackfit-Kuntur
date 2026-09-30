"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { guardarDiaPlan, copiarBloqueADia } from "@/app/actions/coach";
import {
  ETIQUETA_TIPO_BLOQUE,
  nombreDeBloque,
  tipoDeBloque,
} from "@/lib/plan-dia";
import { SelectorEjercicio, type EjercicioCatalogo } from "./selector-ejercicio";

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

type Fila = {
  id_ejercicio_programa?: string;
  id_ejercicio: string;
  nombre: string;
  series: string;
  repeticiones: string;
  peso_sugerido: string;
  descanso: string;
  tempo: string;
  metodo_entrenamiento: string;
  tiempo_bajo_tension_sugerido: string;
  nota: string;
};

type DatosGrupo = {
  id_grupo?: string;
  nombre: string;
  rondas: string;
  descanso_entre_ejercicios: string;
  descanso_entre_rondas: string;
  tempo: string;
  nota: string;
};

export type ItemInicial =
  | { tipo: "ejercicio"; ejercicio: Fila }
  | ({ tipo: "grupo"; ejercicios: Fila[] } & DatosGrupo);

export type OpcionSemanas = { semana_inicio: number; semana_fin: number; etiqueta: string };

type FilaEditor = Fila & { clave: string };
type ItemEditor =
  | { clave: string; tipo: "ejercicio"; ejercicio: FilaEditor }
  | ({ clave: string; tipo: "grupo"; ejercicios: FilaEditor[] } & DatosGrupo);

type Arrastre = { tipo: "item"; desde: number } | { tipo: "ejercicio"; grupo: string; desde: number };

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

let contadorClaves = 0;
function nuevaClave() {
  contadorClaves += 1;
  return `k${Date.now().toString(36)}${contadorClaves.toString(36)}`;
}

function filaVacia(): FilaEditor {
  return {
    clave: nuevaClave(),
    id_ejercicio: "",
    nombre: "",
    series: "",
    repeticiones: "",
    peso_sugerido: "",
    descanso: "",
    tempo: "",
    metodo_entrenamiento: "",
    tiempo_bajo_tension_sugerido: "",
    nota: "",
  };
}

function mover<T>(lista: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || hasta < 0 || hasta >= lista.length) return lista;
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hasta, 0, elemento);
  return copia;
}

// Lo que viaja al servidor: sin la clave interna de React ni el nombre
// (el servidor solo necesita el id del ejercicio de la biblioteca).
function sinClave(fila: FilaEditor) {
  const resto: Partial<FilaEditor> = { ...fila };
  delete resto.clave;
  delete resto.nombre;
  return resto;
}

const DIAS: { valor: string; etiqueta: string }[] = [
  { valor: "lunes", etiqueta: "Lunes" },
  { valor: "martes", etiqueta: "Martes" },
  { valor: "miercoles", etiqueta: "Miércoles" },
  { valor: "jueves", etiqueta: "Jueves" },
  { valor: "viernes", etiqueta: "Viernes" },
  { valor: "sabado", etiqueta: "Sábado" },
  { valor: "domingo", etiqueta: "Domingo" },
];

const inputClase =
  "bg-[#262626] border border-transparent focus:border-primary-container focus:ring-0 focus:outline-none rounded text-on-surface text-sm p-2.5 w-full";
const etiquetaClase =
  "font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-on-surface-variant uppercase";
const botonIcono = "p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-25 disabled:hover:text-on-surface-variant";

// ------------------------------------------------------------
// Editor del día
// ------------------------------------------------------------

export function FormDiaPlan({
  idPrograma,
  idAlumno,
  semanaInicio,
  semanaFin,
  diaSemana,
  catalogo,
  itemsIniciales,
  opcionesSemanas,
}: {
  idPrograma: string;
  idAlumno: string;
  semanaInicio: number;
  semanaFin: number;
  diaSemana: string;
  catalogo: EjercicioCatalogo[];
  itemsIniciales: ItemInicial[];
  opcionesSemanas: OpcionSemanas[];
}) {
  const [state, action, pending] = useActionState(guardarDiaPlan, undefined);
  const [items, setItems] = useState<ItemEditor[]>(() =>
    itemsIniciales.map((item) =>
      item.tipo === "ejercicio"
        ? { clave: nuevaClave(), tipo: "ejercicio", ejercicio: { ...item.ejercicio, clave: nuevaClave() } }
        : { ...item, clave: nuevaClave(), ejercicios: item.ejercicios.map((e) => ({ ...e, clave: nuevaClave() })) }
    )
  );
  const [menuAgregar, setMenuAgregar] = useState(false);
  const [claveEnfocar, setClaveEnfocar] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false);
  const arrastre = useRef<Arrastre | null>(null);
  const [destinoArrastre, setDestinoArrastre] = useState<string | null>(null);

  function cambiar(fn: (prev: ItemEditor[]) => ItemEditor[]) {
    setItems(fn);
    setCambiosSinGuardar(true);
    setErrorLocal(null);
  }

  // --- items del día --------------------------------------------------

  function agregarEjercicio() {
    const fila = filaVacia();
    cambiar((prev) => [...prev, { clave: nuevaClave(), tipo: "ejercicio", ejercicio: fila }]);
    setClaveEnfocar(fila.clave);
    setMenuAgregar(false);
  }

  function agregarBloque() {
    const primera = filaVacia();
    cambiar((prev) => [
      ...prev,
      {
        clave: nuevaClave(),
        tipo: "grupo",
        nombre: "",
        rondas: "3",
        descanso_entre_ejercicios: "",
        descanso_entre_rondas: "",
        tempo: "",
        nota: "",
        ejercicios: [primera, filaVacia()],
      },
    ]);
    setClaveEnfocar(primera.clave);
    setMenuAgregar(false);
  }

  function quitarItem(clave: string) {
    cambiar((prev) => prev.filter((i) => i.clave !== clave));
  }

  function moverItem(desde: number, hasta: number) {
    cambiar((prev) => mover(prev, desde, hasta));
  }

  function actualizarEjercicioSuelto(clave: string, cambios: Partial<Fila>) {
    cambiar((prev) =>
      prev.map((i) => (i.clave === clave && i.tipo === "ejercicio" ? { ...i, ejercicio: { ...i.ejercicio, ...cambios } } : i))
    );
  }

  function actualizarGrupo(clave: string, cambios: Partial<DatosGrupo>) {
    cambiar((prev) => prev.map((i) => (i.clave === clave && i.tipo === "grupo" ? { ...i, ...cambios } : i)));
  }

  function actualizarEjerciciosGrupo(clave: string, fn: (ejs: FilaEditor[]) => FilaEditor[]) {
    cambiar((prev) =>
      prev.map((i) => (i.clave === clave && i.tipo === "grupo" ? { ...i, ejercicios: fn(i.ejercicios) } : i))
    );
  }

  // Duplicar: copia el bloque justo debajo, como bloque NUEVO (sin ids),
  // así el original queda intacto y la copia se edita por separado.
  function duplicarBloque(clave: string) {
    cambiar((prev) => {
      const idx = prev.findIndex((i) => i.clave === clave);
      const original = prev[idx];
      if (!original || original.tipo !== "grupo") return prev;
      const nombreAuto = !original.nombre.trim() || /^bloque [a-z]{1,2}$/i.test(original.nombre.trim());
      const copia: ItemEditor = {
        ...original,
        clave: nuevaClave(),
        id_grupo: undefined,
        nombre: nombreAuto ? "" : `${original.nombre.trim()} (copia)`,
        ejercicios: original.ejercicios.map((e) => ({ ...e, clave: nuevaClave(), id_ejercicio_programa: undefined })),
      };
      const nuevos = [...prev];
      nuevos.splice(idx + 1, 0, copia);
      return nuevos;
    });
  }

  function valoresAlElegir(actual: Fila, ejercicio: EjercicioCatalogo, enBloque: boolean): Partial<Fila> {
    // Cambiar el ejercicio de una fila ya guardada la convierte en una
    // fila nueva: el servidor decide si reutiliza el id o archiva la vieja
    // (si tenía series registradas), así el historial nunca cambia de nombre.
    const base: Partial<Fila> = {
      id_ejercicio: ejercicio.id_ejercicio,
      nombre: ejercicio.nombre,
      repeticiones: actual.repeticiones || ejercicio.repeticiones_default || "",
      peso_sugerido: actual.peso_sugerido || ejercicio.peso_sugerido_default || "",
    };
    if (enBloque) return base;
    return {
      ...base,
      series: actual.series || ejercicio.series_default?.toString() || "",
      descanso: actual.descanso || ejercicio.descanso_default || "",
      tempo: actual.tempo || ejercicio.tempo_default || "",
      metodo_entrenamiento: actual.metodo_entrenamiento || ejercicio.metodo_entrenamiento_default || "",
      tiempo_bajo_tension_sugerido:
        actual.tiempo_bajo_tension_sugerido || ejercicio.tiempo_bajo_tension_default?.toString() || "",
    };
  }

  // --- drag & drop ----------------------------------------------------

  function alSoltarItem(hasta: number) {
    const a = arrastre.current;
    arrastre.current = null;
    setDestinoArrastre(null);
    if (a?.tipo === "item") moverItem(a.desde, hasta);
  }

  function alSoltarEjercicio(grupo: string, hasta: number) {
    const a = arrastre.current;
    arrastre.current = null;
    setDestinoArrastre(null);
    if (a?.tipo === "ejercicio" && a.grupo === grupo) {
      actualizarEjerciciosGrupo(grupo, (ejs) => mover(ejs, a.desde, hasta));
    }
  }

  // --- envío ----------------------------------------------------------

  const payload = items.map((item) =>
    item.tipo === "ejercicio"
      ? { tipo: "ejercicio", ejercicio: sinClave(item.ejercicio) }
      : {
          tipo: "grupo",
          id_grupo: item.id_grupo,
          nombre: item.nombre,
          rondas: item.rondas,
          descanso_entre_ejercicios: item.descanso_entre_ejercicios,
          descanso_entre_rondas: item.descanso_entre_rondas,
          tempo: item.tempo,
          nota: item.nota,
          ejercicios: item.ejercicios.map(sinClave),
        }
  );

  function validarAntesDeEnviar(e: React.FormEvent<HTMLFormElement>) {
    const sinElegir = items.some((item) =>
      item.tipo === "ejercicio" ? !item.ejercicio.id_ejercicio : item.ejercicios.some((f) => !f.id_ejercicio)
    );
    if (sinElegir) {
      e.preventDefault();
      setErrorLocal("Hay ejercicios sin elegir de la biblioteca. Elegilos o quitá esas filas.");
      return;
    }
    const bloqueVacio = items.some((item) => item.tipo === "grupo" && item.ejercicios.length === 0);
    if (bloqueVacio) {
      e.preventDefault();
      setErrorLocal("Hay un bloque sin ejercicios. Agregale ejercicios o eliminalo.");
    }
  }

  let indiceBloque = 0;

  return (
    <form action={action} onSubmit={validarAntesDeEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="id_programa" value={idPrograma} />
      <input type="hidden" name="semana_inicio" value={semanaInicio} />
      <input type="hidden" name="semana_fin" value={semanaFin} />
      <input type="hidden" name="dia_semana" value={diaSemana} />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />

      {items.length === 0 ? (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-4 text-on-surface-variant text-sm">
          Día de descanso — sin ejercicios cargados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => {
            const props = {
              indice: idx,
              total: items.length,
              resaltado: destinoArrastre === item.clave,
              onSubir: () => moverItem(idx, idx - 1),
              onBajar: () => moverItem(idx, idx + 1),
              onQuitar: () => quitarItem(item.clave),
              onDragStart: () => {
                arrastre.current = { tipo: "item", desde: idx };
              },
              onDragOver: (e: React.DragEvent) => {
                if (arrastre.current?.tipo !== "item") return;
                e.preventDefault();
                setDestinoArrastre(item.clave);
              },
              onDrop: (e: React.DragEvent) => {
                if (arrastre.current?.tipo !== "item") return;
                e.preventDefault();
                alSoltarItem(idx);
              },
              onDragEnd: () => {
                arrastre.current = null;
                setDestinoArrastre(null);
              },
            };

            if (item.tipo === "ejercicio") {
              return (
                <TarjetaEjercicioIndividual
                  key={item.clave}
                  {...props}
                  fila={item.ejercicio}
                  catalogo={catalogo}
                  autoFocus={claveEnfocar === item.ejercicio.clave}
                  onCambiar={(cambios) => actualizarEjercicioSuelto(item.clave, cambios)}
                  onElegir={(ej) =>
                    actualizarEjercicioSuelto(item.clave, valoresAlElegir(item.ejercicio, ej, false))
                  }
                />
              );
            }

            const indiceEsteBloque = indiceBloque++;
            return (
              <TarjetaBloque
                key={item.clave}
                {...props}
                grupo={item}
                nombreAutomatico={nombreDeBloque(null, indiceEsteBloque)}
                catalogo={catalogo}
                claveEnfocar={claveEnfocar}
                destinoArrastre={destinoArrastre}
                opcionesSemanas={opcionesSemanas}
                cambiosSinGuardar={cambiosSinGuardar}
                onCambiarGrupo={(cambios) => actualizarGrupo(item.clave, cambios)}
                onCambiarEjercicio={(claveEj, cambios) =>
                  actualizarEjerciciosGrupo(item.clave, (ejs) =>
                    ejs.map((f) => (f.clave === claveEj ? { ...f, ...cambios } : f))
                  )
                }
                onElegirEjercicio={(claveEj, ej) =>
                  actualizarEjerciciosGrupo(item.clave, (ejs) =>
                    ejs.map((f) => (f.clave === claveEj ? { ...f, ...valoresAlElegir(f, ej, true) } : f))
                  )
                }
                onAgregarEjercicio={() => {
                  const fila = filaVacia();
                  actualizarEjerciciosGrupo(item.clave, (ejs) => [...ejs, fila]);
                  setClaveEnfocar(fila.clave);
                }}
                onQuitarEjercicio={(claveEj) =>
                  actualizarEjerciciosGrupo(item.clave, (ejs) => ejs.filter((f) => f.clave !== claveEj))
                }
                onMoverEjercicio={(desde, hasta) =>
                  actualizarEjerciciosGrupo(item.clave, (ejs) => mover(ejs, desde, hasta))
                }
                onDuplicar={() => duplicarBloque(item.clave)}
                onArrastreEjercicio={(desde) => {
                  arrastre.current = { tipo: "ejercicio", grupo: item.clave, desde };
                }}
                onSobreEjercicio={(claveEj, e) => {
                  const a = arrastre.current;
                  if (a?.tipo !== "ejercicio" || a.grupo !== item.clave) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDestinoArrastre(claveEj);
                }}
                onSoltarEjercicio={(hasta, e) => {
                  const a = arrastre.current;
                  if (a?.tipo !== "ejercicio" || a.grupo !== item.clave) return;
                  e.preventDefault();
                  e.stopPropagation();
                  alSoltarEjercicio(item.clave, hasta);
                }}
              />
            );
          })}
        </div>
      )}

      <div className="relative self-start">
        <button
          type="button"
          onClick={() => setMenuAgregar((v) => !v)}
          aria-expanded={menuAgregar}
          className="flex items-center gap-1.5 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] uppercase"
        >
          <span className="material-symbols-outlined text-[18px]">{menuAgregar ? "close" : "add"}</span>
          Agregar
        </button>
        {menuAgregar && (
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={agregarEjercicio}
              className="flex items-center gap-3 text-left bg-[#1A1A1A] border border-[#262626] hover:border-primary-container/60 rounded-xl px-4 py-3"
            >
              <span className="material-symbols-outlined text-primary-container">fitness_center</span>
              <span>
                <span className="block text-sm font-semibold text-on-surface">Agregar ejercicio</span>
                <span className="block text-xs text-on-surface-variant">Un ejercicio individual</span>
              </span>
            </button>
            <button
              type="button"
              onClick={agregarBloque}
              className="flex items-center gap-3 text-left bg-[#1A1A1A] border border-[#262626] hover:border-primary-container/60 rounded-xl px-4 py-3"
            >
              <span className="material-symbols-outlined text-primary-container">view_week</span>
              <span>
                <span className="block text-sm font-semibold text-on-surface">Agregar bloque</span>
                <span className="block text-xs text-on-surface-variant">Superserie, triserie o circuito</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {(errorLocal || state?.error) && (
        <p className="font-[family-name:var(--font-inter)] text-sm text-[#ffb4ab]">{errorLocal ?? state?.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-primary-container text-black font-[family-name:var(--font-sora)] text-[16px] font-bold h-12 rounded hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <Link href={`/coach/alumnos/${idAlumno}?tab=planificacion`} className="text-on-surface-variant text-sm">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

// ------------------------------------------------------------
// Controles comunes de un item (orden + arrastre + quitar)
// ------------------------------------------------------------

type PropsItem = {
  indice: number;
  total: number;
  resaltado: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onQuitar: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
};

function Asa({
  onDragStart,
  onDragEnd,
  etiqueta,
}: {
  onDragStart: (e: React.DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
  etiqueta: string;
}) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox no arranca el drag sin datos.
        e.dataTransfer.setData("text/plain", "");
        const tarjeta = e.currentTarget.closest("[data-arrastrable]");
        if (tarjeta instanceof HTMLElement) e.dataTransfer.setDragImage(tarjeta, 16, 16);
        onDragStart(e);
      }}
      onDragEnd={onDragEnd}
      title={etiqueta}
      aria-label={etiqueta}
      className="material-symbols-outlined text-[20px] text-on-surface-variant cursor-grab active:cursor-grabbing select-none"
    >
      drag_indicator
    </span>
  );
}

// ------------------------------------------------------------
// Ejercicio individual
// ------------------------------------------------------------

function TarjetaEjercicioIndividual({
  fila,
  catalogo,
  autoFocus,
  onCambiar,
  onElegir,
  ...item
}: PropsItem & {
  fila: FilaEditor;
  catalogo: EjercicioCatalogo[];
  autoFocus: boolean;
  onCambiar: (cambios: Partial<Fila>) => void;
  onElegir: (ejercicio: EjercicioCatalogo) => void;
}) {
  return (
    <div
      data-arrastrable
      onDragOver={item.onDragOver}
      onDrop={item.onDrop}
      className={`bg-[#1A1A1A] border rounded-xl p-4 flex flex-col gap-2 transition-colors ${
        item.resaltado ? "border-primary-container" : "border-[#262626]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={etiquetaClase}>Ejercicio individual</span>
        <ControlesOrden {...item} etiquetaQuitar="Quitar ejercicio" />
      </div>
      <div className="flex items-center gap-2">
        <Asa onDragStart={item.onDragStart} onDragEnd={item.onDragEnd} etiqueta="Arrastrar para reordenar" />
        <SelectorEjercicio
          idSeleccionado={fila.id_ejercicio}
          nombreSeleccionado={fila.nombre}
          catalogo={catalogo}
          onElegir={onElegir}
          autoFocus={autoFocus}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input type="number" min={1} required value={fila.series} onChange={(e) => onCambiar({ series: e.target.value })} placeholder="Series" aria-label="Series" className={inputClase} />
        <input type="text" required value={fila.repeticiones} onChange={(e) => onCambiar({ repeticiones: e.target.value })} placeholder="Reps (ej. 8-10)" aria-label="Repeticiones" className={inputClase} />
        <input type="number" step="0.01" value={fila.peso_sugerido} onChange={(e) => onCambiar({ peso_sugerido: e.target.value })} placeholder="Peso sugerido (kg)" aria-label="Peso sugerido" className={inputClase} />
        <input type="text" value={fila.descanso} onChange={(e) => onCambiar({ descanso: e.target.value })} placeholder="Descanso (ej. 90s)" aria-label="Descanso" className={inputClase} />
        <input type="text" value={fila.tempo} onChange={(e) => onCambiar({ tempo: e.target.value })} placeholder="Tempo (opcional)" aria-label="Tempo" className={inputClase} />
        <input type="text" value={fila.metodo_entrenamiento} onChange={(e) => onCambiar({ metodo_entrenamiento: e.target.value })} placeholder="Método (ej. drop set)" aria-label="Método" className={inputClase} />
        <input type="number" min={0} value={fila.tiempo_bajo_tension_sugerido} onChange={(e) => onCambiar({ tiempo_bajo_tension_sugerido: e.target.value })} placeholder="TUT sugerido (seg)" aria-label="Tiempo bajo tensión sugerido" className={inputClase} />
        <input type="text" value={fila.nota} onChange={(e) => onCambiar({ nota: e.target.value })} placeholder="Nota (opcional)" aria-label="Nota" className={`col-span-2 ${inputClase}`} />
      </div>
    </div>
  );
}

function ControlesOrden({
  indice,
  total,
  onSubir,
  onBajar,
  onQuitar,
  etiquetaQuitar,
}: Pick<PropsItem, "indice" | "total" | "onSubir" | "onBajar" | "onQuitar"> & { etiquetaQuitar: string }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button type="button" onClick={onSubir} disabled={indice === 0} aria-label="Subir" className={botonIcono}>
        <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
      </button>
      <button type="button" onClick={onBajar} disabled={indice === total - 1} aria-label="Bajar" className={botonIcono}>
        <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
      </button>
      <button type="button" onClick={onQuitar} aria-label={etiquetaQuitar} className="p-1 text-on-surface-variant hover:text-[#ffb4ab]">
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// Bloque (superserie / triserie / circuito)
// ------------------------------------------------------------

function TarjetaBloque({
  grupo,
  nombreAutomatico,
  catalogo,
  claveEnfocar,
  destinoArrastre,
  opcionesSemanas,
  cambiosSinGuardar,
  onCambiarGrupo,
  onCambiarEjercicio,
  onElegirEjercicio,
  onAgregarEjercicio,
  onQuitarEjercicio,
  onMoverEjercicio,
  onDuplicar,
  onArrastreEjercicio,
  onSobreEjercicio,
  onSoltarEjercicio,
  ...item
}: PropsItem & {
  grupo: Extract<ItemEditor, { tipo: "grupo" }>;
  nombreAutomatico: string;
  catalogo: EjercicioCatalogo[];
  claveEnfocar: string | null;
  destinoArrastre: string | null;
  opcionesSemanas: OpcionSemanas[];
  cambiosSinGuardar: boolean;
  onCambiarGrupo: (cambios: Partial<DatosGrupo>) => void;
  onCambiarEjercicio: (clave: string, cambios: Partial<Fila>) => void;
  onElegirEjercicio: (clave: string, ejercicio: EjercicioCatalogo) => void;
  onAgregarEjercicio: () => void;
  onQuitarEjercicio: (clave: string) => void;
  onMoverEjercicio: (desde: number, hasta: number) => void;
  onDuplicar: () => void;
  onArrastreEjercicio: (desde: number) => void;
  onSobreEjercicio: (clave: string, e: React.DragEvent) => void;
  onSoltarEjercicio: (hasta: number, e: React.DragEvent) => void;
}) {
  const tipo = tipoDeBloque(grupo.ejercicios.length);
  const nombreVisible = grupo.nombre.trim() || nombreAutomatico;
  const [copiando, setCopiando] = useState(false);

  return (
    <div
      data-arrastrable
      onDragOver={item.onDragOver}
      onDrop={item.onDrop}
      className={`bg-[#141414] border-2 rounded-xl overflow-hidden transition-colors ${
        item.resaltado ? "border-primary-container" : "border-primary-container/30"
      }`}
    >
      <div className="bg-primary-container/10 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Asa onDragStart={item.onDragStart} onDragEnd={item.onDragEnd} etiqueta="Arrastrar bloque para reordenar" />
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase text-primary-container truncate">
            {nombreVisible} · {tipo === "individual" ? "Bloque" : ETIQUETA_TIPO_BLOQUE[tipo]}
          </span>
        </div>
        <ControlesOrden {...item} etiquetaQuitar="Eliminar bloque" />
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="flex flex-col gap-1 col-span-2">
            <span className={etiquetaClase}>Nombre (opcional)</span>
            <input type="text" value={grupo.nombre} onChange={(e) => onCambiarGrupo({ nombre: e.target.value })} placeholder={nombreAutomatico} className={inputClase} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiquetaClase}>Rondas</span>
            <input type="number" min={1} required value={grupo.rondas} onChange={(e) => onCambiarGrupo({ rondas: e.target.value })} className={inputClase} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiquetaClase}>Tempo</span>
            <input type="text" value={grupo.tempo} onChange={(e) => onCambiarGrupo({ tempo: e.target.value })} placeholder="ej. 3-1-1" className={inputClase} />
          </label>
          <label className="flex flex-col gap-1 col-span-1 md:col-span-2">
            <span className={etiquetaClase}>Descanso entre ejercicios</span>
            <input type="text" value={grupo.descanso_entre_ejercicios} onChange={(e) => onCambiarGrupo({ descanso_entre_ejercicios: e.target.value })} placeholder="ej. 0-15 s" className={inputClase} />
          </label>
          <label className="flex flex-col gap-1 col-span-1 md:col-span-2">
            <span className={etiquetaClase}>Descanso entre rondas</span>
            <input type="text" value={grupo.descanso_entre_rondas} onChange={(e) => onCambiarGrupo({ descanso_entre_rondas: e.target.value })} placeholder="ej. 90 s" className={inputClase} />
          </label>
          <label className="flex flex-col gap-1 col-span-2 md:col-span-4">
            <span className={etiquetaClase}>Nota del coach</span>
            <input type="text" value={grupo.nota} onChange={(e) => onCambiarGrupo({ nota: e.target.value })} placeholder="Indicaciones para el bloque (opcional)" className={inputClase} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          {grupo.ejercicios.length === 0 && (
            <p className="text-sm text-on-surface-variant">Todavía no tiene ejercicios.</p>
          )}
          {grupo.ejercicios.map((fila, i) => (
            <div
              key={fila.clave}
              data-arrastrable
              onDragOver={(e) => onSobreEjercicio(fila.clave, e)}
              onDrop={(e) => onSoltarEjercicio(i, e)}
              className={`bg-[#1A1A1A] border rounded-lg p-3 flex flex-col gap-2 ${
                destinoArrastre === fila.clave ? "border-primary-container" : "border-[#262626]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Asa
                  onDragStart={(e) => {
                    e.stopPropagation();
                    onArrastreEjercicio(i);
                  }}
                  onDragEnd={item.onDragEnd}
                  etiqueta="Arrastrar ejercicio para reordenar"
                />
                <span className="w-5 shrink-0 text-center font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-primary-container">
                  {i + 1}
                </span>
                <SelectorEjercicio
                  idSeleccionado={fila.id_ejercicio}
                  nombreSeleccionado={fila.nombre}
                  catalogo={catalogo}
                  onElegir={(ej) => onElegirEjercicio(fila.clave, ej)}
                  autoFocus={claveEnfocar === fila.clave}
                />
                <ControlesOrden
                  indice={i}
                  total={grupo.ejercicios.length}
                  onSubir={() => onMoverEjercicio(i, i - 1)}
                  onBajar={() => onMoverEjercicio(i, i + 1)}
                  onQuitar={() => onQuitarEjercicio(fila.clave)}
                  etiquetaQuitar="Quitar ejercicio del bloque"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pl-0 sm:pl-12">
                <input type="text" required value={fila.repeticiones} onChange={(e) => onCambiarEjercicio(fila.clave, { repeticiones: e.target.value })} placeholder="Reps" aria-label="Repeticiones" className={inputClase} />
                <input type="number" step="0.01" value={fila.peso_sugerido} onChange={(e) => onCambiarEjercicio(fila.clave, { peso_sugerido: e.target.value })} placeholder="Peso (vacío = corporal)" aria-label="Peso sugerido" className={inputClase} />
                <input type="text" value={fila.nota} onChange={(e) => onCambiarEjercicio(fila.clave, { nota: e.target.value })} placeholder="Nota" aria-label="Nota del ejercicio" className={inputClase} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onAgregarEjercicio}
            className="self-start flex items-center gap-1.5 text-primary-container font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] uppercase py-1"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Agregar ejercicio
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#262626] pt-3">
          <button
            type="button"
            onClick={onDuplicar}
            className="flex items-center gap-1.5 border border-outline-variant text-on-surface-variant hover:text-on-surface font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            Duplicar bloque
          </button>
          {grupo.id_grupo && (
            <button
              type="button"
              onClick={() => setCopiando((v) => !v)}
              aria-expanded={copiando}
              className="flex items-center gap-1.5 border border-outline-variant text-on-surface-variant hover:text-on-surface font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-full"
            >
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              Copiar a otro día / semana
            </button>
          )}
        </div>

        {copiando && grupo.id_grupo && (
          <PanelCopiarBloque
            idGrupo={grupo.id_grupo}
            opcionesSemanas={opcionesSemanas}
            cambiosSinGuardar={cambiosSinGuardar}
            onListo={() => setCopiando(false)}
          />
        )}
      </div>
    </div>
  );
}

// Copia la versión GUARDADA del bloque a otro día/semana del mismo
// programa. Llama a la server action directo (no es un <form>, porque
// vive dentro del form grande del editor).
function PanelCopiarBloque({
  idGrupo,
  opcionesSemanas,
  cambiosSinGuardar,
  onListo,
}: {
  idGrupo: string;
  opcionesSemanas: OpcionSemanas[];
  cambiosSinGuardar: boolean;
  onListo: () => void;
}) {
  const [semanas, setSemanas] = useState(0);
  const [dia, setDia] = useState("lunes");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copiar() {
    const opcion = opcionesSemanas[semanas];
    if (!opcion) return;
    setEnviando(true);
    setError(null);
    try {
      const resultado = await copiarBloqueADia({
        id_grupo: idGrupo,
        semana_inicio: opcion.semana_inicio,
        semana_fin: opcion.semana_fin,
        dia_semana: dia,
      });
      if (resultado?.error) setError(resultado.error);
      else onListo();
    } catch {
      setError("No se pudo copiar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#262626] rounded-lg p-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={etiquetaClase}>Semana</span>
          <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} className={inputClase}>
            {opcionesSemanas.map((o, i) => (
              <option key={`${o.semana_inicio}-${o.semana_fin}`} value={i}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaClase}>Día</span>
          <select value={dia} onChange={(e) => setDia(e.target.value)} className={inputClase}>
            {DIAS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      {cambiosSinGuardar && (
        <p className="text-xs text-on-surface-variant">
          Se copia la última versión guardada del bloque. Guardá este día primero si querés copiar tus cambios.
        </p>
      )}
      {error && <p className="text-xs text-[#ffb4ab]">{error}</p>}
      <button
        type="button"
        onClick={copiar}
        disabled={enviando}
        className="self-start bg-primary-container text-black font-[family-name:var(--font-sora)] text-xs font-bold px-4 py-2 rounded disabled:opacity-60"
      >
        {enviando ? "Copiando..." : "Copiar bloque"}
      </button>
    </div>
  );
}
