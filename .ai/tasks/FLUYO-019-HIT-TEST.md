# FLUYO-019-HIT-TEST — Dentro de un contenedor, la conexión pierde contra la caja, y algunas piezas parecen «bloquearse»

**Tipo:** auditoría (reproducción, traza del acierto, semántica, matriz, estrés y diagnóstico). **No se implementa nada.**
**Estado:** READY FOR COMMIT (18-10-2026). Implementados D1 + D2 + D7, con D3–D5 fijadas por tests (§14, §15). D6 (pintado por capas) queda para un slice aparte. Sin commit, push ni deploy hasta el OK del owner.
**Base medida:** `d31703e` (HEAD, FLOW-FADE). La auditoría (§1–§13) no tocó el árbol. La implementación (§14–§15) cambia los archivos de §15.1.
**Método:** Chrome real (Playwright `channel: "chrome"`, service worker bloqueado). El repo se sirve en solo lectura y los gestos son reales (`page.mouse` / `page.keyboard`). La instrumentación vive fuera del repo, en el scratchpad de la sesión: envuelve `hitNode`, `hitEdge`, `hitSideArrow`, `hitSideArrowHost`, `hitCorner`, `hitEdgeEnd`, `hitWaypoint` y `hitSegment` para registrar los candidatos y el ganador de cada `pointerdown`. Además lee `selN`, `selE`, `drag`, `connectDrag`, `endDrag`, `resizing`, `routePending`, `marquee`, `hoverNode` y `document.activeElement`.
**Durante la auditoría:** sin cambios en producto, tests, `CACHE` ni fluyo-mcp. **Implementación:** producto y tests de §15.1, `CACHE` v90; fluyo-mcp intacto. Sin commit, push ni deploy.

Marcas usadas: **DEMOSTRADO** (reproducido con gestos reales y traza), **HIPÓTESIS** (deducido del código, sin reproducción concluyente), **NO REPRODUCIDO** (probado y no aparece en uso humano).

---

## 0. Respuestas cortas

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Por qué una flecha dentro de GCP pierde frente al contenedor? | **DEMOSTRADO.** `pointerdown` prueba los **nodos antes que las conexiones** (`js/interaction.js:527` paso 4, `:567` paso 5). `hitNode` acierta con la **caja rectangular +4 u** de cualquier nodo, sin mirar el relleno ni la forma (`:15-22`). GCP es un nodo más, porque Fluyo no tiene el concepto de «contenedor». Así que todo punto de su interior lo acierta GCP, y `hitEdge` ni siquiera llega a llamarse. Pasa el 100 % de las veces, en todos los fixtures con contenedor, con relleno o sin él (`fill:"none"`). Hay además un segundo modo de fallo: a menos de unos 29 px del origen o del destino, la flecha está en la **zona del puerto de conectar** del nodo extremo (paso 3). Allí un simple clic **crea una conexión espuria A→GCP** (§3.2). |
| 2 | ¿Cuál debería ser la prioridad del acierto? | Instrumentos de la selección → puerto (**solo si el gesto se convierte en arrastre**) → **nodo hoja** → **conexión** → **contenedor** (el más interior) → vacío. «Contenedor» es un nodo que contiene el centro de otro nodo más pequeño, y se calcula en cada acierto (sin caché). Ver §4. |
| 3 | ¿Por qué algunas piezas quedan «bloqueadas»? | No hay una causa única ni ningún estado derivado *stale*. Hay **cuatro mecanismos demostrados** y deterministas, que solo parecen intermitentes porque dependen de dónde se agarra y de qué está seleccionado o enfocado: **(a)** con una conexión seleccionada, su extremo (r = 9 u) le gana el arrastre al nodo; **(b)** el puerto de un vecino le gana al nodo bajo el cursor, y un clic crea una conexión; **(c)** con el contenedor por encima de sus hijos en el orden Z, los hijos son inalcanzables; **(d)** con el foco en un campo del panel, Supr no borra y Retroceso **borra la etiqueta** del nodo seleccionado. §5. |
| 4 | ¿Qué operación las «despierta»? | Depende del mecanismo. **(a)** se despierta con cualquier cosa que cambie la selección, y «mover otra pieza» la cambia: es el único caso en que mover otra pieza despierta (DEMOSTRADO, M08c/T3). **(b)** se despierta agarrando unos píxeles más adentro (es posicional). **(c)** solo con «Enviar al fondo» del contenedor. **(d)** con clic en vacío, cambiar de página, marco de selección o seleccionar algo cuyo panel oculte ese campo; **mover otra pieza no la despierta** (DEMOSTRADO, §5.3). |
| 5 | ¿Misma causa? | **En parte.** El Bug 1, el mecanismo (c) y la variante «con contenedor» de (b) comparten raíz: el acierto trata cada nodo como un rectángulo macizo con prioridad sobre las conexiones, y no distingue un contenedor de una hoja. Los mecanismos (a) y (d) son independientes del contenedor, y se reproducen igual sin GCP. |
| 6 | Cambio mínimo y seguro | **P1**: un resolutor único `hitTarget` con el orden hoja → conexión → contenedor, usado por el clic, el hover, el doble clic, el toque y la colocación de Historias. **P2**: el puerto se decide al primer movimiento real, como `routePending` de 018.25, de modo que un clic nunca crea una conexión. **P3**: un `pointerdown` en el lienzo suelta el foco de los campos del panel, y `closeEditBox` hace `blur`. Sin cambios de formato, kernel ni MCP. El mecanismo (a) queda como decisión (D4). §8. |
| 7 | Tests | En vm, el orden de `hitTarget` (hoja/conexión/contenedor/anidado/Z invertido). En navegador, la tabla de §4 con clics reales, 0 conexiones espurias por clic, la trampa de foco y una rejilla de no regresión sin contenedores. Mutaciones que devuelvan el orden de hoy o creen una conexión con un clic. §10. |

---

## 1. Reproducción y fixture mínimo

### 1.1 Fixture (coordenadas de mundo; zoom 1, vista en (40,40))

| id | nodo | centro | tamaño |
|---|---|---|---|
| 1 | GCP (`rect`, borde discontinuo, relleno por defecto = tinte translúcido) | (500, 350) | 640 × 420 |
| 2 | A | (330, 300) | 120 × 60 |
| 3 | B | (670, 300) | 120 × 60 |
| 4 | C | (500, 470) | 120 × 60 |
| 5 | X (fuera) | (40, 300) | 100 × 60 |
| 6 | Y (fuera) | (960, 300) | 100 × 60 |

Conexiones rectas: A→B (10), B→C (11), A→C (12), X→A (13), B→Y (14). El orden de `page.nodes` es `[GCP, A, B, C, X, Y]`: GCP primero, como cuando se dibuja la caja antes que los servicios.

### 1.2 Pasos

1. Cargar el fixture y hacer clic en la mitad de A→B, en (500, 300).
2. Resultado: queda seleccionado **GCP** y empieza `drag[GCP]`. La conexión no se selecciona.
3. Clic sobre A→B a 25 px del borde de A, en (415, 300).
4. Resultado: se crea una **conexión nueva A→GCP**, que queda seleccionada y apila una entrada de Undo. La flecha tampoco se selecciona.

**Frecuencia: 100 %.** Es determinista en los 7 fixtures con contenedor y en todos los puntos interiores probados (§3.1). Con estrés aleatorio, seleccionar una conexión falla 68 de 83 veces (§6).

---

## 2. Pipeline de acierto (fase 2)

### 2.1 Orden real del `pointerdown` (`js/interaction.js:394-580`)

0. **Salidas tempranas:** colocación de Historia (`scCanvasPlacementPointer`), `scDrag`, pellizco, Present, Playback, botón central/derecho/Alt (pan), herramienta armada (`pendingShape`…), «Conectar» táctil (`touchLink`) y modo `connect`.
1. **Esquinas del nodo seleccionado** (solo si hay un único nodo seleccionado). `hitCorner`, r = 10 u con ratón (`:76-84`).
2. **Instrumentos de la conexión seleccionada** (solo si hay una única conexión seleccionada): extremo `hitEdgeEnd` (r = max(9, 7/zoom)), codo `hitWaypoint` y tramo `hitSegment`. Se anotan como `endDrag` o `routePending`.
3. **Puerto de conectar** del `hoverNode`: `hitSideArrow` (centro a 18 px de pantalla fuera del lado, acierto 11 px). Arranca `connectDrag`.
4. **Nodo:** `hitNode`, que recorre `page.nodes` **de arriba abajo** (último → primero) y gana el primero cuya **caja +4 u** contenga el punto. Selecciona y arrastra.
5. **Conexión:** `hitEdge`, la distancia a la polilínea `edgePoints` < max(8, 6/zoom) u, de la última a la primera.
6. **Vacío:** marco de selección (ratón) o pan (dedo).

### 2.2 Las 12 preguntas

| # | Pregunta | Respuesta (evidencia) |
|---|---|---|
| 1 | Objetos que participan | Instrumentos de la selección (esquinas, extremos, codos, tramos), el puerto del nodo bajo el ratón, los nodos (todos, incluido el contenedor) y las conexiones. |
| 2 | Orden | El de §2.1. Traza real con un clic en la mitad de A→B dentro de GCP: `hitNode=GCP → (fin)`. `hitEdge` **no se llama** (§3.1). |
| 3 | Geometría | Nodo: rectángulo `|x−cx| ≤ w/2+4 ∧ |y−cy| ≤ h/2+4` para **todas** las formas (círculo, rombo, texto, cilindro, icono). No mira `fill:"none"` ni la forma. Conexión: distancia al segmento sobre `edgePoints` (la ruta pintada, con carriles). Puerto, extremos y codos: círculos. Tramo: banda de ±`SEG_GRIP`. |
| 4 | Quién gana si se solapan | Instrumentos > puerto > **nodo** > conexión. Entre nodos, el de más arriba en `page.nodes`. Entre conexiones, la última. |
| 5 | ¿El contenedor se prueba antes que las conexiones? | **Sí**, porque es un nodo: el paso 4 va antes que el 5. |
| 6 | ¿Captura clics destinados a sus hijos? | Las **conexiones** entre hijos: siempre (100 %). Los **nodos** hijos: solo si el contenedor está por encima de ellos en Z (§5, mecanismo c). Entonces captura 9/9 puntos de muestra de cada hijo. |
| 7 | Propagación de eventos | No hay objetos DOM por diagrama: un único `pointerdown` en `cv` decide todo. Un barrido con `elementFromPoint` sobre todo el lienzo (cada 10 px) no encuentra **ningún elemento** encima del canvas, con o sin selección. La única excepción es `#editBox` mientras se edita una etiqueta. El teclado escucha en `document`, y `#editBox` corta la propagación de sus teclas. |
| 8 | Pointer capture | Sí, `cv.setPointerCapture` en cada `pointerdown` (`:441`), y se suelta sola en `pointerup`. No hay manejador de `lostpointercapture`. En ninguna prueba quedó un gesto colgado entre clics (`drag`, `connectDrag`, `endDrag`, `routePending`, `marquee` a `null` tras cada `pointerup`). |
| 9 | ¿Z visual ≠ Z de acierto? | **No.** Se pintan primero todas las conexiones (`render.js:1181`) y luego los nodos en el orden de `page.nodes` (`:1183`, decisión 101: «las conexiones se dibujan siempre debajo de todos los nodos»). El acierto sigue ese orden. La discrepancia es **perceptiva**: el relleno por defecto es un tinte con α ≈ 0,16-0,18, o `none`, así que la conexión que está *debajo* de GCP se ve. Con un relleno opaco (`fill:"#ffffff"`) la conexión interna **desaparece** (captura de §3.4). La piel 2.5D pinta con otro orden (`skinPaintOrder`), pero solo en Present y en la exportación, donde no se edita. |
| 10 | Índice o caché espacial | **Ninguno.** `edgePoints` se recalcula en cada llamada. La única caché es por fotograma, en `drawFlowBalls`. `edgeLabelPos` se congela durante `endDrag`/`segDrag`, y se descongela en todas las salidas (`pointerup`, Escape, `cancelGestures`). No hay geometría de acierto que pueda quedar *stale*. |
| 11 | ¿Conexiones antes o después de nodos? | **Después.** |
| 12 | ¿La caja del contenedor cubre su interior? | **Sí.** `hitNode` es un test de rectángulo macizo, también con `fill:"none"` (fixture F3n, §3.1). |

