# FLUYO-I18N-EN-RELEASE-AUDIT — ¿Se puede publicar el inglés?

**Fecha:** 2026-10-31 · **Rama:** `growth-foundation-001` (dentro de FLUYO-GROWTH-FOUNDATION-001, release candidata v122) · **Estado:** APROBADA por el PO; **inglés publicado** (`released:true`, decisión 324) en la release v122.

## Método

- **Chrome real** (cdp-lite, perfil limpio) con `?lang=en`, a 1440 × 900 y 390 × 844 táctil. En cada superficie se recogió el texto visible y los atributos legibles (`title`, `aria-label`, `placeholder`, `data-tip`), y se marcó lo que parecía español (letras propias y palabras frecuentes). También se leyó `FluyoI18n.missing()`, que lista las claves que caen al español, y se buscó texto desbordado o cortado.
- **Estático:** `test/i18n-scan.cjs` cuenta el texto sin migrar por archivo, con una heurística que da falsos positivos. Se revisó a mano cada caso para separar interfaz de lo que no lo es.
- **Detección:** en una copia temporal con `released:true`, se abrió el editor con navegadores en `en-US`, `es-CL` y `de-DE`.

## Resultado por superficie (tras las correcciones de esta rama)

| Surface | ES leakage | Layout | Terminology | Status |
|---|---:|---:|---:|---|
| Entrada nueva (tarjeta) | 0 | OK (cabe a 390) | OK | OK |
| Editor: cabecera, rail, barra inferior | 0 | OK | OK | OK |
| Menú «⋯» (Archivo, Interfaz, enlaces) | 0 (antes: 2 enlaces a páginas ES) | OK | OK | Corregido |
| «Shortcuts and gestures» | 0 (antes: 13 líneas en ES) | OK | OK | Corregido |
| Lienzo (menú) | 0 | OK | OK | OK |
| Propiedades (nodo, conexión, vacío) | 0 | OK | OK | OK |
| Iconos y GIFs | 0 | OK | OK | OK |
| Modo Historias: storyboard y eventos | 0 | OK | OK | OK |
| Crear Historia: «+», tocar el sistema, crear evento | 0 | OK | OK | OK |
| Reproducción y rótulo del momento | 0 | OK (móvil incluido) | OK | OK |
| Fallos («Fail here», «Where does it fail?») | 0 | OK | OK | OK |
| Desenlaces («No failures», «Fails at step N») | 0 | OK | OK | OK |
| Variantes / «Other ways» | 0 | OK | OK | OK |
| Present (portada, reproducción, final) | 0 | OK | OK | OK |
| Share (diálogo y resultado) | 0 | OK | OK | OK |
| Viewer (portada, reproducción, final, error) | 0 de interfaz | OK | OK | OK |
| Export / Open / Save, avisos de archivo y enlace roto | 0 | OK | OK | OK |
| Sesión guardada y enlace entrante (modales) | 0 | OK | OK | OK |
| Lienzo vacío | 0 | OK (cabe a 390) | OK (neutral) | Corregido |
| Pestaña del navegador (`<title>`) | 0 (antes: ES) | — | OK | Corregido |
| 404 | 0 (antes: enlaces legales a páginas ES) | OK | OK | Corregido |
| Privacy / Support / Terms | Páginas propias en inglés | OK | OK | OK |
| Galería `/ejemplos/` y `/docs/` | Página entera en ES | — | — | Deuda (ver abajo) |
| Etiquetas sociales y descripción de `fluyo.space` | ES | — | — | Deuda (ver abajo) |

`FluyoI18n.missing()` devolvió **0** en todas las superficies. No hay desbordes nuevos: las etiquetas del rail recortadas en el escáner están ocultas a propósito, igual que en español.

## BLOCKERS

Ninguno. Ningún flujo principal muestra texto español en la interfaz ni tiene la UX rota en inglés. El recorrido completo de Growth funciona en inglés de principio a fin, en escritorio y en móvil: entrada → ejemplo → Story → fallo → otras formas → Present → Share → Viewer.

## SHOULD FIX — corregidos en esta rama (`5bbb094`)

