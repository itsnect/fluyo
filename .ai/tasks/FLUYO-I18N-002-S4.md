# FLUYO-I18N-002 · S4 — Tipografía y layout para japonés y chino simplificado (auditoría)

Estado: **S4 READY FOR REVIEW** (2026-10-27). Auditoría **solo lectura**: sin código, sin tests, sin `CACHE`, sin diccionarios, sin
decisiones nuevas, sin commit/push/deploy. Base inspeccionada: `a0919e6` (S1 en producción) **más** el árbol de trabajo de S2a
(`js/ui.js`, `editor-scenarios.js`, `viewer.js`… modificados sin commit; solo se leyó, nada se tocó). `CACHE` visto: v111.
Alcance por encargo: japonés (`ja`) y chino simplificado (`zh-Hans`). **El francés del plan original de S4 no se audita aquí.**

> Repo público: este archivo solo contiene contenido técnico apto para publicarse. Los volcados y scripts de medición viven en el
> scratchpad de la sesión (§13), no en el repo.

> **ACTUALIZACIÓN (2026-10-27): D-S4-1…10 aprobadas y slice implementada, SIN COMMIT. Ver «Slice S4: decisiones aprobadas e
> implementación» al final.** Lo de arriba es la auditoría tal como se entregó (base: S2a sin commit); S2a se commiteó después (`326872e`).

## 0. Resumen ejecutivo

1. **S0 ya resolvió la tipografía del *cromo* (la interfaz)**: `--font-cjk` + `:lang(ja)`/`:lang(zh)` hacen que la UI pinte con
   *Yu Gothic UI* / *Microsoft YaHei UI* (medido con CDP), nunca con MS Gothic/SimSun. Con textos de longitud natural la interfaz
   migrada **no se rompe** (0 recortes nuevos salvo 2 grupos, §4).
2. **Lo que queda es el *contenido del autor* y todo lo que pinta el lienzo**, que ignora el sistema de fuentes de la UI. Defectos
   reales, medidos en Chrome 156/Windows:
   - **P1 · El globo de mensaje no parte texto sin espacios** (`render.js:346`, `split(/\s+/)`): un mensaje japonés de 20 caracteres
     sale en **1 línea de 252 px en una caja de 226 px**; uno de 60, en una línea de **879 px**. Afecta a quien escribe en CJK con
     cualquier idioma de interfaz.
   - **P2 · El lienzo, el PNG/JPG y el GIF no usan la misma fuente**: el lienzo adjunto sigue `<html lang>`, el canvas de exportación
     (`document.createElement("canvas")`) no. Con interfaz en japonés el editor pinta *Yu Gothic* y el PNG/GIF mezcla *Yu Gothic*
     (kana) + *Microsoft YaHei* (kanji, **formas chinas**). Ancho medido: 264 px (editor) frente a 272 px (exportación) para el mismo texto.
   - **P3 · Fuente por defecto del documento (Georgia, serif)**: con interfaz en chino cae a **SimSun** (Song fina, con mapas de bits
     embebidos a 12–16 px); con interfaz en japonés los estilos `Courier`/`IBM Plex Mono`/`Mono` caen a **MS Gothic**.
   - **P4 · Los nodos `code` rejillan por carácter a 0,6 em** (`CODE_ADV`): cada glifo CJK mide 1 em y **se solapa con el vecino**
     (captura en §5). Es kernel compartido con el MCP.
   - **P5 · `input.size = nº de caracteres`** (frase del evento, `editor-scenarios.js:2377`): el campo mide ≈ 0,6 em por carácter; el CJK
     necesita 1 em → texto recortado (38 px de texto en 30 px de campo, ya con longitud natural).
   - **P6 · IME**: tres `Enter` que confirman (renombrar página `ui.js:997`, renombrar Historia `editor-scenarios.js:1399`, mensaje del
     paso `:1924`) **no comprueban `isComposing`/`keyCode 229`**: con un IME japonés/chino el Enter que *acepta la conversión* confirmaría el campo.
     (Hallazgo estático; el comportamiento exacto depende del navegador: a confirmar con IME real, §7.)
3. **Lo que no hace falta**: webfonts CJK. Con fuentes del sistema el coste en Service Worker es **0 KB** y offline funciona
   (medido: SW v111, red cortada, `?lang=ja` pinta *Yu Gothic UI Semibold*). Alternativas autoalojadas cuestan **del orden de 0,4–1 MB
   por idioma y peso** (estimación, §6).
4. **Qué se puede implementar ya, sin depender de S2/S3**: P1, P2, P3 (render/export, sin kernel), tokens y literales de CSS, tooltip,
   `font-synthesis`, puntuación. **Lo que espera**: P5/P6 (archivos de S2 con cambios sin commitear), P4 (kernel + MCP) y la
   comprobación final con cadenas reales (S5).

## 1. Método

Chrome 156 real (Windows 11), arnés CDP propio (sin Playwright) sobre un servidor estático de solo lectura del repo.

| Prueba | Qué mide |
|---|---|
| Sonda de fuentes | `CSS.getPlatformFontsForNode`: familia **real** que pinta cada carácter, para cada pila (`FONTS` ×14 + tokens) × `<html lang>` (es/ja/zh-Hans) × texto ja/zh |
| Lienzo | `measureText` de canvas adjunto/desacoplado/`OffscreenCanvas`, con `lang` del documento, `canvas.lang` y `ctx.lang` |
| Cobertura | lector propio de `cmap` (TTC/TTF) de Yu Gothic, YaHei, MS Gothic, SimSun, Malgun frente a JIS X 0208 (6 356 Han) y GB 2312 (6 763 Han) |
| Barrido de desbordes | diccionario **artificial** ja/zh con las 625 claves del catálogo (texto CJK rotado con latín, cifras, unidades y puntuación; marcadores `{x}` intactos) y documento con etiquetas/mensajes/Historias en CJK. Dos longitudes: **natural** (0,45 × los caracteres del español ≈ 0,45 em/car.) y **hostil** (0,9 ×: ≈ 1,5 × el ancho del español). 10 estados × 4 viewports × 2 idiomas × 2 longitudes. Se resta la **línea base en español** (mismo detector) |
| Viewer | enlace de Historia generado desde el editor con el documento artificial; listo / reproduciendo / paso 3 / Present, 1440, 390 y 844×390 |
| Offline | SW instalado, red cortada (servidor + CDP), recarga con `?lang=ja` |
| Capacidades CSS | `CSS.supports` de `word-break:auto-phrase`, `line-break:strict`, `text-autospace`, `text-spacing-trim`, `field-sizing`, etc.; `Intl.Segmenter` ja/zh |

Estados del barrido: base · propiedades (nodo) · propiedades (flecha) · Más · Lienzo · Compartir · Exportar · Historias · diálogo
de evento · Present. Viewports: 1440×900, 1024×768, 390×844 táctil, 844×390 táctil.

**Límite del método (importante):** solo hay ≈ 625 claves migradas; el resto del cromo (Historias en gran parte, ayuda, diálogos
sin migrar) sigue en español y, por tanto, **no puede medirse con japonés/chino hasta S2/S3/S5**. Para esas superficies la
auditoría es estática (CSS y JS) y está marcada como tal en §3.