### 2.3 Otros consumidores con el mismo orden nodo → conexión

| Dónde | Qué pasa dentro de un contenedor | Estado |
|---|---|---|
| Doble clic para editar texto (`openEditorAt`, `interaction.js:922`: `hitNode ‖ hitEdge`) | El doble clic sobre A→B **edita la etiqueta de GCP**. Sin GCP edita la de la conexión. | **DEMOSTRADO** |
| Historias, soltar un evento FLOW sobre una conexión (`scFindDropTargets`, `editor-scenarios.js:2565`: `if (hitNode) return []`; `scResolveDrop` `:2659`) | Sin destino: `[]`. Sin GCP: `[10]`. *La prueba sustituye solo `eventTypeById` para tener un tipo FLOW; la decisión de acierto es la del producto.* | **DEMOSTRADO** |
| Toque (`handleTouchTap` `:835`), hoja móvil (`ui.js:1334`) | Solo deciden «¿hay algo?», así que el orden no cambia el resultado. | — |
| Soltar una conexión, un extremo o «Conectar» táctil (`:722`, `:752`, `touchLink`) | El destino es `hitNode`. Con el contenedor encima en Z, soltar sobre un hijo conecta con el contenedor. | HIPÓTESIS (mismo `hitNode` de §5c) |

---

## 3. Evidencia de la fase 1 y la fase 7 (clics reales)

### 3.1 Tabla de ganadores

Leyenda: «traza» = las funciones de acierto que devolvieron algo, en orden, durante el `pointerdown` real. «sel» = la selección tras soltar.

| Punto (mundo) | F1 A→B sin GCP | F2 GCP+A,B sin conexiones | F3 GCP+A→B | F3′ GCP creado después | F3n GCP `fill:none` | F4 +B→C, A→C | F5 Región⊃GCP⊃A→B | F6 +X→A, B→Y |
|---|---|---|---|---|---|---|---|---|
| Mitad A→B (500,300) | `hitEdge` → **conexión A→B** | GCP | `hitNode=GCP` → **GCP** | GCP | GCP | GCP | GCP | GCP |
| A→B a 60 px de B (550,300) | conexión | GCP | GCP | GCP | GCP | GCP | GCP | GCP |
| A→B a 25 px de A (415,300) | puerto de A → `connectDrag`, sel ∅ | `connectDrag` → **crea A→GCP** | **crea A→GCP** | **crea A→GCP** | **crea A→GCP** | **crea A→GCP** | **crea A→GCP** | **crea A→GCP** |
| A→B a 8 px de A (398,300) | `connectDrag`, sel ∅ | crea A→GCP | crea A→GCP | crea A→GCP | crea A→GCP | crea A→GCP | crea A→GCP | crea A→GCP |
| Centro de A | A | A | A | **GCP** | A | A | A | A |
| Vacío dentro de GCP (500,200) | marco | GCP | GCP | GCP | GCP | GCP | GCP | GCP |
| Borde de GCP (500,140) | marco | GCP | GCP | GCP | GCP | GCP | GCP | GCP |
| Fuera de todo (500,60) | marco | marco | marco | marco | marco | marco | puerto N de Región | marco |
| B→C / A→C (diagonales) | — | — | — | — | — | **GCP** / **GCP** | — | — |
| X→A, tramo dentro de GCP (220,300) | — | — | — | — | — | — | — | **GCP** |
| X→A, tramo fuera (140,300) | — | — | — | — | — | — | — | conexión X→A |
| B→Y, tramo fuera (860,300) | — | — | — | — | — | — | — | conexión B→Y |

En el anidado (F5), el ganador del interior de GCP es **GCP** y no Región, porque GCP está más arriba en Z. Con Región por encima, ganaría Región.

### 3.2 Conclusión de la comparación (fase 7)

- **Sin contenedor (F1)**, la conexión se selecciona en toda su longitud salvo en los ~29 px junto a cada extremo, donde el puerto del nodo gana. Allí un clic no hace nada, porque al soltar no hay nodo debajo.
- **Con contenedor (F2–F6)**, todo punto de la conexión que caiga dentro del contenedor pierde: en el tramo central gana el contenedor, y junto a los extremos el clic **crea una conexión espuria** hacia el contenedor, porque al soltar `hitNode` encuentra el contenedor bajo el puerto (`pointerup`, `:721-733`).
- El contenedor es la **condición causal** del Bug 1. Sin él, la misma conexión en el mismo sitio se selecciona.

### 3.3 Captura del fixture F4 (no versionada; tomada en la sesión)

Las conexiones internas se ven *a través* del tinte de GCP: están pintadas debajo, pero el tinte es translúcido. El rótulo «GCP», centrado y autoescalado, queda encima de la zona de las conexiones.

### 3.4 Relleno opaco

Con `fill:"#ffffff"` en GCP, la conexión A→B **no se ve**, porque queda tapada por GCP. Es coherente con el orden de pintado y con el acierto, y muestra que hoy el «contenedor» solo funciona visualmente porque su relleno es translúcido. No es parte de este bug, pero es un hallazgo colateral (D6).

---

## 4. Semántica correcta (fase 3)

### 4.1 Regla propuesta: «lo concreto antes que el fondo»

1. **Instrumentos de la selección actual** (esquinas, extremos, codos, tramos). Sin cambios: son marcas visibles y explícitas (decisión 144).
2. **Puerto de conectar**: solo si el gesto **se convierte en arrastre** (umbral de movimiento, como `routePending` de 018.25). Un clic sin movimiento sobre la zona del puerto cae a los pasos 3–5.
3. **Nodo hoja**: un nodo que no contiene el centro de ningún otro nodo más pequeño. Gana el de más arriba en Z.
4. **Conexión.**
5. **Contenedor**: un nodo que contiene el centro de al menos otro nodo más pequeño. Gana el **más interior**, el de menor área; si empatan, el de más arriba en Z.
6. **Vacío**: marco de selección o pan.

«Contenedor» es **geométrico y se calcula en cada acierto**, en O(n²) con n nodos de la página. No es un dato del documento, no tiene caché y no puede quedarse *stale*. No cambia el formato, el modelo, el MCP ni el orden de pintado.

### 4.2 Casos A–H (resultado de un **clic**; «hoy» medido con clic real, «propuesta» con el prototipo en seco de §4.3)

| Caso | Hoy (clic real) | Propuesta |
|---|---|---|
| **A** conexión dentro de GCP (mitad de A→B) | GCP | **conexión A→B** |
| A′ la misma, a 20 px de A (zona del puerto) | **crea A→GCP** | **conexión A→B** (sin crear nada) |
| **B** nodo dentro de GCP | A | A |
| B′ nodo dentro de GCP, con GCP creado después (encima en Z) | **GCP** | **A** |
| **C** vacío dentro de GCP | GCP | GCP |
| **D** borde de GCP | GCP | GCP |
| **E** GCP sin nada debajo (caja vacía) | GCP | GCP |
| **F** conexión X→Y que cruza GCP (GCP tiene hijos, pero no en ese punto) | GCP | **conexión X→Y** |
| F′ conexión que cruza una caja **sin** hijos | Caja | Caja (es una hoja: igual que hoy) |
| **G** conexión entre dos hijos (B→C, diagonal) | GCP | **conexión B→C** |
| **H** interna↔externa X→A, tramo dentro de GCP | GCP | **conexión X→A** |
| H′ el mismo, tramo fuera de GCP | conexión X→A | conexión X→A |
| Anidado: vacío de GCP dentro de Región | GCP | GCP (el más interior) |
| Anidado: vacío de Región fuera de GCP | Región | Región |
| Anidado: conexión A→B | GCP | **conexión A→B** |

F′ es el único caso discutible: una caja sin hijos es una hoja y sigue ganando a la conexión que la cruza, igual que hoy y que una caja con relleno opaco. Si se quiere que también ceda, la vía es D5 (`fill:"none"` transparente al clic), no cambiar la definición de contenedor.

### 4.3 Prototipo en seco e impacto en documentos reales

La regla se probó **en seco**: una función inyectada en la página (fuera del repo) aplica §4.1 con las funciones de acierto del producto y no muta nada. La tabla de §4.2 sale de ahí, y la columna «hoy» se confirmó además con un clic real en cada caso.

**Impacto en documentos reales.** Para cada página de los 8 ejemplos públicos (`ejemplos/data/*`) y de 3 fixtures del repo, se toma una rejilla cada 8 u sobre los límites del dibujo, a zoom 1, con el ratón llegando por `pointermove`. En cada punto se compara el resultado del clic hoy y con la propuesta (P1 + P2):

| Documento | Puntos | Contenedores detectados | Puntos que cambian | De qué a qué |
|---|---|---|---|---|
| arquitectura-serverless-aws | 20 384 | 0 | 208 | puerto: «nada» → vacío 84 / nodo 78 / conexión 22; **«crea conexión» → nodo 24** |
| cadena-de-suministro | 23 377 | 0 | 240 | puerto: «nada» → vacío 157 / conexión 83 |
| funnel-de-ventas | 21 528 | 0 | 178 | puerto: «nada» → vacío 110 / nodo 12 / conexión 56 |
| kafka-event-pipeline | 15 960 | 0 | 188 | puerto: «nada» → vacío 102 / nodo 82 / conexión 4 |
| microservicios-api-gateway | 18 312 | 0 | 224 | puerto: «nada» → vacío 116 / nodo 88 / conexión 20 |
| oauth2-flujo-autenticacion | 15 792 | 0 | 170 | puerto: «nada» → vacío 103 / nodo 40 / conexión 27 |
| onboarding-de-cliente | 22 705 | 0 | 214 | puerto: «nada» → vacío 135 / nodo 12 / conexión 67 |
| pipeline-etl-datos | 18 786 | 0 | 218 | puerto: «nada» → vacío 111 / nodo 74 / conexión 33 |
| fixture 017-1 qa-complejo (p0 / p1) | 4 536 / 1 349 | 0 | 95 / 46 | puerto: «nada» → vacío / conexión |
| fixture 019-2 skin | 15 158 | 0 | 236 | puerto: «nada» → vacío 186 / conexión 39 / nodo 11 |
| fixture 017-1 cliente-kafka-comercio | 2 147 | 0 | 69 | puerto: «nada» → vacío 49 / conexión 20 |

