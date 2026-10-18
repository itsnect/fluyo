# FLUYO-019-FLOW-FADE — El punto de flujo no se apaga al llegar cuando hay una conexión «arriba»

**Tipo:** auditoría (§1–§9) + implementación de D2 y del punto 2 de §5 (§10).
**Estado:** READY FOR COMMIT (implementación sobre `266ac09`, 019.5 commiteada, pusheada y desplegada).
**Base medida:** árbol de `b534a97` (HEAD), servido en solo lectura desde el scratchpad; Chrome real (Playwright `channel: "chrome"`, SW bloqueado).
**En paralelo con:** FLUYO-019.5 (tinte de color). Esta auditoría no ha tocado `render.js`, `geometry.js`, `export.js`, `svg.ts`, tests ni `CACHE`.

> Nota de método: las capturas citadas en el encargo no llegaron a la sesión. Por eso, la reproducción se reconstruye a partir de la descripción («conexión/flecha superior», «el punto llega al nodo y permanece visible / desaparece de forma incorrecta») y se cubre con una matriz que **mide** el alfa de cada punto.

> **Modo de las capturas (comprobación del §3.3, revisión 2):** el caso exacto (conexión central sola → se añade la conexión superior) se midió con «Una pelota por ruta» **OFF y ON**, en el editor, en Present y en el Viewer, con nueve lecturas posibles de «conexión superior». Resultados:
> - **Con OFF, el defecto no se reproduce en ninguna variante ni superficie.** El perfil de alfa al llegar es idéntico al de la central sola, hasta la tercera decimal. Además, el código lo impide: el alfa de los puntos solo depende de la propia conexión (§3.3.3).
> - **Con ON se reproduce:** en 3 de las 9 variantes la pelota llega a B con α = 1 y salta, y en otras 2 el fade empieza antes y la pelota nunca alcanza la opacidad plena cerca de B.
>
> **El modo de las capturas es «Una pelota por ruta» ON.** La única salida que queda es que la «conexión superior» de las capturas no sea ninguna de V1–V7 (§3.3.4).

---

## 1. Reproducción exacta

1. Documento con dos rectángulos: A (200,300) y B (640,300), de 160×70. Conexión A→B recta (`id 10`).
2. Ajuste del documento **«Una pelota por ruta»** (`settings.single = true`, casilla `#chkSingle` de Lienzo).
3. **Sin** más conexiones: la pelota se apaga de forma gradual al acercarse a B.
4. Añadir una conexión que **salga de B**, por ejemplo:
   - la inversa B→A (en el mismo canal, `laneLayout` la pone en el carril paralelo a 25 px, encima o debajo según el id y el sitio);
   - o B→C hacia un nodo situado encima.
5. La pelota llega a B con **α = 1**, se queda sobre la aguja y el borde del nodo y, en el siguiente fotograma, **salta** al inicio de la otra conexión (25 px en la inversa, 87 px en B→C), también con α = 1.

Se ve igual en el editor, en Present, en el Viewer (el ajuste viaja en `settings.single` del documento compartido, `viewer.js:533`) y en el GIF exportado.

## 2. Causa raíz

`drawFlowBalls` (`js/render.js:681-720`) no anima conexiones, sino **caminos completos** (`flowGroups`, `render.js:629`): sucesiones de conexiones que empiezan en un origen y terminan en un nodo sin salidas. `pathGeometry` (`render.js:668`) concatena las rutas `edgePoints` de cada conexión **sumando solo sus longitudes**. El fade se calcula sobre el camino entero:

```js
const fade = clamp(Math.min(d, g.total - d) / (D * .125), 0, 1);   // render.js:710
```

donde `d` es la distancia recorrida por el camino, `g.total` su longitud total y `D` la del camino más largo del grupo. De ahí salen tres consecuencias:

- **El «arrival» solo existe al final del camino.** B es un final únicamente si no sale nada de él. Una conexión que sale de B (la «superior»: la inversa B→A o una B→C) hace que el DFS continúe (`walk`, `render.js:644`). B pasa a ser un vértice intermedio, `g.total − d` ≫ ventana y α = 1 al llegar.
- **Salto entre anclas.** El final de A→B (ancla en el lado oeste de B) y el inicio de B→X (otra ancla, otro carril u otro lado) son puntos distintos. Como `pathGeometry` no suma ningún tramo entre ellos, en el instante `d = L₁` la pelota pasa de uno a otro sin transición.
- **La ventana de fade es relativa al grupo** (`D·0,125`), no a la conexión. Una rama corta dentro de un grupo largo nunca llega a verse entera. Una conexión superior que alargue el camino más largo del grupo, aunque no salga de B, hace que el fade de llegada a B empiece antes y nunca alcance la opacidad plena (V1b y V5 en §3.3).

