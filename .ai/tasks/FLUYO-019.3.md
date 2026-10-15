# FLUYO-019.3 — MCP: la piel «construido» (settings.skin) en `export_diagram`

Estado: **READY FOR COMMIT** (15-10-2026; GO del owner a C1). Fluyo: `js/skin.js` (una sola regla de color), `CACHE` v87, tests. fluyo-mcp: `settings.skin` (kernel, schema, `create_diagram`) y la piel en `export_diagram` (`src/skin.ts`, `svg.ts`). Sin commit, push ni deploy.
Base: fluyo con FLUYO-019.2 (`settings.skin`, golden compartido); fluyo-mcp `b4323e6` (018.28).
Owner/agente actual: libre.

> Repo público: solo contenido técnico del proyecto open source.
> Leer: `AGENTS.md`, esta tarea, `.ai/tasks/FLUYO-019.2.md` (D1 y D4), `.ai/ARCHITECTURE.md` §«Piel «construido» (2.5D)» y §«Conexiones (FLUYO-018.16)» (cómo se hace la paridad hoy). Código de fluyo: `js/skin.js` entero (160 líneas, puro) y `skinLayersToSVG`/`renderNodeToSVG`/`renderConnectorToSVG`/`buildSVGDocument` en `js/export.js`. Código del MCP: `scripts/sync-kernel.ts`, `src/model.ts` (`FluyoSettingsSchema`), `src/diagram.ts` (`SETTING_KEYS`), `src/svg.ts` (§cilindro, `edgeStroke`, `pageToSVG`), `src/server.ts` (`export_diagram`), `test/visual-regression.test.ts` y `test/fluyo-018-16.test.ts` (patrón del golden compartido).

## Objetivo

Que `export_diagram` produzca, para un documento con `settings.skin:"built"`, **el mismo SVG de la piel** que «Exportar → SVG» de la app (decisión 170: paridad editor = SVG = MCP), y que el kernel del MCP conozca la clave (normalización de lista cerrada de 019.2). Decidido en 019.2 (D4): **port a TypeScript en `svg.ts`**, no ejecución de `skin.js` desde el `vm`; el golden de fluyo es el contrato.

## Por qué

Desde 019.2 un documento puede llevar `settings.skin:"built"`: el editor lo exporta construido, el Viewer lo pinta construido y el share lo transporta. El MCP, hasta esta tarea, acepta la clave (`FluyoSettingsSchema` es `passthrough`) pero la ignora y exporta plano: es la brecha temporal aceptada en 019.2. Esta tarea la cierra con el mismo mecanismo que `cylinderSegments` (018.14a) y `edgeStroke` (018.16/018.27): port manual + test de paridad que ejecuta el JS real de fluyo en `vm`.

## Contrato (lo que fluyo ya entrega y el MCP debe cumplir)