## 2. Inventario de fuentes

### 2.1 Servidas (autoalojadas, OFL)

| Archivo | Peso | Cobertura (`unicode-range`) | Uso |
|---|---|---|---|
| `ibm-plex-mono-latin-400.woff2` | 14 708 B | Latín básico + Latín-1 + `U+2000–206F` (puntuación general) + `€ ™ ↑ ↓ − ∕` | `--font-mono` (todo el cromo) |
| `ibm-plex-mono-latin-500.woff2` | 14 888 B | ídem | botones, rótulos, kickers |
| `playfair-display-latin-400.woff2` | 21 856 B | ídem | `--font-serif` (títulos, marca, nombres de página) |
| Total | **≈ 51 KB** | solo latín | precacheadas en `ASSETS` y `VIEWER_ASSETS` |

Ningún glifo CJK, ni `→ ← ● ■ ▶ ✕ ⋯ ✓`, ni kana, está en esas fuentes: **todo glifo no latino cae a la pila**.

### 2.2 Pilas del sistema (`css/system.css`)

- `--font-cjk` (base, para contenido del autor en cualquier idioma): Hiragino Sans → Hiragino Kaku Gothic ProN → Yu Gothic UI → Yu Gothic →
  Meiryo → PingFang SC → Microsoft YaHei UI → Microsoft YaHei → Noto Sans CJK JP/JP → Noto Sans CJK SC/SC.
- `:root:lang(ja)` → Hiragino… Yu Gothic UI… Meiryo, Noto Sans CJK JP, Noto Sans JP, Source Han Sans JP.
- `:root:lang(zh)` → PingFang SC, Hiragino Sans GB, Microsoft YaHei UI, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, Source Han Sans SC.
- `:root:lang(ja), :root:lang(zh)`: `--fs-micro 11`, `--fs-label 12`, `--fs-field 12`, `--track-micro 0`, `--case-kicker none`,
  y `* { text-transform:none !important }`.
- `--font-serif` y `--font-mono` terminan en `var(--font-cjk)` **antes** de la genérica.

### 2.3 Fuentes del *documento* (config.js `FONTS`, 14 entradas) y del mensaje (`model.js NODE_MESSAGE_FONT_STACK`)

Georgia (**por defecto del documento**), Times, Palatino, Segoe UI, Arial, Verdana, Trebuchet, Tahoma, Courier, Impact, Comic Sans, Playfair
Display, IBM Plex Mono, Mono. Mensajes: `Georgia, serif` · `'Segoe UI', system-ui, …` · pila mono. **Ninguna lleva familia CJK**:
el navegador elige la reserva por su cuenta (§3, P2/P3). Son kernel (`config.js`, `model.js`): cambiarlas obliga a resincronizar el MCP;
por eso la propuesta añade la reserva **en tiempo de dibujo**, sin tocar el documento (§8).

### 2.4 Qué pinta Chrome de verdad (medido, Windows)

Texto japonés (24 glifos CJK) y chino (15) en cada pila, según `<html lang>`:

| `<html lang>` | Pila | Japonés pinta con | Chino pinta con |
|---|---|---|---|
| ja | `var(--font-mono/serif)` (cromo) | Yu Gothic UI ✔ | Yu Gothic UI (11) + SimSun (4 signos) ✘ formas japonesas |
| ja | Georgia, Segoe UI, Arial… | Yu Gothic ✔ | Yu Gothic + SimSun |
| ja | Courier, IBM Plex Mono, Mono | **MS Gothic** ✘ | MS Gothic + SimSun |
| zh-Hans | `var(--font-mono/serif)` (cromo) | YaHei UI (formas chinas) | YaHei UI ✔ |
| zh-Hans | Georgia, Times, Palatino, Playfair | **SimSun** ✘ | **SimSun** ✘ |
| zh-Hans | Courier, IBM Plex Mono, Mono | NSimSun ✘ | NSimSun ✘ |
| zh-Hans | Segoe UI, Arial, Verdana… | YaHei ✔ | YaHei ✔ |
| es (o cualquier otra) | todas | **Yu Gothic (kana/signos) + YaHei (kanji)** ✘ mezcla | YaHei ✔ (con `--font-cjk` base: Yu Gothic UI 11 + YaHei UI 4 ✘ mezcla) |

La fila `es` explica un caso real: autor japonés con interfaz en español → kana de una familia y kanji de otra, con **formas chinas**.
Tabla completa: `probe1.json` (§13).

## 3. Problemas encontrados

Gravedad: **A** rompe lectura/uso · **M** degrada · **B** menor. Evidencia: **M**edido · **E**stático · **N**o medido (limitación).

