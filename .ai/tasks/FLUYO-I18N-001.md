# FLUYO-I18N-001 — English foundation (auditoría, arquitectura mínima de i18n y vertical slice)

Estado: **READY FOR COMMIT** — D-LANG aprobada (opción A, decisión 260); slice integrada sobre `main` después de FLUYO-018.30
(`e82c821`), `CACHE` v105, sin commit.
Owner/agente actual: libre (cambios sin commitear en el checkout principal; el worktree `fluyo-i18n-001` fue la revisión previa).

> Repo público: este archivo solo contiene contenido técnico apto para publicarse.

## Objetivo

Preparar Fluyo para ofrecer la interfaz completa en español e inglés **sin duplicar código ni introducir inconsistencias**: auditar
todo el texto visible, separar lo que es interfaz de lo que es contenido o contrato, proponer una arquitectura de i18n pequeña y
coherente con la filosofía del proyecto (sin build, scripts clásicos, sin dependencias) y probarla con una vertical slice
(cabecera del editor + Present + Viewer) con tests. **Sin** traducción masiva, **sin** cambiar el modelo de documentos ni los
contratos, **sin** push ni deploy.

## Alcance

Incluye: auditoría cuantificada, clasificación, arquitectura, glosario inicial, runtime `js/i18n.js`, diccionario `js/i18n-en.js`,
vertical slice (cabecera del editor, mando de Present, Viewer entero), tests (unidad, catálogo, trinquete, vm y Chrome real).

No incluye: el resto del editor (≈ 555 textos de `index.html` y ≈ 590 de JS), el kernel (`model.js`, `story-playback.js`,
`story-authoring.js`, `document-integrity.js`…), el MCP, páginas estáticas, ejemplos, SEO, ni un selector de idioma visible.

## 1. Auditoría — dónde está el texto

Medido con `test/i18n-scan.cjs` (heurística: literales con aspecto de frase o palabra con mayúscula; nodos de texto y atributos
`title`/`aria-label`/`data-tip`/`placeholder`/`alt` sin marca) sobre la base `87a9d76`, más lectura dirigida del código.

### 1.1 Mapa por superficie

| Superficie | Dónde vive el texto | Cómo llega a la pantalla |
|---|---|---|
| Editor — cabecera, menús «Lienzo» y «Más», panel de Propiedades, pestañas de página, diálogos (`<dialog>` de compartir, exportar, eventos) | `index.html` (estático) + `js/ui.js`, `js/selection.js`, `js/export.js`, `js/editor-share.js`, `js/interaction.js` | HTML; `textContent`/`innerHTML`; `title`, `aria-label`, `data-tip` (tooltip CSS por `attr()`); `alert/confirm/prompt` nativos (13) |
| Historias (panel, storyboard, biblioteca, modal de evento, menús de aparición) | `js/editor-scenarios.js` (≈ 240 textos) + su HTML en `index.html` | DOM generado desde JS; frases de ayuda; plantillas por defecto (`"{source} envía a {target}"`) |
| Present (editor) | `#presentBar` / `#presentStory` en `index.html`, `js/present-story.js`, botón de aspecto en `js/ui.js` | DOM; la frase del momento viene del kernel (`FluyoStory.describe`) |
| Viewer `/s/` | `s/index.html`, `js/viewer.js` | DOM; avisos de error de enlace; la frase del momento viene del kernel |
| Lienzo (canvas) | `js/render.js` (sugerencia de lienzo vacío), `js/viewer.js` («Esta página no contiene elementos.») | `fillText` |
| Narrativa de la Historia (Present, Viewer, editor) | `js/story-playback.js` (kernel): «X no está disponible», «Reproducción terminada», «Elemento sin nombre», errores humanos de reproducción | se pega a texto del autor (frases de evento, nombres) |
| Errores técnicos | `js/document-integrity.js`, `js/link-codec.js`, `js/share-loader.js`, `js/model.js` (códigos) | códigos estables (`invalid_document`…) + mensaje humano en español |
| Autoría por lotes (MCP) | `js/story-authoring.js` (kernel, ≈ 125 mensajes) | errores devueltos al modelo de lenguaje por el MCP |
| Valores sembrados en documentos | `js/model.js` («Página 1», «Historia N», «Nodo», «Texto», «Escenario», « copia», «Origen»/«Destino»), `js/config.js` (etiqueta de icono → etiqueta del nodo: «Usuario», «Móvil»…; nombres de la paleta), `js/share-loader.js` (documento demo), `js/export.js` (ejemplo incorporado) | se **guardan** en el `.fluyo.json` al crear |
| Configuración visible | `js/config.js`: grupos de iconos («General»), nombres de icono (≈ 90), nombres de paleta (14), animaciones | `title` y rótulos de cajones |
| Exportaciones | `js/export.js`: nombre de archivo `diagrama.fluyo.json`, `slug()` del nombre de página (contenido), progreso del GIF («Renderizando fotogramas…»), avisos | descarga / diálogo; el SVG/PNG/GIF no lleva texto de interfaz |
| URLs | `?ejemplo=<slug>` (parámetro y slugs en español), `/s/#d=` (sin idioma), páginas `/privacidad` ↔ `/privacy`, `/soporte` ↔ `/support`, `/terminos` ↔ `/terms` (ya bilingües), `/docs`, `/ejemplos` (solo español) | contrato de enlaces publicados: no renombrar |
| Páginas estáticas | `docs/index.html` (≈ 520 textos, solo es), `ejemplos/index.html` (≈ 110, solo es), legales/soporte (ya en es y en) | HTML |
| Ejemplos | `ejemplos/data/*.fluyo.json` (8 documentos en español) | **contenido**, no interfaz |
| SEO | `<title>`, `meta description`, Open Graph, JSON-LD del editor (`inLanguage: "es"`) | estático |
| MCP (repo `fluyo-mcp`) | descripciones de 15 herramientas (≈ 54,7 KB de catálogo, en español), plantillas («Pipeline orientado a eventos (Kafka)»…), errores del kernel | contrato con el modelo de lenguaje |
| Telemetría | `js/analytics.js`: nombres de evento y valores de listas cerradas | nunca texto visible; no se traduce |

