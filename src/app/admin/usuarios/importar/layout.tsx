import { redirect } from "next/navigation";
import { obtenerAdminComerciosActual } from "@/lib/auth";

// El import de beneficiarios es específicamente del lado Kuntur: solo
// entra el admin general o "admin_comercios".
export default async function AdminImportarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contexto = await obtenerAdminComerciosActual();
  if (!contexto) redirect("/admin/usuarios");

  return children;
}
