# FLUYO-018.11 — Auditoría UX/UI y plan de rediseño

Estado: **READY FOR REVIEW** (solo auditoría; sin cambios de producto).
Fecha: 7 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: este documento solo contiene observaciones de interfaz, evidencia técnica y un plan de trabajo del proyecto open source.
> Base: `fluyo` `604b344` (018.10 desplegado), árbol limpio. `CACHE` actual: `fluyo-static-v69`.
> Fuentes: `AGENTS.md`, `.ai/PRODUCT.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 116), `index.html`, `css/{identity,styles,share}.css`,
> `s/index.html`, `js/{interaction,selection,ui,render,state,config,editor-runtime,editor-scenarios,editor-share,share-url,story-playback,present-story,viewer,viewer-viewport}.js`,
> y un recorrido en Chrome real (§2.3).

---

## 1. Executive summary

Fluyo tiene un **núcleo sólido**: el canvas, el modelo de documento, las Historias, Share y el Viewer funcionan y son coherentes. Lo que no funciona es la
**capa de interfaz que los rodea**. Esa capa creció por acumulación, una feature cada vez, y hoy tiene tres problemas.

1. **En móvil hay bloqueos reales, no solo incomodidad.**
   - A 390 px, el cajón de propiedades tapa el único botón que lo cierra (⚙). Ni tocar fuera ni `Esc` lo cierran.
   - No hay Undo/Redo sin teclado.
   - Renombrar una página exige doble clic + `prompt()`, y el doble toque no lo dispara.
   - La cabecera ocupa entre el 18 % y el 29 % de la altura.
   - Historias tapa el 72 % del canvas justo mientras se reproduce.
2. **Lo que da sensación de herramienta antigua es el chrome, no el canvas.**
   - Una cabecera plana con 15 controles al mismo nivel, que se parte en 2 filas a 1280 px.
   - Emoji de color mezclados con dingbats y con iconos SVG.
   - Georgia como tipografía por defecto del diagrama y del logo.
   - Un panel de propiedades con 7 rejillas de 35 colores y un manual de atajos como estado vacío.
   - Selección con flechas azules «estilo draw.io» (así lo dice el código).
   - Diálogos nativos del navegador.
   - Un canvas que ignora `devicePixelRatio` y se ve borroso en pantallas retina y en todos los móviles.
3. **La arquitectura no refleja el loop Crear → Explicar → Presentar → Compartir.**
   - Historias es una pestaña dentro del inspector de selección.
   - «Pausa» (animación ambiental), «Reproducir» (Historia) y «Presentar» son tres reproducciones distintas sin relación visible.
   - Ajustes de documento (tema, tipografía, cuadrícula, fondo) conviven con acciones (Guardar, Compartir).
   - Los enlaces del sitio (Privacidad, Soporte…) viven en la barra de páginas del editor.

**Recomendación:** no rehacer Fluyo. Rediseñar por capas, en slices aislados:
- primero un desbloqueo táctil mínimo de los P0;
- después un sistema visual (tokens, iconos, componentes, canvas HiDPI);
- después la estructura (shell, inspector, canvas, móvil, Historias);
- al final los dialogs y el Viewer.

Ningún slice necesita tocar `model.js` ni el formato `.fluyo.json`. La única excepción posible es la tipografía por defecto del diagrama (§14, D4).

---

## 2. Estado actual

### 2.1 Arquitectura de la interfaz (editor)

```
header (flex-wrap)  logo · Ejemplo · Limpiar página · ─ · Tema▾ · Tipografía▾ · ☑Cuadrícula · ☐Ajustar · Fondo ■ ✕ · ⏸Pausa · ▶Presentar · 💾Guardar · 📂Abrir · Compartir · ⬇Exportar · (⚙ ≤700px)
main
 ├─ nav.rail (64px, vertical; ≤700px → fila horizontal con scroll)  Mover · Flecha | Caja · BD · Rombo · Círculo · Hex · Texto · Código | Iconos · Imagen · GIFs
 ├─ .stage  #cv (canvas 2D) + #editBox + cajones #iconDrawer/#animDrawer + papelera táctil
 └─ aside#propPanel (252px; 200px en 701–1024; 336px con Historias; ≤700px → cajón fijo de 310px)
      pestañas: Propiedades | Historias
      Propiedades: Selección (manual de ayuda | multiselección | ~30 filas) · Animación (sliders) · Open Source (enlaces)
      Historias: selector ▾ + ⋯ · ▶ Reproducir · Eventos (biblioteca) · Historia (storyboard)
#bottomBar  pestañas de página + ＋ · enlaces del sitio (Docs, Ejemplos, Privacidad, Soporte, GitHub, MCP)
flotantes  #presentBar · #presentStory · #scPlacementBar · #scNotice · #scPopover
dialogs  #scEventDialog · #scDetailsDialog · #shareDialog · overlays de exportación / restauración / documento entrante
```

Viewer (`s/index.html`): `#chrome` (logo, pestañas de página, Encajar, −, +, Presentar, **Abrir en Fluyo**) · canvas · banda `#story` (Historia + ▶ Reproducir
historia) · «Hecho con Fluyo». `css/share.css` no tiene ninguna media query.

### 2.2 Lenguaje visual actual (medido en el CSS)

| Aspecto | Valor actual |
|---|---|
| Color | Oscuro cálido (`--bg #111213`, `--panel #1b1d1f`, `--panel2 #222527`, `--line #2e3134`), acento naranja `#d08b5b`. Hay un segundo acento azul `#3aa7e8` para foco, selección del canvas, handles y chips de frase. Rojo y verde de estado (`#c97070`, `#e08585`, `#e5706a`, `#7bb85b`, `#5ac47d`) sin tokens. |
| Tipografía UI | `13px/1.45 "Segoe UI", system-ui`. Tamaños en uso: 8.5, 9, 10, 10.5, 11, 11.5, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22 y 23 px, sin escala. Logo y títulos de `.card` en **Georgia**. |
| Tipografía del diagrama | `DEFAULT_FONT = Georgia`. La lista `FONTS` tiene 12 pilas de sistema: Times, Palatino, Arial, Verdana, Trebuchet, Tahoma, Courier, Impact, **Comic Sans** y Mono. |
| Radios | 4, 5, 6, 7, 8, 10, 12, 14, 16 y 999 px, sin sistema. Las pestañas de página usan `7px 7px 0 0` (pestaña de navegador). |
| Sombras | Ad hoc: `#000a`, `#000b`, `#0009`, `#0004`, `#0005`, `#0007`, `#0008`. |
| Botón base | `--panel2` + borde 1px + radio 7 + `6px 11px`. El hover solo cambia el borde. No hay variante de solo icono, no hay escala de tamaños y no hay estado `:active`. |
| Iconografía | El rail usa SVG con trazo de 1.6. El resto mezcla emoji de color (💾 📂 🎯 ⭐ 💵 📦 👤 📨) con dingbats (▶ ⏸ ⬇ ✕ ⚙ ⬆ ⬇ ＋ － ◀ ■ ↻ ▾ ⋯ ◎ ✦ ◐ ✺ ●). |
| Controles nativos | `<select>` (tema, tipografía y 10 selects en propiedades), checkboxes de 15 px, `input[type=color]`, `input[type=range]` y `input[type=number]`, todos sin estilizar. |
| Canvas | Rejilla de líneas de 20 px. Selección: rectángulo discontinuo azul y 4 handles cuadrados blancos de 7 px **en unidades de mundo** (3,5–5,6 px en pantalla a zoom 0,5–0,8). Conexión: 4 flechas azules sólidas fuera de cada lado; `interaction.js:410` dice literalmente «estilo draw.io». |
| Densidad | El panel de propiedades de un nodo mide 1686 px de alto en una vista de 810 px (1440×900). |

### 2.3 Pruebas exploratorias realizadas (solo lectura)