Lecturas:
- **P1 (hoja → conexión → contenedor) no cambia ni un punto** en estos documentos, porque ninguno tiene contenedores. El cambio de orden solo actúa donde hay cajas que contienen nodos.
- **Todas las diferencias vienen de P2** (el puerto diferido) y son clics en la zona de un puerto (≈1 % de los puntos). Hoy un clic ahí **no hace nada** (no selecciona ni deselecciona) o, en el ejemplo serverless, **crea una conexión espuria** (24 puntos, sin contenedor). Con P2, un clic ahí hace lo que haría sin puerto: seleccionar lo que hay debajo o vaciar la selección. Arrastrar desde el puerto sigue conectando.

### 4.4 Alternativas consideradas

| Alternativa | Por qué no (o no sola) |
|---|---|
| **Conexiones antes que todos los nodos** (invertir los pasos 4 y 5) | Es lo más simple, pero una conexión que pasa *por debajo* de un nodo hoja ajeno le robaría el clic en una banda de 12 px, aunque ese nodo se pinte encima (incoherente con el pintado y con nodos opacos: imagen, icono, código). Además, la tolerancia de 6 px junto al ancla invadiría el borde del propio nodo extremo. Habría que excluir los extremos y los nodos opacos, y eso acaba siendo una regla más complicada que la propuesta. |
| **Acierto «honesto con el pintado»** (estilo Excalidraw: un nodo sin relleno solo se acierta por su trazo) | No arregla el caso por defecto, porque el relleno por defecto es un tinte, no `none`. Y cambia el comportamiento de todos los nodos sin relleno (textos, títulos). Puede complementar a la propuesta (D5), pero no sustituirla. |
| **Modelo explícito de contenedor** (`parentId`, tipo «zona») | Cambio de formato, kernel y MCP. Desproporcionado para un bug de acierto. Se deja para cuando el producto quiera agrupar de verdad (mover hijos con el padre, etc.). |
| **Mandar el contenedor al fondo automáticamente** | Muta el orden del documento sin que el usuario lo pida, y no arregla el Bug 1, porque las conexiones siguen debajo de todos los nodos. |
| **Pintar las conexiones por encima de los contenedores** | Arreglaría también §3.4 (conexión tapada por un relleno opaco), pero toca `render`, exportaciones y la paridad del SVG con el MCP. Es una decisión visual aparte (D6), no el arreglo del acierto. |
| **Contenedor solo por su borde o su rótulo** (como un *frame*: clic en el vacío interior = marco de selección) | Más coherente con las herramientas de diseño, pero cambia cómo se mueve hoy cualquier caja grande y es menos descubrible. Queda como D3. La propuesta mantiene C: vacío dentro → contenedor. |

---

## 5. Bug 2 — piezas «bloqueadas» (fase 4 y fase 5)

### 5.1 Mecanismos

| | Mecanismo | Estado | Dónde | ¿Depende del contenedor? | ¿Qué lo despierta? |
|---|---|---|---|---|---|
| **a** | Con **una conexión seleccionada**, su extremo (círculo r = max(9, 7/zoom) u sobre el borde del nodo) gana al nodo: agarrar el nodo junto a donde sale o entra esa conexión inicia `endDrag` y el nodo no se mueve. Cada reintento falla igual. Ocurre justo después de **crear una conexión**, porque la nueva queda seleccionada. | **DEMOSTRADO** (T3, M08c: «FALLA(endDrag)» dos veces seguidas; el documento no cambia, Undo = 0) | `interaction.js:497-518` (paso 2) | No | **Cambiar la selección.** Mover otra pieza la cambia, y A vuelve a moverse (T3: «tras mover otra pieza (Z) → drag[A], movA 0,60»). Es el único mecanismo que «mover otra pieza» despierta. |
| **b** | El **puerto de un vecino** gana al nodo bajo el cursor (`hoverNode = hitSideArrowHost ‖ hitNode`, `:667`). Con un hueco de 20 px entre A y B, la franja oeste de B (unos 9 px) es el puerto de A. Un **clic** ahí **crea A→B**; un arrastre crea A→(lo que haya al soltar). Dentro de un contenedor, el puerto de cualquier hijo cae sobre el contenedor, y un clic crea hijo→contenedor. | **DEMOSTRADO** (T5: clic → conexión 200 A→B creada; F2–F6: A→GCP) | `:520-525`, `:721-733` | Lo agrava: sin contenedor, un clic en un puerto sobre el vacío no crea nada | Agarrar unos px más adentro (es posicional). |
| **c** | **Orden Z invertido**: si el contenedor está por encima de sus hijos (se dibujó la caja *después* de los servicios, se duplicó con Ctrl+D o se trajo al frente), `hitNode` devuelve el contenedor en todo el interior de los hijos (9/9 puntos de muestra en A, B y C). El hijo no se puede seleccionar, mover ni borrar con el ratón, y arrastrarlo mueve el contenedor. | **DEMOSTRADO** (F3′, T6, M17) | `:15-22` | **Sí** (misma raíz que el Bug 1) | Solo «Enviar al fondo» del contenedor o «Traer al frente» de los hijos. Mover otra pieza **no** lo despierta. |
| **d** | **Foco atrapado en un campo del panel** (`#lblEdit`, `#fsIn`…). El `pointerdown` del lienzo hace `preventDefault` (`:437`), así que el foco **no sale** del campo. El atajo de teclado ignora las teclas cuyo destino es `INPUT`/`TEXTAREA` (`:978`). Resultado: **Supr no borra** y **Retroceso borra la etiqueta** del nodo recién seleccionado («B» → «»), porque `#lblEdit` ya muestra la etiqueta del nuevo nodo. | **DEMOSTRADO** (T2, focusrec, M19, estrés) | `:437`, `:978` | No | **Clic en vacío**, cambiar de página, marco de selección o seleccionar algo cuyo panel oculte ese campo (una conexión oculta `#fsIn` pero no `#lblEdit`). **Mover otra pieza, Ctrl+Z, zoom o redibujar no** lo despiertan (§5.3). |
| e | **`#editBox` oculto con foco** tras cerrar la edición en el lienzo. `closeEditBox` hace `display:none` sin `blur` (`:937`), y el foco sigue en el textarea oculto hasta que Chrome aplica su «focus fixup» en el siguiente fotograma. | **NO REPRODUCIDO en uso humano**: Supr pulsado en el mismo fotograma, 10/10 ignorado; con ≥ 30 ms, 0/10 | `:937` | No | Se resuelve solo en < 1 fotograma en Chrome. En otros navegadores, HIPÓTESIS (no medido). |
| f | **Esquinas del nodo seleccionado** (r = 10 u): con GCP seleccionado, ¿agarrar un hijo junto a una esquina de GCP lo redimensiona? | **NO REPRODUCIDO** y descartado por geometría (§5.4): el tirador está 6 u por fuera y solo invade ≈1 u del interior | `:483-495` | — | — |
| g | **`hoverNode` stale** tras zoom o pan con la rueda sin mover el ratón: no se recalcula, porque la rueda no emite `pointermove`. | DEMOSTRADO que queda stale; **sin efecto observable** (T7: el clic posterior hizo lo correcto) | `:667` | No | El siguiente `pointermove`. |

**Descartados con evidencia:** gestos colgados por pérdida de pointer capture (no se observó ninguno tras cada `pointerup`); overlays DOM sobre el lienzo (barrido vacío); geometría o índices *stale* (no existen, §2.2-10); selección con ids muertos (`refreshPanel` los poda); Undo/Redo, cambio de página, zoom, crear o borrar piezas (M10–M16: todo OK).

### 5.2 Matriz de operaciones (fase 4)

Cada fila parte del fixture de §1 recién cargado y se hace con gestos reales. «Bloqueos» = puntos de muestra (centro, 4 bordes a 5 px, 4 esquinas a 6 px) de cada nodo cuyo `pointerdown` **no** arrastraría ese nodo. Los calcula un clasificador en seco que replica los pasos 1–6 con las funciones del producto, y que coincide **100/100** con clics reales.

| # | Secuencia | Resultado | Bloqueos tras la secuencia |
|---|---|---|---|
| M01 | seleccionar A → mover A | OK | — |
| M02 | seleccionar A → Supr | OK | — |
| M03 | seleccionar A → clic vacío → mover A | OK | — |
| M04 | mover A → mover B | OK | — |
| M05 | mover A → mover GCP (desde su vacío) | OK (solo GCP; los hijos no lo acompañan, porque no hay agrupación) | — |
| M06 | mover GCP → mover A | OK | — |
| M07 | mover A → Supr | OK | — |
| M08 | seleccionar conexión X→A → seleccionar A → mover | OK | — |
| M08b | seleccionar X→A → mover A desde el centro | OK | — |
| **M08c** | seleccionar X→A → agarrar A junto a su extremo | **FALLA (endDrag)** | A 1/9 (borde O), X 1/9 (borde E) |
| M09 | seleccionar GCP → seleccionar A → mover | OK | — |
| M10 | borrar C → seleccionar B → mover | OK | — |
| M11 | mover A → Ctrl+Z → Ctrl+Y → mover A | OK | — |
| M11b | mover A → Ctrl+Z → mover A | OK | — |
| M12 | zoom Ctrl+rueda → mover A | OK. *El arnés marcó «FALLA» porque medía el desplazamiento en px de pantalla con zoom ≠ 1; el gesto fue `drag[A]`, correcto.* | — |
| M13 | página 2 → página 1 → mover A | OK | — |
| M14 | seleccionar/deseleccionar ×10 → mover A | OK | — |
| M15 | crear conexión A→C (puerto S) → mover C | OK (la nueva queda seleccionada) | — |
| M15b | crear conexión A→C → mover A | OK con agarre a 3 px de su borde S. El extremo de la nueva no estaba ahí (carril desplazado), así que no hubo bloqueo en ese punto | — |
| M16 | crear nodo desde el rail → mover B | OK | — |
| **M17** | Ctrl+D sobre GCP → mover A | **FALLA**: arrastra la copia de GCP | **A, B, C 9/9** (la copia de GCP los cubre) |
| **M18** | editar etiqueta (doble clic) → clic en B → Supr inmediato | **FALLA** (mecanismo e, carrera de < 1 fotograma) | — |
| **M19** | cambiar el tamaño de fuente en el panel → clic en B → Supr | **FALLA** (foco en `#fsIn`) | — |

### 5.3 ¿Qué despierta la trampa de foco (d)? (Supr y Retroceso sobre B tras cada recuperación)

| Recuperación | `#fsIn` (tras escribir) | `#fsIn` (solo clic) | `#lblEdit` |
|---|---|---|---|
| nada | sigue | sigue | sigue (Retroceso: «B» → «») |
| mover el mismo nodo | sigue | sigue | sigue |
| mover otra pieza interna | sigue | sigue | sigue |
| mover una pieza externa | sigue | sigue | sigue |
| mover GCP | sigue | sigue | sigue |
| **clic en vacío** | **OK** | **OK** | **OK** |
| seleccionar una conexión | **OK** | **OK** | sigue (`#lblEdit` también está en el panel de conexión) |
| Ctrl+Z | sigue | sigue | sigue (y es el Deshacer **nativo del textarea**) |
| zoom | sigue | sigue | sigue |
| **cambiar de página y volver** | **OK** | **OK** | **OK** |
| **marco de selección en vacío** | **OK** | **OK** | **OK** |

La trampa se libera cuando el campo enfocado **se oculta**: `refreshPanel` oculta `#selBody` sin selección, y Chrome mueve el foco a `body`. No hay ningún `blur` explícito.

### 5.4 Esquinas del nodo seleccionado (f)

