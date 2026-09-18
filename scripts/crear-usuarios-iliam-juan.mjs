// Crea dos cuentas reales de prueba (coach + alumno) para que las usen
// Iliam Romero y Juan Pérez, y los deja vinculados entre sí para poder
// probar el flujo completo (programar, entrenar, feedback) sin pasos
// extra. Sigue el mismo patrón que scripts/crear-coach-prueba.mjs: crea
// primero el usuario en Supabase Auth (el login real pasa por ahí, nunca
// por un INSERT directo a la tabla usuarios) y después la fila espejo en
// Prisma. Seguro de re-correr: si el email ya existe, lo reusa.
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const PASSWORD = "BlackHub2026!";

const COACH = { email: "iliam.romero@blackhub.test", nombre: "Iliam", apellido: "Romero" };
const ALUMNO = { email: "juan.perez@blackhub.test", nombre: "Juan", apellido: "Perez" };

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const prisma = new PrismaClient();

async function crearOReusarUsuario({ email, nombre, apellido }) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`  ya existía: ${email}`);
    return existente.id_usuario;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre, apellido },
  });
  if (error) throw error;

  await prisma.usuario.create({
    data: { id_usuario: data.user.id, email, nombre, apellido },
  });
  console.log(`  creado: ${email}`);
  return data.user.id;
}

async function main() {
  console.log("Coach...");
  const idCoach = await crearOReusarUsuario(COACH);
  await prisma.usuarioRol.upsert({
    where: { usuario_rol_unico: { id_usuario: idCoach, rol: "entrenador" } },
    update: {},
    create: { id_usuario: idCoach, rol: "entrenador" },
  });
  const entrenador = await prisma.entrenador.upsert({
    where: { id_usuario: idCoach },
    update: {},
    create: { id_usuario: idCoach },
  });

  console.log("Alumno...");
  const idAlumno = await crearOReusarUsuario(ALUMNO);
  await prisma.usuarioRol.upsert({
    where: { usuario_rol_unico: { id_usuario: idAlumno, rol: "alumno" } },
    update: {},
    create: { id_usuario: idAlumno, rol: "alumno" },
  });
  const alumno = await prisma.alumno.upsert({
    where: { id_usuario: idAlumno },
    update: {},
    create: { id_usuario: idAlumno },
  });

  console.log("Vinculando alumno al coach...");
  await prisma.relacionEntrenadorAlumno.upsert({
    where: {
      id_entrenador_id_alumno: {
        id_entrenador: entrenador.id_entrenador,
        id_alumno: alumno.id_alumno,
      },
    },
    update: { estado_relacion: "activa" },
    create: {
      id_entrenador: entrenador.id_entrenador,
      id_alumno: alumno.id_alumno,
    },
  });

  console.log("\nListo. Credenciales de prueba:\n");
  console.log(`Coach (Iliam Romero)   -> ${COACH.email} / ${PASSWORD}`);
  console.log(`Alumno (Juan Perez)    -> ${ALUMNO.email} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
