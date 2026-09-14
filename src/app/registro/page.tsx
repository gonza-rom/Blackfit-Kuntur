import Link from "next/link";
import { FormRegistro } from "./_components/form-registro";

export default function RegistroPage() {
  return (
    <div className="min-h-dvh flex flex-1 items-center justify-center bg-black overflow-hidden relative py-16">
      {/* Imagen de fondo */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div
          className="bg-cover bg-center w-full h-full grayscale"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBFiaK9m-neRJTBX2yG7k2e9vcyr6XaVXEDGZxz13GKOcgZKgRNLkFvQEE-1Imy347l-S0h8ncysjWfY9FzxehyRl340l9Qr1k5-UVR5PtqqXyu4fjXgzaC0dIkTNOTblNzJdhtUOrvMBC4HXo2XssMhocEAxgNOtDUwjdKtpTZuRx2F44VARETO3QIJwXLL5KBsmJ4fIrF679yh16g3gxHidAJpfaZJxZ95B7kEluxm2905F1emDs')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black" />
      </div>

      {/* Contenido principal */}
      <main className="relative z-10 w-full max-w-md px-5 md:px-0">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-sora)] text-[36px] leading-[42px] tracking-[-0.02em] font-bold text-primary-container mb-2 md:text-[48px] md:leading-[56px]">
            BLACK HUB
          </h1>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] leading-4 tracking-[0.2em] text-on-surface-variant uppercase">
            UNITE AL HUB. TU RENDIMIENTO ELITE EMPIEZA ACÁ.
          </p>
        </div>

        <div className="bg-[#1A1A1A]/80 backdrop-blur-xl border border-[#262626] rounded-xl p-4 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <FormRegistro tipo="alumno" />
        </div>

        <div className="mt-8 text-center flex flex-col gap-2">
          <p className="font-[family-name:var(--font-inter)] text-base text-on-surface-variant">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="text-primary-container font-semibold hover:underline underline-offset-4 transition-all"
            >
              Iniciá sesión
            </Link>
          </p>
          <p className="font-[family-name:var(--font-inter)] text-sm text-on-surface-variant">
            ¿Solo querés los beneficios Kuntur?{" "}
            <Link
              href="/registro/beneficiario"
              className="text-primary-container font-semibold hover:underline underline-offset-4 transition-all"
            >
              Registrate como beneficiario
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
