# Contribuir a Fluyo

Gracias por pasarte. Esta guía es corta a propósito.

## Cómo correr el proyecto

**No hay build.** No hay `npm install`, ni bundler, ni paso de compilación. Clonas, abres `index.html` en el navegador y ya estás editando.

```bash
git clone https://github.com/itsnect/fluyo.git
```

Los scripts son clásicos (no módulos ES), así que cargan desde `file://` sin problema. Solo dos cosas necesitan servirse por HTTP, porque el navegador las bloquea en `file://`: el modo offline del service worker y los enlaces `?ejemplo=<slug>`. Si vas a tocar alguna de las dos:

```bash
python -m http.server 8000     # o:  npx serve -l 8000
```

> **Al probar en local, ojo con el service worker.** El `fetch` handler es *cache-first*, así que puedes quedarte viendo una versión antigua de tus propios cambios. Si algo no se actualiza: DevTools → Application → Service Workers → **Unregister**, y borra las cachés en Application → Storage. Si añades, quitas o renombras archivos servidos, **sube la constante `CACHE` en `sw.js`**.

## Estructura de archivos

```
index.html              La interfaz completa. Solo HTML: ni estilos ni lógica.
manifest.webmanifest    Manifest de la PWA (nombre, iconos, colores).
sw.js                   Service worker: precaché y funcionamiento offline.
sitemap.xml             Rutas para los buscadores.
robots.txt              Apunta al sitemap.
LICENSE                 MIT.
ideas.md                Ideas parqueadas que aún no se implementan.

assets/
  logo.svg              Logo del proyecto.
  og-image.png          Imagen de previsualización social (1200x630).
  icon-192.png          Icono de la PWA.
  icon-512.png          Icono de la PWA.

css/
  styles.css            Estilos del editor.
  pages.css             Estilos de las páginas estáticas (/docs, /ejemplos).

js/
  analytics.js          Telemetría: condición de carga y helper trackEvent().
  config.js             Constantes, paleta, temas, tipografías, ICONS y ANIMS.
  examples.js           Carga de ejemplos vía ?ejemplo= y su lista blanca.
  state.js              Estado del documento, páginas, fábricas y autoguardado.
  selection.js          Selección, portapapeles y deshacer/rehacer.
  geometry.js           Anclas, rutas y cálculo de las flechas.
  render.js             Dibujado del lienzo y bucle de animación.
  interaction.js        Ratón, teclado, zoom/pan y pegar/soltar imágenes.
  ui.js                 Panel lateral, herramientas, cajones y pestañas.
  export.js             Guardar/abrir y exportar a GIF, PNG, JPG y SVG.

docs/index.html         Página de documentación.
ejemplos/index.html     Galería de ejemplos.
ejemplos/data/          Los .fluyo.json de cada ejemplo.
ejemplos/previews/      Previews SVG, generados con el propio exportador.
```

Los archivos de `js/` se cargan como scripts clásicos en orden de dependencia (mira el final de `index.html`) y **comparten un mismo ámbito global**. No hay `import`/`export`. Si declaras una constante de nivel superior, ten en cuenta que es global para todos los archivos.

### ¿Dónde edito cada cosa?

| Quiero cambiar… | Mira en… |
|---|---|
| Colores, iconos, temas o tipografías | `js/config.js` |
| Cómo se dibujan los nodos o la animación | `js/render.js` |
| Atajos de teclado, zoom/pan, arrastrar/soltar | `js/interaction.js` |
| Panel derecho, barra de herramientas, pestañas | `js/ui.js` |
| Autoguardado y restauración de sesión | `js/state.js` |
| Export a GIF/PNG/JPG/SVG | `js/export.js` |
| Comportamiento offline | `sw.js` |
| Aspecto del editor | `css/styles.css` |
| Aspecto de /docs y /ejemplos | `css/pages.css` |

## Qué PRs son bienvenidas

**Manda el PR directamente:**

- Iconos nuevos y animaciones GIF nuevas (guías abajo).
- Correcciones de bugs, con los pasos para reproducirlo en la descripción.
- Diagramas de ejemplo nuevos para `/ejemplos`.
- Mejoras de accesibilidad: contraste, navegación por teclado, etiquetas ARIA.
- Correcciones de texto, traducciones y documentación.
- Compatibilidad con navegadores.

**Abre un issue antes:**

