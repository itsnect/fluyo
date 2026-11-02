# FLUYO-BRAND-RUTA-001 — Marca Ruta: la nueva identidad canónica de Fluyo

Estado: READY FOR PO QA (sin push, sin merge, sin deploy)
Owner/agente actual: libre (implementado por Claude Code, 31-10-2026)
Rama: `brand-ruta-001` (worktree `fluyo-ruta`), base `origin/main @ 3ff0336` (Growth v122 en producción; código de producto `ebf72cf`), reintegrada el 01-11-2026 (antes salía de `d7e1177`). Release objetivo: **`fluyo-static-v123`**.

> Repo público: este archivo puede publicarse. Ver `AGENTS.md` §9.

## Problema

La marca anterior (palabra «fluyo» con el «yo» terracota y tres puntos animados) no explicaba qué es Fluyo: los tres puntos se leen como el indicador de «escribiendo…» de un chat («IA pensando»), y una palabra en serif minúscula no funciona como favicon ni como avatar. Dirección Creativa Pública propuso el logo **Ruta**; el PO lo aprobó como identidad canónica.

## Decisión

**Decisión 325** (`.ai/DECISIONS.md`), que **sustituye a la 267** (la 267 queda en su sitio, marcada «Sustituida por la 325»). En corto:

- **Símbolo Ruta:** origen vacío → conexión ortogonal → destino lleno, con el envío terracota a mitad de camino. Una Historia mínima: algo sale, recorre el sistema y llega.
- **Logo completo:** símbolo + «fluyo» en **Playfair Display 400**, todo en tinta; el terracota solo en el envío. Playfair es del wordmark: no se propaga a la UI, Stories, Viewer, páginas ni campañas (Newsreader y JetBrains Mono no cambian).
- **Desktop animado** (bucle de 4.8 s); **reducir movimiento: fijo**; **móvil: fijo**, siempre con la palabra.
- **Todas las superficies** comparten identidad: cabeceras, favicon, `logo.svg`, iconos PWA y OG.
- Numeración: 320–324 son de FLUYO-GROWTH-FOUNDATION-001 (la 324, publicar el inglés, llegó a su rama mientras esta tarea estaba en curso; ninguna está en `main`); esta tarea usa la **325**. Los mensajes de los commits `1314de0`, `ae93a76`, `31e0e31` y `3e4ee17` dicen «decisión 324»: se escribieron antes de que Growth la tomara; la renumeración va en un commit aparte, sin reescribir la historia.

## Fuente: el paquete de referencias

`.ai/referencias/logo-ruta/` es la fuente visual primaria. **No estaba en el repo**: llegó como `fluyo-logo-ruta.zip` (31-10-2026 00:17); su `README.md` dice «copia esta carpeta al repo como `.ai/referencias/logo-ruta/`», y esta tarea lo hace. Se omiten los dos avatares de redes (`png/fluyo-avatar-*-1080.png`: «no van al repo», según `INSTRUCCIONES-PARA-CODE.md`).

| Archivo de la referencia | Uso |
|---|---|
| `codigo/logo-cabecera.html` | Marcado y CSS del bucle de la cabecera (copiados tal cual) |
| `svg/fluyo-simbolo.svg` | El símbolo fijo (`.still`), exacto |
| `svg/favicon-data-uri.txt` | Favicon de las once páginas, exacto |
| `svg/favicon.svg` | `assets/logo.svg` (bytes) |
| `png/icon-192.png`, `png/icon-512.png` | `assets/icon-192.png`, `assets/icon-512.png` (bytes) |
| `og/og-image.png` | `assets/og-image.png` (bytes) |
| `preview/logo-animacion.gif`, `preview/logo-fijo.png` | Comparación visual |
| `png/apple-touch-icon-180.png`, `png/fluyo-favicon-16/32.png`, `png/fluyo-icono-app-512.png`, `svg/fluyo-logo*.svg`, `svg/fluyo-simbolo-animado*.svg` | Quedan en la referencia; no se sirven (el apple-touch-icon es «opcional si el PO lo pide») |

### Contradicciones internas de la referencia (para PO + Dirección Creativa)

