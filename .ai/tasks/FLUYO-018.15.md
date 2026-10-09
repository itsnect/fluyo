# FLUYO-018.15 — Coherencia visual del documento

Estado: **READY FOR REVIEW**. Sin commit, push ni deploy.
Fecha: 8 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: el árbol de trabajo con 018.11–018.14b (sin commit sobre `604b344`). 018.14a y 018.14b no se rehacen ni se deshace ninguna de sus decisiones.
> Fuentes leídas: `AGENTS.md`, `.ai/tasks/FLUYO-018.14.md`, `.ai/DECISIONS.md` (128–139), `css/system.css` (tokens), `js/config.js`, los tramos de color de `model.js`, `render.js`, `geometry.js`, `export.js`, `ui.js`, `interaction.js`, `editor-scenarios.js`, `viewer.js` y `styles.css`; en fluyo-mcp, `src/svg.ts`, `src/schema.ts`, `src/templates.ts`, `scripts/sync-*.ts` y los tests de goldens. Los 8 ejemplos publicados y los fixtures de `test/`.

## 1. Objetivo y resultado

Cerrar la coherencia visual de lo que hay **dentro** del lienzo: qué colores del documento siguen hablando el idioma del editor técnico antiguo, y cambiar solo lo que lo demuestra.

Resultado, en una línea: **un nodo nuevo nace en piedra media `#857F6C`** (no en el azul «Servicio»), y **la reproducción de Historias deja el cian del editor antiguo** («Resaltar» pasa a oliva de activo; el halo del evento, a su terracota). Ningún documento existente cambia de datos; la paleta, los temas y «Servicio» siguen igual.

Fluyo sigue siendo Fluyo: no hay ninguna marca, logo, firma ni referencia a NECT en el producto. La identidad compartida aparece solo como lenguaje (los tokens hueso/tinta/piedra/oliva/terracota de `system.css`).

## 2. Fase 1 — Auditoría de color del documento

Medida en código y en Chrome real (§ 9 y § 12).

Leyenda de «¿Doc o UI?»: **Doc** = se dibuja en lienzo, SVG, Viewer y `export_diagram`; **Runtime** = se dibuja en lienzo, Present y Viewer, pero no se guarda; **UI** = solo editor.

### A. Colores de UI/chrome que se dibujan sobre el lienzo

| Elemento | Color actual | Origen | Superficies | ¿Doc o UI? | ¿Cambiar? | Propuesta |
|---|---|---|---|---|---|---|
| Selección, tiradores, marco de selección, vista previa de conexión, flechas de lado | Oliva por tema: `#C3CDA4` (oscuro) / `#4E5A3F` (crema, claro) | `render.js` `EDITOR_MARK` | Editor | UI | No | Ya es el sistema (018.13); 0 px de cian medidos |
| Arista seleccionada | Oliva, 2,6 px | `render.js` `drawEdge` | Editor | UI | No | — |
| Resaltado al colocar un evento (`scHighlight`) | Oliva (`editorMark`) | `render.js` | Editor | UI | No | Ya hecho en 018.14a |
| Pista del lienzo vacío | `#00000055` / `#ffffff44`, Playfair | `render.js` | Editor | UI | No | Neutro |
| Vista previa de «Resaltar» en el diálogo de evento | `rgba(58,167,232,.5)` | `styles.css` | Editor | UI (espejo del lienzo) | **Sí** | `var(--active)`: tiene que decir lo mismo que el lienzo |
| Chips, segmentados y selector de símbolo del diálogo de evento | `rgba(58,167,232,…)` | `styles.css` | Editor | UI | No en este slice | Chrome de Historias, fuera de alcance (pendiente desde 018.14b) |

### B. Colores estructurales del documento (del tema; `THEMES`, kernel)

| Elemento | Color actual | Origen | Superficies | ¿Doc o UI? | ¿Cambiar? | Propuesta |
|---|---|---|---|---|---|---|
| Fondo del lienzo | `#161616` / `#f4eee1` / `#ffffff` | `config.js` `THEMES.*.bg` | Todas | Doc | No | Cambiarlo repinta todos los documentos |
| Rejilla | `rgba(255,255,255,.045)` / `rgba(0,0,0,.06/.05)` | `THEMES.*.grid` | Editor, exportación | Doc | No | — |
| Texto dentro de formas | `#ededed` / `#2b2620` / `#111111` | `THEMES.*.text` | Todas | Doc | No | Hueso/tinta del tema |
| Línea de conexión | `#777` / `#8a8275` / `#888888`, 2 px; discontinua `[8,7]` | `THEMES.*.edge`, `render.js` | Todas | Doc | No | Neutra. El `#777` del oscuro es gris frío, pero cambiarlo repinta cada documento (§ 6) |
| Punta de flecha | Triángulo relleno 12 × 12, color de la línea | `render.js` `arrowHead` | Todas | Doc | No | — |
| Etiqueta de conexión | `#bdbdbd` / `#6b6457` / `#444444` sobre `lblBg` | `THEMES.*.edgeLbl` | Todas | Doc | No | — |
| Bloque `code` (velo, texto, palabra clave) | Ver 018.14a | `THEMES.code*` | Todas | Doc | No | Ya en el sistema (018.14a) |
| Tinte de relleno automático | Color del nodo al 16 % (crema) / 18 % | `fillFor`, `svgFillColor` | Todas | Doc | No | Deriva del color del nodo |

