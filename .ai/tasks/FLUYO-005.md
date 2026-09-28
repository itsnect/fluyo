# FLUYO-005 — Read-only Share Viewer

Estado: DONE — re-QA final APPROVED; cinco hallazgos resueltos (2026-09-28)
Owner/agente actual: —

> Esta tarea es la **fuente de verdad** de su trabajo: cualquier agente (Codex, Claude Code, OpenCode/Kimi) debe poder continuar leyendo solo esta tarea + `AGENTS.md`. Mantenla actualizada en cada sesión, especialmente la sección Handoff. No dupliques aquí lo que ya está en `.ai/DECISIONS.md` o `.ai/ARCHITECTURE.md`: enlázalo.
>
> **Repo público**: este archivo puede terminar publicado en GitHub. Escribe solo contenido apto para público: nada de información confidencial, métricas privadas, credenciales, estrategia comercial ni roadmap privado (ver `AGENTS.md` §9).

## Objetivo

Construir un viewer Fluyo verdaderamente read-only (shell `/s/`) que reutilice el core compartido de `FLUYO-004` (`config` → `model` → `geometry` → `render` + `makeReadOnlyRenderState()`), obteniendo el documento mediante un adapter/fixture local reemplazable por `GET /api/shares/:id` en `FLUYO-006`.

## Por qué

Share necesita una experiencia `/s/<id>` interactiva (pan, zoom, páginas, animación, presentación, `Open in Fluyo`) que no cargue ningún módulo editable del editor, antes de existir backend (diseño aprobado en `FLUYO-003`, D-008).

## Alcance

### Incluye

- Shell estático de viewer (`s/index.html` + `css/share.css`) con `noindex, nofollow` y `Referrer-Policy` explícita.
- Separación del transporte genérico de analytics (`js/analytics.js`) de la instrumentación del editor (`js/editor-analytics.js`).
- Abstracción `loadSharedDocument(...)` con adapter de fixture local reemplazable.
- Runtime read-only propio: viewport (`viewX`, `viewY`, `viewZoom`), resize, reloj de animación, pan, zoom, navegación de páginas, presentación.
- UI mínima del viewer: branding `Hecho con Fluyo`, `Abrir en Fluyo` (copia editable), controles de navegación/presentación.
- Estados loading / válido / inválido / no encontrado / versión no soportada.
- Analytics `share_viewed` y `share_opened_in_editor` (sin IDs ni contenido).
- Tests del viewer y fixtures.

### No incluye

- `POST /api/shares`, `GET` remoto real, `DELETE`, object storage, delete tokens, rate limiting, cuentas, autenticación, shares privados, comentarios, colaboración, billing, AI, GitHub, embeds, `FLUYO-006`.
- Cambios al formato `.fluyo.json` ni al comportamiento del editor.

## Contexto necesario

Leer (solo esto antes de empezar):
- `AGENTS.md`.
- Esta tarea.
- `.ai/tasks/FLUYO-003.md` (diseño Share, §5 viewer read-only, §7 Open in Fluyo, §10 analytics).
- `.ai/tasks/FLUYO-004.md` (frontera final: qué archivos son el core read-only).
- Búsquedas dirigidas en `js/render.js`, `js/model.js`, `js/geometry.js`, `js/config.js`, `js/analytics.js`, `index.html` y los tests de FLUYO-004.

No es necesario leer:
- `.ai/PRODUCT.md`, `.ai/DECISIONS.md` salvo referencias concretas (D-004, D-007, D-008, D-009).
- Repositorios hermanos.
- Páginas estáticas no mencionadas.

## Criterios de aceptación

