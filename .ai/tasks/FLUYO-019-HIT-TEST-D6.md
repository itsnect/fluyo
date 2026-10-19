# FLUYO-019-HIT-TEST-D6 — Pintado por capas con la piel «construido»: un contenedor no tapa a sus hijos ni a sus conexiones

**Tipo:** auditoría y diseño (§0–§14) + implementación de la fase 1 (§15).
**Estado:** READY FOR COMMIT (19-10-2026). Fase 1 implementada y verificada (§15). Sin commit, push ni deploy hasta el OK del owner. La fase 2 (port al MCP) necesita aprobación aparte.
**Base medida:** `ce8e699` (HEAD = origin/main, desplegado: fluyo.space sirve CACHE v90).
**Método:** Chrome real (Playwright `channel:"chrome"`, service worker bloqueado). El árbol se sirve en solo lectura. La instrumentación vive fuera del repo, en el scratchpad de la sesión: envuelve `drawNode`/`drawEdge`/`renderNodeToSVG`/`renderConnectorToSVG` para registrar el orden de pintado y para omitir un elemento cada vez. El prototipo de la regla se aplica **en seco**, sustituyendo `render` y `buildSVGDocument` solo dentro de la página. El MCP se ha consultado solo en lectura (código y la herramienta `export_diagram`).
**Sin cambios en:** producto, tests, `sw.js`/CACHE, `settings`, Share, hit-test y fluyo-mcp. Sin commit, push ni deploy.

**Contexto leído:** `FLUYO-019-HIT-TEST.md` (D1, D6 aprobada como B1), `FLUYO-019.md` §4.5, `FLUYO-019.2.md` (D4: paridad por port y golden), `FLUYO-019.3.md` (port literal de `skin.js` y paridad en `vm`), `FLUYO-019.5.md` (pintor plano), `ARCHITECTURE.md` (piel, orden de pintor, 019-HIT-TEST).

Marcas: **DEMOSTRADO** (medido con el producto real), **HIPÓTESIS**, **NO REPRODUCIDO**.

---

## 0. Resumen

- **El defecto (DEMOSTRADO):** con `skin:"built"`, el pintor hace dos cosas.
  1. Pinta **todas** las conexiones antes que todos los nodos.
  2. Pinta los nodos en el orden de pintor de la piel (`skinPaintOrder`: `y` ascendente, `x` descendente), **sin saber quién contiene a quién**.

  Como el frente de una caja con piel es **opaco siempre** (incluso con `fill:"none"`), un contenedor tapa a sus hijos cuyo centro queda por encima del suyo y a todas las conexiones que pasan por él. Ocurre en Present, en el Viewer (y su Present), en GIF/PNG/JPG, en el SVG del editor y en el SVG de `export_diagram` del MCP. En los 8 casos medidos, la visibilidad de esos hijos y conexiones es **0**.
- **Origen:** el diseño de la piel (FLUYO-019 §4.5) ya fijaba «**contenedores → conexiones → nodos** ordenados por `y`». La implementación de 019.1 se quedó con «conexiones → nodos por `y`», porque entonces Fluyo no tenía noción de contenedor. Desde D1 sí la tiene: `isContainerNode`, en `geometry.js`.
- **Regla propuesta (§3):** solo con la piel activa, se pinta en tres capas:
  1. **contenedores**, en recorrido en profundidad del árbol de contención, de fuera adentro, con los hermanos en el orden de pintor de la piel;
  2. **conexiones**, completas: línea, aguja, etiqueta, puntos o pelota de flujo y tokens de Historia;
  3. **hojas**, en el orden de pintor de la piel, igual que hoy.

  En plano no cambia nada.
- **Prototipo medido:** visibilidad **1** en todos los casos A–H, en el lienzo y en el SVG. En plano, **0 px distintos y SVG idéntico** en A–H. Sin contenedores (los 8 ejemplos), **0 px distintos y SVG idéntico**, también con la piel.
- **Paridad con el MCP (§7):** la regla será una función **pura** en `geometry.js`, la que el test de paridad del MCP ya ejecuta en `vm`. El MCP la porta en una fase aparte, con fixture y golden compartidos, sin ejecutar el pintor del producto.

---

## 1. Diagnóstico reproducible

### 1.1 Fixture mínimo (caso A)

| id | nodo | centro | tamaño |
|---|---|---|---|
| 1 | GCP (`rect`, borde discontinuo, relleno por defecto) | (500, 350) | 640 × 420 |
| 2 | A | (330, 300) | 120 × 60 |
| 3 | B | (670, 300) | 120 × 60 |
| 4 | C | (500, 470) | 120 × 60 |

Conexiones A→B (10) y B→C (11). `settings.skin = "built"`.

**Pasos:** abrir el documento → Presentar (o abrir su enlace de Share, o Exportar PNG/SVG con «Construido»). **Resultado:** solo se ven el bloque GCP y C. A, B, A→B y B→C quedan **debajo** del frente opaco de GCP. **Frecuencia: 100 %**, determinista.