| # | Problema | Dónde | Grav. | Ev. | Detalle |
|---|---|---|---|---|---|
| P1 | Globo de mensaje sin corte CJK | `render.js:346` (`computeNodeCueLayout`) | **A** | M | Parte solo por `/\s+/`. Caja 180 px, posición «arriba», 14 px: ja 20 car. → 1 línea de 252 px (caja útil 226); ja 60 → 879 px; zh 60 → 672 px; mixto con cifras → 2 líneas de 421 px. «Centro» (96–170 px): ja 20 → desborda **96 px**. Mismo código dibuja editor, Present, Viewer y los fotogramas del GIF. Latín 60 car. → 3 líneas, 0 px de desborde |
| P1b | Vista previa del globo | `css/styles.css:733` `.scPreviewMessage` | B | E | `overflow-wrap:anywhere` y `max-width:180px`: corta bien (no replica el corte del lienzo: la previa y el lienzo discreparán de líneas) |
| P2 | Canvas de exportación sin `lang` | `export.js:472, 544` | **A** | M | Lienzo adjunto con `<html lang=ja>`: ancho 264; canvas desacoplado / `OffscreenCanvas`: 272 (reserva por defecto del sistema = mezcla Yu Gothic + YaHei). `ctx.lang='ja'` y `canvas.lang='ja'` **sí** lo corrigen (Chrome 156; confirmado también en el canvas desacoplado y en `OffscreenCanvas`: 264 px). Firefox/Safari: **N** |
| P2b | SVG exportado sin `xml:lang` ni reserva CJK | `export.js:190, 233, 386` | M | E | `font-family` = pila del documento; el SVG abierto fuera de Fluyo usa la reserva del sistema de quien lo abre |
| P3 | Fuente por defecto del documento | `config.js` `FONTS[0]` | **A** (zh) / M | M | zh-Hans + Georgia → **SimSun** (Song, delgada, con mapa de bits a tamaños pequeños). ja + Courier/Plex/Mono → **MS Gothic** (`⋯ ✕ ↻` también salen de MS Gothic). Default `Georgia` en ja → Yu Gothic (correcto) |
| P4 | Nodo `code` con rejilla 0,6 em | `geometry.js:721–760` `CODE_ADV`, `render.js:272` | **A** | M | `fillText(tk.t[j], x + j·adv)`: cada glifo CJK (1 em) ocupa 0,6 em y **se pisa con el siguiente** (captura §5). Además indexa por unidad UTF-16: un par sustituto (emoji, kanji extendido) se parte. Kernel compartido con el MCP |
| P5 | `input.size` por nº de caracteres | `editor-scenarios.js:2377, 2381` | **A** | M | Frase del evento (S2): texto de 3 car. = 38 px en un campo de 30 px → recorte con longitud natural |
| P6 | Enter sin guarda de IME | `ui.js:997`, `editor-scenarios.js:1399, 1924` | **A** | E | Solo `interaction.js:1062` (etiqueta del lienzo) y `editor-scenarios.js:3318` (nombre del evento) protegen `isComposing`/229. En Chrome el Enter que acepta la conversión llega con `isComposing=true`/229; en Safari tras `compositionend` con `keyCode 229` |
| P7 | Puntuación y símbolos de Plex dentro de texto CJK | `unicode-range U+2000–206F` | M | M | `“ ” ‘ ’ … — – · •` los pinta **IBM Plex Mono a 0,6 em** dentro de frases ja/zh (7,2 px a 12 px) en lugar del glifo CJK (YaHei UI: `“` 4,5 px; `…` 9,8; `—` 13 px). En chino, `……` y `——` quedan cortos y sin su altura centrada. Mezcla de familias en una misma frase |
| P8 | Símbolos de interfaz con fuente distinta por idioma | texto con `▶ ✕ ⋯ ↻ ✓ ⚠ ⇄ ⏭` en diccionarios y JS | M | M | Anchura en 12 px: `▶` 12 (ja, Yu Gothic UI) / 10,3 (zh, Segoe UI Symbol); `⋯` 6 (ja, **MS Gothic**) / 10 (zh, Cambria Math); `✕` 12 / 9,8; `✓` 12 / 9. Alineación y ancho de botones distintos por idioma y plataforma |
| P9 | Literales de tamaño ≤ 11 px que no pasan por tokens | `styles.css` | M | E | 16 selectores: `.iconGrid button` 9 px, `.rail button` 9,5, `.scVisualSeg .s1` 9, `.scDropLine span` 10, y 12 más a 11 px (`.scFlowEnds/Rows`, `.scLibraryHint`, `.scWaits`, `.scTogether`, `.scPhraseInsert button`…). El bloque `:lang()` solo sube los *tokens* (`--fs-*`): estos quedan a 9–11 px. Lo más serio: **nombres de icono** (9 px) en el cajón de iconos |
| P10 | Peso 500 → sin diferencia en chino | botones de cabecera, kickers, `.seg` | M (ja) / E (zh) | M | Yu Gothic UI: 500/600 → *Semibold* (medido: hay jerarquía). YaHei UI solo tiene 300/400/700 (archivos `msyhl/msyh/msyhbd`): por la regla de coincidencia de pesos **500 se pinta como 400** y 600 como 700 (derivado, no capturado). La jerarquía de botones y rótulos (500 vs 400) se pierde en chino |
| P11 | Cursiva sintética | `styles.css:582` `.scStepMessage{font-style:italic}` | B | E | Ni Yu Gothic UI ni YaHei UI tienen cursiva: el navegador **inclina** los glifos (ilegible a 12 px) |
| P12 | Cifras de Playfair con estilo antiguo junto a CJK | títulos | B | M (captura) | «約250ms», «数字123» en títulos se ven con cifras *old-style* de Playfair, junto a trazo sans CJK. Es estética (`font-variant-numeric: lining-nums`); decisión de producto |
| P13 | Latín mono dentro de CJK | cromo | B | M (captura) | «Kafka», «ABC», cifras en Plex (0,6 em, serifas) entre kana proporcional: huecos visibles. Inevitable con Plex; mitigable con `text-autospace` o aceptable |
| P14 | Título de Historia con nombre largo no elipsa | `styles.css:491` `#scScenarioTitle` | M | M | **Preexistente e independiente del idioma**: latín de 40 car. sin espacios desborda 142 px; con espacios 154 px; ja 20 car. 98 px; zh 20 car. 85 px. Un texto anónimo dentro de un `inline-flex` no recibe `text-overflow` |
| P15 | Encabezado a 390 px con rótulos hostiles | `#btnShare .lbl` etc. | B | M | Con rótulos de 9 caracteres CJK (1:1 con el español) «Compartir» sale 5 px del viewport; con longitud natural (2–4 car.) cabe. No hay traducción real tan larga: **riesgo teórico** |
| P16 | Tooltips `nowrap` sin ancho máximo | `system.css:365` `[data-tip]::after` | B | E | Una cadena larga no parte ni se limita al viewport; las posiciones `start/end` mitigan solo la cabecera |
| P17 | `line-height:1` con CJK | 17 reglas en `styles.css`, 4 en `share.css`, 5 en `pages.css`, 4 en `system.css` | B | E | Con una línea no hay recorte (el barrido no lo detectó); si un rótulo parte en dos líneas, la métrica de Yu Gothic UI/YaHei UI (≈ 1,3 em) rozaría o pisaría la línea contigua |
| P18 | `<pre>`/`code` con CJK | `pages.css:138` | B | E | `white-space:pre` + mono 0,6 em: arte ASCII o tablas alineadas con CJK pierden la columna (1 em ≠ 0,6 em). Afecta a S7 |
| P19 | Contenido del autor en otro idioma sin `lang` | cualquier superficie | B | E | Un nombre en español dentro de UI japonesa se lee con voz y formas japonesas. Mejora de accesibilidad, no visual |
| P20 | Han en español con `--font-cjk` base | texto zh bajo interfaz es/en | M | M | La base prioriza Yu Gothic UI/Hiragino: los hanzi **simplificados** que Yu Gothic UI no tiene (2 238 de 6 763 GB 2312) caen a YaHei UI → **dos familias en una misma palabra china**. Medido: Yu Gothic UI 11 + YaHei UI 4 |

### Qué **no** falló (medido)

- La interfaz migrada con longitud natural: **254 filas nuevas respecto al español → 17 grupos únicos**; solo **2** ya fallan con longitud
  natural (P5, P14). Cabecera del editor a 390 px, Más, Lienzo, Compartir, Exportar, propiedades, Present y Viewer (1440/390/844×390): sin recortes nuevos.
- Presentación del Viewer con mensaje y título CJK largos: truncados con elipsis donde está diseñado (`stTitle`, `stCaption`, `stSummary`,
  `stKicker`) y con `overflow-wrap:anywhere` donde se narra; `text-outside-y` de 2–4 px en `a.logo`, `#stProgress`, `#prPos` (cifras con
  `line-height:1`) existen igual en latín: no son de CJK.
- Tablas de fuentes y cobertura (§4): **sin tofu** en los conjuntos estándar.
- Offline (§9).

## 4. Cobertura de glifos

Lector de `cmap` sobre las fuentes de Windows (conjuntos: JIS X 0208 = 6 953 caracteres, 6 356 Han; GB 2312 = 7 614, 6 763 Han):