No se inventó una tercera variante: cada parte usa la referencia más específica y la diferencia queda aquí.

1. **El envío del bucle no descansa donde el del símbolo fijo.** El bucle (`logo-cabecera.html` y el GIF) deja el envío en `offset-distance: 50 %` del camino `M22 16 H36 V48 H42` (52 u) → **(36, 28)**. El símbolo fijo (`fluyo-simbolo.svg`, favicon, iconos, OG) lo tiene en **(36, 32)**, el centro del tramo vertical (≈ 57,7 %). A 24 px son 1,5 px. Además, el destino del bucle lleva trazo (19,5 u) y el del fijo no (16 u). Por eso «el último fotograma es idéntico al logo fijo» no es exacto. **Resolución (PO, revisión de v123): el fijo manda.** El envío del bucle descansa en el 57,6923 % (30 de 52), el círculo de `fluyo-simbolo.svg` en (36,32); el resto del bucle es el de la referencia y el fijo no cambia. Ya no hay salto al pasar al fijo. Lo vigilan R4 (deriva el reposo del fijo), M3 (vuelve al 50 %) y el Chrome C (fotogramas 0 y final en 36,32).
2. **Proporción del lockup.** `INSTRUCCIONES` §1 dice que el símbolo mide 0,95 del cuerpo de la palabra y se separa 0,28 (así son `svg/fluyo-logo*.svg` y `preview/logo-fijo.png`). Para la cabecera, el mismo documento (§3) y `logo-cabecera.html` piden **24 px y 8 px con la palabra a 21 px** (1,14 y 0,38). La cabecera usa lo específico de la cabecera; los SVG del lockup quedan para usos fuera del HTML.
3. **Favicons PNG de 16/32 px.** No están optimizados píxel a píxel: son otra variante (símbolo a sangre, sin el cuadrado hueso). El favicon servido es el data URI (con el cuadrado), como pide la referencia. Ver «Small-size gate».

## Arquitectura

- **Marcado** (once páginas): `<… class="logo">` conserva su elemento y atributos (`<span>` en el editor; en el Viewer `<a … title="Fluyo" aria-label="Fluyo">`; `href="/"` en el 404). Dentro: `<svg class="logoMark" … aria-hidden="true" focusable="false">` con dos grupos y `<span class="logoWord" translate="no">fluyo</span>`.
  - `.still`: `svg/fluyo-simbolo.svg` con `#16150f` → `currentColor`; el envío lo pinta el CSS.
  - `.loop`: el `<svg>` de `logo-cabecera.html` tal cual, salvo `fill="var(--attention)"` del envío, que pasa al CSS (un `var()` en un atributo de presentación no es fiable; el color es el mismo token).
- **CSS compartido** en `css/identity.css` (lo cargan el editor, el Viewer y todas las páginas, antes que el resto): tamaño en `em` (`calc(24em / 21)`), envío `fill: var(--attention)`, keyframes de la referencia tal cual y las seis reglas del bucle **solo dentro de `@media (prefers-reduced-motion: no-preference)`**.
- **Por qué no basta con `display:none`:** en Chrome, un `<g>` con `display:none` no para las animaciones CSS de sus hijos SVG. Medido: con el bucle oculto seguían 6 animaciones y ~75 recálculos de estilo y layout por segundo. Por eso, con «reducir movimiento» el bucle ni se declara, y en móvil cada cabecera pone `animation:none` además de ocultarlo. Resultado medido: 0 animaciones y 0 recálculos en 2 s.
- **Por superficie** (`styles.css`, `share.css`, `pages.css`): la regla de la marca pasa de `align-items:baseline; gap:0` a `align-items:center; gap:calc(8em / 21)`. Donde antes había `.dots{display:none}`, ahora `.still` a la vista y `:is(.loop, .loop *){display:none; animation:none}`.
- **Fuera:** `.dots`, `.logo b` (el «yo» terracota), `@keyframes flow` y la regla `header .logo` en Georgia que heredaba `identity.css`.
- **Tokens:** `color: var(--ink)` (ya estaba) y `var(--attention)`. Sin hex nuevos. La interfaz oscura del editor (`data-ui-theme="dark"`) los resuelve a `#EDE7DB` / `#DE8B71` sin regla propia. Sin tema nuevo.

