# FLUYO-019.5 — El pintor plano lee bien `#rgb` y `#rrggbbaa` (tinte del relleno)

Estado: **COMMITEADA** (15-10-2026; GO del owner a D1–D8 y al commit) en fluyo y en fluyo-mcp. **Sin push ni deploy.**
Owner/agente actual: libre (espera la orden de push/deploy del owner)

> Repo público: solo contenido apto para público (`AGENTS.md` §9).

## Objetivo

Que el tinte automático de un nodo (relleno al 16/18 %, panel de `code`, pista de las animaciones) tenga el **mismo tono** que su trazo para cualquier color válido del dominio (`HEX_COLOR`: `#rgb`, `#rrggbb`, `#rrggbbaa`) en el lienzo, Present, Viewer, exportación raster/SVG y `export_diagram` del MCP. Con `#rrggbb` (todo el corpus actual) la salida sigue idéntica byte a byte.

## Por qué

Hallazgo **F12** de FLUYO-019.4. `#rrggbbaa` es un color válido del dominio (decisión 205, `HEX_COLOR` de `story-authoring.js`; `create_diagram`/`create_node` del MCP lo aceptan). La piel «construido» ya lo compone bien (`skinColor`, 019.3), pero el pintor plano no: un nodo Cache `#7fa66b80` (verde al 50 %) se rellena **rosa**, `#d08b5bcc` (naranja) sale **lavanda**, y en el mismo lienzo «construido» los círculos y rombos (que no tienen piel) siguen saliendo mal.

## Alcance

### Incluye

- Diagnóstico de **todos** los lectores de color que hacen `parseInt(col.slice(1),16)` (lienzo, exportación SVG, panel `code`, MCP).
- Regla canónica propuesta, impacto en goldens e identidad byte a byte, plan de tests, decisiones D1–D8.

### No incluye

- Cambios de código, `CACHE`, commit, push o deploy.
- Los usos **nativos** del color (trazo, texto de `text`/`anim`, sombra del pulso, tinte de icono, puntos): Canvas y SVG ya pintan `#rrggbbaa` con su alfa. Ver «Fuera de alcance».

## Contexto necesario

- `AGENTS.md`, esta tarea.
- `.ai/DECISIONS.md` 205 (regla de color de la piel) y 206 (port literal al MCP).
- FLUYO-018.14a (el panel `code` usa «el mismo tinte» que el relleno automático), FLUYO-018.15 (respaldo `PALETTE[0]`).
- No hace falta leer FLUYO-019.4 entero: solo la fila F12.

## 1. Diagnóstico

### 1.1 La causa

```js
// js/model.js:28
function hexA(col,a){ const v=parseInt(col.slice(1),16);
  return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`; }
```

Solo es correcta con 6 dígitos. Con 8 (`#rrggbbaa`) los canales salen desplazados un byte: `v>>16&255` = **gg**, `v>>8&255` = **bb**, `v&255` = **aa**. Así, `#7fa66b80` se lee como `rgb(166,107,128)` (rosa) y el alfa se pierde. Con 3 dígitos `#abc` = `0xabc` = `rgb(0,10,188)` (azul intenso). Con un valor que no es hex (`"red"`) se leen los dígitos hex que haya: `parseInt("ed",16)` = `rgb(0,0,237)`.

La misma lectura está copiada en otros tres sitios (sin pasar por `hexA`).

### 1.2 Inventario de lectores (fluyo + fluyo-mcp)

| # | Dónde | Qué pinta | Entrada | ¿Afectado? |
|---|---|---|---|---|
| L1 | `js/render.js:97` `fillFor(n,theme)` → `hexA(n.color, .16/.18)` | Relleno automático de rect, círculo, rombo, hexágono, cilindro… (lienzo, Present, Viewer, PNG/JPG/GIF) | `n.color` | **Sí** (`#rgb`, `#rrggbbaa`, no hex) |
| L2 | `js/render.js:145,153,165` `drawAnim` → `hexA(colHex(col), .2/.15)` | Pista del spinner, barra de progress, cuerpo del ticket | `n.color` (`colHex` deja pasar cualquier `#…`) | **Sí** |
| L3 | `js/export.js:121` `svgFillColor(hex,theme)` (desde `svgNodeFill`) | `fill="rgba(…)"` del SVG exportado (plano y formas sin piel en «construido») | `n.color` | **Sí** (copia de `hexA`) |
| L4 | `js/geometry.js:738` `codePanelTint(color,theme)` → `codeColors().panel` | Panel de un nodo `code` (lienzo y SVG) | `n.color` | **Distinto**: solo acepta `#rrggbb`; `#rgb`/`#rrggbbaa`/otro → `null` → `T.lblBg` (sin tinte). No pinta un tono equivocado, pero rompe la regla de 018.14a («el mismo tinte que el relleno automático») |
| M1 | `fluyo-mcp/src/svg.ts:697` `svgFillColor` (desde `svgNodeFill`) | `fill` de `export_diagram` | `n.color` | **Sí** (port literal de L3) |
| M2 | `fluyo-mcp/src/svg.ts:869` `codePanelTint` | Panel `code` en `export_diagram` | `n.color` | Igual que L4 (port literal; paridad con test `vm`) |
| — | `js/render.js:367` `drawNodeCueMessage` → `hexA(fx.messageColor, .92)` | Mensaje de un evento (centro) | `fx.messageColor` | No: `normalizeNodeEffects` (`model.js:138`) solo guarda `#rrggbb` |
| — | `js/render.js:434` `hexA(fx.fillColor, .38)` | Relleno de un evento | `fx.fillColor` | No: idem (`model.js:146`) |
| — | `js/render.js:754` `flowGlow` → `hexA(FLOW_ACCENT, a)` | Halo del símbolo en tránsito | constante `#d08b5b` | No |
| — | `js/skin.js` `skinColor`/`skinTones` | Piel «construido» | `n.color`, `n.fill` | No (decisión 205) |

