import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CategoriaBiblioteca } from "@prisma/client";

// Catálogos compartidos: son el mismo dato para cualquier usuario que los
// mire (biblioteca de ejercicios, biblioteca educativa, planes de
// membresía) y hoy se re-consultaban a la base en cada visita de cada
// usuario, sin ningún cache entre requests — a diferencia de
// obtenerUsuarioActual() en auth.ts, que usa cache() de React pero eso
// solo dedupea DENTRO de un mismo request.
//
// unstable_cache guarda el resultado entre requests distintos (60s como
// techo de seguridad) y se invalida al toque con revalidateTag() desde
// cada action que crea/edita/borra un recurso de estos (ver
// src/app/actions/coach.ts, biblioteca.ts, admin.ts). El revalidate por
// tiempo es solo una red de seguridad — la invalidación real es la
// explícita en cada mutación.

export const TAG_CATALOGO_EJERCICIOS = "catalogo-ejercicios";
export const TAG_CATALOGO_BIBLIOTECA = "catalogo-biblioteca";
export const TAG_CATALOGO_PLANES = "catalogo-planes";

export const obtenerEjerciciosCatalogo = unstable_cache(
  async () => prisma.ejercicio.findMany({ orderBy: { nombre: "asc" } }),
  ["catalogo-ejercicios-full"],
  { tags: [TAG_CATALOGO_EJERCICIOS], revalidate: 60 }
);

// Select reducido + valores default ya serializados (Decimal -> string,
// necesario para que unstable_cache pueda guardar el resultado como
// JSON) — usado en el picker de "agregar ejercicio a un bloque".
export const obtenerEjerciciosCatalogoConDefaults = unstable_cache(
  async () => {
    const ejercicios = await prisma.ejercicio.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id_ejercicio: true,
        nombre: true,
        series_default: true,
        repeticiones_default: true,
        peso_sugerido_default: true,
        tempo_default: true,
        descanso_default: true,
        metodo_entrenamiento_default: true,
        tiempo_bajo_tension_default: true,
      },
    });
    return ejercicios.map((e) => ({
      ...e,
      peso_sugerido_default: e.peso_sugerido_default ? e.peso_sugerido_default.toString() : null,
    }));
  },
  ["catalogo-ejercicios-defaults"],
  { tags: [TAG_CATALOGO_EJERCICIOS], revalidate: 60 }
);

export const obtenerBibliotecaCatalogo = unstable_cache(
  async (categoria?: CategoriaBiblioteca) =>
    prisma.biblioteca.findMany({
      where: categoria ? { categoria } : undefined,
      orderBy: { fecha_creacion: "desc" },
    }),
  ["catalogo-biblioteca"],
  { tags: [TAG_CATALOGO_BIBLIOTECA], revalidate: 60 }
);

// precio serializado a string por la misma razón que peso_sugerido_default
// arriba: Decimal no es lo que unstable_cache puede guardar de forma segura.
export const obtenerPlanesMembresia = unstable_cache(
  async () => {
    const planes = await prisma.planMembresia.findMany({ orderBy: { nombre: "asc" } });
    return planes.map((p) => ({ ...p, precio: p.precio.toString() }));
  },
  ["catalogo-planes"],
  { tags: [TAG_CATALOGO_PLANES], revalidate: 60 }
);
