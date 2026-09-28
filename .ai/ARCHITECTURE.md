# ARCHITECTURE.md — Arquitectura técnica actual de Fluyo

Descripción del sistema **real y actual**, construida a partir del repositorio. Si el código cambia, este documento se corrige. Es un mapa para saber *dónde* buscar, no una explicación línea a línea.

---

## Stack

Responsabilidad: tecnologías con las que está construido el producto.

- HTML + CSS + JavaScript **vanilla**, sin build, sin bundler, sin dependencias npm.
- Única dependencia externa en runtime: [gif.js](https://github.com/jnordberg/gif.js) desde CDN (codificación de GIF en web workers), precacheada por el service worker.
- Canvas 2D para el lienzo y la animación; DOM para paneles y cajones.
- Sitio estático servido en fluyo.space (origen de los detalles de deploy: `POR CONFIRMAR`, no hay workflow en este repo).

Entradas relevantes: `README.md`, `CONTRIBUTING.md`, `index.html`.

Notas:
- Los scripts de `js/` son **clásicos (no módulos ES)** y comparten un ámbito global, cargados en orden de dependencia al final de `index.html`. Ver D-002 en `.ai/DECISIONS.md`.
- Se soporta la apertura directa desde `file://`. Solo el modo offline (service worker) y `?ejemplo=` (fetch de JSON) requieren HTTP.

## Entrypoints

Responsabilidad: puntos de entrada de la aplicación y de las páginas satélite.

- `index.html` — el editor completo. Solo HTML: ni estilos ni lógica inline.
- `docs/index.html` — documentación del formato `.fluyo.json`.
- `ejemplos/index.html` — galería de ejemplos (cada uno es un `.fluyo.json` real en `ejemplos/data/`).
- `privacidad/`, `soporte/`, `terminos/` y sus variantes en inglés (`privacy/`, `support/`, `terms/`) — páginas estáticas legales/de soporte.
- `sw.js` + `manifest.webmanifest` — PWA instalable y offline.

## Módulos / features principales

Mapa de `js/` (un archivo = una responsabilidad; detalle por archivo en `CONTRIBUTING.md`):

| Archivo | Responsabilidad |
|---|---|
| `js/config.js` | Constantes: paleta semántica, temas, tipografías, catálogos `ICONS` y `ANIMS`. |
| `js/state.js` | Estado del documento y las páginas, fábricas de nodos/flechas, autoguardado y restauración. |
| `js/selection.js` | Selección múltiple, portapapeles (`Ctrl+C/X/V/D`), deshacer/rehacer. |
| `js/geometry.js` | Anclaje por lado, ruteo ortogonal, codos editables, geometría de flechas. |
| `js/render.js` | Dibujado del lienzo en canvas y bucle de animación (puntos de flujo, latidos, aparición secuencial). |
| `js/interaction.js` | Ratón, teclado, zoom/pan del lienzo infinito, pegar (`Ctrl+V`) y arrastrar/soltar imágenes. |
| `js/ui.js` | Panel lateral, barra de herramientas, cajones (iconos, GIFs, estilos) y pestañas de página. |
| `js/export.js` | Guardar/abrir `.fluyo.json`, exportar GIF, PNG, JPG y SVG. |
| `js/deeplink.js` | Documento embebido en la URL (`fluyo.space/#d=`), sin pisar la sesión en curso. |
| `js/examples.js` | Carga de ejemplos vía `?ejemplo=<slug>` con lista blanca de slugs. |
| `js/analytics.js` | Telemetría de producto; ver § Analytics. |

Dependencias entre módulos: se resuelven por orden de carga en `index.html` (config → state → selection → geometry → render → interaction → ui → export) y por convención de nombres globales.

## Editor / canvas

Responsabilidad: superficie de edición.

- Lienzo infinito sobre `<canvas>` 2D: pan con rueda, clic derecho/central o `Alt`+arrastrar; zoom con `Ctrl`+rueda.
- Nodos: caja, cilindro/BD, rombo, círculo, hexágono, texto suelto, imágenes pegadas y GIFs animados predefinidos.
- Conexiones estilo draw.io: flechas direccionales al pasar el ratón, anclaje por lado, ruteo ortogonal y codos editables.
- Edición: selección con marco, atajos `Ctrl+C/X/V/D`, `Ctrl+A`, `Ctrl+Z/Y`; estilos con paleta semántica y cuentagotas; 11 familias tipográficas de sistema.

Archivos/rutas principales: `js/render.js`, `js/geometry.js`, `js/interaction.js`, `css/styles.css`, `index.html`.

## Modelo / documento Fluyo

Responsabilidad: estructura de datos que se guarda y comparte.

- Un documento es `{ version, app, doc, settings }`; `doc.pages` es un array de páginas independientes (`POR CONFIRMAR` la versión actual del campo `version` — el README muestra `"version": 3`; comprobar en `js/state.js`/`js/export.js` si se toca el formato).
- Cada página: `{ name, nextId, nodes, edges }`.
- `id` únicos por página; nodos y flechas comparten el contador `nextId`. Las flechas referencian nodos por `from`/`to` (si el id no existe, no se dibujan).
- `x`,`y` son el **centro** del nodo.
- `settings`: velocidad y cantidad de puntos globales, `build` (aparición secuencial), `stagger`.
- Al abrir archivos antiguos, los campos que falten se rellenan con valores por defecto (retrocompatibilidad).

Archivos/rutas principales: `js/state.js` (fábricas y defaults), `js/export.js` (serialización), `docs/index.html` (referencia campo a campo), `README.md` § "El formato .fluyo.json".

## Import / export

Responsabilidad: entrar y salir del formato Fluyo.

- **Guardar** (`Ctrl+S`): descarga `.fluyo.json` (JSON legible y versionable; imágenes como data URI).
- **Abrir**: lee `.fluyo.json` desde disco.
- **Export**: GIF animado con bucle cíclico (gif.js en web workers), PNG con fondo transparente, JPG, SVG vectorial (los GIFs animados se incrustan como miniatura estática en SVG — comportamiento esperado).
- **Deep link**: `fluyo.space/#d=<documento comprimido>` transporta el diagrama completo en la URL; un documento entrante por URL no pisa el trabajo en curso (rama `feat/deep-link`).

Archivos/rutas principales: `js/export.js`, `js/deeplink.js`.

## Presentación / animación

Responsabilidad: el movimiento como significado.

- Puntos que recorren las flechas (velocidad y cantidad globales o por flecha; dirección normal, inversa o alterna).
- Nodos con animaciones procedurales (`switch(n.anim)` en `drawAnim()`, todas derivadas del tiempo `t` para que el bucle del GIF cierre).
- Aparición secuencial: los elementos entran uno a uno; las flechas aparecen cuando ya están sus dos nodos.

Archivos/rutas principales: `js/render.js` (bucle y `drawAnim`), `js/config.js` (catálogo `ANIMS`).

## Persistencia

Responsabilidad: dónde vive el trabajo del usuario.

- Autoguardado en `localStorage` del navegador; restauración al volver. Sin backend, sin cuentas.
- `.fluyo.json` como formato de archivo portátil; `#d=` como transporte por URL.
- Service worker (`sw.js`) con precaché *cache-first* offline: subir la constante `CACHE` al tocar cualquier archivo servido.

Archivos/rutas principales: `js/state.js`, `sw.js`.

## Analytics

Responsabilidad: telemetría de producto sin contenido sensible.

- Umami (script de `js/analytics.js`), cargado **solo** cuando el hostname es el dominio oficial (`fluyo.space`); en local o self-host no corre.
- Eventos agregados de lista cerrada (crear, exportar y formato, cargar ejemplo, importar, usar GIF animado). El fragmento de URL no se envía.
- El contenido de los diagramas **nunca** se envía. Excepción documentada: el servidor MCP remoto sí recibe el diagrama para procesarlo (ver § MCP y `privacidad/`).

## MCP

Responsabilidad: integración con asistentes de IA.

- El servidor MCP vive en el **repositorio hermano** `itsnect/fluyo-mcp` (TypeScript, con build). No explorarlo desde este repo; si una tarea lo requiere, pedir confirmación.
- Contrato visible desde aquí: nueve tools (`create_diagram`, `edit_diagram`, `export_diagram`, `list_icons`, `list_colors`, `list_anims`, `list_fonts`, `list_templates`, `create_from_template`) que producen consumen el formato `.fluyo.json` nativo. Su exportador produce solo SVG estático; el GIF animado se exporta desde el editor.
- Referencia: `README.md` § "Servidor MCP". `POR CONFIRMAR`: detalles de despliegue del conector remoto (`mcp.fluyo.space`) — viven en el otro repo.

## Routing

Responsabilidad: "rutas" del sitio estático.

- No hay router de SPA. El sitio es archivos estáticos: `/`, `/docs/`, `/ejemplos/`, `/privacidad/`, `/privacy/`, `/soporte/`, `/support/`, `/terminos/`, `/terms/` (ver `sitemap.xml`).
- Parámetros/fragmentos consumidos en cliente: `?ejemplo=<slug>` (`js/examples.js`) y `#d=<doc>` (`js/deeplink.js`).

## Estado global

Responsabilidad: cómo se comparte el estado en runtime.

- Sin framework de estado: variables globales en el ámbito compartido de los scripts clásicos. El documento vive en `js/state.js`; la selección y el historial en `js/selection.js`.
- Implicación: al añadir una constante de nivel superior en cualquier `js/*.js`, es global para todos los archivos. Evitar colisiones de nombres.

## Testing

Responsabilidad: cómo se verifica el comportamiento.

- No hay suite de tests automatizados en este repo ni CI propia (`.github/` solo tiene plantillas de issues).
- Verificación manual en navegador: la apertura desde `file://`, la consola sin errores y los tres exports (GIF/PNG/SVG). Ver `CONTRIBUTING.md` § "Antes de abrir el PR".
- `test/` contiene harness HTML de desarrollo (`documento-entrante.html`, `editor-inline.html`, `fixtures/`) — páginas de apoyo manual, no tests ejecutables.
- El test `no-esm.test.ts` que vigila la regla "sin módulos ES" vive en el repo de `fluyo-mcp` y corre en su CI.

## Build / deploy

Responsabilidad: cómo se publica.

- **No hay build**: lo servido es el propio repositorio. Deploy = servir los archivos estáticos (detalles del hosting/CDN: `POR CONFIRMAR`, no hay workflow de deploy en este repo).
- Regla operativa: cada cambio en archivos servidos obliga a subir `CACHE` en `sw.js` (el cache-first no revalida por sí solo).