1. **`<title>` del editor en español.** Aparecía en la pestaña de todas las superficies. Ahora es traducible (`editor.docTitle`).
2. **«Shortcuts and gestures» entero en español.** Eran 13 líneas con teclas y énfasis. Se migró como manda la decisión 277: una frase por línea con marcas `{kbd:…}` / `{b:…}`, pintadas como nodos, no por fragmentos. Un test exige en inglés las mismas marcas en el mismo orden, y las teclas con nombre se traducen («Supr» → «Del»).
3. **Privacy / Support del menú «⋯», y Privacy / Terms / Support del 404, llevaban a las páginas españolas.** `data-i18n-link` los lleva a `/privacy/`, `/support/` y `/terms/`, que ya existían.
4. **Pista del lienzo vacío** (pedido del PO). Ya no nombra «Example» (que vive en «⋯») ni «la izquierda».

Con esto, `index.html` pasa de 65 textos sin migrar a 0.

## ACCEPTED DEBT

- **`/ejemplos/` y `/docs/` solo existen en español.** Además, los ▶ de la galería llevan dentro el documento español: en el Viewer inglés, la interfaz sale en inglés y el contenido en español (decisión 260: el contenido es del autor). Dentro del editor, «See a system in motion» y «Example» abren la edición inglesa escrita a mano. **Para campañas en inglés: enlazar `fluyo.space/` (o `/?lang=en` mientras no se publique), no la galería ni la documentación.** Hacer versiones inglesas de esas páginas es trabajo de contenido, fuera de este alcance.
- **Descripción y etiquetas sociales (`og:*`) de `fluyo.space` en español.** Una página estática tiene una sola versión, y elegir idioma de previsualización es una decisión de marketing/SEO.
- **Texto técnico del kernel y del MCP** (fuera de alcance: kernel congelado). Son valores de reserva de `model.js`, mensajes técnicos de `document-integrity.js` y errores de `story-authoring.js` (que el editor ni siquiera carga). El editor siembra en el idioma de la interfaz y traduce los errores de Historia por código (`story.err.*`), así que no se ven en los flujos normales.
- La primera línea de la ayuda dice «on the left». En móvil el rail está arriba: es igual en español y viene de antes.

## Puerta técnica de la decisión 269

`test/fluyo-i18n-002-s0.test.cjs › releaseProblems()` exige **cero** textos sin migrar en **todo** el código según el escáner. Hoy hay 353:

- 143 en `config.js`: datos de paleta, ya traducidos por clave.
- 123 en `story-authoring.js`: el MCP.
- Los de `model.js` y `document-integrity.js`: kernel.
- El resto son nombres de tecla, tipografías y `console.*`.

Ninguno es interfaz visible, y la mayoría no se puede tocar sin entrar en el kernel. Esa puerta se escribió esperando cerrar S1–S3 y no se puede cumplir tal cual.

## Recomendación: **EN READY TO RELEASE** — aprobada y aplicada (decisión 324)

Cambio aplicado:

1. `js/i18n.js`: `{code:"en", tag:"en", name:"English", released:true}`.
2. Redefinir la puerta de la decisión 269 para el inglés como «diccionario completo + cero texto sin migrar en las páginas de la aplicación (`index.html`, `s/index.html`, `404.html`) + lo que quede en JS dentro de una lista explícita de no-interfaz». Eso implica actualizar `releaseProblems()` y las tres aserciones que hoy fijan «solo español publicado» en `test/fluyo-i18n-002-s0.test.cjs` (líneas 56, 59 y 235), y anotar la decisión.
3. Mismo CACHE `v122` si entra en esta release (cambia un archivo servido de la candidata, que aún no está desplegada).

**Efecto** (probado primero en una copia y después en la rama, `test/fluyo-growth-foundation-001-browser.cjs`): un navegador en inglés ve la tarjeta y toda la interfaz en inglés sin `?lang`. Uno en español sigue en español. **Cualquier otro idioma** (de, pt, fr, ja…) recibe inglés, por la reserva de la decisión 270. El Viewer se comporta igual.

## Deuda aceptada por el PO para v122 (no se corrige en v122)

- `/ejemplos/` sigue solo en español.
- `/docs/` sigue solo en español.
- Los documentos embebidos desde la galería pueden traer contenido en español.
- La descripción y las etiquetas sociales actuales pueden seguir en español.
- El texto técnico no visible del kernel y del MCP no bloquea la publicación.

## Enlaces externos en inglés

Hasta que exista una experiencia inglesa de ejemplos, los enlaces externos en inglés apuntan a **`fluyo.space/`** y nunca a `/ejemplos/`. Con el inglés publicado, `fluyo.space/` ya abre en inglés en un navegador en inglés (sin `?lang`).