## Superficies

| Superficie | Archivo | Marca | Favicon |
|---|---|---|---|
| Editor | `index.html` | ✔ | ✔ |
| Viewer `/s/` | `s/index.html` | ✔ | ✔ |
| Ejemplos | `ejemplos/index.html` | ✔ | ✔ |
| Docs | `docs/index.html` | ✔ | ✔ |
| Privacidad / Privacy | `privacidad/`, `privacy/` | ✔ | ✔ |
| Términos / Terms | `terminos/`, `terms/` | ✔ | ✔ |
| Soporte / Support | `soporte/`, `support/` | ✔ | ✔ |
| 404 | `404.html` | ✔ | ✔ |

Once páginas servidas: once marcas y once favicons sustituidos; no queda ninguna con la marca anterior (lo comprueba R6). Además: `assets/logo.svg`, `icon-192.png`, `icon-512.png` y `og-image.png`. `manifest.webmanifest` no cambia. Las páginas de `test/*.html` son fixtures y no llevan marca. «Hecho con Fluyo» no cambia.

## Contrato de la animación

- Bucle de **4.8 s**, `infinite`, capas `pan`, `old`, `n2`, `r2`, `n3`, `tok`: el envío llega al destino, el destino late, la ruta avanza, aparece una caja nueva, sale otro envío y vuelve al logo. Keyframes y curvas, idénticos a `logo-cabecera.html` (R4 compara el texto).
- Fotograma 0 = último fotograma: origen vacío, conexión, destino lleno en (50,48) del viewBox; envío en (36,32), donde lo pinta el fijo (ver contradicción 1).
- Coste medido en escritorio (Chrome): ~75 recálculos de estilo + layout por segundo, solo de la cabecera. Los puntos anteriores también se animaban sin fin.

## Contrato responsive

| Contexto | Símbolo | Tamaño |
|---|---|---|
| Escritorio (editor ≥ 861 px, Viewer ≥ 701, páginas ≥ 621) | animado | 24 px, 8 px de hueco, palabra 21 px |
| Editor 701–767 px táctil | fijo | como la fila siguiente; además sin filetes, y en 701–743 Presentar en icono (cabecera en una fila con «Más» a la vista) |
| Editor 701–860 px (donde ya se ocultaban los puntos) | fijo | 21,7 / 7,2 / 19 (a la escala del teléfono: con 21 px, a 768 px táctil la cabecera desbordaba 8 px y «Más» quedaba fuera) |
| Editor y Viewer ≤ 700 px | fijo | 21,7 / 7,2 / 19 (escala con la palabra) |
| Páginas ≤ 620 px | fijo | 24 / 8 / 21 |
| Teléfono en apaisado (`landscape`, alto ≤ 500, puntero grueso) | fijo | según la superficie |
| `prefers-reduced-motion: reduce` | fijo en todas | igual |

Nunca se oculta el símbolo ni la palabra. Verificado sin recorte, sin chocar con el control siguiente y sin scroll horizontal en 1440, 800, 768×1024 táctil, 390×844, 375×667 y 844×390.

## Accesibilidad

- El SVG es decorativo (`aria-hidden="true"`, `focusable="false"`). El nombre accesible no cambia: «Fluyo» en el Viewer (`aria-label`) y el texto «fluyo» en el editor y las páginas.
- `translate="no"` en la palabra: el nombre no se traduce (decisión 305), ni el traductor del navegador lo convierte en «I flow». Además, el escáner de i18n deja de contarla como texto sin migrar.
- Reducir movimiento: sin bucle, sin animaciones vivas. Contraste: los mismos tokens de tinta y atención que ya usaba la marca.

## Cache / release

