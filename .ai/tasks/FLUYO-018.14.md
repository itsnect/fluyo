# FLUYO-018.14 — Viewer, Historias y tipografía en el sistema visual

Estado: **018.14a y 018.14b IMPLEMENTADOS — READY FOR REVIEW** (§ 018.14a y § 018.14b, al final). Sin commit, push ni deploy.
Fecha: 8 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: el árbol de trabajo con 018.11, 018.12 y 018.13 (sin commit sobre `604b344`).
> Fuentes leídas: `AGENTS.md`, `.ai/tasks/FLUYO-018.13.md`, `.ai/DECISIONS.md` (112, 117–127), `.ai/ARCHITECTURE.md` (§ kernel, § 018.12, § 018.13), `s/index.html`, `css/share.css`, `js/config.js` (`FONTS`, `PALETTE`, `EVENT_SWATCHES`), y los tramos de `model.js`, `render.js`, `export.js`, `geometry.js`, `editor-scenarios.js`, `viewer.js` y `story-authoring.js` que tocan tipografía o color. También la tool `list_fonts` del servidor MCP desplegado (solo lectura).

## 1. Objetivo

Llevar el sistema visual de 018.13 a las tres superficies que aún no lo tienen del todo:

- **Viewer**: misma familia visual, orientado a lectura.
- **Historias**: jerarquía propia, menos lienzo tapado, sin colores ni glifos heredados.
- **Tipografía**: Playfair Display e IBM Plex Mono como opciones del diagrama, de forma compatible.

Y, de paso, cerrar tres deudas visibles: el azul residual, el primer nivel de la cabecera y la densidad del panel.

No se cambian formato, modelo de nodos/páginas/Historias, semántica ni identidad de documentos.

## 2. Estado actual (018.13)

- **Chrome del editor**: tokens, voces serif/mono, iconos SVG, una fila de 320 a 1440 px.
- **Viewer**: sin cambios desde antes de 018.13 (`identity.css` + `share.css`, chrome oscuro, Segoe UI).
- **Historias**: hereda tokens y la serif en el título; la UI interna (filas, chips, botones, glifos) es la de 016.
- **Selección y tiradores en el lienzo**: oliva por tema (`editorMark`, 018.13).
- **Tipografía del diagrama**: 12 familias heredadas; Georgia por defecto.

## 3. Hallazgos principales

Medidos en Chrome real sobre el estado actual (§ 13), no inferidos del CSS.

1. **La selección ya no es azul.** En los 5 viewports, con nodo o conexión seleccionados, el lienzo tiene **0 px** de cian `#3aa7e8` en escritorio. El azul que se percibe tiene otras fuentes:
   - **el color por defecto de los nodos** `#6a9fb5` («Servicio», `PALETTE[0]`). Es contenido del documento y lo asigna el kernel (`model.js` → `newNode`). Es el azul dominante de cualquier captura (miles de px en el lienzo);
   - **las muestras de color del panel** (azules legítimos de la paleta);
   - **la reproducción de Historias**: el token «●», su rastro y su brillo (`FLOW_ACCENT = #3aa7e8`), el efecto «Resaltar» de un nodo (`#3aa7e8`) y el resaltado al colocar un evento (`scHighlight`);
   - **la UI interna de Historias** (chips, segmentados, selector de símbolo: `rgba(58,167,232,…)`);
   - **el Viewer** (anillo de foco `--accent2: #3aa7e8` de `identity.css`).
2. **Las fuentes nuevas no se pueden añadir sin tocar el kernel.**
   - `FONTS` vive en `js/config.js`, que es parte del kernel que fluyo-mcp copia literalmente (sha256 + `kernelId`).
   - `list_fonts` del MCP desplegado devuelve exactamente esas 12 familias.
   - Detalle en § 6.
3. **El Viewer se ve de otro producto**:
   - fondo casi negro, naranja `#d08b5b`, Segoe UI y Georgia;
   - «flu yo» separado;
   - botones de 33 px;
   - la cabecera parte en **3 filas (124 px) a 375 px** y 2 filas (85 px) a 390 px.
4. **Historias no tiene jerarquía propia**:
   - comparte pestaña y columna con Propiedades;
   - en móvil, la hoja deja ver solo el **33–36 % del lienzo**; reproduciendo, el **63–64 %**;
   - en la hoja compacta no se ve qué paso se está reproduciendo;
   - controles por debajo del objetivo táctil: «+», «⋯», Reproducir, «+ Crear evento» y asas, de 14 a 34 px de alto;
   - glifos de texto en vez de iconos: ▶ ■ ✓ ○ ⋯ ▾ ●.
5. **El panel es denso**:
   - en móvil, las propiedades de un nodo ocupan **4,2–5,3 pantallas** de la hoja y la hoja deja ver el **25–31 % del lienzo**;
   - en escritorio, 2,1–2,5 pantallas;
   - textos de 9,5–10 px: etiquetas del rail y rótulos de grupo;
   - los interruptores miden 30 × 18 px de caja visual, aunque la fila es más alta;
   - los selectores de color nativos miden 26 × 22 px;
   - cuatro rejillas de 50–70 muestras cada una.
6. **`code` y BD no calzan con el sistema** (§ 7b):
   - `code` es un bloque casi negro con cajas verdes `#a8b34a`; en el tema claro, un bloque negro;
   - la BD dibuja dos arcos superiores (Bézier de 0,8 + elipse) en lienzo, SVG y Viewer.

   Ambos se corrigen en el render compartido (`geometry.js`, `render.js`, `export.js`), sin `model.js` ni kernel.
7. **La cabecera tiene en primer nivel ajustes que se usan una vez por documento**: tema, tipografía global, cuadrícula, rejilla, fondo, Ejemplo, Limpiar, Abrir y Guardar. Se ven como controles del editor antiguo con piel nueva.

## 4. Auditoría del Viewer

| Aspecto | Hoy | Debería |
|---|---|---|
| Hojas | `identity.css` + `share.css` (no carga `system.css`) | `identity.css` + `system.css` + `share.css` reescrito |
| Superficie | `#1b1d1f`, filetes grises | Hueso/tinta, como el editor; el lienzo sigue con el tema del documento |
| Marca | Georgia, «flu yo» separado, puntos naranja | Playfair, «fluyo», puntos terracota (como el editor) |
| Tipografía UI | Segoe UI | Mono para controles; serif para nombre de página e Historia |
| Cabecera | 1 fila a ≥768; **3 filas a 375** (124 px), 2 a 390 | 1 fila en todas las anchuras (iconos + tooltip) |
| Controles | Texto y glifos (−, +, ‹ ›, ▶ ■), 33 px | Iconos del sprite, ≥40 px con dedo |
| Acción principal | «Abrir en Fluyo» naranja | Primario terracota |
| Historia | Banda oscura inferior centrada, Segoe 16/14 | Tarjeta de lectura: título serif, paso actual mono, progreso |
| Present | Barra `--panel` con sombra | Material inverso (como el editor) |
| Pie | «Hecho con Fluyo» 12 px | Metadato mono discreto, sin cambiar el texto |

Restricciones técnicas del Viewer:

- **CSP** `style-src 'self'`: no se puede usar ningún atributo `style` inline. El sprite de iconos no puede llevar `style="position:absolute"` como en el editor; se oculta con una clase en `share.css`.
- `font-src` cae en `default-src 'self'`, así que las fuentes autoalojadas están permitidas. Las máscaras `data:` de CSS están cubiertas por `img-src data:`.
- `viewer.js` solo crea los botones de página: el cambio es casi todo HTML/CSS, sin tocar la carga, el render ni el Playback.
- La semántica no cambia: mismas acciones, mismos ids que usan sus tests.

## 5. Auditoría de Historias

**Estructura actual**: pestaña «Historias» del panel derecho (336 px en escritorio, 270 px a ≤720), con selector de historia, «+», «⋯», Reproducir, biblioteca de Eventos, Historia (línea de tiempo) y diálogos de evento y detalles.

| Problema | Evidencia | Propuesta |
|---|---|---|
| Comparte columna con Propiedades | Dos pestañas en el mismo panel; al reproducir, la pestaña Propiedades queda inerte | **Modo Historias**: superficie propia que sustituye al panel de Propiedades mientras está abierta. Se entra desde la barra inferior (escritorio y móvil) y se sale con «Volver a editar». Usa la costura que ya existe (`openSurface("stories")`, decisión 117) |
| Tapa el lienzo | 768: el lienzo queda en 360 px (47 %). Móvil: 33–36 % visible abierta, 63–64 % reproduciendo | Escritorio: 320 px fijos. Móvil: hoja con dos alturas sin gesto nuevo (compacta por defecto y «Ampliar» con un botón) |
| Reproduciendo en móvil no se ve el paso | La hoja compacta muestra controles y «Eventos · 4», no la frase | Hoja compacta = título serif + **paso actual** (símbolo, nombre, frase) + Detener + progreso |
| Jerarquía plana | Rótulos mono iguales para «Historias», «Eventos» e «Historia» | Nombre de la historia en serif (cabecera del modo). Eventos como paleta secundaria plegable. La línea de tiempo es el contenido principal |
| Glifos y azul heredados | ▶ ■ ✓ ○ ⋯ ▾ ●; chips `rgba(58,167,232,…)` | Iconos del sprite; estados con `--active`/`--attention`; chips con `--active-veil` |
| Objetivos táctiles | `#scStoryAdd` 29, `#scRun` 29, `#scEventNew` 27, `.scHandle` 14–16, `.scMore` 30 px | Componentes del sistema (`--ctl-h`: 40 px con dedo); asa con zona de toque de 40 px aunque el dibujo siga fino |
| Tipografía | Todo mono, incluidos nombres de evento | Nombre de historia y nombres de evento en serif; frases, tiempos y estados en mono |

Qué no cambia: `model.js`, Steps, Trace, Playback, frases, orden, `at`, diálogos de evento (solo heredan componentes), ids que usan los tests.

Sobre los tests: `fluyo-016` afirma el texto exacto «Historia 1 ▾». Si el ▾ pasa a icono, se conserva como texto y se pinta con máscara CSS (como las pestañas de página en 018.13), o se adapta el test. Ver D6.

## 6. Auditoría tipográfica

### 6.1 Cómo funciona `font` hoy