### C. Colores semánticos

| Elemento | Color actual | Origen | Superficies | ¿Doc o UI? | ¿Cambiar? | Propuesta |
|---|---|---|---|---|---|---|
| Llegada con éxito / con fallo | `#7bb85b` / `#d0576a` | `render.js` `drawFlowOverlay` | Editor, Present, Viewer | Runtime | No | Éxito y error, con función |
| Animaciones `errmove` / `check` | `#d0576a` / `#7bb85b` | `render.js` `drawAnim` | Todas | Doc | No | Estado de error / éxito |
| Mensaje de nodo por defecto | `#d0576a` | `editor-scenarios.js` (se guarda en el evento) | Todas | Doc (dato) | No | Valor de un dato al crear el evento |
| Nodo caído / atenuado | `rgba(0,0,0,.26)` / `.30` | `render.js` | Editor, Present, Viewer | Runtime | No | Neutro |
| Paleta con nombre: Servicio, Eventos, Datos, IA, Alerta, Externo, Config, Cache, Cola, Red, Almacén, Éxito, Error, Info | 14 colores | `config.js` `PALETTE` | Panel, `list_colors`, plantillas | Doc (elección del usuario) | No | Son categorías con nombre; el MCP las traduce por nombre |

### D. Colores heredados del editor antiguo

| Elemento | Color actual | Origen | Superficies | ¿Doc o UI? | ¿Cambiar? | Propuesta |
|---|---|---|---|---|---|---|
| **Color con el que nace un nodo** | `#6a9fb5` («Servicio», `PALETTE[0]`) | `model.js` `createNodeIn` | Todas (editor y MCP) | Doc (default) | **Sí** | `#857F6C` (§ 4) |
| Herramienta de animaciones del editor | `PALETTE[0].c` explícito | `interaction.js` | Editor | Doc (default) | **Sí** | `DEFAULT_NODE_COLOR` |
| «Resaltar» / «Parpadear» de una Historia | `#3aa7e8` + `rgba(58,167,232,.9)` | `render.js` `drawScenarioNodeOverlay` | Editor, Present, Viewer | Runtime | **Sí** | Oliva de activo por tema (`activeMark`) |
| Halo, pulso y brillo de llegada del evento | `FLOW_ACCENT = #3aa7e8` | `render.js` | Editor, Present, Viewer, diálogo | Runtime | **Sí** | `#d08b5b`, el color del propio punto del evento |
| Brillo del pulso de una imagen | `#3aa7e8` | `render.js` `drawNode` | Todas | Runtime | **Sí** | `n.color`, como el resto de formas |
| Respaldos de `drawAnim` y `colHex` | `#3aa7e8` | `render.js` | Inalcanzable con documentos normalizados | — | **Sí** | `PALETTE[0].c`, el respaldo histórico de la normalización |
| Relleno «Color» por defecto del diálogo de evento | `#3aa7e8` | `editor-scenarios.js` (se guarda en el evento) | Todas | Doc (dato) | No en este slice | Es el valor inicial de un dato de autoría de Historias; ver Pendientes |
| Pastillas de iconos de marca (`GCP_BLUE`, `AZ_BLUE`…) | Colores de cada marca | `config.js` `ICONS` | Todas | Doc (contenido) | No | Son iconos de terceros |

### E. Deben quedarse exactamente igual (compatibilidad)

| Elemento | Valor | Por qué |
|---|---|---|
| `PALETTE` (14 entradas, «Servicio» = `#6a9fb5` la primera) | Igual que HEAD | `list_colors`, plantillas y `create_diagram` traducen por nombre; los documentos las tienen explícitas |
| Respaldo de un nodo guardado sin `color` | `PALETTE[0].c` = `#6a9fb5` | Cambiarlo repintaría documentos históricos (v1 `state`, JSON escritos a mano) |
| `SWATCH_COLORS`, `EVENT_SWATCHES` | Igual | Elecciones del usuario |
| `THEMES` (fondo, texto, aristas, etiquetas) | Igual | Lo comparten todos los documentos |
| Cualquier color explícito de un documento | Tal cual | Dato del usuario |

**Conclusión de la auditoría.** Lo que desentona dentro del lienzo no son las formas ni las conexiones, sino dos cosas:

1. el **azul «Servicio» como color de nacimiento**, que es la mayor superficie de color de cualquier diagrama nuevo y no llega a 3:1 en los temas claros;
2. el **cian del editor antiguo** en la reproducción de Historias.

