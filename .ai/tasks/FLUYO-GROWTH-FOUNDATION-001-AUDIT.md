# FLUYO-GROWTH-FOUNDATION-001 — Auditoría (FASE 0, solo lectura)

**Fecha:** 2026-10-30 · **Base:** `main` en `d7e1177` (= `origin/main`), release `fluyo-static-v121` · **Rama de trabajo:** `growth-foundation-001` (worktree aislado).

Esta auditoría se hizo antes de tocar código: lectura dirigida del repositorio y recorrido en Chrome real (cdp-lite, perfil limpio, servidor local, sin service worker previo) a 1440 × 900 y 390 × 844 táctil.

## 1. Arquitectura actual de la analítica

| Pieza | Dónde | Qué hace |
|---|---|---|
| Transporte | `js/analytics.js` | Umami Cloud. Solo carga en `fluyo.space` / `www.fluyo.space`. Lista cerrada `ANALYTICS_EVENTS` (nombre → propiedades permitidas → valores permitidos). `analyticsProps` descarta el evento entero si una propiedad no está en su lista. `analyticsBeforeSend` reconstruye el payload: url `/`, título `Fluyo`, referrer vacío, sin pantalla ni idioma. Cola en memoria (≤ 100) mientras carga el script. |
| Instrumentación del editor | `js/editor-analytics.js` | `editor_opened` (DOMContentLoaded), `first_edit_completed` y `diagram_created` (comparando instantáneas en memoria). No se carga en el Viewer. |
| Viewer `/s/` | `s/index.html` carga solo `js/analytics.js` | `share_viewed`, `share_opened_in_editor`. |
| Persistencia | ninguna | Sin cookies, sin identificador, sin `localStorage` para analítica. `data-auto-track="false"`: **no hay pageviews** desde 4dab746. |

Eventos vigentes en el código (15; los 7 «históricos» siguen exactamente igual):

| Evento | Dónde se emite | Propiedades |
|---|---|---|
| `editor_opened` | `editor-analytics.js` (DOMContentLoaded) | — |
| `first_edit_completed` | `editor-analytics.js` | — |
| `diagram_created` | `editor-analytics.js` | — |
| `diagram_saved` | `export.js` | `format: fluyo_json` |
| `present_started` | `ui.js` | — |
| `diagram_exported` | `export.js` | `format: png/jpg/svg/gif` |
| `file_imported` | `export.js`, `deeplink.js` | `source: file/link`, `format` |
| `example_loaded` | `examples.js` (`?ejemplo=`), `export.js` (botón «Ejemplo» → `demo`) | `example` (12 slugs) |
| `gif_animation_added` | `interaction.js` | `anim` |
| `link_failed` | `deeplink.js` | `reason` |
| `share_created` | `editor-share.js` | — |
| `share_viewed` | `viewer.js`, tras el primer render | — |
| `share_opened_in_editor` | `viewer.js` | — |

## 2. Entradas, carga inicial y documentos

- **`fluyo.space/` es el editor.** No hay home ni landing dentro de la app; `/ejemplos/`, `/docs/` y las páginas legales son estáticas aparte.
- Arranque (`ui.js`, `state.js`): si la URL trae documento (`?ejemplo=` o `#d=`, `urlBringsDocument()`), lo resuelve quien lo trae (modal de conflicto si hay sesión guardada). Si no, y hay autoguardado, modal «Sesión guardada». Si no hay nada: **lienzo vacío**.
- **Lo que ve una persona nueva** (captura 01/03): un lienzo oscuro con el texto pintado en el canvas «Elige una forma o icono a la izquierda y haz clic aquí — o pulsa «Ejemplo»». Esa es su primera decisión: dibujar sin saber qué, o encontrar «Ejemplo».
  - «Ejemplo» **no está a la vista**: vive dentro de «⋯» (menú Más › Archivo).
  - En móvil (390 px) el texto del lienzo **se corta por los dos lados** («…a o icono a la izquierda y haz clic aquí — o p…») y además habla de «la izquierda», donde en móvil no hay rail.
