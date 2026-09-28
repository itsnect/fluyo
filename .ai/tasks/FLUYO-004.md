# FLUYO-004 — Viewer Boundary

Estado: DONE (segundo ciclo implementado y validado)
Owner/agente actual: Codex

> Esta tarea es la **fuente de verdad** de su trabajo: cualquier agente (Codex, Claude Code, OpenCode/Kimi) debe poder continuar leyendo solo esta tarea + `AGENTS.md`. Mantenla actualizada en cada sesión, especialmente la sección Handoff. No dupliques aquí lo que ya está en `.ai/DECISIONS.md` o `.ai/ARCHITECTURE.md`: enlázalo.
>
> **Repo público**: este archivo puede terminar publicado en GitHub. Escribe solo contenido apto para público: nada de información confidencial, métricas privadas, credenciales, estrategia comercial ni roadmap privado (ver `AGENTS.md` §9).

## Objetivo

Separar, dentro del editor actual y sin tocar su comportamiento, el modelo/documento, el estado mutable del editor, el estado del viewport y el renderer, de modo que `render.js`/`draw()` reciba explícitamente el estado necesario para pintar en lugar de leer globals de interacción del editor.

## Por qué

`render.js` depende hoy implícitamente de múltiples variables globales del editor declaradas junto al modelo en `js/state.js`. Esto impide reutilizar el renderer de forma robusta desde un viewer read-only. Construir esa frontera ahora permite que `FLUYO-005` reutilice el mismo renderer sin duplicarlo ni crear globals ficticios.

## Alcance

### Incluye

- Auditar las dependencias reales de `render.js` y clasificarlas en modelo/documento, viewport e interacción/editor.
- Reorganizar el estado para distinguir esas tres categorías.
- Diseñar y pasar explícitamente al renderer un estado de render que incluya lo que realmente necesita pintar.
- Refactorizar `draw()` y funciones auxiliares del renderer para que no lean globals de interacción.
- Mantener el comportamiento visual e interactivo del editor idéntico.
- Añadir una forma trivial de producir estado de render read-only.
- Añadir tests/harness que demuestren que el renderer puede ejecutarse sin estado editable completo.
- Validar sintaxis JS y pruebas existentes.

### No incluye

- Botón Share, `/s/<id>`, viewer HTML definitivo, backend, APIs, object storage, delete token, cuentas, autenticación, analytics Share, noindex de una página que todavía no existe ni Open in Fluyo.
- Cambiar el formato `.fluyo.json`.
- Añadir framework, build system o dependencias npm.
- Cambiar UI, estilos o funcionalidades de producto.
- Continuar con `FLUYO-005`.

## Contexto necesario

Leer (solo esto antes de empezar):
- `AGENTS.md`.
- Esta tarea.
- `.ai/tasks/FLUYO-003.md` (contexto del diseño de Share y la división en tres tareas).
- Búsquedas dirigidas en `js/render.js`, `js/state.js`, `js/interaction.js`, `js/selection.js`, `js/ui.js` y `js/geometry.js` para identificar dependencias.

No es necesario leer:
- `.ai/PRODUCT.md`, `.ai/DECISIONS.md` salvo referencias concretas.
- Repositorios hermanos.
- Páginas estáticas no mencionadas.

## Criterios de aceptación

- [x] Existe `.ai/tasks/FLUYO-004.md` actualizado con handoff completo.
- [x] Las dependencias externas actuales de `render.js` quedaron auditadas y clasificadas.
- [x] Documento, viewport e interacción están conceptualmente separados en el código.
- [x] El renderer ya no depende implícitamente de globals de interacción del editor.
- [x] El editor pasa explícitamente el estado necesario al renderer.
- [x] Existe una forma trivial de crear estado read-only de render.
- [x] Renderer y editor mantienen comportamiento actual (verificado por tests; validación visual pendiente).
- [x] `.fluyo.json` no cambia.
- [x] No se implementó Share.
- [x] No se añadió backend.
- [x] No se añadió framework/build/dependencias.
- [x] Tests/verificaciones pasan.
- [x] Handoff suficiente para que otro agente pueda construir `FLUYO-005`.

## Plan