Todo lo demás ya pertenece al sistema (018.13/018.14a) o es contenido del usuario.

## 3. Fase 2 — Dirección visual

- **Jerarquía, no decoración.** Con el default en azul, todo diagrama nuevo es un «diagrama azul con acentos». Con piedra, la estructura queda neutra y el color aparece solo donde quien diagrama le da significado (Datos, Eventos, Error…).
- **Qué se evita**:
  - azul corporativo / estética draw.io: el default deja de ser azul;
  - arcoíris: la paleta no se toca, pero el lienzo nace sin color;
  - bordes coloreados sin función: un nodo sin categoría no lleva borde de color;
  - colores saturados sin función: el cian de la reproducción desaparece.
- **Lo que no se hace**:
  - no se reinterpreta la paleta del usuario;
  - no se tiñe cada tipo de forma de un color: el color sigue siendo del nodo, no de su forma;
  - no se cambian fondos, texto ni aristas de los temas.

## 4. Fase 3 — Color por defecto de los nodos (`#6a9fb5`)

### Preguntas

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Aparece solo en documentos nuevos? | Lo **asigna** `createNodeIn` al crear: editor (todas las formas y la herramienta de animaciones, que lo pasaba explícito) y MCP (`create_diagram`, `create_node`, `create_from_template` sin color). Además, `normalizeProjectNode` lo pone **al cargar** a un nodo guardado sin `color` |
| 2 | ¿Los documentos existentes conservan su color? | Sí. El editor siempre guarda `color` explícito (los 8 ejemplos: 75 nodos, 0 sin color; `#6a9fb5` en 19 de ellos, explícito). Solo un documento escrito a mano o v1 (`state`) puede no traerlo |
| 3 | ¿Cambiar el default afecta a documentos persistidos? | Solo si se cambia el respaldo de la **carga**. Por eso `normalizeProjectNode` sigue con `PALETTE[0].c`: un nodo sin color se sigue viendo `#6a9fb5` |
| 4 | ¿Viewer? | Usa el mismo kernel y el mismo `render.js`: dibuja `n.color`. Nodos nuevos en piedra; los existentes, como estaban |
| 5 | ¿SVG? | `export.js` dibuja `n.color` y su tinte: misma regla |
| 6 | ¿`export_diagram`? | `svg.ts` dibuja `n.color`. Hallazgo previo, no de este slice: su esquema **exige** `color` en cada nodo y rechaza un documento con un nodo sin color (`expected string`), que el editor y `author_document` sí aceptan y normalizan. No se toca (funcionalidad MCP) |
| 7 | ¿MCP? | `createNodeIn` es kernel: tras `sync:kernel`, todo nodo creado sin color por el MCP nace igual que en el editor. `list_colors` no cambia (la paleta no cambia) |
| 8 | ¿Documento antiguo con `#6a9fb5` explícito? | Se conserva tal cual (es un dato) y se sigue viendo azul. Comprobado en vm, Chrome y MCP |
| 9 | ¿Se puede cambiar solo el default de nodos nuevos, sin migración? | Sí: una constante nueva (`DEFAULT_NODE_COLOR`, `config.js`) usada solo por `createNodeIn` y la herramienta de animaciones. `PALETTE[0]` y el respaldo de carga quedan igual |
| 10 | ¿Qué color es más coherente? | `#857F6C` (abajo) |

### Candidatos, medidos

El mismo valor sirve para seis cosas a la vez:

- trazo;
- tinte del relleno;
- texto de un nodo `text`;
- dibujo de una animación;
- puntos de flujo que salen del nodo (`e.dotColor||A.color`);
- brillo del pulso.

Un solo hex debe funcionar sobre los tres temas del lienzo.

Contraste del color contra el fondo de cada tema (oscuro / crema / claro) y distancia perceptual (ΔE76) al color más cercano de la paleta:

| Candidato | Contraste | ΔE76 al más cercano | Lectura |
|---|---|---|---|
| `#6a9fb5` actual | 6,24 / **2,51 / 2,90** | 17,7 a Info `#5b9bd0` | Falla 3:1 en crema y claro; azul acero |
| Piedra `#A39C8A` (token) | 6,62 / **2,37 / 2,73** | — | Falla en claros; en el chrome significa «deshabilitado» |
| Grafito `#67624F` (token) | **2,96** / 5,29 / 6,11 | — | Falla en oscuro |
| Piedra honda `#7C7565` | 3,95 / 3,96 / 4,58 | 14,0 a Externo | Equilibrada; puntos más apagados en oscuro |
| Tierra `#8A6F55` | 3,87 / 4,05 / 4,68 | — | Todo el diagrama se vuelve marrón: decorativo |
| Musgo `#6F7A5E` | 3,98 / 3,93 / 4,54 | — | Choca con la oliva de la selección y de «activo» |
| **Piedra media `#857F6C`** | **4,52 / 3,46 / 4,00** | 12,8 a Externo; 31,5 al azul actual | Punto medio exacto grafito↔piedra; pasa 3:1 en los tres; favorece un poco al oscuro, tema por defecto y de los 8 ejemplos |