- **Copia temporal.** La app se copió fuera del repo (scratchpad de la sesión), sin `.git` ni `test/`. Se sirvió con un servidor HTTP local efímero, con el tráfico externo bloqueado. **No se tocó ningún archivo del repo salvo esta tarea.**
- **Navegador.** Chrome real (canal `chrome`, headless) con Playwright externo vía `NODE_PATH`, como los browser tests del repo. Táctil emulado (`hasTouch`, `isMobile`) más eventos táctiles CDP.
- **Viewports.** Desktop 1440×900 y 1280×800; tablet 768×1024 (táctil); móvil 390×844 y 375×667 (táctil).
- **Tareas recorridas en cada viewport:** documento vacío; Ejemplo; crear nodo; seleccionar; mover; selección múltiple; conectar (modo Flecha y arrastre desde el nodo); Undo; panel de propiedades; crear, renombrar y cambiar página; abrir un `.fluyo.json` con Historias (fixture `fluyo-017-1-cliente-kafka-comercio`); abrir Historias; reproducir; volver a editar; diálogo «Crear evento»; Presentar y salir; Compartir; abrir el enlace en el Viewer y reproducir allí.
- **Mediciones automáticas:**
  - cajas de cabecera, rail, panel, barra inferior y canvas;
  - % de la pantalla que ocupa el canvas;
  - número de controles visibles y cuántos miden menos de 44, 32 y 24 px;
  - desbordamientos;
  - diálogos nativos disparados;
  - errores de consola. El único error fue el recurso externo bloqueado a propósito.
- **Segunda pasada de depuración táctil a 390 px.** Varios gestos fallaron en la primera pasada a zoom de encaje (0,20–0,27). Se repitieron con los nodos visibles a zoom 0,5 para separar defectos reales de artefactos del arnés (§4.1).
- **Lectura de código dirigida:** interacción y táctil; Historias, EventTypes, Playback, Present, Share y Viewer.

### 2.4 Mediciones clave

| Viewport | Cabecera | Canvas (px / % pantalla) | Controles < 44 px | < 32 px | Notas |
|---|---|---|---|---|---|
| 1440×900 | 50 px, 1 fila | 1124×810 / 70 % | 29 de 41 | 19 | El panel de propiedades necesita scroll (1115 px de alto en 810 visibles; con un nodo seleccionado, 1686) |
| 1280×800 | **91 px, 2 filas** | 964×669 / 63 % | 26 de 38 | 16 | Con Historias abierto el canvas baja a 880 px y el diagrama queda cortado («Comercio») sin reencajar |
| 768×1024 | 91 px, 2 filas | 504×893 / 57 % | 28 de 40 | 18 | El panel de 200 px está siempre visible. Con Historias, el canvas mide **368 px**. El Ejemplo encajado queda a zoom 0,27 (ilegible) |
| 390×844 | **155 px, 4 filas** | 390×604 / 72 % | 29 de 29 | 12 | El rail se desplaza (710 px de contenido en 390). Panel atrapado (§4.1) |
| 375×667 | **192 px, 5 filas** | 375×391 / **59 %** | 29 de 29 | 12 | El selector de tema queda cortado por el borde derecho. El texto de ayuda vacío del canvas aparece cortado y dice «a la izquierda… haz clic» |
| Viewer 375×667 | 124 px, 2 filas | 375×397 | — | — | Botones de 33 px. Banda de Historia de 114 px. «Hecho con Fluyo» 32 px |

---

## 3. Problemas encontrados (visión de conjunto)

Clasificación pedida (A visual · B interacción · C estructural · D modelo de interacción). El detalle, la evidencia y la prioridad están en §8.

**A. Puramente visuales**
- A1 Canvas sin HiDPI (borroso en retina y en móvil).
- A2 Iconografía mezclada (emoji de color, dingbats y SVG).
- A3 Sin escala tipográfica; Georgia en el chrome y como fuente por defecto del diagrama.
- A4 Dos acentos que compiten: naranja de marca y azul de selección y foco.
- A5 Controles nativos sin estilizar (select, checkbox, color, range).
- A6 Radios y sombras sin sistema; pestañas de página con forma de pestaña de navegador.
- A7 Rejilla de líneas y handles cuadrados que recuerdan a herramientas de diagramas clásicas.
- A8 Hints de 11 px, etiquetas del rail de 9 y 8,5 px, enlaces del pie de 20 px de alto.

**B. Interacción**
- B1 No hay Undo/Redo sin teclado.
- B2 Diálogos nativos: `confirm` ×4, `alert` ×12, `prompt` ×1.
- B3 Renombrar página solo con doble clic + `prompt`.
- B4 Multiselección imposible en táctil (no hay marco, Shift ni «seleccionar todo»).
- B5 Copiar, pegar y duplicar un solo elemento solo por teclado; Pegar no tiene botón.
- B6 Handles de redimensionar y codos sin ampliar en táctil (3,5–5,6 px).
- B7 Sin control de zoom ni de encaje en el editor.
- B8 Sin sistema de feedback (no hay toasts; `#scNotice` asume un rail a la izquierda con `left:84px`).
- B9 El estado vacío es un manual de atajos de teclado.
- B10 «Ejemplo» sustituye la página actual sin confirmar (Undo solo con teclado).
- B11 En Present, un toque cambia de diapositiva y corta la Historia.
- B12 Hay razones de controles deshabilitados que solo se ven en `title` (tooltip).

**C. Estructurales**
- C1 La cabecera mezcla ajustes de documento, acciones de archivo, modos y marketing en una sola fila plana.
- C2 Historias es una pestaña del inspector de selección (ensancha el panel, deshabilita Propiedades al reproducir).
- C3 Tres reproducciones sin relación visible: «Pausa» ambiental, «Reproducir» Historia y «Presentar».
- C4 Inspector monolítico: ~30 filas siempre en el mismo orden y 7 rejillas de color.
- C5 La barra de páginas comparte franja con los enlaces del sitio.
- C6 No existe arquitectura responsive; hay un solo corte, a 700 px. Por encima se encoge el escritorio, por debajo se apila.
- C7 Viewer sin media queries; no se puede reproducir la Historia en el Present del Viewer.

**D. Modelo de interacción heredado de editores de diagramas**
- D1 **Las 4 flechas azules por lado para conectar.** Con ratón funcionan, pero llenan el canvas de chrome y en táctil exigen seleccionar antes. El modo «Flecha» (tocar origen, tocar destino) es el que mejor funciona en táctil y hoy está escondido como segunda herramienta.
- D2 **Herramienta de un solo uso** (elegir forma, clic en lienzo, vuelve a Mover). Es un paradigma de paleta. Hay alternativas más directas, como «+» contextual junto al nodo seleccionado para crear el siguiente ya conectado. Se propone evaluarlas, no imponerlas.
- D3 **Inspector de propiedades exhaustivo** (todas las propiedades, siempre). Patrón de editor técnico. Un editor moderno muestra las 3–5 acciones frecuentes en contexto (barra flotante de selección) y deja el resto en un inspector plegado.
- D4 **El ratón como paradigma primario.** Hay pan con botón derecho, central o Alt; zoom con Ctrl+rueda; doble clic para editar, borrar codos y renombrar. El táctil se añadió como excepción (papelera flotante, radios ampliados solo en algunos elementos). No hay un modelo táctil propio (pulsación larga, modo selección, barra contextual).
- D5 **Pestañas de página al estilo hoja de cálculo**, abajo. Funcionan en desktop. En móvil compiten con el área del pulgar y no permiten renombrar ni reordenar.

---

## 4. Mobile UX audit

### 4.1 Lo observado (Chrome, 390×844 y 375×667, táctil)

- **Panel atrapado (390 px).** El cajón `aside` es `position:fixed; top:0; right:0; width:min(310px,88vw)` y queda por encima de la cabecera. ⚙ está en (260,116). Con el cajón abierto, `elementFromPoint` sobre ⚙ devuelve un control del panel (`#lblEdit`). Tocar el lienzo a la izquierda del cajón no lo cierra, y `Esc` tampoco. No existe botón de cerrar ni fondo oscuro. **El usuario no puede volver al canvas.** A 375 px, ⚙ quedó por casualidad a la izquierda (x≈25) por cómo se parte la cabecera. Que se pueda cerrar depende del ancho y del texto de los botones.
- **Cabecera:** 4–5 filas, 155–192 px, con 16 controles globales antes del primer píxel de canvas. El rail ocupa otros 45 px y necesita scroll horizontal (710 px de contenido) sin indicarlo.
- **Undo/Redo:** no existe ningún control (búsqueda de botones con «deshacer», «rehacer», undo o redo: 0 resultados). En táctil, cualquier error es definitivo salvo que el usuario conecte un teclado.
- **Renombrar página:** se probó el doble toque sobre la pestaña: no aparece `prompt` y el nombre no cambia. **No hay forma de renombrar páginas en móvil.** Eliminar es una `✕` de texto (~12 px) dentro de la pestaña.
- **Historias:**
  - Para llegar hay que pulsar ⚙ y luego la pestaña Historias. El `title` de ⚙ es «Propiedades de la selección», así que no anuncia Historias.
  - El panel de 270 px cubre el canvas.
  - Al pulsar Reproducir, el panel sigue encima: la reproducción ocurre detrás (captura `m375-09-playback`).
  - Colocar un evento exige tocar el canvas, que está tapado.
  - Nada cierra el panel al entrar en colocación (`scBeginPlacement` no toca `panelOpen`).
