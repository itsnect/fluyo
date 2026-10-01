# FLUYO-014 — Share Playback / First Use

Estado: DONE — listo para commit/push (ver «FLUYO-014.2»)
Owner/agente actual: Claude Code

> Repo público: contenido apto para publicarse (AGENTS.md §9).

## Objetivo

Que un enlace compartido (`/s/#d=…`) pueda abrirse como una mini-presentación: la persona que lo recibe pulsa **▶ Reproducir** y ve la Historia suceder, sin conocer Fluyo, Scenarios ni EventTypes. Sin backend, sin schema nuevo, sin segundo motor.

## Análisis de la arquitectura actual (verificado en código)

### Share hoy
- `createShareUrl` (`share-url.js`): `projectFromProjectData(serializeProject())` → `encodeDeepLink` → `/s/#d=<payload>`; tope `MAX_SHARE_URL_LENGTH = 65536` (65537 rechazado, `too_large`/`stage:"url"`).
- `serializeProject()` = `{version:5, app, doc, settings}`. El snapshot **ya incluye** `doc.eventTypes`, `pages[].scenarios` (Steps) y `presentation`/`motion`/`visualDuration`: no hace falta formato nuevo para transportar la Historia.
- `editor-share.js`: diálogo confirmar → crear → copiar; emite `share_created` (sin propiedades).
- Viewer (`s/index.html` + `viewer.js`): shell independiente; carga sólo `config, safe-svg, model, link-codec, geometry, render, analytics, share-loader, viewer-viewport, viewer`. Estado propio: viewport, página, reloj, `viewerGeneration`/`viewerInputKey` (invalidación de cargas por `hashchange`), `makeReadOnlyRenderState`. Emite `share_viewed`; «Abrir en Fluyo» = `buildOpenInFluyoURL(serializeProject(), …, viewerPayload)` (copia editable por deep link, nunca escribe al share).
- Hoy el Viewer **ignora** los Scenarios (decisión 23: sólo preserva `eventTypes` en roundtrip). Los tests de frontera (`viewer-harness.cjs`: `VIEWER_SCRIPTS`, `FORBIDDEN_SCRIPTS`, `FORBIDDEN_GLOBALS`; `render-boundary.cjs`) vigilan qué carga el viewer.

### Playback hoy
- `scenario-engine.js` (`FluyoScenarios.runScenario`) y `scenario-playback.js` (`FluyoScenarioPlayback.makePlayback/tick`) son **puros, sin DOM** (ya se prueban en `vm`): se pueden cargar tal cual en el Viewer.
- `render.js` ya pinta overlays si `renderState.scenarioRuntime` existe y ya depende de `eventTypeById` (de `model.js`, que sí está en el viewer). Nada que cambiar en el renderer.
- **Lo que NO es reutilizable hoy sin refactor**: la «receta» de ejecución vive dentro de `editor-scenarios.js` (2479 líneas, editor-only):
  - `scRun`: construcción de `stepMeta` (token, motion, nodeEffects, name), mapa código-de-error → mensaje humano, `makePlayback` + `startedAtReal`.
  - `scTick`: condición de «terminado» (cola vacía y sin sends/ocurrencias/efectos activos).
  - `buildScenarioRenderState`: proyección `tick → scenarioRuntime`.
  - `scPlaybackEffects`.
- `present-story.js` mezcla `FluyoPresentStory` (puro: `moments`, `currentIndex`, `caption`, `failedCount`, `summary`) con DOM/`scStatus`/`presenting` del editor.

