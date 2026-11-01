# FLUYO-GROWTH-FOUNDATION-001 — Base para medir el funnel y activar en el primer minuto

Estado: **PRODUCTION VERIFIED / CLOSED** (2026-11-01). En producción desde `ebf72cf` (`main`), fluyo.space sirve `fluyo-static-v122`; smoke de producción 30/0.
Owner/agente actual: libre (espera QA del PO)

> Repo público: este documento no contiene métricas, estrategia ni datos privados. Las cifras de uso se leen en el panel de analítica, fuera del repositorio.

## Problema

Fluyo está en producción con Stories 2.0, pero no puede responder con evidencia si una persona que llega entiende Fluyo, ve una Story, crea algo, comparte y vuelve:

- No hay ningún evento de Story (crear, empezar, terminar) en ninguna superficie.
- `example_loaded` y `share_created` no distinguen nada útil (por dónde se llegó al ejemplo, si se compartió una Historia o un diagrama).
- No hay señal de retorno ni de idioma.
- Quien llega a `fluyo.space/` ve un lienzo vacío con un texto que remite a «Ejemplo», que está escondido en «⋯». En móvil ese texto se corta. La barrera es explícita: «no sé qué debería crear primero».

Auditoría completa: [`FLUYO-GROWTH-FOUNDATION-001-AUDIT.md`](FLUYO-GROWTH-FOUNDATION-001-AUDIT.md).

## Decisión de producto

Una release pequeña, observable y reversible, sin capability nueva:

1. Medir el funnel con el transporte que ya existe (Umami, lista cerrada, payload reconstruido).
2. Reducir el primer minuto con una tarjeta ligera sobre el lienzo vacío que lleva a un Example real con Story reproduciéndose.

Fuera: Stories 2.1, cuentas, backend, cambios de formato, kernel, codec o MCP, rediseño del editor, publicación de idiomas.

## Arquitectura actual (resumen de la auditoría)

- `js/analytics.js`: transporte Umami solo en `fluyo.space`; lista cerrada `ANALYTICS_EVENTS`; `analyticsBeforeSend` reescribe url, título y referrer; sin pageviews.
- `js/editor-analytics.js`: `editor_opened`, `first_edit_completed`, `diagram_created` (solo editor).
- Viewer `/s/`: `share_viewed`, `share_opened_in_editor`.
- Entrada: `/` es el editor; `?ejemplo=` y `#d=` traen documento; `/s/#d=` es el Viewer. Sin router.

## Contrato de eventos (decisión 320)

Ningún nombre cambia. `editor_opened` es «app abierta» y `share_viewed` es «viewer abierto».

| Funnel stage | Event | Trigger exacto | Payload | Surface |
|---|---|---|---|---|
| Acquisition / Entry | `editor_opened` | `DOMContentLoaded` del editor, una vez por carga | `entry`: `direct` / `example` / `link` · `returning`: `yes` / `no` · `locale`: `es` / `en` / `fr` / `ja` / `zh` / `other` | Editor |
| Entry (primer minuto) | `entry_chosen` | La tarjeta de entrada se resuelve, una vez | `choice`: `explore` / `blank` / `dismiss` (Escape, tocar el lienzo, o el lienzo dejó de estar vacío) | Editor |
| Examples | `example_loaded` | Un ejemplo publicado quedó abierto (no si se eligió «seguir con lo mío») | `example`: slug de la lista fija (`demo` para el botón) · `source`: `url` / `menu` / `entry` | Editor |
| Story | `story_created` | Se crea una Historia: «+», tocar el sistema sin Historia, colocar un evento sin Historia (`new`); duplicar (`copy`); «Otra forma desde aquí» o «Duplicar como fallo» (`variant`) | `origin`: `new` / `copy` / `variant` | Editor |
| Story | `story_started` | `scRun` arranca una reproducción válida | `surface`: `editor` / `present` · `trigger`: `user` / `entry` | Editor, Present |
| Story | `story_completed` | La reproducción llega al final (viéndola o saltando), una vez por reproducción | `surface`: `editor` / `present` | Editor, Present |
| Present | `present_started` | Sin cambios | — | Present |
| Share | `share_created` | Enlace creado dentro del límite | `kind`: `story` / `diagram` · `variants`: `yes` / `no` (viajan sus otras formas tras el posible recorte por tamaño) | Editor |
| Viewer | `share_viewed` | Primer render correcto del Viewer | `story`: `yes` / `no` · `locale` | Viewer |
| Viewer | `viewer_story_started` | «Reproducir» en el Viewer | — | Viewer |
| Viewer | `viewer_story_completed` | Esa reproducción llega al final, una vez | — | Viewer |
| Viewer → editor | `share_opened_in_editor` | Sin cambios | — | Viewer |
| Return | `editor_opened.returning` | Navegador con estado previo de Fluyo: `fluyo.seen` o cualquier clave `fluyo.*` (decisión 321) | `yes` / `no` | Editor |

