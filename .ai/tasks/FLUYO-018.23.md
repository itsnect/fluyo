# FLUYO-018.23 — Panel de Propiedades de escritorio: menos complejidad, misma capacidad

Estado: **IMPLEMENTADO — READY FOR COMMIT** (auditoría, diseño aprobado D1–D11 e implementación; ver «Implementación» al final). Sin commit, push ni deploy. `CACHE` v80 → v81.
Fecha: 13 de octubre de 2026.
Owner/agente actual: libre (pendiente de revisión del owner y commit).

> Repo público: solo contenido técnico del proyecto open source.
> Base: `fluyo` `1a9ca92` (018.22 integrado), árbol limpio, `CACHE` `fluyo-static-v80`.
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md` (panel, 018.14b, 018.17, 018.19), `.ai/DECISIONS.md` (117–179, en especial 118, 131, 134–136, 149–151, 161, 162), `.ai/tasks/FLUYO-018.17.md` (D4, M1–M3, § «selector de dirección»), `FLUYO-018.18.md` (§3.7, §3.8, C9, D15), `FLUYO-018.19.md` (§ «A 018.20»), `FLUYO-018.20.md`–`018.22.md` (aplazamiento del panel). En código: `index.html` (`aside#propPanel` completo), `js/ui.js` (`refreshPanel`, `syncSelMeta`, rejillas de color, `applyGroupDefaults`, `syncPanelGroups`, `syncSwatchMore`, `syncFlowSeg`, handlers de todos los controles, `placeChrome`, `setUiMode`, `openSurface`/`toggleSurface`, `visibleCanvasRect`), `css/styles.css` (panel, tableta, puntero grueso, hoja móvil, apaisado), `css/system.css` (tokens claro/oscuro, botones, campos, interruptores, `.seg`, `.pgroup`), `js/model.js` (`NODE_UPDATE_KEYS`, `CONNECTION_UPDATE_KEYS`, `EDITABLE_SHAPES`, `FROZEN_SHAPES`), `js/selection.js` (capas).
> **Auditoría y diseño:** no modificaron nada salvo este documento. **Implementación:** ver el final. Sin tocar MCP, kernel ni `model.js`.

---

## 0. Resumen

El panel de escritorio no es pesado por su anchura (288 px, el 20 % de 1440), sino por **cómo se organiza lo que contiene**:

- Es un **formulario de filas** etiqueta-izquierda / control-derecha para todo, con **tres a seis bloques de color por elemento**, cada uno de ≈ 100–150 px (dos filas de muestras de 18 px, un pozo «Personalizado» de 32 px y un «Más colores» que a menudo cae solo en otra línea). En un nodo, el color es el 60 % de la altura del panel; en un `code`, el 75 % con todo abierto.
- El orden no sigue la frecuencia: **«Texto» (tamaño, tipografía, negrita, color, posición) va antes que la forma y el color**; en 1280 × 720 el relleno y el borde de un nodo, y las puntas, los puntos y el sentido de una conexión, quedan **bajo el pliegue**.
- El panel mezcla tres capas: **la selección**, **el documento** («Animación del lienzo», que en móvil ya vive en «Más») y **la ayuda** («Atajos y gestos», ídem).
- Un `code` reparte sus seis colores en **tres grupos** con etiquetas que cambian de significado según la forma («Relleno» = «Fondo del panel», «Fondo del texto» = «Fondo del bloque», «Fondo/Texto del resaltado» en otro grupo plegado).
- Y hay **defectos reales** que la auditoría ha medido: el segmentado del **sentido de los puntos (`flowDir`) se pisa a sí mismo** (las tres etiquetas se superponen, claro y oscuro, en 288 px) y **no se puede manejar con teclado**; los pozos «Personalizado» enseñan un color **rancio** (el del elemento anterior) o negro cuando la propiedad es automática; las muestras de 18 px no llegan a los 24 px de WCAG 2.5.8.

Propuesta: **un panel que solo habla de la selección**, con una **cabecera de selección** (qué es, cómo se llama y sus acciones), **la apariencia primero**, **un control de color de una fila** (la paleta con nombre + «Más» que despliega la rejilla, el personalizado y el cuentagotas, igual que ya hace la hoja móvil), **segmentados** donde hay 2–7 opciones (con el control nativo debajo como fuente de verdad, decisión 36), la **Dirección de una conexión como grupo propio abierto**, los **colores de un `code` juntos en su grupo**, y la animación del documento y la ayuda **fuera del panel también en escritorio** (como en móvil). Mismo DOM, mismos ids de campo, misma semántica, misma jerarquía en columna y en hoja.

Resultado esperado a 1280 × 720 (el caso que hoy peor sale): nodo **1,49 → ≤ 1,0 pantallas**, conexión **1,50 → ≤ 1,0**, `code` **1,67 → ≤ 1,0** (grupo «Código» plegado), bloque de color **≈ 110–150 → ≤ 56 px**, `flowDir` **fuera → dentro de la primera pantalla** en los cuatro viewports, 0 controles < 28 px con ratón y muestras ≥ 24 px. Sin perder ni una capacidad.

---

## 1. Estado de partida (verificado)

- `git log`: `1a9ca92 feat: support story arrival dependencies` (018.22). `git status` limpio. `sw.js` → `fluyo-static-v80`.
- Lo que **ya funciona y no se toca**: Historias como modo (131) — en modo Historia el panel de Propiedades **no se pinta** (`#panelProperties` `display:none`; la columna es la de Historias); reproduciendo, igual; en Present el `aside` no existe (`display:none`). La hoja móvil de 40dvh, ⚙ contextual, M1–M3 (149). El apaisado con hoja lateral (162). Undo/Redo de cada control. 0 errores de consola en todos los recorridos.
- 018.17 (D8) y 018.18 (C9, D15) dejaron este panel aplazado; 018.20 lo desplazó (D8) y 018.21/018.22 no lo tocaron.

## 2. Método

Chrome real (`channel: "chrome"`, headless) con `playwright-core` **fuera del repo** (scratchpad de la sesión), árbol servido tal cual por un servidor HTTP efímero de solo lectura, Service Worker y red externa bloqueados. Fixture `test/fixtures/fluyo-017-1-qa-complejo.fluyo.json` + un `code` y una BD añadidos **en memoria** (no se escribe el fixture). Ratón en 1440 × 900, 1280 × 720 y 1024 × 768; dedo en 768 × 1024 (solo regresión). Duración de la pasada completa de medida: **42 s**.

Estados: A sin selección · B nodo · C `code` · D BD · E conexión (puntos quietos y en movimiento) · M selección múltiple · F Historia abierta, reproduciendo y Present · G interfaz oscura (nodo, conexión, `code`, vacío) · H lienzo crema y claro con interfaz clara. Cada estado con los grupos por defecto y, en nodo, `code` y conexión, también con todo abierto.

Medidas: ancho y alto del `aside`, % de lienzo visible (`elementFromPoint` cada 8 px) con y sin panel, alto y posición de cada grupo, controles visibles (botones, selects, campos, `summary`; muestras aparte), controles < 28/30/40/44 px, pantallas de scroll, grupos y filas fuera de la primera pantalla, elementos con borde pintado («cajas»), etiquetas visibles, posición de las filas frecuentes, contraste WCAG de textos y bordes del panel en ambos temas, colores del estado activo de los segmentados, desbordamiento de texto en los segmentados, teclado en el segmentado de sentido.

Capturas comparables (scratchpad de la sesión, `shots/`): `<viewport>-<estado>.png` para `d1440`, `d1280`, `d1024`, `t768` × `A-nosel`, `B-node`, `B-node-allopen`, `C-code`, `C-code-allopen`, `D-db`, `E-edge-static`, `E-edge-anim`, `E-edge-allopen`, `M-multi`, `F-story`, `F-playing`, `F-present`, `G-dark-node`, `G-dark-edge`, `G-dark-code`, `G-dark-nosel`, `H-cream-node`, `H-light-node`; más `zoom-dir-light.png` / `zoom-dir-dark.png` (bloque Dirección a 2×).

---

## 3. Auditoría

### 3.1 Anatomía real del panel (HTML + `ui.js`)

```
aside#propPanel (288 px > 1024; 216 px 701–1024; hoja ≤ 700 / apaisado táctil)
├── #propSheetHead            «Propiedades» + ✕ (solo hoja)
└── #panelProperties
    ├── section.selSection
    │   ├── h3 «Selección» + #selMeta («Caja · id 1» / «Conexión · 1 → 2» / «2 elementos»)
    │   ├── #noSel            «Nada seleccionado.» + texto + ▸ Atajos y gestos (#grpHelp, 13 líneas)
    │   ├── #multiSel         «2 nodos seleccionados» + Copiar · Cortar · Duplicar · Eliminar
    │   └── #selBody
    │       ├── #rowLabel     Texto (Enter = nueva línea) — textarea de 2 líneas
    │       ├── ▾ Texto       Tamaño · Tipografía · Negrita · Color del texto* · Posición del texto · Fondo del texto*
    │       ├── ▾ Forma y color  Forma · Color de línea / borde* (+ Cuentagotas) · Teñir icono · Relleno* · Estilo de borde
    │       ├── ▸ Código      Palabras clave · Lista propia · Fondo del resaltado* · Texto del resaltado*
    │       ├── ▾ Recorrido   Ruta · Sale por · Entra por · Volver a la ruta automática
    │       ├── ▾ Trazo       Color de línea* · Línea punteada · DIRECCIÓN: Punta al inicio · Punta al final · Puntos en movimiento · Sentido (segmentado sobre #flowSel)
    │       ├── ▸ Puntos      Color de puntos* · Velocidad · Puntos globales · Puntos (esta flecha)
    │       ├── ▸ Capas y aparición  Al frente · Al fondo · Subir · Bajar · Pulso · Orden de aparición
    │       └── Eliminar Supr
    └── section.animSection
        └── ▸ Animación del lienzo (#grpAnim)  Pausa/Play · Velocidad · Puntos por flecha · Una pelota por ruta · Animar aparición · Intervalo + 2 párrafos
(* = bloque de color: rejilla de muestras + «Personalizado» + «Más colores»)
```