- [x] Leer `AGENTS.md` y crear esta tarea con el template.
- [x] Releer `AGENTS.md` y esta tarea; luego auditar `render.js` y dependencias.
- [x] Clasificar dependencias: documento/modelo, viewport, interacción/editor.
- [x] Diseñar estructura explícita de render state.
- [x] Refactorizar `render.js`/`draw()` para recibir estado explícito.
- [x] Actualizar `state.js`, `export.js` y otros consumidores para construir/pasar el estado.
- [x] Añadir helper de estado read-only y harness/test.
- [x] Ejecutar tests, validar sintaxis y `git diff --check`.
- [x] Completar handoff.

## Auditoría de dependencias de `render.js`

Las dependencias externas reales de `js/render.js` se clasifican así:

### Modelo / documento

- `doc` (`theme`, `customBg`, `pages`, `cur`).
- `settings` (`speed`, `dots`, `build`, `stagger`, `grid`, `font`, `single`).
- `P()` — página activa (`nodes`, `edges`).
- `getBounds()` — cálculo de bounds sobre el documento.
- Funciones puras de geometría/config: `nodeById`, `edgeById`, `edgePoints`, `labelLayout`, `labelPointFor`, `placeEdgeLabels`, `refreshEdgeLabels`, `codeBlockLayout`, `codeColors`, `codeFont`, `bendableSegs`, `sidePoint`, `nearestAnchorSide`, `polyLen`, `pointAt`, `THEMES`, `PALETTE`, `ICONS`, `ANIMS`, `DEFAULT_FONT`, `DEFAULT_SIZES`, `GRID`, `HANDLE`, `SEG_GRIP`, `ARROW_OFF`, `ANCHOR_SNAP`, `SIDES`, `DIR`, `hexA`, `clamp`, `lerp`, `smooth`, `normRect`, `iconURLFor`, `nodeIconTint`, `getImg`.

### Viewport

- `viewX`, `viewY`, `viewZoom`.
- `cv` / `c.canvas` — dimensiones del canvas.
- `presenting` — modo presentación (afecta qué se dibuja).

### Interacción / editor

- Selección: `selN`, `selE`, `singleSel()`.
- Hover: `hoverNode`.
- Edición in-situ: `editing`.
- Modo/herramientas: `mode`, `pendingShape`, `pendingIcon`, `pendingAnim`, `connecting`.
- Gestos en curso: `drag`, `resizing`, `wpDrag`, `connectDrag`, `endDrag`, `segDrag`, `marquee`.
- Cursor: `mouse`.
- Flechas de conexión: `arrowHostNode()`.
- Post-render del editor: `syncEditBoxIfMoved()`.

### Animación

- `now()` — tiempo del reloj; ya se pasa como `t` a `render()`.

## Decisiones tomadas

- El renderer recibe un `renderState` obligatorio como parte de `opts` (`opts.renderState`). Si no se proporciona, falla explícitamente.
- `renderState` se divide en tres grupos:
  - `viewport`: `x`, `y`, `zoom`, `width`, `height`, `presenting`.
  - `interaction`: `mode`, `pendingShape`, `pendingIcon`, `pendingAnim`, `connecting`, `drag`, `resizing`, `wpDrag`, `connectDrag`, `endDrag`, `segDrag`, `marquee`, `hoverNode`, `editing`, `mouse`.
  - `selection`: `nodes` (Set), `edges` (Set), `single` (`{type,obj}` o `null`), `arrowHost` (nodo anfitrión de flechas de conexión o `null`).
- `buildEditorRenderState()` vive en `js/editor-runtime.js`, junto al reloj, resize, post-render y bucle RAF exclusivos del editor.
- `makeReadOnlyRenderState(viewport)` vive en `js/render.js` y no depende del editor. Devuelve selección/hover/drag/edición vacíos, modo `select` y ninguna herramienta pendiente.
- `resizeCanvas(canvas, container)` es una utilidad compartida explícita. `editor-runtime.js` obtiene el canvas/contenedor del editor y gestiona sus resizes.
- El post-render del editor (`syncEditBoxIfMoved`) se ejecuta desde `editor-runtime.js`, fuera del renderer compartido.
- El modelo/documento (`doc`, `settings`, `P()`, factories, normalización, serialización y helpers puros) vive en `js/model.js`, sin DOM, persistencia ni estado de interacción.
- No se introducen módulos ES, build system, framework ni dependencias; se respeta el modelo de scripts clásicos.

