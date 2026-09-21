import { redirect } from "next/navigation";
import { obtenerAdminBlackfitActual } from "@/lib/auth";

// Planes de membresía son del lado Black Fit: solo entra el admin general
// o "admin_blackfit". Ya está gateado server-side en cada acción de
// actions/admin.ts, esto es solo para no mostrarle el formulario a quien
// igual no va a poder guardarlo.
export default async function AdminPlanesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contexto = await obtenerAdminBlackfitActual();
  if (!contexto) redirect("/admin");

  return children;
}