- **Gestos que funcionan** (verificados a zoom 0,5):
  - tocar para seleccionar;
  - arrastrar un nodo con un dedo;
  - un dedo en vacío desplaza el plano;
  - pellizco para hacer zoom;
  - modo Flecha (tocar origen, tocar destino) crea la conexión;
  - la papelera flotante aparece con selección.
- **Gestos que fallan o no existen:**
  - **multiselección:** no hay marco en táctil y ninguna alternativa;
  - redimensionar (handle de 3,5 px en pantalla, sin ampliar);
  - borrar codo (doble toque sobre un objetivo de <10 unidades de mundo);
  - copiar, pegar y duplicar un solo elemento;
  - seleccionar todo;
  - cancelar una herramienta armada (solo `Esc`).
- **Escala.** Con el Ejemplo encajado, el zoom queda en 0,20–0,27 en 390/375/768. Un nodo mide ~33 px y su texto es ilegible. Los gestos por toque siguen siendo posibles, pero fallan con facilidad (en el recorrido automático a ese zoom fallaron mover y conectar; a 0,5 funcionan).
- **El estado vacío** se pinta en el canvas con Georgia de 20 px, sale cortado por los dos lados y dice «icono a la izquierda y haz clic aquí». En móvil el rail está arriba y no hay clic.
- **Present** sí funciona en móvil: pantalla completa y barra inferior de 44×38 px. Pero un toque accidental avanza de diapositiva y detiene la Historia, y la barra se queda al 35 % de opacidad mientras reproduce (depende de *hover*).
- **Share:** el diálogo se adapta (`min(480px, 100vw-32px)`). Es el flujo móvil más sano del editor.
- **Viewer:**
  - Es usable: el canvas se encaja; hay pan y pellizco; el botón «Reproducir historia» es una píldora de 40 px.
  - Pero la cabecera se parte en 2 filas (124 px).
  - Los botones miden 33 px.
  - La banda de Historia y «Hecho con Fluyo» se llevan 146 px fijos.
  - El canvas usa el 59 % a 375 px.

### 4.2 Decisiones móviles (lo que la evidencia permite afirmar)

| Pregunta | Recomendación | Evidencia / confianza |
|---|---|---|
| ¿Qué sigue exactamente igual? | El canvas como superficie principal. El modelo de gestos actual (un dedo arrastra nodo / desplaza vacío, dos dedos zoom). El modo Flecha por toques. La papelera contextual (como concepto). Share. | Funcionan hoy en Chrome táctil. Alta. |
| ¿Qué se adapta? | Cabecera → una sola fila de 48–56 px. Rail → barra de inserción. Pestañas de página → selector compacto. Viewer → cabecera de una fila. | Mediciones §2.4. Alta. |
| ¿Qué pasa a bottom sheet? | Inspector de propiedades. Historias (storyboard). Biblioteca de eventos. Insertar (formas, iconos, GIFs, imagen). Páginas (lista con renombrar, eliminar y crear). Ajustes del lienzo. | El cajón lateral tapa el 72–80 % del canvas y atrapa al usuario. Un sheet con altura parcial (≈40–50 %) deja ver el canvas. Alta para el diagnóstico; la altura exacta se valida en el slice. |
| ¿Qué pasa a toolbar contextual? | Acciones sobre la selección: color, editar texto, duplicar, conectar desde aquí, eliminar, «más» (abre el inspector). | Hoy esas acciones requieren abrir ⚙ y desplazar 1000+ px, o no existen (duplicar uno). Alta. |
| ¿Qué desaparece en móvil? | El manual de atajos como estado vacío. Los enlaces del sitio en la barra inferior (pasan a un menú). «Limpiar página» como botón de primer nivel. El control de cuadrícula y rejilla (pasa a Ajustes). | Ocupan espacio sin servir a una tarea táctil. Alta. |
| ¿Qué usa gestos? | Pan y zoom (ya existen). Doble toque para editar texto (ya existe; se mantiene, pero con alternativa visible en la barra contextual). **Pulsación larga** sobre vacío o nodo para empezar multiselección: **hipótesis a validar**, no existe hoy. Deslizar el sheet para expandirlo o cerrarlo. | Pulsación larga: sin evidencia propia; validar en el slice móvil. |
| ¿Qué está siempre visible? | Undo/Redo. Acceso a Insertar. Acceso a Historias. Compartir. Página actual. | Son las acciones del loop y las de recuperación de errores. Alta. |
| ¿Qué es modal? | Crear o editar evento (ya es hoja a pantalla completa ≤560 px). Compartir. Confirmaciones destructivas. Present. | Ya funcionan como modal. Alta. |
| ¿Cómo se seleccionan nodos? | Toque (igual que hoy). Multiselección: modo «Seleccionar varios» desde la barra contextual (toques suman o quitan) y/o pulsación larga + arrastre como marco. Hace falta «Seleccionar todo» en el menú. | La carencia es un hecho; el gesto concreto es la decisión **D7** (§14). |
| ¿Cómo se conectan nodos? | Con un nodo seleccionado, acción «Conectar» en la barra contextual → tocar el destino (reutiliza el modo Flecha, que ya funciona en táctil). Las 4 flechas azules no se muestran en táctil. | Modo Flecha verificado. Alta. |
| ¿Cómo se cambia de página? | Selector compacto con nombre y posición («Página 2 / 4 ▾») que abre el sheet de páginas, donde también se renombra, se crea y se elimina. Opcional: deslizar con dos dedos no, porque choca con el pan. | Pestañas actuales: sin renombrar en táctil. Alta. |
| ¿Cómo se accede a Historias? | Botón de modo de primer nivel («Historias») en la barra inferior. Abre el sheet del storyboard. El canvas queda visible encima. | Hoy son 2 toques y un nombre engañoso (⚙). Alta. |
| ¿Cómo funciona Playback? | Al reproducir, el sheet baja a una barra de transporte mínima (Detener, Repetir y paso actual en una línea). El canvas queda despejado. Terminar o detener devuelve el sheet a su altura. | Captura `m375-09`: hoy la reproducción queda tapada. Alta. |
| ¿Cómo se hace Undo/Redo? | Botones persistentes en la barra superior móvil (los dos), además de los atajos. | No existe hoy. Alta. |
| ¿Cómo se comparte? | Botón persistente «Compartir» → el diálogo actual (ya válido en móvil). Si existe, se puede añadir la API nativa `navigator.share` para el enlace creado: mejora, no requisito. | Diálogo verificado a 375 px. Alta. |

---

## 5. Desktop UX audit

- **La cabecera no tiene jerarquía.**
  - 15 controles iguales, del mismo peso visual.
  - El único acento es «Exportar» (botón primario). Sin embargo, el producto apuesta por Compartir y Presentar, y Exportar a GIF es secundario en el loop actual.
  - A 1280 px la cabecera se parte en 2 filas (91 px), con «Compartir» y «Exportar» solos en la segunda.
  - Los ajustes de documento (tema, tipografía global, cuadrícula, ajustar, fondo + ✕) están al mismo nivel que Guardar y Abrir.
- **No hay Undo/Redo visible.** Solo existen como atajo, mencionado en el texto de ayuda.
- **No hay zoom visible.** No hay porcentaje, ni «encajar», ni «100 %». El zoom es Ctrl+rueda y la rueda sola desplaza. El Viewer sí tiene Encajar, − y +: el editor está por detrás de su propio Viewer.
- **Historias cambia el layout y no reencaja.** Abrir la pestaña ensancha el panel de 252 a 336 px. A 1280 px el diagrama queda cortado (captura `d1280-08-historias`).
- **El inspector** se lee como un formulario de configuración:
  - 7 bloques de swatches de 35 colores (texto, borde, relleno, fondo de texto, resaltado ×2, línea y puntos);
  - 10 `<select>` nativos;
  - checkboxes de 15 px.
  - Al final del panel, después de «Animación», hay una sección promocional «Open Source» con ⭐.