Respuestas a la traza pedida:

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Posición | `pointAt(seg.pts, (d − seg.start)/seg.L)` sobre la ruta `edgePoints` de la conexión en curso del camino (`render.js:695-697`). En el modo normal: `pointAt(pts, f)` con `f = (t·sp + i/n) mod 1` (`render.js:911-915`). |
| 2 | Alfa | Pelota: `min(d, total − d)/(D/8)` sobre el **camino**. Puntos: `min(f, 1 − f)·8`, la **fracción** de la propia conexión (`render.js:916`). |
| 3 | «Arrival» | Pelota: el final del camino (un nodo sin salidas animadas). Puntos: `f = 1`, el ancla `pts[n−1]` de la propia conexión, en el borde del nodo (no la punta de la aguja, que está 3 px antes, `EDGE_GAP`). |
| 4 | Geometría | Ambos usan la ruta **completa** `edgePoints` (anclas, carriles y U incluidos). Ninguno usa `edgeStroke` (el trazo recortado) ni el último segmento. |
| 5 | Hermanas | En el modo **puntos**, ninguna influencia en el alfa (medido, §3). Solo cambian la ruta: el carril desplaza las anclas, y una U con k = 1 es más larga, lo que alarga la ventana L/8. En la **pelota**, una hermana que **sale** del destino alarga el camino y elimina la llegada. |
| 6 | Dónde está | Ni en `edgePoints`, ni en `edgeStroke`, ni en el clipping, ni en la distancia al ancla. Está en **cómo `drawFlowBalls` define el final** (camino y no conexión) y en la longitud efectiva (`g.total`, `D`), que no es la de la conexión que llega. `flowDir` es un hallazgo aparte (F3). |
| 7 | Superficies | Editor, Present, Viewer y GIF comparten `render()` → `drawEdge` / `drawFlowBalls`. PNG y JPG son un fotograma de lo mismo. El SVG exportado y el `svg.ts` del MCP **no tienen** puntos de flujo (son estáticos). |

## 3. Evidencia medida

**Método.** `drawEdge` y `drawFlowBalls` se envuelven para saber qué conexión pinta, y `arc` del contexto registra `{x, y, r, globalAlpha}` de cada punto (r = 5) y de cada pelota (r = 7). Se ejecuta `render()` de exportación con t ∈ [0, 4) s en pasos de 4 ms (1000 fotogramas por caso), con speed 0,5 y 3 puntos. Cada marca se proyecta sobre `edgePoints` de la conexión medida (`id 10`) y se clasifica por **distancia al extremo de llegada** (en px de mundo). Las columnas α son el máximo observado en cada franja: [0,3) = entre el ancla y la punta; [3,14) = bajo la aguja (tamaño 1).

### 3.1 Modo normal («puntos», por conexión)

| Caso | L | carril | fade empieza a | α[0,3) | α[3,14) | α[14,25) | α[25,40) |
|---|---|---|---|---|---|---|---|
| recta sola | 280 | 0 | 34,7 px | 0,09 | 0,40 | 0,71 | 1 |
| + hermana arriba (A→B) | 280 | +25 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| + hermana abajo (A→B) | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| + hermana inversa B→A | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| + dos hermanas | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| + C→B que entra desde arriba | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| + B→C que sale hacia arriba | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| + anillo B→C→D→A | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| ortho sola / + hermana | 356,4 | 0 / −3,2 | 44,2 | 0,06 | 0,31 | 0,56 | 0,90 |
| U n/n sola | 496 | 0 | 61,5 | 0,05 | 0,22 | 0,40 | 0,64 |
| U n/n + hermana (k = 1, por fuera) | 608 | k = 1 | 75,4 | 0,04 | 0,18 | 0,33 | 0,52 |
| recta reverse (sola / + hermana) | 280 | 0 / +25 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| startArrow + endArrow / arrowSize 2 | 280 | 0 | 34,7 | 0,09 | 0,40 | 0,71 | 1 |
| icono→icono (sola / + hermana) | 366,7 | 0 / +28 | 45,5 | 0,06 | 0,30 | 0,54 | 0,87 |

**Conclusión:** en el modo normal, el perfil de alfa de una conexión es **idéntico byte a byte** con o sin hermanas o conexiones vecinas, en recta, ortho, U, normal y reverse. El fade siempre acaba en α ≈ 0 en el ancla. Lo único que cambia es la longitud de la ventana, que es L/8 (35 px en 280, 75 px en la U de 608). Eso es una inconsistencia menor (F4), no el bug.

### 3.2 Modo «Una pelota por ruta»

| Caso | fade empieza a | α[0,3) | α[3,14) | α[14,25) | α[25,40) |
|---|---|---|---|---|---|
| recta sola | 34,7 px | 0,08 | 0,40 | 0,70 | 1 |
| + hermana arriba A→B / abajo / dos hermanas | 34,7 | 0,08 | 0,40 | 0,70 | 1 |
| + C→B que entra desde arriba | 34,7 | 0,08 | 0,40 | 0,70 | 1 |
| **+ hermana inversa B→A** | **— (no hay fade)** | **1** | **1** | **1** | **1** |
| **+ B→C que sale hacia arriba** | **— (no hay fade)** | **1** | **1** | **1** | **1** |
| **+ anillo B→C→D→A** | **— (no hay fade)** | **1** | **1** | **1** | **1** |
| ortho sola / + hermana | 44,2 | 0,06 | 0,30 | 0,56 | 0,90 |
| U n/n sola / + hermana k = 1 | 61,5 / 75,4 | 0,05 / 0,03 | 0,22 / 0,18 | 0,40 / 0,32 | 0,64 / 0,51 |