- `sw.js`: `CACHE = "fluyo-static-v123"`. Las listas de precache no cambian: `identity.css`, `styles.css`, `share.css`, `pages.css` y las páginas ya estaban; al cambiar la versión, el SW instala todo de nuevo y borra la caché anterior.
- **Reintegrada sobre v122** (`origin/main @ 3ff0336`, Growth en producción): rebase de los commits de la tarea sobre Growth. Conflictos resueltos: `sw.js` y ~90 tests (v122/v123 → **v123**); `.ai/DECISIONS.md` (320–324 de Growth, 325 de Ruta); registros de deshacer (`PIECES_GF`/`NEW_GF` y `PIECES_RUTA`/`BIN_RUTA`, los dos); S1b, S2a y S2b deshacen Ruta y luego Growth.
- **Cadena de deshacer:** `undoOutcome` llama primero a `undoRuta` y luego a `undoGrowth` (de la más reciente a la más antigua). `undoRuta` se generó frente a `ebf72cf`: sus piezas devuelven el texto exacto de Growth v122. El test 019-1 prohíbe la versión anterior de CACHE en los tests: el alcance de Ruta compara `sw.js` sin la constante.
- **Repo público:** `PROMPT-PARA-EL-PO.md` se quitó de la referencia **y del historial de la rama** (sin publicar). `README.md` e `INSTRUCCIONES-PARA-CODE.md` de la referencia lo siguen nombrando (son bytes de la referencia; no se tocan).
- OG: misma ruta y mismas meta tags (`og:image` 1200×630, `twitter:image`) en las páginas que la declaran. La caché externa de X, LinkedIn y WhatsApp es deuda conocida y no bloquea.

## QA

Ver «Evidencia». Tests nuevos:

- `test/fluyo-brand-ruta-001.test.cjs` (vm, 8): R1 marcado (construido desde la referencia), R2 favicon, R3 bytes de assets y manifest, R4 movimiento, R5 fijo, R6 marca anterior y tipografía, R7 decisiones, C1 alcance (git).
- `test/fluyo-brand-ruta-001-browser.cjs` (Chrome): estados × vistas × superficies; fijo = `fluyo-simbolo.svg` píxel a píxel; fotogramas del bucle; interfaz oscura; SW v123 sin red; favicon y tamaños pequeños.
- `test/fluyo-brand-ruta-001-mutations.cjs`: 26 regresiones que deben hacer fallar el test unitario (las 24 de antes, M3 y M4 al reposo nuevo, y M25/M26 para la cabecera en tableta táctil).
- `test/fluyo-brand-ruta-001-undo.cjs`: `undoRuta`, el último eslabón de la cadena de deshacer (lo llama `undoOutcome`, antes que `undoGrowth`); base `ebf72cf`. Generado del diff con dos líneas de contexto.

Tests existentes actualizados a la regla nueva (ninguno borrado):

- `fluyo-shell-001.test.cjs`: favicon Ruta exacto, marcado Ruta, hueco 8 px, bytes de los assets; registra `PIECES_RUTA`.
- `fluyo-shell-001-browser.cjs`: la marca es símbolo de 24 px a 8 px de «fluyo» en Playfair, sin «yo» aparte, envío terracota; igual en las tres cabeceras.
- `fluyo-018-13-browser.cjs` y `fluyo-018-14a-browser.cjs`: la voz serif de la marca se mide en `.logoWord`.
- 88 archivos de test: `fluyo-static-v121` → `v123`.
- `fluyo-018-14b-browser.cjs`: «una fila» se mide por grupos de centros a más de 10 px; `Math.round(centro / 10)` partía una fila en dos cuando un centro caía en 24,95 px y otro en 25,0, sin cambio visible.
- `fluyo-i18n-002-s0-browser.cjs`: la foto «antes» de la ida y vuelta de idiomas espera dos fotogramas, porque `#zoomPct` lo sincroniza el bucle del editor tras `fitView`. La base hace lo mismo (80 % → 121 % un fotograma después). Su verificación de la cabecera exime lo que lleva `translate="no"` (la palabra de la marca).
- Alcances antiguos que registran a la Stories-2.0 *outcome* (`i18n-002 s0…s3b`, `stories-2-0 s1a…s2b`): registran también `PIECES_RUTA` y `BIN_RUTA`. `shellOnly` (`fluyo-shell-001-undo.cjs`) conoce `PIECES_RUTA`. Las listas KEEP de Stories S1b, S2a y S2b comparan con `undoRuta` aplicado.

## Evidencia (01-11-2026, Chrome real, Windows; v122 + Ruta frente a `origin/main @ 3ff0336`)