1. **Kernel.** `npm run sync:kernel` → `KERNEL_ID` nuevo (`model.js` con `SKIN_VALUES`, `projectSkin` y la normalización en `settingsFromProjectData`). `check:kernel` en verde. Comportamiento resultante del kernel (ya definido en fluyo, nada que decidir): `skin:"built"` se conserva; ausente, `"flat"`, otro string u otro tipo → **sin clave**. `create_diagram` y `author_document` heredan esto por construcción (normalizan con el kernel).
2. **Schema.** `FluyoSettingsSchema` (`src/model.ts`): `skin: z.enum(["flat","built"]).optional()` con descripción («aspecto en Present, exportación y Viewer; ausente = plano; el editor pinta plano»). Sigue `passthrough`, así que no cambia lo que se acepta, solo lo que se documenta. **Corregido en la fase 1 (decisión 206):** un `z.enum` estricto rechazaría valores que hoy se aceptan; se usa `z.enum([...]).optional().catch(undefined)` (documenta, no rechaza). `create_diagram` (`src/diagram.ts`): `skin` entra en `SETTING_KEYS` y en `CreateDiagramInput`; sin operación nueva en `author_document` (los ajustes no tienen operación, como hasta ahora). `describe_document` no lista propiedades visuales: sin cambios.
3. **Port.** `src/skin.ts` (o una sección de `svg.ts`, como el cilindro) con las mismas funciones y nombres que `js/skin.js`: `skinActive(skin, zoom)`, `skinTones(color, theme, bg)`, `skinNode(n, theme, bg)`, `skinExtent(n)`, `skinPaintOrder(nodes)`, `skinEdgeLanding(pts, toSide)`, `skinEdgePort(p, lineColor, bg)`, `skinLabelFont(n, globalFont)`; constantes `SKIN_DEPTH=8`, `SKIN_MIN_PX=3`, `SKIN_FRONT_R=2`, `SKIN_LED_R=2.4`, `SKIN_LED_IN=10`, `SKIN_PORT_R=3`, `SKIN_PLINTH_H=7`, `SKIN_PLINTH_PAD=8`, `SKIN_TONES`, `SKIN_FLAT_SHAPES`. Un color no hex usa el mismo respaldo que `colHex` (fluyo `render.js`) → `DEFAULT_NODE_COLOR`. **Corregido (decisión 205):** el respaldo canónico es `PALETTE[0]`, y la regla completa es `skinColor` (fase 2).
4. **`pageToSVG(page, theme, {skin})`** (`svg.ts`) y `export_diagram` (`server.ts`) leen `project.settings.skin` y pasan `skin: projectSkin(settings)`; con `"built"`: (a) nodos en el orden de `skinPaintOrder`; (b) por nodo con piel, las capas como `<path d=… fill=… [stroke=… stroke-width=…] [stroke-dasharray=…] stroke-linejoin="round" [clip-path="url(#skin-clip-{id}-{k})"]/>` precedidas, cuando la capa lo pide, de `<clipPath id="skin-clip-{id}-{k}"><path d=…/></clipPath>` (exactamente `skinLayersToSVG` de `export.js`, mismo orden de atributos); el glifo del icono y el rótulo como siempre, con la voz de `skinLabelFont` cuando aplica; (c) por conexión, `pts = skinEdgeLanding(edgePoints(e), inferSide(B, último))` antes de `edgeStroke`, y el anillo de salida `<path d=… fill="{bg}" stroke="{lineColor}" stroke-width="1.5"/>` cuando no hay `startArrow`; (d) `skinActive(skin, 1)` decide (en SVG la escala es 1: la piel siempre se pinta si es `"built"`). Sin la clave, el SVG de hoy byte a byte.
5. **Tests.**
   - Copiar a `fluyo-mcp/test/fixtures`: `fluyo-019-1-skin.json` (golden de capas por pieza y tema), `fluyo-019-2-skin.fluyo.json` (documento con `skin:"built"`, crema: rect, rect dashed, cylinder, icon, hex, text; conexiones n/e/s/w, par y hermanas) y `fluyo-019-2-skin-svg.json` (las líneas de la piel del SVG del editor real, extraídas con `skinSvgLines`, cuya definición está en `fluyo/test/fluyo-019-2.test.cjs`). Añadirlos a `scripts/sync-fixtures.ts` si procede. `fluyo/test/fluyo-019-2.test.cjs` ya compara los tres archivos con los del MCP cuando los repos están al lado: deben ser byte a byte iguales.
   - `test/fluyo-019-3.test.ts`: el port, **capa a capa**, igual al golden 019.1 (`skinNode`/`skinExtent`/`skinEdgeLanding` por pieza y tema, con `THEMES[t].bg` y con `customBg`); `export_diagram` sobre el fixture 019.2 → `skinSvgLines(svg)` deepEqual al golden 019.2 (igual que `fluyo-018-16.test.ts` con las conexiones); el mismo fixture sin la clave → sin `skin-clip-` y sin cambios respecto a hoy; `create_diagram` con `skin:"built"` → el proyecto lleva la clave; con `skin:"flat"` → sin clave; `describe_document` sin cambios.
   - `test/visual-regression.test.ts`: paridad **ejecutando el `js/skin.js` real** en `vm` (como se hace con `geometry.js`) sobre los 8 ejemplos + las 3 fixtures de regresión, con `settings.skin:"built"` forzado: `skinNode` por nodo y tema, `skinEdgeLanding` por conexión, `skinPaintOrder` por página, vértice a vértice.
   - Mutaciones: `scripts/mutate-019-3.ts` (profundidad distinta, tonos invertidos, orden de capas, clip ausente, aterrizaje en s/w, port sin `skipWaiting`… las que hagan fallar la paridad).
6. **Compatibilidad.** Un documento sin la clave exporta igual que hoy (byte a byte). Un documento con `skin:"flat"` entra sin clave tras el kernel. Ningún campo nuevo fuera de `settings.skin`. `describe_document`, `propose_layout`, `run_story` y el resto de tools no cambian.

## Fuera

