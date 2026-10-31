"use strict";
/* FLUYO-GROWTH-FOUNDATION-001 — Deshace en un texto los cambios de esta tarea en los archivos servidos. La constante CACHE de sw.js
   la resuelve cada test. Es la última de la cadena: undoOutcome (fluyo-stories-2-0-outcome-undo.cjs) la llama la primera, así los
   alcances de slices anteriores la reciben sin cambiar.
   Cada pieza se sustituye por el texto exacto de la base de esta tarea (Stories 2.0 cerrada, d7e1177). Generado del diff con dos
   líneas de contexto (más si no bastan para que la pieza sea única). */
const BASE_GF = "d7e1177";
/* Archivos servidos nuevos de esta tarea: en la base no existen. */
const NEW_FILES = ["js/entry.js"];

/* [texto de esta tarea, texto de la base]. Si el texto de esta tarea no está (otra versión del archivo), no se toca nada. */
const PIECES = {
  "404.html": [
    [
      "    <p data-i18n=\"shell.license\">Fluyo · software libre, licencia MIT</p>\n    <nav aria-label=\"Legal y proyecto\" data-i18n-aria-label=\"shell.legal\">\n      <a href=\"/privacidad/\" data-i18n=\"shell.privacy\" data-i18n-link=\"shell.privacyPath\">Privacidad</a>\n      <a href=\"/terminos/\" data-i18n=\"shell.terms\" data-i18n-link=\"shell.termsPath\">Términos</a>\n      <a href=\"/soporte/\" data-i18n=\"shell.support\" data-i18n-link=\"shell.supportPath\">Soporte</a>\n      <a href=\"https://github.com/itsnect/fluyo\" target=\"_blank\" rel=\"noopener\">GitHub<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://github.com/itsnect/fluyo-mcp\" target=\"_blank\" rel=\"noopener\">MCP<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n",
      "    <p data-i18n=\"shell.license\">Fluyo · software libre, licencia MIT</p>\n    <nav aria-label=\"Legal y proyecto\" data-i18n-aria-label=\"shell.legal\">\n      <a href=\"/privacidad/\" data-i18n=\"shell.privacy\">Privacidad</a>\n      <a href=\"/terminos/\" data-i18n=\"shell.terms\">Términos</a>\n      <a href=\"/soporte/\" data-i18n=\"shell.support\">Soporte</a>\n      <a href=\"https://github.com/itsnect/fluyo\" target=\"_blank\" rel=\"noopener\">GitHub<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://github.com/itsnect/fluyo-mcp\" target=\"_blank\" rel=\"noopener\">MCP<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n"
    ]
  ],
  "css/styles.css": [
    [
      ".scNowProgress{flex:none; font:500 var(--fs-label)/1 var(--font-mono); color:rgba(242,237,227,.62); letter-spacing:.04em; font-variant-numeric:tabular-nums;}\n.scNowProgress:empty{display:none;}\n/* FLUYO-GROWTH-FOUNDATION-001 — La entrada del primer minuto (js/entry.js). Una tarjeta de papel en el centro del lienzo vacío,\n   del mismo material que los modales (.card) pero sin velo ni bloqueo: el lienzo sigue a la vista y tocarlo la cierra. Dos\n   salidas apiladas, cada una con su línea de qué pasa al elegirla; la de «ver en marcha» es la destacada (button.primary). */\n.entryCard{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:7; box-sizing:border-box;\n  width:min(400px, calc(100% - 32px)); padding:22px 22px 20px; background:var(--surface); color:var(--ink);\n  border:1px solid var(--rule-2); border-radius:var(--r-lg); box-shadow:var(--shadow-menu);}\n.entryCard[hidden]{display:none;}\n.entryTitle{font:400 21px/1.25 var(--font-serif); color:var(--ink); margin:0 0 16px;}\n.entryActions{display:flex; flex-direction:column; gap:8px;}\n.entryOpt{display:flex; flex-direction:column; align-items:flex-start; gap:4px; width:100%; height:auto; min-height:var(--ctl-h-touch, 44px);\n  padding:10px 14px; text-align:left; white-space:normal;}\n.entryLbl{font:500 var(--fs-ui)/1.25 var(--font-mono);}\n.entrySub{font:400 var(--fs-label)/1.4 var(--font-mono); opacity:.78;}\n.entryOpt:not(.primary) .entrySub{color:var(--ink-3); opacity:1;}\nbody.presenting .entryCard{display:none;}\n/* en el teléfono el momento manda: el estado queda como el punto (vivo / quieto en pausa; el botón ya dice Pausar o Reanudar)\n   y su texto, para lectores de pantalla */\n",
      ".scNowProgress{flex:none; font:500 var(--fs-label)/1 var(--font-mono); color:rgba(242,237,227,.62); letter-spacing:.04em; font-variant-numeric:tabular-nums;}\n.scNowProgress:empty{display:none;}\n/* en el teléfono el momento manda: el estado queda como el punto (vivo / quieto en pausa; el botón ya dice Pausar o Reanudar)\n   y su texto, para lectores de pantalla */\n"
    ]
  ],
  "index.html": [
    [
      "<meta name=\"referrer\" content=\"no-referrer\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title data-i18n=\"editor.docTitle\">Fluyo — editor de diagramas de arquitectura animados con export a GIF</title>\n<meta name=\"description\" content=\"Dibuja diagramas de arquitectura con flujo animado y expórtalos a GIF, PNG, JPG o SVG. Gratis, sin cuenta y sin backend: todo corre en tu navegador.\">\n<link rel=\"canonical\" href=\"https://fluyo.space/\">\n",
      "<meta name=\"referrer\" content=\"no-referrer\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Fluyo — editor de diagramas de arquitectura animados con export a GIF</title>\n<meta name=\"description\" content=\"Dibuja diagramas de arquitectura con flujo animado y expórtalos a GIF, PNG, JPG o SVG. Gratis, sin cuenta y sin backend: todo corre en tu navegador.\">\n<link rel=\"canonical\" href=\"https://fluyo.space/\">\n"
    ],
    [
      "        <div class=\"pgBody\">\n      <ul class=\"helpList\">\n        <li data-i18n=\"help.addShape\">Forma del menú izquierdo → clic en el lienzo.</li>\n        <li data-i18n-rich=\"help.wheel\"><kbd>Rueda ratón</kbd> mover · <kbd>Ctrl+Rueda</kbd> zoom.</li>\n        <li data-i18n-rich=\"help.pan\"><kbd>Clic derecho</kbd>, <kbd>Clic central</kbd> o <kbd>Alt+Arrastrar</kbd> para pan.</li>\n        <li data-i18n-rich=\"help.touch\">Táctil: <b>un dedo</b> mueve el plano, <b>dos dedos</b> hacen zoom, doble toque edita.</li>\n        <li data-i18n-rich=\"help.connect\">Pasa el ratón sobre un nodo y <b>arrastra el punto</b> que aparece en el lado más cercano para conectar.</li>\n        <li data-i18n-rich=\"help.multiSelect\"><b>Arrastra en el vacío</b> para seleccionar varios; <kbd>Shift</kbd>+clic suma o quita.</li>\n        <li data-i18n-rich=\"help.clipboard\"><kbd>Ctrl+C</kbd> copiar · <kbd>Ctrl+X</kbd> cortar · <kbd>Ctrl+V</kbd> pegar · <kbd>Ctrl+D</kbd> duplicar · <kbd>Ctrl+A</kbd> todo.</li>\n        <li data-i18n-rich=\"help.history\"><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+Y</kbd> rehacer (o las flechas de la cabecera).</li>\n        <li data-i18n-rich=\"help.edit\">Doble clic = editar texto. <kbd>Supr</kbd> borra, o la <b>papelera</b> de la cabecera del panel. <kbd>Esc</kbd> cancela.</li>\n        <li data-i18n-rich=\"help.touchBar\">Táctil: con algo seleccionado salen <b>Conectar</b> y <b>Seleccionar varios</b> arriba y la <b>papelera</b> abajo. Toca la pestaña activa para renombrar la página.</li>\n        <li data-i18n-rich=\"help.present\"><kbd>P</kbd> presenta a pantalla completa; <kbd>←</kbd> <kbd>→</kbd> cambian de página.</li>\n        <li data-i18n-rich=\"help.arrowHandles\">Con una flecha seleccionada, arrastra sus <b>extremos</b> (círculos) para cambiar de lado o de forma, sus <b>codos</b> (cuadrados) y las <b>barras</b> de cada tramo para deslizar un tramo; doble clic en un codo lo elimina.</li>\n        <li data-i18n-rich=\"help.reroute\"><kbd>R</kbd> devuelve una flecha a su <b>ruta automática</b>, deshaciendo los tramos que hayas movido.</li>\n      </ul>\n        </div>\n",
      "        <div class=\"pgBody\">\n      <ul class=\"helpList\">\n        <li>Forma del menú izquierdo → clic en el lienzo.</li>\n        <li><kbd>Rueda ratón</kbd> mover · <kbd>Ctrl+Rueda</kbd> zoom.</li>\n        <li><kbd>Clic derecho</kbd>, <kbd>Clic central</kbd> o <kbd>Alt+Arrastrar</kbd> para pan.</li>\n        <li>Táctil: <b>un dedo</b> mueve el plano, <b>dos dedos</b> hacen zoom, doble toque edita.</li>\n        <li>Pasa el ratón sobre un nodo y <b>arrastra el punto</b> que aparece en el lado más cercano para conectar.</li>\n        <li><b>Arrastra en el vacío</b> para seleccionar varios; <kbd>Shift</kbd>+clic suma o quita.</li>\n        <li><kbd>Ctrl+C</kbd> copiar · <kbd>Ctrl+X</kbd> cortar · <kbd>Ctrl+V</kbd> pegar · <kbd>Ctrl+D</kbd> duplicar · <kbd>Ctrl+A</kbd> todo.</li>\n        <li><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+Y</kbd> rehacer (o las flechas de la cabecera).</li>\n        <li>Doble clic = editar texto. <kbd>Supr</kbd> borra, o la <b>papelera</b> de la cabecera del panel. <kbd>Esc</kbd> cancela.</li>\n        <li>Táctil: con algo seleccionado salen <b>Conectar</b> y <b>Seleccionar varios</b> arriba y la <b>papelera</b> abajo. Toca la pestaña activa para renombrar la página.</li>\n        <li><kbd>P</kbd> presenta a pantalla completa; <kbd>←</kbd> <kbd>→</kbd> cambian de página.</li>\n        <li>Con una flecha seleccionada, arrastra sus <b>extremos</b> (círculos) para cambiar de lado o de forma, sus <b>codos</b> (cuadrados) y las <b>barras</b> de cada tramo para deslizar un tramo; doble clic en un codo lo elimina.</li>\n        <li><kbd>R</kbd> devuelve una flecha a su <b>ruta automática</b>, deshaciendo los tramos que hayas movido.</li>\n      </ul>\n        </div>\n"
    ],
    [
      "        <a class=\"menuItem\" href=\"docs/\" data-i18n=\"shell.docs\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-book\"/></svg>Docs</a>\n        <a class=\"menuItem\" href=\"ejemplos/\" data-i18n=\"shell.examples\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-layers\"/></svg>Ejemplos</a>\n        <a class=\"menuItem\" href=\"privacidad/\" data-i18n=\"shell.privacy\" data-i18n-link=\"more.privacyHref\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-shield\"/></svg>Privacidad</a>\n        <a class=\"menuItem\" href=\"soporte/\" data-i18n=\"shell.support\" data-i18n-link=\"more.supportHref\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-help\"/></svg>Soporte</a>\n      </nav>\n      <a class=\"menuItem ossLink\" href=\"https://github.com/itsnect/fluyo\" target=\"_blank\" rel=\"noopener\">\n",
      "        <a class=\"menuItem\" href=\"docs/\" data-i18n=\"shell.docs\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-book\"/></svg>Docs</a>\n        <a class=\"menuItem\" href=\"ejemplos/\" data-i18n=\"shell.examples\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-layers\"/></svg>Ejemplos</a>\n        <a class=\"menuItem\" href=\"privacidad/\" data-i18n=\"shell.privacy\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-shield\"/></svg>Privacidad</a>\n        <a class=\"menuItem\" href=\"soporte/\" data-i18n=\"shell.support\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-help\"/></svg>Soporte</a>\n      </nav>\n      <a class=\"menuItem ossLink\" href=\"https://github.com/itsnect/fluyo\" target=\"_blank\" rel=\"noopener\">\n"
    ],
    [
      "        <span id=\"scNowProgress\" class=\"scNowProgress\"></span>\n      </div>\n      <!-- FLUYO-GROWTH-FOUNDATION-001: la entrada del primer minuto, solo para un navegador que nunca abrió Fluyo y sin documento\n           en la URL (js/entry.js). Sobre el lienzo vacío y sin bloquearlo: Escape o tocar el lienzo la cierran. -->\n      <section id=\"entryCard\" class=\"entryCard\" aria-labelledby=\"entryTitle\" hidden>\n        <h2 id=\"entryTitle\" class=\"entryTitle\" data-i18n=\"entry.title\">Explica tu sistema, no solo lo dibujes.</h2>\n        <div class=\"entryActions\">\n          <button id=\"entryExplore\" class=\"primary entryOpt\" type=\"button\"><span class=\"entryLbl\" data-i18n=\"entry.explore\">Ver un sistema en marcha</span><span class=\"entrySub\" data-i18n=\"entry.exploreSub\">Una compra online, contada paso a paso.</span></button>\n          <button id=\"entryBlank\" class=\"entryOpt\" type=\"button\"><span class=\"entryLbl\" data-i18n=\"entry.blank\">Empezar en blanco</span><span class=\"entrySub\" data-i18n=\"entry.blankSub\">Dibuja tu sistema y cuenta qué pasa.</span></button>\n        </div>\n      </section>\n    </div>\n    <div id=\"iconDrawer\" role=\"dialog\" aria-label=\"Iconos\" data-i18n-aria-label=\"rail.icons\"></div>\n",
      "        <span id=\"scNowProgress\" class=\"scNowProgress\"></span>\n      </div>\n    </div>\n    <div id=\"iconDrawer\" role=\"dialog\" aria-label=\"Iconos\" data-i18n-aria-label=\"rail.icons\"></div>\n"
    ],
    [
      "<script src=\"js/share-url.js\"></script>\n<script src=\"js/editor-share.js\"></script>\n<script src=\"js/entry.js\"></script>\n</body>\n</html>\n",
      "<script src=\"js/share-url.js\"></script>\n<script src=\"js/editor-share.js\"></script>\n</body>\n</html>\n"
    ]
  ],
  "js/analytics.js": [
    [
      "   `share_viewed` y `share_opened_in_editor` se emiten desde el viewer de /s/\n   (js/viewer.js): sin propiedades, sin ID, sin URL, sin nada del documento.\n   `share_created` se emite tras generar una URL válida en el editor.\n\n   FLUYO-GROWTH-FOUNDATION-001: ningún nombre cambia (las series siguen); se añaden propiedades enumeradas y los eventos de la\n   Historia y de la entrada. `editor_opened` hace de «app abierta» y `share_viewed` de «viewer abierto». Una propiedad fuera de\n   su lista descarta el evento ENTERO: por eso `locale` pasa siempre por analyticsLocale(). */\nconst YES_NO = [\"yes\",\"no\"];\nconst ANALYTICS_LOCALES = [\"es\",\"en\",\"fr\",\"ja\",\"zh\",\"other\"];\nconst ANALYTICS_EVENTS = {\n  editor_opened:{entry:[\"direct\",\"example\",\"link\"], returning:YES_NO, locale:ANALYTICS_LOCALES},\n  first_edit_completed:{}, diagram_created:{},\n  diagram_saved:{format:[\"fluyo_json\"]}, present_started:{},\n  diagram_exported:{format:[\"png\",\"jpg\",\"svg\",\"gif\"]},\n  file_imported:{source:[\"file\",\"link\"],format:[\"fluyo_json\"]},\n  example_loaded:{example:[\"demo\",\"compra-online\",\"inicio-de-sesion-oauth2\",\"pedido-asincrono-cola\",\"funnel-de-ventas\",\"onboarding-de-cliente\",\"cadena-de-suministro\",\"kafka-event-pipeline\",\"microservicios-api-gateway\",\"oauth2-flujo-autenticacion\",\"pipeline-etl-datos\",\"arquitectura-serverless-aws\"],\n    source:[\"url\",\"menu\",\"entry\"]},\n  gif_animation_added:{anim:[\"spinner\",\"progress\",\"ticket\",\"errmove\",\"check\",\"typing\",\"upload\",\"pulse\"]},\n  link_failed:{reason:[\"decode\",\"schema\",\"too_large\",\"unsupported\"]},\n  share_created:{kind:[\"story\",\"diagram\"], variants:YES_NO},\n  share_viewed:{story:YES_NO, locale:ANALYTICS_LOCALES},\n  share_opened_in_editor:{},\n  entry_chosen:{choice:[\"explore\",\"blank\",\"dismiss\"]},\n  story_created:{origin:[\"new\",\"variant\",\"copy\"]},\n  story_started:{surface:[\"editor\",\"present\"], trigger:[\"user\",\"entry\"]},\n  story_completed:{surface:[\"editor\",\"present\"]},\n  viewer_story_started:{}, viewer_story_completed:{}\n};\n/* El idioma de la interfaz de esta carga, reducido a la lista cerrada (nunca el del navegador ni el del documento). */\nfunction analyticsLocale(){\n  try{\n    const l=typeof FluyoI18n===\"object\" ? FluyoI18n.locale() : \"es\";\n    return ANALYTICS_LOCALES.includes(l) ? l : \"other\";\n  }catch(e){ return \"other\"; }\n}\nfunction analyticsProps(name, props={}){\n  if(!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS,name)) return null;\n",
      "   `share_viewed` y `share_opened_in_editor` se emiten desde el viewer de /s/\n   (js/viewer.js): sin propiedades, sin ID, sin URL, sin nada del documento.\n   `share_created` se emite tras generar una URL válida en el editor. */\nconst ANALYTICS_EVENTS = {\n  editor_opened:{}, first_edit_completed:{}, diagram_created:{},\n  diagram_saved:{format:[\"fluyo_json\"]}, present_started:{},\n  diagram_exported:{format:[\"png\",\"jpg\",\"svg\",\"gif\"]},\n  file_imported:{source:[\"file\",\"link\"],format:[\"fluyo_json\"]},\n  example_loaded:{example:[\"demo\",\"compra-online\",\"inicio-de-sesion-oauth2\",\"pedido-asincrono-cola\",\"funnel-de-ventas\",\"onboarding-de-cliente\",\"cadena-de-suministro\",\"kafka-event-pipeline\",\"microservicios-api-gateway\",\"oauth2-flujo-autenticacion\",\"pipeline-etl-datos\",\"arquitectura-serverless-aws\"]},\n  gif_animation_added:{anim:[\"spinner\",\"progress\",\"ticket\",\"errmove\",\"check\",\"typing\",\"upload\",\"pulse\"]},\n  link_failed:{reason:[\"decode\",\"schema\",\"too_large\",\"unsupported\"]},\n  share_created:{}, share_viewed:{}, share_opened_in_editor:{}\n};\nfunction analyticsProps(name, props={}){\n  if(!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS,name)) return null;\n"
    ]
  ],
  "js/editor-analytics.js": [
    [
      "  analyticsEditTimer=setTimeout(checkAnalyticsEdit,0);\n}\n/* FLUYO-GROWTH-FOUNDATION-001: por dónde entró esta carga (sin la URL: solo si traía ejemplo o enlace), si este navegador ya\n   había abierto Fluyo (js/entry.js; nunca un identificador) y el idioma de la interfaz. */\nfunction editorOpenedProps(){\n  const entry=(typeof EXAMPLE_SLUG!==\"undefined\" && EXAMPLE_SLUG) ? \"example\"\n    : (typeof DEEP_LINK_PAYLOAD!==\"undefined\" && DEEP_LINK_PAYLOAD) ? \"link\" : \"direct\";\n  const returning=(typeof ENTRY_STATE===\"object\" && ENTRY_STATE && ENTRY_STATE.returning) ? \"yes\" : \"no\";\n  return {entry, returning, locale:analyticsLocale()};\n}\ndocument.addEventListener(\"DOMContentLoaded\",()=>{\n  if(!document.getElementById(\"cv\")) return;\n  resetAnalyticsBaseline();\n  trackEvent(\"editor_opened\", editorOpenedProps());\n},{once:true});\n",
      "  analyticsEditTimer=setTimeout(checkAnalyticsEdit,0);\n}\ndocument.addEventListener(\"DOMContentLoaded\",()=>{\n  if(!document.getElementById(\"cv\")) return;\n  resetAnalyticsBaseline();\n  trackEvent(\"editor_opened\");\n},{once:true});\n"
    ]
  ],
  "js/editor-runtime.js": [
    [
      "function renderEditorFrame(){\n  resizeEditorCanvas();\n  /* FLUYO-I18N-002 S1: la pista del lienzo vacío, en el idioma de la interfaz (render.js conserva el español por defecto).\n     FLUYO-GROWTH-FOUNDATION-001: con la tarjeta de entrada abierta (entry.js) el lienzo no dice nada: habla la tarjeta.\n     La pista es neutral (PO): no nombra «Ejemplo», «⋯» ni «la izquierda», que no valen en todas las disposiciones. */\n  if(typeof entryTick===\"function\") entryTick();\n  const frame={renderState:buildEditorRenderState(), emptyHint:typeof FluyoI18n===\"object\" ? FluyoI18n.t(\"editor.emptyCanvas\",\"Empieza añadiendo elementos al lienzo.\") : undefined};\n  if(typeof entryVisible===\"function\" && entryVisible()) frame.emptyHint=\"\";\n  render(ctx,now(),frame);\n  /* El textarea de edición vive en el DOM, fuera del canvas. */\n  if(typeof syncEditBoxIfMoved===\"function\") syncEditBoxIfMoved();\n",
      "function renderEditorFrame(){\n  resizeEditorCanvas();\n  /* FLUYO-I18N-002 S1: la pista del lienzo vacío, en el idioma de la interfaz (render.js conserva el español por defecto) */\n  render(ctx,now(),{renderState:buildEditorRenderState(), emptyHint:typeof FluyoI18n===\"object\" ? FluyoI18n.t(\"editor.emptyCanvas\",\"Elige una forma o icono a la izquierda y haz clic aquí — o pulsa «Ejemplo»\") : undefined});\n  /* El textarea de edición vive en el DOM, fuera del canvas. */\n  if(typeof syncEditBoxIfMoved===\"function\") syncEditBoxIfMoved();\n"
    ]
  ],
  "js/editor-scenarios.js": [
    [
      "  scRenderPanel();\n  scNotice(FluyoI18n.t(\"stories.created\", \"{name} creada\", { name: sc.name }));\n  scTrack(\"story_created\", { origin: \"new\" });\n  scBeginInlineName(true);\n}\n",
      "  scRenderPanel();\n  scNotice(FluyoI18n.t(\"stories.created\", \"{name} creada\", { name: sc.name }));\n  scBeginInlineName(true);\n}\n"
    ],
    [
      "  scRenderPanel();\n  scNotice(FluyoI18n.t(\"stories.duplicated\", \"Historia duplicada: {name}\", { name: copy.name }));\n  scTrack(\"story_created\", { origin: \"copy\" });\n}\n\n",
      "  scRenderPanel();\n  scNotice(FluyoI18n.t(\"stories.duplicated\", \"Historia duplicada: {name}\", { name: copy.name }));\n}\n\n"
    ],
    [
      "  scCommit();\n  scScrollIntoView($(\"scStoryboard\")?.querySelector?.('[data-step-id=\"' + step.id + '\"]'));\n  if (created) {\n    scNotice(FluyoI18n.t(\"stories.created\", \"{name} creada\", { name: sc.name }));\n    scTrack(\"story_created\", { origin: \"new\" });\n  }\n  return step;\n}\n",
      "  scCommit();\n  scScrollIntoView($(\"scStoryboard\")?.querySelector?.('[data-step-id=\"' + step.id + '\"]'));\n  if (created) scNotice(FluyoI18n.t(\"stories.created\", \"{name} creada\", { name: sc.name }));\n  return step;\n}\n"
    ],
    [
      "}\n\n/* FLUYO-GROWTH-FOUNDATION-001: los eventos de la Historia (js/analytics.js, lista cerrada; nada del documento). Sin transporte\n   cargado (los arneses vm, el MCP) no se mide nada. */\nfunction scTrack(name, props) {\n  if (typeof trackEvent === \"function\") trackEvent(name, props);\n}\n/* Dónde se reproduce la ejecución en curso y si ya contó su final (story_completed, una vez por reproducción aunque después se\n   salte atrás y vuelva a terminar). */\nlet scRunSurface = null,\n  scRunCounted = false;\nfunction scRun(opts) {\n  /* opts.present: Present reproduce con este mismo motor sin tocar el panel del editor.\n     opts.trigger: \"entry\" cuando la arranca la tarjeta de entrada (entry.js), no un clic en «Reproducir». */\n  const inPresent = !!(opts && opts.present);\n  if (scStatus === \"running\") return;\n",
      "}\n\nfunction scRun(opts) {\n  /* opts.present: Present reproduce con este mismo motor sin tocar el panel del editor. */\n  const inPresent = !!(opts && opts.present);\n  if (scStatus === \"running\") return;\n"
    ],
    [
      "  scStatus = \"running\";\n  scFollowedStep = null;\n  scRunSurface = inPresent ? \"present\" : \"editor\";\n  scRunCounted = false;\n  scTrack(\"story_started\", { surface: scRunSurface, trigger: opts && opts.trigger === \"entry\" ? \"entry\" : \"user\" });\n  /* FLUYO-018.14b: reproducir es del modo Historia (B1); la salida «Editar»/«Volver a editar» nunca se bloquea (B3). */\n  if (!inPresent && typeof switchPanelTab === \"function\") switchPanelTab(\"scenarios\");\n",
      "  scStatus = \"running\";\n  scFollowedStep = null;\n  /* FLUYO-018.14b: reproducir es del modo Historia (B1); la salida «Editar»/«Volver a editar» nunca se bloquea (B3). */\n  if (!inPresent && typeof switchPanelTab === \"function\") switchPanelTab(\"scenarios\");\n"
    ],
    [
      "  if (FluyoStory.isFinished(scPlayback)) {\n    scStatus = \"completed\";\n    if (!scRunCounted && scRunSurface) {\n      scRunCounted = true;\n      scTrack(\"story_completed\", { surface: scRunSurface });\n    }\n    scRenderButtons();\n    scRenderStatus();\n",
      "  if (FluyoStory.isFinished(scPlayback)) {\n    scStatus = \"completed\";\n    scRenderButtons();\n    scRenderStatus();\n"
    ],
    [
      "  scRenderPanel();\n  scNotice(FluyoI18n.t(\"stories.duplicated\", \"Historia duplicada: {name}\", { name: copy.name }));\n  scTrack(\"story_created\", { origin: \"variant\" });   /* «Duplicar como fallo»: otra forma de la misma Historia */\n  scChooseFailure(anchor);\n}\n",
      "  scRenderPanel();\n  scNotice(FluyoI18n.t(\"stories.duplicated\", \"Historia duplicada: {name}\", { name: copy.name }));\n  scChooseFailure(anchor);\n}\n"
    ],
    [
      "  scSelectStory(copy.id);\n  scCommit();\n  scTrack(\"story_created\", { origin: \"variant\" });\n  scBeginInlineName(true);\n  return true;\n",
      "  scSelectStory(copy.id);\n  scCommit();\n  scBeginInlineName(true);\n  return true;\n"
    ],
    [
      "      : valid.length === 1 ? FluyoI18n.t(\"place.added\", \"Añadido a la historia.\") : FluyoI18n.t(\"place.addedMany\", \"{count} eventos añadidos al mismo tiempo.\", { count: valid.length }),\n  );\n  if (created) scTrack(\"story_created\", { origin: \"new\" });\n}\nfunction scConfirmMulti() {\n",
      "      : valid.length === 1 ? FluyoI18n.t(\"place.added\", \"Añadido a la historia.\") : FluyoI18n.t(\"place.addedMany\", \"{count} eventos añadidos al mismo tiempo.\", { count: valid.length }),\n  );\n}\nfunction scConfirmMulti() {\n"
    ]
  ],
  "js/editor-share.js": [
    [
      "      ?FluyoI18n.t(\"share.othersTooLarge\",\"Con sus otras formas el enlace era demasiado grande: solo viaja esta historia.\")\n      :isWebOrigin(location.href)? \"\" : FluyoI18n.t(\"share.publicViewer\",\"El enlace abre el visor público de fluyo.space.\"));\n    /* FLUYO-GROWTH-FOUNDATION-001: qué se compartió, sin nada del documento: Historia o diagrama, y si viajan sus otras formas. */\n    trackEvent(\"share_created\",{kind:kind===\"story\"&&story?\"story\":\"diagram\",variants:withOthers?\"yes\":\"no\"});\n    shareControl(\"shareCopy\").focus();\n  }catch(e){\n",
      "      ?FluyoI18n.t(\"share.othersTooLarge\",\"Con sus otras formas el enlace era demasiado grande: solo viaja esta historia.\")\n      :isWebOrigin(location.href)? \"\" : FluyoI18n.t(\"share.publicViewer\",\"El enlace abre el visor público de fluyo.space.\"));\n    trackEvent(\"share_created\");\n    shareControl(\"shareCopy\").focus();\n  }catch(e){\n"
    ]
  ],
  "js/examples.js": [
    [
      "          /* Con Historias, se abre en modo Historias con la primera seleccionada (export.js), como el botón «Ejemplo». */\n          showExampleStories();\n          trackEvent(\"example_loaded\",{example:EXAMPLE_SLUG,source:\"url\"});\n        }\n      });\n",
      "          /* Con Historias, se abre en modo Historias con la primera seleccionada (export.js), como el botón «Ejemplo». */\n          showExampleStories();\n          trackEvent(\"example_loaded\",{example:EXAMPLE_SLUG});\n        }\n      });\n"
    ]
  ],
  "js/export.js": [
    [
      "      scheduleAutosave();\n      resetAnalyticsBaseline();\n      trackEvent(\"example_loaded\",{example:\"demo\",source:\"menu\"});\n    })\n    .catch(err=>{ console.warn(err); })   // sin red y sin caché: el botón no hace nada, como cualquier fetch fallido\n",
      "      scheduleAutosave();\n      resetAnalyticsBaseline();\n      trackEvent(\"example_loaded\",{example:\"demo\"});\n    })\n    .catch(err=>{ console.warn(err); })   // sin red y sin caché: el botón no hace nada, como cualquier fetch fallido\n"
    ]
  ],
  "js/i18n-en-editor.js": [
    [
      "  \"common.close\":\"Close\",\n  \"editor.tell\":\"Explain the system\",\n  \"editor.emptyCanvas\":\"Start by adding elements to the canvas.\",\n\n  /* Lienzo (ajustes del documento) */\n",
      "  \"common.close\":\"Close\",\n  \"editor.tell\":\"Explain the system\",\n  \"editor.emptyCanvas\":\"Pick a shape or icon on the left and click here — or press “Example”\",\n\n  /* Lienzo (ajustes del documento) */\n"
    ],
    [
      "  \"example.page\":\"Example\",\n  \"example.pageN\":\"Example {n}\",\n  /* FLUYO-GROWTH-FOUNDATION-001 · inglés publicable: título del documento, enlaces legales y «Atajos y gestos» */\n  \"editor.docTitle\":\"Fluyo — animated architecture diagram editor with GIF export\",\n  \"more.privacyHref\":\"privacy/\",\n  \"more.supportHref\":\"support/\",\n  \"help.addShape\":\"Pick a shape on the left → click the canvas.\",\n  \"help.wheel\":\"{kbd:Mouse wheel} scroll · {kbd:Ctrl+Wheel} zoom.\",\n  \"help.pan\":\"{kbd:Right-click}, {kbd:Middle-click} or {kbd:Alt+Drag} to pan.\",\n  \"help.touch\":\"Touch: {b:one finger} pans the canvas, {b:two fingers} zoom, double tap edits.\",\n  \"help.connect\":\"Hover over a node and {b:drag the dot} that appears on the nearest side to connect.\",\n  \"help.multiSelect\":\"{b:Drag on empty space} to select several; {kbd:Shift}+click adds or removes.\",\n  \"help.clipboard\":\"{kbd:Ctrl+C} copy · {kbd:Ctrl+X} cut · {kbd:Ctrl+V} paste · {kbd:Ctrl+D} duplicate · {kbd:Ctrl+A} select all.\",\n  \"help.history\":\"{kbd:Ctrl+Z} undo · {kbd:Ctrl+Y} redo (or the arrows in the header).\",\n  \"help.edit\":\"Double-click = edit text. {kbd:Del} deletes, or use the {b:trash can} in the panel header. {kbd:Esc} cancels.\",\n  \"help.touchBar\":\"Touch: with something selected you get {b:Connect} and {b:Select several} at the top and the {b:trash can} at the bottom. Tap the active tab to rename the page.\",\n  \"help.present\":\"{kbd:P} presents full screen; {kbd:←} {kbd:→} change page.\",\n  \"help.arrowHandles\":\"With an arrow selected, drag its {b:ends} (circles) to change side or shape, its {b:elbows} (squares), and the {b:bars} of each segment to slide it; double-click an elbow to remove it.\",\n  \"help.reroute\":\"{kbd:R} returns an arrow to its {b:automatic route}, undoing the segments you moved.\",\n  /* FLUYO-GROWTH-FOUNDATION-001 · la tarjeta de entrada del primer minuto (js/entry.js) */\n  \"entry.title\":\"Explain your system, not just draw it.\",\n  \"entry.explore\":\"See a system in motion\",\n  \"entry.exploreSub\":\"An online checkout, told step by step.\",\n  \"entry.blank\":\"Start blank\",\n  \"entry.blankSub\":\"Draw your system, then tell what happens.\",\n  /* FLUYO-I18N-002 S3b · Propiedades: grupos, campo de contenido y nombres de forma (D-S3b-3: claves propias; D-S3b-4: una por contexto) */\n  \"prop.group.appearance\":\"Appearance\",\n",
      "  \"example.page\":\"Example\",\n  \"example.pageN\":\"Example {n}\",\n  /* FLUYO-I18N-002 S3b · Propiedades: grupos, campo de contenido y nombres de forma (D-S3b-3: claves propias; D-S3b-4: una por contexto) */\n  \"prop.group.appearance\":\"Appearance\",\n"
    ]
  ],
  "js/i18n-en.js": [
    [
      "  \"shell.terms\":\"Terms\",\n  \"shell.support\":\"Support\",\n  \"shell.privacyPath\":\"/privacy/\",\n  \"shell.termsPath\":\"/terms/\",\n  \"shell.supportPath\":\"/support/\",\n  \"notfound.docTitle\":\"Page not found · Fluyo\",\n  \"notfound.title\":\"This page doesn't exist\",\n",
      "  \"shell.terms\":\"Terms\",\n  \"shell.support\":\"Support\",\n  \"notfound.docTitle\":\"Page not found · Fluyo\",\n  \"notfound.title\":\"This page doesn't exist\",\n"
    ]
  ],
  "js/i18n.js": [
    [
      "  const LANGS=[\n    {code:\"es\", tag:\"es\", name:\"Español\", released:true},\n    {code:\"en\", tag:\"en\", name:\"English\", released:true},   /* decisión 324: publicado en v122 (FLUYO-I18N-EN-RELEASE-AUDIT) */\n    {code:\"fr\", tag:\"fr\", name:\"Français\", released:false},\n    {code:\"ja\", tag:\"ja\", name:\"日本語\", released:false},\n    {code:\"zh\", tag:\"zh-Hans\", name:\"简体中文\", released:false}\n  ];\n  /* FLUYO-GROWTH-FOUNDATION-001 (inglés publicable): data-i18n-link lleva un enlace a la página del mismo idioma (/privacy/ en vez de\n     /privacidad/). */\n  const ATTRS=[[\"data-i18n-title\",\"title\"],[\"data-i18n-aria-label\",\"aria-label\"],[\"data-i18n-tip\",\"data-tip\"],[\"data-i18n-placeholder\",\"placeholder\"],[\"data-i18n-link\",\"href\"]];\n  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);\n  const missing=new Set();\n",
      "  const LANGS=[\n    {code:\"es\", tag:\"es\", name:\"Español\", released:true},\n    {code:\"en\", tag:\"en\", name:\"English\", released:false},\n    {code:\"fr\", tag:\"fr\", name:\"Français\", released:false},\n    {code:\"ja\", tag:\"ja\", name:\"日本語\", released:false},\n    {code:\"zh\", tag:\"zh-Hans\", name:\"简体中文\", released:false}\n  ];\n  const ATTRS=[[\"data-i18n-title\",\"title\"],[\"data-i18n-aria-label\",\"aria-label\"],[\"data-i18n-tip\",\"data-tip\"],[\"data-i18n-placeholder\",\"placeholder\"]];\n  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);\n  const missing=new Set();\n"
    ],
    [
      "    return m[name];\n  }\n  /* Decisión 277: una línea que mezcla texto con teclas o énfasis se traduce ENTERA, con marcas {kbd:…} / {b:…} que se pintan\n     como nodos (textContent, nunca innerHTML). El texto base se lee del propio HTML. */\n  const RICH=/(\\{(?:kbd|b):[^{}]*\\})/;\n  function richOf(el){\n    let s=\"\";\n    for(const n of el.childNodes||[]){\n      if(n.nodeType===3) s+=n.data;\n      else if(n.nodeType===1){ const tag=n.tagName.toLowerCase(); s+=(tag===\"kbd\"||tag===\"b\") ? \"{\"+tag+\":\"+n.textContent+\"}\" : n.textContent; }\n    }\n    return s.replace(/\\s+/g,\" \").trim();\n  }\n  function setRich(el, text, d){\n    const nodes=String(text).split(RICH).filter(Boolean).map((p)=>{\n      const m=/^\\{(kbd|b):([^{}]*)\\}$/.exec(p);\n      if(!m) return d.createTextNode(p);\n      const e=d.createElement(m[1]); e.textContent=m[2]; return e;\n    });\n    while(el.firstChild) el.removeChild(el.firstChild);\n    for(const n of nodes) el.appendChild(n);\n  }\n  function applyDom(root){\n    const d=root || (typeof document!==\"undefined\" ? document : null);\n",
      "    return m[name];\n  }\n  function applyDom(root){\n    const d=root || (typeof document!==\"undefined\" ? document : null);\n"
    ],
    [
      "      setOwnText(el, own, t(el.getAttribute(\"data-i18n\"), own.body));\n    }\n    for(const el of d.querySelectorAll(\"[data-i18n-rich]\")) setRich(el, t(el.getAttribute(\"data-i18n-rich\"), base(el, \"rich\", ()=>richOf(el))), d);\n    for(const [data,attr] of ATTRS){\n      for(const el of d.querySelectorAll(\"[\"+data+\"]\")) el.setAttribute(attr, t(el.getAttribute(data), base(el, attr, ()=>el.getAttribute(attr)||\"\")));\n",
      "      setOwnText(el, own, t(el.getAttribute(\"data-i18n\"), own.body));\n    }\n    for(const [data,attr] of ATTRS){\n      for(const el of d.querySelectorAll(\"[\"+data+\"]\")) el.setAttribute(attr, t(el.getAttribute(data), base(el, attr, ()=>el.getAttribute(attr)||\"\")));\n"
    ]
  ],
  "js/viewer.js": [
    [
      "  }\n  render(sctx, now(), {renderState:rs, emptyHint:FluyoI18n.t(\"viewer.emptyPage\",\"Esta página no contiene elementos.\")});\n  if(story && story.status===\"running\" && !FluyoStoryClock.isPaused(story.clock) && FluyoStory.isFinished(story.playback)){\n    story.status=\"completed\";\n    /* una vez por reproducción, aunque después se salte atrás y vuelva a terminar */\n    if(!story.counted){ story.counted=true; trackEvent(\"viewer_story_completed\"); }\n  }\n  storyRefresh();\n  storyPlace();\n",
      "  }\n  render(sctx, now(), {renderState:rs, emptyHint:FluyoI18n.t(\"viewer.emptyPage\",\"Esta página no contiene elementos.\")});\n  if(story && story.status===\"running\" && !FluyoStoryClock.isPaused(story.clock) && FluyoStory.isFinished(story.playback)) story.status=\"completed\";\n  storyRefresh();\n  storyPlace();\n"
    ],
    [
      "  const started=FluyoStoryClock.start(P(), sc, FluyoStoryClock.now(clock, performance.now()), FluyoI18n.t);\n  if(!started.ok){ storyError=started.errors[0]||null; storyRefresh(); return; }\n  story={scenario:sc, playback:started.playback, status:\"running\", clock, counted:false};\n  trackEvent(\"viewer_story_started\");\n  followOn=true; followKey=null;\n  storyRefresh();\n",
      "  const started=FluyoStoryClock.start(P(), sc, FluyoStoryClock.now(clock, performance.now()), FluyoI18n.t);\n  if(!started.ok){ storyError=started.errors[0]||null; storyRefresh(); return; }\n  story={scenario:sc, playback:started.playback, status:\"running\", clock};\n  followOn=true; followKey=null;\n  storyRefresh();\n"
    ],
    [
      "    setStatus(\"\");\n    shareViewed=true;\n    /* FLUYO-GROWTH-FOUNDATION-001: si lo que llegó trae una Historia reproducible y en qué idioma se ve; nada del documento. */\n    trackEvent(\"share_viewed\",{story:storyScenario()?\"yes\":\"no\",locale:analyticsLocale()});\n    viewerRaf=requestAnimationFrame(()=>viewerLoop(generation));\n  }catch(e){ showShareError(\"invalid_document\"); }\n",
      "    setStatus(\"\");\n    shareViewed=true;\n    trackEvent(\"share_viewed\");\n    viewerRaf=requestAnimationFrame(()=>viewerLoop(generation));\n  }catch(e){ showShareError(\"invalid_document\"); }\n"
    ]
  ],
  "privacidad/index.html": [
    [
      "<h3>Telemetría de producto</h3>\n<p>En el sitio público hay analítica de uso agregada, servida por <a href=\"https://umami.is\" target=\"_blank\" rel=\"noopener\">Umami Cloud</a>. <strong>Sin cookies y sin fingerprinting</strong>, y sin identificar usuarios.</p>\n<p>Lo que se registra es esta lista cerrada de eventos; la captura automática está desactivada y no hay pageviews:</p>\n<table>\n  <tr><th>Evento</th><th>Significado y propiedades</th></tr>\n  <tr><td><code>editor_opened</code></td><td>Una vez por carga del editor. <code>entry</code>: <code>direct</code>, <code>example</code> (llegó con <code>?ejemplo=</code>) o <code>link</code> (llegó con <code>#d=</code>), sin la URL. <code>returning</code>: <code>yes</code> si este navegador ya había abierto Fluyo, <code>no</code> si no (ver «Primera visita»). <code>locale</code>: idioma de la interfaz (<code>es</code>, <code>en</code>, <code>fr</code>, <code>ja</code>, <code>zh</code> u <code>other</code>).</td></tr>\n  <tr><td><code>first_edit_completed</code></td><td>Primera modificación real por carga del editor. No incluye selección, pan, zoom, navegación, importación o restauración. Sin propiedades.</td></tr>\n  <tr><td><code>diagram_created</code></td><td>Primera edición que deja nodos en un documento antes vacío, como máximo una vez por carga. Sin propiedades.</td></tr>\n",
      "<h3>Telemetría de producto</h3>\n<p>En el sitio público hay analítica de uso agregada, servida por <a href=\"https://umami.is\" target=\"_blank\" rel=\"noopener\">Umami Cloud</a>. <strong>Sin cookies y sin fingerprinting</strong>, y sin identificar usuarios.</p>\n<p>Lo que se registra es esta lista cerrada de eventos; la captura automática está desactivada:</p>\n<table>\n  <tr><th>Evento</th><th>Significado y propiedades</th></tr>\n  <tr><td><code>editor_opened</code></td><td>Una vez por carga del editor. Sin propiedades.</td></tr>\n  <tr><td><code>first_edit_completed</code></td><td>Primera modificación real por carga del editor. No incluye selección, pan, zoom, navegación, importación o restauración. Sin propiedades.</td></tr>\n  <tr><td><code>diagram_created</code></td><td>Primera edición que deja nodos en un documento antes vacío, como máximo una vez por carga. Sin propiedades.</td></tr>\n"
    ],
    [
      "  <tr><td><code>diagram_exported</code></td><td>Archivo generado y descarga iniciada. <code>format</code>: <code>gif</code>, <code>png</code>, <code>jpg</code> o <code>svg</code>. No confirma escritura a disco.</td></tr>\n  <tr><td><code>file_imported</code></td><td>Documento válido aplicado. <code>source</code>: <code>file</code> o <code>link</code>; <code>format: fluyo_json</code>. El origen no atribuye autoría MCP.</td></tr>\n  <tr><td><code>present_started</code></td><td>Entrada efectiva al modo presentación, también sin pantalla completa. Sin propiedades.</td></tr>\n  <tr><td><code>example_loaded</code></td><td>Un ejemplo publicado quedó abierto. <code>example</code>: identificador de la lista fija. <code>source</code>: <code>url</code> (<code>?ejemplo=</code>), <code>menu</code> (botón «Ejemplo») o <code>entry</code> (tarjeta de entrada).</td></tr>\n  <tr><td><code>entry_chosen</code></td><td>Solo en la primera visita: qué se hizo con la tarjeta de entrada. <code>choice</code>: <code>explore</code>, <code>blank</code> o <code>dismiss</code> (Escape, tocar el lienzo o abrir otra cosa).</td></tr>\n  <tr><td><code>story_created</code></td><td>Se creó una Historia en el editor. <code>origin</code>: <code>new</code>, <code>variant</code> («Otra forma desde aquí» o «Duplicar como fallo») o <code>copy</code> (duplicar). Ni su nombre ni sus frases.</td></tr>\n  <tr><td><code>story_started</code></td><td>Empezó a reproducirse una Historia. <code>surface</code>: <code>editor</code> o <code>present</code>. <code>trigger</code>: <code>user</code> o <code>entry</code> (la arrancó la tarjeta de entrada). Una vez por reproducción, no por paso.</td></tr>\n  <tr><td><code>story_completed</code></td><td>Esa reproducción llegó al final, viéndola o saltando de momento en momento. <code>surface</code>: <code>editor</code> o <code>present</code>. Una vez por reproducción.</td></tr>\n  <tr><td><code>gif_animation_added</code></td><td><code>anim</code>: clave de una de las ocho animaciones predefinidas.</td></tr>\n  <tr><td><code>link_failed</code></td><td><code>reason</code>: <code>decode</code>, <code>schema</code>, <code>too_large</code> o <code>unsupported</code>.</td></tr>\n  <tr><td><code>share_created</code></td><td>Tras confirmar y crear efectivamente un enlace dentro del límite. <code>kind</code>: <code>story</code> o <code>diagram</code>. <code>variants</code>: <code>yes</code> si viajan sus otras formas, <code>no</code> si no.</td></tr>\n  <tr><td><code>share_viewed</code></td><td>Después del primer render exitoso del viewer. <code>story</code>: <code>yes</code> si trae una Historia reproducible. <code>locale</code>: idioma de la interfaz, como arriba.</td></tr>\n  <tr><td><code>viewer_story_started</code></td><td>En el viewer, al pulsar «Reproducir». Sin propiedades.</td></tr>\n  <tr><td><code>viewer_story_completed</code></td><td>En el viewer, esa reproducción llegó al final. Sin propiedades. Una vez por reproducción.</td></tr>\n  <tr><td><code>share_opened_in_editor</code></td><td>Al pulsar explícitamente Abrir en Fluyo en el viewer. Sin propiedades.</td></tr>\n</table>\n<h3 id=\"primera-visita\">Primera visita</h3>\n<p>La primera vez que este navegador abre el editor sin traer un documento por el enlace, una tarjeta sobre el lienzo ofrece ver un ejemplo en marcha o empezar en blanco. Para no volver a ofrecerla, el editor guarda en <code>localStorage</code> la clave <code>fluyo.seen</code> con el valor <code>1</code>: sin fecha, sin identificador, y nunca se envía. Tampoco aparece si ya hay cualquier otra clave <code>fluyo.*</code> (sesión guardada, tema o idioma). Lo único que sale es su consecuencia, <code>returning: yes/no</code> en <code>editor_opened</code>; cuenta navegadores, no personas: en modo privado, tras borrar los datos del sitio o en otro dispositivo, cuenta como nuevo.</p>\n<p><strong>El contenido de tus diagramas nunca se envía a analytics.</strong> Sólo se admiten los eventos y valores de estas listas cerradas. No se envían nombres de archivos o nodos, texto, imágenes, prompts, IDs de documentos ni datos personales. La comparación para detectar la primera edición ocurre sólo en memoria local.</p>\n<p><strong>No se envían URLs privadas.</strong> La captura automática del proveedor está desactivada con <code>data-auto-track=\"false\"</code>. Se excluyen query y fragmento con <code>data-exclude-search</code> y <code>data-exclude-hash</code>; además, el filtro <code>data-before-send</code> reconstruye el payload con ruta fija <code>/</code>, título fijo <code>Fluyo</code> y referrer vacío. No se envían propiedades automáticas adicionales del navegador. La carga asíncrona usa una cola acotada en memoria; bloquear Umami no impide trabajar.</p>\n",
      "  <tr><td><code>diagram_exported</code></td><td>Archivo generado y descarga iniciada. <code>format</code>: <code>gif</code>, <code>png</code>, <code>jpg</code> o <code>svg</code>. No confirma escritura a disco.</td></tr>\n  <tr><td><code>file_imported</code></td><td>Documento válido aplicado. <code>source</code>: <code>file</code> o <code>link</code>; <code>format: fluyo_json</code>. El origen no atribuye autoría MCP.</td></tr>\n  <tr><td><code>present_started</code></td><td>Entrada efectiva al modo presentación, también sin pantalla completa. Sin propiedades. No se mide presentación completada.</td></tr>\n  <tr><td><code>example_loaded</code></td><td><code>example</code>: identificador de un ejemplo de la lista fija.</td></tr>\n  <tr><td><code>gif_animation_added</code></td><td><code>anim</code>: clave de una de las ocho animaciones predefinidas.</td></tr>\n  <tr><td><code>link_failed</code></td><td><code>reason</code>: <code>decode</code>, <code>schema</code>, <code>too_large</code> o <code>unsupported</code>.</td></tr>\n  <tr><td><code>share_created</code></td><td>Tras confirmar y crear efectivamente un enlace dentro del límite. Sin propiedades.</td></tr>\n  <tr><td><code>share_viewed</code></td><td>Después del primer render exitoso del viewer. Sin propiedades.</td></tr>\n  <tr><td><code>share_opened_in_editor</code></td><td>Al pulsar explícitamente Abrir en Fluyo en el viewer. Sin propiedades.</td></tr>\n</table>\n<p><strong>El contenido de tus diagramas nunca se envía a analytics.</strong> Sólo se admiten los eventos y valores de estas listas cerradas. No se envían nombres de archivos o nodos, texto, imágenes, prompts, IDs de documentos ni datos personales. La comparación para detectar la primera edición ocurre sólo en memoria local.</p>\n<p><strong>No se envían URLs privadas.</strong> La captura automática del proveedor está desactivada con <code>data-auto-track=\"false\"</code>. Se excluyen query y fragmento con <code>data-exclude-search</code> y <code>data-exclude-hash</code>; además, el filtro <code>data-before-send</code> reconstruye el payload con ruta fija <code>/</code>, título fijo <code>Fluyo</code> y referrer vacío. No se envían propiedades automáticas adicionales del navegador. La carga asíncrona usa una cola acotada en memoria; bloquear Umami no impide trabajar.</p>\n"
    ],
    [
      "  <tr><th>Proveedor</th><th>Qué ve</th><th>Por qué</th></tr>\n  <tr><td><strong>Google Cloud</strong></td><td>Logs de plataforma de los dos dominios (IP, ruta, estado, user-agent), retenidos 7 días</td><td>Alojamiento</td></tr>\n  <tr><td><strong>Umami Cloud</strong></td><td>Los eventos de la lista de arriba (sin pageviews), sin cookies ni identificadores</td><td>Analítica del editor</td></tr>\n  <tr><td><strong>Cloudflare (cdnjs)</strong></td><td>La petición del archivo <code>gif.js</code>: IP y user-agent</td><td>Entrega de la librería de GIF</td></tr>\n</table>\n",
      "  <tr><th>Proveedor</th><th>Qué ve</th><th>Por qué</th></tr>\n  <tr><td><strong>Google Cloud</strong></td><td>Logs de plataforma de los dos dominios (IP, ruta, estado, user-agent), retenidos 7 días</td><td>Alojamiento</td></tr>\n  <tr><td><strong>Umami Cloud</strong></td><td>Pageviews y los eventos de la lista de arriba, sin cookies ni identificadores</td><td>Analítica del editor</td></tr>\n  <tr><td><strong>Cloudflare (cdnjs)</strong></td><td>La petición del archivo <code>gif.js</code>: IP y user-agent</td><td>Entrega de la librería de GIF</td></tr>\n</table>\n"
    ]
  ],
  "privacy/index.html": [
    [
      "<h3>Product analytics</h3>\n<p>The public site includes aggregate usage analytics, served by <a href=\"https://umami.is\" target=\"_blank\" rel=\"noopener\">Umami Cloud</a>. <strong>No cookies and no fingerprinting</strong>, and no user identification.</p>\n<p>What is recorded is this closed list of events; automatic capture is off and there are no pageviews:</p>\n<table>\n  <tr><th>Event</th><th>Meaning and properties</th></tr>\n  <tr><td><code>editor_opened</code></td><td>Once per editor load. <code>entry</code>: <code>direct</code>, <code>example</code> (arrived with <code>?ejemplo=</code>) or <code>link</code> (arrived with <code>#d=</code>), never the URL. <code>returning</code>: <code>yes</code> if this browser had opened Fluyo before, <code>no</code> otherwise (see “First visit”). <code>locale</code>: interface language (<code>es</code>, <code>en</code>, <code>fr</code>, <code>ja</code>, <code>zh</code> or <code>other</code>).</td></tr>\n  <tr><td><code>first_edit_completed</code></td><td>First real change per editor load. Selection, pan, zoom, navigation, import and restore do not count. No properties.</td></tr>\n  <tr><td><code>diagram_created</code></td><td>First edit that leaves nodes in a previously empty document, at most once per load. No properties.</td></tr>\n  <tr><td><code>diagram_saved</code></td><td>Explicit download started from Save; not autosave, and no confirmation that it reached the disk. <code>format: fluyo_json</code>.</td></tr>\n  <tr><td><code>diagram_exported</code></td><td>File generated and download started. <code>format</code>: <code>gif</code>, <code>png</code>, <code>jpg</code> or <code>svg</code>. No confirmation that it reached the disk.</td></tr>\n  <tr><td><code>file_imported</code></td><td>A valid document was applied. <code>source</code>: <code>file</code> or <code>link</code>; <code>format: fluyo_json</code>. The source does not attribute MCP authorship.</td></tr>\n  <tr><td><code>present_started</code></td><td>Presentation mode actually entered, even without full screen. No properties.</td></tr>\n  <tr><td><code>example_loaded</code></td><td>A published example ended up open. <code>example</code>: identifier from the fixed list. <code>source</code>: <code>url</code> (<code>?ejemplo=</code>), <code>menu</code> (the “Example” button) or <code>entry</code> (the entry card).</td></tr>\n  <tr><td><code>entry_chosen</code></td><td>First visit only: what was done with the entry card. <code>choice</code>: <code>explore</code>, <code>blank</code> or <code>dismiss</code> (Escape, touching the canvas or opening something else).</td></tr>\n  <tr><td><code>story_created</code></td><td>A Story was created in the editor. <code>origin</code>: <code>new</code>, <code>variant</code> (“Another way from here” or “Duplicate as failure”) or <code>copy</code> (duplicate). Never its name or its sentences.</td></tr>\n  <tr><td><code>story_started</code></td><td>A Story started playing. <code>surface</code>: <code>editor</code> or <code>present</code>. <code>trigger</code>: <code>user</code> or <code>entry</code> (started by the entry card). Once per playback, not per step.</td></tr>\n  <tr><td><code>story_completed</code></td><td>That playback reached the end, watched or skipped through. <code>surface</code>: <code>editor</code> or <code>present</code>. Once per playback.</td></tr>\n  <tr><td><code>gif_animation_added</code></td><td><code>anim</code>: key of one of the eight built-in animations.</td></tr>\n  <tr><td><code>link_failed</code></td><td><code>reason</code>: <code>decode</code>, <code>schema</code>, <code>too_large</code> or <code>unsupported</code>.</td></tr>\n  <tr><td><code>share_created</code></td><td>After confirming and actually creating a link within the limit. <code>kind</code>: <code>story</code> or <code>diagram</code>. <code>variants</code>: <code>yes</code> if its other ways travel with it, <code>no</code> otherwise.</td></tr>\n  <tr><td><code>share_viewed</code></td><td>After the viewer's first successful render. <code>story</code>: <code>yes</code> if it carries a playable Story. <code>locale</code>: interface language, as above.</td></tr>\n  <tr><td><code>viewer_story_started</code></td><td>In the viewer, when “Play” is pressed. No properties.</td></tr>\n  <tr><td><code>viewer_story_completed</code></td><td>In the viewer, that playback reached the end. No properties. Once per playback.</td></tr>\n  <tr><td><code>share_opened_in_editor</code></td><td>When “Open in Fluyo” is explicitly pressed in the viewer. No properties.</td></tr>\n</table>\n<h3 id=\"first-visit\">First visit</h3>\n<p>The first time this browser opens the editor without a document in the link, a card over the canvas offers to watch an example in motion or to start blank. So that it is not offered again, the editor stores the key <code>fluyo.seen</code> with the value <code>1</code> in <code>localStorage</code>: no date, no identifier, and it is never sent. It does not appear either if any other <code>fluyo.*</code> key exists (saved session, theme or language). The only thing that leaves is its consequence, <code>returning: yes/no</code> in <code>editor_opened</code>; it counts browsers, not people: a private window, cleared site data or another device count as new.</p>\n<p><strong>The content of your diagrams is never sent.</strong> Only the events and values in these closed lists are accepted. No file or node names, text, images, prompts, document IDs or personal data are sent. The comparison that detects the first edit happens only in local memory.</p>\n<p><strong>No private URLs are sent.</strong> Automatic capture is disabled with <code>data-auto-track=\"false\"</code>. Query and fragment are excluded with <code>data-exclude-search</code> and <code>data-exclude-hash</code>; on top of that, the <code>data-before-send</code> filter rebuilds the payload with a fixed path <code>/</code>, a fixed title <code>Fluyo</code> and an empty referrer. No additional automatic browser properties are sent. Asynchronous loading uses a bounded in-memory queue; blocking Umami does not stop you from working.</p>\n<p>The analytics script loads <strong>only</strong> when the domain is <code>fluyo.space</code> or <code>www.fluyo.space</code>. If you clone the repository, open it locally or self-host it, that code never runs and no network call is made. Preview domains are deliberately excluded. The condition lives in <code>js/analytics.js</code>, in a single block, so you can verify it yourself.</p>\n<p>If you want zero analytics: run the project locally or self-hosted, or block the <code>cloud.umami.is</code> domain. Fluyo works the same — the analytics code is written to fail silently.</p>\n",
      "<h3>Product analytics</h3>\n<p>The public site includes aggregate usage analytics, served by <a href=\"https://umami.is\" target=\"_blank\" rel=\"noopener\">Umami Cloud</a>. <strong>No cookies and no fingerprinting</strong>, and no user identification.</p>\n<p>What is recorded is pageviews plus this closed list of events:</p>\n<div lang=\"es\">\n<table>\n  <tr><th>Evento</th><th>Significado y propiedades</th></tr>\n  <tr><td><code>editor_opened</code></td><td>Una vez por carga del editor. Sin propiedades.</td></tr>\n  <tr><td><code>first_edit_completed</code></td><td>Primera modificación real por carga del editor. No incluye selección, pan, zoom, navegación, importación o restauración. Sin propiedades.</td></tr>\n  <tr><td><code>diagram_created</code></td><td>Primera edición que deja nodos en un documento antes vacío, como máximo una vez por carga. Sin propiedades.</td></tr>\n  <tr><td><code>diagram_saved</code></td><td>Descarga explícita generada/iniciada desde Guardar; no autoguardado ni confirmación de escritura a disco. <code>format: fluyo_json</code>.</td></tr>\n  <tr><td><code>diagram_exported</code></td><td>Archivo generado y descarga iniciada. <code>format</code>: <code>gif</code>, <code>png</code>, <code>jpg</code> o <code>svg</code>. No confirma escritura a disco.</td></tr>\n  <tr><td><code>file_imported</code></td><td>Documento válido aplicado. <code>source</code>: <code>file</code> o <code>link</code>; <code>format: fluyo_json</code>. El origen no atribuye autoría MCP.</td></tr>\n  <tr><td><code>present_started</code></td><td>Entrada efectiva al modo presentación, también sin pantalla completa. Sin propiedades. No se mide presentación completada.</td></tr>\n  <tr><td><code>example_loaded</code></td><td><code>example</code>: identificador de un ejemplo de la lista fija.</td></tr>\n  <tr><td><code>gif_animation_added</code></td><td><code>anim</code>: clave de una de las ocho animaciones predefinidas.</td></tr>\n  <tr><td><code>link_failed</code></td><td><code>reason</code>: <code>decode</code>, <code>schema</code>, <code>too_large</code> o <code>unsupported</code>.</td></tr>\n</table>\n<p><strong>El contenido de tus diagramas nunca se envía.</strong> Sólo se admiten los eventos y valores de estas listas cerradas. No se envían nombres de archivos o nodos, texto, imágenes, prompts, IDs de documentos ni datos personales. La comparación para detectar la primera edición ocurre sólo en memoria local.</p>\n<p><strong>No se envían URLs privadas.</strong> Se excluyen query y fragmento con <code>data-exclude-search</code> y <code>data-exclude-hash</code>; además, el filtro <code>data-before-send</code> reconstruye el payload con ruta fija <code>/</code>, título fijo <code>Fluyo</code> y referrer vacío. No se envían propiedades automáticas adicionales del navegador. La carga asíncrona usa una cola acotada en memoria; bloquear Umami no impide trabajar.</p>\n</div>\n<p>The analytics script loads <strong>only</strong> when the domain is <code>fluyo.space</code> or <code>www.fluyo.space</code>. If you clone the repository, open it locally or self-host it, that code never runs and no network call is made. Preview domains are deliberately excluded. The condition lives in <code>js/analytics.js</code>, in a single block, so you can verify it yourself.</p>\n<p>If you want zero analytics: run the project locally or self-hosted, or block the <code>cloud.umami.is</code> domain. Fluyo works the same — the analytics code is written to fail silently.</p>\n"
    ],
    [
      "  <tr><th>Provider</th><th>What it sees</th><th>Why</th></tr>\n  <tr><td><strong>Google Cloud</strong></td><td>Platform logs for both domains (IP, path, status, user agent), retained 7 days</td><td>Hosting</td></tr>\n  <tr><td><strong>Umami Cloud</strong></td><td>The events listed above (no pageviews), without cookies or identifiers</td><td>Editor analytics</td></tr>\n  <tr><td><strong>Cloudflare (cdnjs)</strong></td><td>The request for the <code>gif.js</code> file: IP and user agent</td><td>Delivery of the GIF library</td></tr>\n</table>\n",
      "  <tr><th>Provider</th><th>What it sees</th><th>Why</th></tr>\n  <tr><td><strong>Google Cloud</strong></td><td>Platform logs for both domains (IP, path, status, user agent), retained 7 days</td><td>Hosting</td></tr>\n  <tr><td><strong>Umami Cloud</strong></td><td>Pageviews and the events listed above, without cookies or identifiers</td><td>Editor analytics</td></tr>\n  <tr><td><strong>Cloudflare (cdnjs)</strong></td><td>The request for the <code>gif.js</code> file: IP and user agent</td><td>Delivery of the GIF library</td></tr>\n</table>\n"
    ]
  ],
  "sw.js": [
    [
      "  \"./js/share-url.js\",\n  \"./js/editor-share.js\",\n  \"./js/entry.js\",\n  /* Idioma de la interfaz (FLUYO-I18N-002 S0): todos los diccionarios, comunes y del editor; cambiar de idioma no necesita red. */\n  \"./js/i18n-en.js\",\n",
      "  \"./js/share-url.js\",\n  \"./js/editor-share.js\",\n  /* Idioma de la interfaz (FLUYO-I18N-002 S0): todos los diccionarios, comunes y del editor; cambiar de idioma no necesita red. */\n  \"./js/i18n-en.js\",\n"
    ]
  ]
};
/* Las líneas que añade esta tarea (para los tests de slices anteriores que leen las líneas «+» de un `git diff` frente a su base). */
const ADDED_LINES = new Set([
"           en la URL (js/entry.js). Sobre el lienzo vacío y sin bloquearlo: Escape o tocar el lienzo la cierran. -->",
"          /* Elegir «ver en marcha» es pedir verlo moverse; con movimiento reducido queda lista para «Reproducir». */",
"          <button id=\"entryBlank\" class=\"entryOpt\" type=\"button\"><span class=\"entryLbl\" data-i18n=\"entry.blank\">Empezar en blanco</span><span class=\"entrySub\" data-i18n=\"entry.blankSub\">Dibuja tu sistema y cuenta qué pasa.</span></button>",
"          <button id=\"entryExplore\" class=\"primary entryOpt\" type=\"button\"><span class=\"entryLbl\" data-i18n=\"entry.explore\">Ver un sistema en marcha</span><span class=\"entrySub\" data-i18n=\"entry.exploreSub\">Una compra online, contada paso a paso.</span></button>",
"          if(!prefersReducedMotion()) scRun({trigger:\"entry\"});",
"          if(eleccion===\"keep\") return;",
"          showExampleStories();",
"          trackEvent(\"example_loaded\", {example:EXAMPLE_DEMO, source:\"entry\"});",
"          trackEvent(\"example_loaded\",{example:EXAMPLE_SLUG,source:\"url\"});",
"        </div>",
"        <a class=\"menuItem\" href=\"privacidad/\" data-i18n=\"shell.privacy\" data-i18n-link=\"more.privacyHref\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-shield\"/></svg>Privacidad</a>",
"        <a class=\"menuItem\" href=\"soporte/\" data-i18n=\"shell.support\" data-i18n-link=\"more.supportHref\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-help\"/></svg>Soporte</a>",
"        <div class=\"entryActions\">",
"        <h2 id=\"entryTitle\" class=\"entryTitle\" data-i18n=\"entry.title\">Explica tu sistema, no solo lo dibujes.</h2>",
"        <li data-i18n-rich=\"help.arrowHandles\">Con una flecha seleccionada, arrastra sus <b>extremos</b> (círculos) para cambiar de lado o de forma, sus <b>codos</b> (cuadrados) y las <b>barras</b> de cada tramo para deslizar un tramo; doble clic en un codo lo elimina.</li>",
"        <li data-i18n-rich=\"help.clipboard\"><kbd>Ctrl+C</kbd> copiar · <kbd>Ctrl+X</kbd> cortar · <kbd>Ctrl+V</kbd> pegar · <kbd>Ctrl+D</kbd> duplicar · <kbd>Ctrl+A</kbd> todo.</li>",
"        <li data-i18n-rich=\"help.connect\">Pasa el ratón sobre un nodo y <b>arrastra el punto</b> que aparece en el lado más cercano para conectar.</li>",
"        <li data-i18n-rich=\"help.edit\">Doble clic = editar texto. <kbd>Supr</kbd> borra, o la <b>papelera</b> de la cabecera del panel. <kbd>Esc</kbd> cancela.</li>",
"        <li data-i18n-rich=\"help.history\"><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+Y</kbd> rehacer (o las flechas de la cabecera).</li>",
"        <li data-i18n-rich=\"help.multiSelect\"><b>Arrastra en el vacío</b> para seleccionar varios; <kbd>Shift</kbd>+clic suma o quita.</li>",
"        <li data-i18n-rich=\"help.pan\"><kbd>Clic derecho</kbd>, <kbd>Clic central</kbd> o <kbd>Alt+Arrastrar</kbd> para pan.</li>",
"        <li data-i18n-rich=\"help.present\"><kbd>P</kbd> presenta a pantalla completa; <kbd>←</kbd> <kbd>→</kbd> cambian de página.</li>",
"        <li data-i18n-rich=\"help.reroute\"><kbd>R</kbd> devuelve una flecha a su <b>ruta automática</b>, deshaciendo los tramos que hayas movido.</li>",
"        <li data-i18n-rich=\"help.touch\">Táctil: <b>un dedo</b> mueve el plano, <b>dos dedos</b> hacen zoom, doble toque edita.</li>",
"        <li data-i18n-rich=\"help.touchBar\">Táctil: con algo seleccionado salen <b>Conectar</b> y <b>Seleccionar varios</b> arriba y la <b>papelera</b> abajo. Toca la pestaña activa para renombrar la página.</li>",
"        <li data-i18n-rich=\"help.wheel\"><kbd>Rueda ratón</kbd> mover · <kbd>Ctrl+Rueda</kbd> zoom.</li>",
"        <li data-i18n=\"help.addShape\">Forma del menú izquierdo → clic en el lienzo.</li>",
"        abrirLabel:FluyoI18n.t(\"incoming.openExample\",\"Abrir el ejemplo y descartar la sesión\"),",
"        onResuelto:eleccion=>{",
"        paginaLabel:FluyoI18n.t(\"incoming.addExample\",\"Añadir el ejemplo como página nueva\"),",
"        titulo:FluyoI18n.t(\"incoming.title\",\"Tienes trabajo sin guardar\"),",
"        }",
"      /* Sin red y sin caché: la tarjeta se va y queda el lienzo en blanco, que funciona igual. */",
"      <!-- FLUYO-GROWTH-FOUNDATION-001: la entrada del primer minuto, solo para un navegador que nunca abrió Fluyo y sin documento",
"      </section>",
"      <a href=\"/privacidad/\" data-i18n=\"shell.privacy\" data-i18n-link=\"shell.privacyPath\">Privacidad</a>",
"      <a href=\"/soporte/\" data-i18n=\"shell.support\" data-i18n-link=\"shell.supportPath\">Soporte</a>",
"      <a href=\"/terminos/\" data-i18n=\"shell.terms\" data-i18n-link=\"shell.termsPath\">Términos</a>",
"      <section id=\"entryCard\" class=\"entryCard\" aria-labelledby=\"entryTitle\" hidden>",
"      console.warn(err);",
"      const e=d.createElement(m[1]); e.textContent=m[2]; return e;",
"      const k=storage.key(i);",
"      const m=/^\\{(kbd|b):([^{}]*)\\}$/.exec(p);",
"      else if(n.nodeType===1){ const tag=n.tagName.toLowerCase(); s+=(tag===\"kbd\"||tag===\"b\") ? \"{\"+tag+\":\"+n.textContent+\"}\" : n.textContent; }",
"      entryClose(\"blank\");",
"      entryClose(\"explore\");",
"      if(!m) return d.createTextNode(p);",
"      if(n.nodeType===3) s+=n.data;",
"      if(typeof k===\"string\" && k.startsWith(\"fluyo.\")) return {available:true, returning:true};",
"      presentIncomingDocument(d, {",
"      scRunCounted = true;",
"      scTrack(\"story_completed\", { surface: scRunSurface });",
"      trackEvent(\"example_loaded\",{example:\"demo\",source:\"menu\"});",
"      });",
"     /privacidad/). */",
"     FLUYO-GROWTH-FOUNDATION-001: con la tarjeta de entrada abierta (entry.js) el lienzo no dice nada: habla la tarjeta.",
"     La pista es neutral (PO): no nombra «Ejemplo», «⋯» ni «la izquierda», que no valen en todas las disposiciones. */",
"     como nodos (textContent, nunca innerHTML). El texto base se lee del propio HTML. */",
"     opts.trigger: \"entry\" cuando la arranca la tarjeta de entrada (entry.js), no un clic en «Reproducir». */",
"     · `localStorage` responde (sin él no se podría recordar la elección y saldría en cada carga).",
"     · editor (no /s/), y la URL no trae documento (`?ejemplo=`, `#d=`): un enlace profundo nunca acaba interceptado;",
"     · este navegador no tiene NINGUNA clave `fluyo.*` (autoguardado, preferencias, idioma o `fluyo.seen`);",
"     · no hay sesión guardada;",
"    .catch(err=>{",
"    .finally(()=>{ entryBusy=false; });",
"    .then(d=>{",
"    /* FLUYO-GROWTH-FOUNDATION-001: qué se compartió, sin nada del documento: Historia o diagrama, y si viajan sus otras formas. */",
"    /* FLUYO-GROWTH-FOUNDATION-001: si lo que llegó trae una Historia reproducible y en qué idioma se ve; nada del documento. */",
"    /* una vez por reproducción, aunque después se salte atrás y vuelva a terminar */",
"    : (typeof DEEP_LINK_PAYLOAD!==\"undefined\" && DEEP_LINK_PAYLOAD) ? \"link\" : \"direct\";",
"    const l=typeof FluyoI18n===\"object\" ? FluyoI18n.locale() : \"es\";",
"    const nodes=String(text).split(RICH).filter(Boolean).map((p)=>{",
"    for(const el of d.querySelectorAll(\"[data-i18n-rich]\")) setRich(el, t(el.getAttribute(\"data-i18n-rich\"), base(el, \"rich\", ()=>richOf(el))), d);",
"    for(const n of el.childNodes||[]){",
"    for(const n of nodes) el.appendChild(n);",
"    for(let i=0; i<storage.length; i++){",
"    if (!scRunCounted && scRunSurface) {",
"    if(!storage) return {available:false, returning:false};",
"    if(!story.counted){ story.counted=true; trackEvent(\"viewer_story_completed\"); }",
"    if(new URLSearchParams(search||\"\").has(\"ejemplo\")) return true;",
"    if(storage.getItem(ENTRY_SEEN_KEY)!==null) return {available:true, returning:true};",
"    let s=\"\";",
"    return /(?:^|[#&])d=/.test(hash||\"\");",
"    return ANALYTICS_LOCALES.includes(l) ? l : \"other\";",
"    return s.replace(/\\s+/g,\" \").trim();",
"    return {available:true, returning:false};",
"    scNotice(FluyoI18n.t(\"stories.created\", \"{name} creada\", { name: sc.name }));",
"    scTrack(\"story_created\", { origin: \"new\" });",
"    source:[\"url\",\"menu\",\"entry\"]},",
"    story.status=\"completed\";",
"    trackEvent(\"share_created\",{kind:kind===\"story\"&&story?\"story\":\"diagram\",variants:withOthers?\"yes\":\"no\"});",
"    trackEvent(\"share_viewed\",{story:storyScenario()?\"yes\":\"no\",locale:analyticsLocale()});",
"    while(el.firstChild) el.removeChild(el.firstChild);",
"    {code:\"en\", tag:\"en\", name:\"English\", released:true},   /* decisión 324: publicado en v122 (FLUYO-I18N-EN-RELEASE-AUDIT) */",
"    }",
"    })",
"    });",
"   Cargar después de examples.js, deeplink.js, state.js, editor-scenarios.js y export.js (usa fetchExample, urlBringsDocument,",
"   Cuándo aparece — TODAS a la vez:",
"   FLUYO-GROWTH-FOUNDATION-001: ningún nombre cambia (las series siguen); se añaden propiedades enumeradas y los eventos de la",
"   Historia y de la entrada. `editor_opened` hace de «app abierta» y `share_viewed` de «viewer abierto». Una propiedad fuera de",
"   Quien abre fluyo.space por primera vez llega a un lienzo vacío y la pregunta «¿qué creo primero?». Esta tarjeta, sobre el",
"   `fluyo.seen` es la única clave nueva: vale \"1\", sin fecha ni identificador, y nunca sale del navegador. Lo que sale es su",
"   `share_created` se emite tras generar una URL válida en el editor.",
"   aunque sea inválido o ya se hubiera abierto en esta pestaña. Ante la duda, no se muestra nada. */",
"   bucle del editor (editor-runtime.js), que es quien sabe cuándo se pinta el lienzo vacío. */",
"   cargado (los arneses vm, el MCP) no se mide nada. */",
"   consecuencia, un `returning: yes/no` en `editor_opened` (editor-analytics.js). Se escribe al cargar si la tarjeta no se",
"   del mismo material que los modales (.card) pero sin velo ni bloqueo: el lienzo sigue a la vista y tocarlo la cierra. Dos",
"   entra directo; si mientras tanto apareció una, decide el modal de siempre). La URL no cambia. */",
"   había abierto Fluyo (js/entry.js; nunca un identificador) y el idioma de la interfaz. */",
"   hasAutosave, presentIncomingDocument, showExampleStories y scRun). Las dos funciones puras de arriba se prueban en Node. */",
"   lienzo y sin bloquearlo, le da dos salidas: ver un sistema real en marcha (el ejemplo del botón «Ejemplo», en modo Historias y",
"   muestra, o al resolverla si se muestra (si se cierra la pestaña sin elegir, la próxima carga vuelve a ofrecerla).",
"   reproduciendo su primera Historia) o empezar en blanco. No es un tutorial ni un modal: Escape o tocar el lienzo la cierran.",
"   salidas apiladas, cada una con su línea de qué pasa al elegirla; la de «ver en marcha» es la destacada (button.primary). */",
"   salte atrás y vuelva a terminar). */",
"   su lista descarta el evento ENTERO: por eso `locale` pasa siempre por analyticsLocale(). */",
"  \"./js/entry.js\",",
"  \"editor.docTitle\":\"Fluyo — animated architecture diagram editor with GIF export\",",
"  \"editor.emptyCanvas\":\"Start by adding elements to the canvas.\",",
"  \"entry.blank\":\"Start blank\",",
"  \"entry.blankSub\":\"Draw your system, then tell what happens.\",",
"  \"entry.explore\":\"See a system in motion\",",
"  \"entry.exploreSub\":\"An online checkout, told step by step.\",",
"  \"entry.title\":\"Explain your system, not just draw it.\",",
"  \"help.addShape\":\"Pick a shape on the left → click the canvas.\",",
"  \"help.arrowHandles\":\"With an arrow selected, drag its {b:ends} (circles) to change side or shape, its {b:elbows} (squares), and the {b:bars} of each segment to slide it; double-click an elbow to remove it.\",",
"  \"help.clipboard\":\"{kbd:Ctrl+C} copy · {kbd:Ctrl+X} cut · {kbd:Ctrl+V} paste · {kbd:Ctrl+D} duplicate · {kbd:Ctrl+A} select all.\",",
"  \"help.connect\":\"Hover over a node and {b:drag the dot} that appears on the nearest side to connect.\",",
"  \"help.edit\":\"Double-click = edit text. {kbd:Del} deletes, or use the {b:trash can} in the panel header. {kbd:Esc} cancels.\",",
"  \"help.history\":\"{kbd:Ctrl+Z} undo · {kbd:Ctrl+Y} redo (or the arrows in the header).\",",
"  \"help.multiSelect\":\"{b:Drag on empty space} to select several; {kbd:Shift}+click adds or removes.\",",
"  \"help.pan\":\"{kbd:Right-click}, {kbd:Middle-click} or {kbd:Alt+Drag} to pan.\",",
"  \"help.present\":\"{kbd:P} presents full screen; {kbd:←} {kbd:→} change page.\",",
"  \"help.reroute\":\"{kbd:R} returns an arrow to its {b:automatic route}, undoing the segments you moved.\",",
"  \"help.touch\":\"Touch: {b:one finger} pans the canvas, {b:two fingers} zoom, double tap edits.\",",
"  \"help.touchBar\":\"Touch: with something selected you get {b:Connect} and {b:Select several} at the top and the {b:trash can} at the bottom. Tap the active tab to rename the page.\",",
"  \"help.wheel\":\"{kbd:Mouse wheel} scroll · {kbd:Ctrl+Wheel} zoom.\",",
"  \"more.privacyHref\":\"privacy/\",",
"  \"more.supportHref\":\"support/\",",
"  \"shell.privacyPath\":\"/privacy/\",",
"  \"shell.supportPath\":\"/support/\",",
"  \"shell.termsPath\":\"/terms/\",",
"  $(\"entryBlank\").onclick=()=>entryClose(\"blank\");",
"  $(\"entryExplore\").onclick=entryExplore;",
"  $(\"wrap\").addEventListener(\"pointerdown\", ev=>{ if(entryOpen && !entryBusy && !card.contains(ev.target)) entryClose(\"dismiss\"); }, true);",
"  /* Decisión 277: una línea que mezcla texto con teclas o énfasis se traduce ENTERA, con marcas {kbd:…} / {b:…} que se pintan",
"  /* FLUYO-GROWTH-FOUNDATION-001 (inglés publicable): data-i18n-link lleva un enlace a la página del mismo idioma (/privacy/ en vez de",
"  /* FLUYO-GROWTH-FOUNDATION-001 · inglés publicable: título del documento, enlaces legales y «Atajos y gestos» */",
"  /* FLUYO-GROWTH-FOUNDATION-001 · la tarjeta de entrada del primer minuto (js/entry.js) */",
"  /* FLUYO-I18N-002 S1: la pista del lienzo vacío, en el idioma de la interfaz (render.js conserva el español por defecto).",
"  /* Tocar el lienzo (no la tarjeta) es empezar en blanco sin decirlo; el gesto sigue su curso normal. */",
"  /* opts.present: Present reproduce con este mismo motor sin tocar el panel del editor.",
"  <tr><td><code>diagram_created</code></td><td>First edit that leaves nodes in a previously empty document, at most once per load. No properties.</td></tr>",
"  <tr><td><code>diagram_exported</code></td><td>File generated and download started. <code>format</code>: <code>gif</code>, <code>png</code>, <code>jpg</code> or <code>svg</code>. No confirmation that it reached the disk.</td></tr>",
"  <tr><td><code>diagram_saved</code></td><td>Explicit download started from Save; not autosave, and no confirmation that it reached the disk. <code>format: fluyo_json</code>.</td></tr>",
"  <tr><td><code>editor_opened</code></td><td>Once per editor load. <code>entry</code>: <code>direct</code>, <code>example</code> (arrived with <code>?ejemplo=</code>) or <code>link</code> (arrived with <code>#d=</code>), never the URL. <code>returning</code>: <code>yes</code> if this browser had opened Fluyo before, <code>no</code> otherwise (see “First visit”). <code>locale</code>: interface language (<code>es</code>, <code>en</code>, <code>fr</code>, <code>ja</code>, <code>zh</code> or <code>other</code>).</td></tr>",
"  <tr><td><code>editor_opened</code></td><td>Una vez por carga del editor. <code>entry</code>: <code>direct</code>, <code>example</code> (llegó con <code>?ejemplo=</code>) o <code>link</code> (llegó con <code>#d=</code>), sin la URL. <code>returning</code>: <code>yes</code> si este navegador ya había abierto Fluyo, <code>no</code> si no (ver «Primera visita»). <code>locale</code>: idioma de la interfaz (<code>es</code>, <code>en</code>, <code>fr</code>, <code>ja</code>, <code>zh</code> u <code>other</code>).</td></tr>",
"  <tr><td><code>entry_chosen</code></td><td>First visit only: what was done with the entry card. <code>choice</code>: <code>explore</code>, <code>blank</code> or <code>dismiss</code> (Escape, touching the canvas or opening something else).</td></tr>",
"  <tr><td><code>entry_chosen</code></td><td>Solo en la primera visita: qué se hizo con la tarjeta de entrada. <code>choice</code>: <code>explore</code>, <code>blank</code> o <code>dismiss</code> (Escape, tocar el lienzo o abrir otra cosa).</td></tr>",
"  <tr><td><code>example_loaded</code></td><td>A published example ended up open. <code>example</code>: identifier from the fixed list. <code>source</code>: <code>url</code> (<code>?ejemplo=</code>), <code>menu</code> (the “Example” button) or <code>entry</code> (the entry card).</td></tr>",
"  <tr><td><code>example_loaded</code></td><td>Un ejemplo publicado quedó abierto. <code>example</code>: identificador de la lista fija. <code>source</code>: <code>url</code> (<code>?ejemplo=</code>), <code>menu</code> (botón «Ejemplo») o <code>entry</code> (tarjeta de entrada).</td></tr>",
"  <tr><td><code>file_imported</code></td><td>A valid document was applied. <code>source</code>: <code>file</code> or <code>link</code>; <code>format: fluyo_json</code>. The source does not attribute MCP authorship.</td></tr>",
"  <tr><td><code>first_edit_completed</code></td><td>First real change per editor load. Selection, pan, zoom, navigation, import and restore do not count. No properties.</td></tr>",
"  <tr><td><code>gif_animation_added</code></td><td><code>anim</code>: key of one of the eight built-in animations.</td></tr>",
"  <tr><td><code>link_failed</code></td><td><code>reason</code>: <code>decode</code>, <code>schema</code>, <code>too_large</code> or <code>unsupported</code>.</td></tr>",
"  <tr><td><code>present_started</code></td><td>Entrada efectiva al modo presentación, también sin pantalla completa. Sin propiedades.</td></tr>",
"  <tr><td><code>present_started</code></td><td>Presentation mode actually entered, even without full screen. No properties.</td></tr>",
"  <tr><td><code>share_created</code></td><td>After confirming and actually creating a link within the limit. <code>kind</code>: <code>story</code> or <code>diagram</code>. <code>variants</code>: <code>yes</code> if its other ways travel with it, <code>no</code> otherwise.</td></tr>",
"  <tr><td><code>share_created</code></td><td>Tras confirmar y crear efectivamente un enlace dentro del límite. <code>kind</code>: <code>story</code> o <code>diagram</code>. <code>variants</code>: <code>yes</code> si viajan sus otras formas, <code>no</code> si no.</td></tr>",
"  <tr><td><code>share_opened_in_editor</code></td><td>When “Open in Fluyo” is explicitly pressed in the viewer. No properties.</td></tr>",
"  <tr><td><code>share_viewed</code></td><td>After the viewer's first successful render. <code>story</code>: <code>yes</code> if it carries a playable Story. <code>locale</code>: interface language, as above.</td></tr>",
"  <tr><td><code>share_viewed</code></td><td>Después del primer render exitoso del viewer. <code>story</code>: <code>yes</code> si trae una Historia reproducible. <code>locale</code>: idioma de la interfaz, como arriba.</td></tr>",
"  <tr><td><code>story_completed</code></td><td>Esa reproducción llegó al final, viéndola o saltando de momento en momento. <code>surface</code>: <code>editor</code> o <code>present</code>. Una vez por reproducción.</td></tr>",
"  <tr><td><code>story_completed</code></td><td>That playback reached the end, watched or skipped through. <code>surface</code>: <code>editor</code> or <code>present</code>. Once per playback.</td></tr>",
"  <tr><td><code>story_created</code></td><td>A Story was created in the editor. <code>origin</code>: <code>new</code>, <code>variant</code> (“Another way from here” or “Duplicate as failure”) or <code>copy</code> (duplicate). Never its name or its sentences.</td></tr>",
"  <tr><td><code>story_created</code></td><td>Se creó una Historia en el editor. <code>origin</code>: <code>new</code>, <code>variant</code> («Otra forma desde aquí» o «Duplicar como fallo») o <code>copy</code> (duplicar). Ni su nombre ni sus frases.</td></tr>",
"  <tr><td><code>story_started</code></td><td>A Story started playing. <code>surface</code>: <code>editor</code> or <code>present</code>. <code>trigger</code>: <code>user</code> or <code>entry</code> (started by the entry card). Once per playback, not per step.</td></tr>",
"  <tr><td><code>story_started</code></td><td>Empezó a reproducirse una Historia. <code>surface</code>: <code>editor</code> o <code>present</code>. <code>trigger</code>: <code>user</code> o <code>entry</code> (la arrancó la tarjeta de entrada). Una vez por reproducción, no por paso.</td></tr>",
"  <tr><td><code>viewer_story_completed</code></td><td>En el viewer, esa reproducción llegó al final. Sin propiedades. Una vez por reproducción.</td></tr>",
"  <tr><td><code>viewer_story_completed</code></td><td>In the viewer, that playback reached the end. No properties. Once per playback.</td></tr>",
"  <tr><td><code>viewer_story_started</code></td><td>En el viewer, al pulsar «Reproducir». Sin propiedades.</td></tr>",
"  <tr><td><code>viewer_story_started</code></td><td>In the viewer, when “Play” is pressed. No properties.</td></tr>",
"  <tr><td><strong>Umami Cloud</strong></td><td>Los eventos de la lista de arriba (sin pageviews), sin cookies ni identificadores</td><td>Analítica del editor</td></tr>",
"  <tr><td><strong>Umami Cloud</strong></td><td>The events listed above (no pageviews), without cookies or identifiers</td><td>Editor analytics</td></tr>",
"  <tr><th>Event</th><th>Meaning and properties</th></tr>",
"  border:1px solid var(--rule-2); border-radius:var(--r-lg); box-shadow:var(--shadow-menu);}",
"  card.hidden=false;",
"  const ATTRS=[[\"data-i18n-title\",\"title\"],[\"data-i18n-aria-label\",\"aria-label\"],[\"data-i18n-tip\",\"data-tip\"],[\"data-i18n-placeholder\",\"placeholder\"],[\"data-i18n-link\",\"href\"]];",
"  const RICH=/(\\{(?:kbd|b):[^{}]*\\})/;",
"  const card=$(\"entryCard\");",
"  const entry=(typeof EXAMPLE_SLUG!==\"undefined\" && EXAMPLE_SLUG) ? \"example\"",
"  const frame={renderState:buildEditorRenderState(), emptyHint:typeof FluyoI18n===\"object\" ? FluyoI18n.t(\"editor.emptyCanvas\",\"Empieza añadiendo elementos al lienzo.\") : undefined};",
"  const returning=(typeof ENTRY_STATE===\"object\" && ENTRY_STATE && ENTRY_STATE.returning) ? \"yes\" : \"no\";",
"  const state=entryStorageState(storage);",
"  document.addEventListener(\"keydown\", ev=>{ if(/^Esc(ape)?$/.test(ev.key) && entryOpen && !entryBusy) entryClose(\"dismiss\"); });",
"  editor_opened:{entry:[\"direct\",\"example\",\"link\"], returning:YES_NO, locale:ANALYTICS_LOCALES},",
"  entryBusy=true;",
"  entryOpen=false;",
"  entryOpen=true;",
"  entryRemember();",
"  entry_chosen:{choice:[\"explore\",\"blank\",\"dismiss\"]},",
"  example_loaded:{example:[\"demo\",\"compra-online\",\"inicio-de-sesion-oauth2\",\"pedido-asincrono-cola\",\"funnel-de-ventas\",\"onboarding-de-cliente\",\"cadena-de-suministro\",\"kafka-event-pipeline\",\"microservicios-api-gateway\",\"oauth2-flujo-autenticacion\",\"pipeline-etl-datos\",\"arquitectura-serverless-aws\"],",
"  fetchExample(EXAMPLE_DEMO)",
"  first_edit_completed:{}, diagram_created:{},",
"  for(const b of document.querySelectorAll(\"#entryCard button\")) b.disabled=true;",
"  function richOf(el){",
"  function setRich(el, text, d){",
"  if (created) scTrack(\"story_created\", { origin: \"new\" });",
"  if (created) {",
"  if (typeof trackEvent === \"function\") trackEvent(name, props);",
"  if(!ENTRY_STATE.offer){ if(ENTRY_STATE.available) entryRemember(); return; }",
"  if(!entryOpen || entryBusy) return;",
"  if(!entryOpen) return;",
"  if(card) card.hidden=true;",
"  if(entryOpen && !entryBusy && P().nodes.length) entryClose(\"dismiss\");",
"  if(story && story.status===\"running\" && !FluyoStoryClock.isPaused(story.clock) && FluyoStory.isFinished(story.playback)){",
"  if(typeof entryTick===\"function\") entryTick();",
"  if(typeof entryVisible===\"function\" && entryVisible()) frame.emptyHint=\"\";",
"  let deepLink=true, autosave=true;",
"  let storage=null;",
"  padding:10px 14px; text-align:left; white-space:normal;}",
"  render(ctx,now(),frame);",
"  return !deepLink && !autosave && !!state && state.available && !state.returning;",
"  return Object.assign({}, state, {offer:!!document.getElementById(\"entryCard\") && entryShouldOffer({deepLink, autosave, state})});",
"  return {entry, returning, locale:analyticsLocale()};",
"  scRunCounted = false;",
"  scRunSurface = inPresent ? \"present\" : \"editor\";",
"  scTrack(\"story_created\", { origin: \"copy\" });",
"  scTrack(\"story_created\", { origin: \"new\" });",
"  scTrack(\"story_created\", { origin: \"variant\" });",
"  scTrack(\"story_created\", { origin: \"variant\" });   /* «Duplicar como fallo»: otra forma de la misma Historia */",
"  scTrack(\"story_started\", { surface: scRunSurface, trigger: opts && opts.trigger === \"entry\" ? \"entry\" : \"user\" });",
"  share_created:{kind:[\"story\",\"diagram\"], variants:YES_NO},",
"  share_opened_in_editor:{},",
"  share_viewed:{story:YES_NO, locale:ANALYTICS_LOCALES},",
"  story={scenario:sc, playback:started.playback, status:\"running\", clock, counted:false};",
"  story_completed:{surface:[\"editor\",\"present\"]},",
"  story_created:{origin:[\"new\",\"variant\",\"copy\"]},",
"  story_started:{surface:[\"editor\",\"present\"], trigger:[\"user\",\"entry\"]},",
"  trackEvent(\"editor_opened\", editorOpenedProps());",
"  trackEvent(\"entry_chosen\", {choice});",
"  trackEvent(\"viewer_story_started\");",
"  try{",
"  try{ autosave=hasAutosave(); }catch(e){}",
"  try{ deepLink=urlBringsDocument() || entryUrlIsDeep(location.search, location.hash); }catch(e){}",
"  try{ storage=window.localStorage; }catch(e){}",
"  viewer_story_started:{}, viewer_story_completed:{}",
"  width:min(400px, calc(100% - 32px)); padding:22px 22px 20px; background:var(--surface); color:var(--ink);",
"  }",
"  }catch(e){ return \"other\"; }",
"  }catch(e){ return true; }",
"  }catch(e){ return {available:false, returning:false}; }",
"\"use strict\";",
"(function entryBoot(){",
".entryActions{display:flex; flex-direction:column; gap:8px;}",
".entryCard[hidden]{display:none;}",
".entryCard{position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:7; box-sizing:border-box;",
".entryLbl{font:500 var(--fs-ui)/1.25 var(--font-mono);}",
".entryOpt:not(.primary) .entrySub{color:var(--ink-3); opacity:1;}",
".entryOpt{display:flex; flex-direction:column; align-items:flex-start; gap:4px; width:100%; height:auto; min-height:var(--ctl-h-touch, 44px);",
".entrySub{font:400 var(--fs-label)/1.4 var(--font-mono); opacity:.78;}",
".entryTitle{font:400 21px/1.25 var(--font-serif); color:var(--ink); margin:0 0 16px;}",
"/* Dónde se reproduce la ejecución en curso y si ya contó su final (story_completed, una vez por reproducción aunque después se",
"/* El idioma de la interfaz de esta carga, reducido a la lista cerrada (nunca el del navegador ni el del documento). */",
"/* El lienzo dejó de estar vacío por otra vía (abrir un archivo, «Ejemplo», pegar…): la tarjeta ya no tiene sentido. La llama el",
"/* FLUYO-GROWTH-FOUNDATION-001 — La entrada del primer minuto (js/entry.js). Una tarjeta de papel en el centro del lienzo vacío,",
"/* FLUYO-GROWTH-FOUNDATION-001 — La entrada del primer minuto.",
"/* FLUYO-GROWTH-FOUNDATION-001: los eventos de la Historia (js/analytics.js, lista cerrada; nada del documento). Sin transporte",
"/* FLUYO-GROWTH-FOUNDATION-001: por dónde entró esta carga (sin la URL: solo si traía ejemplo o enlace), si este navegador ya",
"/* La URL trae (o trajo) un documento: además de lo que ya resolvieron examples.js y deeplink.js, cualquier `ejemplo=` o `d=`,",
"/* «Ver un sistema en marcha»: el ejemplo real del botón «Ejemplo», por la misma puerta que `?ejemplo=` (sin sesión guardada",
"/* ¿Este navegador ya había abierto Fluyo? `storage` = localStorage (o un doble en los tests). */",
"<h3 id=\"first-visit\">First visit</h3>",
"<h3 id=\"primera-visita\">Primera visita</h3>",
"<p><strong>No private URLs are sent.</strong> Automatic capture is disabled with <code>data-auto-track=\"false\"</code>. Query and fragment are excluded with <code>data-exclude-search</code> and <code>data-exclude-hash</code>; on top of that, the <code>data-before-send</code> filter rebuilds the payload with a fixed path <code>/</code>, a fixed title <code>Fluyo</code> and an empty referrer. No additional automatic browser properties are sent. Asynchronous loading uses a bounded in-memory queue; blocking Umami does not stop you from working.</p>",
"<p><strong>The content of your diagrams is never sent.</strong> Only the events and values in these closed lists are accepted. No file or node names, text, images, prompts, document IDs or personal data are sent. The comparison that detects the first edit happens only in local memory.</p>",
"<p>La primera vez que este navegador abre el editor sin traer un documento por el enlace, una tarjeta sobre el lienzo ofrece ver un ejemplo en marcha o empezar en blanco. Para no volver a ofrecerla, el editor guarda en <code>localStorage</code> la clave <code>fluyo.seen</code> con el valor <code>1</code>: sin fecha, sin identificador, y nunca se envía. Tampoco aparece si ya hay cualquier otra clave <code>fluyo.*</code> (sesión guardada, tema o idioma). Lo único que sale es su consecuencia, <code>returning: yes/no</code> en <code>editor_opened</code>; cuenta navegadores, no personas: en modo privado, tras borrar los datos del sitio o en otro dispositivo, cuenta como nuevo.</p>",
"<p>Lo que se registra es esta lista cerrada de eventos; la captura automática está desactivada y no hay pageviews:</p>",
"<p>The first time this browser opens the editor without a document in the link, a card over the canvas offers to watch an example in motion or to start blank. So that it is not offered again, the editor stores the key <code>fluyo.seen</code> with the value <code>1</code> in <code>localStorage</code>: no date, no identifier, and it is never sent. It does not appear either if any other <code>fluyo.*</code> key exists (saved session, theme or language). The only thing that leaves is its consequence, <code>returning: yes/no</code> in <code>editor_opened</code>; it counts browsers, not people: a private window, cleared site data or another device count as new.</p>",
"<p>What is recorded is this closed list of events; automatic capture is off and there are no pageviews:</p>",
"<script src=\"js/entry.js\"></script>",
"<title data-i18n=\"editor.docTitle\">Fluyo — editor de diagramas de arquitectura animados con export a GIF</title>",
"body.presenting .entryCard{display:none;}",
"const ANALYTICS_LOCALES = [\"es\",\"en\",\"fr\",\"ja\",\"zh\",\"other\"];",
"const ENTRY_SEEN_KEY = \"fluyo.seen\";",
"const ENTRY_STATE = (()=>{",
"const YES_NO = [\"yes\",\"no\"];",
"function analyticsLocale(){",
"function editorOpenedProps(){",
"function entryClose(choice){",
"function entryExplore(){",
"function entryRemember(){ try{ localStorage.setItem(ENTRY_SEEN_KEY, \"1\"); }catch(e){} }",
"function entryShouldOffer({deepLink, autosave, state}){",
"function entryStorageState(storage){",
"function entryTick(){",
"function entryUrlIsDeep(search, hash){",
"function entryVisible(){ return entryOpen; }",
"function scTrack(name, props) {",
"let entryOpen=false, entryBusy=false;",
"let scRunSurface = null,",
"}",
"})();"
]);
function undoGrowth(file, src) {
  const f = file.replace(/\\/g, "/"), pieces = PIECES[f];
  if (!pieces) return src;
  let out = src.replace(/\r\n/g, "\n");
  for (const [mine, base] of pieces) if (out.includes(mine)) out = out.replace(mine, () => base);
  return out;
}
module.exports = { undoGrowth, PIECES, NEW_FILES, BASE_GF, ADDED_LINES };