| Prueba | `3ff0336` (v122) | Rama (v123) |
|---|---|---|
| `fluyo-brand-ruta-001.test.cjs` | — | 8/8 |
| `fluyo-brand-ruta-001-mutations.cjs` | — | 26/26 detectadas |
| `fluyo-brand-ruta-001-browser.cjs` | — | 210 OK, 0 fallos (incluye H: cabecera a 701/720/744/760/768 táctil, es/en, Editar/Historias) |
| Suite completa (`node --test test/*.test.cjs`, clones limpios) | 1856 tests, 81 fallos | 1864 tests, 81 fallos: **los mismos 81**; 0 nuevos |
| Growth Chrome (es-CL → es, en-US → en, de-DE → en de respaldo, movimiento reducido, eventos) | 78/0 | 78/0 |
| I18N-002 S0 (puerta de idiomas) | 384/1 (carrera de `#zoomPct`) | 385/0 |
| I18N-001 | 78/0 | 78/0 |
| Stories S1b · S2a · S2b | 47/0 · 50/0 · 40/0 | 47/0 · 50/0 · 40/0 |
| Examples | 40/0 | 40/0 |
| Share: `qa-share-hash` · `share-browser` | OK · falla en el 3.er bloque (clic en `#cv`) | OK · el mismo fallo |
| Viewer (SW-VIEWER-001) | 63/0 | 63/0 |
| Shell | 137/2 | 137/2 (los mismos) |
| Responsive: 018-13 · 018-14a · 018-14b · 018-18 | 251/0 · 230/0 · 532/0 · 427/0 | 251/0 · 230/0 · 532/0 · 427/0 |
| SW 019-2 (actualización) | no ejecutable en una copia sin git | 85/0 |

**Cabecera del editor, táctil, con documento** (desborde en px; `Más` a la vista):

| Ancho | v122 | Ruta antes del arreglo | Ruta (v123) |
|---:|---|---|---|
| 701 | 43, «Más» fuera | 67, fuera | 0, a la vista |
| 720 | 24, «Más» fuera | 48, fuera | 0, a la vista |
| 744 | 0 | 24, fuera | 0, a la vista |
| 760 | 0 | 8, fuera | 0, a la vista |
| 768 | 0 | 0 | 0, a la vista |

Una fila y ningún control fuera en es/en y en Editar/Historias. `share-post-qa-browser` necesita el script actual de Umami como argumento (NOT RUN en los dos lados).

- **Fallos que no son de esta tarea:** en SHELL-001 Chrome, «320 /ejemplos/ sin scroll horizontal» (un `span.kind` de las tarjetas, 331 px en la base y aquí) y «Abrir en el editor carga el ejemplo». Iguales en la base. En la unidad, 018-25 #11 y 018-27 «release» fallan solo con `../fluyo-mcp` al lado, también en la base.
- **El fijo es el SVG de la referencia:** pintado a 256 px, 0 píxeles distintos de 10 972 frente a `svg/fluyo-simbolo.svg`, con los colores de los tokens claros (`#16150f`, `#a33a22`).
- **Sin animación donde no toca:** con «reducir movimiento», en móvil, en el editor de 701–860 y en apaisado, 0 animaciones vivas y 0 recálculos de estilo en 2 s. En escritorio, 6 animaciones de 4,8 s y ~75 recálculos de estilo + layout por segundo.
- **Bucle:** fotogramas a 0, 0,9, 1,1, 1,7, 2,3, 3,2 y 4,0 s comparados con `preview/logo-animacion.gif` en los mismos instantes: mismas fases.
- **Interfaz oscura del editor:** tinta `rgb(237, 231, 219)` y envío `rgb(222, 139, 113)`.
- **SW:** `fluyo-static-v123` guarda `identity.css` con la marca nueva y, sin red, el editor sale de la caché con ella.
- **Assets:** `logo.svg`, `icon-192` (192×192), `icon-512` (512×512) y `og-image` (1200×630), bytes idénticos a la referencia; revisados a ojo.
- **Small-size gate** (favicon servido, el data URI con el cuadrado hueso):

