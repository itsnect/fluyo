# FLUYO-SW-VIEWER-001 — El Viewer `/s/` no registra el Service Worker (auditoría)

Estado: READY FOR COMMIT (implementado sobre `db380d3`, CACHE v107, D4-A aprobada). Sin commit, push ni deploy.
Owner/agente actual: —

> Base: `e82c821` (fluyo.space v104). Hallazgo del smoke en producción de FLUYO-018.30.

## Objetivo

Decidir si el Viewer de enlaces compartidos debe registrar el Service Worker (SW), con evidencia medida.

## Hallazgos

1. **No es una decisión registrada; es un efecto lateral.** El registro vive en `js/export.js` (`registerServiceWorker`, solo en
   http/https, FLUYO-004). El Viewer no carga `export.js` a propósito (`FORBIDDEN_SCRIPTS` en `test/viewer-harness.cjs`: el Viewer no
   exporta ni persiste). Ninguna decisión de `.ai/DECISIONS.md` dice que el Viewer deba quedar fuera del SW; FLUYO-006 y FLUYO-014
   verificaron el Viewer offline siempre instalando el SW desde el editor.
2. **El Viewer YA está bajo el SW para quien usó el editor**: el ámbito de `sw.js` es `/` y `/s/` está precacheado.
3. **El enlace no da información al SW ni al servidor**: es `/s/#d=…` (en la medición, 2532 caracteres, 2507 de hash). El hash no
   viaja en la petición: el SW solo ve `GET /s/`. Sin riesgo de privacidad por el documento.

## Medición (Chrome real, servidor local con `e82c821`, SW permitido; tamaños comprimidos medidos contra fluyo.space)

| Caso | Red en esa visita | ¿Abre sin conexión? |
|---|---|---|
| A · primera visita a un enlace, nunca usó el editor | 23 peticiones (Viewer: 21 archivos, ≈ 152 kB comprimidos) · sin SW · 0 terceros | **No** (`ERR_INTERNET_DISCONNECTED`) |
| B · antes abrió el editor (SW instalado por él) | 0 peticiones: todo sale de la caché v104 | Sí (Historia lista para reproducir) |
| C · variante: el Viewer registra `../sw.js` | +60 peticiones de precache (≈ 223 kB comprimidos más que el Viewer: JS del editor, páginas, ejemplos) · **+ cdnjs.cloudflare.com (gif.js, gif.worker.js)** · controla en ≈ 170 ms | Sí, y el editor también |

## Riesgos de registrar el SW desde el Viewer

- **R1 · Privacidad (bloqueante tal cual).** El `install` precachea gif.js desde cdnjs. Abrir un enlace compartido haría una petición a
  Cloudflare, y la página de privacidad dice que es **el editor** quien hace esa única petición a un tercero. Habría que, o bien quitar
  `CDN_ASSETS` del precache (gif.js ya se cachea al usarse: `cacheFirst` sobre `GIF_CDN`), o bien actualizar la política.
- **R2 · Peso para quien solo mira.** ≈ 223 kB comprimidos de más, en segundo plano, tras cargar el Viewer. Tolerable, pero se puede
  reducir precacheando solo lo del Viewer al registrarse desde `/s/` (requiere separar listas en `sw.js`).
- **R3 · Una visita con la versión anterior tras cada deploy.** El SW es cache-first sin revalidación: tras un deploy, quien tenga el SW
  ve el Viewer anterior en la primera apertura y el nuevo en la siguiente (`skipWaiting` + `clients.claim`). Ya ocurre hoy para quien
  usó el editor; registrar desde el Viewer lo extiende a todos. No medido en esta sesión (pendiente, ver abajo).
- **R4 · CSP de `s/index.html`.** `script-src 'self'` (sin `worker-src`) permite `/sw.js`: no bloquea.
- El documento compartido (`#d=`) nunca llega al SW ni a la caché.

## Decisiones para el PO

- **D1 · ¿Offline para quien solo abre enlaces?** Recomendado: **sí**. Un enlace compartido es autocontenido y es el caso de uso de
  presentar o enseñar sin red; hoy funciona solo por casualidad (si antes se usó el editor).
- **D2 · ¿Cómo evitar el tercero (R1)?** Recomendado: **quitar gif.js del precache** (`CDN_ASSETS`) y dejar que se cachee al exportar el
  primer GIF. El editor offline seguiría funcionando salvo exportar GIF la primera vez sin red. La alternativa es mantenerlo y cambiar
  la política de privacidad (no recomendado).
- **D3 · ¿Precache completo o solo el del Viewer?** Recomendado: **completo** en la primera slice (más simple; ≈ 223 kB). Separar
  listas solo si el peso preocupa.