### 1.2 Clasificación pedida

| Categoría | Ejemplos | ¿Se traduce? | Cómo |
|---|---|---|---|
| **UI** (texto de Fluyo) | «Presentar», «Deshacer · Ctrl+Z», «Página anterior (←)», avisos de compartir | **Sí** | `FluyoI18n.t` / `data-i18n` |
| **Contenido del autor** | etiquetas de nodos y conexiones, nombres de página, de Historia y de evento, frases (`sentenceTemplate`), `message` de un paso, símbolos | **Nunca** (ni automáticamente) | se pinta tal cual |
| **Nombres/descripciones de elementos** | etiqueta del nodo; la del icono se copia al crear («Usuario») | El texto guardado no. El **valor sembrado** al crear, sí: en el idioma de la interfaz en ese momento | depende de D-LANG (§5) |
| **Mensajes de Story** | consecuencia «Cliente paga a Comercio» (plantilla del autor + nombres del autor) | La plantilla no. Las piezas que **pone Fluyo** dentro («no está disponible», «Elemento sin nombre», «Origen»/«Destino», «Reproducción terminada») sí, pero viven en el kernel | por código en la frontera (D4), según D-LANG |
| **Terminología del modelo** | `FLOW`, `OCCURRENCE`, `SET_AVAILABILITY`, `SEND`, `SET_STATE`, `UP`/`DOWN`, `engineVersion`, claves de `ICONS`/`ANIMS`, `shape`, marcadores `{source}`/`{target}`/`{name}`, códigos de error | **Nunca** (son contrato) | — |
| **Errores técnicos** | `invalid_document`, mensajes de `document-integrity.js`, `console.error` | El código no; el mensaje humano mostrado sí; los logs de consola no | por código |
| **Present/Viewer** | transporte, rótulos, avisos de enlace | **Sí** (hecho en la slice) | — |
| **Documentación** | `docs/`, `ejemplos/`, README | Sí, como páginas hermanas (`/en/…`), no por diccionario | D6 |
| **MCP / tool descriptions** | descripciones, errores de autoría, plantillas | Decisión aparte (D5) | — |

### 1.3 Impacto de introducir inglés sin romper documentos en español

- **Documentos existentes: ninguno.** La slice no lee ni escribe el documento; un `.fluyo.json` en español se abre igual y se guarda
  byte a byte igual. El formato no cambia (versión 5, `engineVersion` 2).