- **El estado vacío del inspector** es un manual de 14 viñetas con `<kbd>`. Mezcla instrucciones de ratón, de táctil y de teclado. Es útil como referencia, pero no ayuda a empezar.
- **«Pausa / Play»** controla la animación ambiental (puntos que fluyen). Su rótulo es casi idéntico a «Reproducir» (Historia), y al lado está «▶ Presentar».
- **Barra inferior:** las pestañas de página (estilo pestaña de navegador, radio `7px 7px 0 0`) comparten franja con 6 enlaces del sitio de 20 px de alto.
- **Lo que está bien:**
  - el diálogo «Crear evento» (dos columnas, vista previa en vivo, segmentados claros, pie fijo);
  - el storyboard de Historias (frases humanas, grupos «Al mismo tiempo», esperas legibles);
  - la ventana de Compartir (explica qué viaja en el enlace y que no se puede revocar);
  - Present (canvas solo, barra discreta).
  - Son los fragmentos que ya se acercan al tono buscado.

---

## 6. Visual language audit

| Elemento | Hoy | Problema | Principio (no implementación) |
|---|---|---|---|
| Tipografía | Segoe UI 13 px; Georgia en el logo, en `.card h2` y en el diagrama; 17 tamaños | Sin escala. El serif de sistema en el chrome da aire de documento de oficina. El diagrama hereda Georgia | Una familia de UI (pila de sistema neutra o una variable autoalojada, ver D3), una mono para datos y atajos, y una escala de 5–6 pasos. El serif solo como rasgo deliberado de marca (logo), si se conserva |
| Escala | Hints de 11 px, rail de 9 px, pie de 10,5–11,5 px | Mucho texto por debajo del umbral cómodo | Mínimo 12 px para texto secundario y 13–14 px para controles |
| Iconos | SVG (rail) + emoji de color + dingbats | Tres sistemas; los emoji se renderizan distinto en cada sistema operativo | Un solo set SVG de trazo uniforme. **Los emoji quedan SOLO como contenido del usuario** (símbolos de eventos, decisión 16), nunca como chrome |
| Color | Naranja de marca + azul de selección/foco + 5 rojos y verdes sueltos | Dos acentos compiten; estados sin tokens | Tokens semánticos: superficie (3 niveles), texto (3), línea (2), acento (1), selección (1, definida, puede ser el acento), estados (éxito, aviso, peligro). El azul deja de ser un segundo acento de marca |
| Fondos y superficies | `#111213` / `#1b1d1f` / `#222527` con borde de 1 px en todo | Todo es una caja con borde: chrome pesado | Menos bordes, más separación por superficie y espacio. Paneles que flotan sobre el canvas en vez de columnas que lo encierran (por evaluar en el shell) |
| Botones | Un estilo; hover solo de borde; sin `:active` | Poco táctil: no hay respuesta al pulsar | Variantes primario, secundario, fantasma, solo icono y peligro; tamaños de 32 (desktop denso), 40 y 44 (táctil); estado de presión visible |
| Inputs | Nativos sin estilizar | Inconsistencia entre sistemas operativos | Inputs, selects y segmentados propios con el lenguaje de `.scSegmented` (ya existe y funciona, decisión 36) |
| Radios | 10 valores | Sin sistema | 3 radios (control, panel, píldora) |
| Sombras / overlays | 7 sombras ad hoc; `#000c` en backdrops | Sin elevación definida | 3 niveles de elevación (flotante, popover, modal) |
| Estados | hover = borde; disabled = opacidad .4–.45; foco azul | Falta `:active`. Hay razones de deshabilitado que solo están en tooltips | Estados completos y razón de deshabilitado visible en táctil |
| Selección (canvas) | Rectángulo discontinuo azul + 4 cuadrados blancos de 7 px de mundo | Lectura de «herramienta de diagramas», y los handles se vuelven diminutos con el zoom | Un contorno sólido con el color de selección, handles de tamaño constante en pantalla (≥8 px visibles, ≥24 px de área táctil) |
| Conectar | 4 flechas azules sólidas por lado | Ruido y estética de editor clásico | Un solo punto de conexión discreto por lado al pasar por encima o seleccionar (desktop). En táctil, la acción «Conectar» |
| Rejilla | Líneas de 20 px | Aspecto de papel milimetrado | Rejilla de puntos o más tenue, y desactivada por defecto en Present, Viewer y export (hoy ya no sale en export; verificar) |
| Nodos / conexiones | Bonitos y animados; Georgia por defecto | El contenido es el punto fuerte; la fuente por defecto lo envejece | No tocar formas, render ni animación. Revisar solo la fuente por defecto (D4) |
| Páginas | Pestañas de navegador abajo | Estética de hoja de cálculo | Selector de página integrado en el shell |
| Historias | Storyboard limpio, frases, viñetas ├ └ ● | Es lo más cercano al objetivo; mezcla emoji de evento con viñetas tipográficas | Conservar la estructura; unificar marcas de estado en SVG |
| Viewer | Mismo chrome que el editor, más simple | Hereda los mismos botones y fuentes | Será el primer escaparate del nuevo lenguaje: poco chrome, una fila, botones de 40–44 px |
| Scrollbars | Las del sistema en el panel, el rail móvil, la barra de páginas y la biblioteca | Visibles y gruesas en Windows | Scrollbars finas o solo al desplazar, en contenedores secundarios |

---

## 7. Interaction audit

| Tarea | Desktop (pasos) | Táctil (pasos) | Observación |
|---|---|---|---|
| Crear documento | 0 (siempre hay uno) o «Ejemplo» (1) | igual | «Ejemplo» **sustituye** la página actual sin confirmar (`export.js:74`). Solo se recupera con Ctrl+Z |
| Crear nodo | 2 (herramienta + clic) | 2 (+ scroll del rail para formas al final) | Herramienta de un solo uso; no hay cancelación sin `Esc` |
| Seleccionar | 1 | 1 | OK |
| Mover | arrastrar | arrastrar | OK en táctil a zoom ≥0,5 |
| Multiselección | marco o Shift+clic | **imposible** | Bloqueante para duplicar, copiar o borrar en grupo |
| Conectar | arrastrar una flecha azul, o modo Flecha (3) | seleccionar + arrastrar la flecha, o modo Flecha (3) | El modo Flecha es fiable; las flechas exigen precisión |
| Redimensionar | handle de ~5 px | **prácticamente imposible** | Handles en unidades de mundo |
| Editar texto | doble clic o panel | doble toque o ⚙ + panel | Doble toque sin pista visual |
| Cambiar página | 1 | 1 | OK |
| Crear página | 1 (＋) | 1 | OK |
| Renombrar página | doble clic + `prompt` | **imposible** | |
| Eliminar página | `✕` de ~12 px + `confirm` | igual | Objetivo diminuto |
| Abrir Historias | 1 | 2 (⚙ + pestaña) y panel atrapado a 390 px | |
| Reproducir Historia | 1 | 1, pero el panel tapa la reproducción | |
| Undo / Redo | solo atajo | **imposible** | |
| Share | 2 (Compartir + Crear enlace) + Copiar | igual | OK |
| Viewer → editor | 1 («Abrir en Fluyo») | 1 | OK, con resolución de conflicto (`#incomingModal`) |
| Volver del Viewer | — | — | No hay «volver» del Viewer al editor de origen (son documentos distintos); por diseño |

Feedback y dialogs:
- `confirm()` ×4: borrar elementos usados por una Historia, borrar página, limpiar página, borrar Historia.
- `alert()` ×12: imagen no compatible, archivo inválido, GIF, enlace roto, cuentagotas…
- `prompt()` ×1: nombre de página.
- La decisión 91 ya registra que el `confirm()` es **provisional**.
- No hay sistema de toasts. «Guardar», «Compartir» (salvo dentro de su diálogo) y «Duplicar» no confirman nada visualmente.
- `#scNotice` (4,5 s) está posicionado con `left:84px` y asume el rail lateral.

---

## 8. Problemas P0 / P1 / P2 / P3

Formato: problema · evidencia · impacto · plataforma · solución propuesta · riesgo · dependencias.

### P0 — bloquea o degrada seriamente el uso

