# FLUYO-BRAND-RUTA-001 — Marca Ruta: la nueva identidad canónica de Fluyo

Estado: READY FOR PO QA (sin push, sin merge, sin deploy)
Owner/agente actual: libre (implementado por Claude Code, 31-10-2026)
Rama: `brand-ruta-001` (worktree `fluyo-ruta`), base `d7e1177` (Stories 2.0 cerrada, CACHE v121). Release objetivo: **`fluyo-static-v123`**.

> Repo público: este archivo puede publicarse. Ver `AGENTS.md` §9.

## Problema

La marca anterior (palabra «fluyo» con el «yo» terracota y tres puntos animados) no explicaba qué es Fluyo: los tres puntos se leen como el indicador de «escribiendo…» de un chat («IA pensando»), y una palabra en serif minúscula no funciona como favicon ni como avatar. Dirección Creativa Pública propuso el logo **Ruta**; el PO lo aprobó como identidad canónica.

## Decisión

**Decisión 324** (`.ai/DECISIONS.md`), que **sustituye a la 267** (la 267 queda en su sitio, marcada «Sustituida por la 324»). En corto:

- **Símbolo Ruta:** origen vacío → conexión ortogonal → destino lleno, con el envío terracota a mitad de camino. Una Historia mínima: algo sale, recorre el sistema y llega.
- **Logo completo:** símbolo + «fluyo» en **Playfair Display 400**, todo en tinta; el terracota solo en el envío. Playfair es del wordmark: no se propaga a la UI, Stories, Viewer, páginas ni campañas (Newsreader y JetBrains Mono no cambian).
- **Desktop animado** (bucle de 4.8 s); **reducir movimiento: fijo**; **móvil: fijo**, siempre con la palabra.
- **Todas las superficies** comparten identidad: cabeceras, favicon, `logo.svg`, iconos PWA y OG.
- Numeración: 320–323 son de FLUYO-GROWTH-FOUNDATION-001 (en su rama, sin integrar); esta tarea usa la 324 para no chocar.

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

1. **El envío del bucle no descansa donde el del símbolo fijo.** El bucle (`logo-cabecera.html` y el GIF) deja el envío en `offset-distance: 50 %` del camino `M22 16 H36 V48 H42` (52 u) → **(36, 28)**. El símbolo fijo (`fluyo-simbolo.svg`, favicon, iconos, OG) lo tiene en **(36, 32)**, el centro del tramo vertical (≈ 57,7 %). A 24 px son 1,5 px. Además, el destino del bucle lleva trazo (19,5 u) y el del fijo no (16 u). Por eso «el último fotograma es idéntico al logo fijo» no es exacto. **Resolución:** el bucle se copia tal cual (el PO pidió no «mejorar» la animación); el fijo (reducir movimiento y móvil) es el SVG fijo exacto, porque el PO pidió «no usar una frame aproximada». Las dos geometrías no se mezclan. **Pregunta para Creativa:** ¿el bucle debe descansar en 57,69 %? Es un cambio de un número en dos keyframes. Lo vigila la mutación M3: si se cambia, hay que actualizar la referencia primero.
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
- Fotograma 0 = último fotograma: origen vacío, conexión, destino lleno en (50,48) del viewBox; envío en (36,28) (ver contradicción 1).
- Coste medido en escritorio (Chrome): ~75 recálculos de estilo + layout por segundo, solo de la cabecera. Los puntos anteriores también se animaban sin fin.

## Contrato responsive

| Contexto | Símbolo | Tamaño |
|---|---|---|
| Escritorio (editor ≥ 861 px, Viewer ≥ 701, páginas ≥ 621) | animado | 24 px, 8 px de hueco, palabra 21 px |
| Editor 701–860 px (donde ya se ocultaban los puntos) | fijo | 24 / 8 / 21 |
| Editor y Viewer ≤ 700 px | fijo | 21,7 / 7,2 / 19 (escala con la palabra) |
| Páginas ≤ 620 px | fijo | 24 / 8 / 21 |
| Teléfono en apaisado (`landscape`, alto ≤ 500, puntero grueso) | fijo | según la superficie |
| `prefers-reduced-motion: reduce` | fijo en todas | igual |

Nunca se oculta el símbolo ni la palabra. Verificado sin recorte, sin chocar con el control siguiente y sin scroll horizontal en 1440, 800, 390×844, 375×667 y 844×390.

## Accesibilidad

- El SVG es decorativo (`aria-hidden="true"`, `focusable="false"`). El nombre accesible no cambia: «Fluyo» en el Viewer (`aria-label`) y el texto «fluyo» en el editor y las páginas.
- `translate="no"` en la palabra: el nombre no se traduce (decisión 305), ni el traductor del navegador lo convierte en «I flow». Además, el escáner de i18n deja de contarla como texto sin migrar.
- Reducir movimiento: sin bucle, sin animaciones vivas. Contraste: los mismos tokens de tinta y atención que ya usaba la marca.

## Cache / release