**NO REPRODUCIDO, y descartado por geometría.** Los tiradores están en `nodeCorners`, **6 u por fuera** de la caja (`render.js:129-132`), con radio 10 u. Dentro de la caja del contenedor solo alcanzan ≈1 u en diagonal (√2·(6+d) < 10 ⇒ d < 1,07). Prueba dirigida: GCP seleccionado, hijo A pegado a la esquina NO de GCP y arrastre a 5 u del borde de A, junto a la esquina. Resultado: `drag[A]`, A se mueve y GCP no cambia de tamaño. La fracción del área de A bajo el tirador de GCP es 0,00 %. (El reintento de esa prueba dio `resize[A]`, pero era el tirador **del propio A**, que ya estaba seleccionado: comportamiento correcto.)

### 5.5 ¿«Mover otra pieza» reconstruye algún estado stale?

**No.** No hay caché de geometría, índice espacial ni Z derivado que invalidar (§2.2, filas 9 y 10). Lo único que cambia al mover otra pieza es la **selección**: `selectOnly("node", otra)` en el paso 4 de `pointerdown`. Esa selección retira los instrumentos de la conexión seleccionada antes, que eran los que ganaban el acierto (mecanismo a). Es una prioridad **dependiente de la selección**, no un estado *stale*. La operación exacta que «despierta» es `selectOnly`/`clearSel` → `singleSel()` ya no es la conexión, y el paso 2 deja de ejecutarse (`interaction.js:497`).

---

## 6. Estrés (fase 6)

Arnés fuera del repo. Semilla fija 12345. 400 intenciones con gestos reales sobre fixtures aleatorios: 2-4 hijos, disposición «centrados», «borde», «esquinas» o «alineados-cerca», conexiones aleatorias internas (30 % ortogonales) y una externa X→hijo. Antes de cada intención se ejecuta una operación de fondo al azar: mover otra pieza, clic en vacío, seleccionar otro, zoom, redibujar, cambiar de página, deshacer y rehacer, crear y borrar, crear una conexión desde un puerto, editar en el panel (fuente o texto) o seleccionar una conexión. Cada intención fallida se reintenta **sin hacer nada**, y luego tras **una** recuperación al azar sobre **el mismo punto**. Solo cuentan los puntos visibles en el lienzo (`elementFromPoint === cv`).

### 6.1 Tasa de fallo por intención

| Intención | Con contenedor (GCP) | Sin contenedor |
|---|---|---|
| **Seleccionar una conexión** (clic en un punto al azar entre el 15 % y el 85 % de su ruta) | **68 / 83 fallan (82 %)**: gana GCP 50, puerto → `connectDrag` 11, otra conexión del mismo haz 5, una hoja por encima 2 | 14 / 82 fallan (17 %): puerto 7, otra conexión 4, una hoja por encima 3 |
| **Mover un nodo** (agarre en un punto al azar de su caja) | 3 / 248 (1,2 %): otro nodo encima 2, puerto de un vecino 1 | 2 / 252 (0,8 %): puerto de un vecino 1, otro nodo encima 1 |
| **Borrar un nodo** (clic en su centro, esperar 40 ms y pulsar Supr) | **20 / 69 (29 %)**, todos por foco en el panel (`#lblEdit` 11, `#fsIn` 9) | **27 / 66 (41 %)**, todos por foco en el panel (`#lblEdit` 17, `#fsIn` 10) |
| **Conexiones espurias creadas** (en todo el recorrido, incluidas las operaciones de fondo) | **37** | **1** |
| Errores de página | 0 | 0 |

La tasa de «borrar» depende de cuántas veces el arnés edita en el panel antes de intentarlo (≈ 2 de cada 12 operaciones de fondo). Lo que se mide es que **cada** vez que el foco queda en un campo del panel, Supr falla.

### 6.2 Persistencia y recuperación (mismo punto, misma intención)

- **Reintentar sin hacer nada** nunca arregla nada: 0 recuperaciones en las 4 familias (GCP, puerto, foco, Z). No son fallos al azar: son **estados**.
- **Conexión perdida contra GCP**: no se recupera con ninguna de las operaciones probadas (mover otra pieza 4, clic en vacío 8, seleccionar otro 5, zoom 9, redibujar 4, cambiar de página 7, deshacer y rehacer 5, crear y borrar 8: **0 recuperaciones**). Es estructural, no *stale*.
- **Puerto**: tampoco se recupera con operaciones ajenas (0/18: 11 con GCP y 7 sin él). Solo cambiando el punto.
- **Foco en el panel** (sumando las dos pasadas): se recupera **solo** con «clic en vacío» (3/3) o «cambiar de página y volver» (3/3), y en 1 de 10 con «seleccionar otro», cuando ese clic acabó seleccionando una conexión, cuyo panel oculta `#fsIn`. Con mover otra pieza (0/5), redibujar (0/9), zoom (0/4), deshacer y rehacer (0/8) o crear y borrar (0/5): **0**.
- El mecanismo **(a)** (extremo de la conexión seleccionada) **no apareció** en el estrés. Su zona es un círculo de 9 u en el borde del nodo, y en este arnés casi nunca hay una conexión seleccionada al intentar mover, porque las conexiones se seleccionan mal (fila 1). En uso real aparece justo después de **crear** una conexión (queda seleccionada). Está demostrado de forma determinista en T3/M08c.

### 6.3 Lectura

- El contenedor es la condición causal del Bug 1: la tasa de fallo al seleccionar una conexión pasa del 17 % al 82 %, y las conexiones espurias de 1 a 37.
- El «no se puede borrar» **no depende del contenedor**: se da con la misma frecuencia sin GCP, y siempre por foco en el panel.
- Mover nodos casi nunca falla (≈1 %) en los dos casos mientras el contenedor esté **debajo** en Z. El «no se puede mover» persistente es el orden Z invertido (mecanismo c, determinista: 9/9 puntos), y el transitorio es el (a).

---

## 7. Diagnóstico

### 7.1 Causa raíz del Bug 1 — **DEMOSTRADO**

`pointerdown` prueba los nodos (paso 4) antes que las conexiones (paso 5). `hitNode` acierta cualquier nodo por su rectángulo +4 u, sin noción de contenedor ni de relleno. Un contenedor es un nodo grande cuya caja cubre todas las conexiones entre sus hijos, así que las gana siempre. Junto a los extremos, el puerto del nodo extremo (paso 3) gana antes, y como al soltar debajo está el contenedor, un clic **crea una conexión** hijo→contenedor. El pintado es coherente con el acierto: las conexiones están debajo de los nodos. Lo que lo hace inesperado es que el relleno por defecto es translúcido y la conexión se ve.

### 7.2 Causas del Bug 2

No hay una causa única ni estado *stale*. Son cuatro prioridades deterministas que dependen de la posición, la selección, el orden Z o el foco (§5.1 a–d), y el estrés las mide (§6). La frase «después de mover otra pieza vuelve a funcionar» corresponde al mecanismo **(a)**: es el único que esa operación despierta, porque cambia la selección. El «no se puede borrar» corresponde al **(d)**, que no se despierta moviendo piezas sino con un clic en vacío. El «no responde» con el contenedor de por medio corresponde al **(c)**.

### 7.3 ¿Comparten causa?

- **Bug 1 ≡ Bug 2(c) ≡ Bug 2(b) dentro de un contenedor**: misma raíz (§7.1).
- **Bug 2(a) y 2(d)**: independientes del contenedor. Se reproducen igual en F1.

---

## 8. Cambio mínimo y seguro (propuesta; **no implementado**)

| | Cambio | Archivos | Arregla |
|---|---|---|---|
| **P1** | `hitTarget(x, y)` → `{kind:"node"|"edge", obj}` con el orden hoja → conexión → contenedor (más interior), y `hitNode` con hoja antes que contenedor. Se usa en: `pointerdown` (pasos 4–5), hover (`:667`), `openEditorAt` (`:922`), destinos de soltar conexión, extremo y «Conectar» táctil (`:722`, `:752`, `touchLink`), y en Historias (`scFindDropTargets`/`scResolveDrop`: «hay nodo → no hay conexión» pasa a ser «`hitTarget` es conexión»). `hitSideArrowHost` sigue el mismo criterio (el puerto de una hoja antes que el de un contenedor). | `js/interaction.js`, `js/editor-scenarios.js` | Bug 1, 2(c), doble clic, Historias |
| **P2** | Puerto **diferido**: `connectPending` como `routePending` (018.25). Se anota en `pointerdown`, empieza `connectDrag` al primer movimiento real (mismo umbral que `routeGestureMoves`) y, si se suelta sin moverse, **se resuelve como un clic normal** (pasos 3–6 de §4.1) y no crea nada. | `js/interaction.js` | Conexiones espurias (Bug 1 junto a los extremos, 2(b)) |
| **P3** | Al empezar un `pointerdown` en el lienzo, `blur()` del `document.activeElement` si es un `INPUT`, `TEXTAREA` o `SELECT` del panel. Su `change` se aplica antes del cambio de selección, así que va a la selección anterior, que es la correcta. Además, `closeEditBox` hace `editBox.blur()`. | `js/interaction.js` | 2(d), 2(e) |

**Fuera del mínimo (decisión del owner):** el mecanismo 2(a), los extremos de la conexión seleccionada por encima del cuerpo del nodo. Es la regla de la decisión 144 y un instrumento visible, ver D4.

> **Revisión 2.** P1 y P2 son el alcance **aprobado** (D1 + D2, §11.1), solo en el editor. P3 **no** está aprobado: depende de D7 (§11.2). El pintado (D6, §11.3) no forma parte de este slice.

**Impacto:** sin cambios de formato, modelo, kernel ni MCP; el acierto es solo del editor. Viewer y Present no editan (en Present el lienzo solo hace pan). Con piel 2.5D no cambia nada, porque el acierto ya usaba el orden del documento. **CACHE**: el slice que lo implemente sube `CACHE` al siguiente valor libre (toca `interaction.js` y `editor-scenarios.js`, que son servidos). Hoy no se cambia.

---

## 9. Riesgos

- **Nodos solapados que no son contenedores.** «Contenedor» se define por el **centro** de un nodo más pequeño dentro de otro. Una etiqueta de texto colocada sobre una caja convierte la caja en contenedor, que es lo deseable. Dos cajas del mismo tamaño solapadas no son contenedores entre sí (área igual), y el comportamiento es el de hoy. Un nodo que tapa a medias el centro de otro sí lo convierte en contenedor: es un caso límite que hay que cubrir con un test.
- **Una conexión que pasa por debajo de una hoja** sigue perdiendo, igual que hoy y en coherencia con el pintado. Solo los contenedores ceden ante las conexiones.
- **Coste:** O(n²) por acierto con n nodos de la página. Con ~100 nodos son unas 10⁴ comparaciones por `pointermove`, despreciable, pero hay que medirlo en el test de navegador con el ejemplo más grande.
- **Hover y cursor:** el hover y el `pointerdown` deben usar el **mismo** resolutor. Si no, el cursor «grab» y el puerto pintado contradirían el clic.
- **Mover el contenedor:** desde el vacío interior y desde el borde se sigue pudiendo (caso C). Un contenedor lleno de hijos y conexiones tiene menos superficie libre para agarrarlo, así que el borde y el rótulo se vuelven más importantes (D3).
- **P2** cambia el tacto de conectar: hay que moverse unos px antes de que aparezca la línea discontinua, igual que al deslizar un tramo desde 018.25. Con el dedo no hay puertos, así que no le afecta.
- **P3:** el `change` de un campo numérico se aplica al hacer `blur`. Hay que comprobar que el valor va a la selección **anterior** y que deja **una** entrada de Undo.
- **Incoherencia intermedia hasta D6 (aceptada):** el acierto ya es hoja → conexión → contenedor, pero el pintado sigue siendo «conexiones debajo de todos los nodos y nodos en orden del documento». Una hoja enviada **detrás** de su contenedor (o un contenedor traído al frente) se pinta debajo del contenedor y aun así **gana el clic**. Con el relleno por defecto (tinte translúcido) la hoja se sigue viendo; con un relleno opaco, se seleccionaría algo tapado. Lo mismo pasa con una conexión interna bajo un contenedor opaco. D6 (capas contenedor → conexiones → hojas) alinea pintado y acierto.