## Archivos modificados

- `js/model.js` — modelo/documento compartido: datos, factories, serialización, normalización, bounds, utilidades y resolvers puros de selección/arrow host.
- `js/state.js` — runtime mutable, DOM, integración y persistencia exclusivos del editor; ya no contiene el modelo compartido ni estado de render.
- `js/render.js` — renderer compartido sin bootstrap ni RAF; `renderState` obligatorio y helper read-only independiente.
- `js/editor-runtime.js` — reloj, construcción de estado del editor, resize, post-render y bucle RAF exclusivos del editor.
- `js/export.js` — las llamadas a `render()` en exportación pasan `renderState: makeReadOnlyRenderState({width, height})`.
- `js/ui.js` — presentación programa el resize mediante el runtime específico del editor.
- `js/selection.js` / `js/interaction.js` — `singleSel()` y `arrowHostNode()` usan resolvers únicos compartidos; comentarios actualizados.
- `index.html` — carga `model.js` y `editor-runtime.js` en el orden clásico requerido.
- `sw.js` — CACHE `v29` → `v32` e inclusión de los dos scripts nuevos.
- `test/render-boundary.cjs` — verificación de sintaxis concatenando scripts del editor completo y del viewer mínimo.
- `test/render-boundary-run.cjs` — ejecución real del renderer con mocks de DOM/Canvas, demostrando `makeReadOnlyRenderState` y `buildEditorRenderState`.
- `test/viewer-boundary.html` — harness manual para validar en navegador que el renderer funciona con el core read-only.
- `test/editor-runtime.cjs` — regresión automatizada del frame del editor y resize diferido de presentación.

## Pruebas

- `node test/render-boundary.cjs`: compila sin errores la secuencia completa del editor (`config` → `analytics`) y la secuencia mínima del viewer read-only (`config` → `state` → `geometry` → `render`). PASS.
- `node test/render-boundary-run.cjs`: ejecuta el renderer con mocks mínimos de DOM/Canvas usando `makeReadOnlyRenderState()` y `buildEditorRenderState()`. Verifica que el estado read-only tenga selección/interacción vacías y que el estado editor refleje la selección. PASS.
- `node --test test/analytics.test.cjs`: regresión de analytics tras no tocar `js/analytics.js`. 13/13 PASS.
- `git diff --check`: sin errores de espacios en blanco.

### Checklist manual pendiente

- [ ] Abrir `index.html` desde `file://` y HTTP local; consola sin errores; render inicial, pan, zoom, selección, drag/resize, conexiones, edición de texto, marquee y presentación deben verse idénticos.
- [ ] Abrir `test/viewer-boundary.html` en navegador; todos los mensajes deben ser PASS.
- [ ] Exportar PNG/JPG/SVG/GIF y comprobar que la salida es idéntica a la anterior.
- [ ] Guardar `.fluyo.json`, recargar y comprobar integridad del formato.

## Pendientes / riesgos

- Falta validación visual real en navegador (no hay Chrome/Edge disponible en este entorno). Es el paso más importante antes de considerar la tarea totalmente cerrada.
- `buildEditorRenderState()` replica la lógica de `arrowHostNode()` de `js/selection.js`. Es una duplicación pequeña pero deliberada para romper la dependencia del renderer con `selection.js`. Si cambia `arrowHostNode()`, hay que actualizar `buildEditorRenderState()`.
- El viewer de `FLUYO-005` deberá implementar su propio bucle que llame a `resizeCanvas(canvas, container)` y construya su `renderState` (probablemente con `makeReadOnlyRenderState` y añadiendo solo pan/zoom/presentación).
- No se tocó `js/analytics.js`; `FLUYO-005` seguirá necesitando separar el transporte de la instrumentación del editor/viewer.

## Handoff original (supersedido por la revisión independiente)

### Estado actual

Este era el estado reportado por el agente implementador antes de la revisión independiente:

