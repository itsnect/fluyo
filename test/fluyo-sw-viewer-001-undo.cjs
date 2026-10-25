"use strict";
/* FLUYO-SW-VIEWER-001 — Deshace en un texto los cambios de esta tarea en los archivos servidos (el Viewer registra el service worker:
   registerViewerServiceWorker en viewer.js; VIEWER_ASSETS, la instalación del Viewer y las navegaciones a /s/ en sw.js); la constante
   CACHE de sw.js la resuelve cada test. Va DEBAJO de undoNarr (fluyo-product-narration-001-undo.cjs), como PRODUCT-NARRATION-001 fue
   debajo de undoI18n: los alcances de slices anteriores la reciben sin cambiar. Cada pieza se sustituye por el texto exacto de db380d3
   (la base de esta tarea). Si esta tarea cambia y esto no, los tests de alcance antiguos fallan: es lo que se quiere. El alcance de esta
   tarea lo vigila test/fluyo-sw-viewer-001.test.cjs. Las piezas son los fragmentos del diff con dos líneas de contexto. */
const BASE_SWV = "db380d3";

/* [texto de esta tarea, texto de la base]. Si el texto de esta tarea no está (otra versión del archivo), no se toca nada. */
const PIECES = {
  "js/viewer.js": [
    [
      "window.addEventListener(\"hashchange\",()=>{bootViewer();});\n\n/* FLUYO-SW-VIEWER-001: quien solo abre un enlace también tiene el enlace sin red desde su segunda apertura. Mismo service worker\n   y mismo ámbito que el editor (../sw.js, «/»); instalado desde aquí precachea solo lo del Viewer (sw.js, VIEWER_ASSETS), sin\n   gif.js ni terceros. Como en el editor (FLUYO-004): solo en http/https y tras «load», para no competir con la primera carga. */\nfunction registerViewerServiceWorker(){\n  if(location.protocol!==\"http:\" && location.protocol!==\"https:\") return;\n  if(typeof navigator===\"undefined\" || !(\"serviceWorker\" in navigator)) return;\n  const register=()=> navigator.serviceWorker.register(\"../sw.js\").catch(console.error);\n  if(document.readyState===\"complete\") register();\n  else window.addEventListener(\"load\", register, {once:true});\n}\nregisterViewerServiceWorker();\n\n/* Gancho de inspección para tests y depuración. Expone sólo estado de\n   vista; el documento se lee del modelo compartido. */\n",
      "window.addEventListener(\"hashchange\",()=>{bootViewer();});\n\n/* Gancho de inspección para tests y depuración. Expone sólo estado de\n   vista; el documento se lee del modelo compartido. */\n",
    ],
  ],
  "sw.js": [
    [
      "];\n\n/* FLUYO-SW-VIEWER-001: lo que necesita quien SOLO abre un enlace compartido (/s/#d=…) para abrirlo y reproducirlo sin red: la\n   página del Viewer, sus tres hojas de estilo, las tres tipografías que pide system.css y los scripts de s/index.html, en su\n   orden. Nada del editor, ninguna página estática y nada de terceros (sin gif.js). test/fluyo-sw-viewer-001.test.cjs exige que\n   esta lista sea exactamente lo que carga s/index.html. El documento viaja en el #d= y nunca llega aquí. */\nconst VIEWER_ASSETS = [\n  \"./s/\",\n  \"./css/identity.css\",\n  \"./css/system.css\",\n  \"./css/share.css\",\n  \"./assets/fonts/ibm-plex-mono-latin-400.woff2\",\n  \"./assets/fonts/ibm-plex-mono-latin-500.woff2\",\n  \"./assets/fonts/playfair-display-latin-400.woff2\",\n  \"./js/i18n-en.js\",\n  \"./js/i18n.js\",\n  \"./js/config.js\",\n  \"./js/safe-svg.js\",\n  \"./js/model.js\",\n  \"./js/link-codec.js\",\n  \"./js/geometry.js\",\n  \"./js/skin.js\",\n  \"./js/render.js\",\n  \"./js/scenario-engine.js\",\n  \"./js/scenario-playback.js\",\n  \"./js/story-playback.js\",\n  \"./js/story-clock.js\",\n  \"./js/flow-semantics.js\",\n  \"./js/analytics.js\",\n  \"./js/share-loader.js\",\n  \"./js/viewer-viewport.js\",\n  \"./js/viewer.js\"\n];\nconst VIEWER_PAGE = \"./s/\";\nconst viewerPath = (pathname) => {\n  const base = new URL(VIEWER_PAGE, self.location).pathname;\n  return pathname === base || pathname === base + \"index.html\";\n};\n\n/* ¿Instalación del editor? Si hay una ventana del editor abierta (quien registra es el editor, o está abierto al actualizar) o la\n   caché anterior ya tenía el editor (actualización de quien lo usa), se precachea lo de siempre. Si no, solo el Viewer. */\nfunction editorInstall() {\n  return self.clients.matchAll({ type: \"window\", includeUncontrolled: true })\n    .then((list) => list.some((c) => !viewerPath(new URL(c.url).pathname)))\n    .then((open) => open || caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE)\n      .map((k) => caches.open(k).then((c) => c.match(\"./index.html\").then((r) => !!r || c.match(\"./\").then((r2) => !!r2))))))\n      .then((had) => had.some(Boolean)));\n}\n\nself.addEventListener(\"install\", (ev) => {\n  ev.waitUntil(\n    Promise.all([caches.open(CACHE), editorInstall()])\n      .then(([cache, editor]) => editor\n        ? Promise.all([\n          cache.addAll(ASSETS),\n          cache.addAll(PAGE_ASSETS).catch((err) => console.warn(\"pages precache:\", err)),\n          cache.addAll(CDN_ASSETS).catch((err) => console.warn(\"gif.js precache:\", err))\n        ])\n        : cache.addAll(VIEWER_ASSETS))\n      .then(() => self.skipWaiting())\n  );\n",
      "];\n\nself.addEventListener(\"install\", (ev) => {\n  ev.waitUntil(\n    caches.open(CACHE)\n      .then((cache) => Promise.all([\n        cache.addAll(ASSETS),\n        cache.addAll(PAGE_ASSETS).catch((err) => console.warn(\"pages precache:\", err)),\n        cache.addAll(CDN_ASSETS).catch((err) => console.warn(\"gif.js precache:\", err))\n      ]))\n      .then(() => self.skipWaiting())\n  );\n",
    ],
    [
      "  if (url.origin !== self.location.origin) return;\n\n  /* FLUYO-SW-VIEWER-001 (D4-A): abrir /s/ con cualquier query (?lang=en, ?s=…) es la misma página del Viewer: se sirve ./s/ de la\n     caché ignorando la query (el idioma lo lee i18n.js de location.search) y, sin red, el respaldo es ./s/, nunca el editor. */\n  if (ev.request.mode === \"navigate\" && viewerPath(url.pathname)) {\n    ev.respondWith(cacheFirst(new Request(VIEWER_PAGE), VIEWER_PAGE));\n    return;\n  }\n\n  ev.respondWith(cacheFirst(ev.request, \"./index.html\"));\n});\n",
      "  if (url.origin !== self.location.origin) return;\n\n  ev.respondWith(cacheFirst(ev.request, \"./index.html\"));\n});\n",
    ],
  ],
};
function undoSwv(file, src) {
  const f = file.replace(/\\/g, "/"), pieces = PIECES[f];
  if (!pieces) return src;
  let out = src.replace(/\r\n/g, "\n");
  for (const [mine, base] of pieces) if (out.includes(mine)) out = out.replace(mine, () => base);
  return out;
}
module.exports = { undoSwv, BASE_SWV, PIECES };
