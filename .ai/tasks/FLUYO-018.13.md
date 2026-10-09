# FLUYO-018.13 — Base visual

Estado: **IMPLEMENTADO — READY FOR REVIEW** (ver el final). Sin commit, push ni deploy.
Fecha: 8 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `604b344` (HEAD, 018.10 desplegado) + 018.11 y 018.12 (sin commit).
> Fuentes leídas: `AGENTS.md`, `.ai/tasks/FLUYO-018.12.md`, `.ai/DECISIONS.md` (117–122), `.ai/ARCHITECTURE.md` (§ Testing y § 018.12), `CONTRIBUTING.md` (mapa), `index.html`, `css/*.css`, `js/ui.js`, y los tramos de `render.js`, `interaction.js`, `editor-runtime.js` y los tests que tocan la cabecera, el panel y las páginas.

## Objetivo

Establecer la dirección visual de Fluyo y aplicarla al chrome del editor: cabecera, menú «Más», panel de propiedades, páginas, relación chrome/lienzo y una primera capa de los estados de los nodos.

La referencia es solo de gramática visual: calma técnica, editorial, materia digital, claridad funcional. Sin marca ajena dentro de Fluyo.

No es un rediseño de la UX: las capacidades e interacciones de 018.12 se conservan.

## Decisiones del responsable (antes de implementar)

- **Fuentes:** locales en el repo (woff2, solo los pesos necesarios, español completo, licencia incluida), precacheadas, cero peticiones externas.
- **Lienzo:** no se toca `model.js` ni el `theme: "dark"` persistido. Chrome crema/editorial y lienzo como superficie de trabajo con el tema del documento, integrados por marco, filetes, aire, controles y acentos; no cambiando su fondo.
- Sin branding NECT visible.

## 1. Auditoría visual (HEAD · 018.12 · North Star)

Capturas de HEAD y de 018.12 en 1440, 1280, 1024, 768, 390 y 375 (fixture «Cliente → Kafka → Comercio»: selección, «Más», Historias). Hallazgos:

| Área | HEAD / 018.12 | North Star |
|---|---|---|
| Superficie | Gris casi negro (`#111213`/`#1b1d1f`) en todo el chrome; el lienzo oscuro y el chrome son la misma masa | Papel hueso con tinta; el lienzo, contenido |
| Tipografía | Segoe UI para todo, Georgia solo en la marca | Serif editorial para significado, mono para controles y datos |
| Cabecera | Toolbar de 17 controles iguales; a 1280 parte en dos filas (Exportar abajo) | Barra de instrumento agrupada |
| Iconos | Emoji (💾 📂 🎯), glifos (▶ ⬇ ⏸ ⬆ ＋ ✕ ▾) y SVG mezclados | Un trazo |
| Acento | Naranja `#d08b5b` para todo: activo, primario, pestaña, rail | Oliva = activo, terracota = acción |
| Selección en lienzo | Azul `#3aa7e8` discontinuo, que se confunde con los nodos azules | Estado calmado y del sistema |
| «Más» | Columna de botones y selects de formulario | Menú con secciones |
| Panel | Inspector de formulario: etiquetas Segoe, `select` nativos, casillas nativas, 200 muestras, una pared de texto de ayuda | Instrumento de edición |
| Páginas | Pestañas de navegador (borde superior redondeado) | Integradas, con índice y nombre editorial |
| Duplicaciones | 3 definiciones de «toggled», colores de estado sueltos (`#e08585`, `#7bb85b`, `#e5706a`), estilos inline en la cabecera, patrón de muestra repetido en `ui.js` | Pocos tokens |

## 2. Qué cambió