- [x] Existe `.ai/tasks/FLUYO-005.md` actualizado con handoff completo.
- [x] Viewer independiente existe (`s/index.html` + `css/share.css`).
- [x] No carga `state.js`, `editor-runtime.js`, `interaction.js`, `selection.js`, `ui.js`, `export.js`, autosave ni persistencia local del editor.
- [x] Documento se obtiene mediante adapter reemplazable (`js/share-loader.js`).
- [x] Usa `model`/`geometry`/`renderer` compartidos y `makeReadOnlyRenderState()`.
- [x] Pan funciona.
- [x] Zoom funciona.
- [x] Animaciones funcionan.
- [x] Presentación funciona.
- [x] Navegación read-only funciona cuando corresponde.
- [x] `Open in Fluyo` produce una copia editable (nunca vínculo de escritura).
- [x] `noindex, nofollow` presente.
- [x] `Referrer-Policy` explícita presente.
- [x] Estados loading/error contemplados.
- [x] Analytics sin información sensible; `share_viewed` sólo tras render válido; `share_opened_in_editor` sólo por acción explícita.
- [x] No existe backend real; `.fluyo.json` no cambia.
- [x] Tests pasan.
- [x] Handoff permite conectar `FLUYO-006` sin rediseñar el viewer.

## Plan

- [x] Crear esta tarea con el template.
- [x] Inspeccionar la frontera real de `FLUYO-004` (firmas de `render()`, `model.js`, `analytics.js`).
- [x] Separar analytics en transporte (`js/analytics.js`) e instrumentación del editor (`js/editor-analytics.js`).
- [x] Shell `s/index.html` + CSS + metas de seguridad.
- [x] `js/share-loader.js` (frontera) + adapter de fixture local.
- [x] `js/viewer-viewport.js` (matemática pura de viewport).
- [x] `js/viewer.js` (runtime read-only).
- [x] Analytics del viewer (`share_viewed`, `share_opened_in_editor`).
- [x] Fixtures y tests (`node --test test/viewer.test.cjs`).
- [x] Validación final (tests FLUYO-004, analytics, sintaxis, `git diff --check`, smoke en Chrome).
- [x] Actualizar `sw.js`, `index.html`, tests de FLUYO-004 y `documento-entrante.html`.

## Decisiones tomadas

- Se separó el transporte genérico de analytics (`js/analytics.js`) de la instrumentación del editor (`js/editor-analytics.js`), para que el viewer cargue solo el transporte. Registrado en `.ai/DECISIONS.md` como **D-009**.
- El viewer carga estrictamente el core read-only (`config.js`, `model.js`, `geometry.js`, `render.js`) + transporte de analytics + sus propios scripts (`share-loader.js`, `viewer-viewport.js`, `viewer.js`). Ningún módulo de edición entra.
- `loadSharedDocument(id)` define un contrato estable: devuelve `{doc, settings}` normalizados, o lanza un `Error` con `code` de baja cardinalidad (`invalid_id`, `not_found`, `invalid_document`, `unsupported_version`, `unavailable`). Delega en `projectFromProjectData()`, la misma frontera usada por archivo/deep link, sin política de versiones específica de Share. FLUYO-006 solo tiene que reemplazar `shareSource.fetch`.
- Hoy la fuente es un adapter de fixtures locales (`SHARE_FIXTURES`). Sin backend real.
- `Open in Fluyo` usa el deep link existente (`/#d=`) con formato v1 (deflate-raw) para demostrar el flujo end-to-end local. No fuerza contenido grande y reutiliza el decoder del editor. FLUYO-06 remplazará por `/#s=<id>`.
- El viewer mantiene su propio viewport, reloj y estado de presentación; no comparte `viewX`/`viewY`/`viewZoom` con el editor.
- `share_viewed` se dispara una vez, en el primer frame exitoso del renderer; `share_opened_in_editor` solo en el clic de `Abrir en Fluyo`. Ninguno lleva IDs, URLs ni datos del documento.
- Meta robots `noindex, nofollow` y `Referrer-Policy: no-referrer` van en el HTML del shell; FLUYO-06 añadirá `X-Robots-Tag` y `frame-ancestors` por HTTP.

## Archivos modificados