| Fuente | JIS X 0208 Han | GB 2312 Han | Notas |
|---|---|---|---|
| Yu Gothic / Yu Gothic UI (todos los pesos) | **6 356 / 6 356** | **4 525 / 6 763** | **faltan 2 238 hanzi simplificados** (这 们 说 对 …) → caen a YaHei |
| Microsoft YaHei / YaHei UI (400/700; Light) | 6 356 / 6 356 | 6 763 / 6 763 | sin cursiva; sin peso 500/600 |
| MS Gothic (legado, mapa de bits/mono) | 6 356 / 6 356 | 4 488 / 6 763 | lo que Chrome elige si falla Yu Gothic UI en `ja` (símbolos) |
| SimSun / NSimSun | 6 356 / 6 356 | 6 763 / 6 763 | Song, con bitmaps embebidos |
| Malgun Gothic | 5 251 / 6 356 | 3 650 / 6 763 | solo referencia (coreano) |

- **Kana, puntuación CJK (`U+3000–303F`), formas de ancho completo (`U+FF00–FFEF`)**: cubiertas por Yu Gothic UI y YaHei UI.
- **Sin glifo (tofu)** en las muestras de interfaz medidas (kana, kanji, `「」『』、。・：；！？～〜ー（）【】《》`): ninguno. Los símbolos
  de interfaz sin glifo en Plex/CJK (`▶ ⏭ ⏮ ⚙ ↻ ⇄ ⋯ ✕ ✓ ⚠`) los resuelve Segoe UI Symbol / Cambria Math / MS Gothic (**no tofu, pero familia distinta por idioma**, P8).
- **No verificado** (limitación): macOS/iOS (Hiragino, PingFang), Android (Noto CJK), Linux sin CJK (mostraría cuadrados: límite ya
  documentado en S0), y hanzi/kanji **fuera de los conjuntos estándar** (nombres propios, CJK Ext. B). La cobertura contra las cadenas
  reales de S5 se calcula con el mismo lector en cuanto existan (§9, test 11).
- El HTML/diccionarios actuales usan además emoji (`💵 📦 👤 📨`) por *Segoe UI Emoji*, indiferente al idioma.

## 5. Superficies (las 18 del encargo)

M = medido en Chrome real · E = estático · N = no medible aún (texto sin migrar) o no ejecutado.

| # | Superficie | Estado | Resultado |
|---|---|---|---|
| 1 | `system.css` y fuentes actuales | E+M | §2; cromo correcto en ja/zh |
| 2 | Fuentes CJK de S0 | M | Yu Gothic UI / YaHei UI; sin MS Gothic/SimSun en el cromo. P20 (zh bajo es/en), P7, P8, P10 |
| 3 | Editor (cabecera, rail, propiedades, Más, Lienzo) | M (claves migradas) + E | Sin recortes nuevos con longitud natural; P9 (literales ≤ 11 px), P10, P15 teórico |
| 4 | Historias | M parcial + E | La hoja está en gran parte sin migrar (N). P5, P11, P14. 12 selectores `scXxx` a 11 px (P9) |
| 5 | Present | M | Mando y rótulo sin recortes (1440/390/844×390); título/leyenda con elipsis donde se diseñó |
| 6 | Viewer | M | `stTitle/stCaption/stSummary/stKicker` truncan con elipsis a 390; narrados parten (`anywhere`); sin scroll horizontal |
| 7 | Páginas públicas (`docs/`, `ejemplos/`, legales, 404) | E | Cargan `system.css`: el bloque `:lang()` aplica si el `<html lang>` estático es `ja`/`zh-Hans` (`:lang(zh)` también capturaría `zh-Hant`). `pages.css` mantiene 5 `letter-spacing` y 3 `text-transform` (anulados por `*{…!important}`). P18. Pertenece a S7 |
| 8 | Diálogos | M parcial | Compartir, Exportar y evento medidos; `scDetailsDialog`, `confirm/alert` nativos (fuente del SO, fuera de control) no |
| 9 | Botones | M | Único objetivo < 24 px: `.scStoryRepair` (22 px de alto), idéntico en español (línea base). Táctil 44 px. P10 |
| 10 | Tooltips | E | P16 |
| 11 | `aria-label` | E | Se traducen por `data-i18n-aria-label`; sin efecto visual. P19 |
| 12 | Inputs | M+E | P5, P6; `font-size:16px` en táctil ya cubierto; `placeholder` hereda la fuente |
| 13 | Mensajes / narración | M | P1 (globo), Viewer correcto; el texto del autor llega íntegro al DOM |
| 14 | Etiquetas del lienzo | M | P2, P3; el nodo reduce la fuente hasta `LABEL_MIN_FS = 10` y **no parte** (igual que en latín: ja 30 car. → 10 px y 138 px de desborde; ja 14 car. → 10,8 px; ja 8 → 17 px). El CJK llega al límite con ≈ 55 % de los caracteres que el latín |
| 15 | Export / GIF | M parcial | P2 con canvas real; PNG/GIF **extremo a extremo no ejecutados** (N); SVG: P2b |
| 16 | Móvil vertical (390×844) | M | P15 teórico |
| 17 | Móvil horizontal (844×390) | M | sin hallazgos nuevos; P15 teórico |
| 18 | Offline | M | §9 |

Capturas de evidencia en el scratchpad (`shots/`): editor ja hostil 1440 (`ja-hostile-1440x900-historias.png`), Viewer ja 390 con paso 3
(`viewer-ja-390x844m-paso-3.png`), **nodo `code` con japonés (`code-node-ja.png`: glifos solapados)**.

## 6. Alternativas de fuente y peso

Peso medido hoy: precache del editor **1 207 KB** (372 KB brotli), del Viewer **540 KB** (197 KB brotli); de ellos 50 KB son fuentes.
Las estimaciones de las alternativas **no se han medido** (no se descargó ninguna fuente): son órdenes de magnitud a confirmar con un
subconjunto real (`pyftsubset`) antes de decidir.

| Opción | Qué es | Peso añadido (estimado) | Offline | Calidad | Riesgo |
|---|---|---|---|---|---|
| **A · Sistema + pilas por `:lang` (hoy, S0)** | sin cambios | **0** | ✔ | Windows ✔ medido; macOS/iOS/Android sin medir | Linux sin CJK: cuadrados |
| **B · A + reserva CJK en el dibujo y la exportación** | sufijo `--font-cjk` en `objFont`/export y `ctx.lang` | **≈ 0 (≈ 1 KB de código)** | ✔ | resuelve P2/P3/P20 sin tocar kernel | depende de las mismas fuentes del sistema |
| **C · B + web-font autoalojada solo como red (`local()` primero)** | `@font-face{src:local(…), url(subconjunto.woff2)}`; se descarga solo si el sistema no tiene la fuente | 0 para casi todos; el archivo vive en el repo (≈ 0,4–1 MB por idioma y peso, en estimación) | cacheo en ejecución (no precache): offline solo tras la primera carga | uniforme en Linux/ChromeOS mínimo | licencia OFL y alojamiento; no cubre el contenido del autor fuera del subconjunto |
| **D · Subconjunto del vocabulario de la UI (Noto Sans JP/SC), precacheado** | ≈ 700–1 200 glifos por idioma para las ≈ 1 000 claves | ≈ **0,4–0,9 MB por idioma y peso** raw woff2 (Viewer ≈ de 197 KB brotli a 0,6–1,2 MB) | ✔ | idéntica en todas las plataformas para la UI | rompe el presupuesto del Viewer en teléfono; el contenido del autor no queda cubierto; 2 pesos = ×2 |
| **E · Noto Sans completo por `unicode-range` en trozos (estilo Google Fonts)** | ≈ 100–120 trozos | ≈ **4–5 MB por idioma** si se precachea; 100–400 KB por vista en ejecución | solo trozos visitados | máxima | inviable para el Viewer offline; pide red |
| F · Pesos adicionales (500/600) | mismas familias | ×1,5–2 sobre C/D | — | arregla P10 en chino | peso |