---

## 10. Tests

### 10.1 Unitarios (vm, `test/fluyo-019-hit-test.test.cjs`)

- `hitTarget` en los fixtures F1–F6 y en el anidado: la tabla de §4.2 completa, punto a punto.
- Orden Z invertido (contenedor último): el hijo gana en sus 9 puntos de muestra.
- Una conexión que cruza bajo una hoja ajena: gana la hoja. Una conexión que cruza una caja con hijos: gana la conexión.
- Definición de contenedor: un hijo con el centro dentro, un hijo solo tocando el borde, cajas iguales solapadas, un texto sobre una caja.
- Anidado: el vacío de GCP da GCP, el vacío de Región da Región, y gana el más interior aunque esté debajo en Z.

### 10.2 Navegador (Chrome real, `test/fluyo-019-hit-test-browser.cjs`)

- La tabla de §3.1 con clics reales: el resultado esperado es el de la propuesta, y **0 conexiones nuevas** tras cualquier clic sin movimiento.
- Arrastre desde el puerto de un hijo dentro de GCP hasta otro hijo: crea exactamente una conexión hijo→hijo y una entrada de Undo.
- Doble clic sobre una conexión interna: edita la conexión. Historias: soltar un evento FLOW sobre una conexión interna la toma como destino.
- Trampa de foco: `#fsIn` y `#lblEdit` → clic en un nodo → Supr borra, y Retroceso no toca la etiqueta.
- **No regresión sin contenedores:** en F1 y en los ejemplos sin contenedores detectados, el resultado del clic en una rejilla de puntos es idéntico al de HEAD, salvo los puntos de puerto (que pasan de «nada» a seleccionar lo que haya debajo).
- Rendimiento: el `pointermove` sobre el ejemplo más grande no supera el presupuesto de un fotograma.

### 10.3 Mutaciones (`test/fluyo-019-hit-test-mutations.cjs`)

- Devolver el orden nodo → conexión: debe fallar §10.2 (fila A).
- `connectDrag` inmediato (sin diferir): debe fallar «0 conexiones por clic».
- Quitar el `blur` de P3: debe fallar la trampa de foco.
- Contenedor = el más arriba en Z en lugar del más interior: debe fallar el anidado.

### 10.4 QA manual

1. Dibujar tres servicios, dibujar *después* una caja grande alrededor, conectar los servicios entre sí y con un nodo externo.
2. Hacer clic en cada conexión: centro, cerca del origen y cerca del destino. Debe seleccionarse la conexión, sin conexiones nuevas.
3. Mover cada servicio y la caja, por su vacío y por su borde.
4. Doble clic en una conexión interna: debe editarse su texto.
5. Historias: soltar un evento de flujo sobre una conexión interna.
6. Cambiar el tamaño de fuente en el panel, hacer clic en otro nodo y pulsar Supr: debe borrarse. Escribir en «Texto», hacer clic en otro nodo y pulsar Retroceso: debe borrarse el nodo, no su etiqueta.
7. Repetirlo con una caja dentro de otra, con zoom 0,5 y 2, y en táctil (sin puertos).

### 10.5 Casos de regresión

- Puerto de conectar con ratón, que sigue funcionando arrastrando (018.16), y «Conectar» táctil (018.12).
- Instrumentos de la conexión seleccionada (extremo, codo, tramo, anillo; 018.16 y 018.25) y sus radios en px de pantalla.
- Marco de selección en el vacío y Mayús+clic para sumar a la selección.
- Arrastre del grupo seleccionado. Undo diferido al primer movimiento (`drag.snap`).
- Orden Z: traer al frente y enviar al fondo siguen gobernando qué hoja gana entre hojas.
- Historias: colocación en nodo y en conexión, y el menú de candidatas cuando hay varias conexiones juntas.
- `sheetTapOutside` en móvil.

---

## 11. Decisiones (revisión 3: separadas por dominio, listas para aprobación)

Hay tres dominios que **no** son el mismo problema y no se arreglan con lo mismo:

- **Acierto** (`interaction.js`, `editor-scenarios.js`): qué objeto recibe un clic o un arrastre. D1, D2, D3, D4 y D5.
- **Foco** (`interaction.js`, teclado): a qué elemento DOM van las teclas después de hacer clic en el lienzo. D7.
- **Pintado** (`render.js`, `export.js`, `skin.js`): qué se ve encima de qué. D6.

Arreglar el acierto no cambia ni un píxel; arreglar el pintado no cambia qué se selecciona; y el foco no depende de ninguno de los dos. **Todo el alcance es solo del editor** (este repo). Ninguna decisión de esta sección toca fluyo-mcp.

### 11.0 Aprobadas

**D1 — APROBADA (owner, 18-10-2026).**
> La prioridad del acierto es **hoja → conexión → contenedor (el más interior)**:
> - una hoja gana cuando el clic cae realmente sobre ella;
> - una conexión gana cuando el clic cae sobre su tramo y no sobre una hoja;
> - el contenedor solo gana cuando debajo no hay ni una hoja ni una conexión válida.
>
> Un clic destinado a una conexión no puede acabar creando una conexión espuria a través del puerto de un nodo vecino.

Alcance: P1 de §8 y sus consumidores (clic, hover y cursor, doble clic, destinos al soltar, colocación de Historias). La definición geométrica de «contenedor» (`isContainerNode`) vivirá en `js/geometry.js`, fuera del kernel, para que D6 pueda reutilizarla sin duplicarla.

**D2 — APROBADA Y CONFIRMADA (owner, 18-10-2026).**
> D2 incluye el comportamiento del puerto de conectar, únicamente en el editor; no implica ningún cambio ni port en fluyo-mcp. El puerto se decide al primer movimiento real; un clic sin movimiento sobre la zona del puerto se resuelve con el orden de D1 y nunca crea una conexión.

Alcance: P2 de §8 (`connectPending`, análogo a `routePending` de 018.25), en `js/interaction.js`.

*Registro en `.ai/DECISIONS.md`:* las entradas numeradas (209…) se añaden en el commit del slice que implemente D1 y D2, como se hizo en 018.x y 019-FLOW-FADE.

---

### 11.1 D3 — Vacío dentro de un contenedor · dominio: ACIERTO

- **Texto exacto (opción A, recomendada):**
  > **D3.** Un clic o un arrastre en una zona de un contenedor donde no hay ninguna hoja ni ninguna conexión selecciona y arrastra el contenedor, como hoy. El marco de selección solo empieza en el vacío del lienzo, fuera de todo nodo. No se introduce un modo en el que el contenedor solo se agarre por su borde o su rótulo.
- **Problema que resuelve:** fija qué pasa en el único caso que D1 deja abierto (caso C de §4.2), para que la implementación de D1 no lo cambie por accidente.
- **Comportamiento actual:** el vacío interior de una caja la selecciona y arrastra. Hoy también lo hacen sus conexiones (Bug 1, resuelto por D1).
- **Comportamiento propuesto:** igual en el vacío. Medido con la regla de D1, la superficie de agarre del contenedor es el 87,5 % en F4 (3 hijos, 3 conexiones) y el 57 % en uno denso (12 hijos, 17 conexiones); las conexiones ocupan ~3 %.
- **Archivos:** ninguno nuevo. Lo cubre el `hitTarget` de D1 (`js/interaction.js`).
- **Fuera:** marco de selección dentro de un contenedor (opción B); mover los hijos junto con el contenedor (agrupación, modelo de contenedor).
- **Tests:** vm: el vacío de un contenedor da el contenedor, y en el anidado el más interior. Navegador: arrastrar desde el vacío de GCP lo mueve y los hijos quedan quietos (M05); el marco en el vacío del lienzo funciona, con y sin Mayús.
- **Riesgos:** ninguno de regresión, porque es el comportamiento de hoy. En un contenedor muy lleno, el borde y el rótulo siguen siendo agarrables.
- *Opción B (no recomendada):* el vacío interior hace marco y el contenedor solo se agarra por el borde o el rótulo. Cambia cómo se mueve hoy cualquier caja grande.

### 11.2 D4 — Extremo de la conexión seleccionada contra el cuerpo del nodo · dominio: ACIERTO (instrumentos de selección)

- **Texto exacto (opción A, recomendada):**
  > **D4.** Mientras una conexión está seleccionada, sus instrumentos (extremos, codos, tramos) siguen teniendo prioridad sobre el cuerpo de los nodos, como fija la decisión 144. Se fija con un test. Se revisará con uso real después de D1 y D7.
- **Problema que resuelve:** decide de forma explícita sobre el mecanismo (a), el único que «mover otra pieza» despierta, en lugar de dejarlo implícito.
- **Comportamiento actual:** con una conexión seleccionada (típicamente la recién creada), pulsar el nodo junto a su ancla inicia `endDrag` y el nodo no se mueve hasta que cambia la selección. La zona dentro del nodo es la mitad del círculo r = max(9, 7/zoom) u: ≈1,8 % de un nodo de 120 × 60 por extremo a zoom 1, y 4,3 % a zoom 0,5.
- **Comportamiento propuesto:** el mismo.
- **Archivos:** ninguno de producto. Solo un test.
- **Fuera:** opción B (extremo solo en su mitad exterior, `hitEdgeEnd` en `interaction.js:101-108`); opción C (tras crear una conexión, seleccionar el nodo de origen).
- **Tests:** navegador: conexión seleccionada → pulsar a 3 px del ancla dentro del nodo da `endDrag`; tras seleccionar otra pieza, la misma pulsación da `drag[nodo]`.
- **Riesgos:** el síntoma «no se mueve hasta que muevo otra pieza» **sigue** en esa franja. Si molesta con uso real, B es un cambio pequeño y localizado.

### 11.3 D5 — Nodos sin relleno y el clic en su interior · dominio: ACIERTO

- **Texto exacto (opción A, recomendada):**
  > **D5.** Un nodo con `fill:"none"` (y las formas sin relleno, como `text`) se sigue acertando por toda su caja +4 u, como hoy. El acierto no depende del relleno.
- **Problema que resuelve:** cierra la alternativa «estilo Excalidraw», que D1 ya hace innecesaria para los contenedores.
- **Comportamiento actual y propuesto:** el mismo. `hitNode` es un rectángulo macizo para toda forma y relleno.
- **Archivos:** ninguno.
- **Fuera:** acierto solo por el trazo en nodos sin relleno.
- **Tests:** vm: un nodo `fill:"none"` sin hijos se acierta en su centro; un texto se acierta en toda su caja.
- **Riesgos:** una caja **sin hijos** y sin relleno sigue ganando a una conexión que la cruce (caso F′). En los ejemplos hay 0 nodos de 75 con `fill:"none"`.
- *Opción B (no recomendada):* interior transparente al clic con `fill:"none"`. Cambiaría cómo se agarran los textos y cualquier nodo sin relleno.