Sin cambios: `first_edit_completed`, `diagram_created`, `diagram_saved`, `diagram_exported`, `file_imported`, `gif_animation_added`, `link_failed`.

## Contrato de privacidad

Lo que sale del navegador (solo en `fluyo.space` / `www.fluyo.space`, hacia Umami): `website` (id público del sitio), `hostname`, `url: "/"`, `title: "Fluyo"`, `referrer: ""`, el nombre del evento y sus propiedades **de las listas cerradas de arriba**. Nada más: ni idioma del navegador, ni pantalla, ni URL, ni hash, ni query.

Nunca sale: contenido del diagrama, nombres de nodos, servicios o Historias, frases de los pasos, mensajes, documentos, enlaces `#d=`, ids de documento ni nada escrito por la persona. Comprobado en navegador real con un Umami falso que aplica el `beforeSend` de la página: en todos los recorridos, cero coincidencias con texto del ejemplo («Compra», «Tienda», «Pagos», «Banco», «Cliente», «Online checkout»…), `#d=`, `ejemplo=` o `lang=`.

Local, nunca enviado: `localStorage["fluyo.seen"]="1"` (decisión 321). La política pública (`privacidad/`, `privacy/`) lista ahora el contrato exacto, explica «Primera visita» y deja de decir que Umami recibe pageviews (no lo hace desde 4dab746).

## Decisión UX (decisión 322; D1–D3 aprobadas por el PO)

Una tarjeta de papel en el centro del lienzo vacío, sin velo ni bloqueo:

- Título: «Explica tu sistema, no solo lo dibujes.» / «Explain your system, not just draw it.»
- Destacada: «Ver un sistema en marcha» — «Una compra online, contada paso a paso.» / «See a system in motion» — «An online checkout, told step by step.»
- Secundaria: «Empezar en blanco» — «Dibuja tu sistema y cuenta qué pasa.» / «Start blank» — «Draw your system, then tell what happens.»

«Ver un sistema en marcha» abre **Compra online** (el Example real del botón «Ejemplo», en el idioma de la interfaz), en modo Historias, y **reproduce «Compra con éxito»** sola: el momento aparece sobre el lienzo con su frase. Con movimiento reducido queda lista para «Reproducir». No hay walkthrough ni más pasos.

Cuándo **no** aparece: `?ejemplo=` (válido o no), `#d=` (aunque ya se hubiera abierto en la pestaña), `/s/`, sesión guardada, cualquier clave `fluyo.*` previa, o `localStorage` inaccesible.

Por qué mejora la activación: el camino a la primera Story pasa de «descubrir ⋯ → Ejemplo → Reproducir» (3 clics, si se descubre ⋯) a **1 clic**, y lo primero que se ve es comportamiento (un pedido que viaja y una frase por momento), no una pizarra.

## Implementación