Notas: el *Service Worker* hoy es *cache-first*, atómico (`cache.addAll`): añadir megas al `ASSETS` alarga la instalación y la hace
fallar en redes malas (decisión 262 mantiene el Viewer ligero). Cualquier opción C–F exige subir `CACHE` y un test de presupuesto.

## 7. Estrategia de QA (cómo demostrar el cierre)

### 7.1 Corpus artificial (público, apto para el repo)

Cadenas fijas, sin traducir nada real, que se aplican como **diccionario `ja`/`zh` de pruebas** (como `qps`, ya existente) y como
**contenido del autor** (etiquetas, mensajes, nombres de página/Historia, frases):

| Id | Contenido | Falla si… |
|---|---|---|
| `JA_NOSPACE_20` | 注文を受け付けて支払いを確認しました | el globo no parte; hay scroll horizontal |
| `JA_NOSPACE_120` | oración continua de 120 car. con 、。 | se sale del globo/tarjeta; se corta a media palabra sin necesidad |
| `ZH_NOSPACE_60` | 订单已接受并确认付款，随后通知仓库团队。 | ídem |
| `MIX_UNITS` | 注文ID 12345 を受付→Kafka経由で在庫(v2.1)へ、応答は約250ms。 | separa «250» de «ms», parte «Kafka» o la versión |
| `KINSOKU` | `…確認」、。）` ubicados en el borde | una línea empieza por `。、」）！？ー` o termina en `「（` |
| `QUOTES_ELLIPSIS` | 「引用」“引用”……—— | mezcla familias o anchos distintos en un mismo signo |
| `EMOJI_CJK` | 📦在庫👤 + par sustituto 𠮷 | se parte un par sustituto o se solapa |
| `LATIN_URL` | 40 car. latinos sin espacios + CJK | el latín fuerza el desborde de la caja |

### 7.2 Oráculos (qué demuestra cada afirmación del encargo)

| Afirmación | Oráculo automático (Chrome real, CDP) |
|---|---|
| Japonés/chino **sin espacios** funciona | `JA_NOSPACE_*`/`ZH_NOSPACE_*` en globo, tarjetas, leyenda del Viewer: cada línea ≤ ancho útil; `lines.length ≥ 2` cuando excede; `lines.join("") === mensaje sin espacios de borde` |
| **Sin clipping** | `scrollHeight ≤ clientHeight+1` y rectángulo de cada texto dentro de su caja (± 1,5 px) en todo elemento con `overflow:hidden/clip`, salvo lista blanca de elipsis |
| **Sin desborde horizontal** | `documentElement.scrollWidth ≤ innerWidth` y ningún texto con `right > innerWidth` en 1440/1024/390/844×390 y 320×568 |
| Los mensajes del usuario **intactos** | `textContent` del DOM == cadena del documento (bit a bit); en canvas, el diseño (`lines`) no pierde, añade ni reordena caracteres; el documento serializado es idéntico antes y después de cambiar de idioma |
| **Jerarquía visual** | tamaños mínimos (≥ 12 px de texto en CJK salvo lista blanca), pares kicker/título/cuerpo con tamaño o peso distintos, contraste sin cambios |
| **Escritorio y móvil** | los 5 viewports, ratón y táctil (`pointer:coarse`), objetivo ≥ 24 px (ratón) / 44 px (táctil) |
| **Offline** | SW instalado → red cortada → recarga `?lang=ja`/`zh`: mismas fuentes pintadas y **cero peticiones de tipo Font/Stylesheet a red** |
| **No se rompe es/en** | (a) el CSS nuevo solo bajo `:lang(ja)`/`:lang(zh)` o sobre tokens nuevos (comprobación estática del diff); (b) capturas de zona de es y en **idénticas píxel a píxel** a la base, como en S0; (c) `getComputedStyle` de una lista de elementos clave idéntico |

### 7.3 Pruebas concretas a escribir

1. `fluyo-i18n-002-s4.test.cjs` (Node, sin navegador): algoritmo de corte del globo (puro, con `Intl.Segmenter` simulado y real) con el
   corpus; kinsoku; pérdida cero; pares sustitutos; comprobación estática de alcance del CSS; los 16 literales ≤ 11 px pasan por tokens;
   `font-style:italic` ausente en CJK; reserva CJK presente en `objFont`/export.
2. `fluyo-i18n-002-s4-browser.cjs` (Chrome real): barrido de desbordes como el de esta auditoría, con **diccionario `ja`/`zh` de
   estrés** (natural y hostil), restando la línea base en español, en los 10 estados × 5 viewports. Criterio de cierre: **0 grupos nuevos** frente al español.
3. **Fuentes pintadas** (`CSS.getPlatformFontsForNode`): cromo, etiqueta del nodo, globo, título del Viewer; lista negra
   `MS Gothic|MS Mincho|SimSun|NSimSun|MingLiU|Yu Mincho`; **una sola familia CJK por nodo de texto** (sin mezclas Yu Gothic + YaHei).
4. **Paridad lienzo↔exportación**: `measureText` del lienzo adjunto == del canvas de exportación para el corpus bajo `lang=ja` y `zh-Hans`.
5. **IME** (`Input.imeSetComposition` + `dispatchKeyEvent`): el Enter que acepta la conversión **no** confirma renombrar página, Historia ni mensaje del paso.
6. **Código con CJK**: ningún par de glifos se solapa (rectángulos de `fillText` medidos) y el diseño de un nodo solo-latín es idéntico al actual.
7. **Offline**: como §9, para editor y Viewer, ja y zh.
8. **Regresión es/en**: capturas de zona (cabecera, Más, Historias, Present, Viewer) idénticas; suite existente intacta (`fluyo-i18n-002-s0-browser` 385/0 y `…-s1-browser`).
9. **Presupuesto**: test del peso de `ASSETS`/`VIEWER_ASSETS` (ya hay patrón en S0); si entra una web-font, techo explícito.
10. **Matriz de plataformas** (manual hasta tener dispositivos): macOS Safari/Chrome, iOS Safari, Android Chrome, Windows Firefox, Linux sin CJK;
    medir las mismas fuentes pintadas y capturas. **Gate de S6** antes de exponer ja/zh.
11. **Cobertura de glifos con las cadenas reales** (S5): el lector de `cmap` contra cada fuente de la pila; cada carácter de los diccionarios
    ja/zh y de los ejemplos debe resolverse en la familia esperada.

