# FLUYO-I18N-002 · S3b — Propiedades: auditoría e implementación

Estado: **CLOSED / VERIFIED / IN PRODUCTION** (2026-10-28). Auditoría READY FOR REVIEW → el PO aprobó D-S3b-1…14 tal cual
(decisiones 300–313) → implementada en el worktree `fluyo-new/fluyo-s3b` (rama `i18n-002-s3b`, base `747eff8`), `CACHE` v115 →
commit `09d7cea`, integrado en `main` por fast-forward y publicado (fluyo.space sirve v115; §24). La implementación y sus pruebas
están en §23; §0–§22 son la auditoría tal como se revisó. Tarea madre:
`.ai/tasks/FLUYO-I18N-002.md`. Precedente: `.ai/tasks/FLUYO-I18N-002-S3.md` (D-S3-9 → decisión 287: «Propiedades tiene una slice
propia»).

> Repo público: solo contenido técnico.

## 0. Base comprobada

- `main` = `747eff8` (cierre documental de S3a), código = `e39b7e3` (S3a, `CACHE` v114, en producción). Próxima `CACHE` libre: **v115**.
- `fluyo-mcp` = `464f4e0`, limpio. Kernel del MCP sin cambios desde S2b.
- Árbol de `main`: solo documentos `.ai` sin commit de otras sesiones (11 modificados, 3 sin seguimiento). Ningún archivo servido modificado.
- Lo auditado es lo de `HEAD`: el navegador sirvió una copia `git archive HEAD` en el scratchpad (no el árbol de trabajo).
- Volcado de literales por archivo y línea, fuera del repo: `s3b-literals.tsv` en el scratchpad de esta sesión (generado con
  `test/i18n-scan.cjs`, sin modificarlo).

## 1. Qué es «Propiedades»

El panel derecho en modo Editar (`<aside id="propPanel">`, `index.html:422–719`), en columna (escritorio y tableta) y como hoja
inferior (≤ 700 px). Es **un único panel** para los dos layouts (decisión 136, D9). Tiene:

| Zona | Elementos | Estado i18n hoy |
|---|---|---|
| Cabecera | `#selTitle`, `#selMeta`, orden de capas, Eliminar, plegar/cerrar | S1: título sin selección, plurales, botones. **Falta**: el metadato (`Caja · id 1`, `Conexión · 1 → 2`) y el título de reserva (`Caja sin texto`, `id 1 → Texto`) |
| Sin selección / selección múltiple | `#noSel`, `#multiSel` | S1: completo |
| Cuerpo de la selección | `#selBody`: el campo de contenido y 7 grupos `<details>` (Apariencia, Texto, Código, Movimiento, Trazo, Dirección, Puntos) | **Nada migrado** |
| JS del panel | `refreshPanel`, `SHAPE_NAMES`, `ARROW_NAMES`, swatches, «⋯», tipografías, cuentagotas (`js/ui.js:36–650`) | Solo los nombres de la paleta (S3a) y el grupo «Clásicas» (S1) |

Lo que **no** es Propiedades: el panel de Historias (`#panelScenarios`, S2a), el menú Lienzo (S1), los cajones de iconos/GIF (S3a),
la barra táctil (S1) y la ayuda de «Más» (decisión 277, sin slice).

## 2. Archivos implicados

| Archivo | Papel en Propiedades | ¿Tiene texto por migrar? |
|---|---|---|
| `index.html` (`#propPanel`) | Todo el marcado del panel | **Sí: 154 textos** sin marca (de los 219 que quedan en el archivo; los otros 65 son la ayuda de «Más» y el `<title>`) |
| `js/ui.js` | `refreshPanel` (rótulos que cambian por tipo), cabecera, swatches, «⋯», tipografías, puntas, cuentagotas, repintado en vivo (`paintChromeText`, `onChange`) | **Sí: 47 literales** que ve el escáner + 8 concatenaciones que no ve (§6) |
| `js/state.js` | `paletteName` (S3a) | No |
| `js/selection.js` | `selectOnly`, `singleSel` | No (0 literales) |
| `js/interaction.js` | atajo R (ruta automática), Supr | No (sus 12 «literales» son nombres de tecla: falsos positivos) |
| `js/editor-scenarios.js` | `scRenderCanvasActions` (vacía desde que la autoría salió del inspector) | No |
| `js/render.js` | No pinta nada de Propiedades | No |
| `js/config.js` (kernel) | `FONTS` (nombres de fuente), `PALETTE`, `SWATCH_COLORS`, `CODE_DEFAULT_LABEL` | No se traduce (§4) |
| `js/model.js` (kernel) | `edgeKind`, `edgeArrowSize`, `updateNodeIn`/`updateConnectionIn` | Ningún texto visible |
| `css/styles.css`, `css/system.css` | Panel, segmentados, `.selMeta` en mayúsculas; tokens CJK de S4 | No hay texto. **Ningún cambio de CSS necesario** (§5.2) |
| `js/i18n-en-editor.js` | Diccionario del editor (652 claves hoy) | Recibe las claves nuevas |
| `sw.js` | Precache | Solo `CACHE` |

Ningún texto de Propiedades lo carga el Viewer (`s/index.html`) ni el MCP: todo va al diccionario **del editor**.

## 3. Inventario completo de literales

Clasificación: **UI** = interfaz estática traducible · **NT** = no se traduce (técnico, marca, formato, identificador) · **C** =
contenido del autor (nunca se traduce) · **JS** = lo pinta JS según el estado (marca `data-i18n-js` en el HTML).

### 3.1 Cabecera de la selección (`js/ui.js:163–192`)

| Texto | Dónde | Clase | Nota |
|---|---|---|---|
| `Caja`, `BD`, `Rombo`, `Círculo`, `Hexágono`, `Texto`, `Código`, `Icono`, `Imagen` (`SHAPE_NAMES`) | metadato, título de reserva, valor junto a «Forma» | UI | `GIF` = NT (formato) |
| `{forma} · id {id}` | `#selMeta` (en mayúsculas por CSS) | UI (plantilla) | hoy concatenado |
| `Conexión · {a} → {b}` | `#selMeta` de una conexión | UI (plantilla) | hoy concatenado |
| `{forma} sin texto` | `#selTitle` de un nodo sin texto | UI (plantilla) | hoy concatenado; rompe el orden en ja/zh |
| `Elemento` | reserva de una forma desconocida | UI | |
| `{a} → {b}`, `id {id}` | `#selTitle` de una conexión sin texto | UI (plantilla) | los nombres de los extremos son C |
| primera línea del texto del elemento | `#selTitle` | C | |

### 3.2 Campo de contenido (`index.html:461–464`, `ui.js:81`)

| Texto | Clase | Nota |
|---|---|---|
| `Texto` / `Código` (`#lblEditLbl`) | JS | cambia con la forma (`code` → «Código») |
| valor de `#lblEdit` | C | en un `code` recién creado, `CODE_DEFAULT_LABEL` (SQL): C |

### 3.3 Apariencia (`index.html:465–516`)

| Texto | Clase | Nota |
|---|---|---|
| `Apariencia` (summary) | UI | `data-group="Apariencia"` = **NT**: identificador, no se ve, lo fijan 4 tests |
| `Forma` + valor (`#shapeValue`) | UI | |
| 7 botones de forma: `aria-label` + `data-tip` (Caja, BD, Rombo, Círculo, Hexágono, Texto, Código) | UI | mismo texto que `SHAPE_NAMES` |
| 7 `<option>` de `#shapeSel` (oculto, `aria-hidden`) | UI | espejo del segmentado (decisión 36) |
| `Borde` / `Color` (`#colorLbl`) | JS | «Color» en texto suelto, icono y GIF |
| `title` «Color personalizado del borde» + `Personalizado` | UI | |
| `title` «Cuentagotas: tomar un color del lienzo» + `Cuentagotas` | UI | |
| `alert` «Tu navegador no soporta el cuentagotas (usa Chrome o Edge).» (`ui.js:358`) | UI | diálogo nativo (decisión 280) |
| `Teñir el icono con el color` | UI | solo icono |
| `Relleno` / `Panel` (`#fillLbl`) | JS | «Panel» en un `code` |
| `title` «Color de relleno personalizado» + `Personalizado` | UI | |
| `Línea del borde` | UI | |
| `Sólido`, `Discontinuo`, `Punteado` (3 `aria-label` + 3 `<option>` ocultas) | UI | |

### 3.4 Texto (`index.html:517–550`)