`refreshPanel` decide qué FILAS se ven según el tipo (`nodeRows`/`edgeRows`) y la forma; `syncPanelGroups` oculta el grupo sin filas; `applyGroupDefaults` abre Texto, Forma y color, Recorrido y Trazo en columna y ninguno en hoja (acordeón). Una sola implementación para columna, hoja inferior y hoja lateral: **bien**, y debe seguir así.

Filas por selección (con grupos por defecto):

| Selección | Grupos visibles | Filas | Bloques de color | Controles (sin muestras) | Muestras pintadas |
|---|---|---|---|---|---|
| Caja / BD / rombo / círculo / hex | Texto ▾ · Forma y color ▾ · Capas ▸ · Animación ▸ | 19 | 3 (texto, borde, relleno) | 31 | 66 (1440) |
| `code` | Texto ▾ · Forma y color ▾ · Código ▸ · Capas ▸ · Animación ▸ | 22 | **6** | 38 | 132 (343 con todo abierto) |
| `text` | Texto ▾ · Forma y color ▾ · Capas ▸ · Animación ▸ | — | 3 (texto, «línea / borde» que en un texto es su color, fondo) | — | — |
| icono / GIF / imagen | sin «Forma»; icono con «Teñir»; imagen sin color | — | 1–2 | — | — |
| Conexión | Texto ▾ · Recorrido ▾ · Trazo ▾ · Puntos ▸ · Animación ▸ | 22–23 | 2 | 27–30 | 30 |
| Varios | Animación ▸ | — | — | 11 | 0 |
| Nada | Atajos ▸ · Animación ▸ | — | — | 8 | 0 |

### 3.2 Medidas en Chrome (grupos por defecto)

Ancho del panel y % de lienzo (con panel → sin panel, misma ventana):

| Viewport | Panel | Lienzo con panel | Lienzo sin panel | Coste del panel |
|---|---|---|---|---|
| 1440 × 900 | 288 | 67 % (1088 px) | 84 % (1376 px) | 17 pt |
| 1280 × 720 | 288 | 61 % (928 px) | 80 % (1216 px) | 19 pt |
| 1024 × 768 | 216 | 62 % (744 px) | 80 % (960 px) | 18 pt |
| 768 × 1024 (dedo) | 216 | 57 % (488 px) | 82 % (704 px) | 25 pt |

Pantallas de scroll · controles < 28 / < 40 / < 44 (sin muestras) · grupos fuera de la primera pantalla:

| Estado | 1440 × 900 | 1280 × 720 | 1024 × 768 | 768 × 1024 (dedo) |
|---|---|---|---|---|
| A sin selección | 1,0 · 2/8/8 | 1,0 | 1,0 | 1,0 · 2/2/5 |
| B nodo | **1,16** · 4/30/30 · Animación | **1,49** · Capas, Animación | **1,54** | **1,43** · 4/4/10 |
| B nodo, todo abierto | 1,71 | 2,20 | 2,36 | 2,11 |
| C `code` | **1,30** · Código, Capas, Animación | **1,67** | **1,76** | **1,64** · 4/4/13 |
| C `code`, todo abierto | 2,51 | 3,23 | **3,63** | 3,23 |
| D BD | 1,16 | 1,49 | 1,54 | 1,43 |
| E conexión, puntos quietos | 1,08 | 1,40 · Puntos, Animación | 1,30 | 1,24 |
| E conexión, puntos en movimiento | 1,16 | **1,50** | 1,39 | 1,32 |
| M varios | 1,0 | 1,0 | 1,0 | 1,0 |
| F Historia / reproduciendo / Present | Propiedades no se pinta (columna de Historias 320/300; Present sin `aside`) | ídem | ídem | ídem |

Alto de cada grupo (1440, abierto por defecto): Texto 304 px (5 filas, 29 controles contando muestras), **Forma y color 382 px** (4 filas, 52), Trazo 316–379, Recorrido 157. Con todo abierto: Texto 392–554, Forma y color 558, **Código 484** (1440) y **625** (1024).

Densidad (nodo, 1440): **26 elementos con borde pintado**, **29 etiquetas**, 82 controles en la primera pantalla (16 + 66 muestras). Conexión: 29 cajas, 33 etiquetas.

Tamaños con ratón: `--ctl-h` 30 px; **muestras 18 × 18** (no pasan WCAG 2.5.8, 24 × 24, ni por la excepción de espaciado: 18 + 4 = 22); interruptores 30 × 18; botón «Más colores» 28; 4 controles < 28 en un nodo, 8 en una conexión (interruptores). Con dedo (768): muestras 26, controles a 40/44 salvo 10–13 que quedan entre 40 y 44 (filas; aceptable por la decisión 150).

### 3.3 Dónde está lo frecuente (posición de la fila en el panel, px desde arriba; ↓ = bajo el pliegue)

| Propiedad | 1440 (806 visibles) | 1280 (626) | 1024 (674) | 768 dedo (928) |
|---|---|---|---|---|
| Nodo · Forma | 451 | 451 | 487 | 612 |
| Nodo · Color de borde | 487 | 487 ↓ (parcial) | 523 ↓ | 662 |
| Nodo · Relleno | 637 | **637 ↓** | **709 ↓** | **908 ↓** |
| Nodo · Estilo de borde | 748 | 748 ↓ | 856 ↓ | 1101 ↓ |
| Nodo · Capas / Pulso / Orden | plegado | plegado ↓ | plegado ↓ | plegado ↓ |
| Nodo · Eliminar | 849 ↓ | 849 ↓ | 958 ↓ | 1224 ↓ |
| `code` · Palabras clave | plegado 908 ↓ | ↓ | ↓ | ↓ |
| Conexión · Color | 460 | 460 | 460 | 575 |
| Conexión · Punta al final | 658 | **658 ↓** | 658 ↓ | 880 |
| Conexión · Puntos en movimiento | 692 | **692 ↓** | 692 ↓ | 926 ↓ |
| Conexión · **Sentido (`flowDir`)** | 726 (solo con puntos) | **726 ↓** | **726 ↓** | **972 ↓** |
| Conexión · Eliminar | 855 ↓ | ↓ | ↓ | ↓ |

Acciones desde «elemento seleccionado» hasta el cambio hecho (clic = 1, desplazar = 1, abrir grupo = 1, «Más colores» = 1):

| Tarea | 1440 | 1280 | 1024 |
|---|---|---|---|
| Relleno de un nodo con un color de la paleta con nombre | 1 | **2** | **2** |
| Relleno con un color de la rejilla amplia | 2 | 3 | 3 |
| Cambiar la forma | 2 (select) | 2 | 2 |
| Poner la punta al inicio | 1 | 2 | 2 |
| Cambiar el sentido de los puntos (puntos quietos) | 2 | **3** | **3** |
| Palabras clave de un `code` | 3 | 3 | 3 |
| Traer al frente | 3 | 3 | 3 |
| Eliminar (sin teclado) | 2 | 2 | 2 |

### 3.4 Defectos encontrados (medidos, no opiniones)