- `sw.js`: `CACHE = "fluyo-static-v123"`. Las listas de precache no cambian: `identity.css`, `styles.css`, `share.css`, `pages.css` y las páginas ya estaban; al cambiar la versión, el SW instala todo de nuevo y borra la caché anterior.
- **v122 no se toma:** es de FLUYO-GROWTH-FOUNDATION-001 (rama `growth-foundation-001`, sin integrar en `main` al empezar). Esta rama sale de `main` (`d7e1177`) y no toca Growth.
- **Para integrar después de v122** (rebase sobre `main` con Growth dentro):
  1. `sw.js` y los tests que fijan `fluyo-static-v12x`: queda **v123** (conflicto trivial v122/v123).
  2. Cadena de deshacer: Growth y Ruta se colocan cada uno como último eslabón tras `undoOutcome`. Al integrar, `undoOutcome` llama a uno y ese llama al otro (el más nuevo primero), y los alcances que registran `PIECES_GF` registran también `PIECES_RUTA` y `BIN_RUTA`.
  3. Regenerar `test/fluyo-brand-ruta-001-undo.cjs` si Growth cambia algún archivo de la marca: hoy no comparten archivos servidos de marca. El 404, `index.html` y `s/index.html` sí los toca Growth en otras líneas, así que hay que regenerar las piezas con dos líneas de contexto.
  4. Decisiones: Growth 320–323, Ruta 324. Sin choque.
- OG: misma ruta y mismas meta tags (`og:image` 1200×630, `twitter:image`) en las páginas que la declaran. La caché externa de X, LinkedIn y WhatsApp es deuda conocida y no bloquea.

## QA

Ver «Evidencia». Tests nuevos:

- `test/fluyo-brand-ruta-001.test.cjs` (vm, 8): R1 marcado (construido desde la referencia), R2 favicon, R3 bytes de assets y manifest, R4 movimiento, R5 fijo, R6 marca anterior y tipografía, R7 decisiones, C1 alcance (git).
- `test/fluyo-brand-ruta-001-browser.cjs` (Chrome): estados × vistas × superficies; fijo = `fluyo-simbolo.svg` píxel a píxel; fotogramas del bucle; interfaz oscura; SW v123 sin red; favicon y tamaños pequeños.
- `test/fluyo-brand-ruta-001-mutations.cjs`: 23 regresiones que deben hacer fallar el test unitario.
- `test/fluyo-brand-ruta-001-undo.cjs`: `undoRuta`, el último eslabón de la cadena de deshacer (lo llama `undoOutcome`). Generado del diff con dos líneas de contexto.

Tests existentes actualizados a la regla nueva (ninguno borrado):

- `fluyo-shell-001.test.cjs`: favicon Ruta exacto, marcado Ruta, hueco 8 px, bytes de los assets; registra `PIECES_RUTA`.
- `fluyo-shell-001-browser.cjs`: la marca es símbolo de 24 px a 8 px de «fluyo» en Playfair, sin «yo» aparte, envío terracota; igual en las tres cabeceras.
- `fluyo-018-13-browser.cjs` y `fluyo-018-14a-browser.cjs`: la voz serif de la marca se mide en `.logoWord`.
- 88 archivos de test: `fluyo-static-v121` → `v123`.
- Alcances antiguos que registran a la Stories-2.0 *outcome* (`i18n-002 s0…s3b`, `stories-2-0 s1a…s2b`): registran también `PIECES_RUTA` y `BIN_RUTA`. `shellOnly` (`fluyo-shell-001-undo.cjs`) conoce `PIECES_RUTA`. Las listas KEEP de Stories S1b, S2a y S2b comparan con `undoRuta` aplicado.

## Evidencia

(Se completa al cerrar la QA; ver la sección siguiente.)

## Limitaciones conocidas

- Contradicción 1 (envío del bucle en 28 frente a 32): visible solo como un salto de 1,5 px al pasar de escritorio a móvil o al activar «reducir movimiento». Pendiente de Creativa.
- El favicon a 16 px: el origen vacío es la parte más débil (≈ 3 px, trazos de menos de 1 px). Se reconoce, pero suave. Ver «Small-size gate».
- El bucle cuesta ~75 recálculos de estilo y layout por segundo en escritorio, solo en la cabecera.
- `og:image:alt` del editor («Diagrama de arquitectura animado hecho con Fluyo») ya no describía la OG anterior y tampoco describe la nueva. No se toca: textos fuera de alcance. Propuesta: tarea de copy.
- `apple-touch-icon-180.png` no se sirve (opcional en la referencia; el PO no lo pidió).
- `PROMPT-PARA-EL-PO.md` viaja con la referencia (el README pide copiar la carpeta entera). Es el razonamiento de la propuesta de marca; menciona «una búsqueda rápida de marcas parecidas» antes de comunicarla. Como el repo es público (AGENTS §9), **el PO debe confirmar** antes del push que puede publicarse. Si no, se quita de la rama.

## Estado para el PO

READY FOR PO QA. Pendiente del PO:
1. QA visual en su navegador (editor, Viewer, páginas, móvil).
2. Decidir sobre la contradicción 1 (con Creativa) y confirmar que `PROMPT-PARA-EL-PO.md` puede ser público.
3. Orden de release: integrar Growth (v122) y después esta rama (v123), con el procedimiento de «Cache / release».
4. Push, merge, deploy y smoke de producción: solo con su aprobación.

## Handoff

- **Hecho:** marca Ruta en las once páginas, favicon, assets, CSS, CACHE v123, decisión 324, tests nuevos y actualizados.
- **Próximo paso:** QA del PO. Después, con su aprobación: rebase sobre `main` con Growth integrado (procedimiento en «Cache / release»), suite completa, push, deploy y smoke de producción (`test/fluyo-brand-ruta-001-browser.cjs` contra fluyo.space no aplica tal cual: sirve el árbol local; el smoke de producción se hace con el QA de navegador sobre la URL pública).