**Salto en B** (pelota a ±0,5 px del final de A→B):

| Conexión que sale de B | fin de A→B | inicio de la siguiente | salto | α antes / después |
|---|---|---|---|---|
| inversa B→A (carril paralelo) | (560, 300) | (560, 325) | **25 px** | 1 / 1 |
| B→C (nodo arriba) | (560, 300) | (640, 265) | **87,3 px** | 1 / 1 |

**Rama corta en un grupo largo:** A→B mide 80 px y otra rama del mismo origen mide 910 px. La ventana es 910/8 = 113,8 px, mayor que la rama entera, y la pelota de A→B **nunca supera α = 0,35**.

### 3.3 Revisión 2: los dos modos en el caso exacto, en el editor real, en Present y en el Viewer

**3.3.1 Método.** Se usa el editor real (`index.html`) con su bucle rAF. Para cada fotograma, el reloj del producto se congela (`playing = false; pausedAt = t`, `editor-runtime.js:4-6`) y se esperan dos rAF: el fotograma lo pinta el propio producto (`renderEditorFrame`). Present: `enterPresent()` en el mismo editor. Viewer: `/s/#d=<payload>` generado con `createShareUrl(serializeProject())`, con el reloj del Viewer (`viewer.js:17-19`) congelado igual. `settings.single` viaja en el documento compartido (comprobado: `settings.single` en el Viewer = el del editor). Muestreo: OFF, 110 fotogramas en un tercio de periodo (un punto atraviesa la zona de llegada en pasos de ≈ 0,9 px); ON, 220 fotogramas en el periodo completo de 2 s. Dos métricas por franja de distancia al ancla de llegada de la central (A→B, `id 10`, L = 280):
- **α:** máximo `globalAlpha` con que se pinta el punto (r = 5) o la pelota (r = 7) **sobre la ruta central**;
- **px Δ:** máximo de la diferencia media RGB (0-255) entre el lienzo real y el mismo fotograma sin animación de flujo, en una banda de ±8 px alrededor de la línea central. Es lo que se ve, con el nodo pintado encima incluido.

Las variantes de «conexión superior» (A = (200,300), B = (640,300), C = (640,110)):

| Var. | Conexión añadida | Carril de la central |
|---|---|---|
| V0 | — (central sola) | 0 |
| V1a | B→A en el mismo canal, añadida después | 0 (la inversa va al carril +25) |
| V1b | B→A en el mismo canal, que ya estaba (id menor; queda arriba) | +25 |
| V2a | A→B paralela, añadida después | 0 |
| V2b | A→B paralela, que ya estaba (queda arriba) | +25 |
| V3 | C→B, entra en B desde arriba | 0 |
| V4 | B→C, sale de B hacia arriba | 0 |
| V5 | A→B por arriba (ortho n→n) | 0 |
| V6 | B→A por arriba (ortho n→n, retorno) | 0 |
| V7 | A→C hacia arriba (rama del mismo origen) | 0 |

**3.3.2 Resultados (editor; Present y Viewer dan el mismo α y px Δ con una diferencia de ±6 niveles).** Franjas: [0,3) ancla–punta · [3,14) bajo la aguja · [14,25) · [25,40) px.

| Var. | OFF: α | OFF: px Δ | ON: α | ON: px Δ | ¿Cambia frente a V0? |
|---|---|---|---|---|---|
| V0 | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | 0,07 / 0,36 / 0,69 / 1 | 18 / 53 / 77 / 88 | — |
| V1a | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | **1 / 1 / 1 / 1** | **66 / 88 / 88 / 88** | OFF no · **ON sí: no hay fade** |
| V1b | 0,07 / 0,39 / 0,70 / 1 | 25 / 46 / 72 / 87 | **0,04 / 0,18 / 0,33 / 0,55** | **22 / 32 / 41 / 60** | OFF no · **ON sí: fade largo y débil** |
| V2a | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | 0,07 / 0,36 / 0,69 / 1 | 18 / 53 / 77 / 88 | no / no |
| V2b | 0,07 / 0,39 / 0,70 / 1 | 25 / 46 / 72 / 87 | 0,07 / 0,36 / 0,69 / 1 | 32 / 53 / 77 / 88 | no / no |
| V3 | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | 0,07 / 0,36 / 0,69 / 1 | 18 / 53 / 77 / 88 | no / no |
| V4 | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | **1 / 1 / 1 / 1** | **66 / 88 / 88 / 88** | OFF no · **ON sí: no hay fade** |
| V5 | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | **0,04 / 0,23 / 0,37 / 0,63** | **11 / 36 / 47 / 66** | OFF no · **ON sí: fade largo y débil** |
| V6 | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | **1 / 1 / 1 / 1** | **66 / 88 / 88 / 88** | OFF no · **ON sí: no hay fade** |
| V7 | 0,07 / 0,39 / 0,70 / 1 | 15 / 46 / 72 / 87 | 0,07 / 0,36 / 0,65 / 1 | 15 / 50 / 71 / 88 | no / casi no |