- `js/render.js` ya no lee globals de interacción del editor (`selN`, `selE`, `singleSel`, `editing`, `mode`, `drag`, `resizing`, `wpDrag`, `connectDrag`, `endDrag`, `marquee`, `pendingShape`, `pendingIcon`, `pendingAnim`, `hoverNode`, `connecting`, `mouse`, `presenting`, `viewX`, `viewY`, `viewZoom`, `cv`).
- El editor pasa explícitamente `buildEditorRenderState()` al bucle de render.
- `makeReadOnlyRenderState(viewport)` permite construir un estado read-only trivial.
- Las exportaciones usan `makeReadOnlyRenderState()`.
- Se añadieron tests automatizables de sintaxis y ejecución con mocks.
- No se tocó el formato `.fluyo.json`, ni se implementó Share/backend/dependencias.

Pendiente la validación visual real en navegador (checklist manual).

### Próximo paso concreto

Ejecutar la checklist manual de validación visual:

1. Abrir `index.html` en `file://` y HTTP local; comprobar que el editor renderiza y que selección, drag/resize, conexiones, edición de texto, marquee, pan/zoom y presentación se comportan exactamente igual.
2. Abrir `test/viewer-boundary.html` en navegador y confirmar PASS en todas las comprobaciones.
3. Probar export PNG/JPG/SVG/GIF y guardar/cargar `.fluyo.json`.

Esta recomendación queda supersedida por los defectos de frontera documentados a continuación; no continuar con `FLUYO-005` todavía.

## Revisión independiente (Codex, 2026-09-28)

### Veredicto

**CHANGES REQUIRED.** La parametrización interna de `render()` elimina correctamente las lecturas directas de selección, hover, drag, resize, conexión, edición, marquee, herramientas, mouse, modo, presentación y viewport. Sin embargo, la frontera cargable por un viewer todavía no es real:

- `js/render.js` contiene y arranca el bucle del editor; ese bloque sigue leyendo `cv`, `$`, `buildEditorRenderState()` y `syncEditBoxIfMoved`, además del reloj mutable `playing`/`t0`/`pausedAt`.
- El fallback de `render()` depende globalmente de `makeReadOnlyRenderState()`.
- El supuesto core de viewer de los tests carga `js/state.js`, archivo que crea canvas/contexto, todo el estado mutable del editor, timers, autosave y acceso a `localStorage`.

Por tanto, `FLUYO-005` no puede cargar hoy únicamente modelo + geometría + renderer: tendría que cargar el estado editable completo o introducir globals/mocks de editor. La corrección recomendada dentro de FLUYO-004 es separar el modelo compartido y el renderer puro del bootstrap/bucle/estado/autosave del editor. No se hizo ese refactor durante esta revisión porque ya no sería una corrección pequeña.

### Correcciones realizadas

- Se corrigieron las dos llamadas residuales de presentación a la firma extraída `resizeCanvas(canvas, container)`. Antes, entrar llamaba `resizeCanvas()` y salir pasaba la función directamente a `requestAnimationFrame`, que entregaba el timestamp como primer argumento; ambas rutas producían `TypeError`.
- Se actualizó la versión del service worker a `fluyo-static-v31` para distribuir la corrección de `js/ui.js`.
- Se corrigieron comentarios obsoletos sobre el consumo de `arrowHostNode()` por `render.js`.

### Evaluación adicional

- `renderState` no es mutado por el renderer. Contiene `segDrag`, que no se consume, y entrega objetos mutables completos para varios campos usados solo por truthiness; conviene estrechar el contrato al separar el core, aunque esto no causa por sí solo una regresión funcional.
- El fallback read-only es cómodo para export, pero en el renderer general puede ocultar una integración que olvidó pasar el estado y perder silenciosamente selección/overlays. Una vez separados los entrypoints, el editor debería exigir estado explícito y el viewer construir el suyo deliberadamente.
- La lógica de `arrowHostNode()` está duplicada exactamente en `buildEditorRenderState()`: resolución de selección única, preferencia de `hoverNode` y descarte de nodos fuera de la página. El riesgo actual es bajo y está documentado, pero la corrección mínima futura es extraer un resolver puro compartido por ambos consumidores.
- PNG, JPG y GIF siguen pasando por el renderer Canvas con estado read-only, que elimina solo adornos de edición y conserva todos los elementos del documento. SVG conserva su renderer vectorial independiente y no usa `render()`; no fue afectado por el cambio.
- La rama de export retorna antes de consumir viewport, por lo que las transformaciones de escala/bounds siguen en `export.js`. El resize mantiene el comportamiento previo (píxeles CSS, sin cambio de devicePixelRatio). Pan y zoom se entregan explícitamente. Presentación quedó corregida y validada en navegador.
- No cambió serialización, versión, normalización/migraciones, IDs ni compatibilidad de `.fluyo.json`.
- No aparecieron Share, backend, viewer productivo, dependencias, build system ni cambios de producto.