1. **Sistema visual** — `css/system.css` (nuevo):
   - `@font-face` locales;
   - primitivas `--c-*` y tokens semánticos;
   - componentes: botones (secundario, `.btnGhost`, `.primary`, `.iconBtn`, `.danger`), campos, interruptores, deslizador, color, `.tabs`, `.badge`, menús (`.menu`, `.menuSection`, `.menuKicker`, `.menuItem`), `[data-tip]`, `kbd` y material `.inverse`.

   Los nombres de `identity.css` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`…) se redefinen sobre los tokens. Así Historias, los diálogos y el Present pasan al sistema sin reescribirse.
2. **Tipografías** — `assets/fonts/`: Playfair Display 400 e IBM Plex Mono 400/500, woff2 del subset latin (~51 KB en total; Playfair 600 se descargó y se retiró al comprobar que ningún estilo lo usa), con sus licencias OFL. La mono se precarga.
3. **Cabecera** — una barra de instrumento: marca · historial | Documento (Ejemplo, Limpiar) ··· Lienzo (tema, tipografía, cuadrícula, rejilla, fondo) | Abrir · Guardar | Presentar · Compartir · **Exportar** · Más.
   - Los grupos se separan con filetes.
   - Cuadrícula y rejilla son interruptores con icono.
   - Abrir y Guardar son iconos con tooltip.
   - Una sola fila de 320 a 1440 px (en HEAD y 018.12, dos filas a 1280).
   - Entre 1101 y 1279 px, Ejemplo, Limpiar y Presentar quedan en icono.
   - Mismos ids y misma reubicación de 018.12 (`placeChrome` sin cambios).
4. **Menú «Más»** — superficie de menú:
   - secciones con rótulo (Documento, Lienzo, Fluyo), filetes e ítems de 36 px (40 con dedo);
   - interruptores para cuadrícula y rejilla;
   - «Limpiar página» al final de Documento y en terracota;
   - enlaces del proyecto en dos columnas con icono, y los repos con metadato y ↗.
5. **Panel de propiedades** — título serif por sección y metadato de la selección (`Caja · id 3`, `Conexión · 1 → 2`, `3 elementos`).
   - Grupos con rótulo mono y filete: Forma y color, Código, Capas y aparición; Recorrido, Flujo y Trazo en conexiones.
   - Etiquetas mono, campos con foco oliva y casillas como interruptores.
   - Muestras de 18 px en rejilla, seleccionadas con anillo de tinta.
   - Capas, cuentagotas y Eliminar con icono; Eliminar en terracota con su `kbd`.
   - La ayuda sin selección pasa de muro de texto a título y lista corta.
6. **Páginas** — nombre en serif, índice mono (`01`, `02`…) con contador CSS, activa levantada con índice oliva; ✕, ▾ y ＋ con el trazo del sistema (máscaras CSS: el glifo sigue en el DOM).
   - En la misma barra (solo >700 px): controles de vista (− · lectura % · + · encajar).
7. **Lienzo** — superficie enmarcada en el chrome: 8 px de aire, filete de tinta, radio de 8 px y una sombra interior mínima. A ≤700 px va a sangre.
   - El fondo y la cuadrícula siguen siendo los del tema del documento.
8. **Nodos (primera capa, solo editor)** — las marcas del editor pasan del azul al color activo por tema (`editorMark`, `render.js`).
   - Afecta a la selección (marco continuo y fino), los tiradores rellenos con el fondo real, los extremos y tramos de una conexión, el marco de selección, la vista previa de conexión y las flechas de los lados.
   - El hint del lienzo vacío pasa a Playfair.
9. **Barra táctil, papelera, cajones y modales** — piezas levantadas con sombra flotante.
   - La barra táctil lleva iconos; «Listo» es primario.
   - La papelera usa terracota.
   - Los modales son papel con título serif y su ancho está acotado.
10. **Present** — el mando y el rótulo usan el material inverso (tinta con texto hueso).
11. **Textos** — la ayuda del panel y `docs/` ya no hablan de «flechas azules» ni de «barras azules».

## 3. Qué no cambió

- `model.js`, `config.js` e `identity.css`: idénticos a HEAD (test). El kernel de fluyo-mcp no se ve afectado.
- Formato del documento, `theme: "dark"` por defecto, tipografía de los diagramas (`FONTS`/`DEFAULT_FONT`, sigue Georgia), geometría, ids, shapes y conexiones.
- **El dibujo del diagrama**: radio de 10, trazo de 2,5, rellenos y texto de los nodos. Lo comparten lienzo, SVG exportado y Viewer. Cambiarlo solo en el lienzo rompería la paridad con el SVG, y en los tres sería cambiar la apariencia persistida. La «primera capa» de los nodos se limita a lo que dibuja solo el editor.
- Interacciones de 018.12: superficies, hoja, `placeChrome`, modos táctiles, Undo diferido, menú de página, DPR, Ejemplo.
- Viewer (`/s/`), páginas estáticas (salvo dos frases de `docs/`), UI interna de Historias (solo hereda tokens y la serif en el título de la historia), Present (salvo el material del mando), resaltado de Historias y tokens de Playback en el lienzo.

## 4. Decisiones visuales

Registradas en `.ai/DECISIONS.md` 123–127. En corto:

- **Voces:** serif para significado (marca, títulos de sección, nombre de la historia, nombres de página, títulos de modales); mono para todo lo operable y para los datos.
- **Color con intención:**
  - tinta para estructura y texto;
  - hueso para la superficie;
  - oliva para lo activo (herramienta, interruptor, pestaña, selección, índice de página);
  - terracota para la acción importante y lo destructivo (Exportar, Crear evento, Reproducir, Limpiar, Eliminar);
  - grafito para lo secundario (contraste 5,2:1 sobre hueso).
- **Jerarquía de botones:** tres niveles y nada más. Fantasma en la cabecera y en las barras, secundario con borde para Compartir y los controles del panel, primario terracota (uno por zona).
- **Separación por filetes y aire, no por cajas:** grupos de la cabecera, secciones del panel y secciones del menú.
- **Lienzo como pantalla dentro del instrumento:** marco de tinta y aire en escritorio; a sangre en móvil, donde cada píxel es lienzo.
- **Selección calmada:** marco fino y continuo (antes, discontinuo azul).

## 5. Tokens y componentes

- **Primitivas:** `--c-hueso` `#F2EDE3`, `--c-hueso-claro`, `--c-hueso-hondo`, `--c-arena`, `--c-tinta` `#16150F`, `--c-tinta-2`, `--c-grafito`, `--c-piedra`, `--c-oliva` `#4E5A3F`, `--c-oliva-hondo`, `--c-oliva-palido`, `--c-terracota` `#A33A22`, `--c-terracota-hondo`.
- **Semánticos:**
  - superficies e intervalos: `--surface`, `--surface-raised`, `--surface-sunken`, `--surface-inverse`, `--surface-hover`;
  - tinta: `--ink`, `--ink-2`, `--ink-3`, `--ink-off`;
  - filetes: `--rule`, `--rule-2`, `--rule-ink`, `--rule-hover`;
  - estados: `--active`, `--active-veil`, `--attention`, `--attention-hover`, `--attention-veil`, `--hover-veil`, `--press-veil`, `--focus`.