**P0-1 · El panel móvil atrapa al usuario.**
- **Evidencia:** §4.1. Chrome 390×844: ⚙ queda debajo del `aside`; tocar fuera y `Esc` no cierran; el panel no tiene botón de cerrar (`index.html`, `styles.css` ≤700 px).
- **Impacto:** el usuario pierde el canvas hasta recargar.
- **Plataforma:** móvil.
- **Solución:** cierre explícito (botón), fondo que cierra al tocar, `Esc`, y que el panel no cubra el control que lo abre. En el rediseño, bottom sheet.
- **Riesgo:** bajo.
- **Dependencias:** ninguna (arreglo mínimo en el slice 1).

**P0-2 · No hay Undo/Redo sin teclado.**
- **Evidencia:** ningún botón en `index.html`; solo `interaction.js:855-856`. Chrome: 0 controles.
- **Impacto:** en táctil no hay recuperación de errores, incluido «Ejemplo», que reemplaza la página.
- **Plataforma:** móvil y tablet; también es descubribilidad en desktop.
- **Solución:** botones Undo/Redo persistentes con estado deshabilitado cuando la pila está vacía (`undoStack` y `redoStack` ya existen).
- **Riesgo:** bajo. El guardado bloqueado en Playback (`editorFrozen`) debe respetarse.
- **Dependencias:** ninguna.

**P0-3 · No se puede renombrar páginas en táctil.**
- **Evidencia:** `ui.js:483-492` (doble clic + `prompt`). Chrome: el doble toque no hace nada.
- **Impacto:** las páginas, parte del modelo de documento, quedan con nombre por defecto.
- **Plataforma:** móvil y tablet.
- **Solución:** acción visible de renombrar: tocar la pestaña activa abre un menú (Renombrar / Duplicar / Eliminar). En el rediseño, la hoja de páginas.
- **Riesgo:** bajo.
- **Dependencias:** idealmente un diálogo propio (P1-5), pero `prompt` sirve como paso intermedio porque funciona en móvil.

**P0-4 · Historias tapa el canvas en móvil, también durante la reproducción.**
- **Evidencia:** capturas `m375-08` y `m375-09`; panel de 270 px sobre 375; `scBeginPlacement` no cierra el panel.
- **Impacto:** el pilar Explicar/Presentar no es usable en móvil.
- **Plataforma:** móvil.
- **Solución:** sheet de Historias con altura parcial. Al reproducir o colocar, se reduce a barra de transporte o instrucción.
- **Riesgo:** medio. Toca `editor-scenarios.js`, que es grande, y muchos browser tests (`#scRun` en 24 archivos de test).
- **Dependencias:** sistema de sheets (slice móvil).

**P0-5 · La cabecera móvil consume 155–192 px y desborda.**
- **Evidencia:** §2.4; el selector de tema queda cortado a 375 px.
- **Impacto:** el canvas se queda en el 59 % a 375×667. Las acciones del loop compiten con ajustes raros.
- **Plataforma:** móvil.
- **Solución:** cabecera de una fila (Undo/Redo · página · Compartir · menú) y el resto a menús o sheets.
- **Riesgo:** medio. Los tests buscan ids de la cabecera (`#btnShare` 15 archivos, `#btnPresent` 17). Hay que **conservar ids** o actualizar los tests en el mismo slice.
- **Dependencias:** shell.

### P1 — claramente inferior a una aplicación moderna

**P1-1 · Canvas sin HiDPI.**
- **Evidencia:** `render.js:943` `resizeCanvas` iguala `canvas.width` a los px CSS; no hay `devicePixelRatio` en el editor ni en el Viewer (solo la vista previa del modal lo usa, `editor-scenarios.js:1797`).
- **Impacto:** texto y líneas borrosos en retina y en todo móvil (DPR 2–3). Es probablemente la causa más directa de la sensación «barata» en dispositivos modernos.
- **Plataforma:** ambas.
- **Solución:** respaldo a `w·dpr × h·dpr` + `setTransform(dpr…)` en `render`, con conversión de coordenadas intacta (los eventos siguen en px CSS).
- **Riesgo:** medio. Coste de render ×4–9 en móvil (vigilar fps); export, cuentagotas y `getImageData` usan px de respaldo; GIF.
- **Dependencias:** ninguna (aislable).

**P1-2 · Cabecera plana sin jerarquía en desktop; se parte a 1280 px.**
- **Evidencia:** §2.4 y §5.
- **Impacto:** aspecto de barra de herramientas clásica; el loop no se ve.
- **Plataforma:** desktop y tablet.
- **Solución:** shell en 3 zonas:
  - documento (nombre y página);
  - modos (Editar / Historias / Presentar);
  - acciones (Undo/Redo, Compartir, Exportar, menú ⋯ con Abrir, Guardar, Ejemplo, Limpiar y Ajustes del lienzo).
- **Riesgo:** medio (tests por id, onboarding de usuarios actuales).
- **Dependencias:** sistema visual.

**P1-3 · Iconografía mezclada (emoji y dingbats como chrome).**
- **Evidencia:** §2.2; lista completa en los informes de código (cabecera, propiedades, presentBar, Historias, Viewer).
- **Impacto:** inconsistencia; el render cambia según el sistema operativo; aspecto amateur.
- **Plataforma:** ambas.
- **Solución:** set SVG único inline (sin dependencias, compatible con `file://`). Los emoji se conservan solo como contenido del usuario.
- **Riesgo:** bajo.
- **Dependencias:** sistema visual.

**P1-4 · Inspector monolítico.**
- **Evidencia:** ~30 filas, 7 rejillas de 35 colores, panel de 1686 px.
- **Impacto:** congestión; las acciones frecuentes quedan enterradas.
- **Plataforma:** ambas.
- **Solución:**
  - barra contextual de selección con las acciones frecuentes;
  - inspector agrupado por tipo con divulgación progresiva;
  - un control de color compacto (muestra actual + popover con paleta + personalizado + cuentagotas) en vez de 7 rejillas abiertas;
  - fuera del panel la sección Open Source y el manual de atajos (pasan a Ayuda).
- **Riesgo:** medio. Los ids de propiedades (`#fsIn`, `#swatches`…) los usan tests.
- **Dependencias:** sistema visual y shell.

**P1-5 · Diálogos nativos** (`confirm` ×4, `alert` ×12, `prompt` ×1).
- **Evidencia:** §7; decisión 91.
- **Impacto:** rompen el lenguaje visual, no se pueden estilizar ni explicar bien el impacto, y bloquean el hilo.
- **Plataforma:** ambas.
- **Solución:** un diálogo de confirmación propio (título, impacto, acción destructiva nombrada, cancelar por defecto) + toasts para avisos no bloqueantes + diálogo de texto para renombrar.
- **Riesgo:** medio. Los tests aceptan diálogos nativos (`page.on("dialog")`); el borrado con impacto (decisión 91) tiene tests de «un solo diálogo, cancelar no deja Undo».
- **Dependencias:** sistema visual.

**P1-6 · Multiselección imposible en táctil; copiar, pegar y duplicar un solo elemento solo por teclado.**
- **Evidencia:** `interaction.js:457-461` (sin marco en táctil); `#multiSel` es la única superficie de Copiar, Cortar y Duplicar; Pegar no tiene botón.
- **Impacto:** en táctil no se puede reorganizar un diagrama.
- **Plataforma:** móvil y tablet.
- **Solución:** modo «seleccionar varios» + «Seleccionar todo» + Duplicar, Copiar y Pegar en la barra contextual o el menú.
- **Riesgo:** medio (conflicto de gestos con el pan).
- **Dependencias:** barra contextual; D7.

**P1-7 · Handles y codos sin escala de pantalla ni ampliación táctil.**
- **Evidencia:** `config.js:5` `HANDLE=7` y radio de acierto 10, ambos en unidades de mundo (`interaction.js:64,69`).
- **Impacto:** redimensionar en táctil es imposible y en desktop es fino.
- **Plataforma:** ambas.
- **Solución:** tamaño y radio constantes en pantalla (dividir por `viewZoom`) y ampliados en táctil, como ya se hace con las flechas.
- **Riesgo:** bajo.
- **Dependencias:** ninguna.

**P1-8 · Selección y conexión con estética de editor clásico.**
- **Evidencia:** `render.js:484-493` y `:928-942`; el comentario «estilo draw.io» (`interaction.js:410`).
- **Impacto:** es el rasgo que más asocia el producto a herramientas antiguas dentro del canvas.
- **Plataforma:** ambas.
- **Solución:** contorno sólido, handles redondeados de tamaño constante, un punto de conexión por lado (desktop) y acción Conectar (táctil).
- **Riesgo:** medio. Es el gesto principal de creación de conexiones y conviene medirlo antes y después.
- **Dependencias:** sistema visual (color de selección).