- **Mezcla visible**: con la interfaz en inglés, el contenido del autor sigue en español (es lo correcto; ver captura de Present en
  §6). La mezcla **dentro de una misma frase** aparece solo cuando Fluyo completa texto del autor con piezas propias del kernel
  («Elemento sin nombre no está disponible»); por eso esas piezas no se tocaron (D-LANG / D4).
- **Valores sembrados**: si mañana el editor siembra en inglés («Page 1», «Story 1», «User»), los documentos nuevos nacen en inglés y
  los viejos no cambian. Riesgo bajo, pero toca `model.js` (kernel) → sincronía con el MCP.
- **Tests**: decenas de tests históricos buscan literales en español en el código y en el HTML. Con el español en línea (§2) siguen
  valiendo; solo cambiaron 9 guardas de alcance que no conocían archivos nuevos de tareas posteriores (§7).
- **Concurrencia**: otra sesión edita `js/viewer.js` y `js/viewer-viewport.js` (FLUYO-018.30, sin commit en `main`). La slice se hizo
  en un worktree aparte; al integrar habrá un conflicto pequeño en `viewer.js` y en `CACHE` (las dos suben a v104).

## 2. Arquitectura propuesta (implementada en lo mínimo)

**Principio**: texto de la interfaz = clave + texto base en español en el sitio de uso; los demás idiomas = un diccionario plano por
idioma. Nada de framework, build, `fetch` ni módulos ES.

```text
js/i18n-en.js   FLUYO_LOCALES.en = { "present.exit": "Exit", ... }        (un archivo por idioma; se carga antes)
js/i18n.js      FluyoI18n.t(clave, textoEs, params) · applyDom() · setLocale() · locale() · missing()
JS              FluyoI18n.t("present.exit", "Salir")
HTML            <span data-i18n="present.exit">Salir</span>   data-i18n-title / -aria-label / -tip / -placeholder
```

- **Una fuente de verdad por texto**: la clave. Su español está en el sitio de uso (o en el HTML, que es el texto que se ve antes del
  JS); el test exige que cada clave tenga **un único** texto en español en todo el repo y que cada idioma tenga **exactamente** esas
  claves, sin vacíos y con los mismos marcadores `{param}`.
  - Por qué no un `es.js`: (1) en español `t()` devuelve el texto base sin diccionario: la interfaz actual es byte a byte la misma;
    (2) muchos tests históricos buscan los literales en español en el código; (3) cualquier contexto que cargue un archivo sin
    `i18n.js` seguiría leyéndose en español; (4) el código se sigue leyendo en español, como el resto del repo.
- **Interpolación** `{name}` en una pasada (lo insertado no se reinterpreta) y **plurales** `{one, other}` con `Intl.PluralRules`.
- **Falta una traducción** → cae al español y queda en `FluyoI18n.missing()` (los smokes lo comprueban vacío). Nunca se pinta una clave.
- **HTML**: `applyDom` cambia solo el texto **propio** del elemento (primer nodo de texto con letras), conserva glifos («▶ »), iconos
  y subelementos (`lblRest`). Recuerda el texto base para volver al español sin recargar. En español no toca el DOM.
- **Idioma de la carga** (solo interfaz): `?lang=xx` (esta carga) › `localStorage["fluyo.ui.lang"]` (como `fluyo.ui.theme`) › español.
  `AUTO_DETECT=false`: `navigator.language` no se usa hasta que la traducción esté completa (nadie ve una interfaz a medias sin
  pedirla). Un idioma sin diccionario se ignora.
- **No es kernel**: `fluyo-mcp` no copia `i18n.js`; ningún archivo del kernel cambió (kernelId intacto).
- **Detectar texto sin migrar**: `test/i18n-scan.cjs` + `test/fluyo-i18n-001-baseline.json` (trinquete por archivo: puede bajar,
  nunca subir; al migrar, `node test/i18n-scan.cjs --write-baseline`). Las regiones ya migradas exigen 0 textos sin marca.
- **Añadir un idioma**: `js/i18n-<xx>.js` + su `<script>` en `index.html` y `s/index.html` + precache en `sw.js`. Nada más cambia;
  el test de catálogo lo valida igual que el inglés. (Con 3+ idiomas, valorar cargar solo el activo; hoy el inglés de la slice pesa
  ≈ 4 KB y completo rondaría 50–60 KB sin minificar.)

