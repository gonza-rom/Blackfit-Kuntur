"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// Escaneo por cámara (no depende de un lector de QR externo tipo pistola
// USB): abre la cámara trasera, lee frame a frame con jsQR sobre un
// <canvas> oculto, y apenas encuentra un código llama a onEscaneado y se
// cierra sola. onEscaneado se ocupa de completar el buscador y disparar
// la búsqueda — este componente no sabe nada de socios ni de beneficios.
export function EscanerQR({ onEscaneado }: { onEscaneado: (codigo: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;
    let stream: MediaStream | null = null;
    let raf: number | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function loop() {
      if (cancelado) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const resultado = jsQR(imagen.data, imagen.width, imagen.height);
        if (resultado?.data) {
          cancelado = true;
          setAbierto(false);
          onEscaneado(resultado.data);
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    }

    async function iniciar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        loop();
      } catch {
        setError("No se pudo acceder a la cámara. Revisá los permisos del navegador.");
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [abierto, onEscaneado]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAbierto(true);
        }}
        aria-label="Escanear QR"
        className="shrink-0 flex items-center justify-center bg-[#262626] text-on-surface w-[46px] rounded hover:bg-[#333] transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">qr_code_scanner</span>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-5"
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative rounded-xl overflow-hidden border border-primary-container/40 aspect-square bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-8 border-2 border-primary-container/70 rounded-lg pointer-events-none" />
            </div>

            {error ? (
              <p className="text-sm text-[#ffb4ab] text-center">{error}</p>
            ) : (
              <p className="text-sm text-on-surface-variant text-center">
                Apuntá la cámara al código QR del socio
              </p>
            )}

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-full border border-outline-variant text-on-surface font-[family-name:var(--font-sora)] text-sm font-bold h-11 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
