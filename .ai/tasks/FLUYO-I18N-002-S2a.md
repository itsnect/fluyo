# FLUYO-I18N-002 · S2a — Historias en el idioma de la interfaz, sin tocar el kernel

Estado: **COMMITTED** (2026-10-27; aprobado por el PO): commit local sobre `a0919e6`, **sin push ni deploy**. Quedan fuera del
commit `.ai/DECISIONS.md` (las decisiones 289–295 conviven sin commitear con las 277–288 de otras sesiones) y `FLUYO-I18N-002.md`.
Base: `main` = `origin/main` = `a0919e6` (S1, `CACHE` v110). S2a usa **`CACHE` v111**. S2b (kernel `story-playback.js` + MCP, v112)
**no se ha empezado**.
Plan, inventario y decisiones: `FLUYO-I18N-002.md`, sección «S2 · Historias» (D-S2-1…7, aprobadas por el PO el 2026-10-27; decisiones
**289–295**). Archivo aparte para no escribir a la vez que otras sesiones en el documento principal.

> Repo público: solo contenido técnico.

## Qué hace S2a

Con `?lang=en`, toda la superficie de Historias del editor sale en inglés. En español, todo es **idéntico** a `a0919e6`.

La superficie cubre:
- la hoja: cabecera, transporte y estado;
- la biblioteca de eventos;
- la línea de tiempo: momentos, esperas, llegadas, simultáneos y aviso de orden;
- la fila del paso;
- el menú del paso y sus submenús;
- el mensaje del paso;
- la colocación, con ratón y con dedo;
- el diálogo de evento entero;
- Detalles: registro, usos y condiciones iniciales;
- la ruta observada, en el editor y en la línea del Viewer;
- las tres confirmaciones de borrado: Historia, selección usada y página.

El contenido del autor nunca se traduce: nombres de Historia, de evento y de nodo, frases (`sentenceTemplate`), mensajes del paso,
mensajes del globo y símbolos.

- **Plantillas completas**: las ≈ 45 concatenaciones de la auditoría son ahora UNA plantilla con `{param}`:
  - sujeto + verbo: `{name} se cae`;
  - frases en trozos: una plantilla por variante conexión/elemento y ratón/dedo;
  - concordancia: una frase por sujeto (selección, elemento o conexión);
  - plurales `{one, other}`;
  - comillas dentro de la plantilla («{text}» en es, “{text}” en en);
  - tiempos `{n} s después`.
- **`FluyoI18n.list(items, within, esStyle)`** (`js/i18n.js`): conjunción con `Intl.ListFormat` del idioma de la PLANTILLA que la
  contiene: «A and B», 「A、B」, «A和B».
  - En español une como siempre ha unido cada lista: «a, b y c», y con `"repeat"`, «a y b y c», que es lo que decían las llegadas.
  - Intl diría «e» ante «i-» y cambiaría el texto de hoy.
- **Números** (D-S2-6): en español, exactamente como hoy («1.6 s», con punto); en los demás idiomas, con `FluyoI18n.num`.
- **Confirmaciones** (decisión 280): plantillas completas con plurales y listas; siguen siendo `confirm()` nativos.
- **Valores sembrados** (D-S2-3): la frase con la que nace un evento nuevo («{source} sends to {target}») y el sufijo de un evento
  duplicado («{name} (copy)») nacen en el idioma de la interfaz; guardados, son contenido. Los nombres de Historia («Historia N», la
  copia) son del kernel (`model.js`): S2b, decisión 283.
- **«Explain the system»** (decisión 279), en el nombre accesible de la barra de modos.
- **En vivo**: `editor-scenarios.js` se suscribe a `FluyoI18n.onChange`. Repinta la hoja, la barra de colocación y el diálogo abierto
  y cierra los menús, que se reabren ya traducidos. No toca el documento, Deshacer ni la reproducción. `ui.js` repinta el nombre del
  botón de la hoja.
- **Defecto corregido al migrar**: el registro de Detalles escapaba HTML dentro de `textContent`, así que una etiqueta `A & B` se veía
  `A &amp; B`. `escapeHtml` ya no se usa y se elimina.

## Archivos

Servidos (`CACHE` v110 → **v111**; sin archivos nuevos; `ASSETS` y `VIEWER_ASSETS` sin cambios):