- **Voces:** `--font-serif`, `--font-mono`, `--fs-micro` 10, `--fs-label` 11, `--fs-ui` 12, `--fs-body` 12,5, `--fs-title` 16, `--fs-display` 21, `--track-micro`.
- **Proporción:** `--r-xs/sm/md/lg/pill`, `--ctl-h` (30 px; 40 px con `pointer:coarse`), `--ctl-h-touch`, `--ctl-pad`, `--ic`, `--ic-stroke`, `--hdr-h`, `--s-1…5`, `--frame-inset`.
- **Profundidad:** `--shadow-menu`, `--shadow-float`, `--shadow-frame`.
- **Iconos como máscara:** `--mask-x`, `--mask-plus`, `--mask-chevron`. **Muestras especiales:** `--sw-a`, `--sw-b`.
- **Componentes:** `button` (secundario), `.btnGhost`, `.primary`, `.toggled`/`[aria-pressed]`, `.danger`, `.iconBtn`, `.ctl` (control dimensionado), campos, `.switch`, `input[type=range]`, `input[type=color]`, `.tabs`, `.badge` (`.active`, `.attention`), `.menu`/`.menuSection`/`.menuKicker`/`.menuItem` (también `.scPopover`, `.moreMenu`), `[data-tip]` (+ `data-tip-pos="up|end|start"`), `kbd`, `.inverse`, `.kicker`, `.meta`, `.srOnly`, `.vdivider`, `.ic`.
- **Sprite:** 37 símbolos `#i-*` en `index.html`.

## 6. Antes / después

Capturas en el scratchpad de la sesión, fuera del repo, como en 018.12: `shots/` (HEAD, 018.12 y 018.13 por viewport y estado), `t1813/` (las del browser test) y `compare/` (018.12 | 018.13 lado a lado en 1440, 1280, 768, 390 y 375: selección y «Más»).