## 3. Inventario cuantificado

| Medida (base `87a9d76`) | Valor |
|---|---|
| Texto de interfaz sin migrar en JS (tras la slice) | **759** literales (≈ **588** únicos) en **23** archivos |
| — de ellos en el kernel (`config`, `model`, `story-playback`, `story-authoring`, `document-integrity`, `safe-svg`) | ≈ 312 (≈ 125 son errores de autoría para el MCP; ≈ 90 nombres de icono) |
| Texto sin migrar en `index.html` (tras la slice) | **555** nodos/atributos (≈ **428** únicos) |
| Viewer `s/index.html` | **0** (migrado entero: 42 antes) |
| Páginas estáticas solo en español | `docs/` ≈ 520 · `ejemplos/` ≈ 110 |
| Diálogos nativos (`alert/confirm/prompt`) | 13 |
| Valores sembrados en documentos | ≈ 12 en `model.js` + ≈ 90 etiquetas de icono + 14 nombres de paleta |
| Ejemplos (contenido) | 8 documentos `.fluyo.json` |
| MCP | 15 herramientas, ≈ 54,7 KB de descripciones; ≈ 125 errores de autoría; plantillas |
| **Estimación total de strings de UI del producto** | **≈ 1 000–1 100 únicos** (editor + Historias + Present/Viewer + kernel humano), sin contar `docs/` ni el MCP |
| Archivos de código afectados por una migración completa | ≈ 20 JS + 2 HTML (+ `sw.js`) |
| Ya migrado en la slice | **66 claves**, 107 usos |

Falsos positivos conocidos de la heurística (cuentan en el trinquete, no se traducen): nombres de tecla (`"Escape"`, `"Home"`),
nombres de fuente (`"Playfair Display"`), nombres de producto de icono (`"Kafka"`, `"BigQuery"`), mensajes de consola.

### Textos que requieren decisión terminológica

«Historia» (Story/Scenario), «momento», «aparición», «evento» (event vs. event type), «biblioteca de eventos», «frase», «globo»,
«símbolo», «aspecto plano / construido (2.5D)», «ruta observada», «disponibilidad / estado inicial», «Esperar a que llegue…»,
«Al mismo tiempo», «Invertir sentido», «Lienzo», «Elemento» vs «Nodo», «Presentar» (verbo) vs «Present» (modo), «Visor»/«Viewer»,
`?ejemplo=` y sus slugs, nombre de archivo `diagrama.fluyo.json`.

## 4. Glosario inicial (propuesta para aprobar — D8)

| Español (UI) | English (UI) | Nota |
|---|---|---|
| Lienzo | Canvas | |
| Propiedades | Properties | |
| Editar (modo) | Edit | |
| Historia / Historias | Story / Stories | En código y MCP sigue siendo `Scenario`; en la UI, «Story» |
| Momento | Moment | grupo de pasos con el mismo `at` |
| Paso / aparición | Step | «aparición» = un paso colocado; en inglés basta «step» |
| Evento (de la biblioteca) | Event | `EventType` en código |
| Biblioteca de eventos | Event library | |
| Frase | Sentence | `sentenceTemplate` |
| Mensaje / globo | Message / bubble | |
| Símbolo | Symbol | |
| Presentar / Present | Present | el modo se llama Present en ambos idiomas |
| Visor | Viewer | |
| Elemento / Nodo | Element / Node | la UI dice «elemento»; «nodo» solo en el valor sembrado |
| Conexión | Connection | |
| Flujo | Flow | `FLOW` |
| Disponibilidad · Estado inicial | Availability · Initial state | `SET_AVAILABILITY`, `UP`/`DOWN` |
| Condición / requisito | Condition / requirement | |
| Ruta observada · Ruta disponible / no disponible | Observed route · Route available / unavailable | |
| Esperar a que llegue… | Wait for arrival… | dependencias de llegada |
| Al mismo tiempo | At the same time | |
| Invertir sentido | Reverse direction | `reverse:true` |
| Reproducir · Repetir · Pausar · Reanudar · Detener | Play · Replay · Pause · Resume · Stop | |
| Aspecto plano · construido (2.5D) | Flat · Built (2.5D) | `settings.skin` |
| Página | Page | |
| Compartir · Exportar · Ejemplo | Share · Export · Example | |
| Deshacer · Rehacer | Undo · Redo | |