Bus, contenedor, exploded, isométrica, LED ligado al estado; PNG/GIF; Authoring 2.5D en el editor (posible FLUYO-019.4). Cambios en `skin.js` de fluyo, salvo el que el owner aprobó dentro de esta tarea (C1: la regla de color, para que el port pueda ser idéntico y total); el port nunca se «adapta».

## Handoff (al final del documento)

Ver «Handoff» al final (fase 2).

## Fase 1: conflictos de contrato resueltos antes del port (15-10-2026)

Estado: **RESUELTA.** El owner dio GO a C1 con estas reglas: `#rgb` y `#rrggbb` tal cual; `#rrggbbaa` compuesto sobre el fondo de la piel, respetando `customBg`; cualquier otro formato, `PALETTE[0]`; una sola función para todos los usos de color de la piel. C2 y C3 se mantienen tal como se describen. El análisis se conserva como registro.
Base: fluyo `1ee65ee` (019.2 commiteada), fluyo-mcp `b4323e6`.

### C1. Color de la piel: qué llega a `skin.js` y qué debe hacer

**Qué formatos acepta hoy el modelo** (según el código, no la documentación):
- **Carga** (`normalizeProjectItem` + `normalizeProjectNode`, `model.js`, kernel): `color`, `fill`, `textBg` y `textColor` deben ser `string` o `null`; otro tipo da `invalid_document`. **El contenido no se valida.** `color:null` pasa a `PALETTE[0].c`, el respaldo histórico que «debe seguir viéndose igual en editor, Viewer, SVG y MCP». Por tanto a `skin.js` puede llegar **cualquier string**.
- **Autoría** (`FluyoAuthoring`, `story-authoring.js`, kernel; lo usan `create_node`/`update_node` del MCP y `create_diagram`): `HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`. **`#rgb`, `#rrggbb` y `#rrggbbaa` son colores válidos del dominio**, y también lo son para `customBg`. Comprobado: `create_diagram` del MCP con `skin:"built"` y `color:"#6a9fb5cc"` devuelve un documento válido. `#12345` se rechaza.
- **UI del editor**: solo escribe `#rrggbb` (`<input type="color">` y muestras).
- **Corpus y goldens**: los 8 ejemplos, los fixtures de fluyo, los 3 de regresión visual del MCP y los dos goldens de la piel usan solo `#rrggbb` (verificado archivo a archivo).

**Qué hace hoy `skinTones`.** El código es `col = skinHexRGB(color)? color : (typeof colHex==="function"? colHex(color) : DEFAULT_NODE_COLOR)`, y `skinHexRGB` solo acepta 3 o 6 dígitos. `colHex` (`render.js`) deja pasar cualquier string que empiece por `#`.

| color | sin `render.js` (vm de los tests) | con `render.js` (Present, Viewer, exportación) |
|---|---|---|
| `#rrggbb`, `#rgb` | el color | el color |
| `"red"` y otras cadenas históricas sin `#` | `DEFAULT_NODE_COLOR` (`#857F6C`) | `PALETTE[0].c` (`#6a9fb5`) |
| `#rrggbbaa` (válido) | `DEFAULT_NODE_COLOR` | **lanza** `Cannot read properties of null` |
| `#12345` (mal formado, solo por un archivo editado a mano) | `DEFAULT_NODE_COLOR` | **lanza** |

Reproducido en **Chrome real** con el editor de `1ee65ee`, un documento con `skin:"built"` y un nodo `#6a9fb5cc`:
- `buildSVGDocument(1,"built")` lanza.
- Present lanza en **cada fotograma** (43 errores en 0,6 s).
- El **Viewer abre el share en fase `error`**: el enlace no se puede ver.

En plano no falla nada. Con `#rrggbb`, `#abc` y `"red"` hay cero errores. Es un **fallo vivo de 019.1/019.2** que el MCP puede provocar con un documento válido.

**Diagnóstico.**
1. El respaldo deliberado de Fluyo para un color no utilizable es `PALETTE[0].c`, como dicen los comentarios de `normalizeProjectNode` y de `colHex`. `DEFAULT_NODE_COLOR` es solo el color de los nodos **nuevos** (018.15: «cambiar ese respaldo repintaría documentos existentes»). El punto 3 de este contrato estaba mal redactado: tomó la rama de `vm`.
2. Por la rama `typeof colHex`, el resultado depende de qué scripts estén cargados, así que no es determinista entre contextos.
3. `#rrggbbaa` es válido en el dominio y la piel no lo soporta.