### 1.2 Orden de pintado hoy (registrado en el lienzo)

| Caso | Orden real (`e` = conexión, `n` = nodo) |
|---|---|
| A | `e10 e11 n3(B) n2(A) n1(GCP) n4(C)` → GCP tapa a A, a B y a las dos conexiones |
| D anidado | `e10 e11 n3 n2 n1(GCP) n7(Región) n4` → **Región** tapa incluso a GCP |
| G hermanos | `e10 n3 n2 n9(VPC2) n8(VPC1)` → cada VPC tapa a su hijo |

En **plano**, el orden es el del documento (`e10 e11 n1 n2 n3 n4`). Con el relleno translúcido por defecto, los hijos se ven; en plano no hay bug salvo con un relleno opaco elegido (§5).

### 1.3 Visibilidad medida (lienzo / SVG), hoy y con la propuesta

Visibilidad = fracción de la zona del elemento (caja del nodo; trazo de la conexión, sin 12 px en cada extremo) que cambia de píxel al omitir ese elemento. 1 = se ve entero; 0 = tapado del todo. Los hijos llevan otro color que los contenedores, para que la medida no se confunda con el tono.

| Caso | Elemento | Hoy, construido | **Propuesta, construido** | Hoy, plano |
|---|---|---|---|---|
| **A** simple (relleno por defecto) | A · B · C | 0/0 · 0/0 · 1/1 | **1/1 · 1/1 · 1/1** | 1/1 · 1/1 · 1/1 |
|  | A→B · B→C | 0/0 · 0/0 | **1/1 · 1/1** | 1/1 · 1/1 |
| **B** `fill:"none"` | A · B · A→B · B→C | 0/0 en todos | **1/1 en todos** | 1/1 |
| **C** relleno opaco `#ffffff` | A · B · A→B · B→C | 0/0 en todos | **1/1 en todos** | hijos 1/1; **conexiones 0/0** (§5) |
| **D** anidado Región ⊃ GCP ⊃ A,B,C | A · B · A→B · B→C | 0/0 en todos | **1/1 en todos** | 1/1 (B→C 0,94/0,88: pasa junto a C) |
| **E** entra y sale (X→A, B→Y) | A · B · X→A · B→Y · A→B | 0 · 0 · 0,5 · 0,45 · 0 | **1 · 1 · 1 · 1 · 1** | ≈ 1 |
| **F** X→Y cruza el interior de GCP | A · B · X→Y | 0 · 0 · 0,19 | **1 · 1 · 1** | 1 |
| **G** hermanos VPC1 ⊃ A, VPC2 ⊃ B, A→B | A · B · A→B | 0 · 0 · 0,24 | **1 · 1 · 1** | ≈ 1 |
| **H** título dentro, hoja que asoma, caja sin hijos | A · Asoma · A→Asoma · Caja sola | 0 · 0,71 · 0 · 1 | **1 · 1 · 1 · 1** | 1 |

(El título, un `text`, da 0,08 en todas las columnas: su zona es casi toda vacía. No es una diferencia.)

**Plano con la propuesta = plano de hoy: 0 px distintos y SVG idéntico** en A–H. **Los 8 ejemplos públicos** (sin contenedores), con la piel y en plano: **0 px distintos y SVG idéntico.**

### 1.4 Capturas (no versionadas, tomadas en la sesión)

En Present con la piel, caso **D** (Región ⊃ GCP ⊃ A, B, C):
- **Hoy:** solo se ven el bloque «Región» y C.
- **Con la propuesta:** se ven Región, GCP dentro, A, B, C y las dos conexiones, con sus puntos de flujo.

El caso **A** da lo mismo.

### 1.5 El MCP tiene el mismo defecto (DEMOSTRADO)

`export_diagram` con el caso A y `skin:"built"` emite primero las dos conexiones y después `node-3` (B), `node-2` (A), **`node-1` (GCP, frente `#d6ddd7`)** y `node-4` (C). Es el mismo orden y el mismo resultado. El port es literal (`svg.ts:1309-1315`, `skin.ts:148`).

---

## 2. Cómo se decide hoy el orden de pintado

| Superficie | Pintor | Orden con la piel | Orden en plano |
|---|---|---|---|
| Editor (lienzo) | `render()` (`render.js:1120`) | — (el editor pinta plano siempre) | conexiones (`:1181`), flujo (`:1182`), nodos en orden del documento (`:1183`) |
| Present del editor | `render()` con `viewport.skin` | conexiones → flujo → `skinPaintOrder(P().nodes)` (`:1130`, `:1183`) | igual que el editor |
| Viewer y su Present | el mismo `render()` (`viewer.js:120`) | igual | igual |
| GIF / PNG / JPG | `render(…, {export:true, skin})` (`export.js:460`, `:543`), rama de exportación (`render.js:1146-1148`) | igual | igual |
| SVG del editor | `buildSVGDocument(scale, skin)` (`export.js:378`) | conexiones (`:394`) → `skinPaintOrder(page.nodes)` (`:400`) | documento |
| SVG del MCP | `pageToSVG` (`svg.ts:1309-1315`) | conexiones → `skinPaintOrder` (port literal) | documento |