## 8. Cambios necesarios en CSS / render (propuesta, sin implementar)

**Independientes del kernel (editor y exportación):**

1. `render.js` · globo: cortar con `Intl.Segmenter(lang,{granularity:"word"})` por palabra, y por *grapheme* cuando una palabra sola exceda el
   ancho; kinsoku (no empezar línea por `。、，．」』）〕！？ー々` ni terminar en `「『（〔`); fallback sin `Segmenter` = por carácter; sin `/\s+/` solo como atajo del
   latín (conservar el comportamiento actual byte a byte para texto sin CJK). Medir con la fuente real del globo.
2. `render.js`/`interaction.js`/`export.js` · fuente de dibujo: añadir la **reserva CJK al final** de la pila de `objFont`, del globo y del
   símbolo, en tiempo de dibujo (no en el documento); `ctx.lang`/`canvas.lang` al lienzo y a **cada** canvas de exportación (`export.js:472, 544`);
   exportación SVG: `xml:lang` y el mismo sufijo **solo si el texto contiene CJK** (SVG de documentos latinos byte a byte idéntico).
   Idioma de contenido (decisión D-S4-2): kana ⇒ `ja`; solo han ⇒ idioma de la interfaz si es ja/zh; si no, sin forzar.
3. `system.css` · reserva CJK separada por escritura: la base `--font-cjk` mezcla JP y SC (P20). Añadir `--font-cjk-ja` y `--font-cjk-zh` y usar
   la del idioma de la interfaz, con la base neutra solo como última reserva.
4. `system.css`/`styles.css` · pasar los 16 literales ≤ 11 px a tokens (`--fs-micro/label`) para que el bloque `:lang()` los alcance; en
   `:lang(ja)/:lang(zh)`: `font-style:normal`/`font-synthesis:none`, `line-height` de lectura 1,5–1,6, `text-autospace:normal` (si se acepta), `word-break:auto-phrase` como mejora
   progresiva (Chrome ≥ 119; el resto cae al corte nativo), `line-break:strict`.
5. `system.css` · tooltips: `width:max-content; max-width:min(280px, calc(100vw - 24px)); white-space:normal; overflow-wrap:anywhere`.
6. Puntuación (D-S4-4): `@font-face` auxiliar de solo `U+2014, U+2018–201D, U+2026` con `src:local("Yu Gothic UI"),local("Microsoft YaHei UI"),…`, antepuesto bajo `:lang(ja/zh)`.
7. Peso (D-S4-6): bajo `:lang(zh)`, los rótulos/botones que usan 500 suben a 600 (se pinta en negrita real de YaHei) o se compensan con color; ja no necesita cambio.
8. Cifras (D-S4-5/P12): `font-variant-numeric: lining-nums` en títulos CJK.

**Con dependencia de S2 (archivos con cambios sin commit):** `input.size` → `field-sizing:content` con medida por canvas de reserva (P5); `Enter` con
`!ev.isComposing && ev.keyCode !== 229` en 3 sitios (P6); `#scScenarioTitle` elipsis (P14, también arregla el latín).

**Kernel (+ resincronizar MCP):** nodos `code` con celdas dobles para caracteres de ancho completo (East Asian Wide/Fullwidth: 2 celdas, por *code point*, no por unidad UTF-16) en `geometry.js` (`codeBlockLayout`/`codeTokens`),
`render.js` y `export.js`. Sin efecto en documentos solo latinos (invariante a probar con los *golden* existentes).

## 9. Offline

- SW v111 instalado (70 entradas en caché). Red cortada (servidor + CDP `offline`): `?lang=ja` carga con `<html lang="ja">`, textos
  «共有», «編集» y **fuente pintada = Yu Gothic UI Semibold**; Playfair/Plex cargadas desde caché. **Sin peticiones de fuente.**
- Impacto en el SW de la opción A/B: **0 KB**. Opciones C–F: §6.
- Dependencia: ninguna de las fuentes CJK del sistema se precachea ni puede romperse por la caché; el único riesgo offline es de **dispositivo** (Linux sin CJK).

## 10. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Todo lo medido es **Windows + Chrome 156**; macOS/iOS/Android/Firefox/Safari sin evidencia (`ctx.lang` solo está confirmado en Chrome) | matriz de plataformas (7.3-10) como gate de S6; la reserva por `lang` degrada bien aunque `ctx.lang` no exista |
| R2 | Unificación Han: autor japonés con interfaz española o china | heurística de kana + idioma de la interfaz (D-S4-2); sin guardar `lang` en el documento (formato versionado) |
| R3 | Cambiar el corte del globo altera lo que ven hoy los autores latinos | conservar el algoritmo actual para texto sin CJK; prueba de identidad con los goldens |
| R4 | Cambiar `objFont`/`FONTS` toca el kernel | sufijo solo en dibujo; MCP no cambia |
| R5 | Celdas dobles en `code` cambian el kernel y los SVG del MCP | invariante «solo latín = idéntico»; resincronizar MCP con paridad (patrón de S3) |
| R6 | Estimaciones de peso (C–F) sin medir | medir con `pyftsubset` antes de D-S4-1 |
| R7 | Sin revisión nativa: kinsoku, puntuación y peso son criterio tipográfico, no solo técnico | revisión nativa en S5 con capturas |
| R8 | `*{text-transform:none !important}` (S0) es un selector universal con `!important`: ninguna regla futura de CJK podrá volver a mayúsculas, y puede afectar a contenido del autor con `text-transform` propio | aceptado en S0; revisar solo si aparece un caso |
| R9 | Tests de estrés con claves aún en español no miden esas superficies | repetir el barrido al cerrar S2/S3/S5 (el script es reutilizable) |
| R10 | `zh-Hant`/`zh-TW` entrarían por `:lang(zh)` con fuentes de SC | decisión 271: no existen; si en S7 aparecen páginas, usar `:lang(zh-Hans)` explícito |

## 11. Decisiones que debería tomar el PO

| Id | Decisión | Recomendación |
|---|---|---|
| **D-S4-1** | Estrategia de fuentes: A/B (sistema) · C (sistema + web-font de red) · D/E (autoalojada) | **B** ahora; **C** solo si la matriz de plataformas muestra Linux/ChromeOS real; D/E no |
| **D-S4-2** | Idioma del contenido del autor sin guardarlo en el documento: heurística (kana ⇒ ja; solo han ⇒ idioma de la interfaz si es ja/zh) frente a campo `settings.lang` (cambia el formato) | heurística, sin cambio de formato |
| **D-S4-3** | Nodos `code` con CJK: celdas dobles en el kernel (+ MCP) · o dejar y documentar · o forzar fuente proporcional | celdas dobles, invariante «solo latín idéntico» |
| **D-S4-4** | Puntuación `“ ” … —` en CJK: atajo con `local()` · o aceptar los signos de Plex | atajo, con revisión nativa |
| **D-S4-5** | Suelo de tamaño en CJK: 12 px en todo (incluidos los 16 literales) · o mantener 11 px donde haga falta densidad | 12 px; nombres de icono ≥ 11 |
| **D-S4-6** | Jerarquía de pesos en chino (500 = 400): subir a 600 en rótulos/botones o compensar con color | 600 en rótulos y botones primarios |
| **D-S4-7** | Corte de línea en japonés: `word-break:auto-phrase` + `line-break:strict` como mejora progresiva | sí |
| **D-S4-8** | Exportación SVG/PNG/GIF: añadir `xml:lang` y reserva CJK **solo si hay CJK** | sí |
| **D-S4-9** | Gate de publicación: exigir matriz macOS/iOS/Android antes de `released:true` en ja/zh | sí |
| **D-S4-10** | Francés (espacio fino U+202F, longitudes) del plan original de S4: ¿auditoría aparte o dentro de S4? | auditoría aparte, ligera |