### Selección de la Historia (pregunta del §8)
- No existe «Scenario activo» persistido. `scActiveId` es **estado efímero del editor**; `scActiveScenario()` = el seleccionado en la página actual, o `pages[cur].scenarios[0]`. `doc.cur` (página activa) sí viaja en el snapshot. Present (013) y «Historia» usan esa misma semántica; `presentHasStory()` = `steps.length>0`.
- Ambigüedad real: una página con varios Scenarios; el snapshot no dice cuál es «el» activo.
- **Solución sin schema** (propuesta): el viewer reproduce, para la página que muestra, `scenarios[0]` si tiene Steps (misma regla que el fallback del editor). Al crear un Share de Historia, el editor coloca el Scenario activo del autor **el primero** de su página en la copia del snapshot (el resto se conserva; sólo se reordena la copia, nunca el documento del autor). Así la elección del autor viaja sin campo nuevo. Cada página usa su `scenarios[0]`. Documentado como límite: el viewer sólo reproduce un Scenario por página.

## Decisiones propuestas (a confirmar en el cierre)

1. **Extraer, no duplicar**: nuevo script clásico compartido `js/story-playback.js` con la receta pura (`storyStepMeta`, `storyRunErrorMessage`, `storyRenderState`, `storyIsFinished`, `scPlaybackEffects`) y `FluyoPresentStory` (movido desde `present-story.js`, sin cambiar su API). `scRun`/`scTick`/`buildScenarioRenderState` del editor pasan a **llamar** a esas funciones: Editor, Present y Viewer comparten receta por construcción (mismo Scenario → mismo Trace). El viewer carga `scenario-engine.js`, `scenario-playback.js` y `story-playback.js`; **no** carga `editor-scenarios.js` ni `present-story.js`.
2. **Un solo bucle en el Viewer**: el playback se avanza dentro de `viewerLoop` (ya hay un RAF por generación); no se crean timers ni RAF propios. Playback y `scenarioRuntime` se descartan en `clearViewerDocument`, `goPage`, `bootViewer` (hashchange/reload/«Abrir en Fluyo») e invalidación por `viewerGeneration`.
3. **UX de compartir**: sin Historia en la página activa, el diálogo no cambia. Con Historia aparecen dos opciones en lenguaje llano: **«Compartir historia»** (por defecto; reproducible) y **«Compartir sólo el diagrama»** (el snapshot se serializa sin `scenarios` → más pequeño y sin Historia). Mismo codec, mismo fragmento, mismo límite; sin banderas nuevas en el documento.
   - Compat: un Share antiguo que ya llevaba Scenarios ahora ofrecerá «Reproducir historia». Es inocuo (los datos ya viajaban en el enlace) y se documenta.
4. **Viewer inicial** con Historia: canvas protagonista + nombre de la Historia + **▶ Reproducir historia**; durante la reproducción **■ Detener**; al terminar «Reproducción terminada» + **↻ Repetir** + «Abrir en Fluyo» (+ resumen humano «N eventos no pudieron realizarse»). Sin Historia: viewer como hasta ahora (aviso secundario opcional «Este diagrama no tiene una historia para reproducir.», nunca error, nunca se crea Scenario). No hay campo de descripción de Historia en el modelo: no se inventa.
5. **Lenguaje**: sólo nombres de Eventos/nodos y mensajes de `FluyoPresentStory.caption`; nada de `SEND/UP/DOWN/Trace/engineVersion`. Errores de ejecución → mensajes humanos existentes.
6. **Analytics**: sin eventos nuevos. Sólo `share_created` / `share_viewed`, sin propiedades.
7. **SW**: assets nuevos para el viewer (`story-playback.js`; engine/playback ya están en `ASSETS`) → subir `CACHE` v56 → v57 y verificar upgrade desde v56 y offline.
8. **Sin schema, sin backend, sin cambios** en `scenario-engine.js`, `scenario-playback.js`, `render.js`, `model.js` (salvo que una prueba demuestre lo contrario).

## Resultado (implementado)

Estado: **IMPLEMENTADO — pendiente de revisión de producto**; sin commit ni push.

### Arquitectura
`Scenario → js/story-playback.js (FluyoStory) → scenario-engine → Trace → scenario-playback → render.js`, usada por Editor (`scRun`/`scTick`/`buildScenarioRenderState`), Present (`presentStoryRefresh` → `FluyoStory.describe`) y Viewer (`storyPlay`/`renderViewerFrame`). Ninguno ejecuta el motor ni construye Playback por su cuenta (lo vigila `fluyo-014.test.cjs`). `FluyoPresentStory` pasa a ser alias de `FluyoStory` (misma API de 013).

