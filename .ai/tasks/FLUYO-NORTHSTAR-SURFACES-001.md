# FLUYO-NORTHSTAR-SURFACES-001 — Product Shell

Estado: **APROBADA** (D1–D10 en los términos recomendados; D6 a FLUYO-I18N-002; D7 fuera). Implementada en **FLUYO-SHELL-001** (decisiones 263–268).
Fecha: 25 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `53552a2` (HEAD = producción, fluyo.space sirve `fluyo-static-v107`).
> Fuentes leídas: `AGENTS.md`, `.ai/PRODUCT.md`, `.ai/DECISIONS.md` (117–145, 260–262), `.ai/tasks/FLUYO-018.13.md` (§ 1 North Star),
> `.ai/tasks/FLUYO-I18N-001.md` (§ 9), `css/identity.css`, `css/pages.css`, `css/system.css` (tokens y componentes),
> `css/styles.css` (cabecera), `css/share.css` (cabecera, estados), `sw.js` (precache y `fetch`), `manifest.webmanifest`,
> `sitemap.xml`, `robots.txt`, la cabecera y el pie de las ocho páginas estáticas, `index.html` («Más» › Fluyo) y `s/index.html`.
> Medición: Chrome (panel integrado de Claude) contra producción, a 1440 × 900 y 375 × 812. Los estilos computados se midieron
> cargando cada página en un `iframe` del mismo origen.

## Objetivo

Auditar la coherencia visual de todo lo que Fluyo publica fuera del editor y proponer el **Product Shell** mínimo: las reglas
necesarias para que una superficie nueva parezca Fluyo sin copiar el editor.

Fuera de alcance: el contenido de Ejemplos (es **FLUYO-EXAMPLES-001**), traducciones y cualquier cambio de código.

---

## 1. Inventario de superficies

| # | Ruta | Qué es | Hojas | Idioma |
|---|---|---|---|---|
| S0 | `/` | Editor (referencia) | `identity` + `system` + `styles` | es (+ `?lang=en` parcial) |
| S1 | `/s/`, `/s/#d=…` | Viewer de un enlace compartido | `identity` + `system` + `share` | es / en (i18n) |
| S1b | `/s/` vacío o roto | Estados de error del Viewer | ídem | es / en |
| S2 | Present (editor y Viewer) | Modo presentación, material inverso | `system` | es / en |
| S3 | `/ejemplos/` | Galería de 8 ejemplos | `pages` | solo es |
| S4 | `/docs/` | Documentación, una sola página | `pages` | solo es |
| S5 | `/privacidad/` · `/privacy/` | Política de privacidad | `pages` | es · en (páginas hermanas) |
| S6 | `/terminos/` · `/terms/` | Términos | `pages` | es · en |
| S7 | `/soporte/` · `/support/` | Soporte | `pages` | es · en |
| S8 | cualquier ruta inexistente | 404 | página por defecto de Vercel | inglés fijo |
| S9 | sin red, ruta inexistente | `sw.js` responde con el editor (`./index.html`) | — | — |
| S10 | Activos de marca | favicon (data URI en las 10 páginas), `assets/logo.svg`, `assets/og-image.png`, `manifest.webmanifest`, `theme-color` | — | — |
| S11 | `mcp.fluyo.space/` | Portada del servidor MCP (repo `fluyo-mcp`) | propia | solo es |

No existen About ni Help como páginas: la ayuda está en `/docs/` y en «Más» › Atajos y gestos. Tampoco hay `404.html`,
`vercel.json` ni `<noscript>` en el editor ni en el Viewer.

El editor enlaza desde «Más» › Fluyo a Docs, Ejemplos, Privacidad y Soporte (Términos no aparece) y a los dos repos.

## 2. Diagnóstico

### 2.1 Medidas