- `skinPaintOrder(nodes)` (`skin.js:150`) = copia ordenada por `y` ascendente y `x` descendente. No conoce la contención.
- Los **puntos o la pelota de flujo** se pintan entre las conexiones y los nodos (`drawFlowBalls`). Los **tokens de Historia** se pintan **dentro** de `drawEdge` (`render.js:1007`, `drawEventToken`). Los avisos de nodo de Historia van después de todos los nodos (`drawScenarioNodeCue`).
- **La selección** solo se pinta en el editor (plano). Present y el Viewer no tienen selección.
- **Frente opaco:** `skinNode` (`skin.js:121`) pinta el frente con el relleno (`skinColor`), con el tono derivado del color o, con `fill:"none"`, **con el color del fondo** (`T.bg`). Una caja con piel nunca es transparente.
- **Activación:** `rs.skinOn = skinActive(skin, zoom)`. Con zoom pequeño (canto < 3 px) la piel se apaga y el pintado es plano.

---

## 3. Regla de capas propuesta (determinista, para cualquier árbol de contención)

**Solo cuando la piel está activa** (`rs.skinOn` en `render()`, `skinOn` en `buildSVGDocument`). En plano, el código y el resultado no cambian.

1. **Contenedor** = `isContainerNode(n, nodes)`, la misma definición que el acierto (D1): un nodo que contiene el **centro** de otro nodo de **menor área**. Se calcula en cada pintado, sin caché ni dato en el documento.
2. **Padre de un contenedor c** = el contenedor de menor área, estrictamente mayor que la de c, que contiene el centro de c. Si empatan, el de más arriba en el documento. Si no hay ninguno, c es raíz. No puede haber ciclos, porque el área crece estrictamente.
3. **Capa 1, contenedores:** recorrido en profundidad en preorden (cada contenedor y después sus descendientes). Raíces y hermanos se ordenan con `skinPaintOrder`, con desempate estable por el orden del documento. Resultado: **de fuera adentro**, y entre hermanos, el pintor de siempre.
4. **Capa 2, conexiones:** todas, en el orden del documento como hoy, **completas**: trazo, aguja, etiqueta, funda e instrumentos (que no aparecen fuera del editor), tokens de Historia (dentro de `drawEdge`) y, a continuación, los puntos o la pelota de flujo (`drawFlowBalls`).
5. **Capa 3, hojas:** todos los nodos que no son contenedor, con `skinPaintOrder` (lo mismo que hoy para ellas).
6. Lo que ya va después de los nodos (avisos de Historia, overlays) no cambia.

**Propiedades:**
- Sin contenedores, la capa 1 está vacía y el resultado es **idéntico** al de hoy: conexiones → flujo → `skinPaintOrder(nodes)`.
- Coincide con el acierto de D1 (hoja → conexión → contenedor): lo que se ve encima es lo que recibe el clic.
- Es una función pura de `(nodes, order)` → `{containers, leaves}`. El orden de pintor se pasa como argumento (`skinPaintOrder`), así que `geometry.js` no depende de `skin.js`.

### 3.1 Conexiones

| Conexión | Comportamiento con la regla |
|---|---|
| **Interna** (los dos extremos dentro de un mismo contenedor) | Encima del contenedor y debajo de las hojas: se ve entera. |
| **Entra o sale** (un extremo dentro, otro fuera) | Encima de todos los contenedores, también al cruzar el borde: se ve entera. |
| **Cruza** un contenedor ajeno | Por encima de ese contenedor: se ve. Es el cambio buscado. Es coherente con D1, donde la conexión gana al contenedor. |
| Pasa **bajo una hoja** ajena | Debajo de la hoja, como hoy y como en el acierto. |
| Entre hijos de **contenedores hermanos** | Encima de los dos. |

### 3.2 Contenedores anidados

Región ⊃ GCP ⊃ servicios: Región, luego GCP, luego las conexiones, luego los servicios. Con N niveles, la profundidad del recorrido garantiza que un contenedor interior siempre se pinte después de su exterior, sea cual sea su `y`. Dos contenedores **hermanos** que se solapan siguen el pintor de la piel entre ellos, con sus subárboles detrás de cada uno. Sus hojas quedan siempre encima de los dos, porque todas las hojas van en la capa 3.

### 3.3 Casos límite

- **Hoja que asoma** (su centro está fuera del contenedor, pero lo solapa): no es hija. Va en la capa 3 y queda **encima** del contenedor. Hoy la tapa a medias (0,71 → 1).
- **Caja sin hijos:** es hoja (capa 3). Una conexión que la cruce queda debajo, como en el acierto (caso F′ de D1).
- **Título `text` dentro de una caja:** hace de la caja un contenedor; el título es una hoja y se pinta encima.
- **Contenedores de igual área solapados:** ninguno es padre del otro. Son raíces o hermanos y se ordenan con el pintor de la piel.