### Pruebas de la revisión

- `node test/render-boundary.cjs`: PASS.
- `node test/render-boundary-run.cjs`: PASS.
- `node --test test/analytics.test.cjs`: 13/13 PASS.
- `node --check` sobre `js/*.js` y `sw.js`: PASS.
- `git diff --check`: PASS.
- `test/viewer-boundary.html` por HTTP en navegador real: todos los mensajes PASS.
- Editor real por HTTP: entrada y salida de presentación, consola limpia tras las correcciones.
- Export real en navegador: PNG, JPG, SVG y GIF completados sin errores de consola.

Los tests añadidos son útiles como smoke tests, pero insuficientes como prueba de frontera: compilan una secuencia que incluye `state.js`, el mock proporciona DOM/canvas/localStorage y `requestAnimationFrame` no ejecuta el bucle. Así no detectan las dependencias de bootstrap/editor ni detectaron la regresión de presentación.

### Próximo paso concreto

Mantener FLUYO-004 abierta y separar, antes de FLUYO-005, (1) modelo/normalización compartidos de `state.js`, y (2) el bucle/bootstrap del editor de `render.js`. Actualizar el harness para cargar el core sin estado editable, sin autosave/localStorage y sin funciones de selección/interacción/UI/export; añadir una prueba que ejecute al menos un frame del entrypoint real y cubra entrada/salida de presentación.

## Segundo ciclo de implementación (Codex, 2026-09-28)

### Resultado

Se resolvieron los hallazgos de la revisión independiente. La frase principal de aceptación queda demostrada por ejecución:

> Un consumidor read-only puede cargar `config.js`, `model.js`, `geometry.js` y `render.js`, normalizar un documento y renderizarlo con su propio viewport sin cargar runtime, estado mutable, persistencia ni UI del editor.

### Nueva frontera de archivos

```text
Core compartido read-only
  config.js
  model.js       documento, settings, factories, normalización/serialización
  geometry.js    cálculo geométrico
  render.js      Canvas renderer + makeReadOnlyRenderState

Editor
  state.js           DOM, viewport/interacción mutable, autosave/localStorage
  selection.js       selección, clipboard, undo/redo
  interaction.js     gestos y edición
  editor-runtime.js  reloj, buildEditorRenderState, resize, post-render, RAF
  ui.js / export.js  producto editor
```

`render.js` no inicia ningún loop, no obtiene controles DOM y no conoce `cv`, `$`, reloj, selección ni callbacks del editor. `render()` exige `opts.renderState`; omitirlo lanza un `TypeError` explícito. Las exportaciones Canvas pasan siempre `makeReadOnlyRenderState(...)`.

### Resolución de cada hallazgo de QA

- **Bootstrap/RAF en renderer:** extraído íntegramente a `editor-runtime.js`.
- **Dependencias `cv`, `$`, `playing`, `t0`, `pausedAt`:** existen solo en la capa del editor; ninguna queda en `render.js`.
- **`buildEditorRenderState()` / `syncEditBoxIfMoved()`:** construcción y post-render movidos al runtime del editor.
- **Modelo mezclado con editor:** `model.js` contiene únicamente modelo, contrato `.fluyo.json`, factories y helpers puros; no usa DOM, autosave ni `localStorage`.
- **Harness artificial:** ahora carga solo los cuatro scripts compartidos y el contexto Node no declara DOM, `localStorage`, RAF ni globals falsos de editor.
- **Fallback silencioso:** eliminado; se prueba que la llamada incompleta falla.
- **Duplicación `arrowHostNode`:** eliminada mediante `resolveSingleSelection()` y `resolveArrowHost()`, usados por selección y runtime.
- **Presentación/resize:** `scheduleEditorResize()` encapsula el callback RAF y `resizeEditorCanvas()` siempre llama `resizeCanvas(cv, $("wrap"))`. El test automatizado invoca los callbacks con timestamps para impedir la regresión encontrada por QA.
- **Caché:** `fluyo-static-v32`, con `model.js` y `editor-runtime.js` incluidos.

