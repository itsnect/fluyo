# FLUYO-018.12 — Base de UX táctil y móvil

Estado: **IMPLEMENTADO — READY FOR REVIEW** (ver el final). Sin commit, push ni deploy.
Fecha: 8 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `604b344` (018.10 desplegado) + `.ai/tasks/FLUYO-018.11.md` (auditoría, aún sin commit).
> Decisiones de producto D1–D10 de 018.11, aprobadas por el responsable.
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 116), `FLUYO-018.11`, `FLUYO-018.10`; el código de selección, lienzo, cabecera, páginas, Historias y Playback; los browser tests existentes y sus arneses de vm.

## 1. Problema

018.11 encontró que en móvil había bloqueos reales:
- **P0-1** el panel tapaba su único botón de cierre;
- **P0-2** no había Deshacer/Rehacer sin teclado;
- **P0-3** no había una vía visible para renombrar páginas;
- **P0-4** Historias tapaba el lienzo, incluso mientras se reproducía;
- **P0-5** la cabecera ocupaba 155–192 px en 4–5 filas.

Además:
- multiselección imposible con el dedo;
- conectar dependía de flechas de 22 px;
- el lienzo se veía borroso en pantallas de alta densidad;
- «Ejemplo» vaciaba la página activa.

Objetivo del slice: que Fluyo sea **utilizable con el dedo a 390/375 px sin romper el escritorio**, sin rediseñar todavía el lenguaje visual.

## 2. Arquitectura actual (antes de este slice)

| Comportamiento | Dónde | Problema táctil |
|---|---|---|
| Selección | `selection.js` + `interaction.js` | Multiselección solo con Shift o marco de ratón |
| Mover | `interaction.js` (`drag`) | Funcionaba, pero `pushUndo` en `pointerdown`: un toque apilaba una entrada vacía y vaciaba Rehacer |
| Conectar | `interaction.js` (`connectDrag`, modo Flecha) | Flechas de 22 px; el modo Flecha estaba escondido |
| Zoom/pan | `interaction.js` | Funcionaba (un dedo, pellizco) |
| Doble clic | `interaction.js`, `ui.js` | Renombrar página = doble clic + `prompt()` |
| Undo/Redo | `selection.js` | Solo teclado |
| Panel | `ui.js` + CSS ≤700 px | Cajón de altura completa por encima de ⚙, sin otra salida |
| Historias/Playback | `editor-scenarios.js` | El cajón tapaba la reproducción y la colocación |
| Cabecera | `index.html` + `flex-wrap` | 4–5 filas en móvil y 2 en 768 |
| Lienzo | `render.js` `resizeCanvas` | Respaldo = px CSS (borroso a densidad 2–3) |

## 3. Cambios propuestos

El plan se escribió en esta tarea antes de tocar código; queda resumido aquí. Son los once puntos de §4, en el mismo orden. Se cumplieron todos y se añadieron dos que salieron de la QA real: revelar lo tapado por la hoja y la tableta táctil a 40 px.

## 4. Cambios implementados

1. **Superficies del panel** (`ui.js`: `openSurface`/`closeSurface`/`toggleSurface`, `revealAboveSheet`).
   - En escritorio, la superficie es la pestaña.
   - A ≤700 px es una hoja inferior entre la cabecera y la barra de páginas, con botón de cerrar propio. ⚙ e Historias la abren, cambian de superficie o la cierran.
   - Durante el Playback se compacta (`body.scPlaybackOn`); durante la colocación de un evento se aparta (`body.scPlacing`).
   - Al abrirla, si la selección o el diagrama quedaban debajo, la vista se desplaza para mostrarlos. Solo si hace falta, y con la selección sin cambiar el zoom.
2. **Cabecera por reubicación** (`placeChrome`). Los mismos nodos y los mismos ids cambian de padre según `matchMedia`:
   - **>1100 px:** como antes, con `order` CSS.
   - **≤1100 px:** Ejemplo, Limpiar, tema, tipografía, cuadrícula, ajustar, fondo, Guardar y Abrir pasan al menú «Más».
   - **≤700 px:** además, Exportar pasa al menú y Presentar a la barra inferior.
   - Pausa/Play de la animación ambiental pasa a la sección **Animación** del panel (D6).
   - A 1440 px se mantiene una sola fila: gap de 6 px en lugar de 8; holgura de 32 px, frente a 34 en HEAD.
