# FLUYO-I18N-002 — Localización completa del producto (es · en · fr · ja · zh): auditoría, plan, S0 y S1

Estado: **EN CURSO** — **S0** (`41361b5`) y **S1** implementadas, verificadas y aprobadas por el PO; publicadas en `main`.
S2–S7 pendientes; I18N-002 no se cierra hasta completarlas.
Base de S0: `main` = `origin/main` = `bb7881a` (FLUYO-SHELL-001 cerrada; fluyo.space sirve `CACHE` v108). S0 usa **`CACHE` v109**;
S1, **`CACHE` v110**.
Contexto previo: FLUYO-I18N-001 (decisiones 260 y 261), FLUYO-SW-VIEWER-001 (262) y FLUYO-SHELL-001 (263–268).
El plan original (auditoría sobre `53552a2`) sigue debajo de la sección S0, sin cambios salvo lo que S0 ya resolvió.

> Repo público: este archivo solo contiene contenido técnico apto para publicarse.

## S0 · Infraestructura para cinco idiomas (2026-10-25)

Decisiones del PO recibidas con el encargo de S0: los cinco idiomas con la misma arquitectura; inglés primero; selector visible
(S6) con `?lang` y preferencia como mecanismos técnicos; detección del sistema es→es, en→en, fr→fr, ja→ja, zh→chino simplificado,
otro→inglés, **nunca** un idioma a medias por detección; reserva idioma → inglés → español; japonés y chino con fuentes, reserva
tipográfica, corte de líneas y sin mayúsculas artificiales. Registradas como decisiones 269–274.

### Qué hace S0

| Pieza | Antes (I18N-001) | Ahora (S0) |
|---|---|---|
| Idiomas | es + en | registro `LANGS` con es, en, fr, ja, zh: `code`, `tag` BCP 47, nombre propio, `released` |
| Publicación | `AUTO_DETECT=false` | solo idiomas `released` llegan por detección (y al selector en S6); hoy solo `es`. Puerta con test: diccionario completo y 0 textos de interfaz por migrar |
| Detección | apagada | primer idioma publicado de `navigator.languages`; si ninguno, inglés si está publicado; si no, español |
| Reserva | idioma → español | idioma → **inglés** → español; `missing()` anota lo que falta en el idioma elegido |
| Plurales | reglas del idioma de la interfaz | reglas del idioma del TEXTO usado (ja/zh sin plurales; fr 0 = singular; si cae al inglés, reglas inglesas) |
| Números | — | `FluyoI18n.num(n, opts)` con `Intl.NumberFormat` (fr: `1 234,5`) |
| `<html lang>` | código (`zh`) | etiqueta completa (`zh-Hans`): glifos Han correctos y `:lang()` en CSS |
| Diccionarios | `i18n-en.js` | por idioma: `i18n-<xx>.js` (común: Viewer, Present, Historia, shell, 404) + `i18n-<xx>-editor.js`; el Viewer y el 404 cargan solo los comunes |
| fr / ja / zh | — | las 86 claves de hoy, **no publicados** (solo `?lang`); pendientes de revisión nativa |
| Cambio de idioma | `setLocale` traducía el HTML; lo pintado por JS esperaba a su próximo refresco | **en vivo**: `onChange`; Viewer y Present (también reproduciendo) repintan sin recargar; documento, Deshacer y reproducción intactos |
| `applyDom` | volvía a partir el texto actual en glifo + cuerpo | conserva el marco del texto BASE (defecto encontrado: «Abrir （en Fluyo» al volver de chino) |
| Escritura | Plex y Playfair (solo latín) → genéricas del sistema | `--font-cjk` (sans CJK del sistema) antes de la genérica en `--font-mono` y `--font-serif`; `:lang(ja)`/`:lang(zh)` solo tokens: su `--font-cjk`, rótulos +1 px, sin espaciado ni mayúsculas. Sin webfonts CJK |
| Offline | `i18n.js` + `i18n-en.js` | los 8 diccionarios en `ASSETS`; los 4 comunes en `VIEWER_ASSETS` (28 recursos) |
| Peso | ≈ 3,7 KB | diccionarios + runtime: Viewer ≈ 24 KB, editor ≈ 32 KB sin comprimir (presupuesto con test: 64 KB / 400 KB) |
| Pruebas | — | pseudo-idioma `qps` (+40 %, ⟦ ⟧) solo en tests; detector de desbordes y recortes; fuentes reales por CDP |

Fuera de S0 a propósito (siguen en su slice): migrar texto (S1–S3), selector visible y publicar el inglés (S6), el corte del globo
del lienzo para texto sin espacios y la exportación (S4), páginas públicas, SEO y ejemplos (S7). Ningún texto que ya se ve en
español cambia.

### Archivos

Servidos (`CACHE` v108 → **v109**):
- `js/i18n.js` — registro `LANGS`, resolución con detección entre publicados, reserva idioma → inglés → español, plurales por idioma
  del texto, `num`, `tag`, `languages`, `released`, `onChange`; `applyDom` conserva el marco del texto base.
- `js/i18n-en.js` (común) + **nuevos** `js/i18n-en-editor.js`, `js/i18n-fr.js`, `js/i18n-fr-editor.js`, `js/i18n-ja.js`,
  `js/i18n-ja-editor.js`, `js/i18n-zh.js`, `js/i18n-zh-editor.js`.
- `index.html` (los 8 diccionarios), `s/index.html` y `404.html` (los 4 comunes) — solo las líneas `<script>`.
- `sw.js` — `CACHE` v109; los 8 en `ASSETS`, los 4 comunes en `VIEWER_ASSETS`.
- `css/system.css` — `--font-cjk` en `--font-mono` y `--font-serif`; bloque «Escritura por idioma».
- `js/viewer.js` — guarda el código del error mostrado y se suscribe a `onChange` (pestañas, banda, aviso).
- `js/present-story.js` — se suscribe a `onChange` (mando, encabezado, botón de aspecto, transporte de Historias).

Documentación: `.ai/DECISIONS.md` (269–274), `.ai/ARCHITECTURE.md` (sección «Idioma de la interfaz»), esta tarea.

Tests:
- Nuevos: `test/fluyo-i18n-002-s0.test.cjs` (20), `test/fluyo-i18n-002-s0-browser.cjs` (Chrome real), `test/fluyo-i18n-002-s0-undo.cjs`
  (`undoS0`, generado del diff con 2 líneas de contexto), `test/i18n-pseudo.cjs`.
- `test/i18n-scan.cjs` — reconoce todos los diccionarios (`DICT`) y expone `dictionaries()`.
- `test/fluyo-i18n-001.test.cjs` — carga todos los diccionarios; reglas de S0 (fr ya existe; la detección no elige idiomas sin
  publicar; `supported()` con cinco idiomas).
- `test/viewer-harness.cjs` — carga los 4 comunes como `s/index.html`.
- Cadena de alcances: `test/fluyo-shell-001-undo.cjs` aplica `undoS0` primero (`undoShell`) y `shellOnly` descuenta lo de S0;
  `test/fluyo-shell-001.test.cjs` (su alcance, sobre el texto sin S0), `test/fluyo-sw-viewer-001.test.cjs` (25 + 3 recursos del
  Viewer; listas del editor tras `undoShell`), `test/fluyo-sw-viewer-001-browser.cjs` (el «idioma desconocido» pasa de `fr` a `de`).
- `CACHE` v109 en las aserciones de 74 tests (como cada tarea).

### Verificación (sin commit; 2026-10-25)

- `node --test test/fluyo-i18n-002-s0.test.cjs` → **20/20**; `fluyo-i18n-001` 20/20; `fluyo-shell-001` 9/9; `fluyo-sw-viewer-001` 7/7.
- **Suite completa** (`node --test test/*.test.cjs`, con `fluyo-mcp` al lado), medida como en I18N-001 en un clon desechable con
  S0 commiteado: base `bb7881a` = **83 fallos / 1 671 tests**; con S0 = **los mismos 83 por nombre / 1 691 tests** (0 nuevos, 0
  arreglados; los 20 nuevos pasan). Sin commit aparecen además las guardas transitorias que listan archivos sin seguimiento
  (p. ej. narration H2), como en las tareas anteriores: desaparecen al commitear.