| Archivo | Qué |
|---|---|
| `js/editor-scenarios.js` | 115 sustituciones: todo el texto por `FluyoI18n.t`; `scNum`; `SC_FLOW_WORDS` y `SC_FLOW_SUMMARY` con getters (idioma al pintar); `SC_DEFAULT_PHRASES` sembrado; `scArrivalNames` con `FluyoI18n.list`; `onChange`; sin `escapeHtml` |
| `js/selection.js` | `deleteConfirmMessage` y `pageDeleteConfirmMessage`: plantillas completas, plurales y `FluyoI18n.list` |
| `js/flow-semantics.js` | `ROUTE_WORDS` con getters sobre las MISMAS claves que el editor (`route.*`, común); la línea con matiz, en plantilla |
| `js/present-story.js` | la sonda de `presentHeaderBottom` mide «En pausa» en el idioma activo (`story.paused`) |
| `js/viewer.js` | «Elemento sin nombre» → `story.unnamed` (común) |
| `js/ui.js` | `syncStoryExpandLabel()`: «Ampliar/Reducir la hoja de Historias», también en vivo |
| `js/i18n.js` | `FluyoI18n.list` (y `lookup` interno compartido con `t`) |
| `index.html` | región de Historias: marcas `data-i18n*` (153 textos → 0 sin marca). Lo que pinta JS lleva `data-i18n-js`. Los botones con glifo llevan el mismo nodo que pinta `scGlyphText`, y `#scPaletteToggle` llega vacío, porque lo pinta JS al abrir la hoja; antes de eso, el panel no se ve |
| `js/i18n-en.js` | +6 claves comunes (`story.unnamed`, `route.available/unavailable/noPath/byDefault/withDefault`) |
| `js/i18n-en-editor.js` | +339 claves; `editor.tell` = «Explain the system» |
| `sw.js` | solo `CACHE` v111 |

**Kernel no modificado**: `story-playback.js`, `model.js`, `config.js`, `scenario-engine.js`, `scenario-playback.js`,
`document-integrity.js`, `story-authoring.js`, `safe-svg.js` y `story-clock.js` son idénticos a `a0919e6`. Lo comprueba el test A.
`fluyo-mcp` no se toca.

## Claves

- **345 claves nuevas**: 6 en el diccionario común y 339 en el del editor. En uso: 280 → **625** (836 usos).
- fr/ja/zh sin claves de S2a (D-S2-7): caen al **inglés**, nunca al español, y quedan en `missing()`.
- Pesos sin comprimir: `i18n-en.js` 3,6 KB y `i18n-en-editor.js` 30,0 KB, dentro del presupuesto de la decisión 272.
- Terminología (D-S2-4): en inglés, «step» es lo colocado en una Historia («2 steps added at the same time», «This moment (3
  steps)…») y «event», lo de la biblioteca. «Narration» no aparece en la interfaz: se dice «Step message…».

## Diff de strings

- **Español: ningún texto visible cambia.** Lo prueban el oráculo vm (test O, el código de `a0919e6` frente al de ahora sobre el
  mismo corpus) y Chrome (texto, atributos y píxeles de cada superficie, a 1440 y 390, frente a `a0919e6` servido aparte).
- Única excepción, buscada: con una etiqueta que contiene `& < >`, el registro de Detalles ya no muestra `&amp;`.
- Inglés: lista completa en `js/i18n-en-editor.js` (bloque «FLUYO-I18N-002 S2a · Historias») y en `js/i18n-en.js` (6 claves).

## Pruebas

- **Propias**:
  - `test/fluyo-i18n-002-s2a.test.cjs`: **13/13**, vm.
    - **O**: oráculo del español frente a `a0919e6`: fila, motivo, menú, mensaje, esperas y llegadas, tiempos, barra de colocación,
      ruta, borrar Historia y las confirmaciones en todas sus ramas.
    - **E**: inglés, sin español, con el contenido del autor intacto.
    - **P**: idioma de prueba CJK, en el que toda salida es plantilla entera más parámetros (ni un carácter pegado por el código),
      cada parámetro entra una sola vez y las listas salen con «、».
    - **S**: estático (sin pegar a `t()`, sin «y» de lista, campos del documento nunca como clave) y trinquete.
    - **H**: HTML con 0 textos sin marca; `data-i18n-js`.
    - **D**: común/editor; «Explain the system»; fr cae al inglés.
    - **V**: en vivo.
    - **A**: alcance frente a `a0919e6`, con `undoS2a` exacto y el kernel intacto.
  - `test/fluyo-i18n-002-s2a-undo.cjs`: `undoS2a`, generado del diff `-U2`, debajo de `undoS1`.
  - `test/fluyo-i18n-002-s2a-mutations.cjs`: ver «Mutaciones».
  - `test/fluyo-i18n-002-s2a-browser.cjs` (Chrome): ver «Chrome real».