- **Examples** (`examples.js`): lista blanca, 3 publicados (`compra-online`, `inicio-de-sesion-oauth2`, `pedido-asincrono-cola`), cada uno con 2 Historias, edición inglesa elegida al cargar. `?ejemplo=` y el botón «Ejemplo» abren en **modo Historias con la primera Historia seleccionada** (`showExampleStories`) y el botón «Reproducir» visible en escritorio (captura 02).
- **Documento nuevo**: no existe «nuevo documento»; el lienzo vacío inicial *es* el documento nuevo. Autoguardado en `localStorage["fluyo.autosave.v1"]` solo tras una edición.
- **Routing**: no hay router. Tres entradas por URL: `/` (editor), `/?ejemplo=<slug>`, `/#d=` (enlace MCP) y `/s/#d=` (Viewer). `?lang=xx` fuerza idioma de esa carga.

## 3. Ciclo de vida de una Historia

| Momento | Editor | Present | Viewer |
|---|---|---|---|
| Crear | `scNewScenario` (botón «+»), auto-creación al tocar el sistema (`scTapAddStep`) o al colocar un evento, `scDuplicateScenario`, variante `scBranchFrom` | — | — |
| Empezar | `scRun()` | `presentPlay()` → `scRun({present:true})` | `storyPlay()` |
| Terminar | `scTick` → `scStatus="completed"` cuando `FluyoStory.isFinished` | el mismo `scTick` | bucle de render: `story.status="completed"` |
| Reiniciar/saltar | `scReset`, saltos de momento (pueden volver a «running» y terminar otra vez) | igual | `storySeek` (ídem) |

Ninguno de estos puntos emite hoy un evento. `present_started` existe pero no distingue si se reprodujo una Historia.

## 4. Share y Viewer

- `share_created` se emite tras crear un enlace válido. El dato limpio que ya existe en ese punto: `kind` (`story` / `diagram`) y si viajan «otras formas» (`withOthers`, ya resuelto tras el posible recorte por tamaño).
- `share_viewed` = primer render correcto del Viewer: es el `viewer_opened` que pide la tarea. Renombrarlo partiría la serie histórica.
- El Viewer sabe si hay Historia reproducible (`storyScenario()`).

## 5. Señal de retorno

- Hoy **no existe**. Umami agrupa sesiones con un hash de su lado (IP + agente, sal mensual): no es fiable ni lo controlamos.
- Ya hay claves locales `fluyo.*` que delatan uso previo: `fluyo.autosave.v1`, `fluyo.ui.theme`, `fluyo.ui.props`, `fluyo.ui.lang`.
- Propuesta: una clave local más, `fluyo.seen`, sin identificador ni fecha, y enviar **solo** un `returning: yes/no` en `editor_opened`. Sin fingerprinting, sin ID, sin backend.
- Límite honesto: cuenta **cargas** de navegadores que ya abrieron Fluyo, no personas. Modo privado, borrar datos del sitio u otro dispositivo cuentan como nuevo.

## 6. Tiempo hasta la primera Historia (estimación)

| Camino | Pasos hasta ver una Historia moverse |
|---|---|
| Galería `/ejemplos/` → ▶ de una Historia | 1 clic (abre el Viewer) + «Reproducir» |
| `fluyo.space/` nuevo, escritorio | descubrir «⋯» → «Ejemplo» → «Reproducir»: 3 clics **si se descubre «⋯»**; el lienzo nombra «Ejemplo» pero no dice dónde está |
| `fluyo.space/` nuevo, móvil | igual, con el texto de ayuda cortado |
| «Compra con éxito» | ~6 momentos, ≈ 15 s de reproducción |

La barrera no es la duración: es **descubrir** que hay algo que reproducir.

## 7. Gaps