## Slice propuesta (si D1–D3 se aprueban)

- Un registro compartido (`js/sw-register.js`, script clásico, mismo cuerpo que el de `export.js`) cargado por `index.html` y
  `s/index.html`; `export.js` deja de registrar. Desde `/s/` registra `../sw.js` (ámbito `/`).
- `sw.js`: sin `CDN_ASSETS` en `install` (D2); CACHE v106 (v105 queda para PRODUCT-NARRATION-001 / I18N-001, según el orden de
  publicación).
- Tests: `render-boundary.cjs` (registro en http/https y no en `file:` también desde el Viewer); `viewer-harness` sin
  `export.js`; Chrome: primera visita a `/s/#d=` → controlado por el SW, offline abre y reproduce, ninguna petición a terceros en el
  Viewer; actualización v105 → v106 desde el Viewer.

## Pendiente

- Medir R3 (visita con la versión anterior tras un deploy) con un SW v104 instalado y un `sw.js` nuevo.
- Scripts de la medición en el scratchpad de la sesión `e83cf8f3` (`sw-audit.cjs`, `sw-sizes.cjs`); no están en el repo.

## R3 sobre el estado consolidado (2026-10-23, `db380d3`, v106)

PO: D1 = sí, D2 = sí, D3 = **no** (conjunto mínimo propio del Viewer), CACHE v107. Medido en Chrome real, servidor local con
`db380d3` que marca cada archivo con su versión (1 = desplegada, 2 = «deploy» simulado cambiando `CACHE` en `sw.js`). SW instalado
por el editor (el único camino hoy), que es exactamente el SW que el Viewer heredaría.

### Inventario de `/s/` en `db380d3`: 25 recursos · 533,8 kB sin comprimir · ≈ 193 kB brotli

`s/` (11,3 kB) · `css/identity.css`, `css/system.css`, `css/share.css` · `assets/fonts/ibm-plex-mono-latin-400.woff2`, `-500.woff2`,
`playfair-display-latin-400.woff2` (las tres de `system.css`) · 18 scripts de `s/index.html`: `i18n-en`, `i18n`, `config`, `safe-svg`,
`model`, `link-codec`, `geometry`, `skin`, `render`, `scenario-engine`, `scenario-playback`, `story-playback`, `story-clock`,
`flow-semantics`, `analytics`, `share-loader`, `viewer-viewport`, `viewer`. Frente al inventario previo (22 archivos sobre `6925ffe`,
que no contaba las tres fuentes): mismos 18 scripts; Narration no añade archivos (cambia `story-playback.js`, `story-clock.js`,
`model.js`…). Iconos y logo son SVG en línea o `data:`; sin `gif.js` ni terceros.

### Resultados

| Caso | Resultado |
|---|---|
| R3.1 SW v1 instalado → deploy v2 → abrir un enlace | Primera apertura: **v1 entera** (HTML y los 18 scripts v1, sin mezcla), funciona; la caché pasa a v2 ≈ 2,8 s después en segundo plano. Segunda apertura: **v2 entera**. Una visita «vieja» pero coherente: el comportamiento de siempre del SW (cache-first + `skipWaiting` + `claim`). |
| R3.2 Viewer abierto y reproduciendo durante la actualización | Sigue con v1 sin errores (la Historia continúa, saltar funciona); la caché vieja se borra; otra pestaña con un enlace abre ya v2. |
| R3.3 ventana de mezcla HTML viejo + scripts nuevos | No reproducida: los 18 scripts se piden al parsear, desde la caché, antes de que el SW nuevo active. Teórica (milisegundos). |
| Enlace creado con el editor de `e82c821` (antes de I18N y Narration) | Abre y reproduce («Pago»). |
| Narration (`message` en un SEND) | El título del momento es la frase del autor, también con la interfaz en inglés (no se traduce). |
| Idioma online: es / `?lang=en` / `?lang=xx` | es / **en** («▶ Play story», «Shared diagram · Fluyo») / cae a es. |
| Sin red: `/s/#d=…` (es) y preferencia guardada `fluyo.ui.lang=en` | Abren (es / en). |
| **Sin red: `/s/?lang=en#d=…`** (también si esa URL ya se visitó online) y `?lang=fr` | **No abre el Viewer: sirve el HTML del EDITOR** («Fluyo — editor de diagramas…») y sus scripts relativos (`/s/js/…`) tampoco existen → pantalla rota, sin documento. |

### El problema (bloqueante para «offline» con `?lang=`)