## 5. D-LANG: idioma de un documento compartido — **APROBADA: opción A** (decisión 260)

El PO aprobó A: el idioma del documento no se persiste; la interfaz sigue el idioma de quien mira (`?lang=en` › preferencia del
navegador › español) y el contenido del autor queda en su idioma original. Opciones que se presentaron:

- **A. Sin idioma guardado (recomendada para ahora).** El cromo (botones, avisos, Present, Viewer) sigue el idioma de quien mira.
  Lo que Fluyo pega a texto del autor («no está disponible», «Elemento sin nombre», «Origen/Destino») también sigue a quien mira.
  Los valores sembrados se crean en el idioma de la interfaz de quien crea y luego son contenido. Coste: 0 cambios de formato ni
  de MCP. Riesgo: alguna frase mixta en el Viewer cuando la plantilla del autor está en un idioma y quien mira en otro.
- **B. Idioma del contenido guardado, opcional (`settings.lang`, lista cerrada, ausente = no se sabe).** El cromo sigue a quien mira;
  las piezas que Fluyo pega a texto del autor siguen al documento (sin frases mixtas). Coste: clave nueva normalizada (patrón
  `skin`/`arrowSize`: ausente = se guarda byte a byte igual), kernel + MCP sincronizados, el MCP debería poder fijarlo.
- **C. Como B, y además el Viewer abre en el idioma del documento** si quien mira no eligió otro. Coste: B + una regla de prioridad
  más; un enlace compartido «cambia» el idioma del Viewer según el autor.

Recomendación: **A ahora**, revisando B cuando se migre la narrativa del kernel (D4), que es donde la mezcla puede notarse.

## 6. Vertical slice (implementada)

- **Editor — cabecera**: modo Editar/Historias, Deshacer/Rehacer (tooltip y aria), Lienzo, Exportar, Compartir, Presentar,
  Propiedades, Más.
- **Present (editor)**: mando completo (Historia y páginas), Reproducir/Repetir/Detener, Pausar/Reanudar (compartido con el
  storyboard, `scSetPauseLabel`), «En pausa · …», aspecto Plano/Construido.
- **Viewer** (`/s/`): todo el HTML (título de pestaña incluido), banda, rótulo «Historia · nombre», «En pausa», páginas sin nombre
  («Page N»), cargando, errores del enlace, «Abrir en Fluyo» (con su versión corta de teléfono), Present.
- Fuera a propósito (D-LANG/D4): «Elemento sin nombre» del Viewer, frases del kernel; la fila sonda de `presentHeaderBottom`
  (aria-hidden, solo mide alto) mantiene su literal.

Capturas en Chrome real (no versionadas): Present en inglés con contenido del autor en español; Viewer en inglés a 390 px.

## 7. Archivos modificados

Integración (sesión 2): la slice se revisó en el worktree `fluyo-i18n-001` sobre `87a9d76` y se re-aplicó sobre `main` después de
FLUYO-018.30 (`e82c821`): los seis archivos servidos entraron limpios por 3-way (también `js/viewer.js`, que 018.30 había cambiado;
018.30 no añadió texto visible nuevo al Viewer); `sw.js` a mano (`CACHE` v104 → **v105** y el precache); `undoI18n` regenerado
contra `e82c821` y encadenado como el MÁS reciente dentro de `undoMsg` (`undo029(undo030(undoI18n(src)))`), con sus claves
exportadas salvo `sw.js`; las guardas antiguas ajustadas sobre las versiones que ya había tocado 018.30 (`ONLY030`).

Servidos (CACHE `v104 → v105`):
- `js/i18n.js` (nuevo) — runtime.
- `js/i18n-en.js` (nuevo) — inglés de la slice (66 claves).
- `index.html` — carga de `i18n-en.js` + `i18n.js` antes de `config.js`; marcas `data-i18n*` en cabecera y `#presentBar` (sin cambiar textos).
- `s/index.html` — misma carga; marcas en todo el Viewer.
- `js/viewer.js` — textos por `FluyoI18n.t`; `SHARE_ERROR_MESSAGES` con getters (sigue siendo un mapa de textos).
- `js/present-story.js`, `js/ui.js` (`syncPresentSkinButton`), `js/editor-scenarios.js` (`scSetPauseLabel`) — `FluyoI18n.t`.
- `sw.js` — `CACHE` v104 y precache de los dos archivos nuevos.

