import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const EMAIL = "devhub.cta+blackhub-admin-demo@gmail.com";
const PASSWORD = "AdminDemo123!";
const NOMBRE = "Admin";
const APELLIDO = "Demo";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const prisma = new PrismaClient();

const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { nombre: NOMBRE, apellido: APELLIDO },
});
if (error) throw error;

await prisma.usuario.create({
  data: {
    id_usuario: data.user.id,
    email: EMAIL,
    nombre: NOMBRE,
    apellido: APELLIDO,
    roles: { create: { rol: "administrador" } },
  },
});

console.log("Admin de prueba creado:");
console.log("email:", EMAIL);
console.log("password:", PASSWORD);

await prisma.$disconnect();