---

## 4. Casos A–H: comportamiento esperado

| Caso | Escenario | Esperado con la regla (medido con el prototipo) |
|---|---|---|
| A | Contenedor simple, hijos por encima y por debajo de su centro | Hijos y conexiones internas visibles (1). |
| B | Contenedor `fill:"none"` (frente = color del fondo) | Igual que A: visibles (1). El frente sigue siendo opaco (§5), pero queda debajo. |
| C | Contenedor con relleno opaco elegido | Visibles (1) con la piel. En **plano** las conexiones siguen tapadas (fuera de alcance, §5 y §9). |
| D | Anidado Región ⊃ GCP ⊃ A, B, C | Región → GCP → conexiones → hojas. Todo visible (1). |
| E | Conexiones que entran (X→A) y salen (B→Y) | Visibles en todo su trazo (1; hoy ≈ 0,5). |
| F | Conexión que cruza el interior de un contenedor ajeno | Visible por encima (1; hoy 0,19). |
| G | Contenedores hermanos con hijos y una conexión entre ellos | Los dos VPC, luego la conexión, luego los hijos: visibles (1; hoy 0 y 0,24). |
| H | Título dentro, hoja que asoma, caja sin hijos | Título y hoja encima del contenedor; la caja sin hijos, como hoy. |

---

## 5. `fill:"none"` y el frente opaco de la piel

- En **plano**, `fill:"none"` no pinta relleno y el relleno por defecto es un tinte translúcido: los hijos y las conexiones se ven a través. El único caso tapado en plano es el **relleno opaco elegido** (caso C), donde las conexiones internas no se ven (Δ = 0). Esto era el «D6a» de la revisión de D1.
- Con la **piel**, el frente es **siempre opaco** (`skin.js:121`): `fill:"none"` pinta el color del fondo. Es una decisión de la piel (019.1–019.3) y su port es literal en el MCP. **No se cambia**: con la regla de capas, el frente opaco del contenedor queda **debajo** de sus hijos y conexiones, así que deja de importar. Hacer transparente el frente con `fill:"none"` no basta (los hijos por encima del centro seguirían pintándose antes) y obligaría a tocar `skin.js`.
- **Plano con relleno opaco (D6a): fuera de esta tarea.** Por indicación del owner, el lienzo 2D no cambia. Si se quisiera, sería la misma regla aplicada también en plano, con una decisión propia (§11, D6-4).

---

## 6. ¿El mismo contrato para Present, Viewer y exportación?

**Sí, un solo contrato para toda superficie con la piel activa:**
- **Present del editor, Viewer y Present del Viewer:** son el mismo `render()`; un cambio en `render.js` los cubre a la vez.
- **GIF, PNG y JPG:** la rama de exportación del mismo `render()`.
- **SVG del editor:** `buildSVGDocument`, con el mismo orden de capas.
- **SVG del MCP:** el port, en su fase (§7).

Un documento exportado debe verse como en Present. El prototipo da visibilidad idéntica en el lienzo y en el SVG en todos los casos (§1.3).

## 6.1 Cómo se mantiene idéntico el 2D

- La regla solo se aplica con `rs.skinOn` / `skinOn`. Las ramas planas de `render()` y de `buildSVGDocument` no cambian de texto (un test lo fija frente a la base).
- El editor nunca activa la piel: su lienzo no cambia.
- `skinActive` apaga la piel con zoom pequeño, y entonces el pintado vuelve a ser plano, idéntico al de hoy.
- Medido con el prototipo: 0 px distintos y SVG idéntico en plano (A–H y los 8 ejemplos).

---

## 7. Paridad Fluyo ↔ MCP (sin ejecutar el pintor del producto)

Se sigue el mecanismo vigente (019.2 D4, 019.3): el MCP **porta** el pintor y lo vigila con `test/visual-regression.test.ts`, que carga en `vm` el `geometry.js` y el `skin.js` **reales** de Fluyo y compara sus funciones con el port, sobre el corpus y los fixtures compartidos.

1. **En Fluyo (fase 1):**
   - la regla es una **función pura** nueva en `geometry.js` (fuera del kernel, junto a `isContainerNode`): `containmentPaintOrder(nodes, order)` → `{containers, leaves}`, sin DOM, sin estado y sin depender de `skin.js` (el orden se pasa);
   - `render.js` y `export.js` la llaman con `skinPaintOrder`;
   - **`skin.js` no se toca**, así que el port literal de 019.3 sigue siendo válido.
2. **Contrato compartido:**
   - `test/fixtures/fluyo-019-d6-capas.json`: los casos A–H más un anidado de 3 niveles, con el orden esperado (ids de `containers`, `leaves` y conexiones). Es un golden **de datos**;
   - un golden SVG «construido» del caso D, generado por el editor. Mismo patrón que `fluyo-019-1-skin.json` y `fluyo-019-2-skin-svg.json`.