| Medida | 018.12 | 018.13 |
|---|---|---|
| Cabecera a 1440 | 1 fila, 49 px | 1 fila, 50 px |
| Cabecera a 1280 | 2 filas, 89 px | **1 fila, 50 px** |
| Cabecera 1101–1279 | 2 filas | **1 fila** |
| Cabecera a 390/375 | 53 px | 52 px |
| Lienzo en escritorio | pegado al chrome | enmarcado (8 px de aire) |
| Peticiones de terceros para fuentes | 0 | 0 |

## 7. QA

Ver § Tests (al final): unitarios 1024/1024, browser test nuevo 243/0, mutaciones 18/18 (y las de 018.12, 18/18), batería existente en verde salvo `fluyo-011` (igual en HEAD).

## 8. Archivos modificados en este slice

- **Producto (servido):** `index.html`, `css/system.css` (nuevo), `css/styles.css`, `assets/fonts/*` (3 woff2 + 2 licencias, nuevos), `js/ui.js`, `js/render.js`, `js/editor-runtime.js`, `docs/index.html`, `sw.js`.
- **Tests nuevos:** `test/fluyo-018-13.test.cjs`, `test/fluyo-018-13-browser.cjs`, `test/fluyo-018-13-mutations.cjs`.
- **Tests adaptados:**
  - `test/fluyo-018-12-browser.cjs`: la comparación de rueda con HEAD ancla el zoom desde la esquina del lienzo y compara la vista con tolerancia de medio píxel (el marco cambia el tamaño del lienzo; el documento sigue siendo idéntico).
  - Pins de `CACHE` v70 → v71: `fluyo-010-qa`, `013`, `014`, `015`, `018-10` (test, browser y M8), `018-12` (test y U1).
- **Documentación:** `.ai/DECISIONS.md` (123–127), `.ai/ARCHITECTURE.md` (§ Sistema visual), `CONTRIBUTING.md` (mapa y «¿dónde edito?»), esta tarea.

## 9. CACHE

`fluyo-static-v70` → **`fluyo-static-v71`**. Nuevos en el núcleo del precache: `css/system.css` y las tres fuentes. Todo lo que carga `index.html` sigue precacheado (test estático) y el SW instala v71 y sirve la UI con sus fuentes sin red (browser test).

## 10. Riesgos

- **Mono como voz de toda la UI:** es más ancha que Segoe. La cabecera cabe en una fila gracias a los iconos; textos largos de Historias y diálogos ocupan más.
- **Historias, diálogos y Present heredan el sistema solo por tokens**: no se revisaron a fondo. Hay restos de azul en la UI interna de Historias (chips de frase, resaltado de colocación).
- **Las marcas del editor cambian de color** (azul → oliva) también en conexiones seleccionadas, extremos y tramos. Tests de píxel existentes: no dependen de esos colores (los de 015 cuentan `FLOW_ACCENT`, que no cambia).
- **El lienzo en escritorio es 8–16 px más pequeño** por el marco. Gestos y vista no cambian (todo es relativo al lienzo), pero cualquier test que fije coordenadas desde su borde derecho puede notarlo (ver la adaptación de 018.12).
- **Tooltips CSS (`[data-tip]`)** en los controles de solo icono, y `title` nativo en el resto: dos mecanismos conviven hasta unificarlo.
- **Verificación en Chrome con táctil emulado**, no en dispositivo físico.

## 11. Pendientes para 018.14

- **Shell:** la cabecera ya es de una fila en todas las anchuras; queda decidir si Ejemplo y Limpiar siguen en la cabecera de escritorio o pasan a «Más» siempre.
- Viewer (`/s/`) con el sistema (hoy sigue en `identity.css`), junto a 018.20.
- **Historias:** rediseño de su UI interna con los componentes (chips, menús, filas de historia, diálogo de evento) y el resaltado de colocación con `editorMark`.
- Diálogos nativos (`confirm`, `alert`) con la superficie de menú/modal (018.15).
- Flechas de conexión de los lados: hoy solo cambian de color; su rediseño es de 018.17.
- Estado de guardado en la barra de páginas («versión/estado»): hace falta engancharlo al autoguardado; no se ha inventado aquí.
- Unificar tooltips (`[data-tip]` en todos los controles de solo icono).
- Iconos que quedan como glifo en Historias (▶ Reproducir, ⋯, + en su cabecera) y en el mando de Present.

## Handoff

### Estado actual