Tests:
- `test/fluyo-i18n-001.test.cjs` (nuevo, 20 tests), `test/i18n-scan.cjs` (nuevo, escáner), `test/fluyo-i18n-001-baseline.json`
  (nuevo, trinquete), `test/fluyo-i18n-001-browser.cjs` (nuevo, Chrome real), `test/fluyo-i18n-001-undo.cjs` (nuevo, `undoI18n`
  para alcances antiguos; generado del diff con 2 líneas de contexto).
- Cadena de undo: `fluyo-step-message-001-undo.cjs` aplica `undoI18n` antes que `undo030` y `undo029`, y expone sus claves (sin `sw.js`).
- Harnesses: `viewer-harness.cjs` y `fluyo-016-harness.cjs` cargan el i18n (como las páginas); contextos vm puntuales en
  `fluyo-019-2` y `fluyo-scenarios-semantics-5`.
- Guardas de alcance antiguas contra commits fijos (9: semantics-1…6, step-message-001, step-reverse-002/003): excluyen
  `NEW_FILES` de esta tarea y comparan `sw.js`/markup tras `undoI18n` (misma pauta que `ONLY029` de 018.29). `viewer.test.cjs`:
  la regex de scripts admite dígitos (`i18n-en.js`).
- `CACHE` v105 en las aserciones de los tests (como cada tarea), incluida la mutación U1 de `fluyo-018-30-mutations.cjs`.
- `.ai/DECISIONS.md` — decisiones 260 (D-LANG A) y 261 (arquitectura i18n).

## 8. Pruebas

### Sesión 2 — integración sobre `main` (`e82c821`, CACHE v105)

- `node --test test/fluyo-i18n-001.test.cjs` → **20/20**.
- Suite completa `node --test test/*.test.cjs`: base `e82c821` limpia = **81 fallos preexistentes** de 1 613 (los mismos 11 archivos
  históricos). Con la slice commiteada (simulado en un clon desechable): **1 633 tests, exactamente los mismos 81** (0 nuevos).
- Chrome real: `fluyo-i18n-001-browser.cjs` **78/78**; `fluyo-018-30-browser.cjs` (cámara del Viewer) **402/0**, como en 018.30;
  `fluyo-014-browser.cjs` (Share con Historia, offline, upgrade del SW v56 → v105) **OK, 13 bloques**.
- Ajustes extra al integrar: `undoI18n` dentro de las comparaciones de 018-29 #10, 018-30 #13 y step-message I1 (encadenadas ya con
  `undo030`).

### Sesión 1 — revisión en el worktree (`87a9d76`, CACHE v104)

- `node --test test/fluyo-i18n-001.test.cjs` → **20/20**.
- `node test/fluyo-i18n-001-browser.cjs` (Chrome real, playwright-core por `NODE_PATH` fuera del repo) → **78/78**: editor en/es a
  1440, Present en/es con Historia (reproducir, pausar, reanudar, detener), Viewer en/es a 1440 y 390; sin errores de consola, sin
  claves sin traducir, cabeceras sin desbordar.