3. **En el MCP (fase 2, aprobación aparte):**
   - port de `containmentPaintOrder` (y de `isContainerNode`) a `svg.ts`, y `pageToSVG` con las tres capas cuando `skinBg !== null`;
   - `visual-regression.test.ts` ejecuta la función real de `geometry.js` en `vm` y compara `containers` y `leaves` en el corpus y en el fixture nuevo;
   - el golden SVG se compara byte a byte;
   - en ningún momento el MCP ejecuta el pintor de Fluyo en producción: solo lo hace su test.
4. **Brecha entre fases (riesgo aceptado y documentado):** hasta el port, `export_diagram` con piel y contenedores sigue con el orden de hoy. Sin contenedores no hay diferencia: los fixtures compartidos actuales no tienen ninguno, y la propuesta da SVG idéntico en todos ellos. El test de Fluyo compara el fixture con el del MCP **«si está al lado»** y avisa (no falla) mientras el MCP no lo tenga, igual que hicieron 019-2 y 019-3 antes de su port.

---

## 8. Alcance exacto de archivos (fase 1, Fluyo)

| Archivo | Cambio |
|---|---|
| `js/geometry.js` | + `containmentPaintOrder(nodes, order)` (pura; reutiliza `isContainerNode`). |
| `js/render.js` | Las dos ramas de `render()` (`:1146-1148` exportación, `:1181-1183` lienzo): con `rs.skinOn`, contenedores → conexiones → flujo → hojas. Sin la piel, las líneas de hoy sin cambio. |
| `js/export.js` | `buildSVGDocument` (`:394-400`): con `skinOn`, el SVG de los contenedores, luego las conexiones, luego los símbolos y las hojas. Sin la piel, igual que hoy. |
| `sw.js` | `CACHE` al siguiente valor libre (v91 si nadie lo ha tomado antes). |
| Tests | `test/fluyo-019-d6.test.cjs`, `-browser.cjs`, `-mutations.cjs`, el fixture y el golden de §7, y el ajuste de CACHE en los tests que la citan. |
| Docs | `.ai/DECISIONS.md` (decisión nueva), `.ai/ARCHITECTURE.md` (orden de pintor con la piel) y esta tarea. |

**No se tocan:**
- `js/skin.js`, `js/model.js` y `settings`;
- `js/interaction.js` (el hit-test de D1);
- `js/viewer.js` (usa `render()`);
- Share y deep link, `index.html` y `s/index.html`;
- fluyo-mcp (fase 2).

## 9. Fuera de alcance (explícito)

- **Lienzo plano** (editor, Present plano, exportación plana), incluido el relleno opaco en plano (D6a).
- **Transparencia del frente de la piel** (`fill:"none"` → hueco): es una decisión de `skin.js`.
- **Modelo explícito de contenedor** (`parentId`, mover los hijos con el padre).
- **Etiqueta centrada de un contenedor:** con la regla, sus hijos, las conexiones o un contenedor interior pueden taparla (en el caso D, «Región» queda bajo GCP). Hoy pasa lo contrario. La legibilidad de la etiqueta de un contenedor (por ejemplo, `lblPos:"top"` por defecto en contenedores) sería otra decisión visual.
- **Orden Z del usuario entre contenedor e hijo:** con la piel ya no mandaba (manda `skinPaintOrder`) y con la regla tampoco.
- **Port al MCP** (fase 2, aprobación aparte).
- **Acierto:** no cambia; ya es hoja → conexión → contenedor desde D1.

---

## 10. Tests

### 10.1 Unitarios (vm, `test/fluyo-019-d6.test.cjs`)

- `containmentPaintOrder` sobre A–H, un anidado de 3 niveles, hermanos solapados, contenedores de igual área, una hoja que asoma y un título dentro.
- Sin contenedores: `leaves` = `skinPaintOrder(nodes)` y `containers` = `[]`, en los 8 ejemplos y en todos los fixtures.
- Pureza (no muta `nodes`) y determinismo (el mismo documento da el mismo orden; los empates se resuelven por el orden del documento).
- **Estáticos:**
  - las ramas planas de `render()` y `buildSVGDocument` son idénticas, en texto, a las de la base;
  - la regla solo se ejecuta bajo `rs.skinOn` / `skinOn`;
  - `skin.js`, `model.js`, `interaction.js` y `viewer.js` son byte a byte los de la base;
  - CACHE.

### 10.2 Chrome real (`test/fluyo-019-d6-browser.cjs`)

- **Visibilidad** (la métrica de §1.3: Δ px al omitir el elemento) en A–H, con la piel, en el lienzo de exportación y en el SVG rasterizado: hijos y conexiones ≥ 0,95. La base `ce8e699` debe reproducir los 0 (así el test demuestra que detecta el bug).
- **Present y Viewer** (enlace `#d=` con `skin:"built"`) en el caso D: píxeles de A, B y A→B distintos del frente de los contenedores.
- **Flujo y Historia:** pelota única y puntos sobre una conexión interna de un contenedor opaco, visibles; un token de un SEND interno en Present, visible.
- **No regresión:**
  - plano: 0 px distintos frente a la base en A–H, en los 8 ejemplos y en los fixtures (lienzo y SVG);
  - con la piel y sin contenedores: 0 px distintos y SVG idéntico;
  - el editor: el lienzo idéntico.