| Propiedad | Editor / Viewer (`system.css`) | Páginas estáticas (`pages.css`) |
|---|---|---|
| Fondo | hueso `#F2EDE3` | casi negro `#111213` · cabecera `#1B1D1F` |
| Texto | tinta `#16150F` | `#E8E6E1` / `#D5D2CB` |
| Voz de significado | Playfair Display 400 | Georgia |
| Voz de control y datos | IBM Plex Mono 400/500 | Segoe UI · `code` en Cascadia/Consolas |
| Fuentes cargadas | Playfair 400, Plex Mono 400 y 500 | **ninguna** (0 `@font-face` usadas) |
| Acento de acción | terracota `#A33A22` | naranja `#D08B5B` (el de antes de 018.13) |
| Activo | oliva `#4E5A3F` | naranja |
| Enlaces | — (no hay texto corrido) | cian `#3AA7E8` (el que la decisión 141 retiró del render) |
| Botón principal | 30 px (44 con dedo), radio 5, mono 12 | 41 px, radio 7, Segoe 14 |
| Cabecera | 50 px, filete `rgba(22,21,15,.24)` | 54 px; 84 px a 375 en las legales (la nav salta de línea) |
| Marca | «fluyo»: «flu» tinta + «yo» terracota, `gap:0` | **«flu yo»**: `gap:7px` del `flex` separa las dos mitades |
| `theme-color` | `#F2EDE3` | `#111213` |
| Objetivo táctil en la nav | 40–44 px | 23 px |

### 2.2 Clasificación

