// Normalización de teléfonos para armar links de WhatsApp (wa.me).
//
// La app guarda `Usuario.telefono` como texto libre (el usuario lo carga
// en su perfil). Para `https://wa.me/<numero>` WhatsApp necesita solo
// dígitos, con código de país y sin prefijos nacionales (0) ni el 15 de
// celular argentino.
//
// Es un normalizador best-effort pensado para números argentinos (código
// de país por defecto 54). Si el número guardado está muy incompleto
// devuelve null y la UI muestra el aviso de "sin WhatsApp configurado" en
// vez de un link roto.

const PAIS_DEFAULT = "54";

export function normalizarTelefonoWhatsapp(
  crudo: string | null | undefined,
  paisDefault: string = PAIS_DEFAULT
): string | null {
  if (!crudo) return null;

  let d = crudo.replace(/\D/g, "");
  if (!d) return null;

  // Prefijo de marcación internacional "00".
  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith(paisDefault)) {
    // Ya trae el código de país. Para Argentina, wa.me espera el 9 de
    // celular después del 54 (54 9 <área> <número>).
    if (paisDefault === "54" && !d.startsWith("549")) {
      d = "549" + d.slice(2);
    }
    return d.length >= 11 ? d : null;
  }

  // Sin código de país: sacar un 0 nacional al inicio (ej. "011...").
  if (d.startsWith("0")) d = d.slice(1);

  // Celular argentino escrito como "<área>15<número>": el 15 no va en
  // formato internacional. Solo lo quitamos si quedó un 15 pegado al
  // inicio (área ya removida por el usuario) para no comernos dígitos
  // válidos de un número que sí incluye el área.
  if (paisDefault === "54" && d.startsWith("15")) d = d.slice(2);

  const conPais = paisDefault === "54" ? "549" + d : paisDefault + d;
  return conPais.length >= 11 ? conPais : null;
}

/** Link listo para abrir un chat de WhatsApp, o null si el número no sirve. */
export function linkWhatsapp(
  telefono: string | null | undefined,
  mensaje?: string
): string | null {
  const numero = normalizarTelefonoWhatsapp(telefono);
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