| Archivo | Cambio |
|---|---|
| `js/analytics.js` | Contrato ampliado (`ANALYTICS_EVENTS`), `analyticsLocale()` |
| `js/editor-analytics.js` | `editorOpenedProps()`: `entry`, `returning`, `locale` |
| `js/entry.js` (nuevo) | Decisión pura de la entrada, `fluyo.seen`, la tarjeta, Explorar / En blanco / cerrar |
| `index.html` | `#entryCard` dentro de `#wrap`; `<script src="js/entry.js">` el último |
| `css/styles.css` | Estilos de `.entryCard` (tokens existentes, junto al rótulo del momento) |
| `js/editor-runtime.js` | `entryTick()` por fotograma y sin pista del lienzo con la tarjeta abierta |
| `js/editor-scenarios.js` | `scTrack`; `story_created` (6 puertas), `story_started`, `story_completed` con bandera por reproducción |
| `js/viewer.js` | `share_viewed` con `story`/`locale`; `viewer_story_started` / `viewer_story_completed` |
| `js/editor-share.js`, `js/examples.js`, `js/export.js` | Propiedades de `share_created` y `example_loaded` |
| `js/i18n-en-editor.js` | 5 claves `entry.*` en inglés |
| `privacidad/index.html`, `privacy/index.html` | Contrato exacto, «Primera visita», sin pageviews; la tabla inglesa pasa a inglés |
| `sw.js` | CACHE `fluyo-static-v122`; `js/entry.js` en la lista obligatoria |
| `.ai/DECISIONS.md` | 320–322 |
| `.ai/ARCHITECTURE.md`, `AGENTS.md` | Sección y línea del mapa |

Sin cambios: formato `.fluyo.json`, kernel (`model.js`, motor, playback, `story-clock.js`), codec, `render.js`, Present, Share URL, ejemplos, MCP.

## QA

Ver «Evidencia». Suites:

- `node --test test/fluyo-growth-foundation-001.test.cjs` — contrato, privacidad, decisión de entrada, cableado.
- `node test/fluyo-growth-foundation-001-browser.cjs` — Chrome real (`FLUYO_SHOTS=<dir>` guarda capturas).
- `node test/fluyo-growth-foundation-001-mutations.cjs` — mutaciones sobre la lógica con decisiones.
- `node --test test/*.test.cjs` — suite completa contra la base.
- Regresión de navegador: Stories S1a/S1b/S2a/S2b, EXAMPLES-001, SHELL-001.

Tests de contrato antiguos actualizados (fijaban el payload anterior): `test/analytics.test.cjs`, `test/share.test.cjs`, `test/viewer.test.cjs`, `test/fluyo-014.test.cjs`. Alcances de slices anteriores: registran las piezas de esta tarea (`test/fluyo-growth-foundation-001-undo.cjs`, encadenada desde `undoOutcome`), como hizo cada slice desde I18N-002.

## Evidencia

| Suite | Resultado |
|---|---|
| `fluyo-growth-foundation-001.test.cjs` | 14 / 0 |
| `fluyo-growth-foundation-001-browser.cjs` (Chrome real) | 64 / 0 |
| `fluyo-growth-foundation-001-mutations.cjs` | 22 / 22 detectadas |
| Suite completa `node --test test/*.test.cjs` | 1853 tests · 1772 ok · 81 fallos, **todos preexistentes** (base d7e1177: 1839 · 83; 0 fallos nuevos, 2 de los conocidos pasan) |
| Stories S1a / S1b / S2a / S2b (navegador) | 35/0 · 47/0 · 50/0 · 40/0 |
| EXAMPLES-001 (navegador) | 40 / 0 |
| SHELL-001 (navegador, playwright-core fuera del repo) | 137 / 2 (los 2 de siempre: cabecera de `/ejemplos/` a 320 px y el recuento de nodos de «Abrir en el editor»; deuda conocida) |

### QA de cierre tras la revisión del PO (`5bbb094`)