En Present y en el Viewer, las tres filas «no hay fade» (V1a, V4, V6) llegan a px Δ = 88 también en [0,3): la pelota opaca toca el borde de B. Errores de página: 0.

**Lectura.**
- **OFF:** α idéntico en las 10 filas y en las 3 superficies. La única variación de píxel es en [0,3) en V1b/V2b del editor (25 frente a 15). Ahí la central está en el carril +25, a 10 px de la esquina redondeada de B, y lo que cambia es el fondo bajo la banda, no el punto: su α es el mismo y en Present/Viewer da 19–20, como V0. **El fade de llegada no depende de la conexión superior.**
- **ON:** dos manifestaciones de la misma causa (§2):
  - **(a) Sin fade y con salto** cuando la conexión superior **sale de B** (V1a, V4, V6). El camino continúa, B deja de ser una llegada y α = 1.
  - **(b) Fade largo y débil** cuando la conexión superior alarga el camino más largo del grupo (V5: el grupo de A incluye la U; V1b: el ciclo se recorre desde B→A, que es la primera de la página, y A→B es el final de un camino de 560 px). La ventana `D·0,125` crece hasta 70 px y la pelota nunca pasa de α ≈ 0,55–0,63 en los últimos 40 px.
  
  Las dos son «el punto llega al nodo y permanece visible / desaparece de forma incorrecta».

**3.3.3 Por qué OFF no puede producirlo (código).** En `drawEdge` (`render.js:906-923`) el alfa de cada punto es `a · min(1, min(f, 1 − f)·8)`, donde:
- `a = min(nodeAlpha(A), nodeAlpha(B))`, que solo depende de la aparición gradual de los dos nodos;
- `f` solo depende de `t`, `settings.speed`, `edgeSpeedFac(e)`, `edgeDots(e)`, `polyLen(pts)` y `e.flowDir`.

La única entrada que viene de otras conexiones es la ruta `pts = edgePoints(e)` (carril o puerto). La ruta mueve dónde está el ancla, pero `f = 1` cae siempre en esa ancla con α = 0, y el carril no cambia L en una recta. En `drawFlowBalls` (ON), en cambio, entran `flowGroups()` (toda la topología), `g.total` y `D`.

**3.3.4 Cobertura y límite.** Se han probado todas las formas de «conexión superior» con respecto a la central: paralela en los dos sentidos y en los dos órdenes, entrando o saliendo de B, por encima en U y en los dos sentidos, y una rama del mismo origen. Si la de las capturas fuese otra configuración, el §3.3.3 garantiza igualmente que con OFF no cambia el fade de la central. Comprobación de un clic para el owner: en el documento de las capturas, «Lienzo → Una pelota por ruta» marcada (o `"single": true` en `settings` del `.fluyo.json`).

**Tira de fotogramas** (scratchpad `strip.png`, f = 0,80…1,0 junto a B). En «sola», «hermana A→B» y «sale B→C · puntos», el punto se desvanece antes de la aguja. En «hermana inversa · pelota» y «sale B→C · pelota», la pelota llega opaca, se monta sobre la aguja, toca el borde y reaparece de golpe en el otro carril o desaparece del encuadre.

## 4. Superficies afectadas

| Superficie | ¿Afectada? | Por qué |
|---|---|---|
| Editor (lienzo) | Sí (modo pelota) | `render()` → `drawFlowBalls` (`render.js:1170`) |
| Present (editor) | Sí | el mismo `render()` |
| Viewer (`/s/`) normal y Present | Sí | `viewer.js:120` → `render()`; `settings.single` sale del documento compartido |
| Exportación GIF | Sí | `export.js:543` → `render(oc, t, {export:true})` → `drawFlowBalls` (`render.js:1135`) |
| PNG / JPG | Solo el fotograma `now()` | el mismo código |
| SVG exportado | No | sin puntos de flujo |
| MCP `svg.ts` | No | sin puntos de flujo; no necesita paridad |
| Playback de Historias | No | `drawFlowBalls` se suprime con `rs.scenarioRuntime` (`render.js:1170`); los SEND tienen su propio pintor (`drawFlowOverlay`) |

## 5. Propuesta mínima de solución

**Solo `drawFlowBalls`, sin cambiar el reloj ni la enumeración de caminos.** El reloj por grupo (`f·D`) es lo que permite que el GIF cierre el bucle (comentario en `render.js:610-614`) y debe quedarse igual. Lo que cambia es **dónde se apaga la pelota**:

1. **Llegada por conexión.** El fade se calcula sobre el segmento en curso (`seg`) y no sobre el camino:
   `fade = clamp(min(d − seg.start, seg.start + seg.L − d) / W, 0, 1)`.
   La pelota se apaga al llegar a **cada** nodo y se enciende al salir de él. Sobre la aguja tiene el mismo alfa que en una conexión sola, y el salto entre anclas queda en α ≈ 0, así que deja de verse. Que se vea como una sola pelota en el tramo compartido sigue igual (misma `d`).
