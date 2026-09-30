# PRODUCT.md — Visión pública de Fluyo

Fluyo (fluyo.space) es un editor de diagramas de arquitectura y sistemas que funciona enteramente en el navegador. Ayuda a equipos a **crear → explicar → presentar → compartir** cómo funciona su software, sus procesos o cualquier sistema técnico.

## Principios de producto

- **Sin backend, sin cuentas, sin build**: todo ocurre en el cliente. La privacidad del contenido es un diferenciador público.
- **Lenguaje visual neutro**: Fluyo no impone el vocabulario de un dominio. El usuario define sus propios eventos, frases y representación visual sobre primitivas deterministas.
- **Diagramas que se mueven**: conexiones animadas, aparición escalonada, pulso y Scenarios que cuentan una historia paso a paso.
- **Compartir sin servidor**: archivos `.fluyo.json` y enlaces `#d=` que transportan el documento de forma autocontenida.
- **Eventos → Canvas → Historia**: la biblioteca define un vocabulario reutilizable; colocarlo sobre el sistema crea apariciones en un escenario. Editar un evento tiene alcance global; quitar una aparición sólo cambia esa historia.
- **Autoría en lenguaje humano**: Eventos y Escenarios son los conceptos visibles. Las primitivas del motor quedan ocultas; frases, símbolos y ejemplos muestran qué ocurrirá.
- **Espacio adecuado para cada tarea**: los eventos se editan en un diálogo amplio fuera del panel estrecho. La historia se lee como una línea temporal, con esperas y grupos simultáneos, sin formularios por acontecimiento.
- **Colocación explícita**: soltar en vacío nunca aplica un evento a una selección anterior. El canvas identifica los objetivos compatibles antes de confirmar.

## Alcance actual

- Editor de páginas con nodos (formas, iconos, imágenes, GIFs, código) y conexiones.
- Escenarios deterministas: secuencias de eventos sobre el diagrama.
- Event types personalizados: el usuario define qué ocurre en su sistema.
- Exportación a GIF, PNG, JPG y SVG.
- Modo presentación y PWA offline.

## Lo que Fluyo NO es

- No es exclusivamente arquitectura de software, ingeniería de procesos, funnels u operaciones.
- No es una herramienta de modelado con semántica de dominio fija.
- No almacena diagramas en servidores propios.
