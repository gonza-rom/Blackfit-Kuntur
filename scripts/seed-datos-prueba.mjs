// Carga datos de prueba realistas en todos los módulos, sobre las cuentas
// demo ya existentes (coach, alumnos, admin) — para poder ver la app con
// contenido real en vez de estados vacíos. Seguro de re-correr: lo
// estructural (programa/bloques/plan/comercios) se salta si ya existe;
// lo histórico (sesiones/progreso/hábitos/feedback) se agrega de nuevo
// cada vez que se corre, igual que pasaría con uso real de la app.
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function crearUsuarioComercio({ email, password, nombreUsuario, apellidoUsuario, comercio }) {
  const existente = await prisma.usuario.findUnique({ where: { email }, include: { comercio: true } });
  if (existente?.comercio) {
    console.log(`  comercio ya existe: ${comercio.nombre}`);
    return existente.comercio;
  }

  let id_usuario;
  if (existente) {
    id_usuario = existente.id_usuario;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombreUsuario, apellido: apellidoUsuario },
    });
    if (error) throw error;
    id_usuario = data.user.id;
    await prisma.usuario.create({
      data: { id_usuario, email, nombre: nombreUsuario, apellido: apellidoUsuario },
    });
  }

  await prisma.usuarioRol.upsert({
    where: { usuario_rol_unico: { id_usuario, rol: "comercio" } },
    update: {},
    create: { id_usuario, rol: "comercio" },
  });

  const perfil = await prisma.comercio.create({ data: { id_usuario, ...comercio } });
  console.log(`  comercio creado: ${comercio.nombre}`);
  return perfil;
}

