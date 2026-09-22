// Convierte un link de YouTube, Vimeo o Google Drive (los que carga el
// coach en video_url del ejercicio) a su URL de embed. Si no reconoce el
// formato, devuelve null y quien llama cae a un link "Abrir video" en vez
// de un reproductor incrustado.
export function urlEmbedVideo(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.pathname.startsWith("/embed/")) return u.toString();
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/")[2];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  }

  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "player.vimeo.com") return u.toString();

  if (host === "drive.google.com") {
    // Formatos típicos: /file/d/<id>/view y /open?id=<id>. El embed de
    // Drive necesita /preview, no el link normal de "ver".
    const match = u.pathname.match(/\/file\/d\/([^/]+)/);
    const id = match ? match[1] : u.searchParams.get("id");
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }

  return null;
}
