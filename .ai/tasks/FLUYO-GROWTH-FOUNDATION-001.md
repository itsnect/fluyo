# FLUYO-GROWTH-FOUNDATION-001 — Base para medir el funnel y activar en el primer minuto

Estado: READY FOR PO QA (implementado en la rama `growth-foundation-001`; sin push ni despliegue)
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
| Return | `editor_opened.returning` | Ver decisión 321 | `yes` / `no` | Editor |

Sin cambios: `first_edit_completed`, `diagram_created`, `diagram_saved`, `diagram_exported`, `file_imported`, `gif_animation_added`, `link_failed`.

## Contrato de privacidad

Lo que sale del navegador (solo en `fluyo.space` / `www.fluyo.space`, hacia Umami): `website` (id público del sitio), `hostname`, `url: "/"`, `title: "Fluyo"`, `referrer: ""`, el nombre del evento y sus propiedades **de las listas cerradas de arriba**. Nada más: ni idioma del navegador, ni pantalla, ni URL, ni hash, ni query.

Nunca sale: contenido del diagrama, nombres de nodos, servicios o Historias, frases de los pasos, mensajes, documentos, enlaces `#d=`, ids de documento ni nada escrito por la persona. Comprobado en navegador real con un Umami falso que aplica el `beforeSend` de la página: en todos los recorridos, cero coincidencias con texto del ejemplo («Compra», «Tienda», «Pagos», «Banco», «Cliente», «Online checkout»…), `#d=`, `ejemplo=` o `lang=`.

Local, nunca enviado: `localStorage["fluyo.seen"]="1"` (decisión 321). La política pública (`privacidad/`, `privacy/`) lista ahora el contrato exacto, explica «Primera visita» y deja de decir que Umami recibe pageviews (no lo hace desde 4dab746).

## Decisión UX (decisión 322; texto y reproducción automática a revisar por el PO)

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

(se completa abajo, «Resultados»)

## Limitaciones conocidas

- **Retorno = navegadores, no personas.** Modo privado, borrar datos del sitio u otro dispositivo cuentan como nuevo. Un usuario anterior a v122 que nunca editó ni cambió preferencias cuenta como nuevo una vez (y verá la tarjeta una vez).
- **Adquisición sin origen.** El referrer se descarta a propósito (`beforeSend`); `entry` dice por qué puerta entró (directo, ejemplo, enlace), no de qué sitio.
- **«Tarjeta mostrada» se infiere**: `editor_opened` {`entry: direct`, `returning: no`} ≈ tarjeta mostrada (salvo `localStorage` inaccesible, raro).
- **`story_completed` cuenta llegar al final**, también saltando de momento en momento; no mide atención.
- **El Viewer no escribe `fluyo.seen`**: quien solo vio un enlace compartido verá la tarjeta al abrir el editor (intencional).
- **El inglés no está publicado** (decisión 269): un navegador en inglés ve la interfaz en español salvo con `?lang=en`. Publicarlo es decisión del PO; esta tarea no lo cambia.
- En móvil, al reproducir el ejemplo la cámara sigue el momento y el diagrama no se ve entero (comportamiento previo de los ejemplos en 390 px).
- La pista del lienzo vacío sigue nombrando «Ejemplo» (que está en «⋯») y en 390 px se corta: ahora solo la ve quien ya usó Fluyo y vacía el lienzo. Ver SHOULD FIX.

## Rollout

1. QA del PO en la rama `growth-foundation-001` (servir el worktree en local; la analítica no se activa fuera de `fluyo.space`).
2. Merge a `main`, push y despliegue: lo hace el PO o se pide explícitamente.
3. Tras desplegar: smoke en `fluyo.space` con perfil limpio (tarjeta, Explorar, `?ejemplo=`, `/s/`), y comprobar en la pestaña Events de Umami que llegan `entry_chosen`, `story_started`, `story_completed` y las propiedades nuevas.
4. Reversión: revertir el commit (no hay migración de datos; `fluyo.seen` es inocua).

## Estado de revisión del PO

Pendiente. Decisiones a confirmar: D1 texto de la tarjeta; D2 reproducción automática al explorar; D3 `dismiss` al tocar el lienzo; D4 `returning` basado en cualquier clave `fluyo.*`.

## Handoff

- Rama `growth-foundation-001` (worktree `../fluyo-growth`), base `d7e1177`.
- Si cambias un archivo servido de esta tarea, regenera `test/fluyo-growth-foundation-001-undo.cjs` (piezas con 2 líneas de contexto frente a `d7e1177`, sin la línea CACHE de `sw.js`; el generador usado vive fuera del repo, en el scratchpad de la sesión) o los alcances antiguos fallarán.
- Próximo paso: QA del PO → merge → despliegue → smoke de producción.