| Pieza | Comportamiento |
|---|---|
| Lista | `FONTS` en `js/config.js` (kernel): `{n, f}`, donde `f` es la **pila CSS completa** (p. ej. `"Georgia, serif"`) |
| Persistencia | `settings.font` (global) y `node.font`/`edge.font`: se guarda la pila CSS, no el nombre corto |
| Global desconocida | `settingsFromProjectData` (`model.js` 1139) la cambia **en silencio** por `DEFAULT_FONT` al cargar. El MCP rechaza con `INVALID_FIELD` lo que la carga del editor cambiaría (decisión 112) |
| Por nodo desconocida | Se acepta cualquier cadena (`normalizeProjectItem` solo exige `string`). Canvas y SVG caen a la fuente por defecto del navegador; si la cadena no es una `font-family` CSS válida, `c.font=` se ignora y se queda la fuente anterior (defecto existente) |
| Lienzo | `objFont` → `c.font` con la pila. Exige que la fuente esté **cargada**: no hay `document.fonts.load` en el editor ni en la exportación |
| SVG exportado | `font-family="<pila>"`: quien abre el SVG necesita la fuente instalada; si no, usa el resto de la pila |
| GIF/PNG/JPG | Lienzo propio: misma condición de fuente cargada |
| Viewer | Mismo `render.js`, pero `s/index.html` **no declara** las fuentes: hoy usaría la pila de reserva |
| `code` | `codeFont` = **última entrada** de `FONTS` («Mono») si el nodo no tiene `font` |
| Por defecto | `DEFAULT_FONT` = **primera entrada** (Georgia) |
| MCP | `list_fonts` devuelve las 12 familias del kernel |

### 6.2 ¿Es seguro añadir Playfair Display e IBM Plex Mono?

- **Formato del documento**: sí; es una pila CSS más, del mismo tipo.
- **Kernel**: **no sin cambiarlo**. Añadirlas a `FONTS` cambia `config.js`, que es kernel:
  - fluyo-mcp tiene que sincronizarlo (`sync:kernel`, `kernelId` nuevo);
  - `list_fonts` pasa a 14;
  - **orden de despliegue**: un documento con la global nueva, abierto en un editor o kernel antiguo (SW en caché, MCP sin sincronizar), vuelve a Georgia en silencio en el editor o es rechazado por el MCP.

  El encargo excluye cambiar el kernel MCP, así que esto queda **pendiente de tu decisión (D1)**.
- **Orden dentro de `FONTS`**: van **entre «Comic Sans» y «Mono»**.
  - Al principio cambiarían `DEFAULT_FONT`.
  - Al final cambiarían la fuente por defecto de los bloques `code` (`codeFont`).
- **Nombres exactos propuestos** (pila con reserva, para que el SVG o un entorno sin la fuente degraden con dignidad):
  - `{n:"Playfair Display", f:"'Playfair Display', Georgia, serif"}`
  - `{n:"IBM Plex Mono", f:"'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}`
- **IBM Plex Mono y los bloques `code`**: su avance es exactamente 0,6 em, el `CODE_ADV` normativo; el resaltado cuadra sin forzar.
- **Requisitos al añadirlas**:
  - el Viewer declara las fuentes (`@font-face` del mismo origen);
  - la exportación a GIF/PNG/JPG espera a `document.fonts.load(...)` de la familia usada;
  - el SVG se queda con la pila (incrustar la fuente en el SVG es otra decisión: peso y licencia).
- **Lo que no se hace**: no cambia `DEFAULT_FONT`, no hay migración y no se retira ninguna familia histórica.

### 6.3 El selector

Hoy son 12 familias en una lista plana; «Comic Sans» e «Impact» conviven con la tipografía del sistema. Propuesta, solo de presentación y sin tocar valores:

- `<optgroup label="Fluyo">`: Playfair Display, IBM Plex Mono (si D1);
- `<optgroup label="Sistema">`: Georgia (por defecto), Times, Palatino, Segoe UI, Arial, Verdana, Trebuchet, Tahoma, Courier, Mono;
- `<optgroup label="Otras">`: Impact, Comic Sans.

Las tres siguen siendo válidas y se abren igual; solo cambia dónde aparecen.

### 6.4 Voces en la UI (regla de 018.13, revisada)

| Elemento | Hoy | Propuesta |
|---|---|---|
| Nombre de página, de historia, títulos de sección y modales | Serif | Serif (sin cambio) |
| Nombre de un Evento (biblioteca y línea de tiempo) | Mono | **Serif** (es un concepto) |
| Frases de la Historia, tiempos, estados | Mono | Mono |
| Ayuda larga del panel | Mono 11 px | Mono 11,5–12 px, interlineado 1,6 |
| Rail | Mono 9,5 px | Mono 10,5 px (o solo icono con tooltip en escritorio: D5) |
| Rótulos de grupo | Mono 10 px en mayúsculas | 10,5 px |
| Campos con dedo | 12–12,5 px | **16 px** con `pointer:coarse` (Safari iOS hace zoom al enfocar un campo de menos de 16 px) |
| Viewer | Segoe UI / Georgia | Mono (controles), serif (página, historia) |

## 7. Auditoría de color y selección

Leyenda de la columna «Alcance»:

- **E**: solo editor.
- **C**: compartido editor + Viewer + Present (no exportación).
- **D**: dato del documento o del kernel.

| Actual | Dónde | Alcance | Nuevo | Motivo |
|---|---|---|---|---|
| Selección, tiradores, marco de selección, flechas de lado (`#3aa7e8`) | `render.js` | E | `editorMark` (ya oliva, 018.13) | Hecho; 0 px de cian medidos |
| `scHighlight` (resaltado al colocar un evento): `#3aa7e8` / `rgba(58,167,232,.35)` | `render.js` 500, 907 | E | `editorMark(theme).ink` / `.soft` | Estado activo del editor |
| Chips, segmentados, selector de símbolo, efectos y frase: `rgba(58,167,232,.07–.3)` | `styles.css` (Historias) | E | `--active-veil` + borde `--active` | Selección en la UI = oliva |
| Vista previa del efecto «Resaltar» (`rgba(58,167,232,.5)`) | `styles.css` | E | Mismo color que la decisión sobre el efecto (fila siguiente) | Que la vista previa diga la verdad |
| Efecto «Resaltar»/«Parpadear» en el nodo: brillo `#3aa7e8` | `render.js` 403–404 | C | `--c-oliva-palido` sobre oscuro / `--c-oliva` sobre claro (como `editorMark`) | Es un estado de atención de la Historia, no un color del usuario (no se guarda). **D3** |
| Token «●» de un evento, su rastro y su brillo (`FLOW_ACCENT`) | `render.js` 664 | C | Ídem | Igual que arriba. **D3** |
| Anillo de llegada (éxito `#7bb85b` / fallo `#d0576a`) | `render.js` 782 | C | Oliva / terracota | Positivo / atención. **D3** |
| Mensaje de nodo por defecto `#d0576a`; relleno «Color» por defecto `#3aa7e8` | `editor-scenarios.js`, `render.js` 325 | D (se guarda al crear el evento) | Sin cambio en 018.14 | Es el valor por defecto de un dato; cambiarlo cambia documentos nuevos y la paridad con el MCP |
| Color por defecto de los nodos `#6a9fb5` | `config.js` `PALETTE[0]` ← `model.js` | D + kernel | **Sin cambio** | Es lo más azul de cualquier diagrama, pero cambiarlo es `model.js`/kernel. Se documenta para un slice propio |
| `PALETTE`, `EVENT_SWATCHES`, `SWATCH_COLORS` | `config.js` | D | Sin cambio | Elecciones del usuario |
| Foco `--accent2: #3aa7e8` | `identity.css` (Viewer) | Viewer | `--focus` (oliva) al cargar `system.css` | Sistema |
| Errores `#e08585` / éxito `#7bb85b` del chrome | `styles.css` | E | Ya `--attention` / `--active` (018.13) | Hecho |
| Enlaces `--accent2` de `/docs` y `/ejemplos` | `pages.css` | Páginas estáticas | Fuera de 018.14 | Otro alcance |

El dibujo estructural de los nodos (forma, radio, trazo, relleno, texto) no se toca: lo comparten lienzo, SVG y Viewer. Excepción: las dos correcciones de § 7b, que se hacen en la geometría compartida y por eso salen iguales en las tres superficies.

## 7b. Nodos `code` y BD (revisión de capturas)

Capturas reales en el scratchpad, `n14/`:

- lienzo (normal y seleccionado), SVG de `buildSVGDocument` y Viewer, en tema oscuro y crema;
- recorte ampliado de la tapa de la BD;
- prototipo desechable de la propuesta (`n14/propuesta.png`, fuera del repo).

### 7b.1 Dónde se dibujan

| Pieza | Lienzo (editor y Viewer) | SVG exportado | Datos que intervienen |
|---|---|---|---|
| `code`, colores | `drawCodeNode` (`render.js` 212) → `codeColors(n, theme)` | `renderNodeToSVG` `case "code"` (`export.js` 281) → la **misma** `codeColors` | `n.color` (borde), `n.fill` (panel), `n.textBg` (bloque), `n.textColor`, `n.kwBg`, `n.kwColor`, `n.font`, `n.bold` |
| `code`, maquetación | `codeBlockLayout(n)` (`geometry.js`) | La misma | `n.label`, `n.lang`, `n.keywords`, `n.fs`, caja |
| `code`, tipografía | `codeFont(n)` = `n.font` o la última entrada de `FONTS` («Mono») | La misma (+ `textLength`) | `n.font` |
| Respaldo de colores de `code` | `THEMES[theme].codeBg/codeText/codeKwBg/codeKwText` y `lblBg` (`config.js`, kernel) | Igual | — |
| Cilindro | `drawNode` rama `cylinder` (`render.js` 455) | `renderNodeToSVG` `case "cylinder"` (`export.js` 270), **código duplicado** | `n.color`, `n.fill`, `n.border` |
| Cilindro en overlays | `shapePath` cae en el rectángulo redondeado (el resaltado de Historias no abraza el cilindro) | — | — |

`geometry.js`, `render.js` y `export.js` **no** son kernel. Las dos correcciones caben en la capa de render: `codeColors`, `codeFont` y una función de geometría del cilindro nueva en `geometry.js`, que llaman `render.js` (lienzo y Viewer) y `export.js` (SVG). **No hay que tocar `model.js` ni `config.js`.**

### 7b.2 Por qué aparece la doble línea en la BD

El contorno cierra su parte superior con una **Bézier cúbica** cuyos puntos de control están a `0,8·ry` por encima de los extremos. Después se dibuja **encima** la elipse completa de la tapa con `ellipse()`.

Con ese factor, la Bézier culmina a `top + ry − 0,6·(1,8·ry) ≈ top − 0,35·ry`; la elipse, a `top`. Son dos arcos traseros separados unos 0,35·ry (≈ 5–6 px con `ry` = 16): la «segunda línea». El SVG repite la misma construcción (`C … ` + `<ellipse>`), así que el defecto sale idéntico en lienzo, SVG y Viewer. La base usa la misma aproximación (no es una elipse real, aunque ahí no se duplica).

### 7b.3 Propuesta para la BD

Un solo cilindro geometrizado, construido con **arcos de elipse reales** a partir de un único juego de parámetros, `cylinderGeom(n) → {cx, rx, ry, top, bot}`, en `geometry.js` (mismo `ry = min(16, h·0,18)` de hoy):