- Rendimiento: con la piel y 100 nodos, el tiempo por fotograma de Present no sube más de 1 ms.
- 0 errores de página.

### 10.3 Golden

- `test/fixtures/fluyo-019-d6-capas.json`: orden de capas esperado (ids) de A–H y del anidado de 3 niveles.
- Golden SVG «construido» del caso D.
- Comparación con el fixture del MCP «si está al lado»: aviso hasta la fase 2, igualdad byte a byte después.

### 10.4 Mutaciones (`test/fluyo-019-d6-mutations.cjs`)

- Volver a «conexiones antes que todos los nodos» con la piel.
- Contenedores solo por `y`, sin recorrido en profundidad: el anidado D falla.
- Aplicar las capas también en plano: la identidad del plano falla.
- Pintar el flujo después de las hojas.
- Padre del contenedor = el de mayor área en vez del menor: el anidado de 3 niveles falla.
- Hojas en orden de documento en vez de `skinPaintOrder`: los ejemplos con la piel fallan.
- SVG sin capas mientras el lienzo sí las tiene: falla la paridad lienzo ↔ SVG.

---

## 11. Decisiones para el owner

- **D6-1 (principal): ¿se aprueba la regla de capas de §3?** Contenedores (árbol, de fuera adentro, hermanos por el pintor de la piel) → conexiones completas → hojas; solo con la piel activa. **Recomendada.**
- **D6-2:** conexiones por encima de **todo** contenedor (la regla de §3, coherente con D1) frente a la alternativa B1′: cada conexión justo encima de su contenedor común más interior. B1′ es más precisa con contenedores hermanos solapados, pero no coincide con el acierto y es más compleja. **Recomendada:** la de §3.
- **D6-3:** paridad con el MCP en una **fase 2** con aprobación aparte (port de `containmentPaintOrder` + fixture + golden), aceptando la brecha documentada. **Recomendada.**
- **D6-4:** el plano no cambia; D6a (relleno opaco en plano) queda fuera. Es lo que el owner indicó. **Confirmar.**
- **D6-5:** la etiqueta centrada de un contenedor puede quedar tapada por sus hijos. ¿Slice visual aparte para la etiqueta de los contenedores? **Recomendado:** sí, después.

---

## 12. Criterios de aceptación (medibles)

1. Con la piel, en A–H y en el anidado de 3 niveles: visibilidad ≥ 0,95 de cada hijo y de cada conexión interna, entrante, saliente o que cruza, en Present, en el Viewer, en PNG y en SVG. Hoy es 0.
2. En plano: 0 px distintos frente a `ce8e699` y SVG idéntico, en A–H, en los 8 ejemplos y en los fixtures.
3. Con la piel y sin contenedores: 0 px distintos y SVG idéntico frente a `ce8e699`, en los 8 ejemplos y en los fixtures.
4. `skin.js`, `model.js`, `interaction.js`, `viewer.js` y `settings` sin cambios (byte a byte).
5. La pelota o los puntos de flujo y los tokens de Historia sobre una conexión interna son visibles con la piel.
6. Todas las mutaciones de §10.4 se detectan.
7. 0 errores de página. El tiempo por fotograma de Present con 100 nodos sube como mucho 1 ms.

## 13. Riesgos

- **Brecha con el MCP** hasta la fase 2 (§7.4): `export_diagram` con piel y contenedores sigue tapando a los hijos.
- **Cambio visual en documentos con contenedores y piel:** es lo que se busca. También cambian el solapado parcial de una hoja que asoma (queda encima) y la etiqueta centrada del contenedor (puede quedar tapada, §9).
- **Coste:** O(n²) por fotograma en Present y el Viewer (contención por centros). Con decenas de nodos es despreciable; se mide (criterio 7). Si hiciera falta, se calcula una vez por fotograma.
- **Definición geométrica de contenedor:** un nodo grande que cubre por accidente el centro de otro pasa a ser contenedor (el mismo caso límite que en D1). Con la piel, eso lo pinta debajo del otro, que es lo que se espera visualmente.
- **Empates** (misma área o misma `y`): resueltos por el orden del documento. El test de determinismo lo fija.

## 14. Plan de implementación por fases

1. **Fase 1, Fluyo (tras aprobar D6-1 a D6-4):**
   - a. el fixture `fluyo-019-d6-capas.json` y `test/fluyo-019-d6.test.cjs`, escritos primero a partir de §3–§4;
   - b. `containmentPaintOrder` en `geometry.js`;
   - c. `render.js` (dos ramas) y `export.js`, solo bajo la piel;
   - d. el test de navegador (visibilidad, Present, Viewer, PNG, SVG, flujo y token, no regresión plano y sin contenedores, rendimiento) y las mutaciones;
   - e. CACHE, decisión en `DECISIONS.md` y `ARCHITECTURE.md`;
   - f. regresión de las suites de navegador en secuencia y comparación con la base.

   Sin commit hasta el OK.