| Superficie | Veredicto | Motivo |
|---|---|---|
| S0 Editor | COHERENTE | Es la referencia (018.13–018.30). |
| S1 Viewer | COHERENTE | Decisión 130: mismos tokens, misma marca, mismas voces. Papel y tinta; el lienzo a sangre. |
| S1b Errores del Viewer | PARCIAL | Mismo material y voz (mono, `--ink-3`, centrado), pero el estado no ofrece salida: «Abrir en Fluyo» está deshabilitado y el único camino es la marca o el pie. |
| S2 Present | COHERENTE | Material inverso de `system.css`. |
| S3 Ejemplos | INCOHERENTE | Tema oscuro antiguo, 8 tarjetas de panel con botón naranja cada una (8 primarios por página), vistas previas sobre `#161616`. 5,4 pantallas a 1440; a 375 la primera vista previa empieza a 665 px. |
| S4 Docs | INCOHERENTE | Mismo tema antiguo. 20,7 pantallas a 375 sin índice ni anclas (0 `id` en los `h2`). Dos `h4` con `style` inline. Tres `code` se salen del ancho a 375. |
| S5–S7 Legales y soporte | INCOHERENTE | Tema antiguo. A 375 la cabecera ocupa dos filas (84 px). Las tablas de privacidad desbordan (scroll propio). |
| S8 404 | INCOHERENTE | Página por defecto de Vercel, oscura, en inglés («This page doesn't exist»), sin marca ni salida a Fluyo. |
| S9 Ruta inexistente sin red | PARCIAL | Se abre el editor en una URL equivocada. Es la única superficie sin red, pero sorprende. |
| S10 Activos de marca | INCOHERENTE | Favicon, `logo.svg` y la imagen OG son cuadrado negro con puntos naranja `#D08B5B` y Georgia. El manifest pinta el splash de la PWA en `#111213` antes de abrir un editor color hueso. |
| S11 `mcp.fluyo.space` | INCOHERENTE | Oscura, serif de sistema, enlaces azules. Vive en otro repo. |

Resumen: el editor, el Viewer y Present forman una sola familia. **Todo lo que pasa por `css/pages.css` es la identidad
anterior a 018.13**: la migración del editor (decisión 123) y la del Viewer (decisión 130) nunca llegaron a las páginas. No
son ocho problemas distintos sino una sola hoja, `pages.css`, que redefine en local los tokens antiguos (`--bg:#111213`,
`--accent:#d08b5b`, `--accent2:#3aa7e8`) en vez de cargar `system.css`.

## 3. Peores inconsistencias (por impacto)

1. **Dos productos al pasar de página.** Editor → Ejemplos → «Abrir en el editor»: papel → negro → papel. En el teléfono
   también cambia el color de la barra del navegador (`theme-color`). Es lo primero que nota quien llega desde un buscador:
   `sitemap.xml` da a `/ejemplos/` prioridad 0,9.
2. **La marca se escribe distinto.** «flu yo» con hueco y naranja en las páginas; «fluyo» compacta y terracota en el editor y
   el Viewer. El nombre del producto no puede tener dos grafías.
3. **Paleta retirada a la vista.** El naranja `#D08B5B` (antiguo acento) es la acción y el cian `#3AA7E8` es el enlace: los dos
   colores que 018.13–018.15 retiraron del chrome y del render siguen siendo la cara pública.
4. **Sin tipografía propia.** Las páginas no cargan Playfair ni Plex: Georgia + Segoe es el look de antes. La serif y la mono
   son la mitad de la identidad (decisión 125).
5. **404 ajeno.** La página por defecto del hosting, en inglés y oscura, es una superficie pública de Fluyo sin nada de Fluyo.
6. **Navegación distinta en cada página.** Docs y Ejemplos: Editor · Ejemplos · Docs · GitHub. Legales: Editor · Docs ·
   Privacidad · Términos · Soporte (sin Ejemplos). El pie cambia en las ocho: Docs y Ejemplos enlazan MCP, las legales el
   cambio de idioma. No hay un modelo de navegación, hay ocho listas.
7. **Tarjetas como estructura.** Ejemplos es una pila de 8 tarjetas de panel con borde, radio 11 y un primario naranja en cada
   una. Es la estética de galería SaaS que el North Star evita y multiplica la acción principal.
8. **Táctil por debajo del sistema.** Enlaces de la nav de 23 px de alto frente a los 40–44 px del editor (decisión 138, 018.17
   D6).

## 4. Product Shell recomendado

Una superficie de Fluyo fuera del editor es **papel y tinta, con la marca a la izquierda, dos voces y una sola acción
principal**. Comparte con el editor los tokens, la marca, las voces y los componentes básicos. **No** comparte su densidad
de herramienta.

### 4.1 Estructura

```
┌──────────────────────────────────────────────────────────────────────────┐
│ fluyo•••    Ejemplos  Docs                          ES ▾   [Abrir Fluyo] │  50 px · --surface · filete --rule-2
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ RÓTULO (kicker mono)                                                     │  contenedor: min(1120px, 100% − 2·gutter)
│ Título en Playfair                                                       │  todo alineado al mismo borde izquierdo
│ Entradilla, máx. 68ch                                                    │
│                                                                          │
│ Cuerpo, máx. 68ch ─ o ─ zona ancha (galería, diagrama) hasta 1120 px     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ MIT · Privacidad · Términos · Soporte · GitHub · MCP          English    │  pie: una línea, mono 11, --ink-3
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Navegación

- **Cabecera:** marca → `/` · navegación de producto (**Ejemplos**, **Docs**) · selector de idioma · acción **«Abrir Fluyo»**.
  Lo legal y el soporte van **solo al pie**: así la cabecera tiene 2 enlaces y no salta de línea en ningún idioma.
- La página actual: `aria-current="page"`, tinta con subrayado oliva de 2 px (el `.tabs` activo del editor), no un color
  distinto.
- «Abrir Fluyo» es **secundario** (papel levantado y borde), no terracota: en una página de lectura la acción principal es
  del contenido (abrir *este* ejemplo), no del chrome. Así hay como mucho un terracota por vista.
- Sin hamburguesa: si no cabe, la acción se queda en icono con su nombre accesible (como «Abrir» del Viewer en el teléfono).
- **Pie:** el mismo en todas las páginas: licencia · Privacidad · Términos · Soporte · GitHub · MCP · idioma hermano. Aporta: es
  el sitio de lo legal y hoy ya existe; lo que falta es que sea uno solo.

### 4.3 Marca

- Wordmark de texto: `flu` en `--ink` + `yo` en `--attention`, Playfair 400 a `--fs-display` (21 px), `gap:0`, los tres puntos
  terracota de 5 px (los anima `identity.css`; sin animación con `prefers-reduced-motion`). Igual que `styles.css` y `share.css`.
- Sin logo gráfico, sin eslogan en la cabecera ni hero.
- `theme-color` `#F2EDE3` en todas las páginas.

### 4.4 Tipografía y escala

Dos voces, las del editor; la escala sí cambia, porque una página se lee y el editor se maneja.

| Rol | Voz | Escritorio | ≤ 620 px | Equivalente en el editor |
|---|---|---|---|---|
| Título de página (`h1`) | Playfair 400, interlineado 1.15, `-0.01em` | 34 | 28 | marca / títulos serif |
| Sección (`h2`) | Playfair 400 | 24 | 21 | `--fs-title` del panel |
| Rótulo (`h3`, kicker) | Plex Mono 500, mayúsculas, `--track-micro` | 11 | 11 | `.menuKicker` |
| Cuerpo | **Plex Mono 400** (ver D1), 1.7 | 14.5 | 14 | `--fs-body` |
| Entradilla | Plex Mono 400, `--ink-2` | 16 | 15 | — |
| Metadato, pie, tabla | Plex Mono 400, `--ink-3` | 11–12 | 11–12 | `--fs-label` |
| Código | Plex Mono sobre `--surface-sunken` | 13 | 13 | bloque `code` |

- Ancho de lectura `68ch` (≈ 600 px con la mono a 14,5).
- Las cifras de esta tabla son tokens nuevos de página (`--fs-page-*`) en `pages.css`, **no** cambios en `--fs-*` del editor.

### 4.5 Color y fondos

- Fondo de página `--surface`. Bloques que necesitan separarse (código, nota): `--surface-raised` con filete `--rule` o
  `--surface-sunken` sin borde. Nada más.
- Texto `--ink` / `--ink-2`; metadatos `--ink-3`; nunca `--ink-off` para texto.
- **Enlace**: `--ink` con subrayado de 1 px en `--rule-hover` y `text-underline-offset:3px`; al pasar, subrayado `--ink`. Sin
  azul ni naranja.
- **Terracota** = la acción de la vista (máx. una por pantalla). **Oliva** = estado activo (página actual, foco `--focus`).
- **Lienzo**: un diagrama es la única superficie oscura posible, y es del documento. Se muestra con el marco del editor
  (decisión 124): filete de tinta, radio `--r-md`, sombra interior mínima. Nunca un fondo oscuro de página.
- Sin degradados, sin sombras de tarjeta, sin glow.

### 4.6 Ancho, espaciado y bordes

- Contenedor `min(1120px, 100% − 2·gutter)`; gutter 24 px en escritorio y 16 px a ≤ 620. La marca de la cabecera, el `h1` y el
  pie comparten el mismo borde izquierdo.
- Ritmo vertical con la escala del sistema más tres pasos de página: `--s-6:32px`, `--s-7:48px`, `--s-8:64px`.
- Separar con **filetes** (`--rule`) y aire, no con cajas. Radios solo los del sistema (`--r-xs`, `--r-sm`, `--r-md`).

### 4.7 Botones y enlaces de acción

- `<a class="btn">` toma la forma de los botones de `system.css`: alto `--ctl-h` (30) y `--ctl-h-touch` (44) con
  `pointer:coarse`, radio `--r-sm`, Plex Mono 500 a 12.
- Tres variantes, las mismas del editor: **primaria** (terracota), **secundaria** (papel levantado + `--rule-2`),
  **fantasma**.
- Un enlace que sale de Fluyo lleva `↗` (el icono `i-arrow` del editor), no otro estilo.

### 4.8 Iconografía

- Solo el sprite del editor (un trazo, 1,6, decisión 126), y solo en acciones y navegación (abrir, descargar, salir ↗,
  GitHub). Ningún icono decorativo junto a títulos o párrafos.
- 0 emoji, 0 dingbats como icono. `docs/` tiene hoy un `⚙`: es una referencia al botón del editor, aceptable como texto, pero
  conviene sustituirlo por el nombre del control.

### 4.9 Estados

- **404 propio** (`/404.html`, que el hosting sirve solo): marca, un `h1` en Playfair («Esta página no existe»), una línea y
  dos salidas: «Abrir Fluyo» (primaria) y «Ejemplos». Mismo shell.
- **Error del Viewer**: mantener el material actual y añadir una salida («Ir a Fluyo») dentro del propio estado.
- **Sin red**: una página estática precacheada se abre como siempre. Para la ruta inexistente sin red, ver D8.

## 5. Reglas visuales (la lista corta)

Una superficie nueva parece Fluyo si cumple las diez:

1. Carga `identity.css` + `system.css` y su hoja de colocación. Ningún color, radio ni fuente fuera de los tokens.
2. Fondo `--surface` y `theme-color` `#F2EDE3`.
3. Marca de texto a la izquierda de una cabecera de 50 px, con el filete `--rule-2`.
4. Dos voces: Playfair para lo que significa y Plex Mono para lo demás.
5. Una sola acción terracota por vista; el resto, secundaria o fantasma.
6. Enlaces en tinta subrayada; oliva solo para el estado activo y el foco.
7. Filetes y aire antes que tarjetas; si algo necesita marco, es un diagrama, y lleva el marco del lienzo.
8. Lectura a `68ch`; zona ancha hasta 1120 px; un único borde izquierdo.
9. Iconos del sprite, solo en acciones; 0 emoji, 0 degradados, 0 hero.
10. Todo texto estático es localizable (ver § 8.3) y el diseño aguanta un 30 % más de longitud.

## 6. Qué se comparte

| Pieza | Fuente hoy | En el shell |
|---|---|---|
| Tokens (primitivas, semánticos, radios, `--s-*`, sombras, `--focus`) | `system.css` | se cargan tal cual |
| Fuentes (`@font-face` y archivos) | `system.css`, `assets/fonts/` | ídem, ya precacheadas |
| Wordmark | `styles.css` y `share.css` (repetida) | una regla en `pages.css`, igual a esas dos |
| Botón primario, secundario y fantasma | `system.css` (`button`) | `.btn` con los mismos tokens |
| Rótulo (kicker) | `.menuKicker` | `h3` y rótulos de página |
| Subrayado de lo activo | `.tabs > button.active` | nav: página actual |
| Marco del lienzo | decisión 124, `styles.css` | `.canvasFrame` para vistas previas de diagramas |
| Sprite de iconos | `index.html` | ≤ 6 símbolos copiados en cada página (test de igualdad) |
| Cabecera y pie de página | — (ocho variantes) | un solo marcado, copiado en cada HTML (no hay build) |

## 7. Qué NO se comparte

- **La densidad de herramienta**: controles de 12 px y 30 px, la cabecera de tres zonas, el conmutador Editar · Historias,
  «Lienzo ▾», «Más», el rail, el panel, la barra táctil y las pestañas de página. Una página no es un editor.
- **El tema oscuro de la interfaz** (`fluyo.ui.theme`, decisión 134): las páginas, como el Viewer, quedan en papel (ver D3).
- **Los temas del lienzo** como fondo de página: oscuro, crema y claro son del documento.
- **El material inverso** de Present: es para flotar sobre el lienzo.
- **El runtime**: las páginas no cargan `ui.js`, `render.js` ni el kernel. La única excepción posible es `i18n.js` en el 404
  (§ 8.3).
- **El pie «Hecho con Fluyo» del Viewer**: es la firma de un enlace compartido, no un pie de sitio.
- **Las tarjetas** como forma por defecto de agrupar.

## 8. Responsive

### 8.1 Cortes

| Ancho | Cabecera | Contenido |
|---|---|---|
| > 1120 | marca · nav ··· idioma · Abrir Fluyo | contenedor 1120, lectura 68ch |
| 621–1120 | igual | gutter 24 |
| ≤ 620 | marca · nav ··· Abrir Fluyo (icono si no cabe); el idioma pasa al pie | gutter 16, `h1` 28, cuerpo 14 |

- La cabecera tiene **una fila** a 320 px en todos los idiomas: es el criterio de aceptación (hoy son 84 px en las legales).
- Objetivos táctiles de 44 px (`--ctl-h-touch`) en nav, acciones y pie con `pointer:coarse`.
- Tablas: se apilan o se desplazan dentro de su caja con la primera columna fija; nunca ensanchan la página. `code` largo con
  `overflow-wrap:anywhere`.
- 0 scroll horizontal en 320–1440 (test).

### 8.2 Medidas que la propuesta debería mejorar

| Medida (375 px) | Hoy | Objetivo |
|---|---|---|
| Alto de cabecera en legales | 84 px | 50 px |
| Alto de los enlaces de la nav | 23 px | 44 px |
| Elementos que desbordan | `code` (Docs), tablas (Privacidad) | 0 |
| `theme-color` | `#111213` | `#F2EDE3` |

### 8.3 I18N en el shell

- **Páginas con URL propia** (Docs, Ejemplos, legales): el texto del shell (nav, pie, «Abrir Fluyo») va **escrito en el HTML de
  cada página hermana**, en su idioma, como ya hacen `/privacy/` y `/support/`. Es lo que pide la D6 de I18N-001 (páginas
  hermanas, no diccionario) y lo que necesitan los buscadores. Cada página declara `lang`, `hreflang` y su hermana en el
  selector.
- **Páginas sin idioma en la URL** (404, errores del Viewer): `data-i18n` + `js/i18n.js` + `js/i18n-<xx>.js`, el mecanismo de
  la decisión 261. El 404 es la única página estática que lo cargaría.
- **Japonés y chino**: Playfair y Plex Mono vienen en el subconjunto latin (decisión 125). Hay que definir pilas por idioma con
  `:lang(ja)` y `:lang(zh)` que caigan en tipos **del sistema** (sin terceros, para que la política de privacidad siga siendo
  cierta). Tampoco hay mayúsculas en CJK: el kicker usa `text-transform:none` y `letter-spacing:0`, y el interlineado sube
  a 1.8.
- **Francés y demás idiomas largos**: nada de anchos fijos en botones ni en la nav, y presupuesto de +30 % de longitud. Por eso
  hay solo dos enlaces en la cabecera.
- **Idiomas RTL** (si llegan): reglas con propiedades lógicas (`margin-inline-start`, `padding-inline`) desde el primer día.
  Cuesta lo mismo y evita una reescritura.

## 9. Relación con Ejemplos (FLUYO-EXAMPLES-001)

- Ejemplos será la primera página que **se vea** cambiar, pero el shell no se puede aplicar solo a Ejemplos: las ocho páginas
  comparten `pages.css`, así que migrar esa hoja las cambia todas a la vez. Eso es una ventaja: no habrá una tercera estética
  intermedia.
- **El shell da a EXAMPLES-001:** cabecera, pie, contenedor, escala, botones (un primario por vista), el marco del lienzo
  para las vistas previas, el rótulo y la regla de «filetes antes que tarjetas».
- **EXAMPLES-001 decide:** qué ejemplos, en qué orden, qué texto, si hay filtros o categorías, la retícula de la galería
  dentro de la zona ancha, la acción de cada ejemplo y las vistas previas.
- **Para el inventario de EXAMPLES-001** (no se resuelve aquí): las 8 vistas previas SVG se exportaron antes de 018.16 (usan
  `<marker>` y la gramática de flechas antigua) y se muestran sobre `#161616`. Habrá que regenerarlas o dibujarlas con el
  marco del lienzo.
- Orden recomendado: **Shell → EXAMPLES-001** (D9). Si Ejemplos se rediseñara antes, construiría encima de la hoja que el
  shell sustituye.

## 10. Alcance técnico (slice siguiente, propuesto como FLUYO-SHELL-001)

| Archivo | Cambio |
|---|---|
| `css/pages.css` | Reescritura sobre tokens: borra la redefinición local de `--bg/--accent/--accent2` y pasa todo valor suelto a token. Añade los tokens de página (`--fs-page-*`, `--s-6…8`, `--page-wide`, `--page-read`), la cabecera, el pie, `.btn`, `.canvasFrame`, tablas y pilas `:lang()`. |
| 8 HTML (`docs`, `ejemplos`, 3 × 2 legales) | `<head>`: `identity.css` + `system.css` + `pages.css`, precarga de la mono, `theme-color` `#F2EDE3`. Cabecera y pie con el marcado único. `docs`: los dos `h4` con `style` pasan a una clase. |
| `404.html` (nuevo) | Shell + `data-i18n` + `i18n.js`/`i18n-en.js`. |
| `manifest.webmanifest` | `background_color` y `theme_color` → `#F2EDE3` (el splash de la PWA deja de ser negro). |
| favicon, `assets/logo.svg`, `assets/og-image.png` | Según D5. |
| `sw.js` | `CACHE` `v107` → **`v108`**; `404.html` en `PAGE_ASSETS`. |
| `CONTRIBUTING.md`, `.ai/ARCHITECTURE.md` | Mapa: `pages.css` deja de ser «/docs y /ejemplos» y pasa a «shell de las páginas»; diagrama de hojas. |

- **Sin cambios** en el kernel, `model.js`, `config.js`, el formato, el render, el editor, el Viewer ni el MCP. `system.css` e
  `identity.css` no cambian (D10).
- `system.css` es seguro para las páginas: sus reglas de elemento son `body` (la sobrescribe `pages.css`), `button`, `input`,
  `kbd` y `select`, y las páginas no tienen formularios. Pesa 28 kB y ya está en el precache del núcleo.
- **Tests nuevos** (estáticos): cada página pública carga `system.css`; `pages.css` sin hex ni `rgb()` fuera de `:root`; mismo
  marcado de cabecera y pie en las ocho; `theme-color` único; 0 `style=`; 0 emoji; los símbolos del sprite copiados son
  iguales a los de `index.html`; `404.html` precacheado. **Capturas**: 1440, 1024, 768, 390, 375 y 320, con el criterio de una
  fila en la cabecera y 0 scroll horizontal.
- **Riesgo conocido**: varios *undo* de tareas anteriores (`fluyo-product-narration-001-undo.cjs`,
  `fluyo-scenarios-semantics-5/6-undo.cjs`, `fluyo-step-message-001-undo.cjs`) comparan tramos de `docs/index.html`. Tocar
  su `<head>`, su cabecera y su pie puede obligar a regenerarlos. Hay que comprobarlo antes de dar el slice por cerrado.
- **Fuera del repo**: `mcp.fluyo.space` (repo `fluyo-mcp`) según D7.

Esfuerzo: es sobre todo CSS y marcado repetido en ocho archivos. Lo caro son las capturas y los *undo*, no el diseño.

## 11. Decisiones para el PO

- **D1 — Voz del cuerpo de lectura.** (A) **Plex Mono 400 a 14,5/1.7** (recomendada: cero bytes nuevos y la misma voz que el
  texto del editor y del Viewer). (B) Añadir IBM Plex Sans 400 latin (≈ 20 kB, tercera voz) solo para el texto largo de Docs y
  las legales. (C) Tipo del sistema (vuelve a parecer la web de antes). Si con A Docs se lee mal en las capturas, pasar a B.
- **D2 — Navegación pública.** Ejemplos · Docs + «Abrir Fluyo» (secundario) en la cabecera; Privacidad, Términos, Soporte,
  GitHub y MCP en el pie (recomendada). Alternativa: todo en la cabecera, que hoy ya salta de línea a 375.
- **D3 — Tema de las páginas.** Solo papel; ignoran `fluyo.ui.theme` como el Viewer (recomendada, decisión 134).
  Alternativa: seguir la preferencia oscura del editor (obliga a que `pages.css` no tenga ni un valor fuera de los tokens
  semánticos; es posible pero amplía las pruebas).
- **D4 — 404 propio** con el shell e i18n por diccionario (recomendada).
- **D5 — Activos de marca.** `theme-color` y manifest a hueso dentro del slice (recomendada). Favicon, `logo.svg` e imagen OG:
  (A) recolorearlos con el mismo motivo de tres puntos (terracota sobre hueso o hueso sobre tinta, con Playfair en la OG)
  dentro del slice; (B) slice de marca aparte. Recomiendo A para el favicon y la OG, porque es lo que se ve al compartir.
- **D6 — Esquema de URLs por idioma.** Sigue abierta desde I18N-001 (D6): `/en/…` frente a slugs traducidos (`/privacy/` ya
  existe así). El shell funciona con las dos, pero hay que elegir antes de publicar francés, japonés o chino.
- **D7 — `mcp.fluyo.space`.** Aplicar las mismas reglas en `fluyo-mcp` como tarea propia, o dejarlo como página técnica.
- **D8 — Ruta inexistente sin red.** Mantener el editor como respaldo (hoy) o servir el `404.html` precacheado a las
  navegaciones que no son el editor ni el Viewer. Recomiendo el 404: hace lo que dice la URL.
- **D9 — Orden.** Shell (las ocho páginas a la vez) antes que EXAMPLES-001 (recomendada).
- **D10 — Dónde viven los tokens.** Las páginas cargan `system.css` entero, como el Viewer (recomendada). Separar un
  `tokens.css` solo se justifica si aparece un tercer consumidor que no quiera los componentes.

## 12. Hallazgos fuera de alcance

- Editor a 375 px: el texto del lienzo vacío («…o icono a la izquierda y haz clic aquí — o p…») se corta por los dos lados
  (texto pintado en canvas, sin ajuste de línea).
- El editor y el Viewer no tienen `<noscript>`: sin JavaScript queda un chrome vacío.
- «Más» › Fluyo no enlaza Términos.

## Handoff

- **Qué se hizo**: inventario de superficies públicas (11, más activos de marca), medición de estilos computados y capturas en
  producción a 1440 y 375, diagnóstico por superficie, propuesta de Product Shell, reglas, responsive, i18n, alcance técnico y
  decisiones.
- **Archivos modificados**: solo este documento (`.ai/tasks/FLUYO-NORTHSTAR-SURFACES-001.md`, nuevo). Ningún archivo servido,
  así que no cambia `CACHE`.
- **Pruebas**: no aplica (auditoría). Las medidas salen de Chrome contra fluyo.space (`v107` = HEAD `53552a2`).
- **Decisiones**: ninguna registrada en `DECISIONS.md`. D1–D10 pendientes del PO.
- **Riesgos**: los *undo* que tocan `docs/index.html` (§ 10); la D6 de idioma sin decidir.
- **Próximo paso concreto**: el PO resuelve D1–D10. Después, FLUYO-SHELL-001 (alcance de § 10, `CACHE` v108) y, encima,
  FLUYO-EXAMPLES-001.