| # | Defecto | Evidencia | Causa |
|---|---|---|---|
| **P1** | **El segmentado «Sentido de los puntos» se superpone**: «Hacia el destino», «Hacia el origen» e «Ida y vuelta» se pisan en una sola línea, en claro y en oscuro, a 288 px | `zoom-dir-light.png`, `zoom-dir-dark.png` | `#panelProperties button{white-space:nowrap}` (system.css, especificidad 1-0-1) gana a `.flowSeg > .segBtn{white-space:normal}` (0-2-0) |
| **P2** | **`flowDir` no se puede cambiar con teclado**: el segmentado usa tabindex móvil (solo la opción marcada es alcanzable) pero no tiene manejador de flechas; `#flowSel` es `tabindex=-1 aria-hidden`. Foco en la opción marcada + →, →, Tab: `flowDir` sigue `normal` y el foco sale al grupo «Puntos» | script de teclado | `syncFlowSeg` pone `tabIndex`, nadie escucha `keydown` |
| **P3** | **Pozo «Personalizado» rancio**: seleccionar un nodo con relleno `#d0576a` y después uno con relleno automático deja el pozo en `#d0576a`; sin color propio enseña `#000000` (negro: invisible en la interfaz oscura) | medido (`fillCustom`) | `refreshPanel` solo escribe el pozo si el valor es hex; si no, conserva el anterior |
| P4 | «Más colores» cae solo en una línea (con «Cuentagotas» en 288 px; en 216 siempre) | `d1440-B-node.png`, `t768-E-edge-anim.png` | `.colorTools` con `flex-wrap` y el botón al final |
| P5 | El contenido de un `code` se edita en una textarea de **2 líneas** en fuente proporcional del chrome (el bloque son 3+ líneas mono) | `d1440-C-code.png` | la misma `#lblEdit` de una etiqueta |
| P6 | A 216 px los `select` se cortan («(Global», 104 px) y «Posición del texto» parte la etiqueta en dos líneas también a 288 | `t768-*`, `d1440-B-node.png` | anchos fijos de `select` y etiquetas a la izquierda |
| P7 | La etiqueta del color en un `text` dice «Color de línea / borde» (un texto no tiene borde: es su color) | código (`refreshPanel`) | etiqueta fija |
| P8 | El metadato de una conexión enseña ids de nodos («Conexión · 1 → 2»), no sus nombres ni su propio id | capturas E | `syncSelMeta` |
| P9 | `docs/index.html` llama «Picker» al cuentagotas (la UI dice «Cuentagotas») | `docs/index.html` l. 83 | deriva de documentación |

Fuera de alcance, solo registrado: `#kwEdit` y `#edgeDotsIn` escriben en el documento sin `pushUndo` (la edición queda dentro de la entrada de Undo anterior). No es del panel visual y no cambia con este diseño; no se toca aquí (ver § 12).

### 3.5 Tema oscuro y claro

Contraste medido sobre el fondo del panel (claro `#F2EDE3` / oscuro `#1A1913`):

| Elemento | Claro | Oscuro | Lectura |
|---|---|---|---|
| Etiqueta de fila (`--ink-2`) | 10,2 | 10,9 | bien |
| Rótulo de grupo (`summary`, `--ink-3`) | 5,2 | 6,7 | bien |
| Título serif | 15,7 | 14,3 | bien |
| Ayudas, «Más colores» | 5,2 | 6,7 | bien |
| **Borde de campo** (`--rule-2`) | **1,67** | **1,76** | bajo 3:1 (WCAG 1.4.11): el campo se reconoce por el texto y el cheurón, no por la caja |
| Fondo de campo frente al panel | 1,08 | 1,11 | casi nulo |
| Filete entre grupos | 1,28 | 1,29 | decorativo, correcto |
| **Opción activa de un segmentado** | fondo `#F9F6F0` + borde 24 % frente a transparente | fondo `#24221A` + borde 20 % frente a transparente | la diferencia es **el texto** (ink frente a ink-3) y una sombra: en oscuro el «levantado» casi no se ve (`zoom-dir-dark.png`) |
| Pozo «Personalizado» sin color | negro sobre papel | **negro sobre noche: desaparece** | P3 |
| Muestra seleccionada | anillo de tinta 1,5 px con aire de 2 px | anillo hueso | bien en ambos |
| Interruptor encendido | oliva | oliva pálido | bien |
| Foco | oliva 2 px | oliva pálido 2 px | bien |

El oscuro **no es «el mismo panel en negro»**: los tokens están redefinidos de forma coherente (decisión 134) y los textos tienen más contraste que en claro. Sus dos puntos débiles son compartidos con el claro y se agravan en oscuro: **el estado activo de los segmentados no usa el lenguaje de «activo» del sistema (oliva)** y **los pozos negros**. Los lienzos crema y claro (H) no cambian nada del panel: el chrome es independiente del tema del documento (124, 134), verificado.

### 3.6 Historias, reproducción y Present (verificado)

| Situación | Qué hace el panel hoy | Correcto |
|---|---|---|
| Editar | Propiedades de la selección | sí |
| Historia abierta (escritorio/tableta) | la columna es Historias; `#panelProperties` oculto aunque haya un nodo seleccionado | sí: no compite |
| Reproduciendo | ídem; `openSurface("properties")` se redirige a Historias | sí |
| Present | `aside` `display:none` | sí |
| Móvil, modo Historia | ⚙ oculto (decisión 149) | sí |

No hay ninguna propiedad que «solo tenga sentido editando» y se vea en Historia: el contrato ya existe; 018.23 solo lo **fija con un test** (nadie lo vigila hoy salvo indirectamente).

### 3.7 Lo que ya está bien y no se toca

`<details>` nativos sin estado espejo (136); una sola implementación para columna y hojas; ocultar el grupo sin filas; filas contextuales por forma; teclado en las rejillas de muestras (tabindex móvil + flechas); la fila entera como objetivo de su interruptor; la tipografía del sistema (serif para títulos, mono para mecanismo); Undo de una entrada por cambio; 0 errores de consola.

---

## 4. Inventario de capacidades (antes de proponer nada)

Ninguna desaparece, ninguna cambia de dato ni de semántica. «Dónde 018.23» es la propuesta de § 6.

| Capacidad | Dato | Dónde hoy | Dónde 018.23 | ¿Cambia? |
|---|---|---|---|---|
| Posición | `x`, `y` | lienzo (arrastre, flechas); MCP | igual (no hay campos X/Y: no se añaden) | no |
| Tamaño | `w`, `h` | lienzo (tiradores); MCP | igual | no |
| Forma | `shape` (7 editables; image/icon/anim congeladas) | select «Forma» | segmentado de 7 iconos del rail sobre `#shapeSel` | no |
| Contenido | `label` | textarea arriba | igual; en `code`, 5 líneas en mono | no |
| Icono | `icon` (al crear) | cajón del rail | igual (sin cambio posterior, como hoy) | no |
| GIF animado | `anim` (al crear) + color | cajón + «Color» | igual | no |
| Imagen | `img` (al crear) | soltar/pegar | igual | no |
| Teñir icono | `tint` | interruptor | igual, en Apariencia | no |
| Código | `lang`, `keywords` | select + textarea (Código ▸) | segmentado SQL · Ninguna · Lista propia sobre `#langSel` + textarea | no |
| Colores de nodo | `color`, `fill`, `textColor`, `textBg` | 3–4 bloques en 2 grupos | control de color de una fila (§ 6.5) | no |
| Colores de `code` | `fill` (panel), `textBg` (bloque), `textColor` (código), `kwColor`, `kwBg` | 3 grupos | panel en Apariencia; bloque, código, palabra clave y su caja en «Código» | no |
| Cuentagotas | → `color` | junto al borde | dentro de «⋯» del color de borde (como hoy, solo en el borde) | no |
| Tipografía | `font` | select | select (lista larga) | no |
| Tamaño | `fs` | número | número en la misma fila | no |
| Peso | `bold` | interruptor | botón «N» con `aria-pressed` sobre `#boldChk` | no |
| Posición del texto | `lblPos` | select | select | no |
| Borde | `border` | select | segmentado de 3 sobre `#borderSel` | no |
| Opacidad | — (no existe como dato; el relleno automático es semitransparente) | «Automático» en Relleno | igual | no |
| Pulso | `pulse` | Capas y aparición ▸ | Movimiento ▸ | no |
| Orden de aparición | `order` | Capas y aparición ▸ | Movimiento ▸ (con la nota de que lo usa «Animar aparición») | no |
| Capas | orden en `page.nodes[]` (`reorderSelection`) | 4 botones en Capas ▸ | menú «Orden» en la cabecera de selección | no |
| Eliminar | `deleteSel` | botón al final (bajo el pliegue) | icono en la cabecera de selección + Supr | no |
| Conexión: extremos | `source`, `target` | lienzo (asas) | igual | no |
| Ruta | `route` | select | segmentado Recta · Ortogonal sobre `#routeSel` | no |
| Lados | `fromSide`, `toSide` | dos select | dos select en una fila | no |
| Codos | `waypoints` | lienzo + R + «Volver a la ruta automática» | igual; el botón junto a «Ruta» | no |
| Puntas | `startArrow`, `endArrow` | dos interruptores | igual o segmentado de 4 (D6) | no |
| Puntos en movimiento | `animated` | interruptor | igual, en Dirección | no |
| **Sentido** | `flowDir` normal/reverse/alternate | segmentado (roto, P1–P2) dentro de Trazo | **grupo «Dirección» abierto**, segmentado reparado y con teclado | no |
| Línea | `dashed`, `lineColor` | interruptor + bloque de color | igual + color de una fila | no |
| Puntos | `dotColor`, `speedFac`, `dotsGlobal`, `dots` | Puntos ▸ | Puntos ▸ (velocidad como segmentado 1×–4×) | no |
| Animación del documento | `settings.speed/dots/single/build/stagger`, Pausa (Espacio) | panel ▸ en escritorio; «Más» en móvil | «Lienzo ▾» en escritorio; «Más» en móvil (sin cambio) | no |
| Selección múltiple | `selN`/`selE`; copiar, cortar, duplicar, eliminar | bloque «Varios» | igual, con la cabecera de selección | no |
| Historias | modo propio (131) | columna/hoja de Historias | igual | no |
| Undo/Redo | una entrada por cambio | — | una entrada por gesto (el segmentado de Puntas escribe ambos campos en una) | no |

Todos los ids de campo (`#lblEdit`, `#fsIn`, `#fontSel`, `#boldChk`, `#shapeSel`, `#borderSel`, `#lblPosSel`, `#tintChk`, `#langSel`, `#kwEdit`, `#routeSel`, `#fromSel`, `#toSel`, `#dashChk`, `#arrSChk`, `#arrEChk`, `#animChk`, `#flowSel`, `#flowSeg`, `#speedFacSel`, `#dotsGlobalChk`, `#edgeDotsIn`, `#pulseChk`, `#orderIn`, `#btnWps`, `#btnDel`, `#btnFront/Back/Forward/Backward`, `#btnEyedrop`, las ocho rejillas y sus `*Custom`, `#multiSel`, `#mCopy/mCut/mDup/mDel`, `#grpAnim`, `#grpHelp`, `#noSel`, `#selMeta`, `#rowX`) **se conservan**.

---

## 5. Criterio de diseño

1. **Reducir complejidad, no dimensiones.** El sitio sale de quitar cajas, filas duplicadas y capas ajenas; los controles no encogen (30 px ratón, 44/40 dedo; muestras suben de 18 a 24).
2. **El panel solo habla de la selección.** Lo del documento vive en «Lienzo ▾»; la ayuda, en «Más»; las acciones sobre el objeto (capas, eliminar), en su cabecera.
3. **Lo frecuente arriba y abierto; lo raro, nombrado y plegado.** Ningún grupo plegado esconde algo que se toque en cada elemento; ningún grupo abierto obliga a desplazar para llegar a lo frecuente a ≥ 1024 × 768.
4. **Un control por cantidad de opciones**: interruptor (2 estados), segmentado (2–7 opciones visibles), `select` solo para listas (tipografía, lados, posición del texto), color de una fila con «Más».
5. **Mismo concepto en columna, hoja y hoja lateral**: misma cabecera, mismos grupos, mismo orden, mismos ids; cambian el contenedor, los tamaños de objetivo y qué grupos empiezan abiertos.
6. **Sin semántica nueva.** Cada control nuevo es una vista de un control nativo existente (patrón de la decisión 36 y del `#flowSel` de 161) o escribe exactamente los mismos campos con una entrada de Undo.
7. **Calm Instrumentation**: serif para el nombre de lo seleccionado, mono para mecanismo y valores, oliva = activo en ambos temas, iconos del sprite (los del rail para las formas), sin emojis, sin cajas dentro de cajas, sin marcas ni logos añadidos.

---

## 6. Propuesta

### 6.1 Estructura final

Leyenda: ▾ abierto por defecto en columna · ▸ plegado · [ ] control · {…} solo si aplica.

**Nodo (caja, BD, rombo, círculo, hexágono)**

```
Panel
├── Cabecera de selección            «Cliente»  (serif)        [Orden ▾] [🗑]
│                                    CAJA · ID 1  (mono)
├── Contenido                        [ textarea 2–3 líneas                     ]
├── ▾ Apariencia
│   ├── Forma                        [▭][⛁][◇][○][⬡][T][<>]   (iconos del rail, sobre #shapeSel)
│   ├── Borde                        ■ ■ ■ ■ ■ ■ ■ ■ ■  [⋯]    (Piedra + paleta con nombre; ⋯ = rejilla, propio, cuentagotas)
│   ├── Relleno                      ▨ ▦ ■ ■ ■ ■ ■ ■ ■  [⋯]    (Automático, Sin relleno + paleta)
│   └── Línea del borde              [ — | - - | ··· ]
├── ▾ Texto
│   ├── Tipografía                   [ (Global)        ▾] [ 14 ] [ N ]
│   ├── Color                        ▨ ■ ■ ■ ■ ■ ■ ■ ■  [⋯]
│   └── Posición                     [ Centro ▾ ]
└── ▸ Movimiento                     Pulso [◯] · Orden de aparición [ 0 ]
```

BD: idéntico (la geometría de 018.14a es del render; sus propiedades son las de una caja: verificado en `D-db`).
`text`: Apariencia = Forma + **Color** (la etiqueta deja de decir «línea / borde», P7); Texto = Tipografía + Color del texto + Fondo + Posición.
Icono: Apariencia = Color + Teñir. GIF: Color. Imagen: sin Apariencia de color (como hoy). Sin «Forma» en las tres (congeladas, `FROZEN_SHAPES`).

**`code`**

```
Panel
├── Cabecera de selección            «SELECT id, total»         [Orden ▾] [🗑]
│                                    CÓDIGO · ID 9
├── Código                           [ textarea mono, 5 líneas, redimensionable   ]
├── ▾ Apariencia
│   ├── Forma                        [▭][⛁][◇][○][⬡][T][<>]
│   ├── Borde                        ■ ■ ■ … [⋯]
│   ├── Panel                        ▨ ■ ■ … [⋯]               (= fill)
│   └── Línea del borde              [ — | - - | ··· ]
├── ▾ Texto
│   └── Tipografía                   [ IBM Plex Mono ▾] [ 14 ] [ N ]
└── ▸ Código
    ├── Resaltado                    [ SQL | Ninguna | Lista propia ]   (sobre #langSel)
    ├── {Lista propia}               [ textarea ]
    ├── Texto del código             ▨ ■ ■ … [⋯]               (= textColor)
    ├── Fondo del bloque             ▨ ■ ■ … [⋯]               (= textBg)
    ├── Palabra clave                ▨ ■ ■ … [⋯]               (= kwColor; ▨ = del tema)
    └── Caja de la palabra clave     ▨ ■ ■ … [⋯]               (= kwBg; ▨ «Sin caja» = valor por defecto de 018.14a)
```

Los seis colores del `code` dejan de estar repartidos en tres grupos con nombres que cambian: el panel del nodo es Apariencia; todo lo que es del **bloque** está en «Código». La caja de la palabra clave **no se reintroduce**: sigue sin caja por defecto (`codeKwBg:""`), la fila solo permite ponerla explícitamente, como hoy.

**Conexión**

```
Panel
├── Cabecera de selección            «pago»  (o «Cliente → Kafka» si no tiene texto)   [🗑]
│                                    CONEXIÓN · ID 5 · CLIENTE → KAFKA
├── Texto                            [ textarea 1–2 líneas ]
├── ▾ Trazo
│   ├── Color                        ▨ ■ ■ ■ ■ ■ ■ ■ ■  [⋯]
│   ├── Línea                        [ Continua | Punteada ]           (sobre #dashChk)
│   ├── Ruta                         [ Recta | Ortogonal ]  {Volver a la ruta automática}
│   └── Sale por · Entra por         [ Auto ▾ ] [ Auto ▾ ]
├── ▾ Dirección
│   ├── Puntas                       [ — | → | ← | ↔ ]   o dos interruptores (D6)
│   ├── Puntos en movimiento         [◯]
│   └── {Sentido de los puntos}      [ Hacia el destino | Hacia el origen | Ida y vuelta ]  (sobre #flowSel, con teclado)
├── ▸ Puntos                         Color ▨ ■ … [⋯] · Velocidad [1×|2×|3×|4×] · Globales [◯] · {Cantidad [3]}
└── ▸ Texto                          Tipografía [ (Global) ▾] [ 12 ] [ N ]
```

`flowDir`: **grupo propio, abierto, en la primera pantalla en todos los viewports**, con su nombre real (161) y su condición visible: «Sentido de los puntos» aparece justo debajo del interruptor que lo activa; con los puntos quietos, la fila del interruptor lleva la ayuda «El sentido se elige al ponerlos en movimiento» (un renglón mono, `--ink-3`). Con el teclado: flechas dentro del segmentado (P2).

**Selección múltiple**

```
├── Cabecera de selección            «3 elementos»   (2 nodos y 1 conexión)    [🗑]
└── [Copiar] [Cortar] [Duplicar]
```

**Nada seleccionado** (escritorio; móvil no tiene hoja, 149)

```
├── Nada seleccionado.  (serif)
└── Elige una forma del rail y toca el lienzo, o selecciona un elemento.   (mono, una línea)
    Atajos y gestos → «Más › Ayuda y gestos»
```

y, si se aprueba D2, la columna se puede plegar (§ 6.8).

### 6.2 Abierto / plegado por defecto

| Grupo | Columna (> 700) | Hoja móvil y lateral | Por qué |
|---|---|---|---|
| Cabecera + Contenido | siempre | siempre | es lo que se edita primero (136) |
| Apariencia (nodo) | ▾ | ▸ (acordeón) | lo que se toca en cada elemento |
| Texto (nodo) | ▾ | ▸ | frecuente en textos; en cajas, tipografía y color |
| Código | ▸ | ▸ | se ajusta una vez por bloque (136); su rótulo queda en la primera pantalla |
| Movimiento | ▸ | ▸ | raro; solo tiene efecto con «Animar aparición» o en vivo |
| Trazo (conexión) | ▾ | ▸ | frecuente |
| Dirección (conexión) | ▾ | ▸ | la dirección es la propiedad que da sentido a una conexión |
| Puntos | ▸ | ▸ | ajuste fino (161) |
| Texto (conexión) | ▸ | ▸ | raro en conexiones |

Profundidad máxima: **2** (grupo › «Más» de un color). Hoy también 2 (grupo › «Más colores»), pero con 3–6 «Más» por elemento; después, con la paleta con nombre a la vista, «Más» solo hace falta para la rejilla amplia y el personalizado.

### 6.3 Qué desaparece del panel (sin desaparecer del producto)

| Elemento | Destino | Razón |
|---|---|---|
| «Animación del lienzo» (`#grpAnim`, Pausa/Play incluido) | escritorio: popover «Lienzo ▾» (`#canvasMenu`), junto a tema, fondo, tipografía global y cuadrícula; móvil: «Más» (sin cambio, M1) | es del documento, no de la selección; ya es así en móvil (decisión 135 lo pedía: «todo lo del documento en un sitio»). Espacio sigue alternando la pausa |
| «Atajos y gestos» (`#grpHelp`) | «Más › Ayuda y gestos» también en escritorio (como móvil, M2) | referencia, no propiedad |
| Título «Selección» + insignia | sustituidos por la cabecera de selección (nombre + metadato) | el título genérico no informa; el nombre sí |
| Botón «Eliminar» al final | icono en la cabecera (Supr sigue) | hoy está bajo el pliegue en todos los casos |
| Grupo «Capas y aparición» | capas → menú «Orden» de la cabecera; pulso y orden de aparición → «Movimiento» | mezclaba una acción (reordenar) con dos propiedades de animación |
| Grupo «Recorrido» | sus filas pasan a «Trazo» (una fila para los lados) | la ruta es parte de cómo se dibuja la línea; un grupo menos |
| Pozo «Personalizado» siempre visible, «Más colores» suelto | dentro de «Más» de cada color | 32–60 px por bloque que casi nunca se usan |
| Rótulo «Texto (Enter = nueva línea)» | «Contenido»/«Texto»/«Código» + placeholder | la instrucción es comportamiento estándar de una textarea |

### 6.4 Qué se vuelve contextual

Ya contextual (se conserva): filas por tipo y forma, «Teñir» solo en icono, «Fondo del texto» solo en `text`/`code`, cantidad propia de puntos solo sin «globales», «Volver a la ruta automática» solo con codos, Sentido solo con puntos en movimiento. Nuevo: la etiqueta del color según la forma (Borde / Color / Panel), el título de la cabecera según la selección, la ayuda de la fila «Puntos en movimiento» cuando están quietos, la nota de «Orden de aparición» cuando `settings.build` está apagado («Se usa con «Animar aparición», en Lienzo»).

**No** se ocultan controles por estar en su valor por defecto: esconder «Relleno» porque es automático haría desaparecer la capacidad justo cuando hace falta descubrirla. Lo que se reduce es su altura.

### 6.5 Controles que se simplifican

| Hoy | Propuesta | Mismo dato | Ahorro (columna) |
|---|---|---|---|
| Bloque de color: 2 filas de muestras 18 px + pozo 32 + «Más colores» (≈ 110–150 px) | **Color de una fila**: rótulo + una fila de muestras de 24 px (las especiales del campo + la paleta con nombre que quepa: 9 a 288, 7 a 216) + «⋯» de 24 px. «⋯» despliega **en el sitio** (no popover) la rejilla amplia, «Personalizado» y, en el borde, «Cuentagotas». Si el valor actual no está en la fila, su muestra va primero con el anillo de seleccionada | sí, mismas rejillas y mismos ids | ≈ 60–90 px por bloque |
| `select` Forma | segmentado de 7 iconos del rail (`aria-label` = nombre) sobre `#shapeSel` | sí | — (claridad) |
| `select` Estilo de borde | segmentado de 3 sobre `#borderSel` | sí | — |
| `select` Ruta | segmentado de 2 sobre `#routeSel` | sí | — |
| `select` Palabras clave | segmentado de 3 sobre `#langSel` | sí | — |
| `select` Velocidad | segmentado 1×–4× sobre `#speedFacSel` | sí | — |
| Tamaño + Tipografía + Negrita (3 filas) | **una fila**: tipografía (flexible) · tamaño (56 px) · «N» (`aria-pressed`, sobre `#boldChk`) | sí | ≈ 70 px |
| Sale por / Entra por (2 filas) | una fila con dos `select` rotulados encima | sí | ≈ 36 px |
| Punta al inicio / al final (2 interruptores) | D6: segmentado «— · → · ← · ↔» (una escritura de ambos campos, un Undo) o dejar los interruptores | sí | ≈ 34 px |
| Línea punteada (interruptor) | segmentado «Continua · Punteada» (paralelo al borde de los nodos) | sí | — |
| Pozo «Personalizado» | muestra el valor real o el tramado de «automático»; nunca rancio ni negro (P3) | sí | — |

Los segmentados nuevos siguen el patrón ya decidido: **el control nativo sigue siendo la fuente de verdad** (oculto como `#flowSel`, `srOnly`, `tabindex=-1`), el segmentado lo refleja y llama a su `onchange`. Los handlers, el Undo y los tests que usan `selectOption`/`check` no cambian. Un componente único (`segFor(select)`) con `role="radiogroup"`, tabindex móvil **y flechas** (corrige P2 de paso), `white-space:normal` con especificidad suficiente (corrige P1) y etiquetas que caben (si no caben en una línea, dos; nunca superpuestas).

### 6.6 Cabecera de selección

Un solo componente para columna, hoja inferior y hoja lateral (reutiliza `#propSheetHead`, que hoy solo existe en la hoja):

- **Título** (Playfair 16 px, una línea con elipsis): la primera línea del texto del elemento; si no tiene texto, el tipo («Caja sin texto») o, en una conexión, «Origen → Destino» con los nombres.
- **Metadato** (Plex Mono 10–11 px, versalitas, `--ink-3`): tipo e id para el documento y el MCP (`syncSelMeta`, 018.13), en una conexión también sus extremos por nombre (P8).
- **Acciones**: «Orden» (menú: Al frente · Subir · Bajar · Al fondo, mismos `#btnFront…`, solo nodo y como hoy no en múltiple) y Eliminar (icono papelera, `title="Eliminar (Supr)"`, `danger` al pasar). En la hoja, además ✕ (`#btnPanelClose`).
- Pegajosa arriba (como la cabecera de la hoja hoy) para que el nombre y las acciones nunca se vayan con el scroll.

### 6.7 Oscuro y claro

Mismo panel, mismos tokens; dos ajustes de sistema y uno de componente:

1. **Activo = oliva en los segmentados** (ambos temas): la opción marcada usa `--active-veil` de fondo, `--active-rule` de borde y `--ink` de texto, el mismo lenguaje que `button.toggled` y los interruptores. Hoy usa «papel levantado», que en oscuro casi no se distingue. Criterio medible: la opción activa difiere de la inactiva en ≥ 3:1 de contraste en al menos un atributo (borde o fondo frente al panel, o texto).
2. **Pozos y muestras especiales** con el tramado del sistema (`--sw-a`/`--sw-b`) cuando la propiedad es automática; nunca negro por defecto (P3).
3. **Bordes de campo**: no se suben los tokens globales (cambiaría todo el chrome y añadiría peso visual). La mejora viene de **tener menos campos con caja** (de 26 a ≤ 14 en un nodo) y de que los que quedan (textarea, tipografía, tamaño, lados, posición) se identifican por su texto, su cheurón y su foco oliva. Se deja registrado como riesgo de accesibilidad conocido (WCAG 1.4.11) para una revisión global del sistema, no de este panel (§ 11).

Se comprueban en ambos temas: contraste de etiqueta, rótulo, metadato y ayuda ≥ 4,5:1; estado activo; foco visible; anillo de la muestra seleccionada; la cabecera serif sobre papel y sobre noche.

### 6.8 Columna sin selección (D2)

Medido: sin selección la columna ocupa 288 px (17–25 pt de lienzo) para una frase y dos grupos plegados que, con § 6.3, se van. Tres opciones:

| | Qué es | A favor | En contra |
|---|---|---|---|
| **A (recomendada)** | Columna **estable** en Editar con el estado vacío mínimo, y **plegable por el usuario**: un botón en la cabecera del panel la pliega; ⚙ (`#btnPanel`, hoy solo móvil) aparece en la cabecera de escritorio para volver a abrirla. Preferencia del navegador `localStorage["fluyo.ui.props"]`, como la interfaz oscura (134): nunca entra en el documento | el lienzo no cambia de tamaño al seleccionar/deseleccionar; nada se desplaza bajo el cursor; quien quiere lienzo lo tiene (84/80/80 %) | plegada, seleccionar no abre nada (es lo que el usuario pidió) |
| B | Columna **contextual**: se retira sola sin selección y vuelve al seleccionar (la regla M2 del móvil) | misma regla que móvil y apaisado | cada clic en el vacío y en un nodo ensancha y estrecha el lienzo; con un diagrama encajado, un nodo de la franja derecha (21 % del ancho a 1440) queda bajo la columna al seleccionarlo y hay que desplazar la vista justo después del clic |
| C | Columna **superpuesta** al lienzo (la hoja lateral de 162 también en escritorio) | sin cambio de tamaño del lienzo | tapa el diagrama mientras se edita; revelar la selección mueve la vista |

### 6.9 Escritorio, tableta, móvil: qué se comparte

```
                   escritorio (>1024)     tableta / portátil (701–1024)   móvil vertical (≤700)     teléfono apaisado (162)
contenedor         columna 288            columna 216                     hoja inferior 40dvh       hoja lateral min(320, 44vw)
cabecera selección sí                     sí                              sí + ✕                    sí + ✕
grupos y orden     ←──────────────────────── idénticos (mismo DOM, mismos ids) ────────────────────────→
abiertos           primarios (§ 6.2)      primarios                       ninguno (acordeón)        ninguno (acordeón)
objetivo           30 px, muestras 24     30 / 44-40 según puntero        44 / 40, muestras ≥ 32    44 / 40
color de una fila  9 muestras + ⋯         7 + ⋯                           1 fila + ⋯ (hoy ya)       1 fila + ⋯
filas estrechas    etiqueta a la izquierda; con contenedor < 240 px (container query) el control pasa debajo
animación / ayuda  «Lienzo ▾» / «Más»     «Más» (≤1100) / «Más»           «Más» / «Más» (hoy)       «Más» / «Más»
plegado (D2)       sí                     sí                              no aplica (⚙ contextual)  no aplica
```

Reglas de implementación para no duplicar: (1) un solo `#panelProperties`; (2) `applyGroupDefaults` sigue siendo la única que decide qué se abre, con la lista de primarios por tipo; (3) los tamaños salen de tokens (`--ctl-h`, `--ctl-h-touch`, `--row-h-touch`, nuevo `--sw-size` 24/32) y de `@container` sobre el `aside` (ya es `container-type` en Historias), no de copias de reglas; (4) `placeChrome` sigue moviendo **los mismos nodos** (`#grpAnim` a `#canvasMenu` en escritorio, a `#animSection` en móvil; `#grpHelp` a `#helpSection` en todos); (5) la hoja móvil conserva su altura (`clamp(220px, 40dvh, 360px)`), su acordeón y M1–M3: el móvil solo hereda la cabecera de selección, el color de una fila con muestras ≥ 32 (hoy 26) y los segmentados.

### 6.10 Historias

Sin cambios de comportamiento; se fija como contrato con test: en modo Historia, reproduciendo, en pausa, terminada y en Present, `#panelProperties` no se pinta, ninguna fila de Propiedades es alcanzable con Tab y ⚙ no está (móvil) o no abre Propiedades (escritorio: `openSurface("properties")` reproduciendo ya redirige a Historias, 117/146). La preferencia de plegado (D2) no afecta a la columna de Historias.

---

## 7. Métricas de éxito (antes → objetivo)

Medidas con el método de § 2, grupos por defecto, interfaz clara y oscura.

| Métrica | 1440 × 900 | 1280 × 720 | 1024 × 768 | 768 × 1024 (dedo) |
|---|---|---|---|---|
| Ancho del panel | 288 → 288 | 288 → 288 | 216 → 216 | 216 → 216 |
| Lienzo con panel | 67 → ≥ 67 % | 61 → ≥ 61 % | 62 → ≥ 62 % | 57 → ≥ 57 % |
| Lienzo con el panel plegado (D2) | — → ≥ 83 % | — → ≥ 79 % | — → ≥ 79 % | — → ≥ 80 % |
| Pantallas · nodo / BD | 1,16 → **≤ 1,0** | 1,49 → **≤ 1,0** | 1,54 → **≤ 1,0** | 1,43 → **≤ 1,0** |
| Pantallas · `code` (Código ▸) | 1,30 → ≤ 1,0 | 1,67 → **≤ 1,0** | 1,76 → ≤ 1,05 | 1,64 → ≤ 1,0 |
| Pantallas · `code` todo abierto | 2,51 → ≤ 1,3 | 3,23 → ≤ 1,7 | 3,63 → ≤ 1,8 | 3,23 → ≤ 1,5 |
| Pantallas · conexión (puntos en movimiento) | 1,16 → **≤ 1,0** | 1,50 → **≤ 1,0** | 1,39 → ≤ 1,0 | 1,32 → ≤ 1,0 |
| `flowDir` en la primera pantalla (con puntos) | sí → sí | **no → sí** | **no → sí** | **no → sí** |
| Etiquetas del segmentado de sentido superpuestas | **sí → no** | sí → no | sí → no | sí → no |
| `flowDir` alcanzable con teclado | **no → sí** | | | |
| Grupos fuera de la primera pantalla · nodo | 1 → 0 | 2 → 0 | 2 → 0 | 2 → 0 |
| Alto de un bloque de color | 110–150 → ≤ 56 px | | | ≤ 64 px |
| Muestras visibles por defecto · nodo | 66 → ≤ 30 | 66 → ≤ 30 | 48 → ≤ 24 | 36 → ≤ 24 |
| Cajas con borde · nodo / conexión | 26 / 29 → ≤ 14 / ≤ 14 | | | |
| Etiquetas visibles · nodo | 29 → ≤ 16 | | | |
| Controles < 28 px (ratón, sin muestras) | 4–8 → 0 | 4–8 → 0 | 4–8 → 0 | — |
| Muestras | 18 → **24** px | 18 → 24 | 18 → 24 | 26 → **32** |
| Controles < 44 que cambian estado (dedo) | — | — | — | 10–13 → 0 (filas ≥ 40) |
| Profundidad máxima de grupos | 2 → 2 | | | |
| Pozo «Personalizado» rancio o negro | sí → no | | | |

Acciones para lo frecuente (desde el elemento seleccionado):

| Tarea | Hoy 1440 / 1280 / 1024 | Objetivo (todas) |
|---|---|---|
| Relleno con un color de la paleta con nombre | 1 / 2 / 2 | **1** |
| Relleno con un color de la rejilla amplia | 2 / 3 / 3 | 2 |
| Cambiar la forma | 2 / 2 / 2 | **1** |
| Poner la punta al inicio | 1 / 2 / 2 | **1** |
| Cambiar el sentido de los puntos (puntos quietos) | 2 / 3 / 3 | **2** (activar · elegir) |
| Palabras clave de un `code` | 3 / 3 / 3 | 2 (abrir Código · elegir) |
| Traer al frente | 3 / 3 / 3 | 2 (Orden · Al frente) |
| Eliminar sin teclado | 2 / 2 / 2 | **1** |

No se optimiza solo el alto: los umbrales de objetivo (24/28/44) y de contraste son mínimos que no se negocian por ganar píxeles.

---

## 8. Plan de implementación (para después de aprobar)

Fases pequeñas, cada una verificable sola; ninguna toca `model.js`, el kernel, el MCP ni el formato.

| Fase | Contenido | Archivos |
|---|---|---|
| **F0 — defectos** | P1 (especificidad de `white-space` en segmentados del panel), P2 (flechas en el segmentado de sentido, componente común), P3 (pozos sin rancio y con tramado), P4 («⋯» dentro de la fila). Pueden ir solos si se quiere publicar antes (D10) | `css/styles.css`, `js/ui.js` |
| F1 — capas ajenas fuera | `#grpAnim` a `#canvasMenu` en escritorio y `#grpHelp` a «Más › Ayuda y gestos» en todas las anchuras (`placeChrome`, mismos nodos); estado vacío mínimo | `index.html`, `js/ui.js`, `css/styles.css` |
| F2 — cabecera de selección | título serif + metadato + Orden + Eliminar (+ ✕ en hoja), sobre `#propSheetHead`; `syncSelMeta` con nombres (P8) | `index.html`, `js/ui.js`, `css/styles.css` |
| F3 — color de una fila | un componente para las ocho rejillas (misma construcción `buildNodeSwatches`/`buildEdgeSwatches`, misma navegación por teclado), `--sw-size` 24/32, «⋯» en el sitio, propio y cuentagotas dentro | `js/ui.js`, `css/styles.css`, `css/system.css` (token) |
| F4 — nodo y `code` | grupos Apariencia · Texto · Código · Movimiento; segmentados de Forma, Línea del borde y Resaltado sobre sus `select`; fila de tipografía; textarea de código; etiquetas por forma (P7) | `index.html`, `js/ui.js`, `css/styles.css` |
| F5 — conexión | Trazo (color, línea, ruta, lados) · Dirección (puntas, puntos, sentido) · Puntos · Texto; «Volver a la ruta automática» junto a Ruta; D6 | `index.html`, `js/ui.js`, `css/styles.css` |
| F6 — temas | activo oliva en `.seg` del panel (o del sistema, D8); verificación de contraste en ambos temas | `css/system.css` |
| F7 — plegado (si D2 = A) | preferencia `fluyo.ui.props`, botón de plegar, ⚙ en escritorio, sin efecto en modo Historia | `index.html`, `js/ui.js`, `css/styles.css` |
| F8 — cierre | tests (§ 9), `docs/index.html` (párrafo del panel, «Cuentagotas» en vez de «Picker», P9), `CACHE` v81, handoff y decisiones (180+) | `test/…`, `docs/index.html`, `sw.js`, `.ai/…` |

Ids de grupo: se conservan `grpText`, `grpShape` (Apariencia), `grpCode`, `grpStroke` (Trazo), `grpFlow` (Puntos), `grpAnim`, `grpHelp`; nuevos `grpDir` (Dirección), `grpMotion` (Movimiento) y `grpEdgeText` (Texto de la conexión, si se separa del de nodo); se retiran `grpRoute` y `grpLayers` (sus filas y botones conservan id). Los tests que nombran grupos retirados se adaptan (§ 9).

---

## 9. Testing (para después de aprobar; no se ejecuta ahora)

### Unitarios — `test/fluyo-018-23.test.cjs` (solo contratos afectados)

- **Alcance**: cambian solo `index.html`, `css/styles.css`, `css/system.css`, `js/ui.js`, `docs/index.html`, `sw.js` y los tests; `js/model.js`, `js/config.js`, `js/story-*.js`, `js/render.js`, `js/geometry.js`, el Viewer y `css/share.css` idénticos a HEAD (hash).
- `CACHE` = `fluyo-static-v81`.
- **Inventario de ids** de § 4 presentes y únicos; los `select`/`checkbox` nativos siguen existiendo bajo cada segmentado.
- **Matriz de filas por selección** (vm con el arnés de 018.14b): para rect, cylinder, diamond, circle, hex, text, code, icon, image, anim y conexión con/sin puntos y con/sin codos, qué filas y grupos se ven. Es el contrato de «no perder capacidades».
- **Escritura**: cada control (segmentado, fila de color, «N», tipografía, lados, puntas) escribe exactamente el campo de hoy con el valor de hoy y **una** entrada de Undo; el segmentado de Puntas, ambos campos en una.
- `placeChrome`: `#grpAnim` en `#canvasMenu` (> 700) y en `#animSection` (≤ 700); `#grpHelp` nunca dentro de `#panelProperties`.
- Si D2 = A: la preferencia no entra en `serializeProject` ni en el enlace (como 134).

### Chrome — `test/fluyo-018-23-browser.cjs` (objetivo < 3 min; la medida de esta auditoría tardó 42 s)

Viewports: 1440 × 900, 1280 × 720, 1024 × 768 (ratón), 768 × 1024 (dedo). Interfaz clara en todos; oscura en 1280 (una pasada). Un fixture (`fluyo-017-1-qa-complejo` + un `code` y una BD creados en memoria). `ONLY=<viewport>` para las mutaciones.

| Estado | Comprueba |
|---|---|
| Nodo | pantallas ≤ 1,0; grupos primarios abiertos y en la primera pantalla; relleno con una acción; bloque de color ≤ 56 px; muestras ≥ 24 (≥ 32 con dedo); 0 controles < 28 con ratón; ningún texto de control desborda (`scrollWidth ≤ clientWidth`) ni se superpone con su vecino |
| `code` | pantallas ≤ 1,0 con Código plegado; los seis colores accesibles; textarea de código ≥ 5 líneas; sin caja de palabra clave por defecto |
| BD | igual que nodo; la forma marcada es BD |
| Conexión | Dirección abierta; con puntos, Sentido en la primera pantalla y sus tres opciones sin superposición; **teclado**: flechas cambian `flowDir` con un Undo; sin puntos, la ayuda visible; puntas → `startArrow`/`endArrow` |
| Historia | en modo Historia, reproduciendo y Present, `#panelProperties` no visible ni alcanzable con Tab |
| Temas | oscuro: contraste de etiquetas ≥ 4,5, estado activo distinguible (≥ 3:1 en un atributo), pozos sin negro por defecto |
| Comunes | % de lienzo ≥ antes; Undo de un cambio de relleno devuelve el documento idéntico; 0 errores de consola; (D2) plegar → lienzo ≥ objetivo y la preferencia sobrevive a recargar |

Regresión mínima (no baterías históricas): `fluyo-018-17-browser` con `ONLY` en un viewport móvil (390) para la hoja de Propiedades; `fluyo-018-18-browser` solo la parte de Dirección; `fluyo-018-14b.test` adaptado (inventario y grupos por defecto).

### Mutaciones — `test/fluyo-018-23-mutations.cjs` (≈ 12, cada una con `ONLY` de un viewport)

1. Volver a `white-space:nowrap` en los segmentados del panel (P1). 2. Quitar el manejador de flechas (P2). 3. Dirección plegada por defecto. 4. Sentido oculto siempre. 5. `#grpAnim` de vuelta en el panel de escritorio. 6. Color con dos filas (`max-height` 46). 7. Muestras a 18 px. 8. Pozo sin restablecer (P3). 9. El segmentado de Puntas intercambia inicio y final. 10. Un segmentado escribe sin `pushUndo`. 11. `#panelProperties` visible en modo Historia. 12. `applyGroupDefaults` abre grupos en la hoja móvil. 13. `CACHE` sin subir. 14. `model.js` tocado.

Fuera: las baterías históricas completas, las suites Chrome antiguas enteras y las mutaciones de tareas que no tocan el panel.

---

## 10. CACHE

Archivos servidos que cambiarían: `index.html`, `css/styles.css`, `css/system.css`, `js/ui.js`, `docs/index.html`. → **`fluyo-static-v80` → `v81`** (`sw.js`). No cambian: `js/model.js` y el resto del kernel, `js/config.js`, `js/render.js`, `js/geometry.js`, `js/story-*.js`, `js/editor-scenarios.js`, el Viewer (`s/`, `css/share.css`, `css/identity.css`). Sin cambios en fluyo-mcp ni `KERNEL_ID`. Si F0 se publica sola (D10), lleva su propio salto (v81) y el resto, v82.

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Descubribilidad**: la rejilla amplia, el personalizado y el cuentagotas pasan detrás de «⋯» | la paleta con nombre (las categorías semánticas, 141) queda a la vista; si el valor actual no está en la fila, su muestra va primero; «⋯» es un objetivo de 24/44 px con `aria-expanded`; se mide en Chrome que el color actual siempre se ve |
| Capas detrás de un menú «Orden» | hoy están en un grupo plegado bajo el pliegue (3 acciones); con el menú, 2 y siempre arriba |
| Eliminar más a mano (icono arriba) → borrados accidentales | Undo de una entrada (como hoy); papelera `danger` solo al pasar; no se mueve de sitio entre selecciones |
| Capacidades ocultas por contexto | ninguna fila nueva se oculta por estar en su valor por defecto; matriz de filas por forma como test |
| **Regresiones de selección** (refreshPanel ahora pinta cabecera y segmentados) | `refreshPanel` sigue siendo la única que lee la selección; los segmentados solo reflejan su nativo; tests de escritura y Undo por control |
| Conflictos con Historias | contrato fijado con test (§ 6.10); la preferencia de plegado no afecta al modo Historia |
| **Escritorio/móvil divergen** | un DOM, un `applyGroupDefaults`, tokens y `@container` en vez de reglas copiadas; la hoja conserva su altura y su acordeón; pasada móvil de regresión |
| **Tema oscuro**: el activo oliva en `.seg` cambia también el conmutador Editar/Historias de la cabecera si se hace en el sistema | D8: limitarlo al panel o aplicarlo al sistema (y revisar la cabecera en la misma pasada) |
| Accesibilidad: bordes de campo < 3:1 (WCAG 1.4.11) en ambos temas | se reducen los campos; queda registrado para una revisión global de tokens; no se resuelve subiendo `--rule-2` aquí |
| `select` ocultos bajo segmentados | patrón ya usado (`#flowSel`, decisión 36); el segmentado es `radiogroup` con teclado completo; el nativo `tabindex=-1 aria-hidden` |
| **Tests acoplados al DOM** (`018-14b` inventario y grupos, `018-18` `#flowSeg`, `018-13-browser`, `018-3-browser`, `018-7a-browser` usan ids de grupo o rejillas) | ids de campo intactos; los de grupo retirados (`grpRoute`, `grpLayers`) se listan; los tests nuevos miden por rol y por id de campo, no por estructura (`:scope > .pgBody > *`) ni por posición |
| Churn de documentación | `docs/index.html` un párrafo; `ARCHITECTURE`/`DECISIONS` solo en el cierre de la implementación |

---

## 12. Fuera de alcance

- Campos X/Y/W/H, opacidad, cambiar el icono/GIF de un nodo ya creado, edición de propiedades comunes en selección múltiple, nuevas formas, nuevas paletas: serían **capacidades nuevas**.
- Subir el contraste de `--rule-2` en todo el sistema (WCAG 1.4.11): revisión global aparte.
- Undo de `#kwEdit` y `#edgeDotsIn` (escriben sin `pushUndo`): defecto preexistente ajeno al diseño; tarea aparte.
- Barra contextual flotante sobre el lienzo (descartada en 018.18: compite con el diagrama).
- Historias en escritorio (columna de 320/352): sin cambios.
- Móvil: solo hereda lo común (§ 6.9); su altura, acordeón y M1–M3 no cambian.

---

## 13. Decisiones necesarias

| # | Decisión | Recomendación | Alternativa | Nota |
|---|---|---|---|---|
| **D1** | Jerarquía del nodo | Cabecera · Contenido · **Apariencia ▾** (forma, borde, relleno, línea del borde) · **Texto ▾** · Código ▸ (solo `code`) · Movimiento ▸ | la de la consigna (Apariencia · Contenido · Comportamiento · Animación · Avanzado) | «Comportamiento» y «Avanzado» no tienen contenido propio en Fluyo: serían cajones; la de la consigna añadiría dos grupos casi vacíos |
| **D2** | Columna sin selección en escritorio | **A**: estable + plegable por el usuario (preferencia del navegador) | B contextual automática · C superpuesta | § 6.8: B mueve la vista justo después del clic en el 21 % derecho del lienzo |
| **D3** | «Animación del lienzo» y «Atajos» fuera del panel en escritorio | Sí: «Lienzo ▾» y «Más › Ayuda y gestos», como en móvil | dejarlos al final del panel | cierra lo que 018.18 C9 proponía y la 135 ya pedía |
| **D4** | Control de color | **Una fila** (paleta con nombre) + «⋯» que despliega en el sitio rejilla, personalizado y cuentagotas; muestras 24/32 | popover sobre el lienzo · dejar las dos filas | en el sitio = una implementación para columna y hojas; el popover suma una capa y un estado |
| **D5** | Jerarquía de la conexión | Cabecera · Texto · **Trazo ▾** (color, línea, ruta, lados) · **Dirección ▾** (puntas, puntos, sentido) · Puntos ▸ · Texto ▸ | Trazo · Dirección · Animación · Avanzado (consigna) | «Animación» ya es «Puntos» (161); «Avanzado» serían solo los lados: van en una fila de Trazo |
| **D6** | Puntas | Segmentado «— · → · ← · ↔» sobre los dos interruptores (una escritura, un Undo) | dejar dos interruptores | el segmentado enseña la dirección como dibujo; los interruptores son más literales |
| **D7** | `code` | Colores del bloque en «Código» (plegado); textarea de código de 5 líneas en mono; el panel del nodo en Apariencia | abrir «Código» por defecto | abierto: `code` a 1,3 pantallas en 1280 |
| **D8** | Activo = oliva en los segmentados | En el **sistema** (`.seg`), revisando en la misma pasada el conmutador Editar/Historias | solo en el panel | solo en el panel deja dos lenguajes de «activo» |
| **D9** | Móvil | Hereda cabecera de selección, color de una fila (muestras 32) y segmentados; **mantiene** acordeón todo plegado y 40dvh | abrir el grupo primario también en la hoja | abrirlo obliga a desplazar dentro de la hoja nada más abrirla |
| **D10** | Defectos P1–P4 (sentido superpuesto, teclado, pozos, «Más colores») | Dentro de 018.23 como F0, primera fase | hotfix aparte antes (su propio `CACHE`) | P1–P2 afectan a `flowDir` en producción hoy |
| **D11** | Anchos | 288 / 216 sin cambio + `@container` para filas estrechas | 280 / 240 | el ancho no es el problema medido; 240 en tableta costaría 3 pt de lienzo |

---

## Handoff (auditoría y diseño)

- **Qué se hizo**: auditoría del panel de Propiedades (código y Chrome real en 1440/1280/1024 con ratón y 768 con dedo; nodo, `code`, BD, conexión, múltiple, vacío, Historia, reproducción, Present, interfaz oscura, lienzo crema y claro) y diseño de 018.23.
- **Próximo paso (entonces)**: revisión del owner de § 13 (D1–D11). → Hecho: ver «Implementación».

---

## Implementación

Estado: **IMPLEMENTADO — READY FOR COMMIT**. Sin commit, push ni deploy. `CACHE` v80 → **v81**. Decisiones nuevas: **180–187** (`.ai/DECISIONS.md`); sección nueva en `.ai/ARCHITECTURE.md`.

### Decisiones cerradas por el owner

| | Decisión | Cómo quedó |
|---|---|---|
| D1 | Jerarquía del nodo | Cabecera (nombre, tipo/id, Orden, Eliminar) · Contenido · ▾ Apariencia · ▾ Texto · ▸ Código (solo code) · ▸ Movimiento. Ids de campo intactos |
| D2 | Sin selección | Columna fija; se pliega solo a mano (cabecera del panel o ⚙), preferencia `fluyo.ui.props`; nunca contextual |
| D3 | Responsabilidades | «Animación del lienzo» → «Lienzo» (escritorio) / «Más» (móvil); Atajos → «Más › Ayuda y gestos» en todas las anchuras |
| D4 | Colores | Una fila (especiales + paleta con nombre) + «⋯» en el sitio con rejilla, personalizado y cuentagotas; P3 corregido |
| D5 | Conexión | ▾ Trazo · ▾ Dirección · ▸ Puntos · ▸ Texto; `flowDir` en Dirección, en la primera pantalla |
| D6 | Puntas | Segmentado Ninguna · Inicio · Fin · Ambas sobre `startArrow`/`endArrow` (solo el campo que cambia, un Undo); ratón, dedo y teclado |
| D7 | Code | Grupo Código con resaltado, lista propia, texto del código, fondo del bloque, palabra clave y su caja (sin caja por defecto) |
| D8 | Activo | Oliva (velo + borde `--active`) en segmentados de todo el sistema, muestra elegida, «N», «⋯» abierto y pestañas |
| D9 | Móvil | Mismo DOM, grupos, orden e ids; 44 px accionable, 32 px muestras; acordeón de 40dvh sin cambios |
| D10 | Defectos | P1, P2, P3 y P4 corregidos en este slice (y P7, P9; más P10, encontrado al implementar) |
| D11 | Anchos | 288 (escritorio) y 216 (columna de tableta, 701–1024 px; en móvil el panel es la hoja) sin cambios |

### Qué cambia (producto)

- **`index.html`**: `aside#propPanel` reorganizado — cabecera de la selección en `#propSheetHead` (`#selTitle`, `#selMeta`, `#rowZ` con `#btnOrder` y `#orderMenu` que contiene `#btnFront/#btnForward/#btnBackward/#btnBack`, `#btnDel`, `#btnPanelClose` con icono de cerrar o plegar); grupos `grpShape`=Apariencia, `grpText`=Texto, `grpCode`=Código, `grpLayers`=Movimiento, `grpStroke`=Trazo, `grpRoute`=Dirección, `grpFlow`=Puntos; filas de color `.colorRow` con `.swRow`; segmentados `#shapeSeg`, `#borderSeg`, `#langSeg`, `#routeSeg`, `#arrowSeg`, `#flowSeg`, `#speedSeg` sobre sus nativos ocultos; fila de tipografía (`#rowFont` con `#rowFs` y `#rowBold` dentro, «N» = `#boldChk`); `#rowEnds` (Sale/Entra); `#flowNote`, `#orderNote`, `#codeTextHome`. `#grpAnim` (con `#grpAnimHome`) dentro de `#canvasMenu`; `#grpHelp` (con `#grpHelpHome`) dentro de `#helpSection`, ya visible siempre. Script del `<head>`: `data-props="folded"`. Sprite `#i-fold`. Texto de ayuda («la papelera de la cabecera del panel»).
- **`js/ui.js`**: `refreshPanel` (mismas listas de filas + `rowEnds`/`rowArrows`; `placePanelRows`, `applyGroupDefaults(kind)` al cambiar de tipo, `setWell`, etiquetas por forma, `kwPendingId`), `syncSelHead`/`selTitleText`, `markSw` (muestra «actual», tabindex en la elegida), `toggleSwatches`/`addSwatchMore`/`collapseSwatches`/`syncSwatchMore` (`.pinned`), componente de segmentados (`segBind`, `segSync`, `segOnSelect`), `arrowsOf`/`syncArrowSeg`, `syncFlowSeg` (nota), `propsFolded`/`setPropsFolded`, menú Orden (`openOrderMenu`/`closeOrderMenu`), `toggleSurface` en columna = plegar, `placeChrome` (la ayuda ya no viaja). Los manejadores de cada campo son los de antes.
- **`css/styles.css`**: cabecera de la selección, filas de color y «⋯», pozo `[data-auto]`, segmentados del panel (P1), `.inlineSeg` + `@container` (< 240 px apila), fila de tipografía y «N», `#rowEnds`, textarea de código, plegado, ⚙ visible en columna, puntero grueso (44 px en filas, segmentados, «⋯», «N» y pozos; muestras 32), hoja móvil con la misma cabecera. Se retiran las reglas de «Más colores» de dos filas y del «Eliminar» al pie.
- **`css/system.css`**: `--sw-size` (24; 32 con dedo); activo oliva en `.seg` (`aria-checked` incluido) y pestañas; `.pgroup` con rótulo de 32 px y cuerpo de 8 (antes 36 y 10).
- **`docs/index.html`**: párrafo del panel; «Picker» → «cuentagotas»; el sentido de los puntos «en el grupo Dirección».
- **`sw.js`**: `fluyo-static-v81`.
- **Sin cambios**: `js/model.js` y el resto del kernel, formato, `config.js`, `render.js`, `geometry.js`, `interaction.js`, `selection.js`, `state.js`, `editor-scenarios.js`, `story-*.js`, Viewer, Share, fluyo-mcp.

### Desviaciones respecto al diseño (y por qué)

- **Ids de grupo conservados** en vez de `grpDir`/`grpMotion` nuevos: el owner pidió mantener todos los ids; `grpRoute` es ahora «Dirección» y `grpLayers` «Movimiento» (comentado en el HTML).
- **«Línea punteada» sigue siendo un interruptor** (no un segmentado Continua · Punteada): es un booleano y el interruptor ya es el control del sistema para eso; menos churn.
- **Puntas con iconos** (línea, ←, →, ↔) y el nombre de la opción elegida junto a la etiqueta («Puntas · Fin»); los nombres Ninguna/Inicio/Fin/Ambas son el nombre accesible y el tooltip. Con texto no cabían cuatro opciones a 216 px sin superponerse.
- **Metadato de la conexión** sin cambios («Conexión · 1 → 2», lo leen tests y MCP); los nombres de los extremos van en el título cuando la conexión no tiene texto (P8 resuelto en el título).
- **Ruta, Puntas y Línea del borde en línea con su etiqueta** (`.inlineSeg`) en vez de apiladas, para que una conexión con puntos quepa en una pantalla a 1280; en la columna estrecha se apilan.
- **`.pgroup`** baja de 36 a 32 px su rótulo y de 10 a 8 px su margen en todo el sistema (también en los grupos de «Lienzo» y «Más»); con dedo sigue a 44.
- **P10 (nuevo)**: «Lista propia» era inalcanzable (también en HEAD): elegirla con la lista vacía devolvía SQL y la caja no aparecía. Corregido como estado de la UI (decisión 187).

### Pruebas (tiempos reales de esta sesión)

| Suite | Resultado | Tiempo |
|---|---|---|
| `node --test test/fluyo-018-23.test.cjs` | 13 ✔ · 0 ✘ | 1,1 s |
| `node test/fluyo-018-23-browser.cjs` (1440, 1280, 1024 ratón; 768 dedo; 390 móvil) | **213 ✔ · 0 ✘** | **24,2 s** |
| `node test/fluyo-018-23-mutations.cjs` | **21/21 detectadas** | 114,3 s |
| Unitarios adaptados/afectados (010-qa, 013, 014, 015, 018-4, 018-10, 018-12, 018-13, 018-14a, 018-14b, 018-15, 018-16, 018-17, 018-18, 018-19, 018-21, 018-22) | todo ✔ salvo 3 conocidos (abajo) | 15,4 s |
| Regresión Chrome dirigida: `fluyo-018-13-browser` ONLY=d1280 · m390 | 41 ✔ · 39 ✔ | 4,4 s · 5,8 s |
| `fluyo-018-14b-browser` ONLY=d1440 · t768 (· d1101 en una pasada anterior: 84 ✔) | 84 ✔ · 84 ✔ | 13,6 s · 13,7 s |
| `fluyo-018-17-browser` ONLY=d1440 · m390 | 46 ✔ · 97 ✔ | 30,3 s · 44,8 s |
| `fluyo-018-18-browser` ONLY=d1440 · m390 (Dirección) | 61 ✔ · 60 ✔ | 41,7 s · 44,5 s |
| `fluyo-018-19-browser` ONLY=l844 (hoja lateral de Propiedades) | 67 ✔ | 26,5 s |
| `fluyo-018-7a-browser` (capas: árbol de trabajo frente a HEAD) | OK | 22,1 s |

Uso: `NODE_PATH=<playwright-core fuera del repo>`; Chrome real (`channel: "chrome"`), SW y red externa bloqueados.

**Fallos conocidos, ajenos a este slice**: `fluyo-018-19.test` #1 y `fluyo-018-21.test` #18 comparan `css/system.css` / `index.html` con HEAD («este slice no los tocó»): fallan hasta el commit y pasan después (mismo patrón que en 018.18/19/21/22). `fluyo-018-17.test` #8 (seguimiento del paso activo en `editor-scenarios.js`) ya fallaba en HEAD `1a9ca92` (comprobado en una copia de HEAD); este slice no toca `editor-scenarios.js`.

**Tests históricos adaptados** (solo lo que cambia por decisión, con comentario «018.23»): pines de `CACHE` v80 → v81 en 27 archivos (convención de cada release); `018-12.test` (Pausa en «Lienzo», no en la barra de la cabecera), `018-13.test`/`-browser` (título serif = `#selTitle`, grupos Apariencia/Movimiento/Dirección, «⋯» medido con sus muestras), `018-14b.test`/`-browser` (inventario y abiertos por defecto, una fila de muestras, cierre de 44, conmutador oscuro compuesto con su alfa, «⋯» con sus muestras), `018-17.test`/`-browser` (`--sw-size`, ayuda en «Más», animación en «Lienzo»), `018-18.test`/`-browser` (Dirección como grupo, segmentado común), `018-7a-browser` (las capas se pulsan desde el menú «Orden»).

### Mutaciones (`test/fluyo-018-23-mutations.cjs`, copias aisladas)

U1 `CACHE` sin subir · U2 `model.js` tocado · U3/B3 **flowDir superpuesto** (vuelve el `nowrap`) · U4/B4 **flowDir sin teclado** · U5/B5 **«Personalizado» rancio** · U6/B6 **puntas desconectadas del valor real** · U7/B7 **Código pierde el color y el fondo del bloque** · B8 **panel móvil con estructura distinta** · U9/B9 **control < 44 px con el dedo** · U10/B10 **activo sin oliva** · B11 la cabecera de Propiedades compite con el modo Historia · U12/B12 la columna se pliega sola sin selección · B13 las puntas apilan dos Undo. **21/21 detectadas.**

### QA medido (antes → después, grupos por defecto; script de la auditoría)

| | 1440 × 900 | 1280 × 720 | 1024 × 768 | 768 × 1024 (dedo) |
|---|---|---|---|---|
| Ancho / lienzo con panel | 288 · 67 → 67 % | 288 · 61 → 61 % | 216 · 62 → 62 % | 216 · 57 → 57 % |
| Lienzo con el panel plegado | — → 84 % | — → 80 % | — → 80 % | — → 82 % (columna de tableta, también plegable) |
| Pantallas · nodo / BD | 1,16 → **1,0** | 1,49 → **1,0** | 1,54 → **1,0** | 1,43 → **1,0** |
| Pantallas · code («Código» plegado) | 1,30 → **1,0** | 1,67 → **1,0** | 1,76 → **1,0** | 1,64 → **1,0** |
| Pantallas · conexión con puntos | 1,16 → **1,0** | 1,50 → **1,0** | 1,39 → 1,01 | 1,32 → **1,0** |
| `flowDir` en la primera pantalla | sí → sí | **no → sí** | **no → sí** | **no → sí** |
| Sentido superpuesto / sin teclado | sí / sí → **no / no** | | | |
| Bloque de color | 110–150 → **45 px** | 45 | 45 | ≤ 76 (44 + rótulo) |
| Muestras visibles · nodo | 66 → 24 | 66 → 24 | 48 → 15 | 36 → 12 |
| Etiquetas visibles · nodo / conexión | 29 / 33 → 13 / 18 | | | |
| Controles que fallan su objetivo (Chrome, la suite) | 4–8 → **0** (≥ 28; muestras y «⋯» ≥ 24) | 0 | 0 | 10–13 → **0** (≥ 44; muestras ≥ 32) |
| Acciones: relleno con color con nombre / forma / punta al inicio / sentido (quietos) / palabras clave / al frente / eliminar | 1/2/1/2/3/3/2 → **1/1/1/2/2/2/1** | 2/2/2/3/3/3/2 → **1/1/1/2/2/2/1** | ídem | ídem |
| Errores de consola | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |

Contraste (Chrome): etiquetas 10,2 (claro) y 10,9 (oscuro); opción activa de un segmentado frente a su lecho ≥ 3:1 en los dos temas (antes la diferencia era solo el texto). Capturas comparables en el scratchpad de la sesión (`shots23/`, `shots-after/`, y las de la auditoría en `shots/`).

### Riesgos y pendientes

- **Descubribilidad del color amplio**: la rejilla, el personalizado y el cuentagotas están detrás de «⋯» (un clic más que antes para un color fuera de la paleta con nombre). El color actual siempre se ve (muestra «actual» / `.pinned`).
- **Capas en un menú**: dos acciones en vez de tres, pero ya no a la vista; el tooltip dice «Orden de capas».
- **Columna de tableta (216)**: la fila de color con dedo enseña 4 muestras + «⋯»; Forma ocupa dos filas de iconos.
- **WCAG 1.4.11** (bordes de campo 1,7:1 en los dos temas): se reduce el número de campos con caja, no se resuelve; revisión global de tokens pendiente.
- **Undo de `#kwEdit` y `#edgeDotsIn`** (escriben sin `pushUndo`): preexistente; tarea aparte sugerida.
- **Tests acoplados al DOM**: los nuevos miden por id de campo y por rol; los históricos adaptados quedan anotados.
- QA en dispositivo físico (iOS Safari / Android Chrome) para la hoja con la cabecera nueva: no se puede emular aquí.

### Próximo paso

Revisión del owner y commit (fluyo; el MCP no cambia). Después, si se quiere, la tarea del Undo de `#kwEdit`/`#edgeDotsIn` y la revisión global de contraste de bordes de campo.