| Suite | Resultado |
|---|---|
| `fluyo-growth-foundation-001.test.cjs` | 16 / 0 (+2: paridad de marcas de la ayuda en inglés, `<title>`/enlaces/pista) |
| `fluyo-growth-foundation-001-browser.cjs` | 66 / 0 (+ movimiento reducido: el ejemplo queda en su Historia sin arrancar) |
| `fluyo-growth-foundation-001-mutations.cjs` | 22 / 22 |
| Suite completa | 1855 · 1774 ok · 81 fallos, todos preexistentes (0 nuevos) |
| Stories S1a / S1b / S2a / S2b · EXAMPLES-001 | 35/0 · 47/0 · 50/0 · 40/0 · 40/0 |
| SHELL-001 | 137 / 2 (los 2 de siempre) |
| Auditoría inglesa (ES/EN, escritorio y 390 px) | 0 claves que caen al español; 0 texto español visible en la interfaz; ver `FLUYO-I18N-EN-RELEASE-AUDIT.md` |
| Detección con `released:true` (copia temporal) | en-US → tarjeta en inglés · es-CL → español · de-DE → inglés |

### QA tras publicar el inglés (`2ca8877`, decisión 324)

| Suite | Resultado |
|---|---|
| Growth unidad | 17 / 0 |
| Growth navegador | 78 / 0 · detección real sin `?lang`: en-US → inglés, es-CL → español, de-DE (no publicado) → inglés; tarjeta, ejemplo en su edición, Viewer y `editor_opened.locale` coherentes |
| i18n (catálogo, trinquete, puerta 324) | verde (incluida en la suite) |
| Suite completa | 1856 · 1775 ok · 81 fallos, todos preexistentes (0 nuevos) |
| Stories S1b / S2a / S2b · EXAMPLES-001 (Viewer/Share) | 47/0 · 50/0 · 40/0 · 40/0 |

### Producción (2026-11-01)

- `origin/main`: `d7e1177..ebf72cf` (avance rápido desde `growth-foundation-001`); Vercel desplegó y `https://fluyo.space/sw.js` sirve `fluyo-static-v122`. `sw.js`, `index.html`, `js/entry.js`, `js/i18n.js`, `js/analytics.js`, `js/editor-scenarios.js`, `js/viewer.js`, `js/i18n-en-editor.js` y `privacy/index.html` servidos idénticos byte a byte al commit.
- Smoke en Chrome real contra `https://fluyo.space` (Umami sustituido por un falso con el `beforeSend` de producción: sin tráfico de prueba en la analítica real): **30 / 0**.
  - Idioma automático: es-CL → español; en-US → inglés; de-DE (no publicado) → inglés.
  - Usuario nuevo ve la tarjeta; recurrente no (`returning: yes`).
  - «Ver un sistema en marcha» abre el ejemplo en su edición y reproduce la Story hasta el final; con `prefers-reduced-motion` queda lista sin arrancar.
  - `?ejemplo=`, `#d=` y `/s/` no se interceptan.
  - Share (enlace de Historia creado en producción) y Viewer en es y en, con inicio y final de la reproducción.
  - Ningún payload saliente lleva contenido del proyecto, URL, referrer ni campos extra.
  - Service worker instalado con la caché `fluyo-static-v122` y controlando la recarga.

Recorridos de navegador cubiertos: nuevo escritorio (Explorar → Historia reproduciéndose → `story_completed` una sola vez aunque se salte atrás; reproducir de nuevo; Share ×3; creación ×4; Present), En blanco / Escape / tocar el lienzo, recurrente (`fluyo.ui.theme`, sesión guardada), `?ejemplo=` válido y desconocido, `#d=` en el editor, `/s/` es y en de principio a fin, enlace de diagrama, inglés, móvil 390 × 844 táctil es y en (tarjeta con 16 px de margen, objetivos de 56 px, Historia reproduciéndose), y en local (127.0.0.1) sin ningún script de Umami. Sin errores de consola. También probado en `file://`: sin errores.