`hexA` está en `model.js`, que es **kernel** (lo copia `fluyo-mcp` en `src/generated/kernel-sources.ts`), pero el MCP no lo usa para pintar: `svg.ts` tiene sus propias copias (M1, M2).

### 1.3 Reproducción en Chrome real

Chrome estable (`playwright-core`, `channel:"chrome"`), repo servido en solo lectura, service worker bloqueado, documento cargado con `applyProjectData`. Fila superior: `#7fa66b`, `#7fa66b80`, `#7fa66bff`, `#7fa66b00`; centro: círculo `#d08b5b`, círculo `#d08b5bcc`, rombo `#abc`, rombo `#aabbcc`, progress `#7fa66b80`; abajo: `"red"`, `"#12345"`, `code` `#7fa66b80`. Sin errores de consola.

Píxel medido dentro de cada forma (crema, plano) frente a lo que daría la regla propuesta (D1a):

| Color | `fillFor` hoy | Píxel hoy | Con D1(a) | Lectura |
|---|---|---|---|---|
| `#7fa66b` | `rgba(127,166,107,0.16)` | `#e1e3ce` | `#e1e2ce` | correcto (control) |
| `#7fa66b80` | `rgba(166,107,128,0.16)` | `#e8d9d2` rosa | `#ebe8d8` verde suave | **mal** |
| `#7fa66bff` | `rgba(166,107,255,0.16)` | `#e8d9e6` lila | `#e1e2ce` = `#7fa66b` | **mal** (opaco y aun así cambia) |
| `#7fa66b00` | `rgba(166,107,0,0.16)` | `#e8d9bd` ocre | `#f4eee1` (fondo) | **mal**: el trazo es invisible y el relleno no |
| `#d08b5bcc` (círculo) | `rgba(139,91,204,0.16)` | `#e3d7de` lavanda | `#efe1d0` | **mal** |
| `#abc` (rombo) | `rgba(0,10,188,0.16)` | `#cdcadb` azul | `#e8e6de` = `#aabbcc` | **mal** |
| `"red"` | `rgba(0,0,237,0.16)` | `#cdc8e3` | `#dee1da` (`PALETTE[0]`) | ilegible (D3) |
| `"#12345"` | `rgba(1,35,69,0.16)` | `#cdcec8` | `#dee1da` (`PALETTE[0]`) | ilegible (D3) |
| `code` `#7fa66b80` | panel `#f4eee1` | sin tinte | tinte `k·α` | L4 |
| progress `#7fa66b80` | pista `rgba(166,107,128,0.2)` | rosa | `rgba(127,166,107,0.1004)` | L2 |

En oscuro, lo mismo (p. ej. `#7fa66b80` → `#302529` en vez de `#1f231e`). En la **exportación raster «construido»** (`render(…,{skin:"built"})`) el círculo `#d08b5bcc` y el rombo `#abc` dan exactamente los mismos píxeles erróneos: la piel no los cubre. En el **SVG** (`buildSVGDocument`) el `fill` es el mismo string erróneo, y `export_diagram` del MCP (`dist/svg.js`, `pageToSVG`) emite `fill="rgba(166,107,128,0.16)" stroke="#7fa66b80"`, `fill="rgba(139,91,204,0.16)"` y `fill="rgba(0,10,188,0.16)"`.

El script de reproducción y las capturas (`f12-crema+flat.png`, `f12-dark+flat.png`, `f12-report.json`) están en el scratchpad de la sesión, fuera del repo. Se regeneran con el documento descrito arriba.

### 1.4 Por qué no salta antes

- Ningún ejemplo, fixture ni golden tiene un `color` de nodo con 3 u 8 dígitos en un relleno plano. Los `#rrggbbaa`/`#abc` que hay en fixtures son `dotColor`, `kwColor`, `textColor` o capas de la piel, que se pintan de forma nativa o por `skinColor`.
- La UI del editor solo produce `#rrggbb` (`<input type=color>`, rejilla). `#rgb`/`#rrggbbaa` llegan por el MCP (`HEX_COLOR`), por `author_document` o por JSON escrito a mano.
- `fluyo-019-3-browser.cjs` exige que el **plano** de un documento con `#rrggbbaa` sea idéntico a `1ee65ee`. Esa aserción fija precisamente este defecto (ver §4).

## 2. Regla canónica propuesta

**Un tinte de nodo es el color del nodo con opacidad `k`; si el color ya trae alfa, las opacidades se multiplican.**

Una función nueva, total y determinista, en `js/geometry.js` (junto a `codePanelTint`, que ya es «el tinte»):

```
colorTint(color, k) →
  #rrggbb      → rgba(r,g,b,k)               (el string de hoy, byte a byte)
  #rgb         → se expande a #rrggbb → rgba(r,g,b,k)
  #rrggbbaa    → rgba(r,g,b, round4(k·aa/255))   (aa=ff → exactamente k)
  cualquier otro valor → null (quien llama decide el respaldo)
```

Mayúsculas y minúsculas valen igual, como `HEX_COLOR`. Los espacios de los extremos se ignoran, como en `skinColor` y en el trazo de Canvas. Para `#rrggbb` y `#rgb` no se multiplica (se usa `k` tal cual), así que el string de 6 dígitos no cambia ni en un carácter.

