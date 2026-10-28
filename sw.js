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
const CACHE = "fluyo-static-v117";
/* Núcleo: si algo de aquí falla, la instalación falla (cache.addAll es atómico)
   y es lo correcto, porque sin estos archivos la app no funciona. */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./css/identity.css",
  "./css/system.css",
  "./css/styles.css",
  /* Tipografías del sistema visual (FLUYO-018.13): servidas desde este origen, sin terceros. */
  "./assets/fonts/ibm-plex-mono-latin-400.woff2",
  "./assets/fonts/ibm-plex-mono-latin-500.woff2",
  "./assets/fonts/playfair-display-latin-400.woff2",
  "./js/analytics.js",
  "./js/examples.js",
  "./js/deeplink.js",
  "./js/link-codec.js",
  "./js/share-url.js",
  "./js/editor-share.js",
  /* Idioma de la interfaz (FLUYO-I18N-002 S0): todos los diccionarios, comunes y del editor; cambiar de idioma no necesita red. */
  "./js/i18n-en.js",
  "./js/i18n-en-editor.js",
  "./js/i18n-fr.js",
  "./js/i18n-fr-editor.js",
  "./js/i18n-ja.js",
  "./js/i18n-ja-editor.js",
  "./js/i18n-zh.js",
  "./js/i18n-zh-editor.js",
  "./js/i18n.js",
  "./js/config.js",
  "./js/safe-svg.js",
  "./js/model.js",
  "./js/state.js",
  "./js/selection.js",
  "./js/geometry.js",
  "./js/skin.js",
  "./js/render.js",
  "./js/interaction.js",
  "./js/editor-runtime.js",
  "./js/scenario-engine.js",
  "./js/scenario-playback.js",
  "./js/story-playback.js",
  "./js/story-clock.js",
  "./js/flow-semantics.js",
  "./js/document-integrity.js",
  "./js/editor-scenarios.js",
  "./js/present-story.js",
  "./js/ui.js",
  "./js/export.js",
  "./js/editor-analytics.js",
  "./js/share-loader.js",
  "./js/viewer-viewport.js",
  "./js/viewer.js",
  /* El botón «Ejemplo» carga este JSON (FLUYO-EXAMPLES-001): obligatorio, para que siga funcionando sin red. */
  "./ejemplos/data/compra-online.fluyo.json",
  "./ejemplos/data/en/compra-online.fluyo.json"
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
  "./s/",
  "./css/share.css",
  "./ejemplos/data/funnel-de-ventas.fluyo.json",
  "./ejemplos/data/onboarding-de-cliente.fluyo.json",
  "./ejemplos/data/cadena-de-suministro.fluyo.json",
  "./ejemplos/data/kafka-event-pipeline.fluyo.json",
  "./ejemplos/data/microservicios-api-gateway.fluyo.json",
  "./ejemplos/data/oauth2-flujo-autenticacion.fluyo.json",
  "./ejemplos/data/pipeline-etl-datos.fluyo.json",
  "./ejemplos/data/arquitectura-serverless-aws.fluyo.json",
  "./ejemplos/data/inicio-de-sesion-oauth2.fluyo.json",
  "./ejemplos/data/pedido-asincrono-cola.fluyo.json",
  "./ejemplos/data/en/inicio-de-sesion-oauth2.fluyo.json",
  "./ejemplos/data/en/pedido-asincrono-cola.fluyo.json"
];
const GIF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/";
const CDN_ASSETS = [
  GIF_CDN + "gif.js",
  GIF_CDN + "gif.worker.js"
];

/* FLUYO-SW-VIEWER-001: lo que necesita quien SOLO abre un enlace compartido (/s/#d=…) para abrirlo y reproducirlo sin red: la
   página del Viewer, sus tres hojas de estilo, las tres tipografías que pide system.css y los scripts de s/index.html, en su
   orden. Nada del editor, ninguna página estática y nada de terceros (sin gif.js). test/fluyo-sw-viewer-001.test.cjs exige que
   esta lista sea exactamente lo que carga s/index.html. El documento viaja en el #d= y nunca llega aquí. */
const VIEWER_ASSETS = [
  "./s/",
  "./css/identity.css",
  "./css/system.css",
  "./css/share.css",
  "./assets/fonts/ibm-plex-mono-latin-400.woff2",
  "./assets/fonts/ibm-plex-mono-latin-500.woff2",
  "./assets/fonts/playfair-display-latin-400.woff2",
  "./js/i18n-en.js",
  "./js/i18n-fr.js",
  "./js/i18n-ja.js",
  "./js/i18n-zh.js",
  "./js/i18n.js",
  "./js/config.js",
  "./js/safe-svg.js",
  "./js/model.js",
  "./js/link-codec.js",
  "./js/geometry.js",
  "./js/skin.js",
  "./js/render.js",
  "./js/scenario-engine.js",
  "./js/scenario-playback.js",
  "./js/story-playback.js",
  "./js/story-clock.js",
  "./js/flow-semantics.js",
  "./js/analytics.js",
  "./js/share-loader.js",
  "./js/viewer-viewport.js",
  "./js/viewer.js"
];
const VIEWER_PAGE = "./s/";
const viewerPath = (pathname) => {
  const base = new URL(VIEWER_PAGE, self.location).pathname;
  return pathname === base || pathname === base + "index.html";
};

/* ¿Instalación del editor? Si hay una ventana del editor abierta (quien registra es el editor, o está abierto al actualizar) o la
   caché anterior ya tenía el editor (actualización de quien lo usa), se precachea lo de siempre. Si no, solo el Viewer. */
function editorInstall() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then((list) => list.some((c) => !viewerPath(new URL(c.url).pathname)))
    .then((open) => open || caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE)
      .map((k) => caches.open(k).then((c) => c.match("./index.html").then((r) => !!r || c.match("./").then((r2) => !!r2))))))
      .then((had) => had.some(Boolean)));
}

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    Promise.all([caches.open(CACHE), editorInstall()])
      .then(([cache, editor]) => editor
        ? Promise.all([
          cache.addAll(ASSETS),
          cache.addAll(PAGE_ASSETS).catch((err) => console.warn("pages precache:", err)),
          cache.addAll(CDN_ASSETS).catch((err) => console.warn("gif.js precache:", err))
        ])
        : cache.addAll(VIEWER_ASSETS))
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

  /* FLUYO-SW-VIEWER-001 (D4-A): abrir /s/ con cualquier query (?lang=en, ?s=…) es la misma página del Viewer: se sirve ./s/ de la
     caché ignorando la query (el idioma lo lee i18n.js de location.search) y, sin red, el respaldo es ./s/, nunca el editor. */
  if (ev.request.mode === "navigate" && viewerPath(url.pathname)) {
    ev.respondWith(cacheFirst(new Request(VIEWER_PAGE), VIEWER_PAGE));
    return;
  }

  ev.respondWith(cacheFirst(ev.request, "./index.html"));
});
