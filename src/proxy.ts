import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const RUTAS_PROTEGIDAS = ["/panel"];
const RUTAS_SOLO_INVITADOS = ["/iniciar-sesion", "/registro"];

export default async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && RUTAS_PROTEGIDAS.some((ruta) => pathname.startsWith(ruta))) {
    return NextResponse.redirect(new URL("/iniciar-sesion", request.url));
  }

  if (user && RUTAS_SOLO_INVITADOS.some((ruta) => pathname.startsWith(ruta))) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