- **contorno**: lateral izquierdo → media elipse inferior (frente) → lateral derecho → media elipse superior (fondo). La tapa trasera existe una sola vez, como parte del contorno;
- **labio frontal**: la otra mitad de la **misma** elipse superior, un solo trazo;
- los laterales nacen en `(cx ± rx, top + ry)`, donde la tangente de la elipse es vertical: son tangentes por construcción;
- la base es media elipse limpia;
- sin segunda línea ni decoración.

El lienzo lo traza con `c.ellipse(...)` y el SVG con comandos `A` del **mismo** `cylinderGeom` (un helper devuelve el `d` del SVG; el lienzo recorre los mismos segmentos). `shapePath` usa el contorno, así que el resaltado de Historias pasa a abrazar el cilindro.

Sin cambios en: caja, anclajes, acierto, posición de la etiqueta (`geometry.js` 513), trazo de 2,5, relleno (`fillFor`), estilo de borde. Los documentos existentes se ven con la tapa corregida; ningún dato cambia.

Lectura de «una sola tapa»: la tapa es la elipse superior completa (fondo + labio), dibujada una vez. Si lo que quieres es una tapa plana sin labio frontal, ver D9.

### 7b.4 Propuesta para `code`

Que sea «un objeto técnico dentro de Fluyo». Cuatro cambios, todos en `codeColors`/`codeFont`/`drawCodeNode` y su gemelo SVG:

1. **Contenedor como los demás nodos.** El panel por defecto pasa de opaco (`lblBg`, el fondo del lienzo) al mismo tinte que las cajas (`fillFor`: color del nodo al 16–18 %). El borde sigue siendo `n.color`, con el mismo trazo, radio y estilo de borde que una caja.
2. **Superficie interior más ligera.** El bloque deja de ser un rectángulo casi negro:

   | Tema | Bloque | Texto | Palabra clave | Literal (`'…'`) |
   |---|---|---|---|---|
   | Oscuro | tinta al 32 % sobre el panel | hueso `#E8E1D3` | oliva pálido `#C3CDA4`, peso 500 | terracota clara `#D9876F` |
   | Crema / claro | tinta al 5,5 % (papel hondo) | tinta `#16150F` | oliva `#4E5A3F`, peso 500 | terracota `#A33A22` |

   En el tema claro el bloque es hoy **negro** (`#101010`); pasa a la variante clara.
3. **Resaltado sin cajas.** Por defecto la palabra clave se distingue por color y peso, sin el rectángulo verde saturado (`#a8b34a`). Los literales en terracota requieren reconocerlos en `codeBlockLayout` (un token más, solo para `'…'` y `"…"`): ver D8.
4. **IBM Plex Mono para el contenido.** El respaldo de `codeFont` pasa a `'IBM Plex Mono', ` + la pila «Mono» actual. Solo afecta a nodos sin `font` propio y no cambia ningún dato. El avance de Plex Mono es exactamente 0,6 em (`CODE_ADV`), así que la rejilla no se mueve. El SVG mantiene `textLength`.

**Datos explícitos: mandan siempre.** Si un nodo tiene `fill`, `textBg`, `textColor`, `kwBg`, `kwColor`, `font` o `bold`, se usan tal cual. En particular, un `kwBg` explícito sigue pintando su caja; solo cambian los respaldos.

**Lo que no cambia:** maquetación (`codeBlockLayout`: tamaños, márgenes, filas), formato, `lang`/`keywords`, kernel. `THEMES.code*` quedan en `config.js` sin uso por el render. Retirarlos sería un cambio de kernel aparte, sin prisa.

### 7b.5 Color: estructural frente a dato

| Lo que se ve | Origen | Tipo | 018.14 |
|---|---|---|---|
| Borde azul acero de `code` y de la BD | `n.color` (por defecto `PALETTE[0]` `#6a9fb5`, asignado por `newNode` en `model.js`) | **Dato** | No se toca. Cambiar el color por defecto de los nodos nuevos es `model.js`/kernel (D10, fuera de 018.14) |
| Panel opaco de `code` | Respaldo `lblBg` | Estructural | → tinte del nodo (`fillFor`) |
| Bloque negro de `code` | Respaldo `THEMES.codeBg` | Estructural | → tinta/papel de la tabla |
| Caja verde de la palabra clave | Respaldo `THEMES.codeKwBg` | Estructural | → sin caja; texto oliva |
| Doble arco de la BD | Geometría | Estructural | → tapa única |
| Marco y tiradores de la selección | `editorMark` | Estructural, solo editor | Ya oliva (018.13); 0 px de cian medidos |
| Puntos de flujo sobre las flechas | `e.dotColor`, o el color del nodo de origen | Dato | No se toca |

Ni la selección ni los tiradores ni ningún borde estructural usan cian. El azul que queda en estos nodos es el color del propio nodo, y se puede cambiar desde el panel.

### 7b.6 Impacto en Viewer y SVG

- **Viewer**: usa el mismo `render.js` y `geometry.js`, así que ve lo mismo que el lienzo sin código propio. Para que `code` use Plex Mono, el Viewer debe declarar la fuente (ya previsto en F1). Sin ella, cae a la pila «Mono» actual y la rejilla se conserva.
- **SVG**: `export.js` usa los mismos `codeColors`, `codeFont` y `cylinderGeom`, así que la paridad con el lienzo se mantiene.
  - Los colores con alfa del bloque se escriben como `fill` + `fill-opacity`, ya soportado por el SVG.
  - Quien abra el SVG sin Plex Mono instalada verá la pila de reserva, con la rejilla forzada por `textLength`.
- **GIF/PNG/JPG**: el lienzo de exportación debe esperar a `document.fonts.load` de Plex Mono antes de rasterizar (mismo requisito que D1).
- **Tests existentes**: ninguno fija los colores de `code` ni la construcción del cilindro. Lo he comprobado buscando `a8b34a`, `codeColors`, `<ellipse` y `cylinder` en `test/`: las apariciones de `cylinder` son nombres de forma en documentos, no render.

## 8. Auditoría móvil (390 y 375; también 768)

Los flujos funcionan: abrir y cerrar Historias, reproducir, seleccionar, propiedades, cambiar y renombrar página, cerrar paneles y volver al lienzo. `fluyo-018-12-browser` (278 ✔) y `fluyo-018-13-browser` (243 ✔) los recorren en verde. Lo que falla es el espacio y el tamaño:

| Situación (390 / 375) | Lienzo visible | Hoja | Problema |
|---|---|---|---|
| Sin selección | 100 % | — | Rail de 36 px de alto; ▾ de página 28 × 30 |
| Nodo + Propiedades | 31 % / 25 % | 439 / 347 px, **4,2 / 5,3 pantallas** de scroll | Demasiadas filas; 6 visibles; muestras en 4 rejillas |
| Conexión + Propiedades | 33 % / 28 % | 3,5 / 4,5 pantallas | Ídem |
| Historias abierta | 36 % / 33 % | 1–1,15 pantallas | Controles de 27–34 px; asas de 14 px |
| Reproduciendo | 64 % / 63 % | 253 / 200 px | **No se ve el paso actual** |
| Viewer | 100 % | — | Cabecera de 2–3 filas, botones de 33 px |
| 768 + Historias | 100 %, pero 360 px de ancho | Columna de 336 px | El diagrama queda al 53 % |

**¿Puede Historias funcionar sin bloquear el lienzo? Sí**, sin gestos nuevos:

1. **Modo propio con hoja de dos alturas**:
   - compacta (~168 px): título, paso actual, Reproducir/Detener, progreso;
   - ampliada (la altura actual), con un botón «Ampliar/Reducir».

   Reproduciendo siempre compacta. Colocando un evento se aparta (ya existe, `scPlacing`).
2. Lienzo visible esperado: **~70 % con Historias abierta y ~75 % reproduciendo** a 390 × 844, frente al 36 % y 64 % de hoy.
3. Propiedades en móvil:
   - secciones con un selector segmentado dentro de la hoja (Texto · Estilo · Estructura, o las de conexión), en vez de una columna de 4–5 pantallas;
   - muestras en una sola rejilla compacta con «Más colores».

   Objetivo: ≤ 1,5 pantallas por sección.

## 9. Propuesta de arquitectura visual

- **Un sistema, tres superficies**:
  - `system.css` (tokens + componentes) lo cargan editor y Viewer;
  - `styles.css` (editor) y `share.css` (Viewer) solo colocan;
  - `identity.css` se queda como base mínima compartida, y su `--accent2` queda redefinido por el sistema.
- **Superficies del editor**: Editar (Propiedades) e Historias son **dos modos**, no dos pestañas. La cabecera es la del documento; la barra inferior lleva páginas, vista y el conmutador de modo.
- **Cabecera de primer nivel** (D4): marca · deshacer/rehacer | **Lienzo ▾** | ··· | Presentar · Compartir · **Exportar** · Más.
  - «Lienzo ▾» es un popover con tema, tipografía global, cuadrícula, rejilla y fondo.
  - Ejemplo, Abrir, Guardar y Limpiar pasan a «Más» (Ctrl+S sigue guardando).
- **Panel de Propiedades** (D5):
  - 288 px en escritorio;
  - grupos plegables (Código, Capas y aparición y Flujo plegados por defecto);
  - muestras compactas (16 colores + «Más»);
  - escala tipográfica +0,5–1 px;
  - en móvil, secciones con selector segmentado.
- **Color**: `editorMark` para todo lo que el editor dibuja sobre el lienzo; los colores de reproducción compartidos, según D3; los datos y el kernel, intactos.
- **Iconos**: el mismo sprite en el Viewer (sin estilos inline por la CSP) y en Historias; lo que JS escribe como texto conserva el glifo y se pinta con máscara.

## 10. Cambios de código necesarios