| Texto | Clase | Nota |
|---|---|---|
| `Texto` (summary) | UI | `data-group` NT |
| `Tipografía` (`<label>` oculto + `aria-label` del select) | UI | |
| `(Global)` (primera opción de `#fontSel`, `ui.js:468`) | UI | la pinta JS una vez |
| nombres de fuente (`Playfair Display`, `IBM Plex Mono`, clásicas) | NT | nombres propios; el grupo «Clásicas» ya es S1 |
| `Tamaño de texto` (`title` + `aria-label`) · placeholder `auto` | UI | |
| `Negrita` (`title` + `aria-label`) · glifo `N` | UI | el glifo cambia por idioma (D-S3b-8) |
| `Color` / `Texto del código` (`#textColorLbl`) | JS | |
| `Fondo` / `Fondo del bloque` (`#textBgLbl`) | JS | |
| `title` «Color de texto personalizado», «Fondo de texto personalizado» + 2 × `Personalizado` | UI | |
| `Posición` · `Centro`, `Arriba`, `Abajo`, `Izquierda`, `Derecha` | UI | posición del rótulo |

### 3.5 Código (`index.html:553–589`, solo `code`)

| Texto | Clase | Nota |
|---|---|---|
| `Código` (summary) | UI | |
| `Resaltado` · `SQL` · `Ninguno` · `Lista propia` (segmentado) | UI / `SQL` = NT | |
| `<option>` ocultas: `SQL / ksqlDB` (NT), `Ninguna`, `Lista propia…` | UI | **difieren** del segmentado (D-S3b-5) |
| `Lista propia (separadas por espacios o comas)` | UI | |
| placeholder `SELECT FROM WHERE` | NT | palabras clave SQL |
| `Palabra clave`, `Caja de la palabra clave` + 2 `title` + 2 × `Personalizado` | UI | |

### 3.6 Movimiento (`index.html:590–597`)

| Texto | Clase | Nota |
|---|---|---|
| `Movimiento` (summary) · `Pulso (resaltar)` · `Orden de aparición` | UI | «Reveal order» (decisión 278) |
| `Se usa con «Animar aparición», en Lienzo.` | UI | cita el rótulo `canvas.build` y el menú `editor.canvas` (§6, D-S3b-11) |

### 3.7 Trazo (`index.html:598–629`, conexión)

| Texto | Clase | Nota |
|---|---|---|
| `Trazo` (summary) · `Color` · `title` «Color de línea personalizado» · `Personalizado` | UI | |
| `Línea punteada` | UI | |
| `Ruta` · `Recta` · `Ortogonal` (+ 2 `<option>` ocultas) | UI | |
| `Volver a la ruta automática` + `title` «Descarta los tramos que has movido a mano y vuelve al ruteo automático (R)» | UI | `R` es el atajo (no cambia) |
| `Sale por` / `Entra por` · `Auto`, `Arriba`, `Derecha`, `Abajo`, `Izquierda` (× 2 selects) | UI | lado del nodo, no posición del rótulo (D-S3b-4) |

### 3.8 Dirección (`index.html:634–671`)

| Texto | Clase | Nota |
|---|---|---|
| `Dirección` (summary y `#dirKicker`) | UI | |
| `Puntas` + valor (`#arrowsValue`, `ARROW_NAMES`, `ui.js:568`) | UI | |
| `Ninguna`, `Inicio`, `Fin`, `Ambas` (`aria-label` + `data-tip`) | UI | mismos textos que `ARROW_NAMES` |
| `Tamaño de flecha` · `1×`, `2×` (NT) · `1,5×` (UI: separador decimal) (+ 3 `<option>` ocultas) | UI / NT | D-S3b-7 |
| `Punta al inicio`, `Punta al final` (filas ocultas, espejo) | UI | |
| `Puntos en movimiento` · `El sentido de los puntos se elige al ponerlos en movimiento.` | UI | |
| `Sentido de los puntos` · `Hacia el destino`, `Hacia el origen`, `Ida y vuelta` (+ 3 `<option>` ocultas) | UI | |

### 3.9 Puntos (`index.html:672–716`)

| Texto | Clase | Nota |
|---|---|---|
| `Puntos` (summary) · `Semántica` · `Conexión`, `Flujo`, `Requisito` | UI | vocabulario de SEMANTICS (D-S3b-10) |
| `La punta visible apunta en sentido contrario al flujo. El flujo se calcula de origen a destino; la punta solo cambia la apariencia.` | UI | aviso W5 |
| `Color de puntos` + `title` + `Personalizado` | UI | |
| `Velocidad (× global)` · `1×`…`4×` (NT) · `<option>` oculta `1× (global)` | UI / NT | |
| `Puntos globales` · `Puntos (esta flecha)` | UI | |

### 3.10 Muestras de color (`js/ui.js:242–460`)

| Texto | Clase | Nota |
|---|---|---|
| `Piedra (por defecto)` (`:263`) | UI | color con que nace un nodo |
| `Personalizado {hex}` (`:279`, `title` + `aria-label`) | UI (plantilla) | hoy concatenado; `{hex}` NT |
| `Automático (semitransparente)`, `Sin relleno` (`:295–296`) | UI | `"Sin relleno"` lo fija `fluyo-018-6.test.cjs:87` |
| `Sin fondo` (`:299`), `Automático (según la forma y el tema)` (`:304`), `Del tema` (`:310–311`), `Auto` (`:379`) | UI | |
| 8 `aria-label` de rejilla (`enableSwatchKeyboard`, `:306–313, 384–385`) | UI | se ponen una vez al cargar |
| «⋯»: `Más colores`, `Menos colores` (`data-tip`), `Más colores, personalizado` / `… y cuentagotas` (`aria-label`, `:432`) | UI | hoy concatenado con «y» |
| títulos de `SWATCH_COLORS` (`#rrggbb`) | NT | |
| nombres de la paleta | ya migrados (S3a) | |

**Textos que solo aparecen con determinados tipos de nodo:** «Código/Panel/Texto del código/Fondo del bloque» y el grupo Código
(`code`); «Teñir el icono…» (icono); «Color» en lugar de «Borde» (texto, icono, GIF); sin «Forma» (icono, imagen, GIF); sin color
de borde (imagen); «Posición» (formas con caja y texto); «Fondo» (texto y `code`); «Se usa con…» (solo sin «Animar aparición»
activo); «Volver a la ruta automática» (conexión con tramos a mano); «Tamaño de flecha» (con alguna punta); «Sentido de los puntos»
o la nota (según `animated`); «Puntos (esta flecha)» (sin puntos globales); el aviso W5 (Flujo con solo punta de inicio).

## 4. Clasificación por origen

| Origen | Qué | ¿Se traduce en S3b? |
|---|---|---|
| **UI estática del editor** | todo lo de §3 marcado UI/JS (≈ 130 textos distintos) | **Sí** |
| **Contenido del autor** | texto del elemento (`label`), lista de palabras clave, títulos derivados de etiquetas, `CODE_DEFAULT_LABEL` sembrado | No (decisiones 276, 282) |
| **Generado por el kernel** | ninguno. `model.js` no compone ningún texto que muestre Propiedades | — |
| **Compartido con Viewer/MCP** | ninguno. El Viewer no carga Propiedades. El MCP describe `FLOWS_TO`/`REQUIRES` en su propio texto (`fluyo-mcp/src/*.ts`), independiente | — |
| **De `config.js`** | nombres de fuente (NT), paleta (S3a), `SWATCH_COLORS` (hex, NT) | No |
| **Identificadores** | `data-group="…"`, valores `data-v`, `value` de `<option>` | No: son claves, no texto |

## 5. Comportamiento actual medido

### 5.1 Con `?lang=en` (Chromium del panel de la app, copia de `HEAD`)

Se crearon una caja, un texto, un `code`, un icono y una conexión, y se seleccionaron uno a uno:

- La cabecera ya sale en inglés donde S1 la migró: título «Node», «Text», «2 elements», recuento «1 node · 1 arrow».
- **Todo `#selBody` sale en español**: «Apariencia», «Forma», «Borde», «Relleno», «Línea del borde», «Tipografía», «N», «Posición»,
  «Movimiento», «Pulso (resaltar)», «Trazo», «Ruta», «Sale por», «Puntas», «Sentido de los puntos», «Semántica», «Requisito»…
- Metadato en español: «Caja · id 1», «Conexión · 1 → 2». Reserva en español: «Caja sin texto», «Icono sin texto», «id 1 → Text»
  (mezcla: «id» del código y «Text», el nombre sembrado en inglés por S3a).
- **`FluyoI18n.missing()` = 0**: como nada de esto pasa por `t()`, no se anota como «falta». La prueba de que falta tiene que ser un
  detector de español visible, no `missing()`.

### 5.2 Holgura del layout (francés y similares)

Se aplicó a los textos de `#selBody` la transformación de `qps` (+ 40 % de longitud, acentos) con el panel en su ancho mínimo
(216 px, ventana de 1024 px) y se buscaron desbordes:

