import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { vincularPerfilHuerfano } from "@/lib/reparar-cuenta";

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

      const roles = await prisma.usuarioRol.findMany({
        where: { id_usuario: data.user.id },
        select: { rol: true },
      });
      const esSoloBeneficiario =
        roles.some((r) => r.rol === "beneficiario") &&
        !roles.some((r) => r.rol === "alumno");
      const esComercio = roles.some((r) => r.rol === "comercio");

      return NextResponse.redirect(
        `${origin}${esSoloBeneficiario ? "/beneficiario" : esComercio ? "/comercio" : "/panel"}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/iniciar-sesion`);
}
