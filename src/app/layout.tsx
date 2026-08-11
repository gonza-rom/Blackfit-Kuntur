import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Autohospedadas (en vez de next/font/google) porque Turbopack en esta
// versión de Next pide un hash de archivo fijo a fonts.gstatic.com que
// Google ya no sirve (404 permanente, no es un problema de red local).
const sora = localFont({
  variable: "--font-sora",
  display: "swap",
  src: [
    { path: "../fonts/sora-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/sora-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/sora-700.woff2", weight: "700", style: "normal" },
  ],
});

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "../fonts/inter-variable.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-variable.woff2", weight: "500", style: "normal" },
  ],
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  display: "swap",
  src: [
    { path: "../fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "BLACK HUB",
  description: "Entrá al Hub. El rendimiento elite empieza acá.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${sora.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-black font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}