- Ningún rótulo, segmentado ni `summary` se sale: los segmentados ya parten (`white-space:normal; overflow-wrap:anywhere`, P1 de 018.23).
- Altura del cuerpo: caja 692 → 711 px (+3 %), `code` 972 → 1020 (+5 %), conexión 989 → 1077 (+9 %).
- Solo «desbordan» los espejos ocultos (`.srOnly`) y el título con elipsis, que es lo diseñado.
- Japonés y chino: los tokens de S4 ya cubren el panel (`--font-cjk` en `--font-mono`, 12 px de suelo, peso 600 en `.seg > .segBtn` y
  `.pgroup > summary` para chino, sin `text-transform`, tooltips que parten). **No hace falta CSS en S3b.**

## 6. Concatenaciones e interpolaciones

| # | Sitio | Hoy | Problema | Propuesta |
|---|---|---|---|---|
| C1 | `ui.js:182` | `SHAPE_NAMES[s]+" · id "+id` | orden fijo; «id» no traducible | plantilla `sel.meta.node` «{shape} · id {id}» |
| C2 | `ui.js:182` | `"Conexión · "+from+" → "+to` | idem | `sel.meta.edge` «Conexión · {from} → {to}» |
| C3 | `ui.js:190` | `SHAPE_NAMES[s]+" sin texto"` | **rompe ja/zh** (el modificador va delante: 「テキストなしの{shape}」) | `sel.untitled` «{shape} sin texto» |
| C4 | `ui.js:191` | `"id "+id` | | `sel.idRef` «id {id}» |
| C5 | `ui.js:192` | `name(a)+" → "+name(b)` | flecha y espacios fijos | `sel.edgeTitle` «{from} → {to}» (los nombres son contenido) |
| C6 | `ui.js:279` | `"Personalizado "+hex` (× 2) | orden fijo | `prop.sw.customHex` «Personalizado {hex}» |
| C7 | `ui.js:432` | `"Más colores, personalizado"+(borde ? " y cuentagotas" : "")` | **lista con «y» pegada**: rompe fr/ja/zh | dos frases completas: `prop.sw.moreAria`, `prop.sw.moreAriaEyedrop` |
| C8 | `index.html:469, 639` | `Forma <span id=shapeValue>` · `Puntas <span id=arrowsValue>` | rótulo + valor yuxtapuestos | **aceptable**: no es una frase; `applyDom` conserva el hijo y el espacio |
| C9 | `ui.js:180` | recuentos unidos con « · » | — | ya decidido en S1 (piezas nominales completas) |
| C10 | `index.html:595` | «Se usa con «Animar aparición», en Lienzo.» | cita literal de otros dos rótulos | frase completa + test de coherencia (D-S3b-11) |
| C11 | `index.html:619` | «… (R)» | atajo dentro de la frase | frase completa; `R` no cambia |

## 7. Plurales, listas, género, espacios, unidades

- **Plurales**: ninguno nuevo. Los recuentos de la cabecera son de S1 (`sel.nodes`, `sel.edges`, `sel.title`, con `{one, other}`).
- **Listas**: una, C7. Se resuelve con dos frases completas (no hace falta `FluyoI18n.list`).
- **Género**: el español concuerda dentro de cada texto («Ninguno» = resaltado, «Ninguna» = puntas; «personalizado/personalizada»).
  Francés tiene el mismo problema (Aucun/Aucune) → **una clave por contexto, nunca una clave por coincidencia de texto español**
  (D-S3b-4). C3 no tiene problema de género en es/en/fr/ja/zh (la forma va como sustantivo).
- **Espacios**: francés exige espacio fino antes de «:» («Pipette : …»; lo vigila el test de tipografía de S0). Japonés y chino sin
  espacios pegados por el código: C1–C7 pasan a plantillas.
- **Unidades y números**: `1,5×` lleva separador decimal (en «1.5×»; fr «1,5×»); `1×`–`4×` son iguales en todos (NT); «auto» del
  tamaño; los números de los campos (`fsIn`, `orderIn`, `edgeDotsIn`) son `<input type=number>` sin texto.
- **Mayúsculas**: `#selMeta` en mayúsculas por CSS («BOX · ID 1» en inglés); en ja/zh S4 anula `text-transform`.
- **Glifos**: «⋯» y la flecha «→» no son texto; el glifo de negrita sí (D-S3b-8).

## 8. ¿Toca kernel o MCP?

| Archivo | ¿Cambia? | Por qué |
|---|---|---|
| `js/model.js` | **No** | no compone texto de Propiedades; los valores (`flowDir`, `kind`, `arrowSize`…) no cambian |
| `js/config.js` | **No** | fuentes = nombres propios; paleta ya resuelta en S3a por clave (decisión 284) |
| `js/story-playback.js` | **No** | Propiedades no muestra narrativa |
| `js/safe-svg.js` | **No** | la exportación no lleva texto de Propiedades |
| otros del kernel (`scenario-engine.js`, `scenario-playback.js`, `document-integrity.js`, `story-authoring.js`) | **No** | |
| `fluyo-mcp` | **No** | `KERNEL_SCRIPTS` (`scripts/sync-kernel.ts:32`) no incluye `index.html` ni `ui.js`; el MCP no tiene superficie de Propiedades |

`kernelId` de producción (`f1fe2c32…`) no cambia.

## 9. Dependencias con el trabajo CJK pendiente

| Pendiente | ¿Afecta a S3b? | Por qué |
|---|---|---|
| nodos `code` con celdas dobles | No | es el dibujo del contenido en el lienzo (kernel); el grupo Código solo elige resaltado y colores |
| `xml:lang` en el SVG exportado | No | Propiedades no se exporta |
| IME | **No hay riesgo nuevo** | los campos de texto del panel (`#lblEdit`, `#kwEdit`) son `<textarea>` sin Enter que confirme; el teclado global ignora `INPUT`/`TEXTAREA`. Se añade una comprobación de QA (una composición = una entrada de Undo) |
| exportación | No | |
| fuentes | No | S4 ya cubre el panel (§5.2) |
| revisión nativa (275) y plataformas (D-S4-9) | No bloquea | S3b entrega inglés; fr/ja/zh caen al inglés |

## 10. Idiomas

- Hoy: es (base, publicado); en 652 + 81 claves (no publicado); fr/ja/zh 29 + 54 claves cada uno (las de S0), caen al inglés.
- Propuesta: **S3b entrega solo inglés** (como 288 y 295). fr/ja/zh sin claves nuevas. Japonés y chino se demuestran con el arnés
  `qps`/escritura CJK de prueba (plantillas completas, sin espacios del código), sin traducciones provisionales. Los términos nuevos
  van como propuesta al glosario (`.ai/I18N-GLOSSARY.md`) con ⚑ para la revisión nativa (D-S3b-10).

## 11. Claves nuevas (130, todas en `js/i18n-en-editor.js`)

Espacios de nombres: `prop.*` (cuerpo del panel), `shape.*` (nombres de forma), `sel.*` (cabecera; ya existe en S1). El inglés es
la propuesta; las marcadas ⚑ dependen de D-S3b-10.