Callers:

- `fillFor` (L1) → `colorTint(n.color, k) || colorTint(PALETTE[0].c, k)`.
- `drawAnim` (L2) → `colorTint(col, .2)` (y `.15`) con el mismo respaldo `PALETTE[0]`; `colHex` deja de usarse ahí.
- `svgFillColor` (L3) → `colorTint(hex, k) || colorTint(PALETTE[0].c, k)`.
- `codePanelTint` (L4) → `colorTint(color, k)`; `null` sigue cayendo en `T.lblBg` (sin cambio para lo ilegible).
- MCP: `colorTint` portado literalmente a `svg.ts` y usado por M1/M2.

`hexA` (kernel) no se toca: tras el cambio solo recibe constantes y colores de eventos ya normalizados a `#rrggbb`. Un test de guarda impide que vuelva a recibir un color de nodo.

**Coherencia con la decisión 205.** La piel compone `#rrggbbaa` sobre su fondo: `C = fondo·(1−α) + color·α`, y luego tiñe. Sobre el fondo, el tinte plano con esta regla da `fondo·(1−kα) + color·kα`, que es exactamente lo que se ve si se compone primero sobre el fondo y después se aplica el tinte `k`. La diferencia es que aquí el alfa lo compone el propio Canvas/SVG: la regla no necesita conocer el fondo y funciona igual sobre una zona u otro nodo. Además, es lo que ya hace el trazo, que Canvas y SVG pintan con `#rrggbbaa` y su alfa: relleno y trazo quedan con la misma transparencia relativa.

Descartadas:

- **Componer con `skinColor` y luego teñir** (D1b): los mismos píxeles sobre el fondo, pero obliga a pasar el fondo (`customBg` o tema) a `fillFor`/`svgFillColor`/`codeColors` (cambia la firma y el port) y se equivoca sobre cualquier cosa que no sea el fondo.
- **Quitar el alfa** (D1c): total y simple, pero un `#7fa66b00` tendría trazo invisible y relleno visible. Es la misma opción que se descartó en 205.
- **Pintar con `fill=color` + `fill-opacity=k`** (o `globalAlpha` en Canvas): soporta cualquier color CSS de forma nativa, pero cambia todos los SVG exportados (`rgba(…)` → dos atributos). Rompe la identidad byte a byte.

## 3. Impacto

| Superficie | Cambio |
|---|---|
| Lienzo, Present, Viewer, PNG/JPG/GIF (plano) | Rellenos/pistas/panel `code` de nodos con `#rgb`, `#rrggbbaa` o color ilegible. `#rrggbb`: idéntico |
| «Construido» | Las formas sin piel (círculo, rombo, hexágono, `code`, `anim`…) se corrigen igual; las piezas con piel no cambian (`skin.js` no se toca) |
| SVG (`export.js`) | `fill` de esos nodos. `#rrggbb`: idéntico byte a byte |
| MCP `export_diagram` | Igual que el SVG (port de `colorTint` en `svg.ts`); `KERNEL_ID` **sin cambios** (no se toca `model.js`) |
| Formato `.fluyo.json` | Ninguno. Los colores se guardan tal cual |
| `CACHE` | v87 → **v88** (`render.js`, `export.js`, `geometry.js`). Si 019.4a entra antes, esta toma la siguiente |
| Kernel | Sin cambios (D4a) |
| Goldens | Ninguno cambia: no hay rellenos planos con 3/8 dígitos en `test/fixtures`, `ejemplos/` ni en los fixtures del MCP. `fluyo-019-1-skin.json`, `fluyo-019-2-skin-svg.json` y `fluyo-019-3-colores.json` son de la piel |
| Tests existentes | `fluyo-019-3-browser.cjs` («en plano, idéntico a `1ee65ee`» con `#6a9fb5cc`, `#d08b5b80`, `#7fa66bcc`, `"#12345"`, `"red"`) **fallará a propósito**: hay que reescribir esa aserción (§4). Los tests históricos «X idéntico a HEAD» que vigilan `render.js`/`export.js`/`geometry.js` fallan hasta el commit, como siempre. La paridad `codeColors` app↔MCP (`visual-regression.test.ts`) exige cambiar los dos repos a la vez; sus casos `{color:"#abc"}` y `{color:"red"}` siguen siendo paridad (el primero cambia de valor en los dos lados) |
| Documentación | `ARCHITECTURE.md` (línea del color de nodo: «el render no lo reinterpreta» → regla del tinte), decisión nueva (207) |

## 4. Plan de tests

1. **`test/fluyo-019-5.test.cjs`** (Node, `vm` con `config.js`+`geometry.js`+`render.js`/`export.js` como en otros tests):
   - `colorTint` sobre una tabla escrita a mano: `#rrggbb` (también en mayúsculas), `#rgb`, `#rrggbbaa` con `aa` = `ff`/`80`/`cc`/`00`/`01`, ilegibles (`"red"`, `"#12345"`, `""`, `null`, `"#abcd"`); `" #7fa66b80 "` se lee como `#7fa66b80`.
   - Para **todo `#rrggbb`** (barrido de la paleta y aleatorios con semilla): `fillFor`, `svgFillColor`, `codePanelTint` y la pista de `drawAnim` dan el **mismo string que HEAD** (`git show HEAD:js/…` cargado en otro contexto).
   - Guarda: en `render.js`/`export.js`, ningún `hexA(` recibe `n.color`/`col`; los únicos argumentos son `fx.messageColor`, `fx.fillColor` y `FLOW_ACCENT`.