async function main() {
  // 1. Backfill de alumnos con rol pero sin fila de perfil (bug histórico)
  const sinPerfil = await prisma.usuario.findMany({
    where: { roles: { some: { rol: "alumno" } }, alumno: null },
  });
  for (const u of sinPerfil) {
    await prisma.alumno.create({ data: { id_usuario: u.id_usuario } });
    console.log("Backfill Alumno para", u.email);
  }

  const coach = await prisma.usuario.findUniqueOrThrow({
    where: { email: "devhub.cta+blackhub-coach-demo@gmail.com" },
    include: { entrenador: true },
  });
  const id_entrenador = coach.entrenador.id_entrenador;

  const emailsAlumnos = ["gonzalorom2001@gmail.com", "devhub.cta+blackhub-demo@gmail.com"];
  const alumnosRaw = await prisma.usuario.findMany({
    where: { email: { in: emailsAlumnos } },
    include: { alumno: true },
  });
  const alumnos = alumnosRaw.filter((u) => u.alumno);

  console.log(`\nAlumnos a poblar: ${alumnos.map((a) => a.email).join(", ")}`);

  // 2. Vincular alumnos al coach
  for (const a of alumnos) {
    await prisma.relacionEntrenadorAlumno.upsert({
      where: { id_entrenador_id_alumno: { id_entrenador, id_alumno: a.alumno.id_alumno } },
      update: { estado_relacion: "activa" },
      create: { id_entrenador, id_alumno: a.alumno.id_alumno },
    });
  }

  // 3. Biblioteca de ejercicios
  console.log("\nBiblioteca de ejercicios...");
  const definicionesEjercicios = [
    { nombre: "Sentadilla trasera", grupo_muscular: "Cuádriceps" },
    { nombre: "Press de banca", grupo_muscular: "Pecho" },
    { nombre: "Peso muerto", grupo_muscular: "Espalda baja" },
    { nombre: "Dominadas", grupo_muscular: "Espalda" },
    { nombre: "Press militar", grupo_muscular: "Hombros" },
    { nombre: "Remo con barra", grupo_muscular: "Espalda" },
  ];
  const ejercicios = [];
  for (const def of definicionesEjercicios) {
    let ej = await prisma.ejercicio.findFirst({ where: { nombre: def.nombre } });
    if (!ej) ej = await prisma.ejercicio.create({ data: def });
    ejercicios.push(ej);
  }

  // 4. Plan de membresía + comercios + beneficios (globales, una sola vez)
  console.log("\nPlanes de membresía...");
  let planMensual = await prisma.planMembresia.findFirst({ where: { nombre: "Kuntur Mensual" } });
  if (!planMensual) {
    planMensual = await prisma.planMembresia.create({
      data: {
        nombre: "Kuntur Mensual",
        descripcion: "Acceso completo a Black Hub + beneficios Kuntur.",
        precio: "15000.00",
        duracion_dias: 30,
      },
    });
  }
  let planTrimestral = await prisma.planMembresia.findFirst({ where: { nombre: "Kuntur Trimestral" } });
  if (!planTrimestral) {
    planTrimestral = await prisma.planMembresia.create({
      data: {
        nombre: "Kuntur Trimestral",
        descripcion: "Igual que el mensual, con descuento por pago trimestral.",
        precio: "40000.00",
        duracion_dias: 90,
      },
    });
  }

  console.log("\nComercios adheridos...");
  const comercioNutricion = await crearUsuarioComercio({
    email: "devhub.cta+blackhub-comercio-nutricion@gmail.com",
    password: "ComercioDemo123!",
    nombreUsuario: "NutriFit",
    apellidoUsuario: "Suplementos",
    comercio: {
      nombre: "NutriFit Suplementos",
      descripcion: "Suplementación deportiva y asesoramiento nutricional.",
      direccion: "Av. Siempre Viva 742",
      telefono: "1122334455",
      categoria: "Suplementación",
    },
  });
  const comercioIndumentaria = await crearUsuarioComercio({
    email: "devhub.cta+blackhub-comercio-indumentaria@gmail.com",
    password: "ComercioDemo123!",
    nombreUsuario: "Elite",
    apellidoUsuario: "Sportswear",
    comercio: {
      nombre: "Elite Sportswear",
      descripcion: "Indumentaria y calzado deportivo.",
      direccion: "Calle Falsa 123",
      telefono: "1155667788",
      categoria: "Indumentaria",
    },
  });

  console.log("\nBeneficios...");
  async function crearBeneficioSiNoExiste(id_comercio, datos) {
    let beneficio = await prisma.beneficio.findFirst({ where: { id_comercio, titulo: datos.titulo } });
    if (!beneficio) {
      beneficio = await prisma.beneficio.create({
        data: {
          id_comercio,
          fecha_inicio: diasAtras(30),
          fecha_vencimiento: diasAtras(-60),
          ...datos,
        },
      });
      console.log(`  beneficio creado: ${datos.titulo}`);
    }
    for (const id_plan_membresia of [planMensual.id_plan_membresia, planTrimestral.id_plan_membresia]) {
      await prisma.beneficioPlan.upsert({
        where: {
          id_beneficio_id_plan_membresia: { id_beneficio: beneficio.id_beneficio, id_plan_membresia },
        },
        update: {},
        create: { id_beneficio: beneficio.id_beneficio, id_plan_membresia },
      });
    }
    return beneficio;
  }

  const beneficioProteina = await crearBeneficioSiNoExiste(comercioNutricion.id_comercio, {
    titulo: "20% OFF en proteínas",
    descripcion: "Válido en toda la línea de proteínas en polvo.",
    descuento: "20%",
    condiciones: "No acumulable con otras promociones.",
  });
  await crearBeneficioSiNoExiste(comercioIndumentaria.id_comercio, {
    titulo: "15% OFF en indumentaria",
    descripcion: "Válido en remeras, shorts y calzas.",
    descuento: "15%",
    condiciones: "Presentar credencial digital en caja.",
  });

  // 5. Por cada alumno: membresía activa + credencial + programa + historial
  for (const a of alumnos) {
    console.log(`\n=== ${a.email} ===`);
    const id_alumno = a.alumno.id_alumno;

    // Membresía activa
    const membresiaExistente = await prisma.membresia.findFirst({
      where: { id_usuario: a.id_usuario, estado_membresia: "activa" },
    });
    if (!membresiaExistente) {
      const inicio = diasAtras(10);
      const vencimiento = new Date(inicio);
      vencimiento.setDate(vencimiento.getDate() + planMensual.duracion_dias);
      await prisma.membresia.create({
        data: {
          id_usuario: a.id_usuario,
          id_plan_membresia: planMensual.id_plan_membresia,
          estado_membresia: "activa",
          fecha_inicio_membresia: inicio,
          fecha_vencimiento_membresia: vencimiento,
        },
      });
      console.log("  membresía activa creada");
    } else {
      console.log("  ya tenía membresía activa");
    }

    const numeroSocio = `K-${String((await prisma.credencial.count()) + 1).padStart(6, "0")}`;
    const credencial = await prisma.credencial.upsert({
      where: { id_usuario: a.id_usuario },
      update: {},
      create: { id_usuario: a.id_usuario, numero_socio: numeroSocio },
    });

    // Programa + bloques + ejercicios prescritos
    let programa = await prisma.programaEntrenamiento.findFirst({
      where: { id_alumno, id_entrenador, estado_programa: "activo" },
    });
    let bloque1;
    let bloque2;
    let epsBloque1;
    let epsBloque2;

    if (programa) {
      console.log("  ya tenía programa activo, reuso bloques existentes");
      const bloques = await prisma.bloqueEntrenamiento.findMany({
        where: { id_programa: programa.id_programa },
        orderBy: { orden: "asc" },
        include: { ejercicios_programa: true },
      });
      bloque1 = bloques[0];
      bloque2 = bloques[1];
      epsBloque1 = bloque1?.ejercicios_programa ?? [];
      epsBloque2 = bloque2?.ejercicios_programa ?? [];
    } else {
      programa = await prisma.programaEntrenamiento.create({
        data: {
          id_alumno,
          id_entrenador,
          nombre: "Fuerza General",
          descripcion: "Programa base de fuerza full body, en 2 bloques.",
          objetivo: "Fuerza e hipertrofia",
          fecha_inicio: diasAtras(28),
          estado_programa: "activo",
        },
      });
      bloque1 = await prisma.bloqueEntrenamiento.create({
        data: {
          id_programa: programa.id_programa,
          nombre: "Bloque 1 - Acumulación",
          orden: 1,
          semana_inicio: 1,
          semana_fin: 2,
          tipo: "acumulacion",
        },
      });
      bloque2 = await prisma.bloqueEntrenamiento.create({
        data: {
          id_programa: programa.id_programa,
          nombre: "Bloque 2 - Intensificación",
          orden: 2,
          semana_inicio: 3,
          semana_fin: 4,
          tipo: "intensificacion",
        },
      });

      const prescripciones = [
        { ejercicio: ejercicios[0], series: 4, repeticiones: "8-10", peso_sugerido: "60.00", tempo: "3-1-1", descanso: "90s" },
        { ejercicio: ejercicios[1], series: 4, repeticiones: "6-8", peso_sugerido: "50.00", tempo: "2-1-1", descanso: "120s" },
        { ejercicio: ejercicios[2], series: 3, repeticiones: "5", peso_sugerido: "80.00", descanso: "150s" },
        { ejercicio: ejercicios[3], series: 3, repeticiones: "6-8", peso_sugerido: null, descanso: "90s" },
      ];

      epsBloque1 = [];
      let orden = 1;
      for (const p of prescripciones) {
        epsBloque1.push(
          await prisma.ejercicioPrograma.create({
            data: {
              id_bloque: bloque1.id_bloque,
              id_ejercicio: p.ejercicio.id_ejercicio,
              series: p.series,
              repeticiones: p.repeticiones,
              peso_sugerido: p.peso_sugerido,
              tempo: p.tempo ?? null,
              descanso: p.descanso ?? null,
              orden: orden++,
            },
          })
        );
      }
      epsBloque2 = [];
      orden = 1;
      for (const p of prescripciones) {
        epsBloque2.push(
          await prisma.ejercicioPrograma.create({
            data: {
              id_bloque: bloque2.id_bloque,
              id_ejercicio: p.ejercicio.id_ejercicio,
              series: p.series,
              repeticiones: p.repeticiones,
              peso_sugerido: p.peso_sugerido,
              tempo: p.tempo ?? null,
              descanso: p.descanso ?? null,
              tiempo_bajo_tension_sugerido: 40,
              orden: orden++,
            },
          })
        );
      }
      console.log("  programa + 2 bloques + ejercicios creados");
    }

    // Sesiones históricas (8 sesiones en las últimas 4 semanas)
    const diasSesion = [26, 22, 19, 15, 12, 8, 5, 2];
    for (const [i, dias] of diasSesion.entries()) {
      const bloqueActivo = i < 4 ? bloque1 : bloque2;
      const eps = i < 4 ? epsBloque1 : epsBloque2;
      const entrenamiento = await prisma.entrenamiento.create({
        data: {
          id_alumno,
          id_programa: programa.id_programa,
          fecha: diasAtras(dias),
          nombre: bloqueActivo?.nombre ?? "Sesión",
          estado: "completado",
          comentarios: i % 3 === 0 ? "Buena sesión, me sentí fuerte." : null,
        },
      });
      for (const ep of eps) {
        const pesoBase = ep.peso_sugerido ? Number(ep.peso_sugerido) : null;
        await prisma.serieEntrenamiento.create({
          data: {
            id_entrenamiento: entrenamiento.id_entrenamiento,
            id_ejercicio_programa: ep.id_ejercicio_programa,
            peso_utilizado: pesoBase ? (pesoBase + (Math.random() * 4 - 1)).toFixed(2) : null,
            repeticiones_realizadas: 8,
            series_completadas: ep.series,
            rpe: (7 + Math.random() * 2).toFixed(1),
            descanso_real: 90,
            tiempo_bajo_tension: 40,
          },
        });
      }
    }
    console.log(`  ${diasSesion.length} sesiones históricas registradas`);

    // Progreso físico (peso bajando de a poco)
    const pesos = [83.5, 82.8, 82.1, 81.5, 80.9];
    const diasProgreso = [25, 19, 13, 7, 1];
    for (const [i, dias] of diasProgreso.entries()) {
      await prisma.progresoFisico.create({
        data: {
          id_alumno,
          fecha: diasAtras(dias),
          peso_corporal: pesos[i].toFixed(2),
          porcentaje_graso: (18 - i * 0.3).toFixed(2),
          masa_muscular: (60 + i * 0.2).toFixed(2),
        },
      });
    }
    await prisma.medidaCorporal.create({
      data: { id_alumno, fecha: diasAtras(20), tipo_medida: "cintura", valor_cm: "84.00" },
    });
    await prisma.medidaCorporal.create({
      data: { id_alumno, fecha: diasAtras(3), tipo_medida: "cintura", valor_cm: "82.50" },
    });
    await prisma.medidaCorporal.create({
      data: { id_alumno, fecha: diasAtras(3), tipo_medida: "brazo", valor_cm: "36.00" },
    });
    console.log("  progreso físico + medidas cargados");

    // Hábitos (últimos 6 días)
    for (let dias = 5; dias >= 0; dias--) {
      const fecha = diasAtras(dias);
      fecha.setHours(0, 0, 0, 0);
      await prisma.habito.upsert({
        where: { id_alumno_fecha: { id_alumno, fecha } },
        update: {},
        create: {
          id_alumno,
          fecha,
          sueno: 6 + Math.round(Math.random() * 2),
          agua: (2 + Math.random() * 1.5).toFixed(2),
          nutricion: 6 + Math.round(Math.random() * 3),
          suplementacion: Math.random() > 0.3,
          cardio: Math.random() > 0.5,
          movilidad: Math.random() > 0.4,
          recuperacion: 5 + Math.round(Math.random() * 4),
        },
      });
    }
    console.log("  hábitos de los últimos 6 días cargados");

    // Feedback
    const comentariosDiarios = [
      "Me sentí con buena energía hoy.",
      "Un poco cansado pero cumplí con todo.",
      "Excelente sesión, mejoré el peso en sentadilla.",
      "Dormí poco, se notó en el rendimiento.",
    ];
    for (const [i, dias] of [8, 5, 3, 1].entries()) {
      await prisma.feedbackDiario.create({
        data: { id_alumno, fecha: diasAtras(dias), comentario_diario: comentariosDiarios[i] },
      });
    }
    await prisma.feedbackSemanal.create({
      data: {
        id_alumno,
        semana_inicio: diasAtras(14),
        comentario_semanal:
          "Buena semana en general, cumplí las 3 sesiones planificadas. Sensación de fatiga moderada hacia el final.",
      },
    });
    await prisma.feedbackSemanal.create({
      data: {
        id_alumno,
        semana_inicio: diasAtras(7),
        comentario_semanal:
          "Semana más liviana, pero con buena progresión de cargas en tren superior.",
      },
    });
    console.log("  feedback diario y semanal cargados");

    // Una validación de beneficio de ejemplo (para el historial del comercio)
    const validacionExistente = await prisma.validacionBeneficio.findFirst({
      where: { id_usuario: a.id_usuario },
    });
    if (!validacionExistente) {
      await prisma.validacionBeneficio.create({
        data: {
          id_comercio: comercioNutricion.id_comercio,
          id_usuario: a.id_usuario,
          id_beneficio: beneficioProteina.id_beneficio,
          resultado: "aprobado",
        },
      });
      console.log("  validación de beneficio de ejemplo creada");
    }

    console.log(`  credencial: socio #${credencial.numero_socio}`);
  }

  console.log("\nListo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
