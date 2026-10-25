# FLUYO-SHELL-001 — Product Shell de las páginas públicas

Estado: **CLOSED / VERIFIED / IN PRODUCTION**. Commit `97b3271` en `main`, push y deploy de Vercel (fluyo.space sirve `fluyo-static-v108`). Ver § Producción.
Fecha: 25 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `53552a2` (main = origin/main = producción, `fluyo-static-v107`).
> Origen: FLUYO-NORTHSTAR-SURFACES-001 (auditoría), D1–D10 aprobadas por el PO en los términos recomendados, con estas precisiones:
> D1 Plex Mono sin Plex Sans; D3 papel; D5 favicon, OG y manifest sí; D6 la estrategia de idiomas es de FLUYO-I18N-002 (aquí solo se
> deja preparada la estructura); D7 `mcp.fluyo.space` fuera (otro repo).
> Fuentes leídas: `AGENTS.md`, `.ai/tasks/FLUYO-NORTHSTAR-SURFACES-001.md`, `.ai/tasks/FLUYO-I18N-002.md` (§ tipografía y S4/S7),
> `.ai/DECISIONS.md` (123–145, 260–262), `css/system.css`, `css/identity.css`, `css/styles.css` y `css/share.css` (cabecera y marca),
> `sw.js`, `js/i18n.js`, `test/i18n-scan.cjs`, los *undo* y los alcances de las tareas anteriores.

## Qué se hizo

1. **`css/pages.css` nuevo** sobre los tokens de `system.css` (decisión 263):
   - el único color fuera de los semánticos es `--canvas-dark` (= `THEMES.dark.bg`), el fondo de un diagrama;
   - escala de lectura propia (`--fs-page-*`, `--s-6…8`), columna `38rem`, contenedor de 1120 px;
   - componentes: cabecera, pie, `.btn` (secundario, `.primary`, `.ghost`), notas, tablas, código, galería sin tarjetas con el marco del
     lienzo, estado 404;
   - responsive (≤ 620 px y ≤ 440 px) y objetivos de 44 px con `pointer:coarse`;
   - propiedades lógicas; rótulos por token (`--case-kicker`, `--track-kicker`) para I18N-002 · S4.
2. **`<head>` coherente** en las ocho páginas: `identity.css` + `system.css` + `pages.css`, la mono precargada, `theme-color` `#F2EDE3`
   y el favicon nuevo.
3. **Cabecera pública** común (`.siteHead`): marca «fluyo» (la del editor, sin el hueco «flu yo») · Ejemplos · Docs · «Abrir Fluyo»
   (secundario; icono a ≤ 440 px). «Ir al contenido» y `<main id="main">`.
4. **Pie público** común (`.siteFoot`) fuera de `<main>`: licencia · Privacidad · Términos · Soporte · GitHub ↗ · MCP ↗ e idioma hermano
   con `hreflang` (solo donde existe la hermana). Lo legal sale de la cabecera.
5. **Ejemplos, Docs, legales y soporte** con el shell. El contenido no cambia (es de FLUYO-EXAMPLES-001), salvo:
   - Docs: los dos `h4` con `style` en línea pasan a la regla común;
   - Ejemplos: «Abrir en el editor» pasa a secundario y «Descargar JSON» a fantasma (mismo marcado: cambia el significado de `.btn`).
     La galería es una rejilla de dos columnas en escritorio, sin tarjetas.
6. **`404.html`** (nuevo, decisión 266):
   - rutas absolutas y `noindex`;
   - el shell y dos salidas (Abrir Fluyo, primaria; Ver ejemplos);
   - texto por `data-i18n` (claves `shell.*` y `notfound.*` en `js/i18n-en.js`);
   - `test/i18n-scan.cjs` lo incluye en su catálogo.
7. **Marca** (decisión 267):
   - favicon hueso y terracota, el mismo data URI en editor, Viewer y páginas;
   - `assets/logo.svg`, `icon-192.png`, `icon-512.png` y `og-image.png` dibujados con Chrome y las fuentes del repo;
   - `manifest.webmanifest`: `background_color` y `theme_color` `#F2EDE3`.
