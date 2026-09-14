import Image from "next/image";

const LOGOS = {
  blackfit: { src: "/blackfit.png", alt: "Black Fit" },
  kuntur: { src: "/kutnur.jpeg", alt: "Kuntur" },
} as const;

export type Marca = keyof typeof LOGOS;

/**
 * Badge circular con el logo de una de las dos marcas del negocio: Black
 * Fit (entrenamiento) o Kuntur (beneficios/comercios). Va en el mismo
 * lugar donde antes había un círculo con la inicial del usuario — acá
 * comunica de un vistazo en qué parte de la app estás.
 */
export function LogoMarca({
  marca,
  size = 32,
  className = "",
}: {
  marca: Marca;
  size?: number;
  className?: string;
}) {
  const logo = LOGOS[marca];
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-black shrink-0 ${className}`}
    />
  );
}