| # | Clave | Español (base) | Inglés propuesto |
|---|---|---|---|
| 1 | `prop.group.appearance` | Apariencia | Appearance |
| 2 | `prop.group.text` | Texto | Text |
| 3 | `prop.group.code` | Código | Code |
| 4 | `prop.group.motion` | Movimiento | Motion |
| 5 | `prop.group.stroke` | Trazo | Stroke |
| 6 | `prop.group.direction` | Dirección | Direction |
| 7 | `prop.group.dots` | Puntos | Dots |
| 8 | `prop.content.text` | Texto | Text |
| 9 | `prop.content.code` | Código | Code |
| 10 | `shape.rect` | Caja | Box |
| 11 | `shape.cylinder` | BD | DB |
| 12 | `shape.diamond` | Rombo | Diamond |
| 13 | `shape.circle` | Círculo | Circle |
| 14 | `shape.hex` | Hexágono | Hexagon |
| 15 | `shape.text` | Texto | Text |
| 16 | `shape.code` | Código | Code |
| 17 | `shape.icon` | Icono | Icon |
| 18 | `shape.image` | Imagen | Image |
| 19 | `shape.unknown` | Elemento | Element |
| 20 | `prop.shape` | Forma | Shape |
| 21 | `prop.border` | Borde | Border |
| 22 | `prop.color` | Color | Color |
| 23 | `prop.fill` | Relleno | Fill |
| 24 | `prop.panel` | Panel | Panel |
| 25 | `prop.codeText` | Texto del código | Code text |
| 26 | `prop.background` | Fondo | Background |
| 27 | `prop.blockBg` | Fondo del bloque | Block background |
| 28 | `prop.keyword` | Palabra clave | Keyword |
| 29 | `prop.keywordBox` | Caja de la palabra clave | Keyword box |
| 30 | `prop.dotColor` | Color de puntos | Dot color |
| 31 | `prop.custom` | Personalizado | Custom |
| 32 | `prop.customBorder` | Color personalizado del borde | Custom border color |
| 33 | `prop.customFill` | Color de relleno personalizado | Custom fill color |
| 34 | `prop.customText` | Color de texto personalizado | Custom text color |
| 35 | `prop.customTextBg` | Fondo de texto personalizado | Custom text background |
| 36 | `prop.customKw` | Color de la palabra clave personalizado | Custom keyword color |
| 37 | `prop.customKwBox` | Caja de la palabra clave personalizada | Custom keyword box |
| 38 | `prop.customLine` | Color de línea personalizado | Custom line color |
| 39 | `prop.customDot` | Color de puntos personalizado | Custom dot color |
| 40 | `prop.eyedropper` | Cuentagotas | Eyedropper |
| 41 | `prop.eyedropperHint` | Cuentagotas: tomar un color del lienzo | Eyedropper: pick a color from the canvas |
| 42 | `prop.eyedropperUnsupported` | Tu navegador no soporta el cuentagotas (usa Chrome o Edge). | Your browser doesn't support the eyedropper (use Chrome or Edge). |
| 43 | `prop.tint` | Teñir el icono con el color | Tint the icon with the color |
| 44 | `prop.borderLine` | Línea del borde | Border line |
| 45 | `prop.line.solid` | Sólido | Solid |
| 46 | `prop.line.dashed` | Discontinuo | Dashed |
| 47 | `prop.line.dotted` | Punteado | Dotted |
| 48 | `prop.font` | Tipografía | Font |
| 49 | `prop.fontSize` | Tamaño de texto | Text size |
| 50 | `prop.fontSizeAuto` | auto | auto |
| 51 | `prop.bold` | Negrita | Bold |
| 52 | `prop.boldGlyph` | N | B |
| 53 | `prop.fontGlobal` | (Global) | (Global) |
| 54 | `prop.position` | Posición | Position |
| 55 | `prop.pos.center` | Centro | Center |
| 56 | `prop.pos.top` | Arriba | Top |
| 57 | `prop.pos.bottom` | Abajo | Bottom |
| 58 | `prop.pos.left` | Izquierda | Left |
| 59 | `prop.pos.right` | Derecha | Right |
| 60 | `prop.highlight` | Resaltado | Highlighting |
| 61 | `prop.highlight.none` | Ninguno | None |
| 62 | `prop.highlight.custom` | Lista propia | Custom list |
| 63 | `prop.highlight.noneOpt` | Ninguna | None |
| 64 | `prop.highlight.customOpt` | Lista propia… | Custom list… |
| 65 | `prop.kwList` | Lista propia (separadas por espacios o comas) | Custom list (separated by spaces or commas) |
| 66 | `prop.pulse` | Pulso (resaltar) | Pulse (highlight) |
| 67 | `prop.order` | Orden de aparición | Reveal order |
| 68 | `prop.orderNote` | Se usa con «Animar aparición», en Lienzo. | Used with “Animate reveal”, under Canvas. |
| 69 | `prop.dashed` | Línea punteada | Dashed line |
| 70 | `prop.route` | Ruta | Routing |
| 71 | `prop.route.straight` | Recta | Straight |
| 72 | `prop.route.ortho` | Ortogonal | Orthogonal |
| 73 | `prop.autoRoute` | Volver a la ruta automática | Back to automatic routing |
| 74 | `prop.autoRouteHint` | Descarta los tramos que has movido a mano y vuelve al ruteo automático (R) | Discards the segments you moved by hand and goes back to automatic routing (R) |
| 75 | `prop.exitSide` | Sale por | Leaves from |
| 76 | `prop.entrySide` | Entra por | Enters at |
| 77 | `prop.side.auto` | Auto | Auto |
| 78 | `prop.side.n` | Arriba | Top |
| 79 | `prop.side.e` | Derecha | Right |
| 80 | `prop.side.s` | Abajo | Bottom |
| 81 | `prop.side.w` | Izquierda | Left |
| 82 | `prop.arrows` | Puntas | Arrowheads ⚑ |
| 83 | `prop.arrows.none` | Ninguna | None |
| 84 | `prop.arrows.start` | Inicio | Start |
| 85 | `prop.arrows.end` | Fin | End |
| 86 | `prop.arrows.both` | Ambas | Both |
| 87 | `prop.arrowSize` | Tamaño de flecha | Arrowhead size |
| 88 | `prop.arrowSize15` | 1,5× | 1.5× |
| 89 | `prop.arrS` | Punta al inicio | Arrowhead at start |
| 90 | `prop.arrE` | Punta al final | Arrowhead at end |
| 91 | `prop.animated` | Puntos en movimiento | Moving dots |
| 92 | `prop.flowNote` | El sentido de los puntos se elige al ponerlos en movimiento. | You choose the dots' direction once they're moving. |
| 93 | `prop.flowDir` | Sentido de los puntos | Dot direction |
| 94 | `prop.flow.normal` | Hacia el destino | Toward the target |
| 95 | `prop.flow.reverse` | Hacia el origen | Toward the source |
| 96 | `prop.flow.alternate` | Ida y vuelta | Back and forth |
| 97 | `prop.kind` | Semántica | Semantics ⚑ |
| 98 | `prop.kind.generic` | Conexión | Connection |
| 99 | `prop.kind.flows` | Flujo | Flow ⚑ |
| 100 | `prop.kind.requires` | Requisito | Requirement ⚑ |
| 101 | `prop.kindNote` | La punta visible apunta en sentido contrario al flujo. El flujo se calcula de origen a destino; la punta solo cambia la apariencia. | The visible arrowhead points against the flow. The flow runs from source to target; the arrowhead only changes how it looks. |
| 102 | `prop.speed` | Velocidad (× global) | Speed (× global) |
| 103 | `prop.speedGlobal` | 1× (global) | 1× (global) |
| 104 | `prop.dotsGlobal` | Puntos globales | Global dots |
| 105 | `prop.dotsOwn` | Puntos (esta flecha) | Dots (this arrow) |
| 106 | `prop.sw.default` | Piedra (por defecto) | Stone (default) |
| 107 | `prop.sw.customHex` | Personalizado {hex} | Custom {hex} |
| 108 | `prop.sw.autoFill` | Automático (semitransparente) | Automatic (semi-transparent) |
| 109 | `prop.sw.noFill` | Sin relleno | No fill |
| 110 | `prop.sw.noBg` | Sin fondo | No background |
| 111 | `prop.sw.autoText` | Automático (según la forma y el tema) | Automatic (by shape and theme) |
| 112 | `prop.sw.theme` | Del tema | From the theme |
| 113 | `prop.sw.auto` | Auto | Auto |
| 114 | `prop.swg.border` | Color de línea o borde | Line or border color |
| 115 | `prop.swg.fill` | Relleno de la forma | Shape fill |
| 116 | `prop.swg.textBg` | Fondo del texto | Text background |
| 117 | `prop.swg.text` | Color del texto | Text color |
| 118 | `prop.swg.kwBg` | Fondo del resaltado | Highlight background |
| 119 | `prop.swg.kwText` | Texto del resaltado | Highlight text |
| 120 | `prop.swg.line` | Color de línea de la flecha | Arrow line color |
| 121 | `prop.swg.dots` | Color de los puntos animados | Animated dot color |
| 122 | `prop.sw.more` | Más colores | More colors |
| 123 | `prop.sw.less` | Menos colores | Fewer colors |
| 124 | `prop.sw.moreAria` | Más colores, personalizado | More colors and custom |
| 125 | `prop.sw.moreAriaEyedrop` | Más colores, personalizado y cuentagotas | More colors, custom and eyedropper |
| 126 | `sel.meta.node` | {shape} · id {id} | {shape} · id {id} |
| 127 | `sel.meta.edge` | Conexión · {from} → {to} | Connection · {from} → {to} |
| 128 | `sel.untitled` | {shape} sin texto | {shape} without text |
| 129 | `sel.edgeTitle` | {from} → {to} | {from} → {to} |
| 130 | `sel.idRef` | id {id} | id {id} |

Notas:
- Las `<option>` ocultas reutilizan la clave de su segmentado cuando el español coincide (forma, línea, ruta, sentido, `1,5×`);
  las que difieren tienen la suya (63, 64, 103). Las filas espejo `Punta al inicio/final` tienen las suyas (89, 90).
- Los 7 botones de forma usan `shape.*` en `aria-label` y `data-tip`; las 4 puntas usan `prop.arrows.*` en `aria-label`, `data-tip`
  y `ARROW_NAMES`.
- **Ninguna clave existente se reutiliza.** `rail.box`, `rail.db`… tienen el mismo español, pero son rótulos de herramienta y
  pueden abreviar («Hex» en el rail); `canvas.font` es la tipografía global (D-S3b-3).
- Claves en uso: 733 hoy (escáner) → 863 tras S3b. `js/i18n-en-editor.js` pasa de 33,6 KB a ≈ 42 KB (presupuesto del editor
  ≤ 400 KB, decisión 272).
- Sin `translate="no"` (NT): `GIF`, `SQL`, `SQL / ksqlDB`, `1×`, `2×`, `3×`, `4×`, nombres de fuente, `SELECT FROM WHERE` (D-S3b-6).