- Suite completa `node --test test/*.test.cjs`: base `87a9d76` limpia = **83 fallos preexistentes** en 11 archivos (tests
  históricos desfasados: 011-final-fixes, 012-1-qa, scenario-ui-dom, 018-25…). Con la slice **commiteada** (simulado en un clon
  desechable con `FLUYO_GIT_ROOT`): **exactamente los mismos 83** (0 nuevos) de **1 620** tests. Sin commit aparecen además 11
  guardas que comparan con `HEAD` literal o con `git ls-files` (018-19 #1, 018-21 #18, 018-23 #1, 018-24 #9, 018-25 #16,
  018-29 #1, 019-1 #15, 019-2 #13–#15, semantics-6 C1): son transitorias por diseño (cualquier cambio sin commitear las enciende)
  y desaparecen al commitear, como en las tareas anteriores.

## 9. Decisiones para el PO

- **D-LANG** (§5) — **aprobada: A** (decisión 260).
- **D1** Arquitectura: español en línea + diccionarios por idioma (implementada) frente a un catálogo `es.js`. Recomiendo la implementada.
- **D2** Resolución del idioma: `?lang` › preferencia › español; `AUTO_DETECT` apagado hasta cubrir el 100 %. Al encenderlo:
  ¿`es*` → español y **todo lo demás → inglés**? (recomendado).
- **D3** Selector de idioma: en «Más → Interfaz», junto al tema de la interfaz; preferencia del navegador, nunca del documento.
- **D4** Kernel: la narrativa y los errores humanos se traducen **por código en la frontera** (el kernel devuelve código + parámetros;
  editor/Viewer traducen); el MCP mantiene su texto. Requiere sincronía de kernel con `fluyo-mcp`.
- **D5** MCP: descripciones y errores siguen en español por ahora; tarea propia si se quieren en inglés (presupuesto de catálogo).
- **D6** Páginas estáticas y SEO: páginas hermanas en inglés (`/en/`, `/en/docs/`…, `hreflang`), no por diccionario.
- **D7** Ejemplos: conjunto en inglés como contenido nuevo (no traducción automática); `?ejemplo=` se mantiene (alias `?example=` opcional).
- **D8** Glosario (§4), en especial Story / Moment / Built.
- **D9** Convención de tests: cuando una tarea añade archivos servidos, las guardas antiguas los excluyen con `NEW_FILES` de su undo.

## 10. Pendientes / riesgos

- **Orden con PRODUCT-NARRATION-001**: su commit `1f6041f` (rama `feat/product-narration-001`) también va sobre `e82c821` con
  `CACHE` v105 y toca `present-story.js`, `viewer.js` y `editor-scenarios.js`. La que entre segunda sube a v106, re-aplica sus
  cambios por 3-way y regenera su undo (encadenado encima del de la primera). Si entra antes la narración, aquí: `FluyoI18n.t` sobre
  las frases nuevas que añada al cromo (si las hay), ampliar `js/i18n-en.js`, `--write-baseline`.
- Integración con FLUYO-018.30: **resuelta** (ver §7). Si otra tarea entra antes del commit, regenerar
  `test/fluyo-i18n-001-undo.cjs` (script de la sesión: `git diff -U2` de los 7 archivos servidos contra HEAD) y subir `CACHE`.
- El árbol de trabajo de `main` tiene cambios ajenos a esta tarea en `.ai/tasks/` (018.29, 018.30, STEP-MESSAGE-001,
  SCENARIOS-SEMANTICS-001, STEP-REVERSE-003, 019.4 sin seguimiento): no forman parte de este commit.
- La heurística del trinquete tiene falsos positivos (teclas, fuentes, productos): no bloquean, solo cuentan.
- `?lang=` se pierde al pulsar «Abrir en Fluyo» desde el Viewer (la URL del editor se limpia); con la preferencia guardada no importa.

## Handoff

- **Qué se hizo**: auditoría y clasificación, arquitectura mínima implementada (`js/i18n.js`, `js/i18n-en.js`), vertical slice
  (cabecera del editor, Present, Viewer), tests y smoke en Chrome real. Sin commit, sin push, sin deploy.
- **Dónde**: sin commit en el checkout principal sobre `e82c821` (018.30). El worktree `fluyo-i18n-001` (rama `i18n-001`) fue la
  revisión previa y puede borrarse tras el commit.
- **Próximo paso concreto**: commit (con el visto bueno del PO) de los archivos de esta tarea únicamente; push/deploy aparte.
  D-LANG está decidida (A, decisión 260); D2–D9 siguen abiertas. Después: I18N-002 (resto del cromo del editor: `index.html`, `ui.js`,
  `selection.js`, `export.js`, `editor-share.js`, `interaction.js`, diálogos nativos), I18N-003 (Historias: `editor-scenarios.js` y
  su modal), I18N-004 (kernel por código + sincronía MCP, según D-LANG), I18N-005 (selector, `AUTO_DETECT`, páginas/SEO/ejemplos).
  En cada una: migrar, `node test/i18n-scan.cjs --write-baseline`, ampliar `js/i18n-en.js`, subir `CACHE`, regenerar el undo.
- **Decisiones duraderas**: 260 (D-LANG A) y 261 (arquitectura i18n) en `.ai/DECISIONS.md`; D2–D9 pendientes del PO.