### Contrato final de render

```js
render(contexto2D, tiempo, { renderState, export?, transparent?, bg?, bounds? })
```

`renderState` contiene solo datos de pintura:

- `viewport`: `x`, `y`, `zoom`, `width`, `height`, `presenting`;
- `interaction`: modo, flags de herramientas/gestos, conexión/arrastre de extremos, marquee, hover, edición y mouse;
- `selection`: copias de IDs seleccionados, selección única y arrow host ya resueltos.

El renderer no muta este objeto. `segDrag` se retiró del contrato porque no era consumido. El estado read-only deja selección e interacción visual vacías.

### Compatibilidad y export

- `serializeProject()` conserva exactamente `{version:3, app:"fluyo", doc, settings}`.
- `documentFromProjectData()` se movió sin cambiar sus reglas de migración/defaults.
- No cambiaron `nextId`, factories, importación, UI, estilos ni analytics.
- PNG/JPG/GIF usan el renderer compartido con estado read-only explícito. SVG conserva su renderer vectorial independiente.

### Tests del segundo ciclo

- `node test/render-boundary.cjs`: PASS; compila editor y core mínimo, comprueba dependencias prohibidas y estado read-only explícito en export.
- `node test/render-boundary-run.cjs`: PASS; normaliza y renderiza fixture sin DOM, `localStorage`, RAF ni runtime de editor; verifica fallo sin `renderState`.
- `node test/editor-runtime.cjs`: PASS; frame real del runtime, estado explícito y resize de entrada/salida con timestamp RAF.
- `node --test test/analytics.test.cjs`: 13/13 PASS.
- `node --check` sobre `js/*.js` y `sw.js`: PASS.
- `git diff --check`: PASS.
- `test/viewer-boundary.html` por HTTP: todos los mensajes PASS, consola limpia.
- `test/editor-inline.html` por HTTP limpio: 51/51 en verde.
- `test/documento-entrante.html` por HTTP limpio: 38/38 en verde.
- Editor por HTTP: carga y entrada/salida de presentación sin errores de consola.
- Export manual de este ciclo: PNG, JPG y GIF completados sin errores de consola.

Las pruebas manuales del revisor independiente permanecen documentadas en su sección y no se atribuyen a este segundo ciclo.

### Checklist manual mínima

- [x] Carga del editor por HTTP y consola limpia.
- [x] Entrada y salida de presentación.
- [x] Harness read-only independiente.
- [x] Export PNG/JPG/GIF.
- [ ] Apertura directa por `file://` (no ejecutada en este ciclo).
- [ ] Recorrido manual completo de pan, zoom, selección, drag/resize, conexión, edición y marquee (cubierto parcialmente por `editor-inline.html`, no repetido manualmente completo).

### Riesgos restantes

- El core mantiene scripts clásicos y globals compartidos por restricción del proyecto; el orden de carga está cubierto por el test de compilación y `index.html`.
- Renderizar nodos de imagen/icono requiere el global web estándar `Image`, igual que antes; no es una dependencia del editor.
- `documentFromProjectData()` conserva su comportamiento previo de normalizar el objeto recibido in-place. Cambiarlo sería otra tarea de contrato, no parte de esta frontera.

### Estado final y próximo paso

FLUYO-004 queda **DONE**. No hay bloqueadores conocidos de frontera para un consumidor read-only. El próximo paso, fuera de esta sesión, puede ser revisar este handoff antes de iniciar FLUYO-005; aquí no se implementó Share ni el viewer productivo.

## Revisión final (Codex, 2026-09-28)

### Veredicto

**APPROVED WITH MINOR FIXES.** La frontera read-only quedó demostrada en Node y en navegador real cargando únicamente `config.js`, `model.js`, `geometry.js` y `render.js`. No aparecieron dependencias de runtime, estado mutable, persistencia, autosave, `localStorage` ni UI del editor.

### Corrección menor realizada