### 11.4 D6 — Qué se pinta encima de qué dentro de un contenedor · dominio: PINTADO (orden Z visual)

D6 **no** es acierto. D1 decide qué recibe el clic; D6 decide qué se ve. Hoy los dos órdenes coinciden («conexiones debajo de todos los nodos», decisión 101), y por eso el Bug 1 era «coherente» con el pintado. Al aprobar D1, el acierto pasa a ser hoja → conexión → contenedor, pero el pintado sigue siendo conexión → (todos los nodos). D6 decide si el pintado sigue al acierto.

**Qué se pinta hoy en la capa «conexión»** (todo dentro de `drawEdge`, antes de cualquier nodo): la línea y la aguja, la etiqueta de la conexión, los puntos de flujo, los tokens de Historia, la funda de selección y los instrumentos (extremos, codos, tramos). Si un contenedor opaco la tapa, **todo eso** queda debajo.

**Problema que resuelve:**
- **D6a, lienzo plano:** con un relleno opaco elegido por el usuario, las conexiones internas no se ven (Δ píxel = 0).
- **D6b, piel «construido» (Present, Viewer y exportaciones con piel):** con el relleno **por defecto**, el frente con piel es opaco (`skin.js:121`), y el orden de pintor por `y` (`skin.js:150`) pinta el contenedor **después** de los hijos cuyo centro está por encima del suyo. En el fixture: B → A → GCP → C. En Present solo se ve C; A, B y todas las conexiones internas desaparecen.

**Semántica propuesta (texto exacto, opción B1, recomendada):**
> **D6.** Al pintar una página, el editor separa los nodos en dos capas con la misma definición de contenedor que D1 (un nodo que contiene el centro de otro nodo más pequeño) y pinta en este orden:
> 1. **Contenedores**, de fuera adentro (por área de mayor a menor; si empatan, el orden del documento).
> 2. **Conexiones**, completas: línea, aguja, etiqueta, puntos de flujo, tokens de Historia, funda de selección e instrumentos.
> 3. **Hojas**, en el orden del documento.
>
> Con la piel «construido», el orden de pintor (`skinPaintOrder`) se aplica **dentro** de cada capa, nunca entre capas. Sin contenedores en la página, el resultado es idéntico al de hoy.
>
> Se aplica al lienzo (editor, Present, Viewer, GIF/PNG/JPG) y al SVG que exporta el editor, en un slice propio posterior al de D1. fluyo-mcp no se toca: su SVG sigue con el orden de hoy hasta un port autorizado aparte, y esa divergencia queda documentada.

**Qué significa, caso por caso:**

| Caso | Hoy | Con D6 |
|---|---|---|
| Hijo dentro de un contenedor | Encima solo si está después en el documento (plano) o si su `y` es mayor que la del contenedor (piel) | **Siempre encima** de su contenedor |
| Conexión entre hijos | Debajo del contenedor (tapada si es opaco) | Encima del contenedor, debajo de las hojas |
| Conexión de un hijo hacia fuera, o de fuera que cruza un contenedor | Debajo del contenedor | Encima del contenedor |
| Conexión que pasa bajo una **hoja** ajena | Debajo de la hoja | **Igual** (debajo de la hoja) |
| Contenedor dentro de otro contenedor | Por orden del documento o por `y` | El interior siempre encima del exterior |
| Dos hojas solapadas | Orden del documento (o `y` con piel) | **Igual** |
| Orden Z del usuario entre un contenedor y sus hijos | Manda | **Deja de tener efecto visual** (como con D1 en el acierto) |
| Página sin contenedores | — | Píxel a píxel igual |

- **Comportamiento actual:** conexiones debajo de todos los nodos (`render.js:1181-1183` y rama de exportación `:1146-1148`; `export.js:394-400` en `buildSVGDocument`).
- **Comportamiento propuesto:** las tres capas de arriba. Lo que se ve encima es lo que D1 elige primero.
- **Archivos:**
  - `js/geometry.js`: reutiliza `isContainerNode` de D1 y añade una función pura que reparte los nodos de una página en las capas.
  - `js/render.js`: las dos ramas de `render()`.
  - `js/export.js`: `buildSVGDocument`.
  - `sw.js`: `CACHE`, en ese slice.
  - **No toca `js/skin.js`:** `skinPaintOrder` se llama por capa desde `render.js` y `export.js`, y así no rompe el port literal de la decisión 206.
- **Fuera:** fluyo-mcp (`svg.ts`, `skin.ts`, goldens); modelo de contenedor explícito y agrupación al mover; orden Z de las conexiones entre sí; cambiar el relleno por defecto o el frente opaco de la piel; el acierto (es D1).
- **Tests:**
  - **vm:** reparto en capas (anidado, hojas, contenedor sin hijos = hoja); `skinPaintOrder` aplicado por capa; sin contenedores, el orden es igual al de hoy.
  - **Navegador:**
    - con `fill` opaco, el píxel de la conexión interna es distinto del fondo del contenedor;
    - en Present con piel, A, B y A→B visibles (píxeles en sus cajas);
    - la funda de selección y los instrumentos de una conexión interna se ven;
    - los puntos de flujo y el token de Historia se ven sobre un contenedor opaco;
    - **no regresión:** los 8 ejemplos y los fixtures, píxel a píxel iguales a HEAD en el editor, en Present (plano y piel) y en el Viewer;
    - el SVG del editor es byte a byte igual en los fixtures compartidos (0 contenedores en los 21 fixtures).
  - **Mutación:** volver a «conexiones bajo todos los nodos» debe fallar.
- **Riesgos y regresiones:**
  1. **Divergencia con el MCP:** con contenedores, el SVG del editor y el de `export_diagram` difieren hasta el port. Los goldens compartidos no lo detectan porque no tienen contenedores; en el port hay que añadir uno.
  2. Una conexión que **cruza** una caja con hijos pasa a verse por encima de ella. Es el cambio visual buscado, pero es un cambio.
  3. Coste por fotograma: el reparto en capas es O(n²). Con decenas de nodos es despreciable, pero se mide; si hace falta, se calcula una vez por fotograma.
  4. El orden Z del usuario entre un contenedor y sus hijos deja de verse; «Traer al frente» sobre un contenedor ya no lo pone encima de sus hijos.
  5. Un nodo que tapa a medias el centro de otro lo convierte en contenedor: es el mismo caso límite que en D1, y tiene el mismo test.
- *Opción B1′ (alternativa):* capas **por contenedor**: cada conexión se pinta justo encima del contenedor más interior que contiene a sus dos extremos, y no encima de todos. Es más precisa con contenedores hermanos que se solapan, pero ya no coincide con el acierto de D1 (que pone toda conexión por encima de todo contenedor) y es más compleja.
- *Opción B2:* B1, pero implementada solo cuando se autorice también el port al MCP. Retrasa el arreglo de Present con piel.
- *Opción C:* solo contenedores antes que hojas en la piel. Los hijos vuelven a verse, pero las conexiones internas siguen tapadas.
- *Opción A:* no tocar el pintado. Present con piel sigue tapando a los hijos con el relleno por defecto.

### 11.5 D7 — Foco atrapado en los campos del panel · dominio: FOCO DEL DOCUMENTO (teclado)

D7 **no** es selección ni acierto. El clic en el lienzo llega bien y selecciona bien el nodo; lo que falla es **a qué elemento van las teclas que siguen**.

- **Texto exacto (opción A, recomendada):**
  > **D7.** Al empezar cualquier pulsación en el lienzo (ratón o dedo), el editor quita el foco del campo del panel que lo tenga (`input`, `textarea` o `select`) antes de cambiar la selección. Así, las teclas siguientes (Supr, Retroceso, atajos) van al lienzo y nunca editan en silencio el nuevo seleccionado. Cerrar la edición en el lienzo (`#editBox`) también quita su foco.
- **Problema que resuelve:** el mecanismo (d): «no se puede borrar» y la edición silenciosa del nuevo seleccionado.
- **Comportamiento actual:**
  - el `pointerdown` del lienzo hace `preventDefault()` (`interaction.js:437`), así que el foco **se queda** en el campo;
  - los atajos ignoran las teclas dirigidas a `INPUT` y `TEXTAREA` (`:978`);
  - el panel ya muestra el nuevo seleccionado.

  Medido:
  - `#lblEdit`: Supr ignorado; Retroceso **vacía la etiqueta** del nuevo;
  - `#fsIn`: Retroceso **borra su tamaño de fuente**;
  - `#boldChk`: Supr ignorado;
  - los `select` no atrapan.

  Solo se libera ocultando el campo (clic en vacío, cambio de página, marco). Ocurre igual con contenedor o sin él.
- **Comportamiento propuesto:** tras la primera pulsación en el lienzo, el foco queda en `body`; Supr borra y Retroceso no toca ningún campo. `#lblEdit` y `#fsIn` ya aplicaron su valor en `input` a la selección anterior. Los campos que aplican en `change` (color, casillas, `select`, orden) lo emiten al perder el foco, **antes** del cambio de selección, es decir, sobre la anterior.
- **Archivos:** `js/interaction.js`: inicio del `pointerdown`, antes de cualquier rama que cambie la selección (ratón y dedo), y `closeEditBox` (`editBox.blur()`).
- **Fuera:** la regla de los atajos (`:978`); quitar el `preventDefault()`; cambios en `ui.js` o en el panel; teclado en Present.
- **Tests:**
  - navegador, campo por campo (todo `input` o `textarea` visible del panel de nodo y del de conexión): foco → clic en otro nodo → `activeElement === body`; Supr borra; Retroceso no cambia ninguna propiedad;
  - un `change` pendiente (color personalizado, casilla) se aplica al nodo **anterior** con **una** entrada de Undo;
  - `#editBox`: escribir → clic en otro nodo → Supr en el mismo fotograma borra;
  - el mismo caso con el dedo;
  - mutación: sin `blur`, debe fallar.
- **Riesgos y regresiones:**
  1. Un `change` se emite al tocar el lienzo en vez de más tarde: mismo valor, mismo destino.
  2. Un `select` abierto se cierra al tocar el lienzo (lo esperado).
  3. La colocación de Historias con el dedo y el pellizco pasan por el mismo `pointerdown`, pero no usan foco.
  4. Accesibilidad: tras un clic en el lienzo el foco va a `body`, igual que con un clic en el vacío.
- *Opción B:* los atajos se ignoran solo si el campo es visible y del objeto seleccionado. No arregla Retroceso.
- *Opción C:* quitar el `preventDefault()`. Vuelven la selección de texto y el arrastre nativo sobre el lienzo.

### 11.6 Resumen para aprobar

| | Dominio | Recomendación | Toca producto | Slice |
|---|---|---|---|---|
| D1 | Acierto | aprobada | `interaction.js`, `editor-scenarios.js`, `geometry.js` | acierto (1º) |
| D2 | Acierto (puerto) | aprobada y confirmada | `interaction.js` | acierto (1º) |
| D3 | Acierto | A: como hoy | no (lo cubre D1) | acierto (solo tests) |
| D4 | Acierto (instrumentos) | A: como hoy, con test | no | acierto (solo tests) |
| D5 | Acierto | A: como hoy | no | acierto (solo tests) |
| D7 | Foco | A: `blur` al pulsar el lienzo | `interaction.js` | acierto (1º) o slice propio pequeño |
| D6 | Pintado | B1: capas, solo editor; MCP después | `render.js`, `export.js`, `geometry.js` (no `skin.js`) | pintado (2º), aparte |