**Cambio propuesto en `js/skin.js`** (pendiente de OK; unas 12 líneas, sin tocar nada más del archivo):
- Un lector único `skinColor(c, base)`, que usa `skinTones` para `color`. Devuelve:
  - `#rgb` o `#rrggbb`: **el mismo string**, para que los goldens no cambien ni un byte.
  - `#rrggbbaa`: el color **opaco que se ve sobre el fondo del lienzo**. Por canal, `round(rgb·α + base·(1−α))`, con `α = aa/255` y `base` el fondo que `skinTones` ya ha resuelto. El resultado es un `#rrggbb` en minúsculas. Es la composición *source-over* estándar, la misma que hace el lienzo plano al trazar con ese color.
  - Cualquier otra cosa: `PALETTE[0].c`, siempre, sin depender de `colHex` ni de `render.js`.
- `fill` sigue la misma regla:
  - `"none"`: el fondo (igual que hoy).
  - `#rgb` o `#rrggbb`: tal cual (igual que hoy).
  - `#rrggbbaa`: compuesto sobre el fondo. Hoy se ignora en silencio y cae en el tono de cara.
  - Cualquier otro valor: el tono de cara (igual que hoy).
- `customBg` no cambia: `#rgb` o `#rrggbb` se usan; cualquier otra cosa, incluido `#rrggbbaa`, pasa al fondo del tema. Queda documentado como regla explícita: la piel trabaja sobre un fondo opaco.
- Alternativa más simple, no recomendada: en `#rrggbbaa`, descartar `aa`. Es total, pero ignora una transparencia que el resto del lienzo sí pinta.

**Por qué pertenece a 019.3.** 019.3 exige dos cosas: que el port sea **idéntico** a `skin.js` y que `export_diagram` no lance con un documento válido del MCP. Con `skin.js` como está, no se pueden cumplir a la vez: un port idéntico lanzaría en `export_diagram`, y uno que no lance divergiría de Fluyo. Hay que fijar primero una semántica total en Fluyo y portarla después. Si el owner prefiere separarlo, sería un 019.2.1 de fluyo que bloquea a 019.3.

**Coste en fluyo si hay OK:**
- `js/skin.js`.
- `CACHE` de v86 a v87, con sus aserciones.
- Tests nuevos en `vm`: batería de colores (total, determinista con y sin `render.js`, valores exactos de la composición).
- Tests nuevos en Chrome real: Present, Viewer y exportación sin errores con `#rrggbbaa`.
- `fluyo-019-1-skin.json` y `fluyo-019-2-skin-svg.json` **sin cambios** (solo `#rrggbb`). Los tests de golden existentes deben seguir pasando sin regenerarlos.
- Corregir el punto 3 del contrato (`PALETTE[0]`, no `DEFAULT_NODE_COLOR`) y añadir una decisión en `DECISIONS.md`.

### C2. Normalización de `skin` en el MCP (hecho)

- `npm run sync:kernel` **solo cambia `model.js`**. La diferencia con la copia anterior es exactamente `SKIN_VALUES`, `projectSkin` y las tres líneas de `settingsFromProjectData` de 019.2. `KERNEL_ID` pasa de `1e8e1b47…` a `6a3529a5…`. `check:config` en verde.
- La regla final es la del kernel: `"built"` se conserva; ausente, `"flat"` o cualquier otro valor o tipo da plano y **sin clave**. Es idempotente. En el MCP, todas las tools que normalizan con el kernel ya aplican esa regla: `author_document`, `set_theme`, `reorder_nodes`, `duplicate_node`, `propose_layout`, `create_diagram` y las revisiones. Un documento con `skin:"flat"` sale sin clave y con **la misma revisión** que sin ella.
- `src/model.ts` añade tres piezas:
  - `SKIN_VALUES`.
  - `projectSkin`, la misma lectura que la del kernel, comparada valor a valor en el test.
  - `SkinSchema = z.enum(["flat","built"]).optional().catch(undefined)`, que usan `FluyoSettingsSchema` (documento) y `CreateDiagramInputShape`.
- `tools/list` publica `enum: ["flat","built"]`, pero **la validación no rechaza**: un valor fuera de lista se lee como ausente, igual que lo abre el editor.
- `export_diagram` acepta `skin:"BUILT"`, `1`, `null`, `{}` y `""`, y exporta el mismo SVG byte a byte que sin la clave. Hasta el port, también `"built"` sale plano, sin error.
- `describe_document`: sin cambios.

