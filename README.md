<h1 align="center">Fluyo</h1>

<p align="center">
  <b>Diagramas que fluyen</b><br>
  <a href="https://fluyo.space">fluyo.space</a>
</p>

<!--
  PLACEHOLDER DEL GIF DE DEMO
  Graba una demo corta (crear dos nodos, conectarlos, exportar a GIF),
  guárdala como assets/demo.gif y sustituye este comentario por:

  <p align="center">
    <img src="assets/demo.gif" alt="Demo de Fluyo: crear un diagrama y exportarlo a GIF" width="760">
  </p>

  Recomendado: 760 px de ancho, menos de 15 s y por debajo de 5 MB
  (GitHub no reproduce GIFs más pesados en algunas vistas).
-->

Fluyo es un editor de diagramas de arquitectura en el que **las conexiones se mueven**: puntos que recorren las flechas mostrando la dirección del flujo, nodos que laten y elementos que aparecen en secuencia. El resultado se exporta como GIF animado, o como PNG, JPG y SVG si lo quieres estático.

El problema que resuelve: explicar un sistema distribuido con una imagen estática obliga a que quien la ve reconstruya mentalmente el orden de los pasos. Un diagrama animado lo muestra. Eso importa cuando el diagrama va a un README, a una presentación o a una propuesta de diseño — sitios donde no puedes estar delante para narrarlo.

Las herramientas que animan de verdad son de pago, viven en la nube y te piden una cuenta. Fluyo no tiene backend, no tiene cuentas y no guarda nada: el editor, la animación y hasta la codificación del GIF ocurren íntegramente en tu navegador. Es MIT, y son unos pocos archivos de HTML, CSS y JavaScript sin dependencias ni paso de compilación.

---

## Características

- **Animación de flujo** — puntos que recorren las flechas, con velocidad y cantidad globales o por flecha, y dirección normal, inversa o alterna.
- **GIFs predefinidos** — ocho animaciones dibujadas fotograma a fotograma (cargando, progreso, error, éxito, escribiendo, subiendo, latido, ticket) que se colocan como cualquier nodo.
- **Aparición secuencial** — los elementos entran uno a uno; las flechas aparecen cuando ya están sus dos nodos.
- **Exportación** — GIF con bucle perfectamente cíclico, PNG con fondo transparente, JPG y SVG vectorial.
- **Formas y nodos** — caja, cilindro/BD, rombo, círculo, hexágono y texto suelto.
- **Más de 40 iconos cloud** — GCP, AWS y Azure, más Kafka, Kubernetes, Docker, colas, cachés y balanceadores.
- **Conexiones estilo draw.io** — flechas direccionales al pasar el ratón, anclaje por lado, ruteo ortogonal y codos editables.
- **Lienzo infinito** — pan con rueda, clic derecho/central o `Alt`+arrastrar; zoom con `Ctrl`+rueda.
- **Páginas múltiples** — varias pestañas en un mismo documento, cada una con su propio export.
- **Edición cómoda** — selección múltiple con marco, `Ctrl+C/X/V/D`, `Ctrl+A`, `Ctrl+Z/Y`.
- **Imágenes** — pega con `Ctrl+V` o arrastra archivos al lienzo.
- **Estilos** — paleta semántica con nombres, rejilla amplia, color personalizado y cuentagotas.
- **Tipografías** — once familias de sistema, global o por elemento. No se descarga ninguna fuente.
- **Autoguardado** — la sesión se guarda en `localStorage` y se puede restaurar al volver.
- **PWA** — instalable y con soporte offline.
- **Temas** — fondo oscuro, crema o claro, más color de fondo personalizado.

---

## Cómo correrlo en local

Clona y abre `index.html` en el navegador. Ya está: no hay que instalar nada, ni compilar nada, ni levantar nada.

```bash
git clone https://github.com/itsnect/fluyo.git
```

Los scripts son clásicos, así que **cargan perfectamente desde `file://`**: el editor completo, los más de 70 iconos, la animación y la exportación funcionan abriendo el archivo con doble clic.

Dos cosas concretas necesitan HTTP, porque el navegador las bloquea en `file://` por seguridad:

- el **modo offline** (los service workers exigen un contexto seguro);
- los **enlaces a ejemplos** del tipo `?ejemplo=<slug>`, que hacen `fetch` de un JSON.

> Que los scripts sean clásicos y no módulos ES **es la condición que hace cierto lo de arriba**, no un detalle de estilo: un `<script type="module">` lo bloquea el navegador en `file://` por CORS, y con un solo `import` la app deja de abrirse con doble clic. Está escrito como regla dura en [CONTRIBUTING.md](CONTRIBUTING.md) y hay un test en CI que falla si alguien lo introduce.

Si quieres eso también, cualquier servidor de estáticos sirve:

```bash
python -m http.server 8000     # o:  npx serve -l 8000
```

Y abre <http://localhost:8000>.

---

## El formato `.fluyo.json`

**Guardar** (`Ctrl+S`) descarga un `.fluyo.json`: JSON legible y versionable en git junto a tu código, sin nada binario salvo las imágenes que hayas pegado.

