import { redirect } from "next/navigation";
import { obtenerAdminComerciosActual } from "@/lib/auth";

// Comercios/beneficios son del lado Kuntur: solo entra el admin general o
// "admin_comercios". Ya está gateado server-side en cada acción de
// actions/admin.ts, pero sin esto un admin_blackfit vería el formulario y
// recién se enteraría al intentar guardar.
export default async function AdminComerciosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) redirect("/admin");

  return children;
}
