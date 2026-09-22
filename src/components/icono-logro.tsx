// El campo Logro.icono admite emoji O nombre de ícono de Material Symbols
// (ver comentario en prisma/schema.prisma) — el seed usa nombres tipo
// "local_fire_department", el form de /coach/logros deja cargar un emoji.
// Sin esto, un nombre de Material Symbol se mostraba como texto plano
// (sin la clase "material-symbols-outlined" el navegador no lo traduce al
// glifo). Los nombres de Material Symbols son siempre ascii en snake_case;
// cualquier otra cosa (emoji, vacío) se renderiza tal cual.
const RE_MATERIAL_SYMBOL = /^[a-z][a-z0-9_]*$/;

export function IconoLogro({ icono }: { icono: string | null }) {
  if (!icono) return <>🏆</>;
  if (RE_MATERIAL_SYMBOL.test(icono)) {
    return <span className="material-symbols-outlined">{icono}</span>;
  }
  return <>{icono}</>;
}