### C3. `create_diagram` con `skin` (hecho)

- `skin` entra en `SETTING_KEYS` y en `CreateDiagramInput`. La comprobación «el kernel no me cambió el ajuste» compara `skin` por su lectura canónica (`projectSkin`) y el resto de ajustes valor a valor, como antes.
- `skin:"flat"`: aceptado, **sin clave**, con el mismo documento y la misma revisión que sin pedirlo.
- `skin:"built"`: `settings.skin:"built"`; el resto de `settings` y todo `doc` quedan idénticos.
- `skin:"BUILT"` o `7`, por el protocolo o llamando directamente a `createDiagram`: aceptado como plano, sin rechazo nuevo.

## Fase 2: implementación (15-10-2026, tras el GO del owner a C1)

### Qué se hizo

1. **Fluyo, `js/skin.js`: una sola regla de color (C1, decisión 205).** `skinColor(c, base)` es el único lector de los colores que la piel interpreta: el color del nodo en `skinTones` (tonos y LED) y el relleno en los dos frentes (rect/bloque y cilindro).
   - `#rgb` y `#rrggbb` devuelven el mismo string, sin tocar.
   - `#rrggbbaa` devuelve el color opaco compuesto sobre el fondo de la piel: `skinMix(base, "#rrggbb", aa/255)`, la misma mezcla redondeada que ya usaban los tonos. El fondo es `customBg` si es `#rgb`/`#rrggbb`; si no, el del tema.
   - Cualquier otro valor da `null`. En ese caso el color cae en `PALETTE[0].c` y el relleno en el tono de cara (como antes).

   La rama `typeof colHex` desaparece: el resultado ya no depende de que `render.js` esté cargado. El anillo de salida no interpreta colores (lleva el color de la línea y el fondo tal como los pinta el lienzo); queda dicho en un comentario. `CACHE` v86 → **v87** (44 archivos de `test/` con la aserción de `CACHE`). El smoke del service worker de `fluyo-019-2-browser.cjs` pasa a ser «HEAD (v86) → árbol (v87)».
2. **MCP, kernel y schema** (fase 1, C2 y C3; sin cambios desde entonces).
3. **MCP, port** (`fluyo-mcp`):
   - **`src/skin.ts`**: port literal de `js/skin.js`, función a función y con los mismos nombres, constantes y orden de operaciones. Incluye `skinColor` y el respaldo `PALETTE[0]`.
   - **`src/svg.ts`**:
     - `cylinderGeom` (port de `geometry.js`) e `inferSide` exportados.
     - `skinLayersToSVG`, port exacto de `export.js`, con el mismo orden de atributos y los mismos `skin-clip-{id}-{k}`.
     - `renderNodeToSVG(…, skinBg)`: capas, glifo del icono y rótulo con la voz de `skinLabelFont`.
     - `renderConnectorToSVG(…, skinBg)`: aterrizaje con `skinEdgeLanding(edgePoints, inferSide(B, último))` antes de `edgeStroke`, y anillo si no hay `startArrow`.
     - `svgLabelLines(…, fo)`.
     - `pageToSVG` admite `{skin, customBg}`, decide con `skinActive(skin, 1)` y ordena los nodos con `skinPaintOrder`.
   - **`src/server.ts`**: `export_diagram` pasa `skin: projectSkin(project.settings)` y `customBg: project.doc.customBg`, y su descripción lo dice.
   - **README**: un párrafo «Aspecto construido (2.5D)».
   - **`test/fixtures/README.md`**: tabla de fixtures compartidos.

### Decisiones finales