- **Suite completa** (`node --test test/*.test.cjs`, con `fluyo-mcp` al lado), en un clon desechable con S2a commiteado sobre
  `a0919e6`:
  - **1 714 tests, los mismos 83 fallos que la base por nombre, 0 nuevos**; la base mide 1 701 tests y 83 fallos;
  - en el árbol de trabajo sin commit aparecen además las guardas transitorias «idénticos a HEAD» (018-19, 018-25, 018-29, 019-1,
    019-2), como en cada slice.
- **Trinquete** (`fluyo-i18n-001-baseline.json`, reescrito):

  | Archivo | Antes | Ahora | Qué queda |
  |---|---:|---:|---|
  | `editor-scenarios.js` | 237 | **9** | solo «Enter», «Escape» (nombres de tecla) y «Options» (sufijo de una clave de datos) |
  | `selection.js` | 22 | **0** | |
  | `flow-semantics.js` | 3 | **0** | |
  | `present-story.js` | 1 | **0** | |
  | `ui.js` | 72 | **70** | |
  | `viewer.js` | 5 | **4** | |
  | `index.html` | 372 | **219** | |

  `story-playback.js` queda en 23 (S2b).
- **Tests anteriores ajustados**, sin cambiar lo que prueban:
  - `CACHE` v111 en 78 tests;
  - contextos vm que ejecutan código de Historias cargan el idioma (`test/i18n-vm.cjs`, o `js/i18n.js` en el arnés de 011 que reusa
    012.1);
  - comparaciones de literales de marcado y código antiguas, sobre el texto sin S2a (`undoS2a`);
  - las guardas de alcance de S0, S1 y SHELL descuentan lo de S2a (`shellOnly`, `s1Only`, `s2aOnly`);
  - `escapeHtml` sale de una lista de funciones extraídas (step-reverse-002) y `scNum` entra.

### Mutaciones

`node test/fluyo-i18n-002-s2a-mutations.cjs` (copias aisladas; el test A se excluye): **resultado en «Verificación»**.

Las 14 mutaciones:
- volver a pegar «{name} ocurre»;
- cambiar dos parámetros de sitio;
- quitar una clave del inglés;
- pasar el nombre del autor por `t()`;
- unir las llegadas a mano;
- unir la lista de la página a mano;
- cambiar un texto español;
- Intl en el español;
- volver a escapar el registro;
- quitar el repintado en vivo;
- quitar la marca de Reproducir;
- la sonda de Present en español;
- perder el plural de una confirmación;
- frase sembrada fija.

### Chrome real (`test/fluyo-i18n-002-s2a-browser.cjs`, con `FLUYO_BASE_ROOT` = árbol de `a0919e6`): **223 ✔ · 0 ✘**

- **Español idéntico a `a0919e6`**, a 1440 y 390.
  - Superficies: hoja, menú de la Historia, elegir Historia, menú del paso y dos submenús, mensaje del paso, espera, diálogo de evento
    (conexión y elemento, plegables abiertos), edición de evento, barra de colocación (colocar y «al mismo tiempo»), condiciones,
    registro, reproducción en pausa (`#scNow`, transporte, estado), ruta observada y las tres confirmaciones nativas.
  - En todas: mismo texto y atributos, y la hoja píxel a píxel.
- **Inglés**, a 1440 y 390:
  - las mismas superficies, sin texto de interfaz en español;
  - el contenido del autor intacto: «Compra con éxito», “El cliente pulsa «Pagar» (49 €)”, «At the start», «1.6 s later»,
    «Waits for the arrival of “…”», «Petición: choose a connection in the system.», «Delete the story “Compra con éxito”? It has 7
    moments.»;
  - sin desbordes ni recortes.