2. **Ventana en px de mundo, acotada por la conexión:** `W = min(FLOW_FADE_PX, seg.L / 2)`. Se propone `FLOW_FADE_PX = 35`, el valor que da hoy una recta típica de 280 px, para que el caso sano no cambie de forma perceptible. Así se corrige la rama corta (F2) y la ventana deja de depender de D.
3. **Helper puro y testeable** `flowBallAlpha(d, seg)` en `render.js` (o `flowFade(dist, L, W)`, compartible con el modo puntos si se decide D3).

**Lo que NO se propone:** tocar `edgePoints`, `edgeStroke`, `laneLayout`, `flowGroups` ni la lógica de color (`dotColor || A.color` se queda como está; ver §8).

### Decisiones para el owner

- **D1. Resuelto por medida (§3.3):** las capturas corresponden a «Una pelota por ruta» **ON**. Con OFF el defecto no se reproduce en ninguna variante ni superficie, y el código lo impide (§3.3.3). Queda una comprobación de un clic para el owner: la casilla en el documento de las capturas. El arreglo no toca el modo OFF, y un test lo fija idéntico a HEAD (§7).
- **D2.** La llegada pasa a ser **por conexión** (la pelota se apaga y se enciende en cada nodo intermedio) en lugar de solo al final del camino. Recomendado: sí. Alternativa descartada: añadir un tramo de enlace dentro del nodo entre ancla de llegada y ancla de salida, que se vería atravesando el nodo y cambiaría `g.total`, y con él el cuadre del GIF.
- **D3.** Ventana en px fijos (`FLOW_FADE_PX = 35`, acotada a L/2) también en el **modo puntos**, en lugar de L/8. Hoy es inconsistente (75 px en una U, 35 px en una recta), aunque no es el bug. Recomendado: **no** en este slice; dejarlo como F4 para no cambiar el modo por defecto.
- **D4.** `flowDir` en el modo pelota (F3, abajo). Recomendado: fuera de este slice.

### Hallazgos colaterales (no forman parte del arreglo mínimo)

- **F2.** Una rama corta en un grupo largo nunca se ve entera (α máx. 0,35 medido). Se corrige con el punto 2 de la propuesta.
- **F3.** `drawFlowBalls` **ignora `flowDir`**: con `reverse`, la pelota sigue yendo de A a B (medido: x = 322 → 350 → 378 con t creciente), mientras que los puntos sí se invierten. Si se quiere respetar, hay que invertir el sentido de la conexión en `flowGroups`, lo que cambia la topología del camino. Va a su propio slice.
- **F4.** En el modo puntos, la ventana es L/8. En el tramo [3,14) px bajo la aguja, el punto aún tiene α 0,18–0,40 según L. Es una cuestión estética; solo si D3 = sí.

## 6. Archivos que habría que tocar

| Archivo | Cambio |
|---|---|
| `js/render.js` | `drawFlowBalls` (líneas 681-720 en `b534a97`): fade por segmento, `FLOW_FADE_PX` y helper puro. Es un hunk disjunto de los de 019.5 (`fillFor` / `drawAnim` / `nodeTint`, líneas 97-280). |
| `sw.js` | `CACHE` + 1 sobre lo que deje 019.5 (si 019.5 sale con v88 → **v89**). |
| `.ai/DECISIONS.md` | Decisión nueva: «la pelota única se apaga en cada llegada; ventana en px» (número tras el de 019.5: 207 propuesto → **208**). |
| `test/…` | Ver §7. Además, las aserciones `CACHE` de los tests históricos que fijan la versión (la lista que mueva 019.5). |

No se tocan `geometry.js`, `export.js`, `viewer.js`, ni `fluyo-mcp`.

## 7. Tests necesarios

1. **`test/fluyo-019-flow-fade.test.cjs`** (Node, puro): `flowBallAlpha` / `flowFade` con valores de borde (d = seg.start → 0; d = seg.start + seg.L → 0; centro de una conexión larga → 1; conexión de 40 px con W acotada a 20; conexión de 280 px con α en 3/14/25 px igual al de hoy ± 0,02).
2. **`test/fluyo-019-flow-fade-browser.cjs`** (Chrome real, mismo instrumentado de `arc` que esta auditoría), con la matriz de §3.2:
   - las variantes V0–V7 del §3.3, en el editor, en Present y en el Viewer, con los dos modos;
   - ON, con la inversa B→A, B→C, el retorno por arriba y el anillo (V1a/V4/V6): α ≤ 0,1 en [0,3) px y ≤ 0,45 en [3,14) px al llegar a B;
   - ON, con V1b/V5 (camino del grupo más largo): α ≥ 0,95 en [25,40) px, es decir, la pelota se ve entera antes de apagarse;
   - salto: en `d = L₁ ± 0,5`, α < 0,05 a ambos lados;
   - rama corta de 80 px: α máx. ≥ 0,95;
   - el caso sano (recta sola) conserva el perfil de §3.2 ± 0,02;
   - modo puntos: el perfil de §3.1 es **idéntico** al de HEAD (es el guardián de que no se toca);
   - el periodo del GIF (D, `settings.speed`) no cambia: misma `d` en el mismo `t`;
   - Viewer: un share con `settings.single` reproduce la misma α en B.