2. **Fase 2, fluyo-mcp (aprobación aparte):** port de `isContainerNode` y `containmentPaintOrder` a `svg.ts`, `pageToSVG` con capas, paridad en `vm` en `visual-regression.test.ts`, fixture y golden byte a byte, y documentación del contrato.
3. **(Opcional) Fase 3:** legibilidad de la etiqueta de los contenedores (D6-5).

## 15. Implementación — fase 1 (GO del owner, 18-10-2026)

**Aprobada:** D6-1 tal cual. Resumen del owner:
1. contenedores de fuera adentro;
2. conexiones completas;
3. hojas;
4. la `y` solo decide el orden **dentro** de cada capa, nunca entre capas;
5. sin contenedores, píxel a píxel igual que hoy;
6. un contenedor anidado queda sobre su padre y debajo de las conexiones y las hojas.

Precisión del punto 3: las hojas van con el **orden de pintor de la piel** (`skinPaintOrder`), como dice §3.5. Es lo que exigen los puntos 4 y 5: sin contenedores, el orden tiene que ser el de hoy. La selección y los manejadores solo los pinta el editor, que es plano y no cambia.

**Alcance definitivo** = §8: `geometry.js` (`containmentPaintOrder`), `render.js` (dos ramas, solo con `rs.skinOn`), `export.js` (`buildSVGDocument`, solo con `skinOn`), `sw.js` (CACHE v91) más tests y documentación. Se mantienen intactos `skin.js`, `model.js`, `settings`, `interaction.js`, `viewer.js`, Share y fluyo-mcp (fase 2 aparte).

### 15.1 Archivos modificados

**Producto (servidos):**

| Archivo | Cambio |
|---|---|
| `js/geometry.js` | + `containmentPaintOrder(nodes, order)` (pura, fuera del kernel; reutiliza `isContainerNode`). |
| `js/render.js` | `paintLayers()` sustituye a `nodesInPaintOrder()`. Las dos ramas de `render()` pintan contenedores → conexiones → flujo → hojas. En plano, `{containers:[], leaves:P().nodes}`: el orden de siempre. |
| `js/export.js` | `buildSVGDocument`: con la piel, contenedores → conexiones → hojas, y el `<defs>` antes del primer nodo. En plano, o con la piel y sin contenedores, el SVG de siempre byte a byte. |
| `sw.js` | `CACHE` `fluyo-static-v91`. |

**Documentación:** `.ai/DECISIONS.md` (decisión 212), `.ai/ARCHITECTURE.md` (sección nueva y la línea del orden de pintor) y esta tarea.

**Tests nuevos:**
- `test/fluyo-019-d6.test.cjs`
- `test/fluyo-019-d6-browser.cjs`
- `test/fluyo-019-d6-mutations.cjs`
- fixtures:
  - `test/fixtures/fluyo-019-d6-capas.json` (contrato de orden: 13 casos, calculados a mano);
  - `fluyo-019-d6-capas-svg.json` (golden SVG del caso D);
  - `fluyo-019-d6-historia.json` (Historia generada con `author_document` del MCP: un SEND por la conexión interna; sin `settings.skin` y con extensión `.json`, no `.fluyo.json`: tiene un contenedor a propósito, y los corpus de identidad de 019-2 (sin clave `skin`) y de 019-5 (SVG y raster «construido» idénticos a `b534a97`) recorren los `*.fluyo.json`).

**Tests existentes ajustados:**
- `CACHE` v90 → v91 en los tests que la citan.
- Smoke del service worker de `fluyo-019-2-browser.cjs`: ahora sube de `ce8e699` (v90) a v91.
- Alcance de `fluyo-019-hit-test` (frente a `d31703e`): `render.js` y `export.js` salen de la lista de idénticos y `geometry.js` admite `containmentPaintOrder`.
- Alcance de `fluyo-019-flow-fade` (frente a `266ac09`): se deshace el bucle de capas antes de comparar `render.js` y `export.js` sale de la lista de idénticos.
- Los dos cambios quedan anotados en su test.

### 15.2 Pruebas

