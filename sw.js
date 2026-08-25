/* IMPORTANTE: subir esta versión en cualquier PR que toque un archivo servido.
   CUALQUIERA: añadirlo, quitarlo, renombrarlo O CAMBIAR SU CONTENIDO.

   El fetch handler es cache-first y `activate` solo borra las cachés cuyo nombre
   no coincide con CACHE, así que mientras el nombre no cambie NADA se revalida:
   quien ya tenga el service worker instalado seguirá ejecutando los js/*.js de la
   versión anterior indefinidamente, aunque en el servidor estén los nuevos.

   No es hipotético. `test/editor-inline.html` dio rojo en su primera ejecución
   sobre un bug de Escape que en disco YA estaba arreglado: el service worker le
   estaba sirviendo al iframe una copia vieja de js/interaction.js. Por eso ese
   test ahora desregistra el SW antes de cargar nada — y por eso esta versión
   sube también cuando solo cambia el contenido. */
const CACHE = "fluyo-static-v14";
/* Núcleo: si algo de aquí falla, la instalación falla (cache.addAll es atómico)
   y es lo correcto, porque sin estos archivos la app no funciona. */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./css/styles.css",
  "./js/analytics.js",
  "./js/examples.js",
  "./js/config.js",
  "./js/state.js",
  "./js/selection.js",
  "./js/geometry.js",
  "./js/render.js",
  "./js/interaction.js",
  "./js/ui.js",
  "./js/export.js"
];
/* Páginas estáticas y ejemplos: se cachean si se puede, pero su fallo no debe
   tumbar la instalación — el editor funciona perfectamente sin ellos. */
const PAGE_ASSETS = [
  "./css/pages.css",
  "./docs/",
  "./ejemplos/",
  "./privacidad/",
  "./privacy/",
  "./terminos/",
  "./terms/",
  "./soporte/",
  "./support/",
  "./ejemplos/data/kafka-event-pipeline.fluyo.json",
  "./ejemplos/data/microservicios-api-gateway.fluyo.json",
  "./ejemplos/data/oauth2-flujo-autenticacion.fluyo.json",
  "./ejemplos/data/pipeline-etl-datos.fluyo.json",
  "./ejemplos/data/arquitectura-serverless-aws.fluyo.json"
];
const GIF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/";
const CDN_ASSETS = [
  GIF_CDN + "gif.js",
  GIF_CDN + "gif.worker.js"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all([
        cache.addAll(ASSETS),
        cache.addAll(PAGE_ASSETS).catch((err) => console.warn("pages precache:", err)),
        cache.addAll(CDN_ASSETS).catch((err) => console.warn("gif.js precache:", err))
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(request, fallback) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((resp) => {
      if (resp.ok) {
        caches.open(CACHE).then((cache) => cache.put(request, resp.clone()));
      }
      return resp;
    }).catch(() => fallback ? caches.match(fallback) : undefined);
  });
}

self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET") return;
  const url = new URL(ev.request.url);

  if (url.href.startsWith(GIF_CDN)) {
    ev.respondWith(cacheFirst(ev.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  ev.respondWith(cacheFirst(ev.request, "./index.html"));
});