`sw.js` resuelve cada petición con `caches.match(request)` **sin `ignoreSearch`** y, si falla y no hay red, cae a `./index.html` (el
editor). La URL `/s/?lang=en` no es la clave cacheada `/s/` → sin red se sirve el editor bajo `/s/`. Ocurre ya HOY para quien tenga el
SW del editor; con el SW registrado desde el Viewer le pasaría a cualquiera que abra un enlace con `?lang=`. Lo mismo vale para
cualquier otro parámetro de `/s/` (`?s=demo` de los fixtures).

### Decisión que necesito (D4)

- **D4-A (recomendada):** en `sw.js`, las navegaciones a `/s/` se resuelven contra la clave `./s/` ignorando la query (el HTML del
  Viewer es el mismo para cualquier `?lang`; el idioma lo decide `i18n.js` con `location.search`), y su respaldo sin red es `./s/`, nunca
  el editor. Dos líneas, dentro de la slice.
- D4-B: solo cambiar el respaldo de `/s/*` a `./s/` (mismo efecto práctico para navegaciones; deja la clave con query en la caché).
- D4-C: no tocarlo ahora y documentar que `?lang=` no funciona sin conexión (no recomendado: el enlace abriría el editor roto).

## Implementación (D1 sí · D2 sí · D3 no · D4-A; decisión 262)

PO: D4-A aprobada. Base `db380d3` (018.30 → I18N-001 → PRODUCT-NARRATION-001), CACHE v107.

### Qué necesita exactamente quien solo recibe un enlace

**25 recursos, 533,8 kB sin comprimir, ≈ 193 kB brotli** (`VIEWER_ASSETS` en `sw.js`): `s/` · `css/identity.css`, `css/system.css`,
`css/share.css` · `assets/fonts/ibm-plex-mono-latin-400.woff2`, `ibm-plex-mono-latin-500.woff2`, `playfair-display-latin-400.woff2`
(las que pide `system.css`) · los 18 scripts de `s/index.html` en su orden (`i18n-en`, `i18n`, `config`, `safe-svg`, `model`, `link-codec`,
`geometry`, `skin`, `render`, `scenario-engine`, `scenario-playback`, `story-playback`, `story-clock`, `flow-semantics`, `analytics`,
`share-loader`, `viewer-viewport`, `viewer`). Diferencia con el inventario previo (22 archivos sobre `6925ffe`): las tres tipografías, que
entonces no se contaron; Narration no añade archivos. Nada del editor, ninguna página estática, ningún tercero, sin gif.js. Iconos y logo son
SVG en línea o `data:`. La caché del editor (cuando la hay) son 63 recursos con gif.js; la del Viewer, estos 25.

### Cambios

- `sw.js`:
  - `CACHE` v106 → **v107**.
  - `VIEWER_ASSETS` (la lista de arriba) y `VIEWER_PAGE = "./s/"`; `viewerPath()` reconoce `/s/` y `/s/index.html`.
  - `install`: `editorInstall()` decide el conjunto. Si hay una ventana del editor abierta (`clients.matchAll`, incluidas las no
    controladas: quien registra) o la caché anterior tenía el editor (`./index.html` o `./`), precachea **exactamente lo de siempre**
    (`ASSETS` + `PAGE_ASSETS` + gif.js, mismas listas, mismo `addAll`). Si no, `cache.addAll(VIEWER_ASSETS)` (atómico: sin esos 25 el
    Viewer no funciona).
  - `fetch` (D4-A): una navegación cuyo pathname es `/s/` o `/s/index.html` se resuelve con `cacheFirst(new Request("./s/"), "./s/")`:
    la misma clave para cualquier query (`?lang=en`, `?lang=fr`, `?s=demo`…), y sin red el respaldo es `./s/`. Nunca `./index.html`. El
    resto del handler (editor, gif.js, otros orígenes) no cambia.
  - `activate` no cambia: borra las cachés que no son la actual y reclama los clientes.
- `js/viewer.js`: `registerViewerServiceWorker()` registra `../sw.js` (mismo script y ámbito «/» que el editor) solo en http/https y tras
  `load` (como `registerServiceWorker` de `export.js`, FLUYO-004), con guarda si no hay `navigator`.
- Sin cambios: `s/index.html`, `export.js`, `i18n.js`, el formato `#d=`, el kernel, el editor, Present, Share, Export, el MCP. La página
  de privacidad sigue siendo cierta («el editor hace una única petición a un tercero: gif.js»): el Viewer no hace ninguna.

### Comportamiento resultante

