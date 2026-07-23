<p align="center">
  <img src="assets/logo.svg" alt="Logo de Fluyo" width="96" height="96">
</p>

<h1 align="center">Fluyo</h1>

<p align="center">
  Diagramas de arquitectura <b>animados</b> que exportas a <b>GIF, PNG, JPG o SVG</b> desde el navegador.
</p>

Fluyo es un editor para dibujar diagramas de sistemas (servicios, colas, bases de datos, iconos cloud…) con flechas que muestran el flujo en movimiento. Todo corre en tu navegador: no hay cuenta, no hay backend y tus diagramas nunca salen de tu máquina. La edición, la animación y hasta la codificación del GIF ocurren al 100% en el cliente.

---

## Características

- **Formas y nodos** — caja, cilindro/BD, rombo, círculo, hexágono y texto.
- **Iconos cloud** — GCP, AWS, Azure, además de Kafka, Kubernetes, colas, APIs y más.
- **Conexiones estilo draw.io** — flechas direccionales al pasar el ratón, anclaje por lado, ruteo ortogonal y codos editables.
- **Animación** — flujo de puntos sobre las flechas, pulso por nodo y aparición secuencial de los elementos.
- **Lienzo infinito** — pan con clic derecho/central o rueda y zoom con `Ctrl+Rueda`.
- **Edición cómoda** — selección múltiple con marco y atajos (`Ctrl+C/X/V/D`, `Ctrl+A`, `Ctrl+Z/Y`).
- **Imágenes** — pega con `Ctrl+V` o arrastra archivos al lienzo.
- **Páginas múltiples** — varias pestañas en un mismo documento; guarda y abre archivos `.fluyo.json`.
- **Exportación** — GIF con loop perfectamente cíclico, PNG con fondo transparente, JPG y SVG vectorial editable.
- **Autoguardado** — la sesión se guarda sola en `localStorage` y se puede restaurar al volver.
- **PWA** — instalable y con soporte offline gracias al service worker.
- **Temas** — fondo oscuro, crema o claro, con paleta semántica de colores.

---

## Estructura del proyecto

El código está separado por responsabilidades para que sea fácil de leer y de modificar. Si quieres tocar algo, esta es tu chuleta:

```
fluyo/
├── index.html              → solo el HTML (interfaz y contenedores)
├── manifest.webmanifest    → manifest de la PWA
├── sw.js                   → service worker (precaché y offline)
├── assets/
│   └── logo.svg            → logo del proyecto
├── css/
│   └── styles.css          → todos los estilos
└── js/
    ├── config.js           → constantes, paleta de colores, temas e iconos cloud
    ├── state.js            → estado del documento, páginas, utilidades y autoguardado
    ├── selection.js        → selección, copiar/pegar y deshacer/rehacer
    ├── geometry.js         → anclas, rutas y cálculo de las flechas
    ├── render.js           → dibujado del lienzo y bucle de animación
    ├── interaction.js      → ratón, teclado, zoom/pan y pegar/soltar imágenes
    ├── ui.js               → panel lateral, herramientas, iconos y pestañas
    └── export.js           → guardar/abrir y exportar a GIF, PNG, JPG y SVG
```

Los archivos JS se cargan como scripts clásicos en orden de dependencia (ver el final de `index.html`), así que comparten un mismo ámbito global. **No hay módulos ES, ni `import`/`export`, ni paso de build.**

### ¿Dónde edito cada cosa?

| Quiero cambiar… | Mira en… |
|---|---|
| Colores, iconos o temas | `js/config.js` |
| Cómo se dibujan los nodos o la animación | `js/render.js` |
| Atajos de teclado, zoom/pan o arrastrar/soltar | `js/interaction.js` |
| Panel de la derecha, herramientas o pestañas | `js/ui.js` |
| El autoguardado y la restauración de sesión | `js/state.js` |
| El export a GIF/PNG/JPG/SVG | `js/export.js` |
| El comportamiento offline (PWA) | `sw.js` |
| El aspecto visual (CSS) | `css/styles.css` |

---

## Cómo ejecutarlo en local

Como el código está repartido en varios archivos, hay que servirlo desde un servidor local (abrir el `index.html` con doble clic no carga bien los `.js` ni el service worker).

Con **Python**:

```bash
python -m http.server 8000
```

O con **Node**:

```bash
npx serve -l 8000
```

Luego abre <http://localhost:8000> en el navegador.

---

## Privacidad y uso offline

Fluyo no requiere cuenta ni backend: los diagramas se procesan localmente y, con el autoguardado activo, la última sesión queda en el `localStorage` de tu navegador.

La exportación GIF usa [gif.js](https://github.com/jnordberg/gif.js) desde CDN. El service worker intenta precachearlo en la primera visita online; si no está en caché, el export a GIF puede fallar sin conexión. PNG, JPG, SVG y el resto de la app funcionan offline una vez cargada.

---

## Stack

HTML + CSS + JavaScript vanilla sobre Canvas 2D. Una sola dependencia externa: [gif.js](https://github.com/jnordberg/gif.js) vía CDN, que codifica el GIF en web workers. Sin frameworks, sin build, sin servidor.

---

## Desplegar en Vercel

### Opción A — GitHub (recomendada)

1. Sube esta carpeta a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. Framework Preset: **Other**. No hay build command ni output directory que configurar.
4. **Deploy**. Cada push a `main` redespliega automáticamente.

### Opción B — CLI

```bash
npm i -g vercel      # una sola vez
cd fluyo
vercel               # primer deploy (preview)
vercel --prod        # deploy a producción
```

En **Settings → Domains** puedes apuntar tu propio dominio; Vercel gestiona el SSL.

---

## Contribuir

1. Haz un fork y crea una rama para tu cambio.
2. Edita el archivo correspondiente según la tabla de arriba.
3. Pruébalo en local antes de abrir el Pull Request.

---

## Licencia

Pendiente de definir. Sugerencia: **MIT** si quieres que la comunidad contribuya libremente.