- `.ai/tasks/FLUYO-005.md` — esta tarea y handoff.
- `.ai/DECISIONS.md` — nueva entrada **D-009** (transporte vs instrumentación de analytics).
- `index.html` — carga `js/editor-analytics.js` después de `js/analytics.js`.
- `js/analytics.js` — transporte genérico; añadidos `share_viewed` y `share_opened_in_editor`; eliminada la instrumentación de edición (movida a `js/editor-analytics.js`).
- `js/editor-analytics.js` — **nuevo**: snapshots, `editor_opened`, `first_edit_completed`, `diagram_created`.
- `js/share-loader.js` — **nuevo**: frontera de carga del share, fixture local y constructor de URL `Abrir en Fluyo`.
- `js/viewer-viewport.js` — **nuevo**: matemática pura de viewport (pan, zoom, fit).
- `js/viewer.js` — **nuevo**: runtime DOM del viewer (reloj, RAF, eventos, presentación, Open in Fluyo).
- `s/index.html` — **nuevo**: shell del viewer con metas de seguridad.
- `css/share.css` — **nuevo**: estilos mínimos del viewer.
- `sw.js` — cache `v34`, nuevos scripts y página `s/`.
- `test/analytics.test.cjs` — carga `js/editor-analytics.js` para mantener los 13 tests.
- `test/render-boundary.cjs` — añade `js/editor-analytics.js` a la secuencia del editor.
- `test/documento-entrante.html` — incluye `js/editor-analytics.js` en la lista de fuentes a recargar.
- `test/viewer.test.cjs` — **nuevo**: 16 tests del viewer.

## Pruebas

- `node --test test/viewer.test.cjs`: 16/16 PASS.
- `node test/render-boundary.cjs`: PASS (editor + viewer-core).
- `node test/render-boundary-run.cjs`: PASS (core read-only ejecuta).
- `node test/editor-runtime.cjs`: PASS (RAF y resize de presentación).
- `node --test test/analytics.test.cjs`: 13/13 PASS.
- `node --check` sobre `js/*.js`, `sw.js` y tests: PASS.
- `git diff --check`: PASS (sólo advertencias de LF/CRLF en Windows).
- Smoke en Chrome headless (`s/index.html?s=demo`): tabs creados (`Flujo principal`, `Estado`), `status` hidden, `prPos` = `1 / 2`.
- Smoke error en Chrome headless (`s/index.html?s=desconocido`): `status` visible con "El enlace del diagrama no es válido."

### Checklist manual pendiente

- [ ] Abrir `s/index.html?s=demo` por HTTP en navegador de escritorio; pan con rueda, zoom con Ctrl+rueda, arrastre con ratón, pinch en táctil.
- [ ] Abrir `s/index.html?s=demo` en móvil; pan y zoom táctil.
- [ ] Navegar entre las dos páginas con tabs, presentar, avanzar diapositivas, salir.
- [ ] Click en `Abrir en Fluyo`, ver que `index.html` carga el documento como copia editable (deep link).
- [ ] Comprobar que el editor original sigue funcionando idéntico (carga, edición, guardar, exportar, presentación) bajo HTTP y `file://`.
- [ ] Verificar en DevTools que no se cargan `state.js`/`editor-runtime.js`/módulos de edición en `/s/`.
- [ ] Verificar que `localStorage` y `sessionStorage` no se usan en el viewer.

## Pendientes / riesgos

- **Validación visual real:** los tests de Node cubren lógica, frontera y contratos, pero no el dibujo real en Canvas. Se hizo smoke en Chrome headless del DOM, no del lienzo. Falta la checklist manual en navegador real.
- **File://:** el viewer requiere HTTP (`fetch` al fixture es local síncrono hoy, pero el shell usa `../` y la futura API será fetch). El core compartido sigue sin depender de fetch; el editor mantiene `file://` (FLUYO-004 lo verificó). El propio `s/index.html` no se espera que funcione desde `file://` cuando se conecte el backend.
- **Página vacía en share:** corregida en QA mediante `opts.emptyHint`; el viewer muestra un mensaje de lectura y el editor conserva el texto original.
- **CSP `frame-ancestors`:** se documenta que debe fijarse por cabecera HTTP en FLUYO-006; el meta `http-equiv` lo ignora el navegador.
- **Open in Fluyo:** actualmente usa `#d=` comprimido, que funciona offline/self-host. Cuando FLUYO-06 implemente `/#s=<id>`, el viewer cambiará el target sin alterar el loader ni el renderer.
- **Orden de carga:** scripts clásicos y globales compartidos siguen siendo frágiles; el test de `render-boundary.cjs` vigila la secuencia. Cualquier nuevo script en el viewer debe sumarse allí y en `sw.js`.

