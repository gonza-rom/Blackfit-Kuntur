"use client";

import { useEffect } from "react";
import { urlEmbedVideo } from "@/lib/video";

export type EjercicioDetalle = {
  id_ejercicio: string;
  nombre: string;
  grupo_muscular: string | null;
  descripcion: string | null;
  instrucciones: string | null;
  video_url: string | null;
};

export function ModalVideoEjercicio({
  ejercicio,
  onClose,
}: {
  ejercicio: EjercicioDetalle;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const embed = ejercicio.video_url ? urlEmbedVideo(ejercicio.video_url) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-video-titulo"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-[#131313] border border-[#262626] rounded-t-2xl sm:rounded-2xl flex flex-col"
      >
        {embed ? (
          <div className="w-full aspect-video bg-black shrink-0">
            <iframe
              src={embed}
              title={ejercicio.nombre}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ) : ejercicio.video_url ? (
          <a
            href={ejercicio.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 aspect-video bg-[#1A1A1A] text-primary-container text-sm font-[family-name:var(--font-sora)] font-bold shrink-0"
          >
            <span className="material-symbols-outlined">open_in_new</span>
            Abrir video
          </a>
        ) : (
          <div className="flex items-center justify-center aspect-video bg-[#1A1A1A] text-on-surface-variant text-sm shrink-0">
            Tu coach todavía no cargó un video para este ejercicio.
          </div>
        )}

        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="modal-video-titulo"
                className="font-[family-name:var(--font-sora)] text-lg font-bold text-on-surface"
              >
                {ejercicio.nombre}
              </h2>
              {ejercicio.grupo_muscular && (
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-primary-container uppercase mt-0.5">
                  {ejercicio.grupo_muscular}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {ejercicio.descripcion && (
            <p className="text-sm text-on-surface-variant">{ejercicio.descripcion}</p>
          )}

          {ejercicio.instrucciones && (
            <div className="flex flex-col gap-1">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-[0.08em] text-on-surface-variant uppercase">
                Puntos clave de ejecución
              </span>
              <p className="text-sm text-on-surface whitespace-pre-wrap">
                {ejercicio.instrucciones}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