3. **Menú «Más»** (`#moreMenu`, D8): Docs, Ejemplos, Privacidad, Soporte, GitHub y MCP. La barra inferior y el panel ya no llevan enlaces. Se cierra al tocar fuera, con Escape, con su botón o al usar una acción.
4. **Deshacer/Rehacer** (`#btnUndo`, `#btnRedo`) en la cabecera, en todas las anchuras.
   - Se sincronizan desde el bucle del editor.
   - Se apagan con la pila vacía, en Playback y en Present.
   - **Arrastrar apila Undo en el primer movimiento real** (`drag.snap`); un clic o toque sin mover ya no apila nada.
5. **Barra táctil** (`#touchBar`):
   - «Conectar»: el origen es el seleccionado; tocar el destino crea origen → destino; «Cancelar» o Escape cierran el modo.
   - «Seleccionar varios»: cada toque suma o quita; tocar el vacío no vacía; «Todo» y «Listo»; arrastrar un seleccionado mueve el grupo.
   - Visible con puntero táctil y selección, o con un modo abierto. Nunca en Playback ni en Present.
6. **Páginas en táctil**: la pestaña activa lleva un ▾ (solo con puntero táctil). Tocar el ▾ o la pestaña activa abre el menú de la página: «Renombrar…» con campo en línea y error explicado, sin `prompt()`, y «Eliminar página» con la confirmación de siempre. Con el dedo se ignora el `dblclick` sintético; con ratón, el doble clic sigue igual.
7. **Handles táctiles**: con dedo, el radio de acierto de esquinas y codos pasa a ~22 px de pantalla. La esquina se acota a 1/3 del lado del nodo. Sin cambio visual.
8. **Lienzo HiDPI** (`canvasDpr`/`resizeCanvas`): respaldo = caja × densidad (tope 2) y una escala en `render()`. Editor y Viewer; coordenadas en px CSS.
9. **Ejemplo** (D9): página nueva («Ejemplo», «Ejemplo 2»…), fuera de Undo como «＋».
10. **Puntero grueso** (tabletas, móviles): controles de cabecera ≥40 px, pestañas ≥38 px, «＋» y pestañas del panel a 40 px.
11. **Textos**: la ayuda del panel y `docs/index.html` describen la barra táctil, la hoja, Deshacer/Rehacer, el menú de la página y Ejemplo. `#scNotice` y la barra de colocación se recolocan en móvil (antes asumían el rail lateral).

## 5. Decisiones

- Registradas en `.ai/DECISIONS.md` 117–122:
  - superficies y hoja;
  - cabecera por reubicación, Pausa y enlaces;
  - Undo visible y diferido;
  - modos táctiles;
  - densidad con tope 2;
  - Ejemplo en página nueva.
- Arquitectura en `.ai/ARCHITECTURE.md` § «Base táctil y móvil (FLUYO-018.12)».
- **Multiselección táctil (D7):** se evaluaron cuatro opciones.
  - **Toque:** ya selecciona uno solo.
  - **Pulsación larga:** no es descubrible, choca con el arrastre de un nodo y no tiene infraestructura.
  - **Marco con un dedo:** choca con el pan; la infraestructura de marco existe, pero solo para ratón.
  - **Modo explícito** («Seleccionar varios»): se eligió este; es descubrible, reversible («Listo»), coherente con «Conectar» y fácil de probar.
- **Conexión táctil (D5):** reutiliza la semántica del modo Flecha (`newEdge(origen, destino)`). Las flechas azules siguen dibujándose; su rediseño es de 018.17.
- **Pausa (D6):** no desaparece; pasa a Animación, porque es un ajuste del lienzo y no reproducción. Espacio sigue alternándola.

## 6. Mobile UX (390 y 375 px)

