# Fixtures de regresión visual

Dos diagramas producidos por `fluyo-mcp` en producción, guardados tal cual salieron,
que se ven mal al abrirlos en la app. Están aquí para que dejen de verse mal y no
vuelvan a hacerlo.

| Archivo | Qué demuestra |
|---|---|
| `ingesta-v2.fluyo.json` | Par bidireccional 2↔10 (`check cache` / `hit`) con rutas idénticas; aristas que cruzan el cilindro PostgreSQL; extremos de arista que caen en el aire junto a nodos `icon` |
| `rag-chatbot.fluyo.json` | Par bidireccional 2↔3 (`busca contexto` / `chunks relevantes`); etiquetas encima del nodo «Usuario»; etiqueta más ancha que el hueco entre nodos |

Los defectos que reproducen viven en `js/geometry.js` (rutas y anclas) y en el
dibujado de etiquetas de `js/render.js` y `js/export.js` — no en el servidor MCP.
La copia gemela está en `fluyo-mcp/test/fixtures/regresion-visual/` y debe ser
idéntica byte a byte: el mismo documento tiene que renderizarse igual en los dos
lados.

Este directorio **no se publica**: no está en `sitemap.xml` ni en la lista `ASSETS`
del service worker, y no añade dependencias ni paso de build. Son datos, se abren
con el botón **Abrir**.