### UX
- Viewer con Historia: lienzo + sección `#story` (nombre de la Historia, mensaje, «▶ Reproducir historia» → «■ Detener» → «↻ Repetir» + «Abrir en Fluyo»); fin: «Reproducción terminada» y, si algo no se completó, «N eventos no pudieron realizarse». Sin Historia: viewer como antes (sin aviso, sin crear Scenario).
- Editor: el botón Compartir no cambia. Con Historia en la página, el diálogo ofrece «Compartir historia» (por defecto) o «Compartir sólo el diagrama»; sin Historia, igual que antes. Texto de bloqueo sin jerga: «Detén la reproducción de la historia antes de compartir.»
- No existe campo de descripción de la Historia en el modelo: el viewer muestra sólo el nombre (no se inventó schema).

### Compatibilidad / privacidad / límites
- Schema v5 intacto; sin cambios en `scenario-engine.js`, `scenario-playback.js`, `render.js`, `model.js`. Share sin opciones = comportamiento anterior; un Share antiguo con Scenarios ahora es reproducible.
- Selección: `scenarios[0]` de la página; el activo del autor se coloca primero **en la copia**. El Viewer reproduce un Scenario por página y no permite cambiarlo.
- Misma privacidad (fragmento, sin red), mismo límite 65536/65537 y mensaje «demasiado grande…»; sólo `share_created`/`share_viewed`, sin propiedades. Sin backend.
- SW: `CACHE` v56 → v57 (`story-playback.js` nuevo en el shell; engine/playback ya estaban en `ASSETS`).
- Límite conocido (heredado de 013): un Scenario con `engineVersion` no soportado ofrece «Reproducir» y muestra el mensaje humano existente («…versión de ejecución no soportada») sin ejecutar nada.