| Caso | Antes (v106) | Ahora (v107) |
|---|---|---|
| Primera visita a un enlace, nunca usó el editor | sin SW; sin red no abre | instala el SW con los 25 recursos; desde ahí abre sin red |
| `/s/?lang=en#d=…` sin red | servía el HTML del EDITOR, roto | el Viewer en inglés |
| `/s/?lang=fr`, `/s/?s=demo` sin red | el editor, roto | el Viewer (español) |
| Quien usó el editor | caché del editor | la misma (63 recursos con gif.js) |
| Actualización de quien solo abrió enlaces | — | la caché nueva vuelve a ser solo la del Viewer |
| Actualización de quien usó el editor, desde un enlace | — | la del editor (por su caché anterior) |

### Compromisos (trade-offs)

- Quien empezó por un enlace y DESPUÉS abre el editor: el SW ya está instalado con el conjunto del Viewer y `register()` del editor no
  reinstala. El editor funciona online como siempre (cache-first lo guarda al usarlo) y, sin red, funciona lo que ya usó; el precache
  completo (gif.js incluido) llega con la siguiente actualización de `CACHE` (su caché anterior ya tiene `./`). Para quien usa el editor
  primero —el camino de hoy— nada cambia.
- Tras un deploy, la primera apertura de un enlace es la versión anterior entera (cache-first + `skipWaiting` + `claim`, el mismo modelo
  del editor desde siempre); la siguiente, la nueva.

### Pruebas (2026-10-25)

- `node --test test/fluyo-sw-viewer-001.test.cjs` → **7/7**: la lista del Viewer = exactamente lo que carga `s/index.html`; instalación
  del Viewer = solo esos 25, sin gif.js ni cdnjs; instalación del editor = la de siempre (también al actualizar desde un enlace con su
  caché anterior); D4-A con `/s/`, `?lang=en`, `?lang=fr`, `?s=demo`, `/s/index.html`, con y sin red, nunca `index.html`; editor, gif.js y
  terceros como antes; registro en `viewer.js` (http/https, tras «load», no en `file:`); alcance frente a `db380d3` y `undoSwv` exacto.
- `node test/fluyo-sw-viewer-001-browser.cjs` → **63 ✔ / 0 ✘** (Chrome real, SW permitido), en 1440×900, 390×844 y 844×390: visitante
  nuevo online `/s/?lang=en` (Viewer en inglés, Historia, frase del autor sin traducir) → SW instalado y controlando, caché v107 = los 25
  → sin red: recarga en inglés y Historia con la frase, `/s/` en español, `?lang=fr` → español, `?s=demo` → Viewer, preferencia guardada en
  inglés, enlace creado con el editor de `e82c821` (fixture `test/fixtures/sw-viewer-001/enlace-e82c821.txt`) abre y reproduce; sin
  errores de consola; **ninguna petición a terceros ni a gif.js en toda la sesión, SW incluido**. Actualización (deploy simulado con otra
  CACHE): primera apertura = versión anterior entera, caché anterior borrada, la nueva otra vez solo del Viewer, siguiente apertura (y sin
  red) = versión nueva entera. Editor: instalación de siempre (63 recursos con gif.js), exportar GIF descarga un `.gif` (gif.js real de
  cdnjs, el camino del editor), y con su SW `/s/?lang=en` sin red abre el Viewer.
- `node test/fluyo-sw-viewer-001-mutations.cjs` → **U 10/10 y B 5/5** detectadas.
- vm completo, clon con commit simulado: base `db380d3` 1655 / 81 fallos; con esta tarea 1662 / 81, **mismo conjunto**.
- Chrome, base `db380d3` frente a este árbol, mismos números: 018-30 403, i18n-001 79, product-narration-001 100, 014 13 (incluida la
  actualización del SW a v107 y el Viewer offline), 013 (Present) OK, 019-2 86, 018-18 428, 018-29 397, semantics-5 86, semantics-6 53,
  015 15, 016 17. `step-message-001-browser` falla igual en la base (83 ✔, previo).
- Tests tocados: pines de CACHE v106 → v107; `fluyo-product-narration-001.test.cjs` (H1 deshace antes esta tarea con `undoSwv`);
  `fluyo-product-narration-001-undo.cjs` (`undoNarr` aplica `undoSwv` primero).

## Handoff

- READY FOR COMMIT. Sin commit, push ni deploy (esperando el OK del PO).
- Archivos servidos: `sw.js`, `js/viewer.js`. Docs: esta tarea y la decisión 262 en `.ai/DECISIONS.md`.
- Tests nuevos: `test/fluyo-sw-viewer-001.test.cjs`, `-browser.cjs`, `-mutations.cjs`, `-undo.cjs`, `test/fixtures/sw-viewer-001/`.
- MCP: nada. Siguiente CACHE libre: v108.
- Tras publicar: smoke en producción con un perfil limpio (abrir un enlace, desconectar, reabrir con `?lang=en`) y comprobar en Network
  que no hay peticiones a cdnjs.