2. **`test/fluyo-019-5-browser.cjs`** (Chrome real, SW bloqueado):
   - El documento de §1.3 en crema/oscuro/claro y con fondo propio. El píxel del relleno (plano y raster «construido» para círculo/rombo) coincide, con tolerancia ±2, con `fondo·(1−kα)+color·kα` calculado **en Node**.
   - Paridad lienzo/SVG: el `fill` del SVG de cada nodo = `fillFor` del lienzo.
   - **Corpus** (`ejemplos/*.fluyo.json` + fixtures): SVG y raster plano y «construido» idénticos byte a byte a HEAD.
   - Reescritura de `fluyo-019-3-browser.cjs`: «plano idéntico a 1ee65ee **salvo** los tintes de los nodos `#rrggbbaa`/ilegibles», o comparar contra el árbol de 019.5 con el delta esperado.
3. **`test/fluyo-019-5-mutations.cjs`**: quitar la expansión de `#rgb`; no multiplicar `α`; multiplicar también en `#rrggbb` (rompe la identidad); respaldo distinto de `PALETTE[0]`; `codePanelTint` sin `colorTint`; `drawAnim` sin `colorTint`. Todas deben matar al menos un test.
4. **MCP**: `test/fluyo-019-5.test.ts`, con la tabla de `colorTint`, el SVG de un documento con `#rrggbbaa`/`#rgb` igual que el de fluyo (fixture compartido `fluyo-019-5-tinte.json` generado desde el editor) y el corpus plano idéntico a HEAD. En `visual-regression.test.ts`, añadir `{color:"#6a9fb5cc"}` a los casos de paridad de `codeColors`. `scripts/mutate-019-5.ts`.

## 5. Decisiones recomendadas D1–D8

019.5 es un problema de **color del pintor plano**, independiente de la piel 2.5D: no toca `js/skin.js`, `settings.skin`, la activación de la piel en el editor (019.4b) ni las correcciones de la piel (019.4a). Lo comparten solo las capas en las que se pinta: `render.js`, `export.js`, `svg.ts` y `sw.js`.

Notas comunes a todas:

- `k` es la opacidad que ya usa cada tinte: 0,16 en crema y 0,18 en el resto para el relleno y el panel `code`; 0,2 y 0,15 para la pista de `anim`.
- **Superficies.** Lienzo del editor, Present (dentro del editor) y Viewer (`s/index.html`, que también abre los Share) pintan con el mismo `render.js` (`fillFor`, `drawAnim`, `codeColors`). PNG, JPG y GIF salen de `render()`. El SVG sale de `export.js` (`svgNodeFill` → `svgFillColor`, `codeColors`). `export_diagram` del MCP sale de `src/svg.ts`. Un Share es el documento en la URL, así que no cambia: cambia cómo lo pinta el Viewer desplegado. Hasta que el service worker pase a v88, un navegador con v87 en caché sigue viendo lo de antes.
- **Documentos existentes.** No hay migración y el `.fluyo.json` no cambia (los colores se guardan tal cual). Solo cambian de aspecto los nodos cuyo `color` tiene 3 u 8 dígitos o no es hex, **sin `fill` explícito** (o de tipo `code`/`anim`). La UI del editor solo escribe `#rrggbb`. `#rgb`/`#rrggbbaa` llegan por el MCP (`HEX_COLOR` en `create_node`/`update_node`/`create_diagram`), por `author_document` o por JSON a mano. Los ilegibles, solo por JSON a mano o por un documento completo que llegue con ellos (`normalizeProjectNode` acepta cualquier string). Ningún ejemplo, fixture ni golden de los dos repos está en ese caso.

### D1 — Semántica del alfa en el tinte

- **Propuesta.** El tinte de un color `#rrggbbaa` es `rgba(r,g,b, k·aa/255)`: el alfa del color multiplica la opacidad del tinte. Con `aa`=`ff` el resultado es idéntico al de `#rrggbb`. Con `aa`=`00` el relleno es invisible, igual que el trazo.
- **Alternativas descartadas.** (b) Componer el color sobre el fondo con `skinColor` y luego teñir: sobre el fondo da los mismos píxeles, pero obliga a pasar el fondo (`customBg` o tema) a `fillFor`, `svgFillColor` y `codeColors`, lo que cambia firmas y port, y se equivoca sobre zonas u otros nodos. (c) Quitar el alfa: un `#7fa66b00` tendría trazo invisible y relleno visible; es la opción que ya se descartó en 205.
- **Archivos.** `js/geometry.js` (`colorTint`, nueva). Los usos están en D3, D4 y D5.
- **Qué cambia funcionalmente.** Un nodo `#7fa66b80` se rellena de verde suave (`#ebe8d8` en crema) en vez de rosa (`#e8d9d2`), y `#d08b5bcc` de naranja en vez de lavanda. Relleno y trazo quedan con la misma transparencia relativa. Sobre el fondo, el píxel es `fondo·(1−kα) + color·kα`: lo mismo que componer primero como en 205 y teñir después.
- **Documentos existentes.** Solo nodos `#rrggbbaa` sin `fill` explícito. Hoy se ven con un tono equivocado.
- **Share, Viewer, Present, exportación.** Se corrige en todas las superficies a la vez (ver notas comunes). En «construido» se corrigen las formas que la piel no cubre (círculo, rombo, `code`, `anim`…). Las piezas con piel no cambian.
- **MCP.** `export_diagram` emite el mismo `fill` que el SVG de fluyo (port, D4). `create_*`/`update_*` no cambian: ya aceptan `#rrggbbaa`.
- **Tests y aceptación.** En Chrome real (crema, oscuro, claro y fondo propio), el píxel del relleno = `fondo·(1−kα)+color·kα` calculado en Node, ±2 por canal, en plano y en raster «construido». El `fill` del SVG = `fillFor` del lienzo para cada nodo. El string de `aa`=`ff` es igual al de `#rrggbb`. La aserción «plano idéntico a `1ee65ee`» de `fluyo-019-3-browser.cjs` se reescribe: idéntico salvo los tintes de los nodos afectados, comprobando ese delta.