Por qué no las otras familias:

- **oliva** es el color de la selección y de «activo»;
- **terracota** es acción y eventos (y «Eventos / Kafka» ya es `#d08b5b`);
- un color **«del tema»** (tinta en claro, hueso en oscuro) exigiría un valor nuevo en el formato.

### Decisión

**Cambiar**, solo para nodos nuevos, a `#857F6C` (decisión 140). El prototipo (§ 9) confirma la mejora en crema y claro; en oscuro el diagrama gana calma.

Coste aceptado: los puntos de flujo de un nodo sin color son más sobrios en el lienzo oscuro. Recuperan color en cuanto el nodo lo tiene.

## 5. Fase 4 — Taxonomía de color

Sale de lo que Fluyo ya hace, no de una plantilla (decisión 141):

| Papel | Color | Dónde |
|---|---|---|
| Texto, etiquetas | Tinta / hueso del tema | `THEMES.text`, `edgeLbl` |
| Estructura | Piedra: aristas del tema y nodos sin categoría (`#857F6C`) | `THEMES.edge`, `DEFAULT_NODE_COLOR` |
| Activo | Oliva por tema: selección, colocar un evento, «Resaltar» de la Historia | `activeMark` (`render.js`) |
| Evento en tránsito | Terracota `#d08b5b`: punto sin símbolo, halo, pulso y brillo de llegada | `FLOW_ACCENT` |
| Éxito / error | `#7bb85b` / `#d0576a` | Llegadas y animaciones de estado |
| Categorías | La paleta del usuario (14 con nombre + rejilla) | Contenido: no se reinterpreta |

No hay un color por tipo de forma: una BD es piedra hasta que alguien la marca como «Datos».

## 6. Fase 5 — Conexiones

| Aspecto | Hoy | ¿Pertenece al sistema? |
|---|---|---|
| Color | Gris del tema (`#777` / `#8a8275` / `#888`) | Sí (neutro). El gris del oscuro es algo frío; cambiarlo repinta todos los documentos: no compensa |
| Grosor | 2 px; seleccionada 2,6 px | Sí |
| Puntos | r 5 + halo r 9 al 30 %; pelota única r 7 + 13. Color: el del nodo de origen | Sí. Con el default nuevo, en un diagrama sin categorías los puntos son piedra sobre línea piedra: cuentas sobre un hilo. Ganan color cuando el nodo lo tiene |
| Extremos y flechas | Triángulo relleno 12 × 12 con el color de la línea; inicio opcional | Sí |
| Seleccionada | Línea y puntas oliva; tiradores oliva sobre el fondo del lienzo | Sí (018.13) |
| Activa en una Historia | Rastro con el color del texto del tema; halo y llegada antes cian → terracota | Corregido (§ 8) |

Sin cambios de interacción ni de geometría.

## 7. Fase 6 — Formas

| Forma | Radio | Trazo | Sombra | Relleno | Selección |
|---|---|---|---|---|---|
| Caja | 10 | 2,5 | Solo el brillo del pulso | Tinte 16/18 % del color | Marco rectangular oliva a 6 px |
| BD (cilindro) | Elipse (018.14a) | 2,5 | Ídem | Ídem | Ídem |
| Rombo | — | 2,5 | Ídem | Ídem | Ídem |
| Círculo | — | 2,5 | Ídem | Ídem | Ídem |
| Hexágono | Inserto `min(24, w·0,18)` | 2,5 | Ídem | Ídem | Ídem |
| Código | 10 (panel), 6 (bloque) | 2,5 | Ídem | Tinte (018.14a) | Ídem |
| Texto | — | — | — | — | Ídem; su color es el del texto |
| Imagen | — | — | Pulso: **antes cian** → color del nodo | — | Ídem |
| Icono | Pastilla del icono | — | Pulso con el color del nodo | — | Ídem |
| Grupo / nota | **No existen** como formas en Fluyo (`DEFAULT_SIZES`) | | | | |

Coherentes: el mismo trazo de 2,5, el mismo tinte, sin sombras decorativas, el mismo marco de selección y la tipografía global. Solo rompía el sistema el brillo cian de la imagen. No se rediseña ninguna forma.

## 8. Fase 7 — Historias

No se reabre el diseño. Verificación de la jerarquía cromática:

| Estado | Antes | Ahora |
|---|---|---|
| Selección en modo Historia | Oliva | Oliva |
| Colocar un evento (`scHighlight`) | Oliva | Oliva |
| «Resaltar» / «Parpadear» reproduciendo | **Cian** | Oliva (el mismo `activeMark`) |
| Punto del evento sin símbolo | Terracota `#d08b5b` | Ídem |
| Su halo, el pulso y el brillo de llegada | **Cian** | Terracota (`FLOW_ACCENT`) |
| Llegada con éxito / fallo | Verde / rojo | Ídem (semántico) |
| Vista previa de «Resaltar» en el diálogo | **Cian** | Oliva (`--active`) |
| Filete «Reproduciendo» del marco | Oliva (018.14b) | Ídem |