| Archivo | Cambio | Fase |
|---|---|---|
| `s/index.html` | Carga `system.css` y precarga la mono; sprite sin `style` inline; iconos en Encajar, ±, Presentar, ‹ ›, ▶ ■; marca como el editor | F1 |
| `css/share.css` | Reescrito sobre tokens: cabecera de una fila, tarjeta de Historia, Present inverso, pie discreto | F1 |
| `js/viewer.js` | Solo clases de las pestañas de página (sin tocar carga, render ni Playback) | F1 |
| `index.html` | Modo Historias (cabecera del modo, conmutador en la barra inferior), popover «Lienzo», sprite +6 iconos | F2, F4 |
| `js/ui.js` | `openSurface` como modo (clase en `body`), popover «Lienzo», grupos plegables, secciones móviles | F2, F3, F4 |
| `js/editor-scenarios.js` | Clases e iconos en lugar de glifos donde no lo afirmen los tests (o máscara); paso actual en la hoja compacta | F2 |
| `css/styles.css` | Historias, panel, popover y móvil sobre los componentes | F2–F4 |
| `css/system.css` | Escala tipográfica ajustada; campos de 16 px con dedo; componentes segmentado y plegable | F3 |
| `js/render.js` | `scHighlight` → `editorMark`. Si D3: `FLOW_ACCENT`, brillo de «Resaltar» y anillos de llegada. Cilindro y `shapePath` desde `cylinderGeom`; `drawCodeNode` sin caja de palabra clave por defecto y con pesos 400/500 | F5, F7 |
| `js/geometry.js` | `cylinderGeom(n)` + helper `d` para SVG; `codeColors` con los respaldos de § 7b.4; `codeFont` con Plex Mono delante; (si D8) token de literal en `codeBlockLayout` | F7 |
| `js/export.js` | SVG del cilindro y de `code` desde las mismas funciones (se elimina el duplicado del cilindro) | F7 |
| `js/config.js` | **Solo si D1**: dos entradas en `FONTS` antes de «Mono». Es kernel → sincronizar fluyo-mcp | F0 |
| `js/export.js` | **Solo si D1**: `document.fonts.load` antes de rasterizar | F0 |
| `sw.js` | `CACHE` v72 y las fuentes para el Viewer (ya están en el núcleo) | todas |

Sin cambios en `model.js` en ninguna fase.

## 11. Compatibilidad

- **Formato, modelo de nodos y de páginas, semántica de Historias e identidad de documentos**: sin cambios en todas las fases.
- **Kernel MCP**: sin cambios, salvo si apruebas D1. En ese caso:
  - `config.js` cambia;
  - fluyo-mcp se sincroniza en el mismo despliegue;
  - las familias existentes siguen igual, Georgia sigue por defecto y no hay migración.
- **Documentos existentes**: se ven igual en el lienzo y en el SVG. Con D3, la reproducción de Historias cambia de color en editor, Viewer y Present, pero el documento no cambia.
- **Tests que afirman texto o estructura**: «Historia 1 ▾» (016), «✕ Salir» (013, Present, fuera de alcance). Ver D6.

## 12. Tests previstos

- `test/fluyo-018-14.test.cjs` (estático):
  - el Viewer carga `system.css`, sin `style` inline (CSP) y con `<use>` que resuelven;
  - `model.js` idéntico a HEAD (y `config.js`, salvo D1);
  - Historias sin `rgba(58,167,232` en `styles.css`;
  - si D1: `FONTS` conserva la primera y la última entrada, y las nuevas van antes de «Mono».
- `test/fluyo-018-14-browser.cjs` (Chrome real, 1440 / 1280 / 768 / 390 / 375):
  - Viewer: tokens, una fila, objetivos de 40 px y Historia legible;
  - modo Historias: entrar y salir, lienzo visible mínimo en móvil (umbral con margen), paso actual visible al reproducir, objetivos de 40 px;
  - panel: pantallas de scroll por sección en móvil;
  - cian residual 0 en las marcas del editor;
  - si D1: la fuente se aplica en lienzo y SVG, `code` sigue en «Mono» y exportar espera a la carga.
- Nodos `code` y BD (F7):
  - **Geometría del cilindro (vm, sin navegador)**: `cylinderGeom` produce laterales en `cx ± rx` desde `top + ry` (tangencia), una sola elipse superior y la base como media elipse. El `d` del SVG tiene exactamente dos arcos `A` en la tapa (fondo + labio) y uno en la base, sin `C`. Lienzo y SVG consumen la misma función (comprobación estática de que no queda otra construcción del cilindro).
  - **Doble línea (Chrome, píxeles)**: en una columna vertical que corta la tapa por el centro hay **un** cruce del color del borde por encima del labio (hoy hay dos), en lienzo, SVG rasterizado y Viewer, en oscuro y crema.
  - **Paridad de `code`**: con `codeColors` reales, sin datos explícitos, panel = `fillFor`, sin caja de palabra clave y fuente con Plex Mono. Con `kwBg`, `textBg`, `textColor`, `fill` o `font` explícitos, se usan tal cual (tabla de casos en vm).
  - **Cian estructural 0**: ningún píxel de la familia `#3aa7e8` en `code`/BD normales o seleccionados (lienzo, SVG, Viewer). El azul acero solo aparece donde `n.color` lo pide.
  - **Rejilla de `code`**: con Plex Mono cargada, el ancho de un token medido en el lienzo es `n·fs·0,6 ± 0,5 px`; el SVG conserva `textLength`.
  - **Golden SVG**: el SVG de los fixtures cambia solo en `cylinder` y `code` (diff acotado a esos elementos).
- `test/fluyo-018-14-mutations.cjs` con defectos plausibles de cada fase, por ejemplo:
  - vuelve la Bézier de 0,8;
  - la tapa se dibuja dos veces;
  - `codeColors` ignora un `kwBg` explícito;
  - `codeFont` pierde la reserva «Mono»;
  - el SVG no usa `cylinderGeom`.
- Regresión: unitarios completos, batería de Chrome, mutaciones de 018.12 y 018.13, `node --check`, `git diff --check`, SW.
- Si D1: el golden y los tests de fluyo-mcp tras `sync:kernel` (en ese repo).

## 13. QA en Chrome (hecha para esta auditoría)

Script de auditoría (scratchpad de la sesión, fuera del repo). Para cada viewport (1440 y 1280 con ratón; 768, 390 y 375 táctiles) y estado (sin selección, nodo, conexión, Historias, reproduciendo, Viewer y Viewer con Historia), guarda la captura y mide:

- píxeles cian (familia `#3aa7e8`) y acero (familia `#6a9fb5`), dentro y fuera del lienzo;
- familias tipográficas por zona;
- controles por debajo de 40 px (dedo) o 28 px (ratón);
- textos de menos de 11 px;
- alto y pantallas de scroll del panel;
- porcentaje del lienzo visible (muestreo `elementFromPoint`).

0 errores de consola. Capturas en `a14/` del scratchpad, con el mismo encuadre que las de 018.13 para compararlas tras implementar.

Resumen de lo medido:

- **Cian en el lienzo**: 0 en escritorio en todos los estados. En móvil, solo dentro de la hoja (muestras de color) o bajo ella.
- **Fuera del sistema tipográfico**: solo el Viewer (Segoe UI y Georgia). Editor e Historias, 100 % Plex Mono / Playfair, salvo los emojis de los Eventos (contenido).
- **Controles pequeños**:
  - escritorio: `#bgCustom` 26 × 22 y selectores de color e interruptores del panel;
  - táctil: Historias (10–12 tipos de control según el estado), rail (36 px), ▾ de página (28 × 30) y Viewer (33 px).
- **Textos de menos de 11 px**: rail (12) y rótulos del panel (20 sin selección, por los `kbd` de la ayuda).

### QA específico de `code` y BD (a ejecutar al implementar)

Mismo fixture para antes y después: dos `code` (corto y largo), una BD sola, una BD conectada por ambos lados y una BD seleccionada. Temas oscuro y crema, a densidad 2. Por cada caso:

| Caso | Lienzo | SVG (`buildSVGDocument` rasterizado) | Viewer |
|---|---|---|---|
| `code` normal | ✓ | ✓ | ✓ |
| `code` seleccionado | ✓ | — (la selección no se exporta) | — |
| `code` con texto largo | ✓ | ✓ | ✓ |
| BD normal | ✓ | ✓ | ✓ |
| BD seleccionada | ✓ | — | — |
| BD conectada por ambos lados | ✓ | ✓ | ✓ |

Comprobaciones:

- sin doble línea superior (recorte ampliado de la tapa y cruce de píxeles);
- cian estructural 0;
- la tipografía del bloque es Plex Mono en las tres superficies;
- el trazo mide 2,5 en todos los nodos;
- diferencia lienzo/SVG/Viewer por debajo de un umbral de píxeles en cada recorte (antialiasing aparte);
- capturas antes/después lado a lado para tu revisión.

Estado actual ya capturado (`n14/`). La doble línea se ve en lienzo y SVG, y el bloque de `code` es negro con cajas `#a8b34a` en oscuro y crema.

## 14. Riesgos

- **D1 (fuentes)** obliga a desplegar editor y MCP a la vez. Hasta que el SW de cada usuario se actualice, un documento con la global nueva abierto en un editor en caché vuelve a Georgia en silencio.
- **Fuentes en exportación**: sin `document.fonts.load`, un GIF hecho justo al elegir la fuente puede salir con la de reserva.
- **SVG exportado**: muestra Playfair o Plex solo donde estén instaladas; si no, la reserva de la pila.
- **Modo Historias**: es el cambio de interacción más visible. Para no romper 018.12 se apoya en `openSurface` y no inventa gestos; los tests de 016/018.12 que abren Historias por la pestaña necesitarán la nueva vía o un alias.
- **Cabecera de primer nivel (D4)**: mover ajustes a «Lienzo ▾» y «Más» cambia `placeChrome` (decisión 118) y los tests de 018.12/018.13 que buscan esos controles en la cabecera de escritorio.
- **D3**: cambia cómo se ve la reproducción de Historias ya compartidas, en el Viewer y en Present (no los datos).
- **iOS**: el zoom al enfocar y las alturas `dvh` no se pueden validar con Chrome emulado.
- **`code` y BD cambian el aspecto de documentos existentes** en lienzo, SVG y Viewer, sin cambiar sus datos:
  - la tapa de la BD;
  - el panel, el bloque, la ausencia de caja verde y la fuente de `code`.

  Un diagrama exportado antes y después se verá distinto en esos nodos.
- **fluyo-mcp `export_diagram`**: no he explorado el repo hermano (AGENTS.md § 3). Si renderiza con una copia propia de `export.js`/`geometry.js`, divergiría del editor. Hay que comprobarlo en ese repo antes de desplegar F7.

## 15. Decisiones que necesito

- **D1 — Fuentes del diagrama.** Elige una:
  - **(a)** añadir Playfair Display e IBM Plex Mono a `FONTS` (kernel) en 018.14, con sync de fluyo-mcp en el mismo despliegue;
  - **(b)** dejarlas preparadas sin tocar el kernel (selector agrupado, Viewer y exportación listos para cargarlas) y hacer el cambio de kernel en un slice propio;
  - **(c)** solo por nodo, como lista del editor, sin tocar el kernel. No recomendado: la global no las aceptaría.

  Recomiendo **(b)** si «no tocar el kernel» es firme para 018.14, y **(a)** si aceptas ese único cambio de kernel.
- **D2 — Historias como modo.** ¿Apruebas que Historias deje de ser una pestaña del panel y sea un modo, con estas reglas?
  - se entra por la barra inferior y se sale con «Volver a editar»;
  - en móvil, hoja compacta/ampliada con botón;
  - mientras está activo, el rail sigue disponible para editar el diagrama (o se oculta: dime cuál).
