const CACHE_NAME = "portal-dma-v1";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./css/global.css",
  "./css/home.css",
  "./js/home.js",
  "./manifest.json",
  "./recicla.html",
  "./css/recicla.css",
  "./js/recicla.js",
  "./data/recicla-pagina.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});