## 12. Archivos exactos

**Se modifican (servidos):**

| Archivo | Cambio |
|---|---|
| `index.html` | `data-i18n` / `data-i18n-title` / `-aria-label` / `-tip` / `-placeholder` en los 154 textos de `#propPanel`; `data-i18n-js` en los 5 rótulos que cambia JS; `translate="no"` en los NT. Los `data-group`, ids, `data-v` y `value` no cambian. Los atributos nuevos van **después** de `data-v` / `aria-label` (§17, R1) |
| `js/ui.js` | `SHAPE_NAMES` y `ARROW_NAMES` con getters `FluyoI18n.t` (mismas llamadas `SHAPE_NAMES[x]`, `ARROW_NAMES[v]`); C1–C7 como plantillas; rótulos de `refreshPanel` con `t()`; muestras especiales, rejillas, «⋯», «(Global)» y el `alert` del cuentagotas con `t()` y repintado en `paintChromeText` (patrón `data-palette` de S3a) |
| `js/i18n-en-editor.js` | las 130 claves |
| `sw.js` | `CACHE` v114 → **v115** |

**Se modifican (no servidos):** `test/fluyo-i18n-002-s3b.test.cjs`, `-browser.cjs`, `-mutations.cjs`, `-undo.cjs` (nuevos);
`test/fluyo-i18n-002-s3a-undo.cjs` (llama a `undoS3b` la primera); `test/fluyo-i18n-001-baseline.json` (`index.html` 219 → 65,
`js/ui.js` 70 → 23); pines de `CACHE` (81 tests citan v114); ajustes de pines de marcado (R1: `fluyo-018-27.test.cjs:236, 238`;
`fluyo-018-15-mutations.cjs` U10/B8); `test/i18n-scan.cjs` solo si D-S3b-6 = A; `.ai/tasks/FLUYO-I18N-002-S3b.md`. Al aprobar:
`.ai/DECISIONS.md` y `.ai/I18N-GLOSSARY.md` (propuesta ⚑).

**No se tocan:** `js/model.js`, `js/config.js`, `js/story-playback.js`, `js/safe-svg.js`, el resto del kernel, `js/state.js`,
`js/selection.js`, `js/interaction.js`, `js/render.js`, `js/i18n.js`, `css/*`, `js/i18n-en.js` (común), `js/i18n-{fr,ja,zh}*.js`,
`s/index.html`, `fluyo-mcp`.

## 13. CACHE

**v115** (siguiente libre; EXAMPLES-001 sigue en pausa y no la reclama). Si otra slice publica antes, la siguiente libre y se
regenera `undoS3b`.

## 14. Tests, mutaciones, undo y Chrome real

### 14.1 Test propio (`node --test`, vm + escáner)

1. **Catálogo**: las 130 claves en uso, con su español literal; en inglés todas; mismos `{param}`; ninguna clave sin uso.
2. **Región sin marca = 0**: `scan.unmarked("index.html", '<aside id="propPanel">', '<div id="panelScenarios"')` vacío.
3. **JS del panel sin literales**: `jsHardcoded` de `ui.js` = solo los 23 falsos positivos conocidos (teclas, fuentes, «Fluyo», grupos
   del cajón), listados por nombre.
4. **Sin concatenación**: el código no contiene `+" sin texto"`, `"Personalizado "+`, `" y cuentagotas"`, `+" · id "+`, `"Conexión · "+`.
5. **Coherencia de C10**: en cada idioma con las tres claves, `prop.orderNote` contiene el texto de `canvas.build` y el de `editor.canvas`.
6. **Identificadores intactos**: `data-group`, `data-v` y `value` iguales a la base.
7. **Alcance**: solo los archivos de §12; `undoS3b` da la base exacta y va encima de `undoS3a`; kernel = blobs de `HEAD` iguales a los
   de `fluyo-mcp` `src/generated/kernel-sources.ts` (comparar con `git show`, no con el árbol: CRLF); `CACHE` v115.
8. **Trinquete**: la línea base baja (219 → 65, 70 → 23) y no sube.

### 14.2 Mutaciones (cada una debe hacer fallar algún test)

| # | Mutación | La caza |
|---|---|---|
| M1 | quitar `data-i18n` de un `summary` | región sin marca, Chrome en inglés |
| M2 | `SHAPE_NAMES` vuelve a español fijo | Chrome en: metadato |
| M3 | C3 vuelve a `+" sin texto"` | test 4, CJK de prueba (espacio pegado) |
| M4 | C7 vuelve a concatenar | test 4, `aria-label` en inglés |
| M5 | `paintChromeText` no repinta las muestras especiales | cambio en vivo es → en |
| M6 | `paintChromeText` no repinta las rejillas (`aria-label`) | cambio en vivo |
| M7 | «(Global)» no se repinta | cambio en vivo |
| M8 | `refreshPanel` deja «Borde/Panel» fijos | Chrome en con `code` |
| M9 | la clave `prop.arrowSize15` falta en inglés | catálogo, `missing()` |
| M10 | se traduce un `data-group` | test 6, `fluyo-018-23.test.cjs:65` |
| M11 | un segmentado escribe el texto en vez de `data-v` | parches del documento en inglés |
| M12 | `setLocale` apila Undo | Chrome: pila de Undo |
| M13 | `CACHE` no sube | test 7 |
| M14 | `undoS3b` inexacto | test 7 |
| M15 | `prop.orderNote` en inglés sin «Animate reveal» | test 5 |
| M16 | `translate="no"` quitado de `1×` | región sin marca |

### 14.3 Undo (dos sentidos)

- **Cadena de `undo` de tests**: `undoS3b` (nuevo) la llama `undoS3a` la primera; las slices anteriores la reciben sin cambiar.
- **Deshacer de la app**: cambiar de idioma no toca el documento ni la pila (`doc` JSON y longitud de `undoStack` iguales); en
  inglés, cada control escribe exactamente el mismo parche que en español, con una entrada de Undo (forma, línea, posición,
  resaltado, ruta, lados, puntas, tamaño, sentido, semántica, velocidad, puntos globales, muestras).

### 14.4 Chrome real (Playwright con `FLUYO_BROWSER=chrome`, `playwright-core` en el scratchpad, SW bloqueado salvo en el caso offline)

1. **Español idéntico**: para 9 estados (caja, BD, texto, `code`, icono, imagen, GIF, conexión con puntas y movimiento, conexión
   Flujo con punta de inicio + W5, selección múltiple), texto visible y atributos (`title`, `aria-label`, `data-tip`, `placeholder`)
   de `#propPanel` iguales a la base (`e39b7e3` servido aparte) **y** capturas píxel a píxel iguales, en columna (1280 px), en
   columna mínima (1024 px) y en hoja (375 px).
2. **Inglés**: los mismos 9 estados con `?lang=en`: ningún texto con aspecto español en el panel salvo contenido (detector de
   español + lista de contenido esperado), `missing()` = 0.
3. **En vivo**: es → en → es con una selección abierta (cada tipo): el DOM final en español es igual al inicial; foco, selección y
   paletas desplegadas se conservan.
4. **`qps`**: todo texto del panel entre ⟦ ⟧ (lo de fuera = contenido); sin desbordes a 216 px ni en la hoja de 375 px.
5. **CJK de prueba**: las plantillas C1–C7 sin espacios del código; `:lang(zh)` aplica el peso de S4 a segmentados y `summary`.
6. **IME**: composición en `#lblEdit` (`Input.imeSetComposition`): una entrada de Undo por ráfaga; ningún Enter confirma nada.
7. **Cuentagotas** sin `EyeDropper`: el `alert` sale en el idioma de la interfaz.
8. Consola limpia; SW v115 instala y sirve offline.

### 14.5 Regresiones

`s3a` (8 + 35), `s2a` (13 + 223), `s2b` (14 + 34), `s1` (10 + 181), `s0` (20 + 385; T3 conocida), `s4` (20 + 102), `i18n-001` (78),
`018-23`, `018-27`, `018-18`, `018-14b`, `scenarios-semantics-1/6`, `018-6`, `018-15` (mutaciones), narración 100/100; suite
completa en un clon desechable hermano (`fluyo-new/s3b-suite-*`, para que `../fluyo-mcp` resuelva) = las mismas 81 fallas por nombre.

## 15. Cómo queda el español idéntico