- **Cabecera:** una fila de 53 px. Contiene logo, Deshacer, Rehacer, Compartir, ⚙ (Propiedades) y ⋯ (Más). Todo de 40 px.
- **Barra inferior:** 52 px. Pestañas de página (▾ y ✕ tocables) y «＋» a la izquierda; Historias y Presentar a la derecha.
- **Menú «Más»:** Ejemplo, Limpiar página, tema, tipografía, cuadrícula, ajustar, fondo, Guardar, Abrir, Exportar y los enlaces del proyecto.
- **Lienzo:** 694 px de alto a 390×844 (antes 604) y 517 px a 375×667 (antes 391).
- **Hoja:** entre cabecera y barra inferior, de `clamp(260px, 52dvh, 560px)`. Al reproducir baja a `clamp(150px, 30dvh, 280px)`; al colocar un evento se oculta.
- **No hay estados sin salida:**
  - la hoja se cierra con «Cerrar», con ⚙ o con Historias;
  - los menús, al tocar fuera;
  - los modos táctiles, con «Cancelar»/«Listo»;
  - la colocación, con «Cancelar».

## 7. Interacciones táctiles

| Tarea | Gesto |
|---|---|
| Pan | un dedo en el vacío |
| Zoom | pellizco |
| Seleccionar | toque |
| Mover | arrastrar el nodo |
| Varios | barra → «Seleccionar varios» → toques → «Listo» |
| Conectar | seleccionar origen → «Conectar» → tocar destino |
| Cancelar conexión | «Cancelar» (también Escape) |
| Propiedades | ⚙ / «Cerrar» |
| Página | tocar pestaña; «＋»; pestaña activa o ▾ → Renombrar / Eliminar |
| Deshacer / Rehacer | botones de la cabecera |
| Historias | barra inferior → hoja; Reproducir / Detener; elegir evento → tocar destino |
| Borrar | papelera (existente) |

## 8. Lienzo y densidad de píxeles

- `resizeCanvas(canvas, container)` fija el respaldo a `round(caja × dpr)`, con `dpr = min(2, devicePixelRatio)`, y anota `canvas.fluyoDpr`.
- `render()` limpia el respaldo entero y aplica `scale(dpr)` una vez, antes de `translate/scale` de la vista. `viewport.width/height` siguen en px CSS (`editor-runtime.js`, `viewer.js`).
- Sin cambios en gestos, textarea, cuentagotas (API nativa) ni exportación (lienzos propios con su escala).
- Verificado a densidad 1 (toda la batería) y a densidad 2 (390 táctil y 1440):
  - el respaldo mide el doble;
  - el borde del nodo cae en su coordenada × 2;
  - tocar y arrastrar apuntan al nodo correcto;
  - el textarea queda sobre el nodo;
  - el Viewer mide el doble.

## 9. Historias

- No se rediseñan.
- Se separan conceptualmente: la superficie «stories» tiene su puerta (`openSurface("stories")`) y su botón propio en móvil.
- La reproducción sale de la cabecera (Pausa pasa al panel). Reproducir, Detener y Volver a editar siguen en la superficie de Historias.
- En móvil:
  - la hoja se compacta al reproducir y el diagrama se trae a la vista si quedaba debajo;
  - colocar un evento aparta la hoja hasta tocar el destino o cancelar.
- Escritorio sin cambios.

## 10. Ejemplo

`createPageIn(doc, "Ejemplo"|"Ejemplo N")` + `doc.cur` + el mismo funnel de siempre. La página que había no cambia ni un byte (test vm y Chrome). Fuera de Undo, como «＋».

## 11. Tests

- **Unit/dominio:** `node --test test/*.test.cjs` → **1016/1016**: los 1010 previos más 6 nuevos de `test/fluyo-018-12.test.cjs`. `node test/editor-runtime.cjs` y `node test/render-boundary-run.cjs` en verde. `node --check` de `js/*.js`, `sw.js` y `test/*.cjs`: OK.
- **`test/fluyo-018-12.test.cjs`** (6):
  - precache de todo lo que cargan `index.html` y `s/index.html`;
  - ids de HEAD conservados (solo se retira `#ossSection`);
  - cabecera sin reproducción, enlaces en «Más» y Pausa en Animación;
  - `renderTabs` en vm (▾ y doble clic solo con ratón);
  - densidad en vm (1, 2 y tope con 3; orden de operaciones);
  - Ejemplo con el editor completo de 018.8.