3. **`test/fluyo-019-flow-fade-mutations.cjs`**: volver a `g.total` en vez de `seg`, quitar la cota `seg.L/2`, usar `D·.125` y quitar el fade de entrada. Cada mutación debe hacer fallar al menos una aserción.

## 8. Interacciones con FLUYO-019.5

- **Mismo archivo, funciones distintas.** 019.5 modifica `render.js` en `fillFor`, `drawAnim` y `colHex` → `nodeTint` (hunks en las líneas 97-280 del árbol de trabajo actual, sin commit). Este arreglo vive en `drawFlowBalls` (681-720), así que no hay solapamiento de hunks. Hay que **aplicarlo después del commit de 019.5** para no mezclar diffs.
- **El color no forma parte del arreglo.** `drawFlowBalls` pinta con `seg.e.dotColor || A.color || "#d08b5b"` (`render.js:712`) y `drawEdge` con `e.dotColor || A.color` (`render.js:907`), en ambos casos con el color en crudo como `fillStyle`. No se propone cambiarlo. Punto de integración a vigilar: si 019.5 decidiera pasar `dotColor` o `A.color` por `nodeTint` o `colorTint`, sería en **esas dos líneas**, y este slice no debe tocarlas. El alfa del fade se aplica por `globalAlpha`, que se compone con el alfa de un `#rrggbbaa` sin interferir.
- **`test/fluyo-018-15.test.cjs:137`** cuenta dos apariciones de `#d08b5b` en `render.js` (`FLOW_ACCENT` y el respaldo de la pelota). El arreglo debe conservar ese literal en `drawFlowBalls`.
- **CACHE y decisiones:** se encadenan tras 019.5 (v89, decisión 208), como se indica en §6.

## 9. ¿Slice independiente o dentro del siguiente de render?

**Slice independiente y pequeño** (propuesta: **FLUYO-019.6**), que entra **después del commit de 019.5** y antes de 019.4a si esta toca `render.js`. Motivos:

- Es un cambio de comportamiento de animación, sin relación con la piel 2.5D ni con el color. Mezclarlo rompería la regla «plano idéntico salvo el bug» que usan los tests de 019.x.
- Toca una sola función, con su propio guardián (modo puntos idéntico a HEAD) y sus mutaciones.
- F3 (`flowDir` en el modo pelota) y F4 (ventana L/8 en el modo puntos) quedan como slices posteriores, solo si el owner los quiere.

## Handoff de la auditoría

- **Hecho:** auditoría con medida en Chrome real. Revisión 2: los dos modos en el caso exacto, en el editor real, en Present y en el Viewer (§3.3), con el modo de las capturas identificado como ON. Este documento es el único archivo creado en el repo.
- **Archivos modificados:** ninguno de producto, tests ni `CACHE`.
- **Scripts de medida** (fuera del repo, en el scratchpad de la sesión): `measure.cjs` (matriz α/distancia), `strip.cjs` (tiras de fotogramas), `extra.cjs` (salto, rama corta, `flowDir`) y `live.cjs` (revisión 2: los dos modos en el editor, en Present y en el Viewer, con reloj congelado, α y px Δ). Si se pierden, se regeneran desde el «Método» de §3.
- **Pendiente (en su momento):** D2–D4. Resuelto: D2 = sí, D3 = no y D4 = no. La implementación está en §10.

## 10. Implementación (D2 + punto 2 de §5)

**Decisiones del owner:** D1 resuelto (ON). **D2 = sí**, junto con el punto 2 de §5 (ventana en px acotada a L/2). **D3 = no** (el modo puntos/OFF no se toca). **D4 = no** (`flowDir` en la pelota, fuera). Se parte de `266ac09` (019.5 commiteada, pusheada y desplegada).

### 10.1 Causa (recordatorio)
`drawFlowBalls` apagaba la pelota sobre el **camino** entero: `min(d, g.total − d)/(D·0,125)`. Un nodo intermedio (B con algo que sale) no era una llegada: la pelota llegaba con α = 1 y saltaba al ancla de salida de la siguiente conexión (25–87 px). Cuando el grupo se alargaba, la ventana `D/8` crecía y el fade empezaba demasiado pronto.

### 10.2 Solución (decisión 208)
Solo en `js/render.js`:
- `FLOW_FADE_PX = 35` y `flowBallFade(s, L) = clamp(min(s, L−s)/W, 0, 1)`, con `W = min(FLOW_FADE_PX, L/2)`. Es pura y solo depende de `(s, L)`.
- En `drawFlowBalls`: `s = clamp(d − seg.start, 0, seg.L)` es la distancia local dentro de la conexión en curso. La posición es `pointAt(seg.pts, s/seg.L)`, numéricamente la misma de antes, y el fade es `flowBallFade(s, seg.L)`.
- **Sin cambios:** el reloj del grupo (`f`, `D`, `d = f·D`), `flowGroups`, `pathGeometry`, `edgePoints`, el dedupe, el color (`dotColor || A.color || "#d08b5b"`), el halo, `nodeAlpha`, `drawEdge` (OFF), geometry, skin, el modelo, el formato, Share, el Viewer, Present y el MCP.