**Por qué se toca lo que quedaba de la D3 de 018.14.** La auditoría muestra dos contradicciones directas:

- el mismo nodo resaltado era oliva al colocar el evento y cian al reproducirlo;
- un punto terracota llevaba un halo azul (prototipo, § 9).

Afecta igual a editor, Present y Viewer (render compartido) y no cambia ningún dato (decisión 142).

## 9. Fase 9 — Prototipo (antes de tocar el código)

Hecho con el render real sobre copias en el scratchpad de la sesión (fuera del repo). Composición fija: un flujo de pedido con

- título (`text`);
- caja, hexágono, rombo, `code` y animación por defecto;
- BD «Datos», «pedido.creado» «Eventos» y «Rechazo» «Error», explícitos;
- conexiones con etiqueta, discontinua y ortogonal.

Mismos nodos, mismo texto y mismas conexiones; solo cambia el sistema.

- `p15/cand-sheet.png`, `cand-sheet2.png`: candidatos de § 4 en oscuro, crema y claro (ampliados).
- `p15/proto-{light,dark}-{edit,story}.png`: antes | después, lienzo claro, crema y oscuro, con interfaz clara y oscura, en edición (nodo seleccionado) y en Historia (resaltado + evento con halo).
- `p15/proto-story-zoom.png`: el halo azul del punto terracota y el resaltado cian, antes y después.

Lectura del prototipo:

- **crema y claro**: mejora clara. Desaparece el azul lavado (2,5:1) y el color queda en lo que significa algo;
- **oscuro**: más calma, puntos de flujo más sobrios;
- **Historia**: halo y resaltado coherentes con el resto del sistema.

Se validó antes de implementar.

## 10. Fase 10 — Implementación (mínima)

| Archivo | Cambio |
|---|---|
| `js/config.js` (kernel) | `const DEFAULT_NODE_COLOR="#857F6C"` con su porqué. Nada más cambia: paleta, temas y muestras idénticos |
| `js/model.js` (kernel) | `createNodeIn`: `color:DEFAULT_NODE_COLOR`. `normalizeProjectNode`: sin cambio de código, un comentario que fija el respaldo histórico |
| `js/interaction.js` | Herramienta de animaciones: `DEFAULT_NODE_COLOR` |
| `js/ui.js` | La rejilla de color del nodo empieza por «Piedra (por defecto)» (para poder volver a él) |
| `js/render.js` | `activeMark(theme)` (lo usan `editorMark` y «Resaltar»); `FLOW_ACCENT = "#d08b5b"` (y el punto sin símbolo lo usa); pulso de imagen con `n.color`; respaldos `drawAnim`/`colHex` = `PALETTE[0].c` |
| `css/styles.css` | `.scPreviewNode.highlight` con `var(--active)` |
| `sw.js` | `CACHE` v74 |

No se tocan:

- `geometry.js`, `export.js`, `viewer.js`, `s/index.html`, `share.css` ni `system.css`;
- el formato, Historias como modelo, Share, Present, touch, panel, cabecera;
- funcionalidad del MCP.

fluyo-mcp:

- `sync:kernel` → `KERNEL_ID` `cbb6ec00dc614cdf35a5272b98eb1e0d03efd9ba7e999463aac6da28cdb3b9b2`;
- `sync:config` sin cambios de contenido (la constante nueva no se exporta: el MCP no la necesita fuera del kernel).

## 11. Compatibilidad (Fase 8)

- **Sin migración.** Ningún dato cambia al abrir, guardar, compartir o editar con el MCP. Comprobado:
  - en vm, sobre los 8 ejemplos, los 3 de regresión visual y los 2 de 017-1: 99 nodos, 34 con «Servicio» explícito; todos los colores (`color`, `fill`, `textColor`, `textBg`, `kwBg`, `kwColor`, `lineColor`, `dotColor`) idénticos tras abrir y guardar;
  - en Chrome, con el fixture de colores: explícitos intactos y nodo sin color leído como `#6a9fb5`;
  - en el MCP: `author_document` sobre el fixture conserva todos los colores.
- **Colores explícitos**: se conservan, también `#6a9fb5`.
- **Documento sin color en un nodo** (v1 o escrito a mano): sigue viéndose `#6a9fb5` en editor, Viewer, SVG y MCP.
- **Viewer y Share**: el mismo kernel y render. Un enlace ya compartido se ve igual salvo la reproducción de Historias (resaltado oliva, halo terracota), que es runtime.
- **SVG = editor = MCP**: misma firma de color en `buildSVGDocument` y en `export_diagram` para el fixture compartido (§ 12).
- **Goldens compartidos** (`fluyo-018-{2,3,5,6,7a,7c}-golden.json` y `fluyo-018-9-golden.json` del MCP):
  - regenerados con su mecanismo (`UPDATE_GOLDEN=1` / `FLUYO_UPDATE_GOLDEN=1`);
  - diff acotado: `#6a9fb5 → #857F6C` en nodos creados sin color y las revisiones derivadas;
  - el nodo con `#6a9fb5` explícito de 018-6 se conserva.
