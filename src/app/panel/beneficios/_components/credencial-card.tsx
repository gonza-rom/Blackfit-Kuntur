import QRCode from "qrcode";

export async function CredencialCard({
  nombreCompleto,
  numeroSocio,
  membresiaActiva,
  codigoQrToken,
}: {
  nombreCompleto: string;
  numeroSocio: string;
  membresiaActiva: boolean;
  codigoQrToken: string;
}) {
  const qrSvg = await QRCode.toString(codigoQrToken, {
    type: "svg",
    margin: 0,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  return (
    <div className="bg-[#1a1a1a] border border-primary-container rounded-lg p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-outline-variant/10 pointer-events-none" />
      <div className="w-full flex justify-between items-start mb-auto z-10">
        <div className="flex flex-col">
          <span className="font-[family-name:var(--font-sora)] text-[20px] leading-tight font-bold text-on-surface">
            {nombreCompleto}
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] tracking-[0.08em] text-[#c8c6c5]">
            SOCIO #{numeroSocio}
          </span>
        </div>
        <div className="border border-primary-container rounded-full px-2 py-1 flex items-center gap-1 bg-background/50 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-primary-container">
            {membresiaActiva ? "ACTIVA" : "SIN MEMBRESÍA"}
          </span>
        </div>
      </div>
      <div className="bg-white p-2 rounded-lg border border-outline-variant mt-4 z-10 flex items-center justify-center w-[144px] h-[144px]">
        <div
          className="w-32 h-32"
          // El SVG viene de la librería `qrcode`, generado a partir del
          // token opaco `codigo_qr_token` del usuario — no de HTML externo.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>
    </div>
  );
}