- **Trinquete (baseline)**: sin cambios (`js` 757 en 23 archivos, `index.html` 555, `s/index.html` 0, `404.html` 3); S0 no migra
  texto, así que `test/fluyo-i18n-001-baseline.json` no se reescribe.
- **Chrome real** `test/fluyo-i18n-002-s0-browser.cjs` → **385 ✔ · 0 ✘**:
  - editor (cabecera + Present con Historia reproduciéndose) en es/en/fr/ja/zh a 1440 y 390; Viewer en los cinco a 1440 y 390
    (cabecera, banda, Present del Viewer); 404 en los cinco. Textos = diccionario, `<html lang>` = etiqueta, `missing()` vacío,
    sin desbordes ni recortes horizontales o verticales, sin errores de consola.
  - **Fuentes que pinta Chrome (CDP)**: japonés → *Yu Gothic UI* (cabecera, Present, pie del Viewer, título del 404 en Playfair);
    chino → *Microsoft YaHei UI*; nunca MS Gothic, MS Mincho, SimSun ni NSimSun. En la base `bb7881a` el mismo texto salía en
    **MS Gothic** (ja, voz mono), **NSimSun** (zh, mono) y **SimSun** (zh, títulos).
  - en vivo: editor es → ja → zh → fr → en → es con todo el HTML marcado **byte a byte** igual; Present cambia de idioma con la
    Historia reproduciéndose (sigue reproduciéndose); documento, Deshacer y preferencia guardada intactos. Viewer es → zh → es byte a byte.
  - pseudo-idioma (+40 %): Viewer (1440 y 390) sin ningún control fuera de FluyoI18n y sin desbordes; cabecera del editor igual.
  - Share: diálogo del editor (en) → enlace → Viewer con preferencia ja (interfaz en japonés, Historia del autor intacta) →
    «Abrir en Fluyo» → editor en japonés con el mismo documento.
  - offline: SW v109 con los 8 diccionarios; sin red, el editor abre en japonés y el enlace en chino (preferencia); instalación
    solo-Viewer con los 4 comunes y ninguno del editor; sin red, `?lang=fr` en francés.
  - documentos: los 8 ejemplos y el fixture complejo se serializan idénticos en los cinco idiomas.
- **Español píxel a píxel** (base `bb7881a` frente a S0, Chrome, capturas de zona): cabecera del editor 1440 y 390, cabecera y pie
  del Viewer 1440 y 390, 404, docs y privacy → **idénticos**.
- **Regresiones en Chrome**: `fluyo-i18n-001-browser` 78/0, `fluyo-shell-001-browser` 139/0, `fluyo-014-browser` OK (13 bloques:
  Share con Historia, offline y actualización del SW v56 → v109), `fluyo-sw-viewer-001-browser` **63/0** (tras ajustar dos recuentos fijos del test: los scripts del Viewer pasan de 18 a 21 y la
  espera del precache del editor pasa a la misma condición que se comprueba; y su «idioma desconocido» pasa de `fr` a `de`).
- Defectos encontrados y corregidos durante la verificación: (1) `applyDom` tomaba la puntuación inicial de una traducción por
  glifo al volver («Abrir （en Fluyo»); (2) fuera de Present, el mando oculto se quedaba en el idioma anterior.

### Conflictos con SHELL (análisis)

- **Ninguno de comportamiento.** SHELL dejó `404.html` con `data-i18n` + `i18n.js`: S0 le añade los 3 diccionarios comunes nuevos
  (sus claves `shell.*`/`notfound.*` siguen en `i18n-en.js`, en el mismo orden) y ya se ve en los cinco idiomas con `?lang`.
- La decisión 268 reservaba para S4 los tokens de mayúsculas (`--case-kicker`, `--track-kicker`) y las pilas CJK: S0 usa
  exactamente esos ganchos, solo como tokens bajo `:lang()` (decisión 274). Las páginas con URL propia (`/privacy/`…) no cargan
  `i18n.js` y no cambian; su `<html lang>` estático no es `ja`/`zh`, así que el bloque CJK no les aplica.
- `system.css` lo cargan también las páginas públicas: el latín se pinta igual (medido: **píxel a píxel idéntico** en docs y privacy).
- Pruebas: las de SHELL siguen en verde con la cadena `undoShell → undoS0`; su alcance se mide sobre el texto sin S0.
- `404.html` sigue fuera del precache (decisión 266): sin red, una ruta inexistente responde el editor, como antes.

### Riesgos y pendientes de S0

- **fr / ja / zh no tienen revisión nativa** (86 claves cada uno). No se publican hasta S5 + revisión (D-QA del plan).
- **Rótulos partidos en dos `<span>`** («Abrir» + «en Fluyo»): en japonés y chino el orden no encaja; S0 lo resuelve con
  «開く（Fluyo）» / «打开（Fluyo）», pero S1–S3 deben evitar ese patrón (frases completas, R1 del plan).
- La detección solo actúa cuando se publique un idioma: hoy nadie ve inglés sin pedirlo (igual que antes).
- El corte de los mensajes del lienzo (`render.js`, texto sin espacios) y la exportación siguen en S4: afecta a autores que
  escriben en japonés o chino aunque la interfaz esté en español.
- Fuentes CJK: medidas en Windows (Yu Gothic UI, Microsoft YaHei UI). macOS/iOS (Hiragino/PingFang) y Android (Noto CJK) están en
  la pila pero no se han medido en dispositivo; Linux sin fuentes CJK mostraría cuadros (límite conocido).
- `waitForFunction` de Playwright no espera predicados asíncronos (la promesa cuenta como verdadera): los smokes con service worker
  deben usar un `until` que evalúe en bucle (encontrado y corregido en el smoke de S0).

### Decisiones del PO sobre S0 (2026-10-25)

- **D-S0-1 · aprobada**: S0 tal cual (decisiones 269–274) y su commit (solo los archivos de §Archivos); sin push ni deploy.
- **D-S0-2 · fijada**: chino simplificado (`zh-Hans`) como único chino; no se crean `zh-TW` ni `zh-HK` (llegan al simplificado). Un
  chino tradicional futuro sería un idioma independiente (decisión 271).
- **D-S0-3 · fijada**: revisión de francés, japonés y chino por hablantes nativos reales; es la puerta para publicarlos, no bloquea
  S1–S3 (decisión 275). La puerta técnica de la 269 ya existe en los tests; la de revisión se hará explícita en el registro
  (`LANGS`) cuando se publique el primero de ellos (S6/S5), sin cambiar la arquitectura.
- **D-S0-4 · en curso**: glosario estable por idioma, propuesto en `.ai/I18N-GLOSSARY.md` para validar (no congelado).
- **Estado `released` de cada idioma tras S0**: `es` publicado; `en` no publicado (próximo idioma principal: se publica en S6,
  cuando la interfaz esté migrada); `fr`, `ja`, `zh` no publicados (infraestructura y traducciones preparadas, pendientes de
  revisión nativa). Ninguno llega a usuarios por detección ni por selector; solo por `?lang` (técnico).
- **EXAMPLES-001 no empieza todavía**: los Ejemplos se construirán sobre esta infraestructura de localización.

## S1 · Cromo del editor en inglés (2026-10-25)

Encargo del PO: con `en`, todo el chrome estático principal del editor en inglés; sin selector, sin detección, sin publicar
fr/ja/zh; sin tocar kernel, MCP, formato, Share (comportamiento), Narration ni Historias; el contenido del autor nunca pasa por
`FluyoI18n.t`; las concatenaciones que impidan traducir bien se registran, no se parchean.

### Alcance migrado