- **D3 — Colores compartidos de la reproducción** (token «●», rastro, brillo de «Resaltar», anillos de llegada). ¿Pasan a oliva/terracota en editor, Viewer y Present? Cambia cómo se ven las Historias ya compartidas, no sus datos.
- **D4 — Primer nivel de la cabecera.** ¿Apruebas «Lienzo ▾» (tema, tipografía global, cuadrícula, rejilla, fondo) y mover Ejemplo, Abrir, Guardar y Limpiar a «Más»?
- **D5 — Densidad del panel**:
  - panel de 288 px;
  - grupos plegables, con cuáles plegados por defecto;
  - muestras compactas;
  - secciones en la hoja móvil;
  - rail solo con icono en escritorio, o con etiqueta de 10,5 px.
- **D6 — Glifos que afirman los tests** (`Historia 1 ▾`): ¿se conservan como texto pintado con máscara (tests intactos) o se adaptan los tests a un icono real?
- **D8 — `code`.** ¿Apruebas la propuesta de § 7b.4?
  - contenedor como las cajas;
  - bloque ligero;
  - palabra clave en oliva sin caja;
  - Plex Mono como respaldo.

  ¿Incluyo también los literales en terracota? Exige un token más en `codeBlockLayout`; render compartido, sin datos.
- **D9 — Tapa de la BD.** ¿Tapa elíptica completa dibujada una vez (fondo + labio frontal, recomendada) o tapa plana sin labio (solo el arco trasero como cierre del contorno)?
- **D10 — Color por defecto de los nodos** (`#6a9fb5`, la principal fuente de «azul» en cualquier diagrama). Es `model.js`/kernel: propongo dejarlo fuera de 018.14 y decidirlo en un slice propio. ¿De acuerdo?
- **D7 — Alcance.** ¿Cabe todo en 018.14 o lo partimos? Propuesta: **018.14a** Viewer + color + tipografía + nodos `code`/BD (F0, F1, F5, F7) y **018.14b** Historias + panel + cabecera (F2–F4).

## 16. Plan de implementación por fases

| Fase | Contenido | Depende de |
|---|---|---|
| F0 | Fuentes del diagrama: `FONTS` (si D1a), selector agrupado, `@font-face` en el Viewer, `document.fonts.load` en la exportación | D1 |
| F1 | Viewer en el sistema: hojas, sprite CSP-safe, cabecera de una fila, tarjeta de Historia, Present inverso | — |
| F2 | Modo Historias: superficie propia, hoja compacta con paso actual, componentes, iconos, serif en nombres de evento | D2, D6 |
| F3 | Panel: anchura, escala, plegables, muestras compactas, secciones móviles, campos de 16 px con dedo | D5 |
| F4 | Cabecera: «Lienzo ▾» y «Más» | D4 |
| F5 | Color: `scHighlight` y chips de Historias al sistema; reproducción compartida si D3 | D3 |
| F7 | Nodos: `cylinderGeom` compartido (lienzo, SVG, `shapePath`), `code` en la paleta (§ 7b), QA específico de `code`/BD | D8, D9 |
| F6 | Tests nuevos, regresión completa, capturas comparables con 018.13, `CACHE` v72, documentación (decisiones 128+) | todas |

Cada fase termina con sus tests en verde antes de pasar a la siguiente.

## 018.14a — Implementación (Viewer, tipografía, `code`, BD, color estructural)

Decisiones del responsable para 018.14a:

- **D1 (a)**: fuentes en `FONTS` con sincronización del kernel.
- **D8**: `code` según § 7b.4, **sin** literales en terracota.
- **D9**: elipse completa una sola vez, con labio.
- **D10**: `#6a9fb5` fuera.

Dark mode de la app: fuera. 018.14b (Historias como modo, panel, cabecera, interacción móvil): sin tocar.

### Cambios de producto

1. **Tipografía (contrato `FONTS`, kernel)**:
   - `{n:"Playfair Display", f:"'Playfair Display', Georgia, serif"}` y `{n:"IBM Plex Mono", f:"'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace"}`, entre «Comic Sans» y «Mono»;
   - Georgia sigue siendo la global por defecto y «Mono» la última entrada;
   - sin migración: las 12 históricas no cambian y una global desconocida sigue cayendo a Georgia;
   - los selectores del editor agrupan las opciones en «Fluyo» (2) y «Clásicas» (12) sin cambiar ningún valor.
2. **Espera de fuentes**: `renderFontStacks`/`waitForRenderFonts` (`render.js`) cargan las pilas del documento (global, nodos, conexiones y el bloque `code`), con tope de tiempo:
   - el Viewer las espera antes del primer render;
   - la exportación GIF/PNG/JPG, antes de rasterizar;
   - el SVG lleva la pila con su reserva.
3. **`code`**:
   - panel = tinte del color del nodo (como las cajas);
   - bloque = velo de tinta (oscuro) o de papel (crema, claro);
   - texto hueso o tinta;
   - palabra clave oliva con peso 500, **sin caja**;
   - IBM Plex Mono por defecto;
   - literales sin color especial (D8);
   - los respaldos viven en `THEMES.code*` (`config.js`) y la lógica en `geometry.js`;
   - lo explícito del nodo (`fill`, `textBg`, `textColor`, `kwBg`, `kwColor`, `font`, `bold`) manda siempre;
   - la maquetación no cambia.
4. **BD**:
   - `cylinderGeom`/`cylinderSegments`/`segmentsToSVGPath` en `geometry.js`: arcos reales, tapa una vez (fondo en el contorno + labio), laterales tangentes, base limpia;
   - el lienzo (editor y Viewer) y el SVG la recorren; ya no hay construcción propia en cada superficie;
   - `shapePath` también, así que el resaltado de Historias abraza el cilindro;
   - caja, anclajes, acierto, etiqueta y tamaño sin cambios.
5. **Color estructural**:
   - el resaltado al colocar un evento (`scHighlight`) pasa del cian a `editorMark`;
   - en `code` desaparecen la caja verde `#a8b34a` y el bloque negro `#101010`;
   - los colores del documento no se tocan, incluido `#6a9fb5`.
6. **Viewer**:
   - `system.css` sobre `identity.css` y la mono precargada;
   - sprite de iconos CSP-safe (sin `style` inline);
   - cabecera de una fila con iconos: a 375–420 px, «Abrir en Fluyo» se queda en «Abrir» y el nombre completo va en `aria-label`;
   - páginas en serif, Historia como tarjeta de lectura, mando de Present en material inverso y firma discreta;
   - los textos con glifo de la Historia (`▶ Reproducir historia`, `↻ Repetir`, `■ Detener`) los escribe `viewer.js` y los afirman los tests de 014/016: no cambian.
7. **`docs/`**: el bloque `code` usa IBM Plex Mono por defecto y la palabra clave sin `kwBg` no lleva caja.

### Archivos modificados (018.14a)

- **fluyo, producto**:
  - `js/config.js` (kernel);
  - `js/geometry.js`, `js/render.js`, `js/export.js`, `js/viewer.js`, `js/ui.js`;
  - `s/index.html`, `css/share.css`, `css/styles.css` (ancho fijo del selector de tipografía en la cabecera);
  - `docs/index.html`, `sw.js`.
- **fluyo, tests**:
  - nuevos: `test/fluyo-018-14a.test.cjs`, `test/fluyo-018-14a-browser.cjs`, `test/fluyo-018-14a-mutations.cjs`;
  - adaptados: `test/fluyo-018-13.test.cjs` (el Viewer ya carga `system.css`; el alcance de `config.js` pasa al test de 018.14a);
  - pins de `CACHE` v71 → v72: `fluyo-010-qa`, `013`, `014`, `015`, `018-10` (test, browser, M8), `018-12` (test, U1), `018-13` (test, browser, U1).
- **fluyo, documentación**: `.ai/ARCHITECTURE.md` (§ 018.14a), `.ai/DECISIONS.md` (128–130), esta tarea.
- **fluyo-mcp**:
  - `src/generated/config.ts` (`sync:config`);
  - `src/generated/kernel-sources.ts` (`sync:kernel`);
  - `src/svg.ts` (port de `codeColors`, `codeFont`, `codeTokenWeight` y `cylinderSegments`/`segmentsToSVGPath`);
  - `test/visual-regression.test.ts` (paridad nueva);
  - `test/render.test.ts` (salida de `pageToSVG`);
  - `README.md` (`list_fonts`: 14).

### CACHE

`fluyo-static-v71` → **`fluyo-static-v72`**, un solo salto. Cambian los archivos servidos `config.js`, `geometry.js`, `render.js`, `export.js`, `viewer.js`, `ui.js`, `styles.css`, `share.css`, `s/index.html` y `docs/index.html`. No hay archivos servidos nuevos: el Viewer usa `system.css` y las fuentes, que ya estaban en el núcleo del precache.

### Kernel / MCP

- **`export_diagram` no comparte código con la app**: usa `fluyo-mcp/src/svg.ts`, un port TypeScript de `geometry.js`/`export.js` vigilado por un test de paridad que carga `fluyo/js/geometry.js` real.
- **Cambio mínimo para la paridad**: portar las cuatro funciones nuevas a `svg.ts` (sin segunda definición de colores: llegan de `THEMES` por `sync:config`) y ampliar la paridad a `codeFont`, `codeTokenWeight`, `cylinderSegments` y `segmentsToSVGPath`, con 11 casos de datos explícitos × 3 temas y 4 tamaños de cilindro. Además, un test sobre la salida real de `pageToSVG`:
  - sin `<ellipse>` ni Bézier en el cilindro;
  - 3 `<rect>` en un `code` sin `kwBg`;
  - Plex Mono por defecto;
  - `kwBg` y `font` explícitos respetados.
- **Kernel**: solo cambia `config.js`; `KERNEL_ID` pasa de `5907c3e3…` a `f599372f…`; `list_fonts` devuelve 14; `check:config` y `check:kernel` en verde.
- **Aviso**: `kernel-sources.ts` dice «sincronizado desde 604b344» porque fluyo no tiene commit todavía. Hay que volver a ejecutar `sync:kernel` tras el commit de fluyo para que la etiqueta apunte a la revisión real (el contenido no cambiará).
- **Despliegue**: editor y MCP a la vez. Un documento con la global nueva, abierto en un MCP sin sincronizar, sería rechazado con `INVALID_FIELD`.

### Tests

- **fluyo, unit/estático**: `node --test test/*.test.cjs` → **1035/1035**, que son:
  - los 1024 de 018.13;
  - 11 nuevos de `test/fluyo-018-14a.test.cjs`: contrato `FONTS` y diff de `config.js` frente a HEAD, `model.js` intacto, globales históricas, nueva y desconocida, respaldos y datos explícitos de `code`, geometría y tangencia del cilindro, uso compartido en lienzo/`shapePath`/SVG, espera de fuentes, Viewer CSP-safe, precache y `docs/`.

  `editor-runtime` y `render-boundary`: OK. `node --check`: OK. `git diff --check`: limpio en los dos repos.