## 12. Dependencias con S2 / S3 / S5 y qué se puede hacer ya

| Elemento | Depende de | ¿Puede implementarse ya? |
|---|---|---|
| Corte del globo (P1) | nada (archivo `render.js`, sin cambios sin commit) | **Sí** |
| Reserva de fuentes del lienzo y exportación (P2, P3, P20, P2b) | nada (`render.js`, `export.js`, `interaction.js`; sin kernel) | **Sí** (revisar que S2a no esté tocando `export.js` en el árbol) |
| Tokens/literales CSS, tooltips, cursiva, `auto-phrase`, puntuación (P7, P9, P10, P11, P12, P16) | `styles.css` región Historias la comparte S2 | **Sí**, con un solo escritor por turno; subir `CACHE` tras S2a |
| `input.size`, guardas IME, elipsis del título (P5, P6, P14) | **S2a** (`editor-scenarios.js`, `ui.js` modificados sin commit) | **Después** del commit de S2a |
| Celdas dobles en `code` (P4) | kernel + resincronización del MCP (ventana como S3) | **Después** de D-S4-3; se puede agrupar con S3 |
| Medición final con cadenas reales y glifos reales | **S5** (traducciones) y S3 (narración por código) | **No**: se reutiliza el barrido de §7 |
| Revisión nativa de puntuación, kinsoku y peso | S5 | **No** |
| Páginas públicas (P18, `:lang(zh)`) | S7 | **No** |

`CACHE`: S4 usaría el siguiente libre tras S2a (visto v111); no se toca en esta auditoría.

## 13. Artefactos y reproducción