| Tamaño | Origen | Ruta | Destino | Envío terracota | Resultado |
|---:|---|---|---|---|---|
| 16 px | reconocible, suave (≈ 3 px, trazo < 1 px) | visible | claro (lleno) | visible (4 px) | PASA con nota |
| 24 px | claro | clara | claro | claro | PASA |
| 32 px | claro | clara | claro | claro | PASA |

  Los PNG de 16/32 del paquete no son una versión optimizada para tamaños pequeños: son otra variante (a sangre, sin el cuadrado). No se usan y no se toca la geometría.

## Limitaciones conocidas

- El favicon a 16 px: el origen vacío es la parte más débil (≈ 3 px, trazos de menos de 1 px). Se reconoce, pero suave. Ver «Small-size gate».
- El bucle cuesta ~75 recálculos de estilo y layout por segundo en escritorio, solo en la cabecera.
- **Cabecera del editor en tableta táctil:** a 701–743 px Presentar se queda en icono (nombre en el texto oculto y el `title`). En la base, por debajo de 744, «Más» quedaba fuera.
- `og:image:alt` del editor («Diagrama de arquitectura animado hecho con Fluyo») ya no describía la OG anterior y tampoco describe la nueva. No se toca: textos fuera de alcance. Propuesta: tarea de copy.
- `apple-touch-icon-180.png` no se sirve (opcional en la referencia; el PO no lo pidió).

## Estado

**PRODUCTION VERIFIED / CLOSED.** `origin/main` = `b585f83` (avance rápido desde `3ff0336`), desplegado por Vercel; fluyo.space sirve `fluyo-static-v123`. Siguiente CACHE libre: v124.

**Smoke de producción (Chrome real contra https://fluyo.space, Umami interceptado): 40/0.**

- `sw.js` en v123; `logo.svg`, `icon-192`, `icon-512`, `og-image`, `identity.css` y `styles.css` con los bytes de la rama.
- Las once páginas: símbolo + «fluyo» (`translate="no"`), sin puntos, favicon Ruta, 0 errores de consola (solo el 404 del documento que se visita a propósito).
- Escritorio: 6 animaciones y el envío empieza y termina en (36,32). «Reducir movimiento»: símbolo fijo y 0 animaciones.
- Cabecera del editor a 701, 720, 744, 760 y 768 px táctil, en es y en: una fila, «Más» a la vista, nada fuera, 0 px de desborde.
- Idioma del navegador sin `?lang`: es-CL → es, en-US → en, de-DE → en.
- Enlace para compartir generado; Viewer a 1280 y 390 px con la marca; Stories: `compra-online` abre en Historias.
- Service worker en instalación limpia: 77 entradas en `fluyo-static-v123`, `identity.css` con el reposo nuevo y, sin red, el editor sale de la caché con la marca.

**Sin medir en producción:** la actualización real de v122 a v123 en un navegador con la caché anterior (cubierta en local por 019-2, 85/0); los eventos reales de Umami (interceptados a propósito); la caché externa de la OG en X, LinkedIn y WhatsApp (deuda conocida).

## Handoff

- **Commits** (rama `brand-ruta-001`, sobre `3ff0336`; reescritos al reintegrar y al quitar `PROMPT-PARA-EL-PO.md`): `bdae57b` feat · `3e8c484` fix (translate) · `f4fd449` test · `b2bfcc2` docs · `f3486a3` docs (325) · `c05e86e` fix (768 px) · `56d8ec4` test (carreras) · `c6ec445` docs · `50087dc` test (reintegración) · `2bbd522` docs · `ff66396` fix (tableta y reposo del envío) · `b28941e` docs (325) · y este cierre.
- **Hecho:** marca Ruta en las once páginas, favicon, assets, CSS, CACHE v123, decisión 325, tests nuevos y actualizados.
- **Próximo paso:** QA del PO. Después, con su aprobación: rebase sobre `main` con Growth integrado (procedimiento en «Cache / release»), suite completa, push, deploy y smoke de producción (`test/fluyo-brand-ruta-001-browser.cjs` contra fluyo.space no aplica tal cual: sirve el árbol local; el smoke de producción se hace con el QA de navegador sobre la URL pública).