- **`test/fluyo-018-14a-browser.cjs`** (Chrome real) — **230 ✔ · 0 ✘**. 1440/1280 con ratón, 768/390/375 táctiles, temas oscuro y crema:
  - **BD**: tapa con 2 cruces en el lienzo; perfil completo (tapa, labio, base) en lienzo y SVG rasterizado; 2 cruces en el Viewer;
  - **color**: cian 0 en lienzo con y sin selección, en el SVG y en el Viewer; selección en oliva;
  - **`code`**: sin caja verde por defecto en lienzo, SVG y Viewer; con `kwBg` explícito, la caja se respeta; texto largo sin cajas; Plex Mono 400/500 cargada; SVG con `'IBM Plex Mono'` y peso 500;
  - **fuentes**: selector agrupado (2 + 12) que guarda la pila; reabrir conserva la global nueva; el Viewer arranca con las fuentes del documento cargadas;
  - **Viewer**: papel, Playfair y Plex, cabecera de una fila;
  - **compatibilidad**: documento con fuentes históricas reabierto idéntico; `code` con «Mono» explícita la conserva; global desconocida → Georgia; exportar a PNG espera a las fuentes y luego rasteriza;
  - 0 peticiones a terceros (salvo gif.js) y 0 errores.
- **`test/fluyo-018-14a-mutations.cjs`** — **17/17 detectadas**. 10 estáticas (U1–U10) y 7 en Chrome (B1–B7), entre ellas:
  - doble geometría antigua;
  - tapa dibujada dos veces;
  - SVG con su propia elipse;
  - SVG que diverge del lienzo (arcos invertidos);
  - cajas de palabra clave reintroducidas;
  - `kwBg` explícito ignorado;
  - fuente nueva ignorada o sin cargar;
  - exportación y Viewer sin esperar;
  - selección cian;
  - Viewer sin sistema.

  B3 sobrevivió a la primera versión del test (el corte de la tapa seguía dando 2 cruces); se añadió el perfil completo y ahora se detecta.
- **Batería de Chrome existente** (25 suites) + mutaciones de 018.12: **todas en verde** salvo `fluyo-011-browser`, con los mismos 4 fallos que en HEAD (pendiente desde 018.12). En la primera pasada fallaron tres suites, corregidas y repetidas en verde:
  - `fluyo-016-browser` y `fluyo-017-3-browser`: el rótulo «Historia» del Viewer iba en mayúsculas por CSS, y `innerText` lo devolvía así. Se quitó el `text-transform`.
  - `fluyo-018-13-browser`: con «Playfair Display» en la lista, el selector de tipografía crecía y la cabecera de 1280 se partía. Se fijó su ancho.
- **fluyo-mcp**: `npm test` → **643/643** (antes 637):
  - paridad nueva en `visual-regression`;
  - 6 de `render.test` sobre la salida de `pageToSVG`.

  `check:config` y `check:kernel` en verde; `REQUIRE_FLUYO=1` en verde. Tres mutaciones manuales de `svg.ts`, todas detectadas tras endurecer el test:
  - segunda elipse;
  - caja de palabra clave siempre;
  - tapa desplazada.

### Chrome QA

- **Capturas comparables antes/después** de 5 viewports × oscuro/crema, en lienzo (con `code` y BD seleccionados), SVG (`buildSVGDocument` rasterizado) y Viewer: `q14a/antes`, `q14a/despues` y `compare14a/` del scratchpad. También las del browser test, en `t14a/`.
- **Tapa de la BD** (corte vertical por el centro, con el color del borde):

  | Superficie | Antes | 018.14a |
  |---|---|---|
  | Lienzo | 3 cruces | 2 cruces |
  | SVG | 3 cruces | 2 cruces |
  | Viewer | 3 cruces | 2 cruces |

  A zoom muy pequeño (≤ 0,5) los trazos se funden y el corte no discrimina; el test fija el zoom.
- **Perfil completo** (tapa, labio, base en su sitio): idéntico en lienzo y SVG.
- **Cian**: 0 px en lienzo, SVG y Viewer, con y sin selección. El cian que daban las capturas completas venía de flecos de antialiasing del texto de la cabecera, no del lienzo.
- **`code`**: 0 px de caja verde por defecto (lienzo, SVG, Viewer). Con `kwBg` explícito, la caja se respeta. Plex Mono cargada en 400/500 en editor y Viewer.

### Desviaciones

- **Colores compartidos de la reproducción** (token «●», rastro y brillo `FLOW_ACCENT`, efecto «Resaltar», anillos de llegada): siguen como estaban. Son D3, que no se aprobó para 018.14a, y no son estructurales de `code`/BD.
- Quedan otros dos azules en `render.js`, fuera del alcance de estos componentes:
  - el brillo del «pulso» de una imagen;
  - un respaldo de color inalcanzable en documentos normalizados.
- **Playfair Display solo tiene el peso 400** en el repo. Una etiqueta en negrita con Playfair usa negrita sintética del navegador; añadir el 700 sería otra decisión de peso.
- **El selector agrupa las fuentes** (§ 6.3). No estaba aprobado de forma explícita, pero no cambia ningún valor; reversible en una línea.
- **Viewer**: los botones de la Historia conservan su texto con glifo (ver arriba). En la cabecera solo se sustituyeron por iconos los controles estáticos.
- **fluyo-mcp**: el test de paridad requería pasar `FONTS` con la forma de `config.js` (`{n, f}`) al cargar `geometry.js`; antes no hacía falta porque nada lo leía.

### Pendientes (018.14b y después)

- Historias como modo, panel, cabecera y móvil (018.14b).
- D3 (colores de la reproducción compartida).
- Dark mode de la app.
- `#6a9fb5` (D10).
- Peso 700 de Playfair, si se quiere.
- Volver a ejecutar `sync:kernel` tras el commit de fluyo.

## Handoff

### Estado actual

018.14a implementado y verificado (§ 018.14a). 018.14b sin empezar.

### Próximo paso concreto

1. Revisión del responsable.
2. Con OK, commit de fluyo (018.11–018.14a) y de fluyo-mcp, en este orden.
3. Volver a ejecutar `npm run sync:kernel` en fluyo-mcp para que la etiqueta de revisión apunte al commit nuevo.
4. Desplegar editor y MCP a la vez (`CACHE` v72).
5. Después, 018.14b con las decisiones D2, D4, D5 y D6.

---

## 018.14b — Plan y matriz de aceptación (escrito antes de implementar)

Fuentes leídas para este slice: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 130), `.ai/tasks/FLUYO-018.11.md`, esta tarea, `index.html`, `css/{identity,system,styles}.css`, `js/ui.js`, los tramos de `js/editor-scenarios.js` (panel, transporte, marcas, `ResizeObserver`), `js/present-story.js`, `js/state.js` (autoguardado y `syncProjectControls`) y los browser tests de 013, 016, 018.12, 018.13 y 018.14a. `render.js` y `viewer.js` no se tocan (018.14a).

Base antes de tocar nada: `node --test test/*.test.cjs` → **1035/1035**.

### B0. Mapa de estado

| Estado | Ejemplos | Dónde vive | ¿Se serializa? |
|---|---|---|---|
| **Documento** | `doc.theme`, `doc.customBg`, `settings.font/grid/snap/speed/dots/build/stagger/single`, páginas, Historias | `doc`/`settings` (`model.js`, `state.js`). `#themeSel`, `#bgCustom`, `#fontGlobalSel`, `#chkGrid` y `#chkSnap` solo lo reflejan (`syncProjectControls`) | Sí: `.fluyo.json`, autoguardado, `#d=` |
| **Aplicación** (preferencia del navegador) | **tema de la interfaz** (nuevo) | `localStorage["fluyo.ui.theme"]` → `<html data-ui-theme>` | **No**: nunca entra en `serializeProject`, el autoguardado ni los enlaces |
| **UI efímera** | superficie abierta (`body.panelOpen`), menús abiertos, hoja ampliada, grupos plegados del panel | DOM (`<details open>`, clases de `body`) | No |
| **Modo Historia** | modo activo (nuevo, `uiMode`), Historia activa (`scActiveId`), `scStatus`, `scPlayback`, colocación | `ui.js` (`uiMode`, única fuente; `body.storyMode` lo refleja) + `editor-scenarios.js` (lo existente, sin cambios de semántica) | No |

Reglas:

- el modo se decide en **un** sitio (`setUiMode`, `ui.js`) y `activeSurface()` deriva de él;
- los grupos plegados son el propio `<details>`, sin variable espejo;
- el tema de la interfaz y el del lienzo no se leen ni se escriben entre sí.

### B1. Decisiones que cambian producto o interacción

| # | Problema | Alternativas | Recomendación (lo que se implementa) | Impacto |
|---|---|---|---|---|
| **B1** | Historias es una pestaña del panel | a) pestaña restilizada · b) **modo global** con conmutador en la cabecera y salida en la propia superficie · c) modal | **b**. Escritorio y tableta: conmutador segmentado en la cabecera (`#tabProperties` = Editar, `#tabScenarios` = Historias, mismos ids). Móvil: «Historias» de la barra inferior. Salida «Volver a editar» en la superficie. En modo Historia **el rail se oculta**: no se crean formas mientras se narra; seleccionar, mover y colocar eventos siguen | Los tests que abren Historias por `#tabScenarios` siguen valiendo. Crear formas exige volver a Editar |
| **B2** | «Volver a editar» significaba dos cosas (018.11, P2-8) | a) mantener · b) **«Volver a editar» = salir del modo Historia**; el botón del Playback terminado pasa a «Terminar» | **b**. `#scReset` dice «■ Detener» reproduciendo y «Terminar» al acabar. El aviso de Compartir pasa a «Pulsa «Terminar» antes de compartir.» | Cambia un texto que afirmaban los tests de 016: se adaptan con la misma intención |
| **B3** | Salir del modo durante la reproducción | a) deshabilitar «Editar» mientras se reproduce (hoy) · b) **salir siempre**: detiene la Historia y vuelve a editar | **b**: la salida nunca está bloqueada | `#tabProperties` deja de deshabilitarse en Playback (013 solo afirma que está habilitada tras detener) |
| **B4** | Modo oscuro de la interfaz | a) seguir al sistema · b) **dos valores (clara/oscura), clara por defecto**, preferencia del navegador · c) tres valores | **b**: interruptor «Interfaz oscura» en «Más» → `localStorage["fluyo.ui.theme"]`, aplicado antes del primer pintado. El Viewer no la sigue (fuera de alcance) | Nadie ve cambiar su interfaz sin pedirlo. Seguir al sistema queda como mejora posible |
| **B5** | Cabecera plana | — | Presentar = primaria (terracota); Compartir = secundaria con borde; Exportar = fantasma. Tema, fondo, tipografía global, cuadrícula y ajustar → «Lienzo» (popover en escritorio y tableta; sección «Lienzo» de «Más» en móvil). Ejemplo, Abrir, Guardar y Limpiar → «Más» › Archivo en **todas** las anchuras | Ctrl+S sigue guardando. Los tests que buscaban esos controles en la cabecera de escritorio se adaptan |
| **B6** | Panel-formulario | — | 288 px (escritorio > 1024). Grupos `<details>`: **abiertos** Texto, Forma y color, Recorrido y Trazo (lo que se toca en cada elemento); **plegados** Código (palabras clave: una vez por bloque), Capas y aparición (orden Z, pulso, orden de aparición: raros), Flujo (puntos y velocidad: ajuste fino), Animación del lienzo (ajuste del documento) y Atajos (referencia). Muestras en dos filas con «Más colores» | Toda propiedad sigue alcanzable; ids intactos |
| **B7** | Rail con etiquetas de 9,5 px | — | Solo icono + tooltip (escritorio) y `aria-label`; en móvil, solo icono a 40 px | Las etiquetas siguen en el DOM como texto accesible |
| **B8** | Cerrar hojas «tocando fuera» | — | Hoja de Propiedades (móvil): un toque en el vacío del lienzo la cierra (el mismo toque que deselecciona). Hoja de Historias: no se cierra al tocar el lienzo (ahí se colocan eventos); si estaba ampliada, vuelve a compacta | Sin velo bloqueante: el lienzo sigue manejable con la hoja abierta |
| **B9** | Que se note que se reproduce | — | Bloque «Reproduciendo» en la superficie (título, momento actual con `FluyoStory.describe`, progreso) y filete oliva en el marco del lienzo mientras dura | Colores de reproducción (D3) intactos |