- **`test/fluyo-018-12-browser.cjs`** (Chrome real) — **278 ✔ · 0 ✘**. Recorre los 16 flujos pedidos en 390 y 375 (táctil, `isMobile`), 768 (táctil) y 1280/1440 (ratón): resultado en el documento y el DOM, captura y 0 errores de consola. Además:
  - **Escritorio contra HEAD** (1280 y 1440), la misma secuencia con ratón y teclado:
    - mover;
    - conectar con flecha y con modo Flecha;
    - marco + Shift+clic;
    - rueda y Ctrl+rueda;
    - ＋, cambiar y renombrar página con doble clic;
    - Ctrl+Z y Ctrl+Y.

    El documento queda idéntico, con la misma selección, vista y diálogos. Las dos diferencias intencionales se afirman explícitamente: el clic sin mover ya no apila Undo y Ejemplo añade página.
  - **Móvil contra HEAD** (390, documentado):
    - el cajón tapaba a ⚙;
    - no había Deshacer;
    - renombrar solo con doble clic + `prompt`;
    - Ejemplo vaciaba la página;
    - la cabecera medía 155 px.
  - **Densidad 2** en editor y Viewer (§8).
- **`test/fluyo-018-12-mutations.cjs`** — **18/18 detectadas**. 8 mutaciones estáticas/vm (U1–U8) y 10 en Chrome sobre el recorrido de 375 (B1–B10):
  - la hoja vuelve a tapar ⚙;
  - la hoja sin «Cerrar»;
  - un toque vuelve a apilar Undo;
  - «Conectar» invierte la dirección;
  - el vacío vacía la multiselección;
  - Deshacer sin sincronizar;
  - la hoja no se compacta;
  - la hoja no se aparta al colocar;
  - no se revela lo tapado;
  - el menú no renombra.
- **Batería de Chrome existente** (23 suites): **22 en verde**.
  - `fluyo-011-browser` falla igual en HEAD (§14).
  - **`fluyo-018-4-browser` se adaptó.** Su caso «undo ×2 idéntico a HEAD» encadenaba clic en una conexión, Supr, clic en un nodo y Supr, y luego dos Ctrl+Z. En HEAD, el clic en el nodo apilaba una entrada vacía, así que esos dos Ctrl+Z deshacían un solo borrado. Ahora el test afirma el resultado correcto (dos Ctrl+Z vuelven al documento de partida) y deja constancia de la diferencia con HEAD (decisión 119). El resto de sus comparaciones con HEAD no cambia.
  - `fluyo-018-7c`, `016`, `018-5`, `018-7d` y `018-8` se repitieron tras el último cambio de la barra de páginas: en verde.
- **Tests actualizados** (misma intención): `fluyo-018-4-browser` (ver arriba) y, por la nueva versión de caché, `fluyo-010-qa`, `013`, `014`, `015`, `018-10` (test, browser y la mutación M8): v69 → v70.

## 12. CACHE

- **Cambian** (todos servidos y precacheados):
  - `index.html`;
  - `css/styles.css`;
  - `js/ui.js`, `js/interaction.js`, `js/render.js`, `js/editor-runtime.js`, `js/editor-scenarios.js`, `js/export.js`, `js/viewer.js`;
  - `docs/index.html` (precache de páginas);
  - `sw.js`.
- `CACHE` `fluyo-static-v69` → **`fluyo-static-v70`**.
- Sin archivos nuevos servidos; ningún asset de `index.html` ni de `s/index.html` sale del precache (test estático).
- No cambian `model.js` ni `config.js`, así que el kernel de fluyo-mcp no se ve afectado.

## 13. Desviaciones

- **Escritorio:**
  - el hueco entre controles de la cabecera pasa de 8 a 6 px a >1100 px, para que Deshacer, Rehacer y «Más» quepan en una fila a 1440, como antes;
  - a 1366 y 1280 la cabecera sigue en dos filas, como en HEAD (89 frente a 91 px); arreglarlo es de 018.14 (shell);
  - entre 1101 y 1279 px se mantiene la cabecera de escritorio.
- **Tableta (701–1100 px):** cabecera compacta (Deshacer/Rehacer · Presentar · Compartir · Exportar · Más) y panel lateral como antes. Historias se abre por su pestaña; no hay botón Historias, porque la columna está siempre visible.
- **Un clic o toque sin mover ya no apila Undo.** Es una corrección intencional, también en escritorio, y el documento resultante es idéntico al de HEAD.
- **Corrección a 018.11 P0-3:** allí se afirmó que renombrar con el dedo era imposible. Con toques sintéticos de CDP no hay `dblclick`, pero con toques de Playwright (más parecidos a los reales) dos toques rápidos sí lo sintetizan y abren el `prompt`. Era una vía invisible, no inexistente. Ahora hay una explícita y el `dblclick` sintético se ignora con el dedo, porque abría a la vez el menú y el `prompt`.
- Los textos de la ayuda del panel y de `docs/` se actualizaron porque describían el comportamiento retirado. El panel en sí no se rediseña.

