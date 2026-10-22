import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { vincularPerfilHuerfano } from "@/lib/reparar-cuenta";
import { destinoTrasLogin } from "@/lib/auth";

// A donde llega el navegador después de que GoTrue verifica el link del
// mail de confirmación (ver emailRedirectTo en registrarse(), src/app/
// actions/auth.ts). GoTrue ya validó el token; acá solo falta canjear el
// "code" PKCE por una sesión real y dejar al usuario logueado.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Sin perfil en `usuarios` la sesión quedaría rebotando entre
      // /panel y /iniciar-sesion (ver iniciarSesion en actions/auth.ts).
      const vinculado = await vincularPerfilHuerfano(data.user.id, data.user.email ?? "").catch(
        () => false
      );
      if (!vinculado) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/iniciar-sesion`);
      }

      // A su entorno según sus roles reales (ver destinoTrasLogin).
      const usuario = await prisma.usuario.findUnique({
        where: { id_usuario: data.user.id },
        include: { roles: true, alumno: true, entrenador: true, comercio: true },
      });
      return NextResponse.redirect(`${origin}${destinoTrasLogin(usuario)}`);
    }
  }

  return NextResponse.redirect(`${origin}/iniciar-sesion`);
}