8. **`sw.js`**: solo `CACHE` v107 → **v108**. Listas y comportamiento intactos.

## Archivos

- **Servidos, modificados (19)**:
  - `css/pages.css`;
  - las 8 páginas: `docs/`, `ejemplos/`, `privacidad/`, `privacy/`, `terminos/`, `terms/`, `soporte/`, `support/` (`index.html`);
  - `index.html` y `s/index.html` (solo la línea del favicon);
  - `js/i18n-en.js` (solo claves nuevas al final);
  - `manifest.webmanifest`, `assets/logo.svg`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/og-image.png`, `sw.js`.
- **Servido, nuevo (1)**: `404.html`.
- **Tests nuevos**: `test/fluyo-shell-001.test.cjs` (9), `test/fluyo-shell-001-browser.cjs` (Chrome real) y `test/fluyo-shell-001-undo.cjs`
  (`undoShell`, `shellOnly`).
- **Tests adaptados**:
  - pines `fluyo-static-v107` → `v108` en 75 archivos (sustitución literal; las expresiones `(N - 1)` de las bases antiguas no
    cambian);
  - `fluyo-sw-viewer-001-undo.cjs`: `undoSwv` aplica `undoShell` antes;
  - `fluyo-sw-viewer-001.test.cjs` y `fluyo-product-narration-001.test.cjs`: `undoShell` en sus comparaciones directas;
  - los alcances que listan archivos cambiados (`scenarios-semantics-1…6`, `product-narration-001`, `step-message-001`,
    `step-reverse-002/003`) descuentan lo de esta tarea con `shellOnly`;
  - `i18n-scan.cjs`: `404.html` en `HTML_FILES`;
  - `fluyo-i18n-001-baseline.json`: `"404.html": 3`.
- **Documentación**: `CONTRIBUTING.md` (mapa), `.ai/ARCHITECTURE.md` (§ Product Shell), `.ai/DECISIONS.md` (263–268), este documento.

## Pruebas

### Suite completa (`node --test test/*.test.cjs`, con `fluyo-mcp` al lado)

| Árbol | Tests | Fallos |
|---|---|---|
| Base `53552a2` limpia (medida en esta sesión) | 1 662 | **83** preexistentes, los mismos de I18N-001 y SW-VIEWER-001 |
| Árbol de trabajo con esta tarea, **sin commit** | 1 671 | 89 = los 83 + 6 que comparan con `HEAD` o con `git status` (ver abajo) |
| Clon desechable (scratchpad) con esta tarea **commiteada** | 1 671 | **83, los mismos por nombre**: 0 nuevos, 0 desaparecidos |

Los 6 son alcances antiguos (018.19, 018.21, 018.23, 018.24, 018.25 y 018.29) que exigen «idéntico a `HEAD`» o un `git status` limpio.
Fallan con cualquier cambio sin commitear de `index.html`, `s/index.html` o `assets/`, y se curan solos al commitear: el clon lo
demuestra. No se tocan.

- `test/fluyo-shell-001.test.cjs`: **9/9**.
- `test/fluyo-i18n-001.test.cjs`: **20/20** (con `404.html` en el catálogo).
- `test/fluyo-sw-viewer-001.test.cjs`: **7/7**.
- Los 12 archivos de alcance adaptados: **0 fallos**.

### Línea base del trinquete de I18N-001

`node test/i18n-scan.cjs --write-baseline`. El JS no cambia; en el HTML, `index.html` 555, `s/index.html` 0 y **`404.html` 3**. Los
tres son «404», «GitHub» y «MCP»: un número y dos nombres propios, sin traducción posible.

### Chrome real (playwright-core por `NODE_PATH`, fuera del repo)

| Prueba | Resultado |
|---|---|
| `fluyo-shell-001-browser.cjs` · 8 páginas + 404 × 1440 / 375 con dedo / 320; navegación; 404 servido con estado 404 y en inglés; Ejemplos → editor; SW v108 sin red; comparación con editor y Viewer | **139 ✔ / 0 ✘** |
| `fluyo-i18n-001-browser.cjs` (editor, Present y Viewer en es/en) | **78 ✔ / 0 ✘** |
| `fluyo-sw-viewer-001-browser.cjs` (Viewer sin red, actualización con su SW) | **63 ✔ / 0 ✘** |
| `fluyo-018-10-browser.cjs` (Docs precacheada y sin red) | **18/18** |
| `fluyo-014-browser.cjs` (Share con Historia, sin red, actualización del SW) | **OK, 13 bloques** |
| `fluyo-019-2-browser.cjs` (árbol nuevo, v108 instalada) | **85 ✔ / 0 ✘** |
| Actualización real **v107 → v108** (árbol de `53552a2` y luego este; script de la sesión, fuera del repo) | **11 ✔ / 0 ✘** |

La prueba de actualización recorre este camino:

1. Con v107, `/ejemplos/` es la página oscura.
2. El deploy instala v108 y borra v107.
3. El editor sigue abriendo.
4. `/ejemplos/` pasa a papel.
5. Sin red, `/ejemplos/`, `/docs/`, `/privacy/` y `/` abren desde v108.

Medidas en Chrome:
- **Cabecera**: 50 px en una fila en todas las páginas y anchos (320 a 1440), igual que el editor y el Viewer.
- **Marca**: mismo fondo, filete, voz (Playfair 21 px), tinta y terracota que el editor y el Viewer, sin hueco entre «flu» y «yo».
- **Desbordes**: 0 scroll horizontal.
- **Objetivos táctiles**: con el dedo, ≥ 44 px en la navegación, «Abrir Fluyo», el pie y los botones.
- **Errores de consola**: 0.

### Hallazgo previo (no lo introduce esta tarea)

Sin red, una ruta inexistente recibe el `index.html` del editor, pero sus rutas relativas (`js/…`, `css/…`) se resuelven contra esa
ruta y el editor queda sin estilos ni scripts (29 errores). Es idéntico con v107 (producción) y con v108. Lo arreglaría la D8 (servir
el `404.html` precacheado), aplazada aquí para no cambiar el comportamiento del SW.

## Trade-offs

- La columna de lectura queda alineada a la izquierda dentro del contenedor de 1120 px. En escritorio ancho queda aire a la derecha
  de Docs y de las legales: es la composición editorial del producto (un solo borde de inicio para marca, título y pie), no un hueco.
- Cuerpo en mono: coherente con el editor y el Viewer, pero Docs (≈ 20 pantallas en el teléfono) se lee más denso que con una sans.
  Docs no tiene índice ni anclas; queda para una tarea de contenido.
- Ejemplos se queda sin acción primaria: «Abrir en el editor» es secundaria en cada elemento. FLUYO-EXAMPLES-001 define la primaria
  («▶ Ver»).
- Las vistas previas de Ejemplos siguen siendo los SVG de antes de 018.16 (diagrama pequeño dentro del marco). Es contenido de
  EXAMPLES-001.
- Sin red, una ruta inexistente sigue abriendo el editor: cambiarlo era tocar el comportamiento del SW (D8 aplazada).
- 404 en inglés: los textos se traducen, pero los enlaces del pie siguen yendo a las legales en español (`i18n.js` no traduce `href`).
  Lo resuelve I18N-002 (S7) con su esquema de URLs.
- En las páginas en inglés, Ejemplos y Docs enlazan las páginas en español (`hreflang="es"`) hasta I18N-002 · S7.
- Docs conserva un `⚙` de contenido (nombra un control del editor). Es la única excepción del test de emoji.

## Conflictos con otras tareas

- **FLUYO-I18N-002**:
  - **CACHE**: su plan, como EX-1, cuenta con v108. Esta tarea usa v108, así que la que entre después sube a v109.
  - **S0** reparte los diccionarios en dos archivos por idioma; las 14 claves `shell.*`/`notfound.*` irían al común.
  - **S4** pone las pilas CJK en `system.css`, y las páginas las heredan por `var(--font-*)`. Le queda redefinir `--case-kicker` y
    `--track-kicker` bajo `:lang()`.
  - **S7** decide el esquema de URLs: `/en/…` frente a slugs traducidos.
  - No hay solape de código: I18N-002 no está implementado.
- **FLUYO-EXAMPLES-001**:
  - EX-1 también contaba con v108 y pasa a v109;
  - construye sobre `.gallery`/`.card` y `.btn.primary`;
  - su *undo* irá encima de `undoShell`.

## Producción (25 de octubre de 2026)

- **Commit** `97b3271`, con push a `main` (`53552a2..97b3271`). Vercel lo desplegó en ≈ 10 s: `https://fluyo.space/sw.js` sirve
  `fluyo-static-v108`.
- **Mismos bytes**: los 21 archivos servidos de esta tarea (más `system.css` e `identity.css`) son idénticos en producción y en el
  commit. No hay diferencias entre local y producción.
- **404 real**: una ruta inexistente responde `404`, `text/html`, con `404.html`. Vercel sirve el 404 propio, como se había
  emulado en local.
- **Smoke de Chrome contra producción**: **56 ✔ / 0 ✘**. Es un script de la sesión, fuera del repo; solo lee, y bloquea la telemetría
  para no tocar las métricas reales.
  - Las 8 páginas a 1440 y a 375 con dedo: 200, papel, Plex Mono y Playfair cargadas, cabecera de 50 px en una fila, sin scroll
    horizontal, marca, theme-color, favicon, pie y objetivos de 44 px o más.
  - El 404 real, en español y en inglés con la preferencia guardada.
  - El editor con `?lang=en`.
  - Ejemplos: «Abrir en el editor» carga el funnel con 8 nodos.
  - Present: entra y sale.
  - Share: se abre el diálogo y se genera el enlace `/s/#d=`.
  - Viewer: abre el enlace en inglés, instala el SW con v108 y, sin red, el enlace vuelve a abrir.
  - Editor: instala v108 con las páginas públicas, y sin red abren `/ejemplos/`, `/privacidad/` y el propio editor.
  - 0 errores de consola o página. Las únicas peticiones fallidas son las de telemetría que bloquea el test.
- **Tests de alcance tras el commit**: los 6 alcances relativos a `HEAD` ya pasan en el repo real (018.19, 018.21, 018.23, 018.24 y
  018.29: 95/95; el contrato de 018.25, también). Los 9 fallos que quedan en `fluyo-018-25.test.cjs` son de la línea base.

## Handoff

- **Qué queda**:
  - **D8** (404 sin red, defecto previo): pendiente de decisión.
  - **Índice de Docs**: tarea de contenido.
  - **`mcp.fluyo.space`** (D7): deuda, en otro repo.
- **Próximo CACHE libre: v109.** FLUYO-I18N-002 y FLUYO-EXAMPLES-001 · EX-1 contaban con v108: la primera que entre usa v109.
- **Cómo construir encima**: EXAMPLES-001 parte de `.gallery`, `.card` y `.btn.primary`, y su *undo* va encima de `undoShell`.
  I18N-002 · S4/S7 parte de los tokens `--case-kicker`/`--track-kicker` y de las claves `shell.*`/`notfound.*`.
- **Fuera de este commit**: los cambios ajenos de `.ai/tasks/` siguen en el árbol de trabajo (018.29, 018.30, I18N-001,
  STEP-MESSAGE-001, PRODUCT-NARRATION-001, SCENARIOS-SEMANTICS-001, STEP-REVERSE-003, SW-VIEWER-001; sin seguimiento: 019.4,
  EXAMPLES-001, I18N-002).