Todas mantienen el alcance en el editor. `CACHE` sube en cada slice que se implemente; hoy no cambia.

---

## 12. Archivos implicados

- `js/interaction.js`: `hitNode` (15-22), `hitEdge` (28-41), `hitSideArrowHost` (65-68), `pointerdown` (394-580, pasos en 483, 497, 520, 527, 567), hover (667), `pointerup`/`connectDrag` (721-733), `endDrag` (752), `handleTouchTap` (835), `openEditorAt` (922), `closeEditBox` (937) y atajos de teclado (978).
- `js/editor-scenarios.js`: `scFindDropTargets` (2563-2578) y `scResolveDrop` (2657-2676).
- `js/selection.js`: `arrowHostNode` (22), que sigue a `hoverNode`.
- `js/ui.js`: `refreshPanel` (39), que es quien oculta los campos y libera hoy el foco por accidente; `sheetTapOutside` (1334).
- `js/render.js` (1181-1183): solo de referencia, el orden de pintado no cambia.
- `sw.js`: `CACHE` en el slice de implementación.

## 13. Revisión 2 — respuestas por dominio

### 13.1 ¿Qué causa exactamente que un elemento quede «bloqueado»?

No hay estado *stale*. Son cuatro mecanismos deterministas e independientes (§5.1). Cada uno tiene su propio disparador, y eso es lo que los hace parecer intermitentes:

| | Mecanismo | Dominio | Disparador | Síntoma | Lo despierta |
|---|---|---|---|---|---|
| a | El extremo de la conexión **seleccionada** gana al cuerpo del nodo (`interaction.js:497-518`) | Acierto (instrumentos) | hay una conexión seleccionada (típico: recién creada) y se agarra el nodo junto a su ancla | el nodo no se mueve, y cada reintento falla igual | cambiar la selección; **mover otra pieza** la cambia |
| b | El **puerto** de un nodo vecino gana al nodo o a la conexión bajo el cursor (`:520-525`, `:667`), y al soltar se crea una conexión (`:721-733`) | Acierto (puerto) | se hace clic a ≤ 29 px del lado de un nodo | en vez de seleccionar o mover, se crea una conexión espuria | agarrar más adentro |
| c | **Orden Z invertido**: el contenedor está encima de sus hijos, y `hitNode` es «el de más arriba» (`:15-22`) | Acierto (nodos) | la caja se dibujó después de los servicios, se duplicó o se trajo al frente | el hijo no se puede seleccionar, mover ni borrar; arrastrarlo mueve la caja | solo «Enviar al fondo» |
| d | **Foco** en un campo del panel (`:437` + `:978`) | Foco | se escribió o se hizo clic en Texto, Tamaño o Negrita, y luego se hizo clic en el lienzo | Supr no borra; Retroceso vacía la etiqueta o el tamaño del nuevo seleccionado | clic en vacío, cambiar de página, marco de selección |

### 13.2 ¿Cuáles corrige D1 y cuáles no?

| | ¿Lo corrige D1 (con su requisito del puerto, vía P2)? | Por qué |
|---|---|---|
| Bug 1 (conexión dentro del contenedor) | **Sí** | La conexión gana al contenedor. |
| b (puerto → conexión espuria) | **Sí**, por el requisito del owner, que exige P2 | Un clic sin movimiento nunca crea una conexión. Arrastrar desde el puerto sigue conectando, y entonces es intencionado. |
| c (Z invertido) | **Sí** | La hoja gana al contenedor sea cual sea su orden Z. Entre hojas, el orden Z sigue mandando. |
| a (extremo de la conexión seleccionada) | **No** | Los instrumentos de la selección van antes en el orden, por decisión 144. Es D4. |
| d (foco) | **No** | No es acierto: el clic llega bien al nodo y lo selecciona; lo que falla es a dónde van las teclas. Es D7. |
| Conexión tapada por un contenedor opaco | **No** | Es pintado. D1 la hace seleccionable, no visible. Es D6. |

### 13.3 Foco atrapado en los inputs del panel

Es un problema **de foco**, no de acierto ni de pintado. El clic en el lienzo selecciona bien el nodo B, pero el foco del documento se queda en el campo del panel donde estaba, porque el `pointerdown` del lienzo cancela la acción por defecto. Los atajos no actúan sobre teclas dirigidas a campos de texto, y ese campo ya muestra los datos de **B**: Retroceso edita B (vacía su etiqueta o su tamaño de fuente) en vez de borrarlo. Afecta a `#lblEdit`, `#fsIn` y `#boldChk` en el panel de nodo (y a cualquier `input` o `textarea`). No afecta a los `select`. Pasa igual con contenedor o sin él. Arreglo propuesto: D7, opción A.

### 13.4 Puerto vecino que genera conexiones espurias

Es un problema **de acierto** (prioridad del paso 3) más la **resolución del gesto en `pointerup`**. El puerto de un nodo (a 18 px de su lado, con acierto de 11 px) se prueba antes que cualquier nodo o conexión, y empieza `connectDrag` ya en el `pointerdown`. Al soltar, aunque no haya habido movimiento, se crea una conexión hacia el nodo que haya debajo. Dentro de un contenedor siempre lo hay (el propio contenedor), y si dos nodos están a menos de ~29 px, el vecino.

Medido:
- con contenedor, 37 conexiones espurias en el estrés y 100 % en el fixture;
- sin contenedor, 1;
- en el ejemplo público serverless, 24 puntos de la rejilla donde hoy un clic crea una conexión.

Queda dentro de **D1** por el requisito explícito del owner, implementado con P2 (puerto diferido, solo editor). Es la parte de la aprobación que aclara D2.

### 13.5 Conexiones tapadas por un contenedor con relleno opaco

Es un problema **de pintado**, independiente del acierto: **D6**. Las conexiones (con sus puntos y tokens) se pintan siempre debajo de todos los nodos, en el lienzo, en el SVG del editor y en el SVG del MCP.

- **D6a — lienzo plano:** solo ocurre si el usuario elige un relleno opaco para la caja.
- **D6b — piel «construido» (2.5D):** ocurre **con el relleno por defecto**. El frente con piel es opaco y el orden de pintor por `y` pone el contenedor encima de los hijos situados por encima de su centro. En Present desaparecen hijos y conexiones (DEMOSTRADO).

Tras D1, esas conexiones se podrán seleccionar, pero seguirán sin verse donde un contenedor opaco las tape. Hace falta una decisión visual propia (D6, recomendada la opción B: capas contenedor → conexiones → hojas), en un slice aparte que sí toca el port del MCP para mantener la paridad del SVG.

---

## 14. Implementación — alcance definitivo (GO del owner, 18-10-2026)

**Aprobadas:** D1, D2, D3 = A, D4 = A, D5 = A, D6 = B1 y D7 = A.
**Este slice:** D1 + D2 + D7, con D3, D4 y D5 fijadas por tests. **D6 NO entra**: es un slice de pintado separado y posterior (§14.4).
**Sin commit, push ni deploy** hasta el OK del owner. fluyo-mcp no se toca.

### 14.1 Qué cambia (producto)

| Decisión | Cambio | Archivo |
|---|---|---|
| D1 | `isContainerNode(n, nodes)`: un nodo es contenedor si contiene el centro de otro nodo de menor área. Es geometría pura, fuera del kernel, y sin caché: se calcula en cada acierto. | `js/geometry.js` |
| D1 | `hitLeafNode(x,y)`: la hoja de más arriba en Z cuya caja +4 contiene el punto. `hitContainerNode(x,y)`: el contenedor de menor área (el más interior) que lo contiene; si empatan, el de más arriba. `hitNode` = hoja ‖ contenedor. `hitTarget(x,y)` → `{kind:"node"\|"edge", obj}` en el orden hoja → conexión (`hitEdge`, tolerancia de hoy) → contenedor. `hitSideArrowHost` prueba el puerto de las hojas antes que el de los contenedores. | `js/interaction.js` |
| D1 | Consumidores: pasos 4–5 del `pointerdown` usan `hitTarget`; hover y cursor (fuera de un arrastre de conexión o de extremo) = puerto ‖ el nodo de `hitTarget`; doble clic (`openEditorAt`) = `hitTarget`. Destinos de soltar una conexión o un extremo, «Conectar» táctil y modo «Flecha»: `hitNode` (hoja antes que contenedor). | `js/interaction.js` |
| D1 | Historias: un evento de conexión solo deja de buscar conexiones si hay una **hoja** debajo (`hitLeafNode`), no un contenedor. Los eventos de nodo usan `hitNode` (hoja antes que contenedor). | `js/editor-scenarios.js` |
| D2 | Puerto diferido: en el `pointerdown`, el acierto en un puerto anota `connectPending` (origen, lado, punto y posición de pantalla). `connectDrag` solo empieza cuando el puntero se mueve más de 3 px de pantalla (el umbral de `panDrag`). Un `pointerup` sin ese movimiento resuelve el clic con el orden de D1 en el punto pulsado (hoja/conexión: seleccionar, con Mayús para sumar o quitar; vacío: vaciar la selección sin Mayús) y **nunca crea una conexión**. Escape y `cancelGestures` lo anulan. | `js/interaction.js` |
| D7 | `releasePanelFocus()` es lo primero del `pointerdown` del lienzo, con ratón y con dedo, en cualquier modo. Si el foco está en un `INPUT`, `TEXTAREA` o `SELECT` (salvo `#editBox`), hace `blur()`. El `change` pendiente se aplica antes de que cambie la selección, es decir, al objeto anterior. `closeEditBox` hace `editBox.blur()`. | `js/interaction.js` |
| — | `CACHE` → `fluyo-static-v90` (regla de AGENTS.md §6: el slice toca archivos servidos). 019.4a, que reservaba v90, pasaría a v91. | `sw.js` |

### 14.2 Qué NO cambia

- **D3:** el vacío interior selecciona y arrastra el contenedor.
- **D4:** los instrumentos de una conexión seleccionada siguen antes que los nodos (decisión 144).
- **D5:** el acierto no depende del relleno.
- Las tolerancias de acierto, los instrumentos, el marco de selección y el arrastre del grupo.
- El pintado: `render.js`, `export.js` y `skin.js` no se tocan.
- El modelo, el formato, el kernel y fluyo-mcp.
- La regla de los atajos de teclado (`:978`).

### 14.3 Tests

- `test/fluyo-019-hit-test.test.cjs` (vm + estáticos):
  - `isContainerNode`;
  - `hitTarget` y `hitNode` sobre F1–F6, anidado, Z invertido, caja sin hijos (F′) y `fill:"none"`;
  - D3, D4 y D5 fijadas;
  - puerto diferido y `releasePanelFocus` en el orden correcto del `pointerdown`;
  - alcance (solo los archivos de §14.1) y `CACHE` v90.
- `test/fluyo-019-hit-test-browser.cjs` (Chrome real):
  - tabla de §4.2 con clics reales;
  - 0 conexiones nuevas tras un clic, y arrastrar desde el puerto sigue conectando (una entrada de Undo);
  - Z invertido;
  - doble clic sobre una conexión interna;
  - destino de un evento FLOW de Historia;
  - D4 fijada (`endDrag` junto al ancla, y despierta al cambiar la selección);
  - D7 campo por campo, con Supr y Retroceso, con ratón y con dedo, más el `change` pendiente al objeto anterior con una entrada de Undo y `#editBox` en el mismo fotograma;
  - no regresión sin contenedores (rejilla de los ejemplos: solo cambian los puntos de puerto);
  - 0 errores de página.