### B2. Matriz de aceptación

Viewports: **1440×900, 1280×800, 1101×800** (ratón) · **768×1024** (táctil) · **390×844, 375×667** (táctil).

Estados por viewport:

- **E1** editor normal;
- **E2** panel abierto (nodo seleccionado);
- **E3** Historia abierta;
- **E4** Historia reproduciendo;
- **E5** interfaz oscura;
- **E6** lienzo claro (`crema`);
- **E7** lienzo oscuro (`dark`).

Medidas en cada celda (Chrome real): % de lienzo visible (muestreo `elementFromPoint`), alto y filas de cabecera, ancho del panel o superficie, controles fuera del viewport, controles por debajo del objetivo (40 px con dedo; 28 px con ratón), overflow horizontal y contraste texto/superficie de cabecera y panel.

| Requisito | 1440 | 1280 | 1101 | 768 | 390 | 375 |
|---|---|---|---|---|---|---|
| Cabecera en 1 fila, sin overflow, ≤ 56 px | E1–E7 | E1–E7 | E1–E7 | E1–E7 | E1–E7 | E1–E7 |
| Panel de Propiedades | 288 px | 288 px | 288 px | ≤ 264 px | hoja ≤ 52 % del alto | hoja ≤ 52 % |
| Pantallas de scroll de un nodo (grupos por defecto) | ≤ 1,3 | ≤ 1,3 | ≤ 1,4 | ≤ 1,4 | ≤ 1,6 | ≤ 1,9 |
| Lienzo visible E1 | ≥ 70 % | ≥ 65 % | ≥ 60 % | ≥ 60 % | ≥ 70 % | ≥ 60 % |
| Superficie de Historia E3 | 320 px, sin rail | 320 | 320 | 280 | hoja compacta | hoja compacta |
| Lienzo visible E3 | ≥ 65 % | ≥ 60 % | ≥ 55 % | ≥ 55 % | ≥ 55 % | ≥ 45 % |
| E4: lienzo visible, «Reproduciendo» y Detener a la vista | ✔ | ✔ | ✔ | ✔ | ≥ 60 % | ≥ 55 % |
| «Volver a editar» visible y funcional en E3/E4 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| E5: cabecera, rail, panel, pestañas, controles, hojas, menús y diálogos propios oscuros; `doc.theme` igual | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| E6/E7: cambiar el lienzo no cambia la interfaz (ni al revés) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Controles críticos dentro del viewport (Deshacer, Rehacer, Compartir, Presentar, Más, Propiedades/Historias, Volver a editar, Reproducir/Detener) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Objetivos táctiles ≥ 40 px (cabecera, barra inferior, hojas; en Historias: +, ⋯, asas, esperas, Reproducir) | — | — | — | ✔ | ✔ | ✔ |
| Sin overflow horizontal de página | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

Pruebas específicas, además de la matriz:

1. **Sin segunda fila** a 1440/1280/1101/768/390/375, en claro y oscuro, en edición y en Historia.
2. **Cierre táctil de la hoja**: Propiedades se cierra con su botón, con ⚙ y tocando el vacío del lienzo; nada tapa a quien la abre.
3. **Historia en móvil**: entrar, reproducir, ver el paso actual, detener, terminar, ampliar/reducir y volver a editar, todo con toques.
4. **Tema de app ≠ tema de documento**: cambiar uno no cambia el otro; el documento serializado no contiene la preferencia; abrir otro documento conserva la interfaz.
5. **Persistencia**: la interfaz oscura sobrevive a recargar (localStorage) y no viaja en el autoguardado ni en `#d=`; un `localStorage` inaccesible no rompe el editor.
6. **Objetivos táctiles** ≥ 40 px en las superficies nuevas.
7. **Overflow horizontal**: ninguno.
8. **Controles críticos** dentro del viewport en todos los estados.
9. **Regresión de 018.12**: renombrar página con el dedo, Deshacer/Rehacer en móvil, y mover, seleccionar y conectar con el dedo.

Mutaciones previstas (`test/fluyo-018-14b-mutations.cjs`):

- modo oscuro parcial (una superficie sin redefinir);
- tema de app escrito en el documento;
- panel de vuelta a 256 o 336 px;
- Historias de nuevo como pestaña (sin `storyMode`, rail visible);
- hoja móvil sin cierre;
- cabecera que vuelve a partirse a 1280;
- objetivos táctiles reducidos;
- controles críticos ocultos en móvil;
- «Volver a editar» que no sale del modo;
- preferencia de interfaz sin persistir.

---

## 018.14b — READY FOR REVIEW

Fecha: 8 de octubre de 2026. Base: el árbol de 018.14a (sin commit sobre `604b344`). El plan, el mapa de estado, las decisiones B1–B9 y la matriz de aceptación están en § «018.14b — Plan y matriz de aceptación», escritos antes de tocar código.

### Cambios

1. **Historias como modo** (B1–B3, B9):
   - conmutador «Editar · Historias» en la cabecera (escritorio y tableta) con los ids de las antiguas pestañas; en móvil, «Historias» de la barra inferior;
   - en modo Historia el rail desaparece y la superficie lateral es la de la Historia (320 px; 300 en tableta);
   - salida inequívoca «Volver a editar» en la propia superficie; nunca se bloquea: si se reproduce, detiene y sale;
   - el Playback terminado se cierra con «Terminar» (antes «Volver a editar»);
   - transporte con jerarquía: Reproducir primario; Detener/Terminar secundario;
   - bloque «Reproduciendo» con el momento en curso y el progreso (`FluyoStory.describe`, la misma lectura que Present) y filete oliva en el marco del lienzo;
   - móvil: hoja compacta, «Ampliar» con un botón, aún más baja al reproducir; la biblioteca pasa a paleta flotante en la altura compacta;
   - iconografía: ▶ ■ ↻ ▾ ⋯ + y las marcas de la línea de tiempo se pintan con el trazo del sistema; el texto con glifo se conserva (contratos de tests, lector de pantalla).
2. **Panel de propiedades** (B6):
   - 288 px en escritorio (216 en tableta, como antes);
   - el texto siempre arriba; grupos `<details>`: abiertos Texto, Forma y color, Recorrido y Trazo; plegados Código, Flujo, Capas y aparición, Animación del lienzo y Atajos y gestos;
   - en la hoja móvil todo plegado y en acordeón;
   - rejillas de color de dos filas con «Más colores»;
   - etiquetas asociadas a su control (la fila entera es el objetivo); interruptores, campos de color y deslizadores a tamaño táctil.
3. **Rail**: solo icono, nombre accesible y tooltip a la derecha (B7).
4. **Cabecera** de tres zonas (B5): marca · historial | modo ··· «Lienzo ▾» | Exportar · Compartir · **Presentar** · Más.
   - «Lienzo ▾» = ajustes del documento (tema, fondo propio, tipografía global, cuadrícula, ajustar);
   - «Más» = Archivo (Ejemplo, Abrir, Guardar, Limpiar) + Interfaz + enlaces del proyecto;
   - una fila en todas las anchuras medidas.
5. **Interfaz oscura** (B4): «Más» › Interfaz › «Interfaz oscura».
   - Preferencia del navegador (`localStorage["fluyo.ui.theme"]`), aplicada antes del primer pintado.
   - Separada del tema del lienzo: no se lee ni se escribe entre ellos y no viaja en el documento, el autoguardado ni los enlaces.
   - Transforma cabecera, rail, panel, conmutador, controles, hojas, menús y diálogos propios redefiniendo los tokens semánticos de `system.css`.
   - Los tintes que estaban escritos a mano en las reglas pasan a tokens.
6. **Responsive y táctil** (B8):
   - la hoja de Propiedades se cierra con su botón, con ⚙ o tocando el vacío del lienzo;
   - la de Historias no se cierra al tocar el lienzo (ahí se colocan eventos), pero vuelve a compacta;
   - objetivos de 40 px también en Historias (⋯, esperas, asas, eventos, frases), en las pestañas de página y en «＋»;
   - se conservan Deshacer/Rehacer, renombrar con el dedo, mover, seleccionar y conectar (018.12).

### Decisiones

B1–B9 en § Plan, registradas como **131–139** en `.ai/DECISIONS.md`.

Las que cambian producto o interacción y conviene que revises:

- **B1**: el rail se oculta en modo Historia.
- **B2**: «Terminar» en lugar de «Volver a editar» para el Playback terminado.
- **B3**: la salida no se bloquea durante la reproducción.
- **B4**: interfaz clara por defecto, sin seguir al sistema.
- **B5**: Archivo vive en «Más» en todas las anchuras y Presentar es la primaria.

### Archivos