**P1-9 · No hay zoom ni encaje visibles en el editor.**
- **Evidencia:** §5. `fitView` existe (`state.js:79`) pero ningún control del editor lo usa; el Viewer sí tiene «Encajar», − y +.
- **Impacto:** perderse en el canvas; en táctil no hay «volver a ver todo».
- **Plataforma:** ambas.
- **Solución:** control compacto (−, %, +, encajar) en una esquina del canvas.
- **Riesgo:** bajo.
- **Dependencias:** sistema visual.

**P1-10 · Historias como pestaña del inspector.**
- **Evidencia:** `ui.js:596-611`. Ensancha el panel y no reencaja (captura `d1280-08`); deshabilita Propiedades al reproducir.
- **Impacto:** el modo «Explicar» no se percibe como modo.
- **Plataforma:** ambas.
- **Solución:** Historias como modo del shell. En desktop conserva un panel lateral propio; al entrar o salir, el canvas reencaja si el contenido queda fuera.
- **Riesgo:** medio.
- **Dependencias:** shell.

**P1-11 · Tipografía.**
- **Evidencia:** §2.2.
- **Impacto:** sin escala; Georgia en chrome y diagrama.
- **Plataforma:** ambas.
- **Solución:** escala y familia de UI (D3); fuente por defecto del diagrama (D4).
- **Riesgo:** bajo en UI. **Alto en el diagrama**, porque cambia el aspecto de documentos existentes que no fijan fuente.
- **Dependencias:** decisión.

### P2 — mejora importante de calidad

- **P2-1 Tres «reproducir».** «⏸ Pausa» (ambiental) vs «▶ Reproducir» (Historia) vs «▶ Presentar».
  - **Solución:** la animación ambiental pasa a Ajustes del lienzo o a un interruptor discreto; Reproducir queda reservado a Historias.
  - **Riesgo:** bajo.
- **P2-2 Estado vacío.** El manual de atajos como empty state; el texto del canvas cortado en móvil y con instrucciones de ratón.
  - **Solución:** estado vacío accionable (crear la primera forma, abrir un ejemplo, abrir un archivo) y ayuda de atajos en un panel «Ayuda» o con `?`.
  - **Riesgo:** bajo.
- **P2-3 Barra inferior.** Enlaces del sitio dentro del editor.
  - **Solución:** se mueven al menú de ayuda; la franja queda para páginas (desktop) o desaparece (móvil).
  - **Riesgo:** bajo (SEO y enlaces internos: comprobar que `docs/` y `ejemplos/` siguen enlazados desde algún sitio rastreable).
- **P2-4 Feedback.** Sin toasts; Guardar y Duplicar sin confirmación visual; `#scNotice` a `left:84px`.
  - **Solución:** un sistema de avisos (toasts) compartido.
  - **Riesgo:** bajo.
- **P2-5 Present táctil.** Un toque avanza la diapositiva y corta la Historia (`interaction.js:580` + `ui.js:520`); la barra se queda al 35 % mientras reproduce y depende de hover.
  - **Solución:** el toque muestra la barra; avanzar requiere su botón o deslizar.
  - **Riesgo:** bajo.
- **P2-6 Viewer.**
  - Problemas: sin media queries; cabecera de 2 filas a 375 px; botones de 33 px; la Historia no se puede reproducir en su Present; no hay control visible de pausar la animación ambiental.
  - **Solución:** cabecera de una fila con menú; botones de 40–44 px; reproducir Historia también en Present.
  - **Riesgo:** bajo-medio (tests 014/016 de Viewer).
- **P2-7 Objetivos táctiles pequeños** en Historias:
  - asa de reordenar de 16×30 px (14 px ≤480) con opacidad .35 que solo se aviva con hover;
  - «⋯» de 30×32;
  - botón de espera de 28 px de alto;
  - swatches de 26 px;
  - botones de insertar frase de ~25 px.
  - **Solución:** mínimo 40–44 px de área táctil; asa siempre visible en táctil.
  - **Riesgo:** bajo.
- **P2-8 Terminología.**
  - «Volver a editar» significa dos cosas (salir de Playback / salir de Present).
  - «Diapositiva» (editor) vs «Página» (Viewer).
  - «sistema / diagrama / lienzo».
  - «Semibold» en inglés.
  - El `title` de ⚙ es «Propiedades de la selección».
  - El trace muestra `UP → DOWN` crudo.
  - **Solución:** glosario breve y una pasada de textos dentro de cada slice.
  - **Riesgo:** bajo.
- **P2-9 El rail móvil** se desplaza sin indicarlo (710 px de contenido); las formas del final (Hex, Texto, Código, Iconos, Imagen, GIFs) quedan fuera de vista.
  - **Solución:** sheet «Insertar» con todas las categorías visibles.
- **P2-10 Razones de deshabilitado** solo en `title` (por ejemplo, Reproducir sin pasos). No llegan al táctil.
  - **Solución:** texto de estado visible junto al control.
- **P2-11 «Ejemplo» reemplaza la página actual sin confirmar.**
  - **Solución:** abrirlo en una página nueva, o confirmar si la página no está vacía.
  - **Riesgo:** bajo; cambia un comportamiento probado (test 018.x que use `#btnDemo`: 1 archivo).

### P3 — polish

- Scrollbars del sistema visibles en el panel, el rail, la biblioteca y la barra de páginas.
- Estado `:active` de los botones.
- Un mismo glifo ▶ para «siguiente diapositiva» y para «Reproducir».
- Las viñetas del storyboard (├ └ ●) en texto: pasarlas a SVG o CSS.
- El logo anima sus puntos siempre (respeta reduced-motion; valorar que solo lo haga al cargar).
- Rejilla de líneas → puntos.
- Sombras y radios unificados.
- `.card h2` en Georgia.
- **Posible bug fuera de alcance:** el registro de detalles pasa `escapeHtml()` a `textContent` (un `&` se vería como `&amp;`), en `editor-scenarios.js` en torno a la línea 307. Hay que verificarlo en su propio slice.

---

## 9. Principios de diseño propuestos

1. **El canvas es la interfaz; el chrome se gana su sitio.** Cada control permanente debe servir a una tarea frecuente del loop. Lo demás vive en menús, sheets o contexto. Objetivo medible: canvas ≥80 % en desktop y ≥70 % en móvil en estado de edición.
2. **Una acción, un lugar, un icono.** Cada acción tiene una ubicación canónica por plataforma y un icono SVG del mismo set. Sin emoji en el chrome.
3. **Contexto antes que inspector.** Lo frecuente (color, texto, duplicar, conectar, eliminar) aparece junto a la selección. El inspector completo es el «más».
4. **Táctil como ciudadano de primera.** Toda acción tiene una vía sin teclado, sin hover y sin doble clic. Área táctil mínima de 44 px en táctil y 32 px en desktop denso. Los atajos son aceleradores, nunca la única vía.
5. **El loop se ve.** Crear → Explicar → Presentar → Compartir se refleja en el shell como modos y acciones de primer nivel. «Reproducir» es siempre Historia.
6. **Pocos tokens, aplicados siempre.**
   - Una escala tipográfica de 5–6 pasos.
   - 3 radios y 3 elevaciones.
   - Un acento de marca.
   - Un color de selección.
   - 3 estados semánticos.
7. **Material, no decoración.** La personalidad «táctil y editorial» viene de proporciones, tipografía, respuesta al pulsar (`:active`, transiciones cortas) y ritmo de espaciado. No viene de ornamento ni de skeuomorfismo. Siempre se respeta `prefers-reduced-motion`.
8. **Nítido en cualquier pantalla.** Canvas HiDPI; chrome a tamaño de pantalla constante independiente del zoom.
9. **Errores reversibles, avisos honestos.** Undo siempre visible. Confirmación solo cuando hay impacto real (decisión 91), con el impacto nombrado. Avisos no bloqueantes para lo demás.
10. **Sin coste técnico nuevo.** HTML, CSS y JS vanilla; sin build, sin dependencias, sin CDN ni webfonts de terceros (privacidad publicada); funciona desde `file://`.

---

## 10. Qué conservar (no rediseñar ahora)