### D2 — `#rgb`

- **Propuesta.** `#abc` se expande a `#aabbcc` antes de teñir (mayúsculas y minúsculas valen igual).
- **Alternativa descartada.** Dejarlo como está: hoy `#abc` se lee como `rgb(0,10,188)` (azul intenso). Mantenerlo solo conservaría un error.
- **Archivos.** `js/geometry.js` (`colorTint`, la misma función de D1).
- **Qué cambia funcionalmente.** Un nodo `#abc` tiñe como `#aabbcc`, el mismo color con el que ya se pinta su trazo de forma nativa.
- **Documentos existentes.** Solo nodos `#rgb` sin `fill` (llegan por el MCP o por JSON).
- **Share, Viewer, Present, exportación.** Como en D1.
- **MCP.** Port idéntico. En la paridad de `codeColors` (`visual-regression.test.ts`), el caso `{color:"#abc"}` cambia de valor en los dos lados a la vez (de `lblBg` a tinte, D5).
- **Tests y aceptación.** `colorTint("#abc",k)` = `colorTint("#ABC",k)` = `colorTint("#aabbcc",k)`. En Chrome, el píxel del rombo `#abc` = el del rombo `#aabbcc`.

### D3 — Colores ilegibles en el relleno

- **Propuesta.** Si el color no es un HEX del dominio (`"red"`, `"#12345"`, `""`, `"#abcd"`…), `colorTint` devuelve `null`, y el relleno automático y la pista de `anim` usan el tinte de `PALETTE[0]` (`#6a9fb5`). Es el respaldo histórico de `normalizeProjectNode` y `colHex` y el que ya usa la piel (205). El panel `code` conserva su respaldo actual, `T.lblBg` (D5). Los espacios de los extremos se ignoran, como en `skinColor` y como en el trazo de Canvas: `" #7fa66b80 "` se lee como `#7fa66b80`.
- **Alternativas descartadas.** (b) Conservar la lectura histórica byte a byte: deja un azul que sale de dígitos sueltos (`"red"` → `rgb(0,0,237)`). (c) Sin relleno: la forma quedaría hueca y se separaría de la regla de la piel.
- **Archivos.** `js/render.js` (`fillFor`, `drawAnim`: `colHex` deja de usarse ahí), `js/export.js` (`svgFillColor`), `fluyo-mcp/src/svg.ts` (`svgFillColor` con `PALETTE[0].hex` de `schema.ts`).
- **Qué cambia funcionalmente.** El relleno de `"red"` pasa de azul `rgb(0,0,237)` al tinte de `#6a9fb5`. El trazo no cambia: sigue rojo, porque Canvas lo pinta de forma nativa. `"#12345"` sigue con trazo negro; eso queda fuera de alcance.
- **Documentos existentes.** Solo los que llevan un color no hex escrito a mano o importado. El MCP no los crea: `HEX_COLOR` los rechaza en la autoría.
- **Share, Viewer, Present, exportación.** Como en D1.
- **MCP.** El mismo respaldo en `export_diagram`. Sin rechazos nuevos.
- **Tests y aceptación.** Tabla de ilegibles → `null`. `fillFor`, `svgFillColor` y la pista de `anim` = el tinte de `PALETTE[0]`. Mutación «respaldo distinto de `PALETTE[0]`» muerta.

### D4 — Dónde vive la regla

- **Propuesta.** `colorTint(color, k)` en `js/geometry.js`, junto a `codePanelTint`: pura, sin dependencias, devuelve un string `rgba(…)` o `null`. El respaldo lo decide quien llama. Port literal en `fluyo-mcp/src/svg.ts` (exportada), y `colorTint` se añade a las funciones que la paridad `vm` de `visual-regression.test.ts` compara entre app y MCP. `hexA` (`model.js`, kernel) no se toca: tras el cambio solo recibe `FLOW_ACCENT` y los colores de eventos, que `normalizeNodeEffects` ya deja en `#rrggbb`. Un test de guarda lo vigila.
- **Alternativa descartada.** Arreglar `hexA` en `model.js`: cambia el kernel (`sync:kernel`, `KERNEL_ID` nuevo, job `drift`) y, aun así, el MCP necesitaría el port, porque `svg.ts` no usa `hexA`.
- **Archivos.** `js/geometry.js`, `js/render.js`, `js/export.js`, `sw.js` (`CACHE` v87 → v88), `fluyo-mcp/src/svg.ts`. No hay scripts nuevos: el editor (`index.html`) y el Viewer (`s/index.html`) ya cargan `geometry.js` antes de `render.js`.
- **Qué cambia funcionalmente.** Por sí sola, nada: es dónde vive la regla.
- **Documentos existentes.** Ninguno.
- **Share, Viewer, Present, exportación.** Sin cambios de carga. Lo que cambia en la pantalla es lo de D1–D3 y D5.
- **MCP.** `KERNEL_ID` igual y sin `sync:kernel`. Sin cambios en tools, schema ni contrato.
- **Tests y aceptación.** `model.js` idéntico a HEAD. Guarda en `render.js`/`export.js`: ningún `hexA(` recibe `n.color`/`col`. Paridad `vm` de `colorTint` app↔MCP sobre la tabla completa.