Implementado y verificado (§ Tests). Sin commit, push ni deploy.

### Próximo paso concreto

Revisión visual del responsable con las capturas de `compare/`. Con OK: commit de 018.11, 018.12 y 018.13 y deploy (`CACHE` v71); después, crear `.ai/tasks/FLUYO-018.14.md`.

## Tests

- **Unit/estático:** `node --test test/*.test.cjs` → **1024/1024**: los 1016 previos más 8 nuevos de `test/fluyo-018-13.test.cjs`.
  - fuentes y licencias, sin terceros;
  - precache v71;
  - orden de las hojas de estilo (el Viewer no carga el sistema);
  - tokens y sin colores sueltos del chrome oscuro;
  - sprite (cada `<use>` resuelve, controles migrados sin emoji);
  - cabecera agrupada y sin marca ajena;
  - `model.js`, `config.js` e `identity.css` idénticos a HEAD;
  - marcas del editor oliva y solo con selección.
- **Otros:** `node test/editor-runtime.cjs` y `node test/render-boundary-run.cjs` en verde. `node --check` de `js/*.js`, `sw.js` y `test/*.cjs`: OK. `git diff --check`: limpio.
- **`test/fluyo-018-13-browser.cjs`** (Chrome real) — **243 ✔ · 0 ✘**. 1440 y 1280 con ratón; 1024, 768, 390 y 375 táctiles. En cada viewport:
  - fuentes cargadas desde este origen (0 peticiones de fuentes a terceros) y glifos del español en las dos;
  - superficies con los tokens (leídos de las propias variables);
  - cabecera en una fila sin desbordar, con filetes en escritorio;
  - objetivos ≥ 40 px con dedo (pestañas ≥ 38) y ≥ 28 px con ratón;
  - iconos del sprite sin emoji;
  - lienzo enmarcado (escritorio/tableta) o a sangre (móvil), con el tema del documento intacto;
  - panel (metadato, títulos serif, grupos, interruptor que cambia el documento; conexión con sus grupos; cerrar la hoja en móvil);
  - selección pintada en oliva y sin azul (lectura de píxeles a 1440);
  - «Más» por secciones, con lo destructivo último y en terracota, superficie de menú, interruptor que no cierra y Escape;
  - páginas (crear, índice mono, activa distinta, nombres serif, ✕ con trazo, menú de página táctil);
  - controles de vista sin tocar documento ni Undo;
  - barra táctil levantada con objetivos de 40 px;
  - sin scroll horizontal, Historias con el título serif alineado, Present con material inverso legible y 0 errores de consola.

  Además, el Service Worker instala v71 con `system.css` y las fuentes, y sin red la UI carga con ellas.
- **`test/fluyo-018-13-mutations.cjs`** — **18/18 detectadas**: 6 estáticas (U1–U6) y 12 en Chrome (B1–B12, cada una en el viewport que la delata).
- **Batería de Chrome existente** (23 suites) + `editor-runtime` + `render-boundary`:
  - **`fluyo-018-12-browser` en verde tras adaptarlo** (ver § 8; el documento sigue idéntico a HEAD) y **mutaciones de 018.12: 18/18**.
  - `fluyo-011-browser` falla igual en HEAD: los mismos 4 fallos, comprobado en esta sesión sobre `git archive HEAD`. Pendiente desde 018.12.
  - `fluyo-013-qa-browser`: un fallo intermitente del bloque 16 (teclado en Present) en la primera pasada. Pasa aislado dos veces y la suite completa dos veces seguidas. No depende de la UI de este slice.
  - El resto, en verde.
- **QA visual:** capturas de HEAD, 018.12 y 018.13 en 1440, 1280, 1024, 768, 390 y 375 (selección, «Más», Historias), además de temas crema/claro, modales, diálogo de evento, menú de historia, cajón de iconos y lienzo vacío. Hallazgos corregidos durante la QA:
  - `header` genérico afectaba a las cabeceras de Historias y diálogos (ahora `body > header`);
  - botón cerrar de la hoja visible en escritorio;
  - tooltip del zoom que desbordaba la página;
  - especificidad de «Limpiar» en el menú;
  - huecos en la rejilla de muestras;
  - modal de exportar demasiado ancho;
  - icono de Historias igual al de reproducir;
  - Playfair 600 descargado y sin uso (retirado).