### Archivos
Nuevos: `js/story-playback.js`, `test/fluyo-014.test.cjs`, `test/fluyo-014-browser.cjs`. Modificados: `js/editor-scenarios.js`, `js/present-story.js`, `js/viewer.js`, `js/share-url.js`, `js/editor-share.js`, `s/index.html`, `index.html`, `css/share.css`, `css/styles.css`, `sw.js`, `test/viewer-harness.cjs` y los tests que fijaban el contrato anterior (viewer sin motor, caché v56, contexto vm de scenario-playback; `fluyo-013.test.cjs` lee ahora la parte pura de `story-playback.js`), `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (53–56).

### Pruebas ejecutadas
- Línea base antes de tocar: `node --test test/*.test.cjs` 413/413. Final: **431/431** (+18 de `fluyo-014.test.cjs`).
- `node test/fluyo-014-browser.cjs` (Chrome real, Playwright externo vía NODE_PATH): 13 bloques OK — diálogo de compartir; Negocio (💵, simultáneo, fin, Repetir, Detener); paridad Viewer↔Present (Trace, metadata y registro idénticos byte a byte; duración ±900 ms; mismo cierre); Humano; Kafka caído; Efectos (símbolo, mensaje de color, duración personalizada 2500 ms, movimiento lento); sin Historia / sólo diagrama / Share antiguo; varios Scenarios; A→B→A, Play→hashchange/Back/Forward/Reload/cerrar-reabrir/«Abrir en Fluyo»; 40 Steps; 390×844 · 768×1024 · 1366×768 · 1920×1080 (sin scroll horizontal, controles dentro del viewport, lienzo ≥ 40 % de la altura, diagrama visible); offline tras instalar el SW; upgrade del SW v56→v57.
- QA adversarial puntual (script fuera del repo, ejecutado): engineVersion futuro, conexión perdida, 60 EventTypes con mensajes de 400 caracteres, Espacio sobre el botón, arrastre del lienzo durante Play, Presentar durante Play.
- Mutaciones sobre copias aisladas (ninguna queda en el árbol): M1 sin limpieza al navegar, M2 runtime anterior conservado, M3 Trace alterado, M4 Step alterado, M5 doble Playback (sobrevivía → se endureció el test), M6 sin hashchange, M7 sin limpieza al arrancar/recargar, M8 escritura desde el Viewer, M9 duración alterada, M10 orden alterado, M11 sin limpieza al cambiar de página, M12 receta propia en el editor (la detecta el smoke de paridad). Todas detectadas.
- Regresión Chrome: `fluyo-013-browser`, `fluyo-013-qa-browser`, `scenario-qa-browser` (assert del viewer actualizado: ahora sí carga el motor), `fluyo-011-manual-smoke` y `share-browser` (parte file://) OK. NOT RUN: gate de privacidad de `share-browser` (requiere el script de Umami como argumento) y upgrade legacy v39 de `scenario-qa-browser` (sin commit histórico). `fluyo-011-browser` conserva sus 4 fallos previos de 013.

## Plan (histórico)

- [ ] 1. Red de seguridad: ejecutar suite actual (`node --test test/*.test.cjs`) y registrar línea base (413 esperado; `fluyo-011-browser` tiene 4 fallos previos documentados en 013).
- [ ] 2. Crear `js/story-playback.js` (extracción pura) y refactorizar `editor-scenarios.js` + `present-story.js` para usarlo; probar paridad Trace/log/stepMeta con 013 antes de tocar el viewer.
- [ ] 3. Viewer: cargar scripts, estado de Historia, controles, bucle, limpieza por generación; `s/index.html` + `css/share.css`.
- [ ] 4. Editor: diálogo «historia / diagrama», reordenado de la copia del snapshot, mensaje de bloqueo sin jerga.
- [ ] 5. Tests: `test/fluyo-014.test.cjs` y `test/fluyo-014-browser.cjs` (casos Negocio, Humano, Sistema con Kafka caído, Simultáneo, Efectos; A→B→A, Back/Forward, reload, Play→navegar/Abrir en Fluyo; 390/768/1366/1920; offline; paridad con Present).
- [ ] 6. Actualizar `test/viewer-harness.cjs` (`VIEWER_SCRIPTS`, forbidden) y `render-boundary.cjs`.
- [ ] 7. QA adversarial y mutaciones (§34–35), sin dejar ninguna.
- [ ] 8. Documentación: `ARCHITECTURE.md`, `DECISIONS.md`, este handoff. Sin commit ni push; no iniciar FLUYO-015.

## Riesgos conocidos

- El refactor toca `scRun/scTick` del editor: mitigado con paridad medida y suite completa.
- `story-playback.js` depende de globals de `model.js` (cargado en ambos shells): el orden de scripts importa (después de `model.js`, antes de `viewer.js`).
- `fluyo-011-browser.cjs` tiene 4 fallos previos e independientes (013); no se tocan.
- Documentos grandes: una Historia con muchos Steps puede superar 65536; el mensaje existente aplica y el modo «sólo diagrama» es la salida.

## Archivos previstos

`js/story-playback.js` (nuevo), `js/editor-scenarios.js`, `js/present-story.js`, `js/viewer.js`, `js/editor-share.js`, `s/index.html`, `index.html` (diálogo), `css/share.css`, `css/styles.css`, `sw.js`, tests, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`.

## Handoff

### Estado actual
IMPLEMENTADO (ver «Resultado»). Antes: bootstrap hecho (AGENTS, ARCHITECTURE, DECISIONS, PRODUCT, tareas 006/008/011/012/013; `.ai/tasks/FLUYO-012.1.md` no existe, 012.1 está dentro de `FLUYO-012.md`). Archivos inspeccionados: `share-url.js`, `viewer.js`, `share-loader.js`, `editor-share.js`, `editor-scenarios.js` (scRun/scTick/render state), `scenario-engine.js`, `scenario-playback.js`, `present-story.js`, `render.js`, `model.js`, `s/index.html`, `sw.js`, harness de tests del viewer. Ningún archivo de código modificado.

### Próximo paso concreto
Confirmar las decisiones 1–3 y empezar por el plan 1–2 (línea base de tests y extracción a `js/story-playback.js` con paridad).

## FLUYO-014.1 — Share desde `file://`
Causa: `start .\index.html` ejecuta el editor en `file:`; `createShareUrl`/`editor-share.js` exigían http(s), deshabilitaban «Crear enlace» y sólo mostraban un mensaje discreto (parecía roto). Corrección: `shareBaseUrl()` usa `https://fluyo.space/` como base cuando el origen no es web (payload autocontenido, idéntico al de https); el diálogo avisa en vez de bloquear. SW v58. Ver decisión 57. No verificado en navegador real (el panel integrado no ejecuta `file://`); cubierto por vm (`share.test.cjs`) y `share-browser.cjs` (no ejecutado, sin Playwright).

## FLUYO-014.2 — Verificación real (Chrome 'chrome', Playwright fuera del repo)
Estado final: **DONE**, con una dependencia de despliegue (abajo).
- **Causa/solución**: ver 014.1 y decisión 57 (`file:` bloqueaba «Crear enlace»; ahora base pública `https://fluyo.space/`, payload idéntico).
- **file:// real** (`file:///C:/Proyectos/fluyo-new/fluyo/index.html`, clics reales en la UI): Historia → `https://fluyo.space/s/#d=…`; Diagrama → ídem; Historia otra vez → hash idéntico al primero (sin estado residual). El diálogo avisa («archivo local…») sin bloquear; «Copiar enlace» visible; el enlace se crea sin depender del Clipboard. Doc/undo/página/selección idénticos antes y después.
- **Viewer** (fluyo.space simulado con los archivos locales v58): historia → «▶ Reproducir historia»; 💵 sobre la flecha a los ~0,5 s, 📦 + «Pedido recibido» a los 2 s, «Reproducción terminada» ≈3,5 s; Steps idénticos a los del editor. Diagrama → sin `#story`/«Reproducir», 2 nodos, 0 Scenarios. Capturas en el scratchpad de la sesión.
- **localhost** (`http://localhost:8124/s/#d=…`): ambos modos conservan el origen local; payload idéntico al de file:// y al de https; Viewer OK.
- **Payload**: file:// == https (historia y diagrama); sólo cambia el prefijo.
- **Producción real**: `https://fluyo.space` sirve hoy SW **v56** (sin 014: el visor no carga `story-playback.js`). Un enlace creado desde file:// abre allí el diagrama (2 nodos… sin «Reproducir»; no hay `#stPlay`). **Hasta desplegar 014+014.1, los enlaces de Historia no reproducen en producción.** No se hizo deploy.
- **Adversarial (file://)**: sin Scenario, Historia vacía, mensaje largo (60), dos Shares seguidos, tras `scReset`, tras «Limpiar página», 600 nodos (18 297 caracteres) → enlace correcto. Varias páginas: no probado (no encontré la acción de añadir página por API). Tras terminar el playback el diálogo sigue pidiendo «Detén la reproducción…» sin «Crear enlace» (comportamiento previo: el playback queda «activo» hasta Stop/Reset) — riesgo/UX pendiente, no tocado.
- **SW**: v57 simulado (sw + share-url antiguos) → update → solo queda `fluyo-static-v58`, archivos nuevos servidos; Share y Viewer OK con SW v58; Viewer offline OK. (Un primer intento mostró v57 persistente por recargar a mitad de activación; repetido con espera, correcto.)
- **Tests**: `node --test test/*.test.cjs` 432/432; `node --check js/*.js` OK; browser: `fluyo-014-browser` OK (13 bloques), `fluyo-013-browser` OK, `fluyo-013-qa-browser` OK, `share-browser` OK salvo el gate de privacidad (NOT RUN: requiere script Umami). `share-browser.cjs` exige el módulo `playwright` (shim a playwright-core en el scratchpad).