## Handoff

### Estado actual

DONE — APPROVED tras re-QA final de los cinco hallazgos y regresión mínima. El viewer no carga fábricas mutables; la entrada de documentos usa normalización compartida con el editor; el pinch conserva su ancla y traslación; los IDs se leen completos y la demo exige petición explícita. `ready` y `share_viewed` requieren primer render exitoso; un fallo posterior limpia el lienzo y detiene el RAF. Se preservó la identidad visual del QA anterior. La checklist de dispositivos/PWA queda como límite de cobertura documentado, sin bloqueantes encontrados en el alcance de este re-QA.

### Próximo paso concreto

Cerrar FLUYO-005 con el informe final APPROVED. Completar móvil físico/fullscreen nativo, `file://` y actualización offline de PWA cuando esté disponible ese entorno. Esta sesión no incluye FLUYO-006.

### Handoff de QA independiente — 2026-09-28

- Veredicto actual: **CHANGES REQUIRED**. El informe completo, reproducciones, clasificación visual y límites de validación están en [FLUYO-005-QA.md](FLUYO-005-QA.md); prevalece sobre el cierre inicial registrado arriba.
- Correcciones pequeñas: identidad común en `css/identity.css` (paleta, tipografía, wordmark y botones), alineación de tabs/espaciado del viewer y hint read-only de página vacía. No se cargó la hoja completa del editor ni su runtime en el viewer.
- Archivos de QA: `css/identity.css`, `css/styles.css`, `css/share.css`, `index.html`, `s/index.html`, `js/render.js`, `js/viewer.js`, `sw.js`, `test/viewer.test.cjs`, `test/documento-entrante.html` y los dos documentos de tarea/QA.
- Cache subió a **v35**, con el nuevo CSS común precacheado. Ningún cambio de formato `.fluyo.json`, backend, commit o push.
- Tests: viewer 18/18, analytics 13/13, fronteras render, runtime editor, sintaxis y diff-check PASS; navegador documento/importación 38/38 y edición inline 51/51. RAF del harness corregido para conservar múltiples callbacks; añadidos unavailable y build.
- Browser smoke: identidad de escritorio, páginas, animaciones, presentación/salida y copia editable comprobadas; Guardar, exportar PNG y presentar en editor sin fallo observado. Persisten límites de móvil físico, fullscreen nativo, `file://` y actualización offline de PWA.
- Próximo paso: corregir los cinco hallazgos funcionales del informe, convertir sus reproducciones en tests de regresión y repetir QA. FLUYO-006 no se implementó ni debe iniciarse desde esta revisión.

### Handoff de correcciones funcionales — 2026-09-28

Este handoff reemplaza los pendientes funcionales del QA anterior; el informe
original se conserva como evidencia histórica y tiene una actualización al final.