- Se retiraron de `model.js` los resolvers de selección y `arrowHost`, porque son reglas exclusivas del editor.
- `selection.js` conserva ahora la única implementación y `editor-runtime.js` la consume mediante `singleSel()` y `arrowHostNode()`.
- `test/render-boundary.cjs` impide que globals de selección vuelvan a entrar en `model.js`.

### Validación final

- `node test/render-boundary.cjs`: PASS.
- `node test/render-boundary-run.cjs`: PASS.
- `node test/editor-runtime.cjs`: PASS.
- `node --test test/analytics.test.cjs`: 13/13 PASS.
- Sintaxis de `js/*.js` y `sw.js`: PASS.
- `git diff --check`: PASS.
- `test/viewer-boundary.html` en navegador/origen limpio: todos los mensajes PASS, consola limpia.
- `test/editor-inline.html`: 51/51 PASS, consola limpia.
- `test/documento-entrante.html`: 38/38 PASS, consola limpia.
- Editor real por HTTP: carga, creación de una caja, modificación de texto y entrada/salida de presentación sin errores de consola.

### Limitación pendiente

La apertura directa mediante `file://` no pudo ejecutarse: la única superficie de navegador disponible en este entorno bloquea por política la navegación a URLs `file://`, y no había otro navegador controlable. Por tanto, carga, render inicial, creación/modificación, pan/zoom y presentación bajo `file://` **no se declaran verificados** en esta revisión. No se observó un defecto de código asociado; queda como comprobación manual de compatibilidad antes de iniciar FLUYO-005.

## Corrección de compatibilidad `file://` (Codex, 2026-09-28)

### Contexto y causas

La validación manual posterior confirmó que carga, edición, pan/zoom, presentación e interacción funcionaban bajo `file://`, pero Chrome emitía tres diagnósticos evitables:

1. El `<link rel="manifest">` estático hacía que Chrome solicitara `manifest.webmanifest` desde un origen opaco `null`; el cargador de manifests aplica CORS y bloqueaba esa lectura.
2. `registerServiceWorker()` se ejecutaba también con protocolo `file:`. La API no admite registrar Service Workers desde ese protocolo y rechazaba `./sw.js` antes de registrarlo.
3. `Unsafe attempt to load URL file:///...` era el diagnóstico de seguridad de Blink para el mismo intento de cargar el manifest local desde otro origen `file:` opaco. No provenía del modelo, renderer, interacción ni persistencia de Fluyo. Al no crear el link del manifest bajo `file:`, desaparece la solicitud que lo originaba; no se añadieron excepciones ni hacks de seguridad.

### Cambios

- `index.html` crea el `<link rel="manifest">` únicamente cuando `location.protocol` es `http:` o `https:`.
- `js/export.js` retorna antes de registrar el Service Worker salvo en `http:`/`https:`. La detección es explícita y no usa `try/catch` como control de entorno.
- `sw.js` sube la caché a `fluyo-static-v33`.
- `test/render-boundary.cjs` ejecuta ambos bootstraps con protocolos `file:`, `http:` y `https:`: comprueba cero cargas/registros en `file:` y una carga/registro en HTTP/HTTPS.

### Validación

- Validación manual aportada para `file://`: carga, creación/modificación, pan/zoom, presentación y movimientos/interacción correctos.
- La superficie de navegador de esta sesión bloquea por política abrir URLs `file://`; no fue posible repetir visualmente la consola desde ella. La ausencia de los dos intentos PWA bajo `file:` quedó cubierta ejecutando las guardas con mocks estrictos.
- HTTP en navegador real: se inserta `link[rel=manifest]`, `manifest.webmanifest` responde `200 application/manifest+json`, se solicita y ejecuta `sw.js`, se precachean los assets, y el editor crea/modifica y entra/sale de presentación con consola limpia.
- `node test/render-boundary.cjs`: PASS.
- `node test/render-boundary-run.cjs`: PASS.
- `node test/editor-runtime.cjs`: PASS.
- `node --test test/analytics.test.cjs`: 13/13 PASS.
- Sintaxis de `js/*.js` y `sw.js`: PASS.
- `git diff --check`: PASS.

### Estado final

FLUYO-004 queda **DONE**. La apertura directa conserva su funcionalidad y ya no inicia capacidades PWA incompatibles con `file:`; HTTP/HTTPS mantienen manifest y Service Worker.