- **Motor de render y animación del canvas.** Formas, conexiones, puntos que fluyen, aparición escalonada, efectos de eventos (`render.js`, salvo HiDPI y chrome de selección).
- **Modelo de documento y kernel.** `model.js`, `.fluyo.json` v5, páginas, `nextId`, integridad, autoría compartida con MCP. **Ningún slice de este plan necesita tocarlos.**
- **Historias como modelo y como lenguaje.** Frases humanas, grupos «Al mismo tiempo», esperas legibles, menú de aparición, reordenar. Se cambia dónde vive el storyboard, no lo que es.
- **Diálogo «Crear / Editar evento».** Su estructura (campos + vista previa en vivo + segmentados + pie fijo + hoja a pantalla completa en móvil) es la referencia interna del nuevo lenguaje. Solo cambian tokens e iconos.
- **Share.** El flujo y los textos (qué viaja, irrevocable, demasiado grande).
- **Viewer.** La estructura (canvas encajado, pan y pellizco, Historia, «Abrir en Fluyo» con resolución de conflictos). Solo pulido responsive.
- **Present.** El concepto (solo canvas, barra mínima, teclado completo).
- **Modelo de gestos táctiles existente.** Un dedo arrastra o desplaza, dos dedos hacen zoom, doble toque edita, modo Flecha por toques.
- **Atajos de teclado.** Todos se conservan.
- **Autoguardado, restauración y documento entrante.** Ya usan overlays propios.
- **Accesibilidad existente.** `:focus-visible`, `aria-*`, teclado en swatches, inputs nativos ocultos con UI estilizada (decisión 36).
- **Restricciones de `AGENTS.md` §6.** Sin build, scripts clásicos, privacidad, `CACHE`.

---

## 11. Roadmap de slices

La numeración es una propuesta. El orden lo dicta la evidencia:
- **los P0 se desbloquean antes** que el rediseño (hoy hay usuarios atrapados);
- **el sistema visual va antes que la estructura**, para no rediseñar dos veces;
- **móvil va después del shell y del inspector**, porque sus sheets alojan esos mismos componentes.

| Slice | Objetivo | Incluye | Terminado cuando | `CACHE` | Chrome QA | `model.js` | Tipo |
|---|---|---|---|---|---|---|---|
| **018.12 — Desbloqueo táctil** | Quitar los P0 que impiden usar el editor en táctil, sin rediseñar | Cerrar el cajón (botón, fondo, `Esc`; el cajón no tapa ⚙). Undo/Redo visibles (cabecera, estados deshabilitados). Renombrar página sin doble clic (menú de la pestaña activa; `prompt` provisional). Handles y codos a tamaño de pantalla y ampliados en táctil (P1-7) | Chrome 390/375/768 táctil: abrir y cerrar el panel por las 3 vías; Undo/Redo de crear, mover y borrar; renombrar página; redimensionar a zoom 0,5; desktop sin regresión; tests existentes en verde | Sí | Sí (táctil) | No | Interacción (mínima, estilo actual) |
| **018.13 — Sistema visual base** | Tokens y componentes que usarán todos los slices siguientes | Tokens (color semántico, escala tipográfica, radios, elevaciones, espaciado) en `identity.css`. Set de iconos SVG inline. Variantes de botón, icon-button, segmented, input, select propio, toggle. Scrollbars. `:active`. **Canvas HiDPI** (P1-1). Sustituir emoji y dingbats del chrome (no los del usuario). Sin mover nada de sitio | Capturas antes/después en 5 viewports; 0 emoji en el chrome (test estático); canvas nítido a DPR 2 (captura con `deviceScaleFactor:2`); rendimiento de render medido en móvil emulado; export PNG/GIF idénticos en contenido | Sí | Sí (visual + DPR) | No | Visual (+ `render.js` para DPR) |
| **018.14 — Shell y navegación** | Cabecera jerarquizada que refleje el loop | Zonas documento / modos / acciones. Menú ⋯ (Abrir, Guardar, Ejemplo, Limpiar, Ajustes del lienzo: tema, tipografía global, cuadrícula, ajustar, fondo, animación ambiental). Control de zoom y encaje. Selector de página integrado (renombrar, crear, eliminar, sin `✕` de 12 px). Enlaces del sitio → menú Ayuda. Historias como modo (sale de la pestaña del inspector; reencaje al cambiar de ancho) | 1280 px en una fila; canvas ≥80 % a 1440 y 1280; todas las acciones previas alcanzables (inventario y test); ids conservados o tests actualizados en el mismo slice | Sí | Sí | No | Estructural |
| **018.15 — Dialogs y feedback** | Fuera los diálogos nativos | Confirmación propia (impacto, acción nombrada, cancelar por defecto), diálogo de texto (renombrar), toasts. Migrar los 17 usos; respetar la decisión 91 (un diálogo; cancelar no deja Undo) | 0 `confirm`/`alert`/`prompt` en `js/` (test estático); tests de 018.4 y 018.7c adaptados con la misma intención | Sí | Sí | No | Migración de componentes |
| **018.16 — Inspector y barra contextual** | Lo frecuente junto a la selección; el inspector deja de ser un formulario | Barra flotante de selección (color, texto, duplicar, conectar, eliminar, más). Inspector agrupado por tipo con divulgación progresiva. Control de color compacto. Multiselección: acciones en la barra. Copiar, pegar y duplicar con botón. Manual de atajos → Ayuda; Open Source → Ayuda | Toda propiedad editable sigue alcanzable (inventario contra el `index.html` actual); el panel no necesita scroll para lo frecuente; tests de propiedades verdes | Sí | Sí | No | Interacción + estructura |
| **018.17 — Canvas y selección** | El canvas deja de parecer un editor clásico | Chrome de selección (contorno, handles redondos de tamaño constante), punto de conexión por lado (desktop) en lugar de 4 flechas, rejilla de puntos, estado vacío accionable. Multiselección táctil (gesto según D7). **Fuente por defecto del diagrama solo si D4 lo aprueba** | Medición: tiempo y pasos para conectar 2 nodos sin regresión en desktop; multiselección táctil verificada en Chrome; documentos existentes idénticos si D4 = no tocar | Sí | Sí | No (`config.js` solo si D4) | Visual + interacción |
| **018.18 — Móvil** | Arquitectura móvil propia | Cabecera de una fila. Barra inferior (Insertar, Historias, selector de página). Sheets: inspector, insertar, páginas, Historias, ajustes. Barra contextual táctil. Present táctil (P2-5) | Las 12 tareas de §2.3 sin bloqueos a 375/390; canvas ≥70 % en edición; ningún control táctil < 44 px; tablet 768 en ambas orientaciones | Sí | Sí (táctil) | No | Estructural (responsive) |
| **018.19 — Historias, Playback y Present** | El modo Explicar/Presentar como experiencia propia | Storyboard en sheet (móvil) y panel (desktop) con el nuevo lenguaje; transporte de reproducción que despeja el canvas; asas y menús táctiles (P2-7); terminología (P2-8); Present táctil | Reproducir en móvil con el canvas visible; colocar un evento en móvil sin cerrar paneles a mano; tests 011–017 de Historias verdes | Sí | Sí | No | Interacción + visual |
| **018.20 — Viewer y Share** | Alinear la cara pública con el sistema | Cabecera de una fila, botones de 40–44 px, media queries, Historia también en Present del Viewer, diálogo de Share con el nuevo lenguaje (sin cambiar el flujo) | Viewer a 375 px con canvas ≥70 %; tests 014/016 y share verdes | Sí | Sí | No | Visual + interacción |

Notas:
- **018.12 y 018.13 son independientes** y podrían ir en paralelo. Se propone 018.12 primero por impacto inmediato.
- **018.15 puede adelantarse** a 018.14 si se prefiere quitar antes el `prompt` de renombrar.
- Cada slice termina con capturas en los 5 viewports de esta auditoría, para tener una referencia comparable.

---

## 12. Dependencias técnicas

- **`CACHE` en `sw.js`.** Todos los slices tocan assets servidos (`index.html`, `css/`, `js/`, `s/`) → un bump por slice (v69 → v70…). Los tests de caché (010-qa, 013, 014, 015) se actualizan en cada uno.
- **Acoplamiento de tests al DOM.** 50 archivos de test leen `index.html` o `styles.css`. Ids muy usados:
  - `#scRun` (24 archivos);
  - `#btnPresent` (17);
  - `#btnShare` (15);
  - `#tabScenarios` (12);
  - `#pagesBar` (7).
  - **Regla propuesta:** conservar ids y su semántica siempre que el elemento siga existiendo. Si un elemento desaparece (por ejemplo, `#tabScenarios` cuando Historias sea un modo), se actualizan los tests en el mismo slice con la misma intención, como se hizo en 018.10.