- `test/fluyo-019-hit-test-mutations.cjs`: mutaciones que deben hacer fallar las suites (orden nodo → conexión, puerto inmediato, sin `blur`, contenedor = el de arriba en Z en lugar del más interior, Historias con `hitNode`).
- Tests anteriores: solo `CACHE` v89 → v90 y los contratos que este slice cambia a propósito (B7 de 018-16, que apunta a la creación de `connectDrag`).

### 14.4 D6 (siguiente slice, de pintado; no se toca aquí)

D6 = B1 con estas condiciones del owner:
- capas contenedor → conexiones → hojas;
- contenedores anidados de fuera adentro;
- las conexiones completas (línea, aguja, etiqueta, flujo, tokens, funda e instrumentos) como una unidad;
- sin contenedores, resultado idéntico a HEAD;
- `skin.js` intacto;
- fluyo-mcp intacto por ahora.

La piel 2.5D no puede hacer que un contenedor tape a sus hijos, sus conexiones, los puntos de flujo, los tokens de Historia o la selección. Reutilizará `isContainerNode` de `geometry.js`.

## 15. Implementación — resultado (D1 + D2 + D7; D3–D5 fijadas)

**Estado: READY FOR COMMIT.** Sin commit, push ni deploy, a la espera del OK del owner. D6 no se ha tocado.

### 15.1 Archivos modificados

**Producto (servidos):**

| Archivo | Cambio |
|---|---|
| `js/geometry.js` | + `isContainerNode(n, nodes)` (9 líneas, fuera del kernel). |
| `js/interaction.js` | **Acierto:** `nodeBoxHit`, `hitLeafNode`, `hitContainerNode`; `hitNode` = hoja ‖ contenedor; `hitTarget`; `hitSideArrowHost` con hojas antes que contenedores. **Puerto diferido:** `connectPending`, `CONNECT_MOVE_PX`, `portClick`. **Foco:** `releasePanelFocus` es la primera línea del `pointerdown`, y `closeEditBox` hace `blur`. **Consumidores:** pasos 4–5 del `pointerdown`, hover, `pointerup`, doble clic, Escape y `cancelGestures`. |
| `js/editor-scenarios.js` | 3 llamadas `hitNode` → `hitLeafNode` (eventos de conexión: `scFindDropTargets`, `scHoverAt`, `scResolveDrop`). |
| `sw.js` | `CACHE` `fluyo-static-v90`. |

**Documentación:** `.ai/DECISIONS.md` (decisiones 209–211), `.ai/ARCHITECTURE.md` (sección nueva) y esta tarea.

**Tests nuevos:** `test/fluyo-019-hit-test.test.cjs`, `test/fluyo-019-hit-test-browser.cjs` y `test/fluyo-019-hit-test-mutations.cjs`.

**Tests existentes ajustados:**
- `CACHE` v89 → v90 en 50 tests (lo mismo que en cada slice).
- Smoke del service worker de `fluyo-019-2-browser.cjs`: ahora sube de `d31703e` (v89) a v90.
- Alcance de `fluyo-019-5` (lista de archivos cambiados frente a `b534a97`) y de `fluyo-019-flow-fade` (archivos idénticos a `266ac09`): este slice cambia `interaction.js`, `geometry.js` y `editor-scenarios.js` a propósito, y queda anotado en cada test.
- Mutación B7 de `fluyo-018-16-mutations.cjs`: ahora apunta a la línea donde nace `connectDrag`.
- `fluyo-018-7a-browser.cjs`, caso «el hit-test coincide con el orden pintado»: el nodo S ya no se crea **sobre el centro** de B. Con D1, B sería su contenedor y la hoja S ganaría sea cual sea el orden Z, que es justo el contrato que cambia. Ahora se solapa con la esquina inferior derecha de B, con su centro fuera de B y lejos de sus puertos: dos **hojas** solapadas, donde el orden Z sigue mandando. Así el test prueba lo que pretendía. Con S junto al lado este, en la pasada sobre HEAD el clic en S caía en el puerto de B y creaba una conexión, el bug de D2.
- Stubs de arneses vm que extraen código del editor:
  - `connectPending` en `analytics.test.cjs`;
  - `hitLeafNode` en `fluyo-010-qa`, `fluyo-011-final-fixes`, `fluyo-018-19` y `scenario-ui-dom`.

  Su aserción no cambia.

### 15.2 Pruebas

| Suite | Resultado |
|---|---|
| `test/fluyo-019-hit-test.test.cjs` (vm) | **29/29**: tabla §4.2 (17 casos), `isContainerNode`, `hitNode`, Z invertido (27 puntos), puerto hoja/contenedor, **no regresión en rejilla contra `d31703e` en los 8 ejemplos (>30 000 puntos idénticos)**, D3/D4/D5, contratos de D2/D7/Historias y alcance. |
| `test/fluyo-019-hit-test-browser.cjs` (Chrome real) | **84/84**: §4.2 con clics reales, Z invertido, doble clic, Historias, D2 (clic sin conexión dentro de GCP / vecino / Mayús / sin contenedor / vacío; arrastre crea 1 conexión con 1 Undo en 3 variantes; temblor de 2 px; Escape), D3, D4, D7 campo por campo (nodo: 5 campos; conexión: 8; Supr y Retroceso), `change` pendiente al anterior con 1 Undo, `#editBox` en el mismo fotograma, dedo (3 campos × 2 teclas) y 0 errores. **La base `d31703e` reproduce los 14 bugs** (así el test demuestra que los detecta). |
| `test/fluyo-019-hit-test-mutations.cjs` | **20/20 mutaciones detectadas** (11 en vm, 9 en Chrome). |
| Resto de tests vm (`test/*.test.cjs`) | Mismos fallos que la base `d31703e` en un árbol limpio (preexistentes, no de este slice): `fluyo-011-final-fixes` 14, `fluyo-012-1-qa` 28, `fluyo-017-2-qa` 1, `fluyo-018-17` 1, `fluyo-018-25` 10 (con fluyo-mcp al lado), `fluyo-018-27` 3, `fluyo-019-2` 2, `scenario-ui-dom` 21. Antes del commit fallan además los «alcance … idénticos a HEAD» (018-17/18/19/21/23/24, 019-1, 019-2). **En un clon de scratch con el cambio commiteado pasan todos** (solo quedan los preexistentes de 018-17 y 019-2). |
| Regresión de navegador (las 43 `*-browser.cjs`, en secuencia) | **37 en verde.** Incluye todas las que tocan el acierto, el puerto o Historias: 016, 017-3, 018-3/4/7c/7d/8/9/10, 018-13, 018-14a/14b, 018-15, **018-16** (conectar con ratón y con dedo, instrumentos), 018-17, 018-18, 018-21, 018-24, **018-25** (gestos de ruta), 018-27, 019-1/2/3/5, flow-fade, **019-hit-test**, scenario-qa, share×4 y 013/014/015 (+qa). **018-7a** pasa tras el ajuste de §15.1. **5 fallan igual en la base `d31703e`** (clon limpio, mismo texto de fallo; solo cambia la ruta temporal de las capturas), así que son preexistentes y ajenas al slice: 011 (selectores de la interfaz de Historias de FLUYO-011 y smoke «SW v45 → v61»), 018-12 (6: cabecera sin controles de reproducción, panel sin ⚙), 018-19 (1: «lienzo 87 %» en Present l667), 018-23 (2: «conexión con puntos» > 1 pantalla) y 018-5 (1: «HEAD también rechaza 81 caracteres»). |

### 15.3 Riesgo intermedio (hasta D6)

Ver §9: el acierto sigue a D1, pero el pintado todavía no. Una hoja enviada detrás de su contenedor se pinta debajo y gana el clic. Con el relleno por defecto se ve igual, porque el tinte es translúcido. D6 alinea pintado y acierto.

### 15.4 Verificación final (18-10-2026, antes del OK de commit)

| Comprobación | Resultado |
|---|---|
| `test/fluyo-019-hit-test.test.cjs` (vm) | 29/29 |
| `test/fluyo-019-hit-test-browser.cjs` (Chrome) | 84/84, 0 fallos |
| `test/fluyo-019-hit-test-mutations.cjs` | 20/20 detectadas (exit 0) |
| `test/fluyo-018-7a-browser.cjs` con el fixture nuevo | exit 0; «el hit-test coincide con el orden pintado» ✔ |
| 011, 018-12, 018-19, 018-23 y 018-5 (Chrome), árbol frente a un clon limpio de `d31703e` (0 cambios locales) | Las 5 fallan **con los mismos mensajes** en los dos (solo cambian la ruta temporal de las capturas y los tiempos). **Son preexistentes.** |

**Commit propuesto (solo fluyo, 64 archivos):**

- **Producto (4):** `js/interaction.js`, `js/geometry.js`, `js/editor-scenarios.js`, `sw.js`.
- **Docs (3):** `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md`, `.ai/tasks/FLUYO-019-HIT-TEST.md`.
- **Tests nuevos (3):** `test/fluyo-019-hit-test.test.cjs`, `test/fluyo-019-hit-test-browser.cjs`, `test/fluyo-019-hit-test-mutations.cjs`.
- **Tests ajustados (54):** CACHE v90; SW smoke de 019-2; alcance de 019-5 y de flow-fade; B7 de 018-16; stubs de analytics, 010-qa, 011-final-fixes, 018-19 y scenario-ui-dom; fixture de 018-7a.

**Fuera del commit:**
- `.ai/tasks/FLUYO-019.4.md` (de otra sesión);
- D6 (no implementado);
- fluyo-mcp (sin cambios);
- los scripts de auditoría del scratchpad.

---

## Handoff

### Estado actual

**READY FOR COMMIT, sin commitear.** Implementados D1 + D2 + D7, con D3–D5 fijadas por tests. CACHE v90; decisiones 209–211 en `.ai/DECISIONS.md`; sección nueva en `.ai/ARCHITECTURE.md`. Tests nuevos en verde: vm 29/29, Chrome 84/84 (la base reproduce los 14 bugs) y 20/20 mutaciones. La regresión vm y la de navegador no muestran fallos nuevos frente a `d31703e` (§15.2). D6 no se ha tocado. fluyo-mcp intacto. En el árbol hay además `.ai/tasks/FLUYO-019.4.md`, sin seguimiento: es de otra sesión y **no** entra en el commit.

### Próximo paso concreto

1. OK del owner para commitear, **solo en fluyo**. Archivos:
   - producto: `js/interaction.js`, `js/geometry.js`, `js/editor-scenarios.js`, `sw.js`;
   - docs: `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md`, `.ai/tasks/FLUYO-019-HIT-TEST.md`;
   - tests nuevos: `test/fluyo-019-hit-test.test.cjs`, `test/fluyo-019-hit-test-browser.cjs`, `test/fluyo-019-hit-test-mutations.cjs`;
   - tests ajustados: los de §15.1.

   **Excluir** `.ai/tasks/FLUYO-019.4.md`. Tras el commit, los tests «alcance … idénticos a HEAD» de 018-17/18/19/21/23/24, 019-1 y 019-2 vuelven a pasar (comprobado en un clon de scratch).
2. Después, el slice de pintado D6 (B1; condiciones en §14.4), solo editor, que reutilizará `isContainerNode`. 019.4a, que reservaba CACHE v90, pasa a v91 o a la siguiente libre.