| Superficie | Qué |
|---|---|
| Cabecera | ya estaba (I18N-001); ahora también el menú **Lienzo** entero (tema, fondo propio, tipografía, aspecto, cuadrícula, rejilla, animación del lienzo y sus ayudas) y **Más** (Archivo: Ejemplo, Abrir, Guardar, Limpiar página; Interfaz; títulos de Ayuda; Proyecto y enlaces) |
| Rail y cajones | herramientas (rótulos y tooltips), cajón de iconos (rótulos de grupo) y de GIFs (título y ayuda) |
| Lienzo | pista del lienzo vacío (el editor la pasa a `render`; `render.js` no cambia), «Editar texto», papelera y **barra táctil** (botones, «Toca el elemento de destino», «N seleccionados») |
| Panel | cabecera (título sin selección, «N elementos», Orden de capas y su menú, Eliminar, Plegar/Cerrar), **estado vacío**, **selección múltiple** (Copiar/Cortar/Duplicar/Eliminar y «N nodos y M flechas seleccionados») |
| Barra inferior | vista (Alejar/Acercar/100 %/Encajar), modos («Historias», «Contar el sistema»), **pestañas y menú de página** (opciones, nueva, renombrar, eliminar, error de nombre) |
| Present | ya estaba (I18N-001) |
| Compartir | diálogo entero y todos sus avisos (detener la reproducción, archivo local, creando, nota del resultado, demasiado grande, error, copiado) |
| Exportar | diálogo entero, progreso del GIF y sus avisos (página vacía, gif.js no cargó, se detuvo, error) |
| Diálogos | sesión guardada, enlace/ejemplo entrante, archivo no válido, imagen no compatible/sin tamaño/ilegible, enlace sin diagrama, no se pudo restaurar |

**Cifras**: claves en uso **83 → 280** (+197), usos 128 → 368. Texto sin migrar: `index.html` **555 → 372**, JS **757 → 700**
(`editor-share.js` 16 → 0, `export.js` 26 → 13, `ui.js` 88 → 72, `deeplink.js` 6 → 1, `examples.js` 12 → 9, `interaction.js`
15 → 12, `state.js` 2 → 1). Trinquete reescrito.

### Lo que queda fuera de S1 (registrado; los tests lo fijan y no puede crecer)

| Qué | Dónde | Por qué | Slice |
|---|---|---|---|
| Ayuda «Atajos y gestos» (13 líneas, 64 fragmentos) | `index.html` `.helpList` | cada frase mezcla texto con `<kbd>`/`<b>` («Pasa el ratón sobre un nodo y **arrastra el punto** que…»): traducir por trozos rompe el orden de las palabras. Necesita texto con marcado (D-S1-1) | S1b o S2 |
| Propiedades de la selección (154 en HTML; ≈ 60 en `ui.js`: colores, formas, segmentados, «Conexión · id → id», «Caja sin texto»…) | `#selBody`, `ui.js` | Propiedades completas | S2 |
| Historias (152 en HTML; 237 en `editor-scenarios.js`; «Reproduciendo»; «Reducir/Ampliar la hoja de Historias») | panel y modal de Historias | Historias | S2 |
| Confirmaciones de borrar página y selección | `selection.js` | componen listas y plurales con Historias y momentos («La página «X» tiene 3 elementos, 2 conexiones y 1 Historia:», «• Pago — 2 momentos (A → B)»): necesitan plantillas completas e `Intl.ListFormat` | S2 |
| Nombres sembrados: «Página 1», nombres de icono/GIF que pasan a la etiqueta del nodo, el ejemplo incorporado, el demo | `model.js`, `config.js`, `export.js`, `share-loader.js` | valores que se guardan en el documento | S3 |
| Títulos de ejemplos | `examples.js` | contenido de los ejemplos | S7 |
| `<title>`, meta, Open Graph, JSON-LD | `<head>` | SEO | S7 |
| `config.js` | kernel | nombres de icono/paleta (sembrados) y fuentes/marcas | S3 |
| Falsos positivos que siguen contando | nombres de tecla, fuentes, `console.*`, claves de datos (`"Estados"` como clave de grupo) | no son interfaz | — |

### Separación contenido / interfaz (criterio de calidad)

- **Interfaz estática** → `data-i18n*` en el HTML o `FluyoI18n.t("clave", "texto base")` en JS, siempre con clave y texto literales
  (el test lo exige).
- **Contenido del autor** (nombres de página y de Historia, etiquetas) → nunca clave ni texto base; solo **parámetro** de una
  plantilla completa («Página {n} de {total}: {name}. Cambiar de página», «…suceder: «{name}».»). El test prohíbe `.name`, `.label`
  o `.message` como argumento de `t()`, y Chrome comprueba que pestañas, título del panel y la frase de Compartir llevan el texto del
  autor tal cual en los dos idiomas.
- **Lo que nunca se traduce** → `translate="no"` (atributo HTML estándar): atajos (`Ctrl+S`), repositorios (`itsnect/fluyo`,
  `fluyo-mcp`), formatos (`PNG`, `JPG`, `SVG`, `FPS`) y lecturas numéricas (`100%`, 15/20/25). El escáner lo respeta.
- **Texto que pinta JS** → `data-i18n-js="clave"` (nuevo, solo para el escáner): el HTML lleva el mismo texto base que el
  `FluyoI18n.t` de su JS, y `applyDom` no lo toca (no pisa lo que decide el estado: «Cancelar»/«Cerrar», el título del panel con
  una selección, el modal de enlace entrante). 9 elementos.
- **Plurales y recuentos**: plantilla externa completa con piezas nominales completas («{nodes} y {edges} seleccionados» con
  «{count} nodo/nodos»): el orden lo decide cada idioma; ninguna concatenación de traducciones.

### Cambio de idioma en vivo

`ui.js` repinta pestañas, panel, barra táctil, cajones, el botón de la animación y los grupos de tipografía (y cierra el menú de
página); `editor-share.js` repinta cada texto del diálogo abierto. Chrome: es → en → es con el fixture complejo deja documento,
Deshacer, selección, título del panel y pestañas intactos.

### Defectos encontrados y corregidos