### D5 — Panel de `code`

- **Propuesta.** `codePanelTint(color,k)` = `colorTint(color,k)`. Si es `null`, sigue cayendo en `T.lblBg`.
- **Alternativa descartada.** Dejarlo solo en `#rrggbb`: un `code` `#7fa66b80` tendría el borde verde y el panel sin tinte, contra 018.14a («el mismo tinte que el relleno automático»).
- **Archivos.** `js/geometry.js` (`codePanelTint`), `fluyo-mcp/src/svg.ts` (`codePanelTint`), `fluyo-mcp/test/visual-regression.test.ts` (nuevo caso `{color:"#6a9fb5cc"}`).
- **Qué cambia funcionalmente.** Los `code` con `#rgb`/`#rrggbbaa` sin `fill` ganan el panel tintado. Con color ilegible, igual que hoy.
- **Documentos existentes.** Solo nodos `code` con esos colores.
- **Share, Viewer, Present, exportación.** Lienzo, Present, Viewer y raster por `codeColors` en `render.js`; SVG por `export.js`. `code` no tiene piel: igual en plano y en «construido».
- **MCP.** Port literal. Los casos de paridad `#abc` y `#6a9fb5cc` cambian de valor en los dos lados a la vez; `red` no cambia.
- **Tests y aceptación.** La paridad `codeColors` pasa con `#abc`, `#6a9fb5cc` y `red` en los tres temas. En Chrome, el píxel del panel = `fondo·(1−kα)+color·kα`. Mutación «`codePanelTint` sin `colorTint`» muerta.

### D6 — Formato del alfa en el string

- **Propuesta.** Solo cuando hay `aa`: alfa = `Math.round(k·aa/255·1e4)/1e4` (p. ej. `0.0803`; `aa`=`00` → `0`). Sin `aa` se usa `k` tal cual, sin multiplicar ni redondear, para que el string de `#rrggbb` sea el de hoy carácter a carácter.
- **Alternativa descartada.** El número completo de JS (`0.08031372549019608`): también es determinista, pero ensucia el SVG y no aporta nada visible. Canvas cuantiza a 1/255 y el error de 4 decimales es menor que 0,00005.
- **Archivos.** `js/geometry.js`, `fluyo-mcp/src/svg.ts`.
- **Qué cambia funcionalmente.** Solo cómo se escribe el número.
- **Documentos existentes.** Ninguno.
- **Share, Viewer, Present, exportación.** El SVG exportado lleva `rgba(…,0.0803)`. En Canvas no hay diferencia visible.
- **MCP.** El mismo string, con las mismas operaciones en TS.
- **Tests y aceptación.** Tabla de strings exactos: `aa`=`ff` → `0.16`/`0.18`; `80` → `0.0803`/`0.0904`; `00` → `0`; `01` → `0.0006`/`0.0007`.

### D7 — Alcance: fluyo y fluyo-mcp en la misma slice

- **Propuesta.** Una sola slice con un commit por repo, los dos en READY FOR COMMIT a la vez. Los dos repos están hoy al día con `origin/main`.
- **Alternativa descartada.** Fluyo primero y el MCP después: mientras tanto, la paridad `codeColors` y el job `drift` (`REQUIRE_FLUYO=1`) quedarían en rojo, y `export_diagram` pintaría distinto del editor.
- **Archivos.** Fluyo: `js/geometry.js`, `js/render.js`, `js/export.js`, `sw.js`, `test/fluyo-019-5.test.cjs`, `test/fluyo-019-5-browser.cjs`, `test/fluyo-019-5-mutations.cjs`, `test/fixtures/fluyo-019-5-tinte.json`, `test/fluyo-019-3-browser.cjs` (la aserción de `1ee65ee`), las aserciones de `CACHE` (v88) en `test/`, `.ai/DECISIONS.md` (207), `.ai/ARCHITECTURE.md`. MCP: `src/svg.ts`, `test/fluyo-019-5.test.ts`, `test/visual-regression.test.ts`, `test/fixtures/fluyo-019-5-tinte.json` (copia), `scripts/mutate-019-5.ts`.
- **Qué cambia funcionalmente.** La suma de D1–D6.
- **Documentos existentes.** Los de las notas comunes.
- **Share, Viewer, Present, exportación.** Todo con el deploy de fluyo (v88).
- **MCP.** Hace falta publicar y desplegar el MCP para que `export_diagram` cambie. No hay cambios de contrato.
- **Tests y aceptación.** Suite de fluyo (solo fallan los históricos «idéntico a HEAD» hasta el commit) y suite del MCP en verde, con `REQUIRE_FLUYO=1`. Corpus (`ejemplos/*.fluyo.json` y fixtures): SVG y raster, plano y «construido», idénticos byte a byte a HEAD en fluyo, y `pageToSVG` idéntico a HEAD en el MCP. El fixture compartido da el mismo SVG en fluyo y en el MCP. Las mutaciones de los dos repos, todas muertas.

### D8 — Orden respecto a 019.4a