1. No se puede medir Story (crear, empezar, terminar) en ninguna superficie.
2. `example_loaded` no dice por dónde llegó (URL, botón, entrada).
3. `share_created` no distingue Historia / diagrama ni variantes.
4. `share_viewed` no dice si había Historia; no hay inicio ni fin de Historia en el Viewer.
5. No hay señal de retorno ni de idioma (el idioma se descarta en `beforeSend`).
6. Primera carga sin camino visible hacia una Historia.
7. Fuera de alcance pero relevante: el inglés **no está publicado** (`LANGS.en.released=false`, decisión 269): un navegador en inglés ve la interfaz en español salvo con `?lang=en`. Publicarlo es una decisión del PO, no de esta tarea.
8. La política de privacidad está desfasada: ES y EN siguen diciendo que Umami recibe «Pageviews» (no es cierto desde 4dab746) y la tabla inglesa no tiene los eventos de Share.

## 8. Propuesta mínima

**Instrumentación** (mismo transporte, misma lista cerrada; ningún evento se renombra):

- Ampliar con propiedades enumeradas: `editor_opened` (`entry`, `returning`, `locale`), `example_loaded` (`source`), `share_created` (`kind`, `variants`), `share_viewed` (`story`, `locale`).
- Nuevos: `entry_chosen`, `story_created`, `story_started`, `story_completed`, `viewer_story_started`, `viewer_story_completed`. Uno por acción de producto, nunca por fotograma o paso.
- `app_opened` = `editor_opened` (se reutiliza); `viewer_opened` = `share_viewed` (se reutiliza).

**Primer minuto:** una tarjeta pequeña sobre el lienzo vacío, solo para un navegador que nunca abrió Fluyo y sin documento en la URL. Dos salidas: «Ver un sistema en marcha» (abre el Example real `compra-online` en modo Historias y reproduce su primera Historia) y «Empezar en blanco». No es modal: Escape o tocar el lienzo la cierran. Nunca aparece con `?ejemplo=`, `#d=`, `/s/`, sesión guardada ni ninguna clave `fluyo.*` previa.

**Por qué encaja sin arquitectura nueva:** reutiliza `fetchExample`, `presentIncomingDocument`, `showExampleStories` y `scRun`; un archivo nuevo de editor (`js/entry.js`) con la decisión pura y testeable; ningún cambio de formato, kernel, codec ni MCP.

## 9. Archivos afectados (previstos)

`js/analytics.js`, `js/editor-analytics.js`, `js/entry.js` (nuevo), `js/editor-runtime.js` (sin texto del lienzo con la tarjeta abierta), `js/editor-scenarios.js`, `js/examples.js`, `js/export.js`, `js/editor-share.js`, `js/viewer.js`, `js/i18n-en-editor.js`, `index.html`, `css/styles.css`, `sw.js` (CACHE v122 + `js/entry.js`), `privacidad/index.html`, `privacy/index.html`, `.ai/DECISIONS.md`, tests.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un evento con una propiedad fuera de lista se descarta **entero** (p. ej. `editor_opened` con un idioma raro) | `locale` se normaliza a la lista o a `other`; tests de cada combinación |
| La tarjeta intercepta un enlace profundo | La decisión exige `!urlBringsDocument()`; tests unitarios y de navegador con `?ejemplo=`, `#d=` y `/s/` |
| Molestar a quien ya usa Fluyo | Cualquier clave `fluyo.*` previa la apaga; nunca se muestra dos veces tras elegir |
| Reproducción automática no deseada | Solo tras elegir «Ver un sistema en marcha»; con `prefers-reduced-motion` queda lista sin arrancar |
| `story_completed` duplicado al saltar tras terminar | Una vez por reproducción (bandera por ejecución) |
| Caché del SW | CACHE v122 y `js/entry.js` en la lista obligatoria |

## 11. Tests relevantes

- Unit: `test/analytics.test.cjs` (transporte, editor), nuevos `test/fluyo-growth-foundation-001.test.cjs` (contrato, privacidad, decisión de entrada).
- Navegador: nuevo `test/fluyo-growth-foundation-001-browser.cjs` (nuevo/recurrente, explorar, en blanco, `?ejemplo=`, `#d=`, `/s/`, es/en, móvil, eventos capturados con un Umami falso).
- Regresión: suite completa `node --test test/` comparada con la base (1839 / 83 conocidos) y los navegadores de Stories S1a/S1b/S2a/S2b, EXAMPLES-001 y SHELL-001.

**Estado:** propuesta coherente → se pasa a implementación.
