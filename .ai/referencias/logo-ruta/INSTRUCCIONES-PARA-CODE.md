# Logo Ruta · Referencias técnicas para Claude Code

Este paquete es la referencia visual y técnica. **El alcance y la aprobación los da el PO** en su prompt; si algo de aquí contradice al PO, manda el PO.

Inventario hecho sobre `itsnect/fluyo` @ `d7e1177` (cierre de Stories 2.0, CACHE `fluyo-static-v121`). Verifica las líneas antes de editar: pueden haberse movido.

## 1. Qué es el logo

- **Símbolo** (`svg/fluyo-simbolo.svg`, viewBox 64): caja vacía (origen) en (6,8) 16×16 rx 4, conexión `M22 16 H36 V48 H42`, caja llena (destino) en (42,40) 16×16 rx 4, trazo 3.5, caps y joins redondos; envío: círculo r 5.5 en (36,32). Trazo y cajas en tinta, envío en terracota.
- **Logo completo:** símbolo + "fluyo" en Playfair Display 400, mismo color que el trazo. El símbolo mide 0.95 del cuerpo de la palabra y se separa 0.28 del cuerpo. El "yo" ya **no** va en terracota.
- **Colores:** usa los tokens del producto, nunca hex sueltos en CSS: trazo = `currentColor` con `color: var(--ink)`; envío = `var(--attention)`. En la interfaz oscura los tokens ya resuelven a `#EDE7DB` / `#DE8B71`.
- **Animación** (`codigo/logo-cabecera.html`, `preview/logo-animacion.gif`): bucle de 4.8 s con capas `pan` (desplaza el sistema −36,−32), `old` (origen y primera conexión que se desvanecen), `n2` (destino: late y pasa de lleno a vacío), `r2` (conexión nueva que se dibuja), `n3` (caja nueva que aparece) y `tok` (envío que recorre `offset-path`). El último fotograma es idéntico al logo fijo. `prefers-reduced-motion`: sin animación.

## 2. Dónde está el logo hoy

**Markup** (`flu<b>yo</b><span class="dots">…</span>`):
- `index.html` ≈ l.177: `<span class="logo">` en la cabecera del editor.
- `s/index.html` ≈ l.46: `<a class="logo" href="../" title="Fluyo" aria-label="Fluyo">` en el Viewer.
- `<a class="logo" href="../">` en `ejemplos/`, `docs/`, `privacidad/`, `privacy/`, `soporte/`, `support/`, `terminos/`, `terms/` (≈ l.41–51) y `404.html` ≈ l.27 (`href="/"`).

**CSS:**
- `css/styles.css` ≈ l.22–28 (`body > header .logo`, `.dots`), ≈ l.441 (tamaño móvil) y ≈ l.1084 / 1092 (oculta los puntos en móvil).
- `css/share.css` ≈ l.22–31 (`#chrome .logo`, `@keyframes flow`) y ≈ l.159–160 (apaisado de teléfono).
- `css/pages.css` ≈ l.72–79 (`.siteHead .logo`) y ≈ l.204–205 (móvil).
- `css/identity.css` ≈ l.7–13 (`header .logo` heredado del Viewer: `@keyframes flow`).

**Marca fuera del HTML** (decisión 267):
- Favicon: el mismo data URI en `<link rel="icon">` de las 10 páginas (editor, Viewer, páginas, 404). Nuevo valor exacto en `svg/favicon-data-uri.txt` (dibujo: `svg/favicon.svg`).
- `assets/logo.svg` → reemplazar por `svg/favicon.svg` (cuadrado hueso con el símbolo).
- `assets/icon-192.png`, `assets/icon-512.png` → `png/icon-192.png`, `png/icon-512.png` (mismas dimensiones).
- `assets/og-image.png` → `og/og-image.png` (1200×630; mismo texto que hoy: "Diagramas que fluyen", "Crear · explicar · presentar · compartir", fluyo.space).
- `manifest.webmanifest`: sin cambios (mismos nombres y colores).
- Opcional si el PO lo pide: `png/apple-touch-icon-180.png`.

**Service Worker:** subir `CACHE` en `sw.js` (hoy `fluyo-static-v121`) para invalidar logo, iconos y CSS.

**Tests que fijan la marca actual** (actualizar a la regla nueva, no borrar):
- `test/fluyo-shell-001.test.cjs` › "marca: logo.svg…": hoy exige tres `fill="#A33A22"` en `assets/logo.svg` y el FAVICON viejo.
- `test/fluyo-018-13-browser.cjs` ≈ l.122: comprueba que `body > header .logo` usa Playfair; con el markup nuevo la palabra va en `.logoWord`.
- Busca otros asserts sobre `.logo .dots` o el data URI antes de cerrar.

## 3. Markup y CSS propuestos

Ver `codigo/logo-cabecera.html`: un `<a class="logo">` (o `<span>` en el editor, como hoy) con el `<svg class="logoMark">` inline y `<span class="logoWord">fluyo</span>`.

- Cabecera del editor y del Viewer: símbolo 24 px + palabra `var(--fs-display)` (21 px), separación 8 px.
- Páginas (`.siteHead`): mismo par, a su escala.
- Móvil: donde hoy se ocultan `.dots`, deja el símbolo **fijo** (sin animación) y la palabra.
- Accesibilidad: el `<svg>` va `aria-hidden="true"`; el enlace conserva su `aria-label="Fluyo"` donde ya lo tiene.
- Sin webfonts nuevas: Playfair ya está en el repo. Los SVG de `svg/` con la palabra la llevan vectorizada (para usos fuera del HTML).
- Elimina los `@keyframes flow` y las reglas `.dots` que queden sin uso.

## 4. Verificación

- Editor, Viewer, `/ejemplos`, `/docs`, una legal y el 404: tema claro, interfaz oscura, desktop y móvil (incluido el apaisado del Viewer).
- `prefers-reduced-motion`: símbolo fijo, idéntico a `svg/fluyo-simbolo.svg`.
- Favicon visible en pestaña; manifest y PWA con los iconos nuevos; OG con `og/og-image.png`.
- Suite completa, browser tests y smoke de producción; cache del SW renovado.

## 5. Contenido del paquete

| Ruta | Qué |
|---|---|
| `PROMPT-PARA-EL-PO.md` | La decisión y el alcance que aprueba el PO |
| `INSTRUCCIONES-PARA-CODE.md` | Este archivo |
| `codigo/logo-cabecera.html` | Markup + CSS de la cabecera con la animación y los tokens |
| `svg/fluyo-simbolo.svg`, `-claro.svg` | Símbolo fijo, fondo claro / oscuro |
| `svg/fluyo-logo.svg`, `-claro.svg` | Símbolo + palabra (vectorizada) |
| `svg/fluyo-simbolo-animado.svg`, `-claro.svg` | Animación autónoma (referencia de movimiento) |
| `svg/favicon.svg`, `svg/favicon-data-uri.txt` | Favicon nuevo y su data URI exacto |
| `png/icon-192.png`, `png/icon-512.png`, `png/apple-touch-icon-180.png` | Iconos PWA |
| `png/fluyo-avatar-crema-1080.png`, `-tinta-1080.png` | Avatar para redes (no van al repo) |
| `og/og-image.png` | OG nueva, 1200×630 |
| `preview/logo-animacion.gif`, `preview/logo-fijo.png` | Cómo debe verse y moverse |