- **Propuesta.** 019.5 antes que 019.4a. Son independientes: 019.5 no toca `skin.js`, y 019.4a no toca `fillFor`, `svgFillColor`, `codePanelTint` ni `drawAnim`. Coinciden en archivo (`render.js`, `export.js`, `svg.ts`), pero en funciones distintas, y en la `CACHE` de `sw.js`.
- **Alternativa descartada.** Hacerla después: el defecto, ya desplegado, sigue más tiempo en producción y nada de 019.4a lo necesita.
- **Archivos.** Ninguno propio. 019.4a pasaría a v89 (o a la siguiente libre).
- **Qué cambia funcionalmente, documentos y superficies.** Nada adicional.
- **MCP.** 019.4a parte de un `svg.ts` con `colorTint`, sin conflicto lógico.
- **Tests y aceptación.** Al empezar 019.4a, sus aserciones de `CACHE` parten del valor que deje 019.5.

### Criterios de aceptación globales

- [x] `#rrggbb`: cada string de `fillFor`, `svgFillColor`, `codePanelTint` y la pista de `anim` es igual al de HEAD (barrido de paleta y aleatorios con semilla).
- [x] Corpus de los dos repos: SVG y raster idénticos byte a byte a HEAD, en plano y en «construido».
- [x] `#rgb`, `#rrggbbaa` e ilegibles: píxeles según D1–D3 y D5 en Chrome real, en tres temas y con fondo propio, con 0 errores de consola, en el editor, Present, Viewer (share) y raster/SVG exportados.
- [x] Paridad app↔MCP de `colorTint` y `codeColors`; el fixture compartido da el mismo SVG.
- [x] `model.js` y `KERNEL_ID` sin cambios; `skin.js` sin cambios; golden de la piel sin cambios.
- [x] `CACHE` v88; decisión 207 y `ARCHITECTURE.md` actualizados.

## Fuera de alcance (anotado, sin tocar)

- **Trazo con color ilegible**: `"#12345"` no es un color CSS, así que `strokeStyle` ignora la asignación y el trazo sale negro (el estado anterior). En SVG se emite tal cual. Lo arreglaría un respaldo en el trazo de `render.js` y en `renderNodeToSVG`; no es `#rrggbbaa` y no entra aquí.
- **`#rrggbbaa` en atributos SVG** (`stroke`, `fill` explícito, `color` de texto): los navegadores lo pintan, pero algunos programas de SVG 1.1 no. Si hace falta compatibilidad con ellos, sería otra tarea: emitir `rgb()` + `*-opacity` rompe la identidad byte a byte.
- **Panel de Propiedades**: `setWell` (`ui.js`) solo lee `#rrggbb` (`HEX6`). Con `#rgb`/`#rrggbbaa` el pozo «Personalizado» enseña `DEFAULT_NODE_COLOR` con la marca de automático, aunque el nodo tiene color propio. Es de UI, no de pintado.


## Decisiones tomadas

- GO del owner a D1–D8 tal como están planteadas (15-10-2026), con una condición estricta: `#rrggbb` no cambia ni en string ni en píxeles, y el corpus existente queda idéntico. Registrada como **decisión 207** en `.ai/DECISIONS.md`; sección «Tinte de un color de nodo (FLUYO-019.5)» en `.ai/ARCHITECTURE.md`.
- De implementación (sin decisión nueva):
  - `colHex` (`render.js`) se sustituye por `nodeTint(c,k)` en el mismo sitio, con el mismo respaldo `PALETTE[0]`. Así el número de usos de `PALETTE[0]` que vigila 018-15 no cambia (2 en `render.js`).
  - `svgFillColor` (`export.js`) llama a `nodeTint` de `render.js`. El editor carga los dos scripts, y el Viewer no exporta SVG.
  - Los comentarios de `skin.js` que nombran `colHex` como respaldo histórico no se tocan, para que `skin.js` quede idéntico byte a byte (criterio de aceptación).

## Archivos modificados

**fluyo**
- `js/geometry.js`: `colorTint` (nueva); `codePanelTint` → `colorTint`.
- `js/render.js`: `fillFor` y la pista de `drawAnim` pasan a `nodeTint`; `colHex` → `nodeTint`.
- `js/export.js`: `svgFillColor` → `nodeTint`.
- `sw.js`: `CACHE` v87 → **v88**.
- `test/fluyo-019-5.test.cjs`, `test/fluyo-019-5-browser.cjs` y `test/fluyo-019-5-mutations.cjs` (nuevos), más el fixture `test/fixtures/fluyo-019-5-tinte.json`, compartido con fluyo-mcp (nuevo).
- Tests existentes:
  - Las aserciones de `CACHE` de 46 archivos pasan de v87 a v88.
  - `fluyo-019-2-browser.cjs`: el smoke del service worker pasa a ser `b534a97` (v87) → árbol (v88). La versión anterior es una revisión fija y no HEAD, para que siga valiendo después del commit (85/85).
  - `fluyo-019-3-browser.cjs`: «plano idéntico a `1ee65ee`» se mantiene, pero aplicando antes a ese árbol la regla del tinte de 019.5, escrita en el test.
  - `fluyo-019-3.test.cjs`: la referencia OLD carga el `render.js` de `1ee65ee`, que aún tiene `colHex`.
  - `fluyo-018-14a.test.cjs`: `#abc` en `code` ahora tiñe (D2/D5), `"red"` mantiene el fondo del tema, y la marca de corte `colHex` pasa a `nodeTint`.
  - `fluyo-018-15.test.cjs`: solo el comentario de la lista blanca.
- `.ai/DECISIONS.md` (207), `.ai/ARCHITECTURE.md` y esta tarea.