| Suite | Resultado |
|---|---|
| `test/fluyo-019-d6.test.cjs` (vm) | **21/21**: contrato de 13 casos, cada nodo una vez, anidado con la `y` invertida, identidad sin contenedores (ejemplos y fixtures), pureza y determinismo, estructura de `render()` y `buildSVGDocument`, `render.js` igual a la base fuera del bucle, alcance y fixtures compartidos con el MCP (aviso: aún no están allí, fase 2). |
| `test/fluyo-019-d6-browser.cjs` (Chrome real) | **28/28** en `a000756`; **29/29** tras corregir el criterio de rendimiento (§15.3). Visibilidad ≥ 0,95 de cada hoja y conexión en los 13 casos (lienzo y SVG), y la base `ce8e699` reproduce el 0. Golden SVG del caso D y orden Región, GCP, conexiones, B, A, C. **Plano idéntico a la base en 21/21** (13 casos y 8 ejemplos; hash de píxeles y del SVG). **Con la piel y sin contenedores, idéntico en 9/9.** Present y Viewer reales (caso D): 1 (base: 0). Token de Historia sobre A→B: 11 px (base: 0). Pelota única: 544 px (base: 0). Fotograma con la piel y 100 nodos: +−0,34 ms. 0 errores de página. |
| `test/fluyo-019-d6-mutations.cjs` | **15/15 mutaciones detectadas** (9 en vm, 6 en Chrome). |
| Resto de tests vm | Mismos fallos que la base `ce8e699` en un clon limpio (preexistentes: 011-final-fixes 14, 012-1-qa 28, 017-2-qa 1, 018-17 1, 018-25 10, 018-27 3, 019-2 2, scenario-ui-dom 21). Los «idénticos a HEAD» (018-17/18/19/21/23/24, 019-1, 019-2 n.º 13) fallan antes del commit y **pasan en un clon de scratch con el cambio commiteado** (comparado con un clon en `ce8e699`). |
| Regresión de navegador (las 43 `*-browser.cjs`, en secuencia) | **38 en verde**, entre ellas todas las de la piel, el pintado, la exportación y el Viewer: 019-1/2/3/5, flow-fade, **019-d6**, 019-hit-test, 018-15/16/25/27, share-* y scenario-qa. El smoke del service worker de 019-2 sube de `ce8e699` (v90) a v91. Fallan 5: **011** (12), **018-12** (6, maquetación de la cabecera y el panel), **018-19** (1, «lienzo 87 %»), **018-23** (2, «conexión con puntos 1,06/1,1 pantallas») y **018-5** («HEAD también rechaza 81 caracteres»). Las cinco fallan con **las mismas líneas** en un clon limpio de `ce8e699` (comparación línea a línea): son preexistentes, no de D6. 019-5 llegó a fallar por el fixture de Historia, que estaba en su corpus `*.fluyo.json`; con el fixture renombrado a `.json` pasa 68/68. |


### 15.3 Criterio de rendimiento del test de navegador (commit aparte, después de `a000756`)

Tras el commit funcional (`a000756`), la comprobación «un fotograma con la piel y 100 nodos cuesta ≤ 1 ms más que en la base» falló dos veces (+1,91 y +1,02 ms) y en otra pasó (−0,34 ms). **No era coste real**: `containmentPaintOrder` sola cuesta 0,02–0,03 ms con 100 nodos.

**Por qué el criterio anterior era inestable:**
- medía **una sola vez** cada árbol;
- siempre en el mismo orden: primero el de trabajo, después la base;
- en páginas que ya habían pasado por todas las comprobaciones anteriores, con distinta memoria y distinto estado del JIT;
- y cada fotograma medido copiaba el lienzo entero con `getImageData` (~16 MB), así que el recolector de basura entraba en la medida.

Cada ronda suelta variaba entre −10 y +9 ms.

**Qué mide ahora** (solo cambia el test; el umbral sigue en ≤ 1 ms):
- dos páginas **limpias** (una por árbol) con el mismo documento y calentadas;
- **11 rondas intercaladas** que alternan qué árbol va primero;
- en cada ronda, la media de 30 `render()` sobre un lienzo reutilizado, sin copiar píxeles (una lectura de 1 px al final obliga a volcar lo pendiente);
- el criterio es la **mediana** de las diferencias;
- se informa además del coste de `containmentPaintOrder` sola.

Resultado en 4 ejecuciones seguidas: 29/29 cada vez; medianas +0,07, +0,04, −0,02 y −0,01 ms; rondas dentro de ±0,7 ms. El producto (`js/*`, `sw.js`) no cambia en este commit.

---

## Handoff

### Estado actual

Fase 1 **READY FOR COMMIT** (19-10-2026), sin commit, push ni deploy. Producto: `js/geometry.js`, `js/render.js`, `js/export.js` y `sw.js` (CACHE v91). Más los tests, los fixtures y la documentación de §15.1. `skin.js`, `model.js`, `settings`, `interaction.js`, `viewer.js`, Share y fluyo-mcp no se han tocado. En `git status` aparece también `.ai/tasks/FLUYO-019.4.md`, que es de otra sesión y **no** entra en el commit.

### Próximo paso concreto

1. Con el OK del owner, commit **solo en fluyo** con los archivos de §15.1, excluyendo `.ai/tasks/FLUYO-019.4.md`. Antes del commit fallan los «idénticos a HEAD»; después pasan (comprobado en un clon de scratch).
2. Push y deploy, cuando el owner lo pida. fluyo.space servirá CACHE v91.
3. Fase 2 (aprobación aparte): port de `isContainerNode` y `containmentPaintOrder` a `svg.ts` en fluyo-mcp, paridad en `vm` y los fixtures `fluyo-019-d6-capas.json` y `fluyo-019-d6-capas-svg.json` copiados byte a byte. Este test pasará entonces de aviso a igualdad.