- **D1 (C1, decisión 205).** La regla de color de arriba es canónica en Fluyo, y el MCP la replica literalmente. El punto 3 del contrato («`DEFAULT_NODE_COLOR`») queda **corregido a `PALETTE[0]`**, que es el respaldo histórico deliberado (`normalizeProjectNode`, `colHex`). Con `customBg:"#rrggbbaa"` la piel sigue usando el fondo del tema: trabaja sobre un fondo opaco, como antes.
- **D2 (C2, decisión 206).** El schema documenta `flat|built` y **no rechaza**: `z.enum(...).optional().catch(undefined)`. La normalización canónica es la del kernel. El punto 2 del contrato («`z.enum` estricto») queda corregido así.
- **D3 (C3, decisión 206).** `create_diagram` compara `skin` por su lectura canónica: `"flat"` es lo mismo que no pedirlo, y un valor fuera de lista se lee como plano, sin un rechazo nuevo.
- **D4.** El port vive en `src/skin.ts` (el contrato permitía «o una sección de `svg.ts`»). Importa `cylinderGeom`/`cylinderSegments` de `svg.ts`, y `svg.ts` importa la piel. El ciclo es solo de funciones declaradas: seguro en ESM.
- **D5.** El fondo de la piel llega a `pageToSVG` por una opción interna, `customBg`, no por la API de la tool: `export_diagram` lo toma del documento. Sin parámetros nuevos en ninguna tool.
- **D6.** Medición de rótulos: la voz Plex Mono cambia `font-family`/`font-weight` en el SVG del MCP, pero no el tamaño, porque el MCP mide con `approxTextWidth`, sin familia. Es la divergencia de medidor ya documentada. Posiciones y tamaños son los del plano del MCP (comprobado: los `<text>` y las cajas de etiqueta son idénticos entre plano y construido salvo la voz).
- **D7.** `loadFixtures()` (helpers del MCP) y `loadDocs` de `visual-regression.test.ts` excluyen los `fluyo-0xx-*.fluyo.json`. El fixture compartido de 019.2 tiene que vivir en la raíz de `test/fixtures`, porque fluyo lo compara por esa ruta, pero no es un ejemplo publicado. Sin esto, los conteos de «8 ejemplos» habrían cambiado.
- **D8.** Dos ajustes de tests de fluyo, explicados para que no parezcan maquillaje:
  - `fluyo-018-15.test.cjs` vigila que `PALETTE[0]` solo aparezca como respaldo histórico en una lista blanca de archivos. Se añade `skin.js: 1`, que es exactamente ese uso (D1).
  - En `fluyo-019-2-browser.cjs`, el «Viewer anterior (sin `skin.js`)» usaba HEAD. Desde que 019.2 está commiteada, HEAD ya carga `skin.js`, y la comprobación **fallaba también sobre un árbol limpio de HEAD** (reproducido). Ahora usa la revisión fija `2000360` (019.1, v85).

### Paridad Fluyo ↔ MCP (estructural y geométrica, no solo capturas)

| Comprobación | Dónde | Resultado |
|---|---|---|
| Golden 019.1: capas por pieza (rect, rect dashed+fill, fill none, cylinder, icon, hex, text, forma desconocida) × dark/crema/claro + fondo propio; `skinExtent`; `skinEdgeLanding` (12 rutas×lados) | `fluyo-019-3.test.ts` | idéntico |
| Golden de color 019.3: 140 `skinColor`, 104 `skinTones`, 45 `skinNode` (`#rgb`, `#rrggbb`, `#rrggbbaa`, ilegibles; 3 piezas; crema, oscuro y fondo propio) | `fluyo-019-3.test.ts` | idéntico |
| Golden SVG 019.2: las 64 líneas de piel (`skinSvgLines`) del `buildSVGDocument(1,"built")` del editor real = `export_diagram` | `fluyo-019-3.test.ts` | idéntico byte a byte |
| `skin.js` real en `vm` contra el port: `skinNode` en 1500 combinaciones nodo × tema × fondo (8 ejemplos + 3 regresiones + fixture 019.2), `skinExtent`, `skinLabelFont`, `cylinderGeom`, `skinPaintOrder` por página, `inferSide` + `skinEdgeLanding` en n/e/s/w + `edgeStroke` sobre la ruta posada + anillo, en cada conexión; 1509 colores × 3 temas × 5 fondos; `skinActive`; constantes | `visual-regression.test.ts` | idéntico |
| Chrome real: corpus completo (8 ejemplos, 3 regresiones, fixture 019.2, `fluyo-017-1-qa-complejo`), 56 páginas × {dark, crema, claro, crema + `#123456`}: `skinSvgLines` del editor real = las del MCP (2280 líneas), mismo orden de `<g id="node-N">`, y los dos SVG rasterizados en Chrome **sin texto**: 0 píxeles distintos. Control negativo (un documento exportado plano a propósito): 5272 px y 4 diferencias detectadas | sonda en el scratchpad (`chrome-parity.cjs`) | 0 diferencias |
| Present, Viewer (vista normal y Present) y exportación SVG/raster de Fluyo con `#rrggbbaa`, en crema, oscuro, fondo propio `#123456` y `#ffffff80`: tonos medidos en píxeles contra la regla escrita, calculada en Node, no con `skin.js` | `fluyo-019-3-browser.cjs` | 62/62 |
| Rótulos y rutas: con la piel, los `<text>` y las cajas de etiqueta son los mismos que en plano (solo cambia la voz); `edgePoints` no cambia y el aterrizaje solo mueve el último tramo ≤ d/2; las formas sin piel (hex, text) dan el mismo `<g>` | `fluyo-019-3.test.ts` | idéntico |