- **Orden de despliegue**: editor y MCP a la vez. Con kernels distintos, el mismo `create_diagram` daría colores distintos a los nodos nuevos. No hay riesgo para documentos existentes.

## 12. Tests (Fase 11)

### fluyo

- **Unitarios**: `node --test test/*.test.cjs` → **1058/1058** (1045 + 13 de `test/fluyo-018-15.test.cjs`):
  - contrato de `DEFAULT_NODE_COLOR` (y que es el punto medio de los tokens);
  - paleta, muestras, temas, fuente y tamaños idénticos a HEAD;
  - `model.js` idéntico a HEAD salvo exactamente el cambio;
  - toda forma nace piedra y lo explícito se conserva;
  - nodo sin color → `#6a9fb5`, también en un v1;
  - 13 documentos reales sin cambios;
  - ningún `PALETTE[0]` fuera de los respaldos históricos;
  - muestra del panel;
  - render sin cian, «Resaltar» con `activeMark`, `FLOW_ACCENT`, pulso de imagen, colores semánticos intactos;
  - vista previa del diálogo;
  - el Viewer sin colores propios;
  - fixture idéntico al del MCP;
  - `CACHE` v74.
- **Adaptados, con la misma intención**:
  - `fluyo-018-1.test.cjs`: el oráculo LEGACY de la fábrica refleja el único cambio deliberado (`DEFAULT_NODE_COLOR`) y el nodo mínimo nace `#857F6C`;
  - `fluyo-018-13/14a/14b.test.cjs`: «`model.js` idéntico a HEAD» deshace exactamente el cambio de 018.15 antes de comparar; el diff exacto lo fija el test de 018.15;
  - goldens compartidos regenerados (§ 11);
  - `fluyo-015-browser.cjs` y `fluyo-015-qa-browser.cjs`: el espía del «acento de llegada» mira `FLOW_ACCENT` (con el grosor del anillo, 2,4, para no confundirlo con un nodo terracota);
  - pins de `CACHE` v73 → v74: `010-qa`, `013`, `014`, `015`, `018-10` (test, browser, M8), `018-12` (test, U1), `018-13` (test, browser, U1), `018-14a` (test, U1), `018-14b` (test, browser, U8).
- **`test/fluyo-018-15-browser.cjs`** (Chrome real) → **576 ✔ · 0 ✘**, 0 errores de consola. 6 viewports × interfaz clara/oscura × lienzo claro/crema/oscuro (36 celdas). En cada celda:
  - nodos nuevos `#857F6C` y explícitos intactos;
  - la interfaz no toca el tema del documento;
  - primera muestra del panel marcada;
  - con selección: 0 px de cian, sin azul acero, trazo piedra y marco oliva;
  - fotograma de Historia: «Resaltar» oliva y halo terracota (0 px azules);
  - caja creada con el gesto real del rail (clic o toque) → `#857F6C`;
  - 0 errores.

  En las 18 celdas de interfaz clara, además:
  - documento antiguo abierto y guardado sin cambios;
  - color del trazo de cada nodo igual en editor, SVG rasterizado y Viewer;
  - firma de color del SVG = la de `export_diagram`;
  - **Historia real** (fixture 017-1, «Procesamiento» resalta con halo y brillo) en editor y Viewer: 0 px de cian en ~70 fotogramas y resaltado oliva presente.

### fluyo-mcp

- `npm test` → **650/650** (643 + 7 de `test/fluyo-018-15.test.ts`):
  - kernel y paleta;
  - `list_colors` sin cambios;
  - `create_diagram` y `author_document` sin color → `#857F6C`, y explícitos/«Servicio» → `#6a9fb5`;
  - documento antiguo;
  - firma de color de `export_diagram` = editor;
  - fixture idéntico.
- Adaptado: `fluyo-018-9.test.ts` (el default del dominio ya no es `PALETTE[0]`).
- `check:kernel`, `check:config` y `REQUIRE_FLUYO=1 check:kernel`: verdes.

### Mutaciones

- `test/fluyo-018-15-mutations.cjs`: **20/20 detectadas** (12 estáticas y 8 en Chrome):
  - U1–U12 estáticas: `CACHE`, vuelve `#6a9fb5`, `createNodeIn` con `PALETTE[0]`, migración de nodos sin color, repintado de `#6a9fb5` explícito, «Servicio» cambia, `FLOW_ACCENT` o «Resaltar» cian, herramienta de animaciones, muestra del panel, pulso de imagen, vista previa del diálogo;
  - B1–B8 en Chrome: vuelve `#6a9fb5`, **divergencia SVG**, **divergencia Viewer**, «Resaltar» cian en Historia real, halo cian, **migración de documentos antiguos**, **pérdida de un `#6a9fb5` explícito**, muestra del panel.