## Limitaciones conocidas

- **`returning` significa navegador con estado previo de Fluyo**: no usuario autenticado, ni persona única, ni usuario identificado (D4, PO). Cuenta navegadores, no personas.
- **Retorno = navegadores, no personas.** Modo privado, borrar datos del sitio u otro dispositivo cuentan como nuevo. Un usuario anterior a v122 que nunca editó ni cambió preferencias cuenta como nuevo una vez (y verá la tarjeta una vez).
- **Adquisición sin origen.** El referrer se descarta a propósito (`beforeSend`); `entry` dice por qué puerta entró (directo, ejemplo, enlace), no de qué sitio.
- **«Tarjeta mostrada» se infiere**: `editor_opened` {`entry: direct`, `returning: no`} ≈ tarjeta mostrada (salvo `localStorage` inaccesible, raro).
- **`story_completed` cuenta llegar al final**, también saltando de momento en momento; no mide atención.
- **El Viewer no escribe `fluyo.seen`**: quien solo vio un enlace compartido verá la tarjeta al abrir el editor (intencional).
- **Inglés publicado en v122** (decisión 324, [`FLUYO-I18N-EN-RELEASE-AUDIT.md`](FLUYO-I18N-EN-RELEASE-AUDIT.md)). Deuda aceptada: `/ejemplos/` y `/docs/` solo en español, contenido español en los documentos de la galería, descripción y etiquetas sociales en español. Los enlaces externos en inglés apuntan a `fluyo.space/`, no a `/ejemplos/`.
- En móvil, al reproducir el ejemplo la cámara sigue el momento y el diagrama no se ve entero (comportamiento previo de los ejemplos en 390 px).
- ~~La pista del lienzo vacío nombraba «Ejemplo»~~: corregido (`5bbb094`), ahora «Empieza añadiendo elementos al lienzo.» / «Start by adding elements to the canvas.», cabe a 390 px.

## Rollout

1. QA del PO en la rama `growth-foundation-001` (servir el worktree en local; la analítica no se activa fuera de `fluyo.space`).
2. Merge a `main`, push y despliegue: lo hace el PO o se pide explícitamente.
3. Tras desplegar: smoke en `fluyo.space` con perfil limpio (tarjeta, Explorar, `?ejemplo=`, `/s/`), y comprobar en la pestaña Events de Umami que llegan `entry_chosen`, `story_started`, `story_completed` y las propiedades nuevas.
4. Reversión: revertir el commit (no hay migración de datos; `fluyo.seen` es inocua).

## Estado de revisión del PO

Implementación base **APPROVED** (2026-10-31) con ajustes de cierre, hechos en `5bbb094`:

- D1 texto de la tarjeta: aprobado tal cual (ES y su adaptación EN).
- D2 reproducción automática al explorar: aprobada; con `prefers-reduced-motion` queda lista sin arrancar (probado en navegador).
- D3 `dismiss` por Escape o tocar el lienzo: aprobado; no se vuelve a mostrar (`fluyo.seen`).
- D4 `returning`: aprobado con la definición «navegador con estado previo de Fluyo».
- Pista del lienzo vacío neutral: hecho.
- Auditoría de inglés: hecha; publicación pendiente de aprobación.

Commits: `5bc88fb`, `ff68cea`, `5bbb094` (+ el de documentación de cierre). CACHE `v122`.

## Handoff

- Rama `growth-foundation-001` (worktree `../fluyo-growth`), base `d7e1177`.
- Si cambias un archivo servido de esta tarea, regenera `test/fluyo-growth-foundation-001-undo.cjs` (piezas con 2 líneas de contexto frente a `d7e1177`, sin la línea CACHE de `sw.js`; el generador usado vive fuera del repo, en el scratchpad de la sesión) o los alcances antiguos fallarán.
- Próximo paso: QA del PO → merge → despliegue → smoke de producción.