Etiquetas: no aparece ningún solape nuevo. En `ingesta-v2` el trazo discontinuo toca «API Gateway» y «check cache» **también en plano** (defecto aceptado en el baseline de `visual-regression.test.ts`), igual en Fluyo y en el MCP. Hay capturas lado a lado en el scratchpad de la sesión (`shots-019-3/`): editor frente a MCP para el fixture 019.2 (crema y oscuro, con `#rrggbbaa`), `ingesta-v2`, `rag-chatbot` y `kafka-event-pipeline`, y construido frente a plano para los tres primeros.

### Fixtures afectados

- **Nuevos en fluyo**: `test/fixtures/fluyo-019-3-colores.json`, el golden de la regla de color (generado por `fluyo-019-3.test.cjs` con `FLUYO_UPDATE_GOLDEN=1`).
- **Copiados al MCP, byte a byte**: `fluyo-019-1-skin.json`, `fluyo-019-2-skin.fluyo.json`, `fluyo-019-2-skin-svg.json` y `fluyo-019-3-colores.json`. `fluyo-019-2.test.cjs` y `fluyo-019-3.test.cjs` los comparan desde fluyo, y `fluyo-019-3.test.ts` desde el MCP.
- **Sin cambios**: `fluyo-019-1-skin.json`, `fluyo-019-2-skin.fluyo.json` y `fluyo-019-2-skin-svg.json` (el corpus y los goldens solo usan `#rrggbb`, verificado archivo a archivo). También los goldens de 018.x.

### Archivos modificados