- **Frontera mínima:** `newNode()` y `newEdge()` se trasladaron, sin cambiar sus implementaciones, de `model.js` a `state.js`, que el viewer no carga. No se añadió un modelo duplicado, módulo de commands ni nuevo script. `blankPage()` permanece como constructor puro usado por la representación/migración, sin instalar páginas en un documento.
- **Entrada única:** `projectFromProjectData()` en `model.js` devuelve `{doc,settings}` normalizados sobre una copia. `documentFromProjectData()` conserva la API de documento delegando en ella. `applyProjectData()` y el loader usan esa misma frontera. Versiones 1/2/3 y documentos sin versión siguen la misma familia estructural histórica; versiones desconocidas se rechazan en el core. No cambió el formato serializado v3.
- **Invariantes:** `cur` entero limitado a páginas existentes; tema ausente → dark, tema desconocido → invalid_document; geometría finita/positiva, arrays de nodos/aristas/waypoints, IDs únicos y `nextId` seguro. Campos faltantes se completan con defaults ya existentes. Settings parciales/ausentes usan defaults compartidos; valores numéricos finitos se limitan según los controles de Fluyo (`speed .2–2`, `dots 1–6`, `stagger .2–1.2`), booleanos y tipografía se normalizan. Objetos estructuralmente imposibles se rechazan antes de instalarlos.
- **Pinch:** helpers puros `beginViewportPinch()` / `updateViewportPinch()` conservan el punto de mundo del centro inicial. Distancia controla zoom y centro actual controla pan. Levantar/cancelar/perder captura de un dedo actualiza el gesto; no se carga `interaction.js`.
- **IDs:** path/query/hash se leen completos. Sólo `demo` explícito resuelve la fixture; vacío, ausencia o cadena mal formada producen invalid_id. Lookup de fixtures con propiedades propias. ID válido de 22 caracteres no existente produce not_found.
- **Lifecycle:** loading → fetch/normalización → preparación → primer render → ready → share_viewed. Controles deshabilitados inicialmente y en error. Preparación/render se capturan; error terminal limpia canvas/tabs/presentación y no programa otro RAF. El reloj se inicia tras recibir el documento.
- **Identidad preservada:** `identity.css`, layout/estilos del QA y `emptyHint` permanecen. Cache **v36** por la regla de `AGENTS.md` de subir la versión al cambiar contenido servido; se conserva el precache incorporado en v35.
- **Archivos de esta sesión:** `js/model.js`, `js/state.js`, `js/config.js` (comentario), `js/share-loader.js`, `js/viewer-viewport.js`, `js/viewer.js`, `s/index.html`, `sw.js`, `test/viewer.test.cjs`, `test/analytics.test.cjs`, `test/render-boundary.cjs`, `.ai/DECISIONS.md`, esta tarea y el informe QA existente.
- **Pruebas:** viewer **28/28**, analytics **13/13**, render boundary, render boundary runtime, editor runtime, sintaxis JS/SW/tests y `git diff --check` PASS. Normalización de los **11** fixtures/ejemplos existentes PASS. Se conservaron los tests del revisor y su mejora de múltiples callbacks de RAF; se añadieron regresiones de los cinco hallazgos.
- **Navegador:** documento/importación **38/38**, editor inline **51/51**. Demo, tabs, presentación/salida, IDs `!!` y `demo!` con controles deshabilitados y copia editable confirmados; el conflicto de sesión respeta añadir las páginas sin descartar el trabajo local. Sin errores de consola en el flujo de copia.
- **Límites restantes:** verificación física táctil/fullscreen, editor `file://` y ciclo completo de actualización offline PWA siguen pendientes; `#d=` mantiene el límite para documentos grandes y las cabeceras HTTP siguen pendientes del servicio hospedado. Son límites documentados, no backend implementado.
- Sin tarea nueva, backend, commit ni push. Próximo paso concreto: re-QA sobre las correcciones y cerrar FLUYO-005 tras esa validación.

### Handoff de re-QA final — 2026-09-28

- **APPROVED; estado recomendado DONE.** Los cinco hallazgos y la regresión mínima quedaron verificados; detalle en [FLUYO-005-QA.md](FLUYO-005-QA.md), sección «Re-QA final». Este resultado reemplaza el CHANGES REQUIRED y el estado listo para re-QA anteriores.
- Pruebas repetidas: **41/41** (viewer 28 + analytics 13), fronteras/runtime, sintaxis y diff-check PASS. Navegador HTTP nuevo/no-store: documento/importación **38/38**, edición inline **51/51**; demo, navegación/presentación/salida, controles de vista, IDs originales inválidos y copia editable correctos. Presentación del editor comprobada tras recibir la copia.
- Ocho mutaciones equivalentes aplicadas sólo en memoria fueron detectadas por las regresiones actuales: factories, cur, theme, settings, compatibilidad histórica, pinch, fallback de IDs y orden de primer render. No se alteraron fuentes productivas para estas pruebas.
- Identidad común preservada en capturas editor/viewer. Cache **v36** coherente, sus **41 assets** existen; **8 ejemplos** `.fluyo.json` normalizados y serialización v3 preservada.
- Cambios de esta sesión: únicamente esta tarea y el informe QA existente. Sin correcciones productivas, commit, push ni FLUYO-006.
- Límites de cobertura: táctil físico/fullscreen nativo, editor `file://` y actualización offline completa PWA; no son bloqueantes nuevos en el alcance solicitado. Próximo paso: cerrar FLUYO-005 y completar esa comprobación de dispositivos/PWA cuando exista el entorno.
