import { createClient } from "@supabase/supabase-js";

// Cliente con la service_role key: bypassa RLS y puede crear usuarios de
// Auth directamente (auth.admin.createUser), sin pasar por signUp() ni
// por el flujo de confirmación de email. SOLO para uso server-side (server
// actions), nunca se debe importar desde un componente cliente — la
// service_role key da acceso total al proyecto de Supabase.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