Volcados y scripts en el scratchpad de la sesión
(`C:\Users\nectd\AppData\Local\Temp\claude\C--Proyectos-fluyo-new\73672ee1-b35d-4900-9646-fecf14b46118\scratchpad\`):
`cdp.cjs` (arnés CDP), `probe1.cjs`/`probe1.json` (fuentes por pila e idioma), `probe2/3.cjs` (canvas y `lang`), `probe4.cjs`/`.json` (globo y etiqueta),
`probe5.cjs`/`.json` (símbolos y puntuación), `cmap.cjs` (cobertura), `stress.cjs` (diccionario y documento artificiales), `sweep.cjs`
(barrido; `BASE=1` = línea base en español), `sweep-new-grouped.json`, `viewer.cjs`/`viewer.json`, `offline.cjs`, `weights.cjs`, `feat.cjs`,
`control.cjs`, `codenode.cjs`, `swsize.cjs`, `shots/`. Ningún archivo del repo fue modificado salvo este documento (nuevo, sin seguimiento).

## Handoff

- **Sesión de auditoría S4 (2026-10-27)**: auditoría solo lectura de tipografía/layout ja y zh-Hans con medición en Chrome real; 20
  hallazgos (6 que rompen lectura o uso), 10 decisiones del PO, QA propuesta. **S4 READY FOR REVIEW.** Sin código, sin tests, sin `CACHE`,
  sin diccionarios, sin tocar S2/S3, sin commit, push ni deploy.
- **Próximo paso concreto (tras D-S4-1…10)**: implementar la parte independiente (P1, P2/P3/P20, tokens y literales de CSS, tooltips) en
  una sola slice con `CACHE` siguiente al de S2a, parando antes del commit; el resto (`input.size`, IME, `code`) en una segunda
  slice tras S2a y la decisión D-S4-3.

## Slice S4: decisiones aprobadas e implementación (2026-10-27) — COMMITTED en local (sin push ni deploy)

Base: `326872e` (S2a). `CACHE` **v111 → v112**. Sin web-fonts CJK, sin kernel, sin MCP.

### Decisiones del PO (todas con la recomendación de la auditoría, con tres ajustes)

| Id | Resuelta como | En esta slice |
|---|---|---|
| D-S4-1 | **B**: fuentes del sistema + reserva CJK en dibujo y exportación | sí |
| D-S4-2 | heurística sin guardar nada en el documento: kana ⇒ ja; solo han ⇒ idioma de la interfaz (ja, zh) o neutra | sí (`cjkScriptOf`) |
| D-S4-3 | nodos `code` con celdas dobles **con la próxima resincronización del MCP** (no se modifica el kernel dos veces) | **no**: dependencia explícita |
| D-S4-4 | puntuación `“ ” ‘ ’ … —` con caras `local()` bajo `:lang(ja/zh)` | sí |
| D-S4-5 | suelo 12 px en ja/zh (11 en nombres de icono, riel, marcas) | sí |
| D-S4-6 | chino: rótulos y botones a 600 sin negrita sintética | sí |
| D-S4-7 | `line-break:strict` + `word-break:auto-phrase` (japonés) como mejora progresiva | sí |
| D-S4-8 | exportación: mismo idioma que el lienzo visible; SVG con reserva solo si hay CJK | **parcial**: canvas PNG/JPG/GIF y `font-family` del SVG sí; **`xml:lang` del SVG no** (ver abajo) |
| D-S4-9 | gate de plataformas antes de publicar ja/zh | sí, como condición de S6 (abajo) |
| D-S4-10 | francés dentro del barrido de desbordes | sí: `fr` y `en` con sus diccionarios reales, 0 grupos nuevos |

### Qué cambia (servidos)

- `js/render.js` — `wrapCueMessage` (globo: `Intl.Segmenter` por palabra, grafema si una palabra no cabe, kinsoku, sin pérdida; el texto sin
  CJK sigue el algoritmo de siempre, probado igual); `cjkScriptOf`/`withCjkReserve` (la reserva va **antes de la primera genérica**: con
  `<html lang="zh-Hans">` la genérica `serif` ya resuelve a SimSun y una reserva detrás nunca se usaba); `objFont`, fuente del globo y pista del
  lienzo vacío la usan. Los valores salen de los tokens CSS (con reserva para pruebas sin DOM).
- `js/export.js` — `copyPageLang` (el canvas suelto del PNG/JPG/GIF copia `<html lang>`); `font-family` del SVG con la reserva solo si hay CJK
  (3 sitios + la colocación de etiquetas). El SVG sigue pasando `sanitizeStaticSVG` (probado).
- `js/interaction.js` — el cuadro de edición del texto usa la misma pila.
- `css/system.css` — `--font-cjk-ja` / `--font-cjk-zh`; dos `@font-face` con `local()` (sin descarga); pilas con la puntuación delante bajo
  `:lang(ja)`/`:lang(zh)`; `line-break`/`word-break`; peso 600 en chino; tooltips que parten en ja/zh.
- `css/styles.css` — suelo de tamaño, sin cursiva en el mensaje del paso, sin espaciado en la cabecera del modal de evento, `field-sizing:content`
  del campo de frase con texto CJK (`[data-cjk]`).
- `js/ui.js`, `js/editor-scenarios.js` (parche **posterior a S2a**, aplicable porque S2a ya está commiteada): `Enter` respeta `isComposing`/229 en
  renombrar página, renombrar Historia y mensaje del paso; el campo de frase marca `data-cjk` (por `dataset`, que también existe en el DOM falso
  de los tests). **Todo o nada**: el test de IME falla si solo se aplica a medias.
- `sw.js` — solo `CACHE` v112; el precache no cambia (0 KB).

### Pruebas (nuevas y ajustadas)

- `test/fluyo-i18n-002-s4.test.cjs` (20): corte del globo con y sin `Intl.Segmenter` (sin pérdida, ancho, kinsoku, pares sustitutos), paridad con el
  algoritmo antiguo para texto sin CJK, `computeNodeCueLayout`, escritura del texto, reserva antes de la genérica, `objFont` byte a byte en latín,
  valores = tokens CSS, todo el CSS nuevo acotado a ja/zh, caras `local()`, literales de 9–11 px, peso en chino, tooltips, exportación, SVG
  sanitizable, IME todo-o-nada, alcance (kernel y geometría sin marcadores de S4; `undoS4` exacto).
- `test/fluyo-i18n-002-s4-browser.cjs` (Chrome real, **sin Playwright**: `test/cdp-lite.cjs`; 102 ✔ · 0 ✘): globo en Chrome; fuentes pintadas
  (`CSS.getPlatformFontsForNode`) en es/ja/zh × 4 pilas del documento: nunca MS Gothic/SimSun/Mincho y una sola familia CJK por texto; paridad
  lienzo ↔ canvas de exportación; ninguna regla de S4 casa con un elemento en es/en/fr; barrido de desbordes (ja y zh, longitud natural y hostil,
  1440 y 390, 8 estados) sin grupos nuevos respecto al español; `fr` y `en` reales sin grupos nuevos; offline con SW (fuente del sistema, sin
  descargas de fuentes CJK).
- `test/fluyo-i18n-002-s4-undo.cjs` (`undoS4`, generado del diff con 2 líneas de contexto; **incluye** los trozos del parche posterior a S2a) y su
  cadena: `undoS2a` lo llama el primero; `shellOnly`, S0, S1, S2a y shell-001 descuentan lo que solo cambia S4.
- `test/fluyo-i18n-002-s0.test.cjs` (las caras `local()` no cuentan como descargas) y `test/fluyo-018-13.test.cjs` (el `unicode-range` latino se
  exige a las caras con `url()`).
- `test/fluyo-i18n-002-s4-integrar.cjs` (no es test): sube `CACHE` y sus aserciones (121 sustituciones en 80 archivos), idempotente.
- **Suite completa** (`node --test test/*.test.cjs`): base `326872e` = **81 fallos / 1 714**; con S4 = **91 / 1 734** (los 20 nuevos pasan). Los
  **10 fallos nuevos son guardas transitorias «idénticos a HEAD»** (render, exportación y CSS frente a `HEAD`): desaparecen al commitear, como
  las de S0–S2a. Los otros 81 son los mismos por nombre (preexistentes: p. ej. los 21 de `scenario-ui-dom` por `FluyoStoryClock`).
- **No ejecutado**: los `*-browser.cjs` de Playwright de otras slices (no hay Playwright en esta máquina); macOS/iOS/Android/Firefox/Safari.
  PNG/GIF **de extremo a extremo** tampoco: se mide el canvas de exportación, no el archivo descargado.

### Lo que NO entra (y por qué)

1. **`xml:lang` en el SVG exportado.** `safe-svg.js` (kernel) rechaza atributos desconocidos: un SVG exportado con `xml:lang` no podría volver
   a importarse como imagen de nodo. Entra **con la próxima resincronización del MCP**, junto con la tolerancia a `xml:lang`/`lang` en el sanitizador.
2. **Nodos `code` con CJK** (D-S4-3): `geometry.js` + `render.js` + `export.js` + su gemelo en el MCP, en esa misma resincronización
   (invariante a probar: documentos solo latinos, idénticos). Hoy los glifos CJK se solapan en esos nodos.
3. **Título de Historia largo** (P14): preexistente e independiente del idioma; no se toca.
4. **Mensaje de la vista previa** (`.scPreviewMessage`) y **etiquetas de nodo**: no parten (como en latín). Sin cambios.

### Riesgos que quedan

- Solo medido en **Windows + Chrome 156**. `ctx.lang`/`field-sizing` son de Chrome; Firefox y Safari conservan `size`/corte nativo. **Gate de S6
  (D-S4-9)**: antes de `released:true` en ja/zh, repetir `fluyo-i18n-002-s4-browser.cjs` en macOS (Hiragino/PingFang), Android (Noto CJK) e iOS.
- Los nombres de `local()` de macOS/Linux de las caras de puntuación **no están verificados**; si no existen, la cara no carga y todo queda como antes.
- Con la interfaz en español/inglés/francés, el texto **solo han** (sin kana) usa la reserva neutra: en un sistema con la lista japonesa primero,
  hanzi simplificados pueden salir en una familia distinta dentro de una misma palabra (P20 residual; solo en el DOM, no en el lienzo con kana).
- Pseudo-idioma +40 % (`qps`): la etiqueta de Compartir sale 5 px del viewport a 390 px (riesgo de S0 ya conocido, no de S4); el resto son
  artefactos de los `~~~` sin saltos. `fr` real: 0 grupos.

### Integración y limpieza

- Los parches reproducibles están en el directorio padre: `FLUYO-I18N-002-S4.patch` (todo salvo el IME y el CACHE, aplica sobre `326872e`),
  `FLUYO-I18N-002-S4-after-S2a.patch` (IME + `data-cjk`) y `test/fluyo-i18n-002-s4-integrar.cjs` (CACHE). Ya están aplicados en el árbol.
- Copias de trabajo desechables en el directorio padre: `fluyo-s4/` y `fluyo-s4-base/` (se pueden borrar).
- Decisiones para `.ai/DECISIONS.md` al commitear (sin numerar: ese archivo tiene cambios ajenos sin commit): reserva CJK solo en dibujo y antes de
  la genérica; idioma del texto por heurística sin guardarlo en el documento; `xml:lang` y `code` esperan al kernel/MCP; sin web-fonts CJK.
- `.ai/ARCHITECTURE.md`: no tocada (añadir una línea en «Idioma de la interfaz» al commitear).

### Próximo paso concreto

Revisión del PO y **commit de S4** (solo los archivos de arriba + sus tests; `.ai/*` ajenos fuera). Después: S2b/S3 y, en la ventana de
resincronización del MCP, `xml:lang` + nodos `code` con celdas dobles.