### 10.3 Archivos modificados
| Archivo | Cambio |
|---|---|
| `js/render.js` | `FLOW_FADE_PX`, `flowBallFade` y tres líneas de `drawFlowBalls` (+15 / −3) |
| `sw.js` | `CACHE` v88 → **v89** |
| `test/*` (48) | aserción `CACHE` v88 → v89 (sustitución literal) |
| `test/fluyo-019-2-browser.cjs` | smoke del service worker desde la revisión fija `266ac09` (v88) → v89 (antes `b534a97` v87 → v88) |
| `test/fluyo-019-flow-fade.test.cjs` | nuevo (vm, 25 tests) |
| `test/fluyo-019-flow-fade-browser.cjs` | nuevo (Chrome real, 237 comprobaciones; `FLUYO_QUICK=1` y `FLUYO_ONLY=V2a,…`) |
| `test/fluyo-019-flow-fade-mutations.cjs` | nuevo (16 mutaciones) |
| `.ai/DECISIONS.md` | decisión 208 |
| `.ai/ARCHITECTURE.md` | sección «Pelota única por ruta: fade por conexión» |
| `.ai/tasks/FLUYO-019-FLOW-FADE.md` | este §10 |

No se tocan `FLUYO-019.4.md`, `geometry.js`, `skin.js`, `model.js`, `export.js`, `viewer.js`, `svg.ts` ni fluyo-mcp. El test de alcance lo comprueba contra `266ac09`.

### 10.4 Tests y resultados

| Suite | Resultado | Tiempo |
|---|---|---|
| `fluyo-019-flow-fade.test.cjs` (vm) | **25/25** | 9–13 s |
| `fluyo-019-flow-fade-browser.cjs` (Chrome real) | **237/237** | 427 s (QUICK: 85/85, 144 s) |
| `fluyo-019-flow-fade-mutations.cjs` | **16/16** (U 11/11 · B 5/5) | 164 s + 882 s |
| `fluyo-019-5.test.cjs` / `-browser` / `-mutations` | 8/8 · 68/68 · 19/19 | 1 s · 14 s · 142 s |
| `fluyo-019-2-browser.cjs` (smoke SW v88 → v89 incluido) | 85/85 | 24 s |
| fluyo-mcp `npm test` (sin cambios en el repo) | 748/748 | 12 s |

**Qué cubre el vm** (contra el `render.js` de `266ac09`, 2000 fotogramas por periodo y caso): V0–V7, cadenas de 1, 2 y 4 conexiones (recta y ortho), ramas que comparten tramo, anillo, rama corta de 80 px en un grupo largo, conexión de menos de 70 px (W = L/2) y `reverse`.
- Posición y número de pelotas **idénticos** a `266ac09` en todos los fotogramas: el reloj, los caminos, el dedupe y el bucle del GIF no cambian.
- α = la regla escrita en el test sobre la conexión en la que está la pelota.
- Llegada y salida ≤ 1/W en el primer y el último px de **cada** conexión. α = 1 a W px o más de los dos extremos: el fade no empieza antes de tiempo.
- Salto a ±0,5 px de cada nodo intermedio: α 0,014 a los dos lados (antes 1). Es el caso de V1a, V1b, V4, V6, C2, C4 (×3), RING (×3) y TINY.
- Bucle: α ≈ 0 en t = 0 y en t = periodo − ε, y t = k·periodo repite t = 0.
- Caso sano (V0, V2a, V2b, V3 y REV en la central): α idéntico **bit a bit**.
- OFF: `drawFlowBalls` no pinta, y `drawEdge`, `flowGroups`, `pathGeometry`, `render` y `nodeAlpha` son idénticos carácter a carácter.
- Alcance.

**Chrome real**: editor, Present, Viewer (share) y Present del Viewer, con el reloj del producto congelado.
- OFF: 12 fotogramas por variante y superficie, **idénticos píxel a píxel** a `266ac09` (48/48).
- ON: cada pelota pintada cumple la regla por conexión. En `266ac09` no la cumplían 86–98 pelotas por periodo en V1a/V4/V6/RING.
- ON, caso sano: lienzo idéntico píxel a píxel (V0, V2a, V2b y REV × 4 superficies).
- Exportación (`render` con `export:true`, el camino del GIF): las mismas α.
- 0 errores de página.

**Mutaciones (todas detectadas):**
- Vuelve el fade sobre el camino.
- Ventana en px, pero calculada sobre el camino.
- Por conexión, pero con ventana `D·0,125`.
- Sin la cota L/2.
- Sin fade de salida.
- Sin fade de llegada.
- `FLOW_FADE_PX = 70`.
- D3 colado en los puntos (OFF).
- Reloj del grupo cambiado.
- Posición desplazada.
- CACHE sin subir.