- `fluyo-mcp/scripts/mutate-018-15.ts`: **8/8**:
  - kernel con `#6a9fb5`;
  - `createNodeIn` con `PALETTE[0]`;
  - migración de nodos sin color;
  - repintado del explícito;
  - «Servicio» cambia;
  - **`export_diagram` diverge** (default pintado como «Servicio»);
  - texto de `text` sin su color;
  - **kernel del MCP sin sincronizar**.
- Regresión de mutaciones anteriores: 018.14a **17/17** (completa, Chrome incluido); 018.10 **9/9**, 018.12 **8/8**, 018.13 **6/6** y 018.14b **10/10** (estáticas).

### Batería y comprobaciones

- `node --check js/*.js`: OK. `git diff --check`: limpio en los dos repos.
- **Batería de Chrome existente** (26 suites, además de la de 018.15). Verdes sin cambios: 013, 013-qa, 014, 016, 017-3, 018-7d, 018-9 (36/36), 018-10 (18/18), 018-13, 018-14b, qa-share-hash, share-realistic-size; scenario-qa, share y share-post-qa terminan en su «NOT RUN — environment» habitual tras pasar lo local. `fluyo-011-browser`: los mismos 3 fallos previos (subtests 4, 6 y SW v45→v61), pendientes desde 018.12.
- **Suites adaptadas** porque fijaban lo que este slice cambia a propósito, todas en verde tras adaptarlas:
  - comparan con HEAD un documento hecho con nodos nuevos: 018-3, 018-4 (76), 018-5, 018-7a, 018-7c, 018-8 y 018-12 (285 ✔). Comparan tras deshacer **solo** `"color":"#857F6C"` → `"#6a9fb5"` (`UNDO15`, también en JSON anidado); todo lo demás debe seguir idéntico;
  - 018-3: además elegía la muestra del panel por posición (`nth(3)` = «IA»); la nueva muestra «Piedra» encabeza la rejilla, así que ahora la elige por su valor;
  - 018-14a-browser (230 ✔): sus BD llevan `#6a9fb5` explícito. Su detector de la tapa necesita un trazo saturado; con el neutro por defecto, el antialiasing de la etiqueta caía en la tolerancia;
  - 015 y 015-qa: el espía del «acento de llegada» mira `FLOW_ACCENT`/terracota con grosor 2,4 (comparado con tolerancia: el canvas devuelve el grosor en float32).

## 13. QA en Chrome (Fase 12)

Chrome 155 real (`channel: "chrome"`), 1440, 1280, 1101 (ratón), 768 (táctil), 390 y 375 (móvil), cada uno con interfaz clara y oscura y lienzo claro, crema y oscuro (las cuatro combinaciones pedidas, más crema).

- **Medido (browser test, 36 celdas)**: 0 px de cian en el lienzo con selección y en Historia; azul acero < 40 px (solo antialiasing) donde nadie lo pidió; trazo del nodo por defecto = `#857F6C`; selección y «Resaltar» oliva; halo del evento cálido (0 px azules); cabecera, panel y modo sin cambios.
- **SVG exportado**: firma de color idéntica a la de `export_diagram`, trazos rasterizados = editor, sin cian.
- **Viewer**: trazos = editor en los 6 nodos del fixture (incluido el histórico sin color, `#6a9fb5`); Historia real sin cian y con resaltado oliva.
- **`export_diagram`**: en el test del MCP (firma = editor) y con las mutaciones de divergencia.
- **Antes → después**, píxeles de azul acero en la pantalla completa (suma de las 6 combinaciones): 1440 31 931 → 6 501 · 1280 25 323 → 6 309 · 1101 18 649 → 6 297 · 768 21 830 → 11 982 · 390 613 → 39 · 375 531 → 39. Lo que queda en escritorio y tableta es la rejilla de color del panel (la muestra «Servicio» es paleta del usuario); por eso el cian de pantalla completa no varía y en móvil, con el panel cerrado, cae a cero.
- **Capturas** (scratchpad de la sesión):
  - `p15/qa/qa-<viewport>.png`: 12 pares antes | después por viewport, misma composición;
  - `t15/`: 126 capturas del browser test (editar, fotograma de Historia, Historia real y Viewer por celda);
  - `p15/qa-movil.png`: 390 con interfaz oscura, Historia y Viewer.
- 0 errores de consola en todas las celdas.

## 14. Desviaciones

- **D3 de 018.14 (colores de la reproducción)** estaba fuera de alcance «salvo contradicción directa». La auditoría encontró dos (§ 8) y se resolvieron con lo mínimo:
  - el anillo de éxito/fallo y los valores por defecto de los eventos no cambian;
  - es reversible en tres líneas de `render.js`.