```json
{
  "version": 3,
  "app": "fluyo",
  "doc": {
    "theme": "dark",
    "cur": 0,
    "pages": [
      {
        "name": "Página 1",
        "nextId": 4,
        "nodes": [
          { "id": 1, "shape": "rect", "x": 480, "y": 620, "w": 180, "h": 70,
            "label": "API Gateway", "color": "#6a9fb5", "order": 0 }
        ],
        "edges": [
          { "id": 3, "from": 1, "to": 2, "fromSide": "e", "toSide": "w",
            "route": "ortho", "label": "eventos", "animated": true }
        ]
      }
    ]
  },
  "settings": { "speed": 0.5, "dots": 3, "build": false, "stagger": 0.45 }
}
```

Lo esencial:

- `doc.pages` es un array: un documento son varias páginas independientes.
- Los `id` son únicos **por página**, y nodos y flechas comparten el mismo contador `nextId`.
- Las flechas referencian nodos por `from` y `to`. Si apuntan a un id inexistente, no se dibujan.
- `x` e `y` son el **centro** del nodo, no su esquina.
- Al abrir un archivo antiguo, los campos que falten se rellenan con valores por defecto.

Los [diagramas de ejemplo](https://fluyo.space/ejemplos/) son archivos `.fluyo.json` reales y descargables, así que sirven de referencia viva del formato. La [documentación](https://fluyo.space/docs/) lo explica campo por campo.

---

## Servidor MCP

[**itsnect/fluyo-mcp**](https://github.com/itsnect/fluyo-mcp) es un servidor [Model Context Protocol](https://modelcontextprotocol.io) que permite a un asistente de IA crear y editar diagramas de Fluyo: describes la arquitectura en lenguaje natural y recibes un `.fluyo.json` que abres en el editor.

Expone nueve tools: `create_diagram`, `edit_diagram`, `export_diagram`, `list_icons`, `list_colors`, `list_anims`, `list_fonts`, `list_templates` y `create_from_template`. Trabaja sobre el mismo formato, así que lo que genera se abre con el botón **Abrir** sin conversión de por medio.

Su exportador produce **solo SVG estático**: para el GIF animado, abre el documento en el editor y expórtalo desde ahí.

Se puede usar de dos formas. Como **conector remoto**, pegando `https://mcp.fluyo.space/mcp` donde tu cliente MCP pida un servidor remoto, sin instalar nada. O como **proceso local**, siguiendo el [README de ese repositorio](https://github.com/itsnect/fluyo-mcp) — requiere `npm install && npm run build`, porque el paso de compilación que este editor no tiene sí lo necesita esa herramienta.

> El editor no tiene backend, pero **el servidor MCP sí recibe el contenido del diagrama** cuando se usa como conector remoto: no puede editar lo que no ha recibido. Lo procesa en memoria y lo descarta. Los dos flujos están separados y explicados en la [política de privacidad](https://fluyo.space/privacidad/).

---

## Privacidad y telemetría

**Tus diagramas nunca salen de tu navegador.** No hay backend al que puedan ir: Fluyo es un sitio de archivos estáticos. El dibujado, la animación y la codificación del GIF ocurren en tu equipo, y el autoguardado escribe en el `localStorage` de tu navegador, no en un servidor.

En el sitio público **fluyo.space** hay telemetría de producto: pageviews y cinco eventos de uso agregados — si se creó un diagrama, si se exportó y en qué formato, si se cargó un ejemplo, si se importó un archivo y si se usó un GIF animado. Sin cookies, sin fingerprinting y sin identificar usuarios.

**El contenido de tus diagramas no se envía nunca**, ni entero ni en fragmentos. Los eventos solo llevan valores de una lista cerrada, como `png` o `gif`. Nada de etiquetas, nombres de nodos, texto ni imágenes.

El script de telemetría se carga **únicamente** cuando el hostname es el dominio oficial. Si clonas este repositorio, lo abres en local o lo self-hosteas, no se ejecuta ninguna telemetría y no se hace ninguna llamada de red: no es que los datos se descarten, es que ese código no llega a correr. Los dominios de preview quedan fuera a propósito, porque son pruebas del mantenedor y no tráfico real.

Todo esto está en [`js/analytics.js`](js/analytics.js), en un solo bloque y comentado, para que puedas comprobarlo en un minuto en lugar de creerte este párrafo. Si quieres cero telemetría, usa el proyecto en local o self-hosteado.

La única petición externa del editor es [gif.js](https://github.com/jnordberg/gif.js) desde un CDN, la librería que codifica el GIF en web workers. Se precachea en la primera visita para que funcione sin conexión.

---

## Contribuir

Las contribuciones son bienvenidas, y el proyecto está pensado para que empezar sea fácil: no hay build, no hay dependencias y cada archivo tiene una responsabilidad clara.

Lee **[CONTRIBUTING.md](CONTRIBUTING.md)** — trae la estructura de archivos con una línea por archivo, la convención de commits y guías paso a paso para las dos contribuciones más habituales: **añadir un icono** y **añadir una animación GIF**.

¿Una idea que no vas a implementar ahora? Apúntala en [`ideas.md`](ideas.md).

---

## Licencia

[MIT](LICENSE) © 2026 Claudio Jiménez Flores y los contribuidores de Fluyo.