## 14. Pendientes

- **`test/fluyo-011-browser.cjs` falla igual en HEAD** (4 fallos: etiquetas de menú de Historias renombradas en 012/016 y un upgrade del SW fijado en «v45 → v61»). Está desactualizado desde antes de este slice. Se propuso una tarea aparte para ponerlo al día.
- Diálogos nativos (`confirm` al borrar o limpiar) y rediseño visual de la barra táctil, la hoja y los menús: 018.13 (sistema visual) y 018.15 (diálogos).
- Las flechas azules de conexión siguen dibujándose también con el dedo (D5 pide reducirlas): 018.17.
- Present táctil (un toque avanza y corta la Historia): 018.19.
- Viewer móvil (cabecera en dos filas, botones de 33 px): 018.20. Este slice solo le da densidad 2.
- Verificación en dispositivo físico (iOS Safari y Android Chrome). Aquí todo es Chrome real con táctil emulado.

## Handoff

### Estado actual

Implementado y verificado (§11). Sin commit, push ni deploy.

### Próximo paso concreto

Revisión del responsable. Con OK: commit de 018.11 + 018.12 y deploy (`CACHE` v70); después, crear `.ai/tasks/FLUYO-018.13.md` (sistema visual base).

---

# FLUYO-018.12 — READY FOR REVIEW

- **Archivos modificados** (sin commit):
  - **Producto (servido):**
    - `index.html`;
    - `css/styles.css`;
    - `js/ui.js`, `js/interaction.js`, `js/render.js`, `js/editor-runtime.js`, `js/editor-scenarios.js`, `js/export.js`, `js/viewer.js`;
    - `docs/index.html`;
    - `sw.js`.
  - **Tests nuevos:** `test/fluyo-018-12.test.cjs`, `test/fluyo-018-12-browser.cjs`, `test/fluyo-018-12-mutations.cjs`.
  - **Tests actualizados:**
    - `test/fluyo-018-4-browser.cjs` (undo ×2, decisión 119);
    - los que fijan `CACHE` (`fluyo-010-qa`, `013`, `014`, `015`, `018-10` test/browser/mutaciones).
  - **Documentación:** `.ai/DECISIONS.md` (117–122), `.ai/ARCHITECTURE.md`, `.ai/tasks/FLUYO-018.12.md`. Además, `.ai/tasks/FLUYO-018.11.md` del slice anterior, también sin commit.
- **Tests:**
  - `node --test test/*.test.cjs` **1016/1016**;
  - `editor-runtime.cjs` y `render-boundary-run.cjs` OK;
  - `node --check` OK.
- **Browser QA (Chrome real):**
  - `fluyo-018-12-browser.cjs` **278 ✔ · 0 ✘**: 390/375/768 táctil y 1280/1440 ratón, 16 flujos, 0 errores de consola;
  - escritorio idéntico a HEAD;
  - diferencias móviles frente a HEAD documentadas;
  - densidad 2 en editor y Viewer;
  - mutaciones **18/18**;
  - batería existente 22/23 (`fluyo-011-browser` ya fallaba en HEAD).
- **Capturas** (fuera del repo, en el scratchpad de la sesión): las de cada flujo y viewport, más la comparativa antes/después a 375 px.
- **CACHE:** `fluyo-static-v69` → `fluyo-static-v70`. Sin archivos servidos nuevos; todo `index.html` y `s/index.html` sigue precacheado (test).
- **Riesgos:**
  - cambio de comportamiento intencional en escritorio: un clic sin mover ya no apila Undo;
  - el lienzo a densidad 2 multiplica por 4 los píxeles pintados (tope 2);
  - todo lo táctil está verificado con emulación de Chrome, no en un dispositivo físico;
  - la barra táctil, la hoja y los menús usan el estilo actual (aún sin sistema visual).
- **Pendientes:**
  - §14;
  - tarea aparte propuesta para poner al día `fluyo-011-browser`.