### 10.5 OFF («Una pelota por ruta» desactivada), antes y después
Idéntico. Lo garantizan tres cosas:
- el código: `drawEdge` es carácter a carácter el de `266ac09`;
- el vm;
- Chrome: 48 de 48 combinaciones variante × superficie dan 12 fotogramas idénticos píxel a píxel, en V0–V7, el anillo y `reverse`, en el editor, Present, el Viewer y el Present del Viewer.

El perfil de §3.1 no cambia.

### 10.6 ON, antes y después (central A→B, editor; α · px Δ a 0,5 / 5 / 20 / 37 px del ancla de B)
| Var. | `266ac09` | Ahora |
|---|---|---|
| V0 sola | 0,01·2 / 0,14·18 / 0,57·56 / 1·88 | **igual** (bit a bit) |
| V1a inversa después | **1·88 / 1·88 / 1·88 / 1·88** (sin fade + salto de 25 px) | 0,01·2 / 0,14·18 / 0,57·56 / 1·88 |
| V1b inversa antes | 0,01·14 / 0,07·12 / 0,29·30 / **0,53·52** (fade largo) | 0,01·14 / 0,14·18 / 0,57·56 / 1·88 |
| V2a / V2b paralela | = V0 | **igual** (bit a bit) |
| V3 C→B | = V0 | igual en la central. La pelota de C→B (120 px, otro grupo) pasa de ventana 15 px a 35 px |
| V4 B→C | **1·88 ×4** (salto de 87 px) | = V0 |
| V5 U por arriba | 0,01·1 / 0,08·13 / 0,32·34 / **0,60·58** | = V0 |
| V6 retorno por arriba | **1·88 ×4** | = V0 |
| V7 rama A→C | 0,01·2 / 0,13·17 / 0,52·52 / 0,97·85 | = V0 |
| Anillo | **1·88 ×4** | = V0 |

Present, el Viewer y el Present del Viewer dan las mismas α (px Δ ±12 por el fondo bajo la banda; tabla completa en la salida del test de Chrome). La llegada a B es ahora la misma en todas las variantes, con o sin conexión «superior».

### 10.7 Desviaciones y notas
- **Nombre del helper:** `flowBallFade(s, L)` en lugar de `flowBallAlpha(d, seg)` (§5.3). Es la misma idea, pero recibe la distancia local, que es lo que se testea.
- **Efecto colateral deseado:** en un tramo compartido, la pelota única tiene ahora el mismo α venga del camino que venga. Antes lo decidía el camino que se pintaba primero.
- **Cambia, por la regla y fuera de la central:** las conexiones que no miden 280 px, solas en su camino, pasan de ventana L/8 a 35 px (C→B de 120 px en V3: de 15 a 35 px). Es el punto 2 aprobado.
- **Suites de alcance «idénticas a HEAD»** (`018-17`, `018-18`, `018-19`, `018-21`, `018-23`, `018-24` y `019-2` en `node --test`): en el árbol de trabajo fallan una aserción cada una, porque `render.js` difiere de HEAD. Es lo mismo que pasó con 019.5 antes de su commit. Comprobado en un clon de scratch con este cambio commiteado: dan exactamente lo mismo que HEAD limpio. El resto de la suite unitaria da lo mismo que HEAD (las diferencias de `016`, `018-10`, `018-7d` y `018-25 #11` son del entorno de la copia de comparación, sin `.git` ni fluyo-mcp al lado).
- **El literal de la caché anterior:** `fluyo-019-1` prohíbe nombrar la caché anterior en un test que no sea de mutaciones. El test nuevo la construye (`89 − 1`).
- **Un falso negativo transitorio** en la primera pasada completa de Chrome (V2a, Viewer de `266ac09`: `net::ERR_NO_BUFFER_SPACE` al cargar `config.js` mientras corrían en paralelo las mutaciones). Se repitió V2a sola (20/20) y la pasada completa en secuencia (237/237).
- **Superficie añadida:** el Present del Viewer.
- **Sin cambios** en fluyo-mcp, `svg.ts`, el formato ni el kernel (`KERNEL_ID` igual). El SVG no tiene puntos de flujo.

### 10.8 Handoff
- **Hecho:** D2 y el punto 2 de §5, con CACHE v89 y la decisión 208. Sin commit, push ni deploy.
- **Commit sugerido (solo fluyo):** `js/render.js`, `sw.js`, los 48 tests de CACHE, `test/fluyo-019-2-browser.cjs`, los tres `test/fluyo-019-flow-fade*`, `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md` y este documento. **No** incluir `.ai/tasks/FLUYO-019.4.md` (otra sesión).
- **Cómo repetir:**
  - `node --test test/fluyo-019-flow-fade.test.cjs`
  - `NODE_PATH=<playwright-core> node test/fluyo-019-flow-fade-browser.cjs` (`FLUYO_QUICK=1` para la versión corta)
  - `node test/fluyo-019-flow-fade-mutations.cjs` (`SKIP_BROWSER=1` para solo las U)
- **Pendiente / fuera de este slice:** D3/F4 (ventana en px para los puntos del modo OFF) y D4/F3 (`flowDir` en la pelota), solo si el owner los pide. 019.4a toma CACHE v90 si sale después.

FLOW-FADE — READY FOR COMMIT