- Producto (servidos): `index.html`, `css/system.css`, `css/styles.css`, `js/ui.js`, `js/editor-scenarios.js` (solo UI), `js/editor-share.js` (un texto), `js/interaction.js` (tecla C en modo Historia), `sw.js`.
- Sin cambios respecto a 018.14a: `model.js` y el resto del kernel, `config.js`, `render.js`, `geometry.js`, `export.js`, `viewer.js`, `s/index.html`, `css/share.css`, `css/identity.css` y fluyo-mcp. Comprobado con un diff contra una copia del árbol previo y con el test de alcance frente a HEAD.
- Tests nuevos: `test/fluyo-018-14b.test.cjs`, `test/fluyo-018-14b-browser.cjs`, `test/fluyo-018-14b-mutations.cjs`.
- Tests adaptados, con la misma intención:
  - `fluyo-016.test.cjs` y `fluyo-016-browser.cjs`: «Terminar»; entrada a Historias en móvil; espera al cambio de media query;
  - `fluyo-018-12.test.cjs` y `fluyo-018-12-browser.cjs`: Animación como grupo; Archivo en «Más»; «Lienzo»; salida de la hoja de Historias; hoja ya compacta; HEAD-comparación con «Más»;
  - `fluyo-018-13.test.cjs` y `fluyo-018-13-browser.cjs`: tres filetes; rótulos Archivo/Lienzo; Presentar primaria; grupos `<details>`; cuadrícula en «Lienzo»;
  - `fluyo-018-3-browser.cjs` y `fluyo-018-7a-browser.cjs`: se despliegan los grupos antes de usar sus controles; tema por «Lienzo»;
  - `fluyo-018-5-browser.cjs`: vuelve a Editar antes de usar el rail;
  - `scenario-qa`, `share-post-qa` y `share-realistic-size`: «Guardar» desde «Más»;
  - mutaciones obsoletas por el cambio de estructura: 018.12 B2 y B7; 018.13 B1 y B9.
- Pins de `CACHE` v72 → v73: `fluyo-010-qa`, `013`, `014`, `015`, `018-10` (test, browser, M8), `018-12` (test, U1), `018-13` (test, browser, U1), `018-14a` (test, U1).
- Documentación: `.ai/DECISIONS.md` (131–139), `.ai/ARCHITECTURE.md` (§ 018.14b), `CONTRIBUTING.md` (mapa), esta tarea.

### CACHE

`fluyo-static-v72` → **`fluyo-static-v73`**, un salto.

- Cambian los servidos `index.html`, `system.css`, `styles.css`, `ui.js`, `editor-scenarios.js`, `editor-share.js`, `interaction.js` y `sw.js`.
- No hay archivos servidos nuevos.
- QA del Service Worker: instala `fluyo-static-v73` y, sin red, sirve la UI nueva ya en oscuro si esa es la preferencia (`018.14b-browser`, parte `sw`). La batería de 013-qa (upgrade y offline) y de 018.10 siguen en verde.

### Tests

- `node --test test/*.test.cjs` → **1045/1045** (1035 + 10 de 018.14b). `node --check js/*.js`: OK. `git diff --check`: limpio.
- `test/fluyo-018-14b-browser.cjs` (Chrome real) → **530 ✔ · 0 ✘**:
  - 6 viewports × interfaz clara/oscura × lienzo oscuro/crema × E1–E4;
  - interfaz oscura completa y lienzo idéntico con las dos interfaces;
  - «Lienzo» y «Más»;
  - tres salidas táctiles de la hoja;
  - Historia en móvil solo con toques;
  - renombrar, conectar y Deshacer/Rehacer con el dedo;
  - persistencia (recarga, autoguardado, enlace, otro documento, localStorage inaccesible);
  - SW v73.
- **Batería de Chrome completa** (26 suites): 25 en verde. `fluyo-011-browser` falla con exactamente los mismos subtests que antes del slice (4, 6 y el de SW v45→v61; comprobado ejecutándolo sobre la copia previa). `scenario-qa` y `share-post-qa` terminan en su «NOT RUN — environment» habitual, después de pasar el paso de guardar.
- **fluyo-mcp**: `npm test` → **643/643**; `check:kernel` y `check:config` en verde (sin cambios en ese repo).

### Mutaciones

- **018.14b: 22/22 detectadas**: 10 estáticas/vm y 12 en Chrome. Entre ellas:
  - modo oscuro parcial (token o cabecera);
  - el tema de la interfaz escrito en el documento o cambiando el lienzo;
  - panel a 256 px o Historias a 336 px;
  - Historias sin modo o con rail;
  - «Editar» bloqueado;
  - «Volver a editar» con doble sentido;
  - tinte suelto;
  - CACHE sin subir;
  - tema aplicado tarde;
  - Archivo de vuelta en la cabecera (la parte a 1280);
  - hoja sin cierre o sin cierre al tocar fuera;
  - objetivos táctiles reducidos;
  - «Volver a editar» oculto en móvil;
  - hoja de Historias alta;
  - preferencia sin guardar;
  - sin «Reproduciendo».
- Regresión: 018.13 **18/18**, 018.12 **18/18**, 018.14a **17/17**, 018.10 **9/9**.

### QA Chrome (medido, antes → 018.14b)

Script de QA en el scratchpad de la sesión (fuera del repo). Mide, con el mismo método en el árbol previo y en el final, en 6 viewports × 2 temas de lienzo (× 2 interfaces después):

- % de lienzo visible (muestreo `elementFromPoint`);
- alto y filas de la cabecera;
- ancho o alto del panel y pantallas de scroll;
- objetivos pequeños (40 px con dedo, 28 con ratón);
- controles críticos fuera o tapados;
- overflow horizontal y contraste.

Lienzo oscuro, interfaz clara:

| Viewport | E1 lienzo | E2 panel · pantallas | E3 Historia: lienzo · superficie | E4 reproduciendo: lienzo | Objetivos pequeños (E1–E4) |
|---|---|---|---|---|---|
| 1440 | 68 → 66 % | 256 → 288 px · 2,14 → 1,16 | 63 → 67 % · 336 → 320 px | 63 → 67 % | 6/11/5/1 → 0 |
| 1280 | 64 → 61 % | 256 → 288 px · 2,45 → 1,32 | 58 → 62 % · 336 → 320 px | 58 → 62 % | 6/11/5/1 → 0 |
| 1101 | 60 → 57 % | 256 → 288 px · 2,45 → 1,32 | 54 → 59 % | 54 → 59 % | 6/11/5/1 → 0 |
| 768 | 56 → 56 % | 216 px · 2,10 → 1,36 | 42 → 52 % · 336 → 300 px | 42 → 52 % | 7/12/27/13 → 0 |
| 390 | 83 → 81 % | hoja 439 px · 4,19 → 1,00 | 31 → 55 % · hoja 439 → 270 px | 53 → 61 % | 14/24/39/25 → 0 |
| 375 | 77 → 75 % | hoja 347 px · 5,30 → 1,18 | 25 → 52 % · hoja 347 → 213 px | 48 → 57 % | 14/24/39/25 → 0 |

- En todas las celdas: cabecera de **una fila** (50–52 px), **0** overflow horizontal, **0** controles críticos fuera o tapados y **0** errores de consola.
- Contraste de la cabecera: 15,7:1 en clara y 14,3:1 en oscura.
- Con la interfaz oscura, las mismas medidas (el layout no cambia con el tema).

Capturas, en el scratchpad de la sesión:

- `qa-antes-final/` y `qa-despues-final/`: cada viewport y estado;
- `compare14b/`: 8 pares antes | después y 4 pares interfaz clara | oscura;
- las del browser test, en el temporal que imprime.

### Desviaciones

- **Lienzo en E1 de escritorio**: −2 a −3 puntos frente a antes (1440: 68 → 66 %; 1280: 64 → 61 %; 1101: 60 → 57 %).
  - Es el coste del panel de 288 px que pide el slice (el rail adelgaza 8 px, pero el panel crece 32).
  - La matriz pedía ≥ 70/65/60 %, y no es compatible con 288 px; el browser test fija lo medido.
  - Lo compensa en parte: el panel ya no necesita scroll para lo frecuente (2,1–2,5 → 1,2–1,3 pantallas) y Historias gana 4–5 puntos.
  - Propuesta para otro slice: panel plegable en escritorio.
- **768 en Historias**: 52 % (antes 42 %), por debajo del 55 % de la matriz.
  - Con menos de 300 px la biblioteca de eventos pasa a paleta flotante y «+ Crear evento» deja de estar a la vista (lo detectó `fluyo-011-browser`).
  - Se prefirió mantenerla dentro.
- **Móvil E1**: −2 puntos (el rail de iconos de 40 px es 4 px más alto que el de 36).
- **E4 móvil**: el bloque «Reproduciendo» ocupa la hoja; las pantallas de scroll del panel suben (1,52/1,92), pero lo que importa (momento, Detener) queda arriba y a la vista.
- **Glifos que siguen como texto**, por ser contratos de tests o contenido:
  - «● / ○» en el selector de Historias;
  - «+ Crear evento» y «+ Nueva historia»;
  - el diálogo de evento (× y chips ◎ T ✦ ◐ ✺ ●);
  - el registro de Detalles;
  - Present (fuera de alcance).
- **Los azules restantes de 018.14a** (chips del diálogo de evento, reproducción D3) siguen fuera, como pedía el encargo.

### Pendientes

- Revisar B1–B5 (§ Decisiones).
- Panel plegable en escritorio (devolvería el lienzo de E1 por encima del 70 %).
- Seguir al sistema (`prefers-color-scheme`) como tercera opción de la interfaz.
- Que el Viewer siga la interfaz oscura (no se tocó por 018.14a).
- Glifos restantes del diálogo de evento y de Present.
- D3 (colores de la reproducción) y D10 (`#6a9fb5`), sin cambios.
- `fluyo-011-browser`: sus 3 fallos previos siguen pendientes desde 018.12.
- `fluyo-018-9-mutations`: el análisis estático de patrones marca M1–M4 sobre `model.js` como no encontrados. `model.js` no ha cambiado en este slice (idéntico a HEAD); no se ejecutó esa batería, queda por revisar aparte.
- Volver a ejecutar `npm run sync:kernel` en fluyo-mcp tras el commit (pendiente desde 018.14a).

### git status (fluyo, al cerrar)

Sin commit. Modificados de 018.14b (más los de 018.11–018.14a, que ya estaban):

- `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `CONTRIBUTING.md`;
- `index.html`, `css/styles.css`, `css/system.css` (sin seguimiento desde 018.13);
- `js/ui.js`, `js/editor-scenarios.js`, `js/editor-share.js`, `js/interaction.js`, `sw.js`;
- los tests listados arriba.

Nuevos sin seguimiento: `test/fluyo-018-14b.test.cjs`, `test/fluyo-018-14b-browser.cjs`, `test/fluyo-018-14b-mutations.cjs`.

fluyo-mcp: sin cambios en este slice.

## Handoff (018.14b)

### Estado actual

018.14a y 018.14b implementados y verificados. Sin commit, push ni deploy.

### Próximo paso concreto

1. Revisión del responsable de B1–B5 (y de las desviaciones de lienzo en E1).
2. Con OK: commit de fluyo (018.11–018.14b) y de fluyo-mcp (018.14a), y `npm run sync:kernel` en fluyo-mcp.
3. Desplegar editor y MCP a la vez (`CACHE` v73).