- **Pseudo-idioma** (+40 %): ningún texto de Historias fuera de `FluyoI18n` salvo contenido del autor. Con +40 % a 390, dos
  resúmenes de plegable del diálogo exceden 3–22 px (informativo, como «Más» en S1; en inglés, nada).
- **En vivo** es → en → es con la hoja abierta: documento, Deshacer e Historia activa intactos; «Expand the stories sheet», «Explain
  the system».
- **Present** en inglés: transporte en inglés y el título del momento = la frase del autor.
- **Share**: «Compartir historia» → **Viewer** en inglés: «Play story», «Story · Compra con éxito» y el momento con la frase del autor.
- **Offline**: SW v111; sin red, el editor abre en inglés con la hoja de Historias en inglés.
- **Regresiones en Chrome**: `fluyo-i18n-002-s1-browser` **181/0**. El resto, en «Verificación».

## Trade-offs y pendientes

1. **El texto de la reproducción que compone el kernel sigue en español** hasta S2b: «X no está disponible», «X vuelve a estar
   disponible», «No se completó · X…», «Reproducción terminada», «N eventos no pudieron realizarse» y los 15 errores por código.
   - En inglés, Present y el Viewer dicen «Paused · Banco no está disponible», y la sonda de Present mide esa frase.
   - Es `story-playback.js` (kernel del MCP): S2b, con proveedor de texto opcional (D-S2-1).
2. **Nombres sembrados de Historia** («Historia N», « copia»): S2b (decisión 283). Hasta entonces, en inglés, «+ New story» crea
   «Historia 2».
3. **«1 lugares»**: el español decía (y dice) «Este evento se usa en 1 lugares» porque el plural no se calculaba. Se conserva en
   español (requisito de idéntico) y el inglés lo evita con «Places where this event is used: {count}.». Arreglarlo en español es
   un cambio visible aparte.
4. **Decimales del español** (D-S2-6): «1.6 s» con punto frente a «entre 0,3 y 10» con coma, como hoy.
5. **`#scPaletteToggle` llega vacío en el HTML**: lo pinta JS al abrir la hoja, y el «Eventos · 0» del HTML no se veía nunca, porque
   el panel está oculto hasta entonces. Así su `data-i18n-js` no tiene un texto base distinto del de su clave.
6. **fr/ja/zh**: sin claves de S2a (D-S2-7). Japonés y chino quedan demostrados con el idioma de prueba del test P; las traducciones,
   en S5 con revisión nativa. Pendientes de glosario: Momento (ja/zh) y Frase (ja).
7. **Deuda de test T1–T4** de S1: no se tocó en S2a (sus smokes solo cambiaron la cadena de `CACHE`).

## Verificación (2026-10-27, sin commit)

- `test/fluyo-i18n-002-s2a.test.cjs`: **13/13**, en el árbol y en el clon commiteado.
- Propios de I18N: `fluyo-i18n-001` 20/20, `-s0` 20/20, `-s1` 10/10.
- **Mutaciones: 14/14 detectadas.**
  - En la primera pasada sobrevivieron M1 (pegar nombre + verbo con un espacio) y M7 (cambiar «Al comenzar» en un solo sitio).
  - El test P ahora prohíbe dos textos de la interfaz unidos por un espacio, y el test D, una clave con dos textos base. El corpus
    cubre la pista «Al comenzar».
  - Con eso, las dos se detectan.
- **Suite completa**, en un clon desechable con S2a commiteado:
  - **1 714 tests, 83 fallos = los mismos 83 de la base por nombre, 0 nuevos**;
  - la base `a0919e6` mide 1 701 tests y 83 fallos.
- **Chrome real**:
  - `fluyo-i18n-002-s2a-browser` **223/0**;
  - regresiones: `fluyo-i18n-002-s1-browser` **181/0**, `fluyo-i18n-002-s0-browser` **385/0**, `fluyo-i18n-001-browser` **78/0**,
    `fluyo-product-narration-001-browser` **100/100**.

## Handoff

- Próximo paso: el PO revisa S2a y decide el commit (solo los archivos de «Archivos» más los tests de S2a y los ajustados; los
  `.ai/tasks/*` de otras sesiones quedan fuera).
- Después: **S2b** (v112): proveedor de texto opcional en `story-playback.js`, formateador K1 de nombres de Historia (decisión 283),
  resincronización de `fluyo-mcp`, contrato del MCP byte a byte igual.