- El HTML conserva cada texto base y solo gana atributos; `applyDom` no corre en español.
- `FluyoI18n.t(clave, es)` devuelve `es` sin mirar diccionarios en español.
- Los getters de `SHAPE_NAMES` / `ARROW_NAMES` y las plantillas devuelven, en español, exactamente las cadenas de hoy (C1–C7 incluidas:
  «Caja · id 1», «Personalizado #aabbcc», «Más colores, personalizado y cuentagotas»).
- Las `<option>` ocultas que difieren conservan su texto (D-S3b-5 = A).
- Se comprueba con texto + atributos + píxeles contra `e39b7e3` (§14.4.1).

## 16. Bugs ajenos a I18N encontrados (NO arreglados)

| # | Hallazgo | Evidencia | Gravedad |
|---|---|---|---|
| B1 | La mutación **B3** de `fluyo-018-27-mutations.cjs` es obsoleta: su patrón no incluye `syncKindNote(e)` (añadido por SEMANTICS W5) y el ejecutor la cuenta como fallo («mutación obsoleta») | `test/fluyo-018-27-mutations.cjs:35, 94` frente a `js/ui.js:570` | Baja (deuda de tests) |
| B2 | `#fsIn` dice `max="96"` pero el manejador acepta hasta 200 | `index.html:523`, `ui.js:502` | Baja |
| B3 | El espejo oculto `#langSel` dice «Ninguna» y el segmentado «Ninguno» (y «Lista propia…» / «SQL / ksqlDB» frente a «Lista propia» / «SQL») | `index.html:559–566` | Muy baja (no se ve ni se lee: `aria-hidden`) |
| B4 | `#shapeSel.onchange` excluye `image` e `icon` pero no `anim` | `ui.js:506` | Muy baja (inalcanzable: la fila se oculta para GIF) |
| B5 | El título de una conexión cuyo extremo no tiene texto enseña el id técnico («id 1 → Texto») | `ui.js:191` | UX, no bug |
| B6 | Los 8 selectores de color personalizados se llaman todos «Personalizado» para el lector de pantalla: el `title` descriptivo está en el `<label>`, no en el `<input>` (a confirmar con el árbol de accesibilidad completo) | `index.html:490…693` | Baja (a11y) |
| B7 | `docs/index.html` describe el panel solo en español; la página de docs en inglés no existe aún | S7 | Dependencia, no bug |

## 17. Respuesta: ¿S3b sin kernel ni MCP?

**Sí.** Todo el texto de Propiedades vive en `index.html` y `js/ui.js`, que no están en `KERNEL_SCRIPTS`; el kernel no compone ningún
texto del panel; el MCP no tiene esa superficie; el Viewer no la carga; los nombres de `config.js` que aparecen (fuentes) no se
traducen y la paleta ya se resolvió por clave en S3a. Ni `model.js`, ni `config.js`, ni `story-playback.js`, ni `safe-svg.js`, ni
`fluyo-mcp` cambian; `kernelId` sigue siendo `f1fe2c32…`.

## 18. Alcance propuesto

**S3b · Propiedades, en inglés, sin kernel ni MCP, `CACHE` v115.**
- Todo `#selBody` (7 grupos y el campo de contenido) y lo que falta de la cabecera (metadato y títulos de reserva).
- Las muestras de color, las rejillas, «⋯», «(Global)» y el aviso del cuentagotas.
- Repintado en vivo al cambiar de idioma.
- 130 claves, solo en inglés.
- Fuera: la ayuda de «Más» (decisión 277, sin slice); fr/ja/zh (revisión nativa, 275); el cajón de Seguridad/DevOps (bug aparte);
  los bugs de §16; la puerta de publicación del inglés (§20, R8).

## 19. Dependencias

- Base: `main` con S3a (`e39b7e3`) y su cierre (`747eff8`). Ninguna slice abierta toca `ui.js`/`index.html` ahora.
- `undoS3b` encadenado bajo `undoS3a`; `CACHE` v115 libre.
- Decisiones 276 (marcas), 277 (fuera), 278 (Reveal order), 280 (`alert` nativo), 284 (paleta, ya hecha), 287 (esta slice).
- Glosario: términos nuevos ⚑ (D-S3b-10); no bloquea el inglés.
- Recomendado: worktree hermano `fluyo-new/fluyo-s3b` (rama `i18n-002-s3b`); el `main` compartido tiene documentos sin commit de
  otras sesiones.

## 20. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Tests que fijan el marcado exacto: `fluyo-018-27.test.cjs:236` (`class="segBtn" role="radio" data-v="…">`) y `:238` (`<span class="lblText" id="arrowSizeLbl">Tamaño de flecha</span>`); `fluyo-scenarios-semantics-1.test.cjs:182` y `fluyo-018-18/23` (`data-v="…">texto<`, `data-flow="…"[^>]*>`); `fluyo-018-23.test.cjs:130` (`data-v="…" aria-label="…"`); `fluyo-018-6.test.cjs:87` (`label:"Sin relleno", value:"none"`); `fluyo-018-15-mutations.cjs` U10/B8 (línea de «Piedra») | Atributos nuevos **detrás** de `data-v` / `aria-label`, o delante de `class`; conservar `label:"…", value:…` en las muestras especiales con una clave aparte; ajustar solo 018-27 (236/238) y 018-15 (U10/B8), declarado en el handoff |
| R2 | Elementos creados por JS en un idioma que no es el español: `applyDom` tomaría como base el texto ya traducido | Para lo que crea JS, nada de `data-i18n-*`: `t()` al crear + repintado en `paintChromeText` (patrón S3a) |
| R3 | Algo pintado una sola vez no se repinta al cambiar de idioma | Mutaciones M5–M7 y prueba en vivo |
| R4 | Una clave compartida por coincidencia de español (Texto, Color, Auto, Arriba, Ninguno/a) obliga a la misma traducción en otro idioma | Una clave por contexto (D-S3b-4) |
| R5 | `prop.orderNote` desincronizada de `canvas.build` / `editor.canvas` | Test 5 |
| R6 | Francés más largo | Medido: +3–9 % de altura, sin desbordes (§5.2) |
| R7 | Traducir `data-group` rompería 4 tests | Test 6; no es texto visible |
| R8 | Tras S3b, `ui.js` sigue con 23 «literales» (teclas, fuentes, marca) y `config.js` con 143: la puerta de publicación (`releaseProblems`) sigue roja aunque la interfaz esté migrada | Fuera de S3b: hará falta una lista de exentos del escáner antes de publicar el inglés (S5/S6) |
| R9 | `<input type=number>` con IME en ancho completo | Fuera de I18N; se observa en el QA IME |
| R10 | Árbol compartido con documentos de otras sesiones | Worktree propio; no tocar los `.ai` ajenos |

## 21. Estrategia de QA (resumen)

1. Test propio + mutaciones (§14.1–14.2) en local.
2. Chrome real: español idéntico (texto, atributos, píxeles) en 9 estados × 3 anchos; inglés sin español; es → en → es en vivo; `qps`;
   CJK de prueba; IME; cuentagotas; offline v115.
3. Regresiones (§14.5) y suite completa en clon desechable (mismas 81 fallas).
4. Tras publicar (si el PO lo pide): smoke contra fluyo.space con copias de los tests apuntadas a producción y bytes servidos =
   blobs del commit (comparar con `git show`, no con `git archive`: CRLF).

## 22. Decisiones para el PO

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **D-S3b-1** | Alcance y partición | **A** una slice: HTML + JS del panel + cabecera. **B** S3b1 (HTML estático) y S3b2 (JS dinámico) | **A**: es una sola superficie y los mismos tests (en vivo, píxeles) cubren ambas mitades; partirla duplica el arnés y deja un estado intermedio mitad inglés |
| **D-S3b-2** | Idiomas | **A** solo inglés (fr/ja/zh caen al inglés). **B** también traducciones provisionales fr/ja/zh | **A** (como 288 y 295; aplica 275) |
| **D-S3b-3** | Espacio de claves | **A** claves propias `prop.*`, `shape.*`, `sel.*`. **B** reutilizar `rail.*`, `canvas.font`… cuando el español coincide | **A**: el rail abrevia («Hex») y su papel es otro; reutilizar ataría dos superficies |
| **D-S3b-4** | Homónimos (Texto, Color, Auto, Arriba/Abajo…, Ninguno/Ninguna, Personalizado/a) | **A** una clave por contexto. **B** una clave por texto español | **A**: francés y japonés distinguen lo que el español iguala (Aucun/Aucune; posición del rótulo ≠ lado del nodo) |
| **D-S3b-5** | `<option>` de los selectores espejo (ocultos, `aria-hidden`) | **A** clave del segmentado si el español coincide y clave propia si difiere (3 claves). **B** igualar su español al del segmentado. **C** `translate="no"` | **A**: el DOM español queda byte a byte igual; B cambia texto (aunque no se vea); C deja español en el DOM de otros idiomas |
| **D-S3b-6** | Lo que no se traduce (`SQL`, `SQL / ksqlDB`, `1×`–`4×`, `GIF`, fuentes, placeholder `SELECT FROM WHERE`) | **A** `translate="no"` y el escáner exime también los atributos de un subárbol `translate="no"` (cambio de 1 línea en `test/i18n-scan.cjs`, con test). **B** claves con el mismo valor en cada idioma | **A**: aplica la 276 tal cual; B llena el diccionario de entradas que nadie traduce |
| **D-S3b-7** | `1,5×` | **A** clave `prop.arrowSize15` («1.5×» en inglés). **B** plantilla `{n}×` con `FluyoI18n.num` | **A**: un solo valor, estático, en HTML; B exige pintar desde JS lo que hoy es HTML |
| **D-S3b-8** | Glifo de negrita «N» | **A** clave `prop.boldGlyph` (en «B», fr «G»; ja/zh caen a «B» hasta la revisión nativa). **B** icono SVG neutro. **C** dejar «N» | **A**: B cambia el aspecto en español; C es un error en inglés |
| **D-S3b-9** | Cabecera: metadato y títulos de reserva | **A** plantillas completas `sel.meta.node`, `sel.meta.edge`, `sel.untitled`, `sel.edgeTitle`, `sel.idRef` (con «id» dentro, traducible). **B** traducir piezas y seguir concatenando | **A** (aplica la 276; C3 rompe ja/zh con B) |
| **D-S3b-10** | Vocabulario inglés | Puntas = **Arrowheads**; Semántica = **Semantics**; Conexión / Flujo / Requisito = **Connection / Flow / Requirement**; Ruta = **Routing** (Straight / Orthogonal); Sale por / Entra por = **Leaves from / Enters at**; Sentido = **Dot direction** (Toward the target / Toward the source / Back and forth); Orden de aparición = **Reveal order** (278). Alternativas: «Arrows», «Kind», «Flows to / Requires» (como el enum del MCP) | Lo propuesto, y llevar al glosario las filas nuevas con ⚑ para ja/zh/fr |
| **D-S3b-11** | Nota «Se usa con «Animar aparición», en Lienzo.» | **A** frase completa por idioma + test que exige el texto de `canvas.build` y `editor.canvas`. **B** plantilla con `{option}` y `{menu}` | **A**: las comillas cambian por idioma (« », “ ”, 「」) y la frase se lee entera |
| **D-S3b-12** | Aviso del cuentagotas | **A** traducir el texto dentro del `alert` nativo (decisión 280). **B** diálogo propio ya | **A**; los diálogos propios siguen siendo condición previa para publicar ja/zh (280) |
| **D-S3b-13** | Repintado en vivo de lo que crea JS | **A** patrón S3a: `t()` al crear + `data-*` + bucle en `paintChromeText`. **B** reconstruir las rejillas en `onChange` | **A**: B pierde foco, paletas desplegadas y el tabindex móvil |
| **D-S3b-14** | Bugs ajenos B1–B7 | **A** solo registrarlos (este documento). **B** arreglar B1 y B2 dentro de S3b | **A**: S3b queda como migración pura, comparable byte a byte en español |

Procedimiento (no son decisiones de producto, se confirman con el PO):
- Numeración: al aprobarlas, D-S3b-1…14 se registran en `DECISIONS.md` a partir de la **300** (S4 sigue sin número; si se numera antes, detrás).
- Ejecución: worktree hermano `fluyo-s3b`, base `main` real, `CACHE` v115, parar en READY FOR COMMIT.

## Handoff de la auditoría

- Auditoría READ-ONLY sobre `HEAD` (`747eff8` / código `e39b7e3`): volcado con el escáner, sondeo con `?lang=en`, holgura con `qps`,
  tests que fijan marcado, kernel y MCP. Fuera del repo: `fluyo-new/.claude/launch.json` y el scratchpad.
- El PO aprobó D-S3b-1…14 tal cual (2026-10-27) → decisiones **300–313** de `DECISIONS.md`.

## 23. Implementación (2026-10-27)

Worktree `C:\Proyectos\fluyo-new\fluyo-s3b`, rama `i18n-002-s3b`, base `747eff8` (S3a cerrada). `CACHE` **v115**. Sin commit.

### 23.1 Qué se hizo

- **`index.html`** (solo `#propPanel`): `data-i18n` / `data-i18n-title` / `-aria-label` / `-tip` / `-placeholder` en todo el
  cuerpo de la selección; `data-i18n-js` en los cinco rótulos que pinta JS (`lblEditLbl`, `colorLbl`, `fillLbl`, `textColorLbl`,
  `textBgLbl`); `translate="no"` en `SQL`, `SQL / ksqlDB`, `1×`–`4×` y el placeholder `SELECT FROM WHERE`. Quitadas las marcas, el
  archivo es el de la base byte a byte: mismo español, mismos ids, `data-group`, `data-v` y `value`. En los segmentados de texto la
  marca va **antes** de `class` (los tests de 018-23/018-27/SEMANTICS fijan `class="segBtn" role="radio" data-v="…">`); en los de
  icono, **detrás** de `data-tip`.
- **`js/ui.js`**:
  - `SHAPE_NAMES` y `ARROW_NAMES` con getters (`FluyoI18n.t` en cada uso; las llamadas `SHAPE_NAMES[x]` no cambian; «GIF» es NT);
  - la cabecera con plantillas completas (`sel.meta.node`, `sel.meta.edge`, `sel.untitled`, `sel.idRef`, `sel.edgeTitle`);
  - los rótulos que cambian con la forma (`refreshPanel`) por clave;
  - muestras especiales: el nombre es una función (`swatchTitle` lo guarda en `_name`); rejillas: `enableSwatchKeyboard` recibe una
    función (`_label`); «⋯»: `paintSwatchMore` con dos frases completas; «(Global)» y el `alert` del cuentagotas con `t()`;
  - `paintChromeText` repinta muestras especiales, rótulos de rejilla, «⋯» y «(Global)»; el resto lo pinta `refreshPanel`, que ya
    corría en `FluyoI18n.onChange`.
- **`js/i18n-en-editor.js`**: las 130 claves (652 → 782 en el editor; 733 → 863 claves en uso). 32 932 → 38 314 bytes (LF).
- **`sw.js`**: `CACHE` v114 → v115.
- **Escáner** (`test/i18n-scan.cjs`, D-S3b-6): `translate="no"` exime también los atributos del elemento y de su subárbol.

### 23.2 Cambios frente a la auditoría

- La clave de «1,5×» es **`prop.arrowSizeOneHalf`**, no `prop.arrowSize15`: la convención de claves no admite dígitos (decisión 306).
- `js/i18n-en-editor.js` crece hasta 38,3 KB (la auditoría estimaba ≈ 42 KB).
- «Color» de Trazo usa `prop.color`, como el «Color» de un texto o un icono (las 130 claves de §11; no hay clave aparte).
- El glosario (`.ai/I18N-GLOSSARY.md`) no se toca: en `main` es un archivo sin seguimiento de otra sesión. La propuesta ⚑ para
  fr/ja/zh es la de D-S3b-10 (decisión 309): Arrowheads, Semantics, Connection / Flow / Requirement, Routing, Leaves from /
  Enters at, Dot direction, Reveal order.

### 23.3 Archivos

Servidos (4): `index.html`, `js/ui.js`, `js/i18n-en-editor.js`, `sw.js`.

Tests nuevos (4): `test/fluyo-i18n-002-s3b.test.cjs`, `-browser.cjs`, `-mutations.cjs`, `-undo.cjs`.

Tests ajustados:
- cadena de undo: `fluyo-i18n-002-s3a-undo.cjs` (llama a `undoS3b` la primera);
- alcances de S2b y S3a (lo que solo cambia S3b no cuenta);
- `test/i18n-scan.cjs` (D-S3b-6); `fluyo-i18n-001-baseline.json` (index.html 219 → 65, ui.js 70 → 23);
- pines de `CACHE` v114 → v115 en 81 tests;
- pines de marcado o código que S3b toca, solo para aceptar las marcas nuevas: `fluyo-018-27.test.cjs` (select y rótulo de
  «Tamaño de flecha»), `fluyo-scenarios-semantics-1.test.cjs` y su mutación U24 (aviso W5), `fluyo-scenarios-semantics-6-mutations.cjs`
  M22 (título de Trazo), `fluyo-018-6.test.cjs` («Sin relleno»), `fluyo-018-15.test.cjs` y sus mutaciones U10/B8 («Piedra»).

Documentación: este documento y `.ai/DECISIONS.md` (300–313).

No se tocan: `js/model.js`, `js/config.js`, `js/story-playback.js`, `js/safe-svg.js`, el resto del kernel, `fluyo-mcp`, CSS,
`js/state.js`, `js/i18n.js`, los diccionarios fr/ja/zh, EXAMPLES-001, otras tareas `.ai`, los bugs B1–B7.

### 23.4 Pruebas

Todas en el worktree salvo la suite completa, que se ejecutó en un clon desechable hermano (`fluyo-new/s3b-suite-now`, con S3b
commiteado solo en ese clon para que los alcances antiguos que comparan con `HEAD` lo vean commiteado), frente a otro clon de
`747eff8` (`fluyo-new/s3b-suite-base`).

| Prueba | Resultado |
|---|---|
| Propio (`node --test test/fluyo-i18n-002-s3b.test.cjs`) | **9/9**: C catálogo (130 claves, texto base exacto, inglés completo, fr/ja/zh sin claves), H HTML (sin marcas = base byte a byte), X escáner, J ui.js (23 falsos positivos, sin concatenar), O oráculo en español frente a `747eff8`, E inglés / en vivo / reserva / CJK de prueba, R repintado, N coherencia de `prop.orderNote`, A alcance |
| Mutaciones (`test/fluyo-i18n-002-s3b-mutations.cjs`) | **23/23** detectadas: 16 U (test propio sin A), 2 A (`CACHE`, `undoS3b`), 5 B (Chrome, parte en vivo) |
| Chrome real (`test/fluyo-i18n-002-s3b-browser.cjs`) | **46 ✔ · 0 ✘** |
| Regresiones unitarias | s0 20/20 · s1 10/10 · s2a 13/13 · s2b 14/14 · s3a 8/8 · s4 20/20 · i18n-001 20/20 · shell 9/9 · narración 22/22 |
| Regresiones en Chrome | s3a 35/0 · s2b 26/0 · s4 102/0 · s1 181/0 · s2a 179/0 · i18n-001 78/0 · shell 139/0 · narración 100/100 · **s0 384/1** (T3, carrera conocida; ver abajo) |
| Suite completa (`node --test "test/*.test.cjs"`) | **1765 / 83 fallos**, los **mismos 83 por nombre** que `747eff8` (1756 / 83); los 9 tests nuevos pasan; ninguna falla nueva ni arreglada |
| `CACHE` | `fluyo-static-v115`; `sw.js` solo cambia esa línea; 81 tests movidos de v114 a v115 |

Chrome real, en detalle:
- **Español idéntico** en 12 selecciones (caja sin texto, BD, texto, `code`, `code` con lista propia, icono, imagen, GIF, conexión
  con puntas, movimiento y tramos a mano, Flujo con punta de inicio y aviso W5, conexión sin puntas ni puntos globales, selección
  múltiple) más la fila de color desplegada, con los grupos como los deja el panel y todos abiertos: texto propio, `title`,
  `aria-label`, `data-tip`, `placeholder`, valor y visibilidad iguales a `747eff8`, en columna (1280), columna mínima (1024, panel de
  216 px) y hoja (375). **75 capturas, 0 píxeles distintos** en la pasada final (el test tolera ≤ 32 px de ruido, O2).
- **Inglés**: sin texto de Propiedades en español; `missing()` vacío; «Box · id N», «Box without text», «Connection · a → b»,
  «id a → Orders», «Shape Box», Code · Panel · Code text · Block background, aviso W5, «Stone (default)», «Line or border color»,
  «⋯» con frases completas, «(Global)», «Custom», glifo «B». fr/ja/zh caen al inglés.
- **En vivo**: es → en → es en las 12 selecciones, panel exacto al volver; tras pasar a inglés no se ve nada en español; es → qps:
  todo se repinta, también lo que el inglés escribe igual («(Global)», «Panel», «Auto»); foco, selección y paleta desplegada se
  conservan; el documento y la pila de Undo no cambian; 21 cambios desde el panel dan el mismo documento y las mismas entradas de
  Undo en español y en inglés, y cada control escribe su valor (`data-v` / `value`), nunca su texto.
- **qps**: todo texto del panel entre ⟦ ⟧ (fuera solo contenido, fuentes, NT y «⋯»); ningún desborde a 216 px ni en la hoja.
- **CJK** (`:lang(zh)`): segmentados y títulos de grupo a 600, metadato sin mayúsculas (tokens de S4; sin CSS nuevo).
- **IME**: una composición en el campo de texto (y su Intro) = una entrada de Undo; Intro no cierra el panel ni cambia la selección.
- **Cuentagotas** sin `EyeDropper`: el `alert` sale en el idioma de la interfaz (es y en).
- **Offline**: el service worker instala `fluyo-static-v115`; sin red, el editor arranca del precache con Propiedades en inglés.

**s0 T3** («ida y vuelta por los cinco idiomas»: «80%» → «127%» en `#zoomPct`). Es una carrera del propio test, no de S3b: el
indicador de zoom lo pinta el bucle de dibujo un fotograma después de `fitView()`, y la primera instantánea del test se toma sin
esperar a ese fotograma. Medido: falla también en `747eff8` (2 de 5 ejecuciones; S3a la registró igual, 384/1); en S3b falló 4 de 4.
Una sonda con el mismo arranque muestra el indicador desfasado un fotograma en los dos árboles (base 3 de 3, S3b 1 de 3); S3b no
toca el zoom ni la vista.

**Diff de español**: `index.html`, quitadas las marcas, es el de la base byte a byte (test H). En `ui.js` solo desaparecen los
trozos de concatenación (« · id », «Conexión · », « sin texto», «Personalizado », « y cuentagotas», «id »), sustituidos por
plantillas completas que, en español, dan exactamente el mismo texto (oráculo O y Chrome). Ningún texto visible en español cambia.

### 23.5 Observaciones nuevas (no arregladas)

- **O1** Con una **conexión** seleccionada, al cambiar de idioma los rótulos que pinta JS en las filas de **nodo** (ocultas con
  `display:none`: «Forma …», «Borde/Color», «Relleno/Panel»…) conservan el idioma anterior hasta que se selecciona un nodo, porque
  `refreshPanel` solo los pinta para nodos. No se ven ni los lee un lector de pantalla, y se corrigen al volver a verse. Igual al
  revés con «Puntas …» y un nodo seleccionado. Sin impacto; no se arregla (D-S3b-14).
- **O2** Las capturas de Chrome de dos ejecuciones del MISMO árbol difieren en hasta ~27 px (el borde del botón «⋯», una fila de
  muestras): ruido de rasterizado, medido base contra base. El test tolera ≤ 32 px por captura (un glifo cambiado son cientos).
- **O3** `#scScenarioTitle` (Historias, S2a) contiene «Sin historias» en el HTML con `?lang=en` mientras la hoja está cerrada: es el
  texto base de su `data-i18n-js`; al abrir Historias se pinta «No stories». No es un bug.

## 24. Commit, integración y producción (2026-10-28)

- **Commit** `09d7cea` (árbol `55d89ff1`, padre `747eff8`, 96 archivos) en `i18n-002-s3b`. Tras el commit: propio 9/9, mutaciones
  23/23, Chrome 46/0.
- **Integración**: `main` `747eff8` → `09d7cea` por fast-forward (sin merge commit). Antes se borró en `main` la copia sin
  seguimiento de este documento (solo diferían el título, el estado y el handoff de la auditoría). Sobre `main`: unitarios S3b, S0,
  S1, S2a, S2b, S3a y S4 en verde; mutaciones 23/23; Chrome S3b 46/0, S3a 35/0, S2b 34/0, S4 102/0, S1 181/0, S2a 223/0, S0 385/0;
  suite completa 1765 / 83, los mismos 83 por nombre que `747eff8`.
- **Publicación**: push `747eff8..09d7cea` a `origin/main`; Vercel publicó y fluyo.space sirve `fluyo-static-v115`. Los 83 archivos
  servidos son idénticos byte a byte a los blobs de `09d7cea`.
- **Smoke de producción** (fluyo.space, telemetría bloqueada): **22 ✔ · 0 ✘**.
  - Propiedades en español con creación y selección con el ratón: caja («Caja · id N», Apariencia, Forma, Borde, Relleno), `code`
    (Código, Panel, Texto del código, Fondo del bloque) y conexión («Conexión · a → b», «Puntas Ambas», Tamaño de flecha).
  - En vivo es → en → es: el panel pasa a inglés (texto y atributos) y vuelve exacto; el documento y la pila de Undo no cambian.
  - Propiedades en inglés: Appearance, Shape, Border, Fill, «Box · id N», «Connection · a → b», «Arrowheads Both», Routing; ningún
    texto ni atributo del panel en español; `missing()` vacío.
  - Share → Viewer en es y en: el documento llega intacto («Página de pagos», «Usuario final», el SQL del `code`).
  - Offline: el service worker instala `fluyo-static-v115` y, sin red, el editor carga de la caché con Propiedades en inglés
    («Box without text»).
  - Consola sin errores en todas las páginas.
- `fluyo-mcp` sin cambios (`464f4e0`); kernel sin cambios.

## Handoff

- **Qué se hizo**: S3b implementada según D-S3b-1…14 (decisiones 300–313; §23), commiteada, integrada en `main` y publicada (§24).
- **Archivos**: §23.3.
- **Pruebas**: §23.4 y §24.
- **Pendiente**: O1–O3 (§23.5) y B1–B7 (§16) siguen registrados, fuera de S3b. Este cierre documental no está commiteado.
- **Próximo paso**: la siguiente slice de FLUYO-I18N-002 que decida el PO; la próxima `CACHE` libre es **v116**.

Estado: **CLOSED / VERIFIED / IN PRODUCTION**.