**fluyo-mcp**
- `src/svg.ts`: `colorTint` exportada, port literal; `svgFillColor` con respaldo `PALETTE[0].hex`; `codePanelTint` → `colorTint`.
- `test/fluyo-019-5.test.ts` (nuevo), `test/fixtures/fluyo-019-5-tinte.json` (copia byte a byte) y `scripts/mutate-019-5.ts` (nuevo).
- `test/visual-regression.test.ts`: paridad `vm` de `colorTint` y casos `#6a9fb5cc`, `" #6A9FB580 "` y `#12345` en `codeColors`.
- `README.md`: una frase sobre el relleno automático en `export_diagram`.
- Sin cambios en el kernel (`check:kernel` ✔, mismo `KERNEL_ID`), las tools, el schema ni `dist/`.

No son de esta tarea y no se han tocado: `.ai/tasks/FLUYO-019.4.md` y `.ai/tasks/FLUYO-019-FLOW-FADE.md`, que son de otras sesiones y están sin commitear.

## Pruebas

| Suite | Resultado |
|---|---|
| fluyo `node --test test/fluyo-019-5.test.cjs` | 8/8 |
| fluyo `node test/fluyo-019-5-browser.cjs` (Chrome real) | 68/68, ~15 s. Píxeles en raster plano (20 nodos) y «construido» (10 formas sin piel), en editor, Present y Viewer (share), en crema, oscuro, claro y fondo `#123456`. Paridad lienzo/SVG. Corpus: 11 documentos, 48 comparaciones byte a byte con `b534a97` (SVG y raster, plano y construido). 0 errores de consola |
| fluyo `node test/fluyo-019-5-mutations.cjs` | 19/19 detectadas (12 vm + 7 Chrome) |
| fluyo `node --test test/*.test.cjs` | 1160 ✔ / 88 ✘. Contra una copia limpia de HEAD (1158/80), solo fallan de más 9 tests históricos «idéntico a HEAD» (alcance de 018.x/019.x), que pasan al commitear. El de fixtures del MCP de 018-25 también falla en HEAD limpio con fluyo-mcp al lado (comprobado). Ninguno de los nuevos ni de los ajustados falla |
| fluyo, las 40 suites `*-browser.cjs` | 34/40 ejecutadas: 29 ✔ a la primera (entre ellas 019-5, 019-3, 019-2 con el smoke v87→v88, 018-15, 018-16, 018-14a y 018-9). 019-1 falló una vez por `net::ERR_NO_BUFFER_SPACE` (red, transitorio) y pasa al repetirla (59/59). 018-12 (6 ✘), 018-19 (1 ✘), 018-23 (2 ✘) y 018-5 (1 ✘) fallan **igual, con los mismos mensajes, en una copia limpia de HEAD**: son previos (cabecera, panel, alturas y diálogos) y no tienen que ver con el color. Las 6 restantes (011, qa-share-hash, scenario-qa, share, share-post-qa, share-realistic-size) no arrancan en este entorno porque piden el paquete `playwright` completo y aquí solo está `playwright-core` |
| fluyo-mcp `REQUIRE_FLUYO=1 npm test` | 748/748 (741 + 6 de `fluyo-019-5.test.ts` + 1 de paridad `colorTint`) |
| fluyo-mcp `node scripts/mutate-019-5.ts` | 12/12 detectadas (3 de divergencia de la app + 9 del MCP) |
| fluyo-mcp `check:kernel` / `check:config` | ✔ / ✔ |
| Identidad del MCP (comprobación puntual) | `pageToSVG` de HEAD (`599276c`, compilado aparte) frente al árbol: 13 documentos × 3 temas × plano/construido. 72/72 idénticos en los 12 del corpus; el documento de control de 019.5 cambia en sus 6 combinaciones (esperado) |

Auditoría previa (sin cambios): reproducción en Chrome real (§1.3) e inventario de lectores (§1.2).

## Pendientes / riesgos

- Los shares y documentos ya publicados con `#rrggbbaa`, `#rgb` o colores ilegibles cambian de aspecto al desplegar. Es la corrección buscada.
- Un Viewer o editor con el service worker v87 en caché pinta lo de antes hasta que se active v88 (`skipWaiting` + `claim`). `export_diagram` cambia cuando se publique y despliegue el MCP. Conviene desplegar los dos a la vez.
- 019.4a parte de aquí: su `CACHE` será v89, y sus aserciones de `CACHE` parten de v88.
- Siguen fuera de alcance: el trazo de un color ilegible, `#rrggbbaa` en atributos SVG para programas de SVG 1.1 y el pozo de color del panel (ver «Fuera de alcance»).

## Handoff

### Estado actual

Implementada, verificada y **commiteada** en los dos repos, un commit por repo encima de `origin/main`. Los hashes están en `git log` (el de fluyo-mcp cita esta tarea). **Sin push ni deploy.**

### Próximo paso concreto

Con la orden del owner, push y deploy (los pasos 1 y 2 ya están hechos):
1. Commit en **fluyo** con `js/geometry.js`, `js/render.js`, `js/export.js`, `sw.js`, los tests (nuevos y ajustados), el fixture, `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md` y esta tarea. No incluir `FLUYO-019.4.md` ni `FLUYO-019-FLOW-FADE.md`.
2. Commit en **fluyo-mcp** con `src/svg.ts`, `test/fluyo-019-5.test.ts`, `test/visual-regression.test.ts`, el fixture, `scripts/mutate-019-5.ts` y `README.md`.
3. Push y deploy de los dos a la vez.
4. Después, 019.4a.