1. **«¿» tomado por glifo**: el marco de `applyDom` (decisión 273) trataba la puntuación de apertura como glifo; «¿Qué quieres
   compartir?» habría salido «¿What do you want to share?». Ahora «¿ ¡ « “ ( [» son del texto (`js/i18n.js` y el escáner).
2. **Título del panel en español con la interfaz en inglés** al arrancar sin selección (JS no lo pintaba): `paintChromeText` lo pinta
   (solo el texto; en español no cambia nada, sin añadir `title`).
3. `step.message.nowReads` (Narration) llevaba « » en inglés: ahora “ ” (solo el inglés, sin publicar).

### Términos nuevos para el glosario (inglés; ver `.ai/I18N-GLOSSARY.md`)

Aparición (animación del lienzo) → **Reveal** («Animate reveal», «Reveal interval»; distinto de la aparición = paso de una Historia) ·
Flecha (herramienta) → **Arrow** (la conexión semántica sigue siendo *Connection*) · Aspecto → **Look** · Contar el sistema →
**Tell the system** (D-S1-2) · Interfaz · este navegador → **Interface · this browser** · Fondo propio → **Custom background** ·
Plegar el panel → **Collapse the panel** · Orden de capas → **Layer order** (Bring to front / Bring forward / Send backward / Send
to back) · Rombo / Decisión → **Diamond / Decision** · BD → **DB**.

### Archivos

Servidos (`CACHE` v109 → **v110**; sin archivos nuevos): `index.html` (marcas), `js/ui.js`, `js/editor-share.js`, `js/export.js`,
`js/deeplink.js`, `js/examples.js`, `js/state.js`, `js/interaction.js`, `js/editor-runtime.js` (`FluyoI18n.t`), `js/i18n.js`
(marco de glifo), `js/i18n-en-editor.js` (+197 claves), `sw.js` (solo `CACHE`). Sin cambios: kernel, `render.js`, `selection.js`,
`editor-scenarios.js`, `present-story.js`, `viewer.js`, `s/index.html`, `404.html`, CSS, diccionarios comunes y fr/ja/zh.

Tests: nuevos `test/fluyo-i18n-002-s1.test.cjs` (10), `test/fluyo-i18n-002-s1-browser.cjs` (Chrome), `test/fluyo-i18n-002-s1-undo.cjs`
(`undoS1`, debajo de `undoS0`), `test/i18n-vm.cjs` (carga el idioma en contextos vm, como la página). `test/i18n-scan.cjs`: lector
de llamadas sin expresión regular (plurales con llaves), `translate="no"`, `data-i18n-js` y el marco con puntuación de apertura.
Contextos vm que ejecutan trozos del cromo cargan el idioma (`fluyo-018-7c-harness`, `fluyo-018-8-harness`, `analytics`,
`fluyo-018-12`, `fluyo-018-7a-f1`); comparaciones de literales de marcado/código antiguas, sobre el texto sin S1 (`fluyo-018-13`,
`fluyo-018-7c`, `fluyo-019-2`) o con la marca admitida (`fluyo-018-14b`); alcances de S0 y SHELL descuentan lo de S1; el smoke de S0
acepta que fr/ja/zh caigan al **inglés** en las claves de S1 (nunca al español); `CACHE` v110 en 76 tests; trinquete reescrito.

### Verificación (sin commit)

- Propios: `fluyo-i18n-002-s1` **10/10**, `-s0` 20/20, `fluyo-i18n-001` 20/20, `fluyo-shell-001` 9/9, `fluyo-sw-viewer-001` 7/7.
- **Suite completa** en un clon desechable con S1 commiteado sobre `41361b5`: **1 701 tests, los mismos 83 fallos** de la base por
  nombre, **0 nuevos**, 0 arreglados (los 10 nuevos pasan). Sin commit, además, las guardas transitorias «idénticos a HEAD».
- **Chrome real** `fluyo-i18n-002-s1-browser`: **181 ✔ · 0 ✘** — es y en a 1440 y 390: cabecera, Lienzo y Más abiertos, rail,
  vacío del panel, selección múltiple, pestañas y menú de página (renombrar y su error), barra táctil, Compartir con Historia (frase
  con el nombre del autor; enlace creado), Exportar (PNG descargado), Deshacer/Rehacer, Present, sesión guardada y enlace entrante;
  sin desbordes ni recortes; en vivo es → en → es con documento, Deshacer, selección y contenido del autor intactos; pseudo-idioma:
  ningún texto de las superficies de S1 fuera de FluyoI18n (salvo contenido del autor y la ayuda registrada).
- **Español píxel a píxel** frente a `41361b5` (cabecera, rail, panel vacío, barra inferior, Lienzo y Más abiertos, selección
  múltiple, menú de página, Compartir, Exportar, barra táctil; 1440 y 390): **idéntico** en las 18 zonas salvo el ruido de captura que
  la base también tiene contra sí misma (116 píxeles del borde de Compartir sobre el fondo desenfocado, Δ ≤ 2/255).
- Regresiones en Chrome: S0 (cinco idiomas, Viewer, 404, offline, Share, documentos) **385/0**; `fluyo-i18n-001-browser` **78/0**;
  `fluyo-shell-001-browser` **139/0**; `fluyo-sw-viewer-001-browser` **63/0**; `fluyo-014-browser` **OK** (13 bloques: Share con
  Historia, Viewer, offline y actualización del SW v56 → v110).
- Para que el español sea idéntico también a 390 px, la frase de «Compartir historia» se pinta como antes en tres nodos (texto ·
  nombre del autor · texto) a partir de UNA plantilla traducida entera.

### Decisiones abiertas para el PO

- **D-S1-1** Ayuda «Atajos y gestos»: propongo texto con marcado seguro (p. ej. `{kbd:Ctrl+C}` / `{b:arrastra el punto}` dentro de
  una frase completa, pintado con nodos, sin `innerHTML`), en una mini-slice S1b o al empezar S2. Hasta entonces se ve en español.
- **D-S1-2** Glosario: confirmar los términos nuevos (en particular **Reveal** y **Tell the system**).
- **D-S1-3** Confirmaciones de borrar página/selección (Historias y momentos) en S2 con `Intl.ListFormat` (recomendado).
- **D-S1-4** Diálogos nativos (`alert`/`confirm`): su texto ya se traduce, pero los botones Aceptar/Cancelar los pone el navegador
  en su idioma (D-DIALOG del plan): ¿diálogos propios más adelante?
- Riesgo: con +40 % (pseudo-idioma) «Más» desborda 5 px; en inglés no. A medir en S4/S5 con francés.

## Objetivo

Que toda la interfaz de Fluyo se pueda usar en **español, inglés, francés, japonés y chino**, con un **selector de idioma visible**
como capacidad normal del producto (sin URL manual, consola ni `localStorage` a mano), y que añadir otro idioma después sea añadir un
archivo, no rehacer nada. El contenido del autor (nombres de nodos y conexiones, títulos, páginas, Historias, eventos, frases,
mensajes de paso, Narration, símbolos, texto dentro del diagrama) **nunca** se traduce: «Cliente solicita un préstamo» sigue igual
con la interfaz en japonés.

## 1. Estado actual

| Pieza | Estado |
|---|---|
| Runtime `js/i18n.js` | Hecho (I18N-001). `t(clave, es, params)`, `applyDom`, `setLocale`, plurales con `Intl.PluralRules`, `missing()`. Sin DOM es puro; no es kernel. |
| Diccionarios | Solo `js/i18n-en.js`: **69 claves** (3,7 KB). Usos: 110 (JS + `data-i18n*`). |
| Resolución del idioma | `?lang=xx` (solo esta carga) › `localStorage["fluyo.ui.lang"]` › español. `AUTO_DETECT=false`. |
| Selector visible | **No existe.** Hoy solo se cambia con `?lang=en` o tocando `localStorage`. |
| Cubierto | Cabecera del editor, mando de Present, Viewer entero (HTML 38 marcas, 0 textos sin marca). |
| Trinquete | `test/i18n-scan.cjs` + `test/fluyo-i18n-001-baseline.json`: **757** literales sin migrar en 23 archivos JS y **555** en `index.html`. |
| Documento | Ningún idioma en el `.fluyo.json` (decisión 260, D-LANG A). Formato v5 / `engineVersion` 2 intactos. |
| Offline | `sw.js` precachea `i18n.js` + `i18n-en.js` en `ASSETS` y `VIEWER_ASSETS` (decisión 262: la lista del Viewer debe ser exactamente lo que carga `s/index.html`). |
| Tipografía | UI en **IBM Plex Mono** (`--ui-font`, `css/system.css:131`) y títulos en **Playfair Display**, autoalojadas y **solo subconjunto latino**. Ninguna pila incluye familias CJK. |

**Conclusión**: la arquitectura de I18N-001 es correcta y suficiente para 5 idiomas con cuatro ajustes pequeños (§4). Lo que falta es
volumen (≈ 92 % del texto de la interfaz), un selector, el texto que pone el kernel dentro de frases del autor, y una estrategia
tipográfica para japonés y chino, que hoy **no** está resuelta.

## 2. Inventario de strings

Medido con `test/i18n-scan.cjs` sobre `53552a2` más lectura dirigida (volcado completo por archivo y línea fuera del repo, en el
scratchpad de la sesión). La heurística **infracuenta** fragmentos que empiezan en minúscula («vuelve a estar disponible»,
«1 evento no pudo realizarse»): ver R2.

### 2.1 Por archivo y clasificación

| Archivo | Sin migrar | Qué es | Clase |
|---|---:|---|---|
| `index.html` | 555 (≈ 428 únicos) | Lienzo, Más (archivo, interfaz, ayuda y gestos, proyecto), rail, cajones, barra táctil, Propiedades entero, Historias (hoja, biblioteca, modal de evento ≈ 150), zoom, pestañas, diálogos Compartir / Exportar / GIF / sesión guardada / enlace entrante, `<title>`, meta, Open Graph, JSON-LD | **Hardcoded** |
| `js/editor-scenarios.js` | 237 | Hoja de Historias, biblioteca, menús de paso, esperas, mensaje de paso, modal de evento, avisos, validaciones, plantilla `{source} envía a {target}` | **Hardcoded + dinámico** (≈ 70 fragmentos concatenados) |
| `js/config.js` | 143 | ≈ 75 nombres de icono (también **valor sembrado**: la etiqueta del nodo al crearlo), 6 grupos, 12 nombres de paleta, 8 GIFs; ≈ 20 marcas (Kafka, Cloud Run, Azure…) y 14 fuentes que **no** se traducen | Hardcoded / sembrado / no traducir |
| `js/story-authoring.js` | 123 | Errores de autoría por lotes. **No lo carga ni el editor ni el Viewer**: solo el MCP | **Contrato MCP** — fuera (D-MCP) |
| `js/ui.js` | 88 | Panel de Propiedades dinámico, colores, formas, páginas, confirmación de limpiar, cuentagotas; ≈ 12 nombres de tecla y 3 fuentes no se traducen | Hardcoded |
| `js/export.js` | 26 | Errores de abrir/restaurar, GIF (progreso, errores en `alert`), ejemplo incorporado «Funnel de ventas» (9, sembrado) | Hardcoded / sembrado |
| `js/story-playback.js` (kernel) | 23 (+ ≈ 4 no detectados) | 15 errores humanos por código, «X no está disponible», «X vuelve a estar disponible», «No se completó · X…», «Reproducción terminada», «1 evento no pudo realizarse», «Elemento sin nombre» | **Dinámico, pegado a contenido del autor** |
| `js/selection.js` | 22 | Confirmaciones de eliminar (selección, página con Historias), con plurales armados a mano | Dinámico |
| `js/editor-share.js` | 16 | Diálogo de compartir en JS, avisos, errores | Hardcoded |
| `js/interaction.js` | 15 | 3 errores de imagen; 12 nombres de tecla (no se traducen) | Hardcoded / no traducir |
| `js/document-integrity.js` (kernel) | 12 | Mensajes humanos de validación por código | Hardcoded, traducible por código |
| `js/examples.js` | 12 | 8 títulos de ejemplo, diálogo de sesión sin guardar, error | Hardcoded |
| `js/model.js` (kernel) | 10 | «Página 1», «Página N», «Historia N», «Escenario», «Nodo», «Texto», «Origen»/«Destino» | **Valor sembrado** (se guarda en el documento) |
| `js/deeplink.js` | 6 | Enlace entrante, errores | Hardcoded |
| `js/share-loader.js` | 6 | Documento demo (`?s=demo`) | Sembrado |
| `js/viewer.js` | 5 | «Elemento sin nombre», 1 error; 3 teclas | Parcial |
| `js/flow-semantics.js` | 3 | «Ruta disponible / no disponible / Sin ruta de flujo» (duplicados de `editor-scenarios.js`) | Hardcoded |
| `js/link-codec.js`, `render.js`, `state.js`, `present-story.js`, `skin.js`, `geometry.js`, `analytics.js` | 1–2 c/u | Pista de lienzo vacío (`fillText`), «En pausa» de la sonda aria-hidden, restos técnicos, fuentes | Mixto (falsos positivos incluidos) |
| Diálogos nativos `alert/confirm/prompt` | **19** llamadas | Sus botones (Aceptar/Cancelar) los pone el navegador en **su** idioma, no el nuestro | Hardcoded (ver D-DIALOG) |
| CSS | 0 | No hay texto en `content:`. Los tooltips salen de `data-tip` por `attr()` y ya los cubre `data-i18n-tip`. 16 reglas `text-transform:uppercase` (sin efecto en CJK) | — |
| Tests | — | Cientos de aserciones buscan literales en español en código y HTML: siguen valiendo con el español en línea (decisión 261) | — |

### 2.2 Clases (resumen)

| Clase | Cantidad aprox. | Tratamiento |
|---|---:|---|
| **Ya localizado** | 69 claves / 110 usos | Cabecera del editor, Present, Viewer |
| **Parcial** | 4 superficies | Present (frases del kernel), Viewer («Elemento sin nombre», narrativa), Historias (solo `scSetPauseLabel`), sonda de alto de Present |
| **Hardcoded de UI** | ≈ 850–900 únicos | Migrar a `t()` / `data-i18n*` |
| **Dinámico** (concatenación, plurales, números, tiempos) | ≈ 90 sitios | Rehacer como plantilla completa con `{param}` y plurales; números con `Intl.NumberFormat` (hoy se mezclan `"0,3"`, `"10 000"`, `toFixed(1)+" s"`) |
| **Sembrado** (se guarda al crear) | ≈ 12 kernel + ≈ 75 iconos + 2 demos | En el idioma de la interfaz **en el momento de crear**; después es contenido (decisión 260) |
| **Contenido del autor (no traducir nunca)** | — | `label`, nombres de página/Historia/evento, `sentenceTemplate`, `message`, símbolos, `ejemplos/data/*.fluyo.json` una vez abiertos |
| **No traducir (contrato o marca)** | ≈ 60 | Enums del modelo, marcadores `{source}/{target}/{name}`, códigos de error, claves de `ICONS`/`ANIMS`, `?ejemplo=` y sus slugs, nombres de producto, fuentes, nombres de tecla genéricos (Ctrl, Shift, Esc) — pero **sí** «Supr», «Rueda ratón», «Clic derecho» |
| **Contrato MCP** | 123 + descripciones de herramientas | Fuera de este programa (D-MCP) |

**Total a traducir por idioma: ≈ 950–1 050 claves** (≈ 5 000–6 000 palabras), sin `docs/` ni páginas públicas.

### 2.3 Páginas públicas

| Página | Idiomas hoy | Textos |
|---|---|---:|
| `docs/` | es | ≈ 520 |
| `ejemplos/` (galería) | es | ≈ 107 |
| `privacidad/` ↔ `privacy/`, `terminos/` ↔ `terms/`, `soporte/` ↔ `support/` | es + en | ≈ 360 / 115 / 107 cada una |
| `manifest.webmanifest` | es (`name`, `description`, `lang`) | 3 |
| `ejemplos/data/*.fluyo.json` | 8 documentos en español | contenido |

## 3. Cobertura aproximada por superficie (hoy)

| Superficie | Cobertura | Falta |
|---|---:|---|
| Cabecera del editor | 100 % | — |
| Present (editor) | ≈ 85 % | frases del kernel |
| Viewer `/s/` | ≈ 90 % | narrativa del kernel, «Elemento sin nombre» |
| Viewer offline | igual que el Viewer | — (precache ya incluye i18n) |
| Menú Lienzo | 0 % | ≈ 35 |
| Menú Más (archivo, interfaz, ayuda, proyecto) | 0 % | ≈ 95 |
| Rail, cajones de iconos y GIFs | 0 % | ≈ 30 + ≈ 95 nombres |
| Propiedades | 0 % | ≈ 190 HTML + ≈ 75 JS |
| Historias (hoja, biblioteca, menús, modal de evento) | ≈ 1 % | ≈ 150 HTML + ≈ 235 JS |
| Pestañas y menú de página | 0 % | ≈ 15 |
| Diálogos (Compartir, Exportar, GIF, sesión, enlace entrante) | 0 % | ≈ 85 |
| Errores y validaciones del editor | 0 % | ≈ 45 (Viewer: 100 %) |
| Diálogos nativos | 0 % | 19 |
| Estados vacíos / carga | ≈ 30 % | lienzo vacío, biblioteca vacía, «Sin historias»… (Viewer hecho) |
| Onboarding / Ejemplos | 0 % | botón y diálogos; contenido de ejemplos en español |
| Páginas públicas | legales/soporte: es+en; docs/ejemplos: 0 % | fr/ja/zh en todas |
| SEO / manifest | 0 % | es solo |
| **Interfaz del producto (global)** | **≈ 8 %** | ≈ 92 % |

## 4. Arquitectura recomendada

**Mantener decisión 261** (español en línea + diccionario plano por idioma, scripts clásicos, sin build ni `fetch`). Soporta 5 idiomas
y los siguientes. Cuatro ajustes, todos pequeños, en una slice de infraestructura (S0):

1. **Cadena de reserva `idioma → en → es`.** Hoy una clave que falte en japonés cae al español; para quien no lee español, el inglés
   es mejor reserva. Con el test de catálogo exigiendo 0 vacíos, la reserva solo actúa durante la migración.
2. **Etiqueta BCP 47 real en `<html lang>`** (`ja`, `zh-Hans`, `fr`…). `applyDom` pone hoy `lang=current` («zh»): ambiguo para la
   unificación Han (el navegador puede elegir glifos chinos para japonés o al revés) y para `:lang()` en CSS.
3. **Cambio en vivo**: `FluyoI18n.onChange(fn)`; cada superficie que pinta desde JS (Propiedades, Historias, pestañas, Present,
   Viewer) se suscribe a su refresco ya existente. Recargar no sirve en el editor: al volver a cargar aparece «Sesión guardada»
   (`ui.js:1569`) y se pierde Deshacer.
4. **Formato con `Intl`**: `FluyoI18n.num(n, opts)` y `FluyoI18n.secs(ms)` sobre `Intl.NumberFormat`; plurales por categorías del
   idioma (`ja`/`zh` solo `other`; `fr` trata 0 como `one`). El test de catálogo valida que cada idioma traiga las categorías que su
   `Intl.PluralRules` usa.

Además:

- **Diccionarios en dos archivos por idioma**: `js/i18n-<xx>.js` (común + Viewer + Present: lo que carga `s/index.html`) y
  `js/i18n-<xx>-editor.js` (solo editor). El Viewer —la página que abre quien recibe un enlace, a menudo en el teléfono— no descarga
  los ≈ 900 textos del editor en cuatro idiomas. Estimación: editor ≈ 55–65 KB por idioma sin comprimir; parte Viewer ≈ 6–8 KB.
  Todo estático; el test de catálogo comprueba que ninguna clave del Viewer esté en el archivo del editor.
- **Lazy loading: no.** Cargar solo el idioma activo exige carga asíncrona antes del arranque (que hoy llama a `t()` de forma
  síncrona) y complica `file://` y el SW. Con ≈ 250 KB sin comprimir en el editor (≈ 70 KB brotli) para 4 idiomas no compensa.
  Revisar a partir de ≈ 8 idiomas o 600 KB (presupuesto con test).
- **Textos del kernel por código en la frontera**:
  - `document-integrity.js` y `story-playback.js` ya devuelven **códigos** (`ERROR_MESSAGES[code]`): la UI traduce por código
    sin tocar el kernel.
  - Lo que el kernel **compone** con nombres del autor (`caption`, `summary`, `nodeText`, «Reproducción terminada») recibe un
    proveedor de texto opcional (`describe(…, {text})`); sin él, el español de siempre. Kernel cambia → `kernelId` cambia →
    resincronizar `fluyo-mcp` (salida del MCP byte a byte igual).
  - Valores sembrados de `model.js` («Página 1», «Historia N», «Nodo»…): mismo patrón, nombres por defecto inyectables; el MCP sigue
    sembrando en español.
- **Pseudo-idioma de pruebas** (`qps`, solo en el arnés de tests, no se publica): cada `t()` devuelve el texto alargado un 40 % y
  entre corchetes. En Chrome real deja a la vista cualquier texto sin migrar que el escáner no detecta y cualquier control que se
  desborda.
- **Detector de desbordes** en el smoke de navegador: para cada idioma, a 1440 y 390, ningún control con `scrollWidth > clientWidth`
  salvo los que cortan a propósito con elipsis.
- **Añadir un idioma después** = 2 archivos + 2 `<script>` por página + `sw.js` (`ASSETS`/`VIEWER_ASSETS`) + una opción en el
  selector (la lista sale de `FluyoI18n.supported()`, así que en la práctica ni eso). El test de catálogo lo valida igual.

## 5. Diseño del selector

| Aspecto | Propuesta |
|---|---|
| **Editor — ubicación** | Menú **Más**, primera fila de la sección «Interfaz · este navegador» (junto a «Interfaz oscura»): icono de globo + `<select>` nativo «Idioma». Accesible en escritorio y teléfono (Más ya existe en las dos). |
| **Viewer — ubicación** | Pie `#brand`: «Hecho con Fluyo · `[English ▾]`», `<select>` compacto. Oculto en Present como el resto del cromo. |
| **Páginas públicas** | Enlaces a las páginas hermanas en el pie (no el `<select>`), con `hreflang`. |
| **Opciones** | Endónimos, nunca traducidos y con su propio `lang`: Español · English · Français · 日本語 · 简体中文. |
| **Qué idiomas aparecen** | Solo los que tienen diccionario **completo** (gate de test). Un idioma a medias no se ofrece. |
| **Comportamiento** | Inmediato, sin recargar; conserva selección, Deshacer y reproducción; el documento no cambia ni se marca como modificado (test: bytes idénticos y sin autoguardado extra). |
| **Persistencia** | `localStorage["fluyo.ui.lang"]` (ya existe), por navegador, compartida por editor y Viewer (mismo origen). Nunca en el documento (decisión 260). Elegir en el selector con `?lang=` en la URL guarda la elección y quita `?lang` con `history.replaceState`. |
| **Idioma inicial** | `?lang` › preferencia guardada › **`navigator.languages`** (encender `AUTO_DETECT` cuando los 5 estén completos) › inglés si nada coincide (D-AUTO). `es-*`→es, `en-*`→en, `fr-*`→fr, `ja-*`→ja, `zh-*`→zh-Hans (D-ZH). |
| **Reserva** | idioma → en → es (§4.1). |
| **Offline** | Todos los diccionarios precacheados en `ASSETS` y `VIEWER_ASSETS`: cambiar de idioma sin red funciona en editor y Viewer. |
| **Documento compartido** | El enlace no lleva idioma; el Viewer abre en el idioma de quien mira; el contenido sigue en el del autor; «Abrir en Fluyo» conserva el idioma por la preferencia guardada (hoy `?lang` se pierde, pero con selector deja de importar). |
| **`file://`** | Funciona igual (preferencia por origen de archivo). |

## 6. Estrategia para los 5 idiomas

- **Fuente**: español (base, en línea) → **inglés** (se completa slice a slice, como en I18N-001) → **fr / ja / zh** sobre el
  catálogo ya estable (S5), para no retraducir textos que las slices de migración todavía cambian.
- **Glosario por idioma** aprobado antes de S5 (Historia, momento, paso, evento, biblioteca, frase, globo, símbolo, Present, Viewer,
  Lienzo, aspecto plano/construido, ruta observada, disponibilidad, «Esperar a que llegue…», «Al mismo tiempo», «Invertir
  sentido»). Ampliación de la tabla de I18N-001 §4 con columnas fr/ja/zh.
- **Francés**: espacio fino insecable (U+202F) antes de `: ; ! ?` y dentro de « »; textos ≈ 10–20 % más largos que el inglés, del
  orden del español, así que donde cabe el español suele caber.
- **Japonés y chino**: frases completas siempre (nada de fragmentos concatenados: el orden de las palabras cambia); sin plurales;
  sin mayúsculas; textos más cortos en caracteres pero cada carácter ocupa ≈ 1 em.
- **Calidad**: traducción asistida + revisión por hablante nativo para fr/ja/zh (D-QA). Tests: mismas claves, mismos marcadores,
  categorías de plural correctas, sin texto vacío, espacios finos en francés.

## 7. Estrategia tipográfica

Hoy: `--ui-font` = IBM Plex Mono y títulos en Playfair Display, ambos **solo latín**. En japonés o chino cada glifo CJK cae a la
reserva genérica `monospace` / `serif` del sistema, que en Windows suele ser una fuente de mapa de bits antigua o una Mincho/SimSun
fina, muy poco legible a 10–12 px. **No es suficiente.**

| Tema | Propuesta |
|---|---|
| **Webfonts CJK** | **No** autoalojar (Noto Sans JP/SC pesan varios MB incluso subconjuntadas; romperían el presupuesto del Viewer offline). Fuentes del sistema (D-FONT). |
| **Pilas por idioma** | Con `:lang()` sobre `<html lang>`: Plex/Playfair siguen pintando el latín y los dígitos; a continuación, la sans CJK del sistema. ja: `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", "Noto Sans CJK JP"`. zh-Hans: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC"`. |
| **Títulos (Playfair)** | En CJK, sans de peso 500–600, no Mincho/Song (finas a 14–17 px). |
| **Tamaños** | Bajo `:lang(ja)` / `:lang(zh)`: `--fs-micro` 10 → 11 px, `--fs-label` 11 → 12 px; interlineado de lectura 1,6. |
| **Ajustes** | `letter-spacing: 0` y sin `text-transform` en CJK; sin cursiva sintética en el cromo. |
| **Corte de líneas en CSS** | Correcto ya: `overflow-wrap:anywhere` y el corte nativo CJK del navegador. Revisar elipsis (`white-space:nowrap`, 28 reglas) en 390 px. |
| **Lienzo (contenido del autor)** | **Defecto real**: el globo de mensaje (`render.js:346`) corta por espacios (`split(/\s+/)`): un mensaje en japonés o chino, sin espacios, sale en una sola línea que se sale del globo — en el editor, Present, Viewer y la exportación GIF. Cortar con `Intl.Segmenter` (y por carácter como reserva). Afecta a quien **escribe** en CJK, sea cual sea el idioma de la interfaz. |
| **Contenido del autor CJK con interfaz no CJK** | Añadir al final de las pilas base una sans CJK neutra, para que un autor japonés con interfaz en español no vea glifos de mapa de bits. |
| **Medición** | Capturas y detector de desbordes en Chrome real para los 5 idiomas: editor 1440/1024/390, Present, Viewer 1440/390, Viewer en teléfono en horizontal; Windows (Yu Gothic/YaHei), macOS/iOS (Hiragino/PingFang) y Android (Noto CJK) si hay dispositivo. |

## 8. Estrategia offline

- Todos los diccionarios precacheados: `ASSETS` (editor) y `VIEWER_ASSETS` (decisión 262: el test exige que sea exactamente lo que
  carga `s/index.html`, así que añadir un `<script>` obliga a añadirlo al SW — bien).
- Peso añadido estimado: editor ≈ +250 KB sin comprimir (≈ +70 KB brotli); Viewer ≈ +30 KB sin comprimir (gracias a la separación
  común/editor). Presupuesto con test.
- Sin webfonts CJK, nada pesado que precachear para la tipografía.
- Cambio de idioma sin red: funciona (no hay `fetch`). La `?lang=` sin red ya está resuelta (decisión 262, `ignoreSearch`).
- Cada slice que toque archivos servidos sube `CACHE` (v108, v109…).

## 9. Slices propuestas

| Slice | Contenido | Archivos principales | Kernel/MCP | Tamaño |
|---|---|---|---|---|
| **S0 · Infraestructura** | Reserva idioma→en→es; BCP 47 en `<html lang>`; `onChange` y refresco en vivo; `num`/`secs`; plurales por categorías; test de catálogo para N idiomas y dos archivos por idioma; pseudo-idioma en el arnés; detector de desbordes en el smoke; presupuesto de peso | `i18n.js`, tests, `sw.js` | no | S |
| **S1 · Cromo del editor** | Lienzo, Más (incl. ayuda y gestos), rail, cajones, barra táctil, Propiedades, zoom, pestañas y menú de página, diálogos Compartir/Exportar/GIF/sesión/enlace entrante, errores de abrir/imagen/GIF, 19 diálogos nativos, pista del lienzo vacío, nombres de icono/paleta/GIF de `config.js`; en inglés | `index.html`, `ui.js`, `selection.js`, `export.js`, `editor-share.js`, `interaction.js`, `deeplink.js`, `examples.js`, `state.js`, `render.js`, `config.js`* | `config.js` es kernel* | L (puede partirse S1a HTML / S1b JS) |
| **S2 · Historias** | Hoja, biblioteca, menús de paso, esperas, mensaje del paso, modal de evento (≈ 150 nodos), avisos y validaciones; **rehacer ≈ 70 concatenaciones como plantillas**; en inglés | `editor-scenarios.js`, `index.html` (región Historias), `flow-semantics.js` | no | L |
| **S3 · Narrativa y valores sembrados** | Errores del motor y de integridad por código en la UI; proveedor de texto en `describe` (captions, cierre, «Elemento sin nombre»); nombres sembrados inyectables (`model.js`), demo `?s=demo`, ejemplo incorporado; en inglés | `story-playback.js`, `model.js`, `document-integrity.js`, `viewer.js`, `present-story.js`, `share-loader.js`, `export.js` | **sí**: resincronizar `fluyo-mcp` (salida igual) | M |
| **S4 · Tipografía CJK y francés** | Pilas `:lang()`, tamaños, `letter-spacing`, corte del globo con `Intl.Segmenter`, medición con el pseudo-idioma y con ja/zh provisionales | `css/system.css`, `styles.css`, `share.css`, `render.js` (+ `export.js` si el SVG corta igual) | no | M |
| **S5 · Traducciones fr / ja / zh** | Glosarios aprobados; ≈ 1 000 claves × 3; revisión nativa; capturas de los 5 idiomas | `js/i18n-fr*.js`, `-ja*`, `-zh*`, `sw.js`, `<script>` | no | M (volumen) + revisión externa |
| **S6 · Selector y detección** | Selector en Más y en el pie del Viewer; `AUTO_DETECT` encendido; gate «solo idiomas completos»; ratchet a 0 en archivos de UI | `index.html`, `s/index.html`, `ui.js`, `viewer.js`, `i18n.js` | no | S |
| **S7 · Páginas públicas, SEO y ejemplos** | `docs/` y `ejemplos/` como páginas hermanas (`/en/…` y, según D-PAGES, fr/ja/zh); `hreflang`, `sitemap.xml`; legales según D-LEGAL; manifest; ejemplos por idioma según D-EXAMPLES | HTML estáticos, `ejemplos/data/`, `examples.js` | no | M–L según alcance |
| (aparte) **MCP** | Descripciones y errores de autoría siguen en español (D-MCP); tarea propia si se quieren en inglés (presupuesto de catálogo) | `fluyo-mcp` | — | — |

\* `config.js` está en el kernel del MCP: traducir los nombres **visibles** de icono/paleta por clave en la UI (el kernel conserva
sus valores) evita tocarlo; si no, entra en la resincronización de S3.

**Primer hito visible para usuarios**: S0 → S1 → S2 → S3 → **S6 con es/en** (selector público con dos idiomas completos). Después
S4 → S5 añade fr/ja/zh al selector sin tocar más código.

## 10. Dependencias

```text
S0 ──┬─> S1 ──┐
     ├─> S2 ──┼─> S6 (es+en público) ──> S5 (fr/ja/zh visibles en el selector)
     ├─> S3 ──┘                           ^
     └─> S4 ─────────────────────────────┘   (S4 antes de exponer ja/zh)
S7: independiente del código; solo necesita D-PAGES / D-LEGAL / D-EXAMPLES y el glosario.
```

- S1 y S2 tocan `index.html` en regiones distintas: en serie o con un solo escritor por turno (también por la cadena de `undo` de los
  tests y el `CACHE`).
- S3 necesita ventana de sincronía con `fluyo-mcp` (kernelId).
- S5 necesita el catálogo congelado (S1–S3 cerradas) y glosarios aprobados.

## 11. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | ≈ 70 frases armadas con fragmentos («Este evento se usa en » + n + « lugares») no se pueden traducir a ja/zh | Plantillas completas con `{param}` y plurales en S2; test que prohíbe concatenar el resultado de `t()` con literales |
| R2 | El escáner no ve fragmentos en minúscula: inventario y trinquete infravaloran | Pseudo-idioma en Chrome real (S0) como criterio de cierre de cada slice |
| R3 | Frases mixtas inevitables con D-LANG A: «Pago は利用できません» (nombre del autor + texto de Fluyo) | Aceptado por decisión 260; revisar D-LANG B solo si molesta en uso real |
| R4 | Unificación Han: glifos chinos en texto japonés o al revés | `lang` BCP 47 correcto (S0) y pilas separadas (S4) |
| R5 | Fuentes CJK distintas por sistema; Linux sin CJK muestra cuadros | Pilas largas con Noto; documentado como límite |
| R6 | Calidad y terminología de fr/ja/zh sin revisión nativa | D-QA; glosario aprobado antes de S5 |
| R7 | Cambio de kernel → resincronizar MCP y redeploy | Proveedor opcional: el MCP no cambia de salida; test de paridad |
| R8 | Desbordes en cabecera y segmentados (francés, 390 px) | Detector de desbordes + pseudo-idioma +40 % |
| R9 | Coste de mantenimiento de tests: cadena de `undo`, baselines, aserciones de `CACHE` en cada slice | D-TESTS (antigua D9 de I18N-001) |
| R10 | Diálogos nativos con botones en el idioma del navegador | D-DIALOG |
| R11 | Peso del Viewer en teléfono | Separación común/editor + presupuesto con test |
| R12 | Concurrencia con otras sesiones en `index.html` / `editor-scenarios.js` | Una slice de escritura cada vez |
| R13 | Textos legales traducidos con implicaciones de interpretación | D-LEGAL |
| R14 | Atajos: «Supr», «Rueda ratón» son españoles; teclados AZERTY/JIS | Traducir nombres de tecla visibles; atajos sin cambios |

## 12. Estimación de alcance

| Medida | Valor |
|---|---|
| Claves de UI a migrar | ≈ 900–1 000 (más las 69 hechas) |
| Palabras por idioma | ≈ 5 000–6 000 (≈ 20 000 en total para en/fr/ja/zh, sin páginas públicas) |
| Páginas públicas | docs ≈ 520 + galería ≈ 107 textos por idioma; legales ≈ 580 por idioma si se traducen |
| Archivos de código | ≈ 20 JS + 2 HTML + 3 CSS + `sw.js`; 8 archivos de diccionario nuevos (4 idiomas × 2) |
| Sesiones de agente (orden de magnitud) | S0: 1 · S1: 2–3 · S2: 2–3 · S3: 1–2 (+ sync MCP) · S4: 1–2 · S5: 1–2 (+ revisión nativa externa) · S6: 1 · S7: 1–3 según alcance → **≈ 10–17 sesiones** |
| `CACHE` | una subida por slice con archivos servidos (desde v108) |

## 13. Decisiones para el PO

Bloquean el arranque:

- **D-SEL** Ubicación del selector: **Más → Interfaz + pie del Viewer** (recomendado) frente a un botón de globo fijo en la cabecera
  (más visible, pero la cabecera ya está muy ajustada en 390 px).
- **D-AUTO** Encender la detección del idioma del sistema cuando los 5 estén completos, con **«cualquier otro idioma → inglés»**
  (recomendado).
- **D-FALLBACK** Reserva **idioma → inglés → español** (recomendado) frente a → español.
- **D-ZH** Chino **simplificado** únicamente («简体中文», `zh-Hans`), con `zh-TW`/`zh-HK` → simplificado (recomendado) o → inglés.
- **D-ORDER** Inglés en cada slice y fr/ja/zh al final sobre el catálogo estable (recomendado) frente a los 4 idiomas en cada slice.
- **D-QA** Quién revisa fr/ja/zh (hablante nativo) y si se publica un idioma sin esa revisión.

Con recomendación por defecto (confirmar):

- **D-LIVE** Cambio en vivo sin recargar (recomendado).
- **D-SEED** Los valores sembrados («Página 1», «Historia 1», «Nodo», etiqueta del icono «Usuario») nacen en el idioma de la interfaz
  de quien crea y luego son contenido (consecuencia de la decisión 260).
- **D-KERNEL** Textos del kernel: traducción por código en la UI + proveedor de texto opcional en `describe` y en los nombres
  sembrados; el MCP mantiene su español (resincronizar kernel en S3).
- **D-FONT** Sin webfonts CJK: fuentes del sistema por `:lang()`; títulos CJK en sans.
- **D-DIALOG** Mantener `alert/confirm` (botones en el idioma del navegador) por ahora, o sustituirlos por diálogos propios en una
  slice aparte (recomendado: después de S6).
- **D-PAGES** Páginas públicas: `docs/` y `ejemplos/` en inglés seguro; ¿también fr/ja/zh?
- **D-LEGAL** Legales: es y en como hoy, con el español o el inglés como versión de referencia; ¿traducciones informativas fr/ja/zh?
- **D-EXAMPLES** Ejemplos: conjunto propio por idioma (contenido nuevo, revisado) o solo en/es; `?ejemplo=` se mantiene, alias
  `?example=` opcional.
- **D-MCP** El MCP sigue en español (descripciones y errores); tarea aparte si se quiere en inglés.
- **D-TESTS** Las guardas de alcance antiguas excluyen los archivos nuevos de cada slice (`NEW_FILES`), como en I18N-001.
- **D-TELEMETRY** (opcional) Medir el idioma elegido como valor de lista cerrada (`es|en|fr|ja|zh`) en la telemetría; exigiría
  actualizar la política de privacidad publicada. Recomendado no hacerlo en este programa.

## Handoff

- **Sesión 1 (plan)**: auditoría del texto visible sobre `53552a2`, clasificación, cobertura, arquitectura, plan en 8 slices
  (secciones 1–13 de arriba). El PO respondió las decisiones bloqueantes al encargar S0 (ver «S0 · Infraestructura»).
- **Sesión 2 (S0)**: infraestructura para cinco idiomas implementada y verificada sobre `bb7881a` (`CACHE` v109); detalle,
  archivos, verificación, conflictos con SHELL, riesgos y decisiones en la sección S0. **Sin commit, sin push, sin deploy.**
  Decisiones 269–274 en `.ai/DECISIONS.md`; sección «Idioma de la interfaz» en `.ai/ARCHITECTURE.md`.
- **Fuera del commit de S0**: los `.ai/tasks/*` de otras sesiones que ya estaban modificados en el árbol (018.29, 018.30, I18N-001,
  STEP-MESSAGE-001, PRODUCT-NARRATION-001, SCENARIOS-SEMANTICS-001, STEP-REVERSE-003, SW-VIEWER-001, 019.4, EXAMPLES-001).
- **Si otra tarea entra antes que S0**: regenerar `test/fluyo-i18n-002-s0-undo.cjs` (script de la sesión: piezas del `git diff -U2`
  de los 9 archivos servidos de §Archivos contra la base, sin el trozo de `CACHE`; `js/i18n.js` y `js/i18n-en.js` enteros), subir
  `CACHE` y ajustar `BASE` en `test/fluyo-i18n-002-s0.test.cjs`.
- **Sesión 3**: el PO aprobó S0 y fijó D-S0-2/3 (decisiones 271 y 275); commit local de S0 (sin push ni deploy) y propuesta de
  glosario (`.ai/I18N-GLOSSARY.md`, fuera del commit de S0, para revisión).
- **Próximo paso concreto**: OK del PO para S1 y validación del glosario. Push/deploy de S0, cuando el PO lo pida. Después
  **S1 · cromo del editor** en inglés (`CACHE` v110): migrar `index.html` y los JS del editor
  con `FluyoI18n.t`/`data-i18n`, ampliar `js/i18n-en-editor.js`, suscribir sus pintores a `onChange`, `--write-baseline`, y medir
  con el pseudo-idioma (`test/i18n-pseudo.cjs`) que no quede texto sin marca.