- Features nuevas del editor. Es más rápido acordar el enfoque que rehacer el trabajo.
- Cualquier cosa que añada una **dependencia** o un **paso de build**. Que el proyecto sea un HTML que se abre y funciona es una restricción deliberada, no un descuido.
- Refactorizaciones grandes o mover código entre archivos. Hay varios PRs abiertos a la vez y los conflictos de merge cuestan más que la mejora.
- Cambios en el formato `.fluyo.json`, que tiene que seguir abriendo archivos antiguos.
- Cualquier cosa que envíe datos a algún sitio. Ver la sección de privacidad del [README](README.md#privacidad-y-telemetría).

## Convención de commits

El historial usa un prefijo de tipo y descripción en minúscula:

```
feat: velocidad y puntos configurables por flecha
fix: la flecha pierde el anclaje al mover el grupo
docs: documenta el formato .fluyo.json
chore: sube la versión del precaché
```

Prefijos en uso: `feat:`, `fix:`, `docs:`, `chore:`. Español e inglés conviven en el historial; usa el que prefieras, pero sé consistente dentro de un mismo PR.

## Cómo añadir un icono nuevo

Todo ocurre en `js/config.js`, dentro del objeto `ICONS`.

1. **Elige una clave** corta y en minúscula (`redis`, `nginx`, `terraform`). Es la que se guarda en el `.fluyo.json`, así que **no la cambies después**: renombrarla rompe los diagramas ya guardados.

2. **Añade la entrada** en el grupo que le corresponda:

   ```js
   redis:{g:"Varios",n:"Redis",svg:badge("#a41e11",
     `<path d="M14 26 l18 -8 18 8 -18 8z" fill="#fff"/>
      <path d="M14 34 l18 8 18 -8" fill="none" stroke="#fff" stroke-width="3.4"/>`)},
   ```

   - `g` — grupo. Usa uno de los existentes: `"Estados"`, `"General"`, `"Varios"`, `"GCP"`, `"AWS"`, `"Azure"`.
   - `n` — nombre visible bajo el icono en el cajón. Que sea corto: el espacio es de unos 9 px de fuente.
   - `svg` — usa el helper `badge(colorDeFondo, contenido)`, que ya dibuja el cuadrado redondeado.

3. **Dibuja dentro de un lienzo de 64×64.** El `badge` ocupa de 2 a 62, así que deja margen: mantén el dibujo entre 14 y 50 y quedará centrado y legible al tamaño del cajón. Hay helpers reutilizables: `wheel(color)` para el engranaje, `cylin(color)` para el cilindro de BD y `txtG(texto, color, tamaño)` para iconos de texto tipo `λ` o `ƒ`.

4. **Comprueba que funciona.** Recarga, abre el cajón **Iconos** y busca tu icono en su grupo. Colócalo en el lienzo y exporta a PNG y a SVG: el icono se incrusta como data URI, así que un SVG mal formado se nota en el export aunque el cajón se vea bien.

> **Si quieres crear un grupo nuevo** (por ejemplo `"Cloudflare"`), no basta con poner `g:"Cloudflare"`. El orden de los grupos está fijado en `js/ui.js`, en el array de `buildDrawer()`:
> ```js
> for(const g of ["Estados","General","Varios","GCP","AWS","Azure"]){
> ```
> Un grupo que no esté en esa lista **no se muestra**. Añádelo también ahí.

## Cómo añadir una animación GIF nueva

Son dos archivos: la miniatura del cajón y el dibujado por fotograma.

1. **La miniatura**, en `js/config.js`, dentro de `ANIMS`. Es un SVG *estático* que solo se usa como vista previa:

   ```js
   heartbeat:{n:"Pulso ECG", svg:badge("#20242a",
     `<path d="M12 32 h10 l4 -10 6 20 5 -10 h15" fill="none"
        stroke="#7bb85b" stroke-width="3.4" stroke-linecap="round"/>`)},
   ```

   La clave (`heartbeat`) se guarda en el `.fluyo.json`: tampoco la cambies después.

2. **La animación real**, en `js/render.js`, como un `case` nuevo del `switch(n.anim)` dentro de `drawAnim()`. Ahí tienes ya preparadas estas variables:

   | Variable | Qué es |
   |---|---|
   | `c` | El contexto 2D en el que dibujar. |
   | `t` | El tiempo en segundos. **Toda la animación tiene que derivarse de `t`.** |
   | `cx`, `cy` | El centro donde va la animación. |
   | `r` | Un radio ya escalado al tamaño del nodo. Úsalo para que crezca con él. |
   | `rate` | La velocidad, ya ajustada a `settings.speed`. |
   | `col` | El color elegido por el usuario en el panel. Respétalo. |

   ```js
   case "heartbeat":{
     const pulso = 1 + Math.sin(t * rate * Math.PI * 2) * .18;
     c.strokeStyle = col;
     c.lineWidth = r * .22;
     c.beginPath();
     c.arc(cx, cy, r * pulso, 0, Math.PI * 2);
     c.stroke();
     break;
   }
   ```

3. **Que el bucle cierre.** El export a GIF renderiza fotogramas de `t=0` a la duración elegida y espera un bucle cíclico. Si tu animación se basa en funciones periódicas de `t` (seno, o módulo con `%`) el bucle cierra solo. Si acumulas estado o usas una rampa sin reinicio, el GIF dará un salto al reiniciar.

4. **Comprueba las tres salidas.** El cajón **GIFs**, el lienzo en movimiento, y el export: a **GIF** debe animarse y cerrar el bucle; en **SVG** verás la miniatura estática del punto 1, porque el SVG no lleva la animación procedural. Eso es esperado.

## Antes de abrir el PR

- Pruébalo en el navegador. No hay tests que te cubran.
- Mira la consola: no debe aparecer ningún error nuevo.
- Si tocaste archivos servidos, sube `CACHE` en `sw.js`.
- Un PR por cambio. Es más fácil de revisar y de revertir.

¿Dudas? Abre un issue. Preguntar está bien.
