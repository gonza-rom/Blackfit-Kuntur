import { cookies } from "next/headers";

// Aviso emergente ("Comercio activado", "Beneficio eliminado", etc.) que
// una server action deja para que lo muestre <AvisoGlobal /> (montado en el
// layout raíz). Viaja en una cookie de vida corta, legible desde el
// cliente, en vez de en el estado de useActionState: así funciona igual
// para acciones que terminan en redirect() (el componente que las llamó ya
// se desmontó), para las que solo hacen revalidatePath(), y para las que se
// usan como `<form action={fn}>` sin estado de retorno.
//
// Llamarla SOLO en el camino de éxito, justo antes del revalidatePath /
// redirect final. El nombre de la cookie tiene que coincidir con el que lee
// src/components/aviso-global.tsx.
export const COOKIE_AVISO = "aviso_accion";

export type TipoAviso = "exito" | "eliminado" | "info";

export async function avisar(mensaje: string, tipo: TipoAviso = "exito"): Promise<void> {
  const almacen = await cookies();
  almacen.set(COOKIE_AVISO, JSON.stringify({ mensaje, tipo, id: Date.now() }), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    httpOnly: false,
  });
}
