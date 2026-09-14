// Parseo del CSV que manda Kuntur con sus socios/beneficiarios. Formato
// esperado (con o sin encabezado, separado por ";"):
//   SOCIO;DNI;MEMBRESIA;...
//   veronica mercado;23024823;vence en 27 dias;...
// Los socios no tienen email propio (se generará uno sintético al crear la
// cuenta, ver importarBeneficiarios() en src/app/actions/admin.ts) y el
// vencimiento viene como texto relativo ("vence en N días" / "vence hoy"),
// no como fecha absoluta — por eso se resuelve acá, en el momento del
// import, contra la fecha de hoy.

export type FilaBeneficiarioParseada = {
  linea: number;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_vencimiento_membresia: Date;
};

export type FilaOmitida = { linea: number; motivo: string };

export type ResultadoParseoCsv = {
  filas: FilaBeneficiarioParseada[];
  omitidas: FilaOmitida[];
};

const RE_VENCE_EN = /vence\s+en\s+(\d+)\s*d[ií]as?/i;
const RE_VENCE_HOY = /vence\s+hoy/i;

function capitalizar(nombreCompleto: string): string {
  return nombreCompleto
    .toLowerCase()
    .split(" ")
    .map((parte) => (parte ? parte[0].toUpperCase() + parte.slice(1) : parte))
    .join(" ");
}

// El CSV trae el nombre completo en una sola columna. No hay forma
// confiable de saber dónde termina el nombre y empieza el apellido, así
// que se usa la convención más común: primera palabra = nombre, resto =
// apellido. Queda editable a mano desde /admin/usuarios si hace falta.
function partirNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = capitalizar(nombreCompleto).trim().replace(/\s+/g, " ").split(" ");
  if (partes.length === 1) return { nombre: partes[0], apellido: "" };
  return { nombre: partes[0], apellido: partes.slice(1).join(" ") };
}

export function parsearCsvBeneficiarios(texto: string): ResultadoParseoCsv {
  const filas: FilaBeneficiarioParseada[] = [];
  const omitidas: FilaOmitida[] = [];
  const dnisVistos = new Set<string>();

  texto.split(/\r?\n/).forEach((lineaCruda, index) => {
    const numeroLinea = index + 1;
    const linea = lineaCruda.trim();
    if (!linea) return;

    const [socio, dniRaw, membresia] = linea.split(";").map((c) => c.trim());
    if (!socio || socio.toUpperCase() === "SOCIO") return; // encabezado o fila vacía

    if (!dniRaw) {
      omitidas.push({ linea: numeroLinea, motivo: `${socio}: sin DNI` });
      return;
    }
    const dni = dniRaw.replace(/\D/g, "");
    if (!dni) {
      omitidas.push({ linea: numeroLinea, motivo: `${socio}: DNI inválido ("${dniRaw}")` });
      return;
    }
    if (dnisVistos.has(dni)) {
      omitidas.push({ linea: numeroLinea, motivo: `${socio}: DNI ${dni} repetido en el archivo` });
      return;
    }

    let fecha_vencimiento_membresia: Date;
    if (RE_VENCE_HOY.test(membresia ?? "")) {
      fecha_vencimiento_membresia = new Date();
    } else {
      const match = RE_VENCE_EN.exec(membresia ?? "");
      if (!match) {
        // Ej. "staff": no es un socio con vencimiento, se omite en vez de
        // adivinar una fecha.
        omitidas.push({
          linea: numeroLinea,
          motivo: `${socio}: sin vencimiento reconocible ("${membresia ?? ""}")`,
        });
        return;
      }
      fecha_vencimiento_membresia = new Date();
      fecha_vencimiento_membresia.setDate(
        fecha_vencimiento_membresia.getDate() + Number(match[1])
      );
    }

    dnisVistos.add(dni);
    const { nombre, apellido } = partirNombre(socio);
    filas.push({ linea: numeroLinea, nombre, apellido, dni, fecha_vencimiento_membresia });
  });

  return { filas, omitidas };
}

// Dominio ficticio: nunca se envía correo a esta dirección, solo sirve
// como identificador único para Supabase Auth. El login real de estos
// usuarios es por DNI (ver iniciarSesion en src/app/actions/auth.ts).
export function emailSinteticoBeneficiario(dni: string): string {
  return `dni${dni}@beneficiario.blackhub.local`;
}