- **Chips del diálogo de evento** (`rgba(58,167,232,…)`, `styles.css`): siguen. Son chrome de Historias; la tarea no toca la UI de Historias ni del panel.
- **`export_diagram` rechaza un nodo sin `color`.** Es previo a este slice, y el editor y `author_document` lo aceptan. Se documenta (§ 4, pregunta 6) y no se corrige: sería cambiar funcionalidad MCP.
- **Gris frío de las aristas en el tema oscuro** (`#777`): se documenta y no se cambia, porque repintaría todos los documentos.

## 15. Riesgos

- **Diagramas nuevos más sobrios en el lienzo oscuro.** Un diagrama sin categorías tiene puntos de flujo piedra sobre línea gris. Es intencional (el color comunica función), pero cambia la primera impresión de quien no usa la paleta. Si se ve demasiado apagado, la palanca es el valor de `DEFAULT_NODE_COLOR` (un punto más claro, ~`#8E8776`, sube el oscuro a 5:1 y deja crema en 3,1:1), no la paleta.
- **«Externo» `#8f8f8f` y el default** son los dos grises de un diagrama (ΔE 12,8: se distinguen, pero conviven dos neutros). El azul de antes estaba a ΔE 17,7 de «Info».
- **Un nodo `text` nuevo** se escribe en piedra: legible (≥ 3,5:1, texto grande), pero menos tinta que el texto del tema. Quien quiera tinta la elige (o fija `textColor`).
- **Kernel en dos repos**:
  - despliegue simultáneo de editor y MCP;
  - `kernel-sources.ts` dice «sincronizado desde 604b344» hasta el commit de fluyo;
  - volver a ejecutar `sync:kernel` tras el commit (el contenido no cambiará).
- **Historias ya compartidas**: su reproducción se ve con el resaltado oliva y el halo terracota en el Viewer y Present. No cambia ningún dato.

## 16. CACHE

`fluyo-static-v73` → **`fluyo-static-v74`**, un salto.

- Cambian los servidos `config.js`, `model.js`, `render.js`, `ui.js`, `interaction.js` y `styles.css`, todos ya en el precache.
- No hay archivos servidos nuevos.

## 17. git status (al cerrar)

Sin commit. **fluyo** — cambios de 018.15 (sobre los de 018.11–018.14b, que ya estaban):

- servidos: `js/config.js`, `js/model.js`, `js/render.js`, `js/ui.js`, `js/interaction.js`, `css/styles.css`, `sw.js`;
- documentación: `.ai/DECISIONS.md` (140–142), `.ai/ARCHITECTURE.md` (§ 018.15), esta tarea;
- fixtures: los 6 goldens compartidos; nuevo `test/fixtures/fluyo-018-15-colores.json`;
- tests nuevos: `test/fluyo-018-15.test.cjs`, `test/fluyo-018-15-browser.cjs`, `test/fluyo-018-15-mutations.cjs`;
- tests adaptados: `018-1`, `018-13`, `018-14a`, `018-14b` (test), `015`/`015-qa`/`018-3`/`018-4`/`018-5`/`018-7a`/`018-7c`/`018-8`/`018-12`/`018-14a` (browser) y los pins de `CACHE` v74.

**fluyo-mcp** — `src/generated/kernel-sources.ts` (`sync:kernel`), los 7 goldens (`stories/fluyo-018-{2,3,5,6,7a,7c}-golden.json` copiados de fluyo; `fluyo-018-9-golden.json` regenerado), `test/fluyo-018-9.test.ts`; nuevos `test/fluyo-018-15.test.ts`, `test/fixtures/fluyo-018-15-colores.json` y `scripts/mutate-018-15.ts`. `README.md`, `config.ts`, `svg.ts`, `render.test.ts` y `visual-regression.test.ts` llevan cambios de 018.14a, no de este slice.

## Handoff

### Estado actual

018.15 implementado y verificado. Sin commit, push ni deploy.

### Pendientes

- Revisar las decisiones 140–142 y, en especial, el riesgo de los puntos sobrios en el lienzo oscuro (§ 15).
- Chips del diálogo de evento todavía en cian (UI de Historias).
- Relleno «Color» por defecto del diálogo de evento (`#3aa7e8`, dato).
- `export_diagram` con nodos sin `color` (MCP).
- Desde 018.14: `fluyo-011-browser` (3 fallos previos), `fluyo-018-9-mutations` (M1–M4), `sync:kernel` tras el commit.

### Próximo paso concreto

1. Revisión del responsable (capturas de § 9 y § 13).
2. Con OK, commit de fluyo (018.11–018.15) y de fluyo-mcp (018.14a + 018.15), en ese orden; `npm run sync:kernel` en fluyo-mcp tras el commit de fluyo.
3. Desplegar editor y MCP a la vez (`CACHE` v74).