- **Diálogos nativos en tests.** Los browser tests aceptan `page.on("dialog")`. 018.15 debe migrarlos.
- **HiDPI.**
  - `render.js` (`resizeCanvas`, `render`).
  - Hit-testing: no cambia, porque las coordenadas siguen en px CSS.
  - Cuentagotas (`getImageData`): debe escalar.
  - Export: comprobar que usa sus propios canvas.
  - El Viewer comparte `resizeCanvas` (`viewer.js:101`).
- **Escala de handles.** `config.js` (`HANDLE`, `ARROW_OFF`, `ANCHOR_SNAP`) e `interaction.js` (radios de acierto) deben dividir por `viewZoom`.
- **Sin build ni dependencias.** Los iconos van como SVG inline o `<symbol>` en `index.html`. Sin webfonts de terceros (privacidad); una fuente autoalojada requiere decisión (D3) y precache.
- **`file://`.** No usar `fetch` de un sprite externo: inline.
- **Kernel MCP.** Ningún slice toca `model.js`. `test check:kernel` de `fluyo-mcp` no debería verse afectado; se verifica igualmente en los slices que toquen `js/`.
- **`editor-scenarios.js`** (2572 líneas) es el módulo con más riesgo de los slices 018.14, 018.18 y 018.19. Conviene leerlo por secciones y no reestructurarlo más allá de lo que pida el slice.

---

## 13. Criterios de éxito (para el rediseño completo)

- **Móvil (375 y 390):** las 12 tareas de §2.3 se completan sin teclado, sin doble clic y sin quedar atrapado. Canvas ≥70 % de la pantalla en edición. 0 controles táctiles < 44 px en el shell.
- **Desktop (1280 y 1440):** cabecera en una fila; canvas ≥80 %; Undo/Redo, zoom y encaje visibles.
- **Coherencia:** 0 emoji o dingbats en el chrome (test estático); 0 `confirm`/`alert`/`prompt` (test estático); un solo set de iconos; tokens usados en lugar de valores sueltos (comprobable con grep de colores hex fuera de `identity.css`).
- **Nitidez:** canvas renderizado a DPR del dispositivo (captura a `deviceScaleFactor:2`).
- **Sin regresiones:** `node --test test/*.test.cjs` en verde; browser tests en verde; documentos existentes se abren y se ven igual (salvo D4); export PNG/GIF/SVG con contenido idéntico; Share y Viewer compatibles con enlaces ya emitidos.
- **Rendimiento:** sin bajada perceptible de fps del render en móvil emulado tras HiDPI (medido en 018.13).

---

## 14. Decisiones que requieren tu aprobación

- **D1 · Orden.** ¿Empezar por **018.12 (desbloqueo táctil mínimo con el estilo actual)** antes del sistema visual? Recomendado: sí. Hoy hay bloqueos reales y el coste es pequeño, aunque parte se reestilizará después.
- **D2 · Historias como modo del shell** (sale de la pestaña del inspector). Afecta a `#tabScenarios` (12 tests). Recomendado: sí, en 018.14.
- **D3 · Tipografía de la UI.**
  - **(a)** pila de sistema neutra, sin coste ni impacto en privacidad;
  - **(b)** una fuente variable autoalojada con licencia abierta, que precachea el SW: más personalidad, unos KB más, y hay que registrarlo en `DECISIONS.md`.
  - Recomendado: empezar por (a) en 018.13 y decidir (b) con capturas delante.
- **D4 · Fuente por defecto del diagrama** (hoy Georgia).
  - Cambiarla moderniza mucho, pero **altera el aspecto de documentos existentes** que no fijan fuente, y de enlaces `#d=` ya compartidos.
  - Opciones:
    - (a) no tocar;
    - (b) nuevo default solo para documentos nuevos (requiere guardar la fuente global explícita al crear; toca la carga y la compatibilidad);
    - (c) cambiar el default para todos.
  - Recomendado: (a) por ahora, revisar en 018.17.
- **D5 · Conectar.** ¿Sustituir las 4 flechas azules por un punto de conexión por lado (desktop) y una acción «Conectar» (táctil)? Recomendado: sí, midiendo antes y después.
- **D6 · Animación ambiental.** ¿Mover «Pausa/Play» de la cabecera a Ajustes del lienzo (o a un interruptor discreto) y reservar «Reproducir» para Historias? Recomendado: sí.
- **D7 · Multiselección táctil.**
  - **(a)** modo «Seleccionar varios» explícito en la barra contextual;
  - **(b)** pulsación larga + arrastre como marco;
  - **(c)** ambos.
  - Recomendado: (a) primero; es descubrible y no choca con el pan. (b) se valida después.
- **D8 · Enlaces del sitio y Open Source.** ¿Sacarlos del editor (barra inferior y panel) a un menú Ayuda? Recomendado: sí; verificar que `docs/` y `ejemplos/` siguen enlazados en páginas rastreables.
- **D9 · «Ejemplo».** ¿Abrirlo en una página nueva en vez de sustituir la actual? Recomendado: sí. Hoy se pierde trabajo en táctil.
- **D10 · Referencias externas en un repo público.** Este documento cita draw.io y una dirección estética de referencia solo como descripción de patrones. ¿Se conservan así, o prefieres describir la dirección visual sin nombres de terceros en los slices siguientes?

---

## Archivos modificados

- `.ai/tasks/FLUYO-018.11.md` — creado (este documento). **Ningún otro archivo del repositorio se creó ni modificó.**

## Pruebas

- Exploratorias de solo lectura en Chrome real sobre una copia temporal fuera del repo (§2.3). Las capturas y los scripts quedaron fuera del repo (scratchpad de la sesión, no versionado).
- No se ejecutaron los tests del repo: no hay cambios de código que verificar.

## Pendientes / riesgos

- La causa exacta de los fallos de mover y conectar a zoom 0,20–0,27 en la primera pasada automática no se aisló. A zoom 0,5 funcionan. Se recomienda verificarlo en 018.12 con dispositivo o emulación táctil y el Ejemplo encajado.
- El renderizado borroso por DPR se deduce del código (`resizeCanvas`). Las capturas de esta auditoría se tomaron a DPR 1; 018.13 debe incluir una captura a DPR 2 como prueba de antes y después.
- Posible bug fuera de alcance: `escapeHtml` + `textContent` en el registro de detalles de Historias (§8 P3).

## Handoff

### Estado actual

Auditoría completa y plan propuesto. Sin cambios de producto, sin commit, sin push, sin deploy.

### Próximo paso concreto

Revisar §14 (D1–D10). Con D1 aprobada, crear `.ai/tasks/FLUYO-018.12.md` (desbloqueo táctil) con el alcance de la fila 018.12 de §11.

---

# FLUYO-018.11 — READY FOR REVIEW

- **Archivos modificados:** solo `.ai/tasks/FLUYO-018.11.md` (nuevo).
- **Confirmación:** no se modificó código, CSS, HTML, JS, SW, tests ni assets. No hubo commit, push ni deploy.
- **Pruebas exploratorias:** Chrome real, Playwright, copia temporal fuera del repo. Viewports 1440, 1280, 768 (táctil), 390 (táctil) y 375 (táctil). 12 tareas por viewport más el Viewer, y una pasada de depuración táctil a 390 px. Lectura dirigida del código de interacción, Historias, Share y Viewer.
- **Conclusiones principales:**
  1. En móvil hay bloqueos reales: panel sin salida a 390 px, sin Undo/Redo, sin renombrar páginas, Historias tapa la reproducción, cabecera de 155–192 px.
  2. La sensación de herramienta antigua viene del chrome, no del canvas: cabecera plana, emoji como iconos, Georgia, inspector-formulario, flechas de conexión clásicas, diálogos nativos y canvas sin HiDPI.
  3. El núcleo (canvas, modelo, Historias, Share, Viewer) se conserva. Ningún slice necesita tocar `model.js`.
  4. El plan son 9 slices aislados con `CACHE` y Chrome QA en cada uno; empieza por un desbloqueo táctil mínimo.
- **Decisiones que necesito de ti:** D1–D10 (§14). Las más urgentes:
  - D1 (empezar por 018.12);
  - D3 y D4 (tipografía de UI y del diagrama);
  - D7 (gesto de multiselección táctil).
