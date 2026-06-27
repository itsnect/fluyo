<p align="center">
  <img src="assets/logo.svg" alt="Logo de Fluyo" width="96" height="96">
</p>

<h1 align="center">Fluyo</h1>

<p align="center">
  Diagramas de arquitectura <b>animados</b> que exportas a <b>GIF, PNG o JPG</b> desde el navegador.
</p>

Fluyo es un editor para dibujar diagramas de sistemas (servicios, colas, bases de datos, iconos cloud…) con flechas que muestran el flujo en movimiento. Todo corre en tu navegador: no hay cuenta, no hay backend y tus diagramas nunca salen de tu máquina. La edición, la animación y hasta la codificación del GIF ocurren al 100% en el cliente.

---

## Características

- **Formas y nodos** — caja, cilindro/BD, rombo, círculo, hexágono y texto.
- **Iconos cloud** — GCP, AWS, Azure, además de Kafka, Kubernetes, colas, APIs y más.
- **Conexiones estilo draw.io** — flechas direccionales al pasar el ratón, anclaje por lado, ruteo ortogonal y codos editables.
- **Animación** — flujo de puntos sobre las flechas, pulso por nodo y aparición secuencial de los elementos.
- **Edición cómoda** — selección múltiple con marco y atajos (`Ctrl+C/X/V/D`, `Ctrl+A`, `Ctrl+Z/Y`).
- **Imágenes** — pega con `Ctrl+V` o arrastra archivos al lienzo.
- **Páginas múltiples** — varias pestañas en un mismo documento; guarda y abre archivos `.fluyo.json`.
- **Exportación** — GIF con loop perfectamente cíclico, PNG con fondo transparente y JPG, hasta 1920×1080.
- **Temas** — fondo oscuro o crema, con paleta semántica de colores.

---

## Estructura del proyecto

El código está separado por responsabilidades para que sea fácil de leer y de modificar. Si quieres tocar algo, esta es tu chuleta:

```
fluyo/
├── index.html          → solo el HTML (interfaz y contenedores)
├── css/
│   └── styles.css      → todos los estilos
└── js/
    ├── config.js       → constantes, paleta de colores, temas e iconos cloud
    ├── state.js        → estado del documento, páginas y utilidades base
    ├── selection.js    → selección, copiar/pegar y deshacer/rehacer
    ├── geometry.js     → anclas, rutas y cálculo de las flechas
    ├── render.js       → dibujado del lienzo y bucle de animación
    ├── interaction.js  → ratón, teclado y pegar/soltar imágenes
    ├── ui.js           → panel lateral, herramientas, iconos y pestañas
    └── export.js       → guardar/abrir y exportar a GIF, PNG y JPG
```

Los archivos JS se cargan como scripts clásicos en orden de dependencia (ver el final de `index.html`), así que comparten un mismo ámbito global. **No hay módulos ES, ni `import`/`export`, ni paso de build.**

### ¿Dónde edito cada cosa?

| Quiero cambiar… | Mira en… |
|---|---|
| Colores, iconos o temas | `js/config.js` |
| Cómo se dibujan los nodos o la animación | `js/render.js` |
| Atajos de teclado o arrastrar/soltar | `js/interaction.js` |
| Panel de la derecha, herramientas o pestañas | `js/ui.js` |
| El export a GIF/PNG/JPG | `js/export.js` |
| El aspecto visual (CSS) | `css/styles.css` |

---

## Cómo ejecutarlo en local

Como el código está repartido en varios archivos, hay que servirlo desde un servidor local (abrir el `index.html` con doble clic no carga bien los `.js`).

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

## Pendientes / Roadmap

Ideas y tareas abiertas para próximas mejoras (se aceptan PRs 🙌):

- [ ] **Decidir la licencia** — lo más probable **MIT**, para que la comunidad pueda contribuir libremente.
- [ ] **Crear el archivo `CONTRIBUTING.md`** con la guía de contribución (flujo de trabajo, estilo de código y cómo probar los cambios).
- [ ] **Traducir el README** al inglés (`README.en.md`) para llegar a más gente.
- [ ] **Internacionalización (i18n) de la web** — soporte multi-idioma en la interfaz como mejora de UX.
- [ ] Más mejoras de UX/UI según vaya surgiendo feedback.

---

## Licencia

Pendiente de definir. Sugerencia: **MIT** si quieres que la comunidad contribuya libremente.
