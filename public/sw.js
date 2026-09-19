const CACHE = "black-hub-v2";
const APP_SHELL = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Solo cachea assets estáticos reales (JS/CSS de _next/static, íconos,
// manifest) — nunca navegaciones de documento ni los fetches internos del
// App Router (RSC, Server Actions, prefetch: headers "RSC",
// "Next-Router-State-Tree", "Next-Action"). Esas rutas llevan headers que
// esta cache no distingue (la Cache API matchea por URL, no por header) —
// si se les sirve una respuesta vieja cacheada bajo la misma URL, React
// recibe un payload RSC corrupto y tira "An unexpected response was
// received from the server" o "enqueueModel is not a function". Los datos
// "en vivo" (entrenamientos, mensajes, etc.) siguen viniendo del servidor;
// el modo offline real de escritura lo maneja la cola en
// src/lib/offline-queue.ts, no este worker.
function esAssetEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.mode === "navigate") return;
  if (
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Action") ||
    request.headers.get("purpose") === "prefetch"
  ) {
    return;
  }
  if (!esAssetEstatico(new URL(request.url))) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copia));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ── PUSH NOTIFICATIONS ─────────────────────────────────────────
// El payload lo arma src/lib/push.ts como JSON: { titulo, contenido, url, tipo }.
self.addEventListener("push", (event) => {
  let datos = { titulo: "BLACK HUB", contenido: "Tenés una novedad.", url: "/panel/notificaciones" };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    // payload no-JSON (no debería pasar, pero no rompe el listener)
  }

  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.contenido,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: datos.url || "/panel/notificaciones" },
      tag: datos.tipo || "black-hub",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/panel/notificaciones";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