- **fluyo**:
  - `js/skin.js`.
  - `sw.js` (v87).
  - `test/fluyo-019-3.test.cjs`, `test/fluyo-019-3-browser.cjs`, `test/fluyo-019-3-mutations.cjs` y `test/fixtures/fluyo-019-3-colores.json` (nuevos).
  - `test/fluyo-018-15.test.cjs` (lista blanca, D8) y `test/fluyo-019-2-browser.cjs` (Viewer anterior fijo y smoke v86 → v87, D8).
  - La aserción de `CACHE` en 44 archivos de `test/`.
  - `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (205 y 206) y esta tarea.
- **fluyo-mcp**:
  - `src/skin.ts` (nuevo), `src/svg.ts`, `src/server.ts`, `src/model.ts`, `src/diagram.ts` y `src/generated/kernel-sources.ts` (resincronizado).
  - `test/fluyo-019-3.test.ts` (nuevo), `test/visual-regression.test.ts`, `test/helpers.ts` y los cuatro fixtures `test/fixtures/fluyo-019-*`.
  - `scripts/mutate-019-3.ts` (nuevo).
  - `README.md` y `test/fixtures/README.md`.
- **Sin cambios**: el resto de fluyo (`render.js`, `export.js`, `geometry.js`, `model.js`, editor, Viewer, Share, deep link, Present, CSS), `describe_document`, `author_document`, `propose_layout`, `run_story` y el resto de tools del MCP.

### Pruebas (tiempos de esta máquina)

| Suite | Resultado | Tiempo |
|---|---|---|
| fluyo `node --test test/fluyo-019-3.test.cjs` | 11/11 | 0,9 s |
| fluyo `node test/fluyo-019-3-browser.cjs` (Chrome real) | 62/62 | 10,3 s |
| fluyo `node test/fluyo-019-3-mutations.cjs` | 13/13 detectadas (10 U + 3 B) | 51 s + 44 s |
| fluyo `node test/fluyo-019-1-browser.cjs` | 59/59 | 15,1 s |
| fluyo `node test/fluyo-019-2-browser.cjs` | 85/85 | 23,5 s |
| fluyo suite completa `node --test test/*.test.cjs` | 1159 ✔ · 81 ✘ | 6,8 s |
| fluyo, misma suite sobre el árbol limpio antes de 019.3 | 1150 ✔ · 79 ✘ | 5,7 s |
| MCP `fluyo-019-3.test.ts` | 17/17 | ~2 s |
| MCP suite completa (`npm test` sin compilar) | 741/741 (720 previos + 21 nuevos), 0 omitidos | 4,5 s |
| MCP `visual-regression` con `REQUIRE_FLUYO=1` | 53/53 | — |
| MCP `node scripts/mutate-019-3.ts` | 24/24 detectadas (6 «app» + 18 «mcp») | 146 s |
| MCP: documentos planos frente al MCP de HEAD (`b4323e6`, compilado aparte): 26 documentos × páginas × 4 temas × {—, escala 2, recorte, fuente del documento, otra fuente} × {sin opciones, `skin:"flat"`+`customBg`, `skin:null`} | 0 diferencias en 1680 comparaciones, byte a byte | 1,2 s |
| MCP `check:kernel`, `check:config`, `tsc` | verdes | — |

Sobre los 81 fallos de la suite de fluyo:
- 79 son los de la línea base, idénticos por nombre (tests históricos que fallan sobre el árbol actual con independencia de esta tarea).
- Los 2 restantes son comprobaciones de «idéntico a HEAD / árbol limpio» que vuelven a pasar al commitear, como en 019.1 y 019.2:
  - el alcance de 019.2, «`skin.js` idéntico a HEAD»;
  - el alcance de 018.25, que mira `git status`.

### Riesgos y pendientes

- **Viewers con el SW v86** pintan con el `skin.js` anterior hasta activar v87. Un share con `#rrggbbaa` y piel seguirá abriéndose en fase `error` en esos clientes hasta la recarga que activa v87 (`skipWaiting` + `claim`). Mitigación: desplegar fluyo (v87) antes o a la vez que el MCP.
- **`customBg:"#rrggbbaa"`**: la piel mezcla con el fondo del tema (regla explícita, sin cambios); el lienzo plano pinta ese fondo translúcido. No hay errores, pero los tonos no componen sobre un fondo con alfa.
- **Rótulos en el MCP con la piel**: misma divergencia de medidor que en plano (D6). Una etiqueta que se encoge puede quedar a otro tamaño de fuente que en la app.
- **El lienzo plano con `#rrggbbaa`** (fuera de la piel) ya trataba mal el alfa en el relleno (`hexA`/`svgFillColor` leen 8 dígitos como 6). Es previo a esta tarea, no lo toca y no se mezcla aquí.
- **Commit**: git avisará de LF→CRLF; `core.autocrlf=true` lo normaliza, como en 019.1 y 019.2. Las 2 comprobaciones «idéntico a HEAD» vuelven a verde con el commit.

### Diferencias exactas frente a 019.2

- En **fluyo**:
  - `skin.js` gana `skinColor`. `skinTones` usa `skinColor(color, base) || PALETTE[0].c` en lugar de la rama `colHex`/`DEFAULT_NODE_COLOR`, y los dos frentes usan `skinColor(n.fill, T.bg) || T.front` en lugar de `skinHexRGB(n.fill)? n.fill : T.front`.
  - `CACHE` v87.
  - Resultado: ningún cambio para `#rgb`/`#rrggbb` (comprobado contra el `skin.js` de `1ee65ee` en todo el corpus) ni para colores sin `#`. `#rrggbbaa` y `#` mal formados dejan de lanzar.
- En el **MCP**:
  - `settings.skin` en schema, kernel y `create_diagram`.
  - `export_diagram` pinta la piel con `"built"`.
  - Todo documento sin la clave sale igual que antes.

## Handoff

### Estado actual
**READY FOR COMMIT** (15-10-2026), en los dos repos, sin commit, push ni deploy. Los cinco puntos de la fase 1 están resueltos con el GO del owner. Fluyo y el MCP comparten una sola semántica de color y de piel, verificada capa a capa, línea a línea y píxel a píxel (sin texto).

### Próximo paso concreto
1. El owner revisa esta tarea y las capturas.
2. Commit en **fluyo** (`js/skin.js`, `sw.js` v87, tests, fixture de colores, docs) y en **fluyo-mcp** (port, schema, kernel, tests, fixtures, script de mutaciones, README).
3. Tras commitear fluyo, `npm run check:kernel` en el MCP debe seguir en verde: el kernel no cambia en esta fase.
4. Desplegar fluyo (v87) **antes** o a la vez que el MCP (ver Riesgos).
5. Después, evaluar **FLUYO-019.4** (Authoring 2.5D en el editor), explícitamente fuera de este slice.
