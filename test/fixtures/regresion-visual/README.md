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

## Dónde corre el test

Fluyo no tiene runner de tests, y meterlo rompería «cero dependencias, cero
build». El test vive en el otro repo:

```
fluyo-mcp/test/visual-regression.test.ts
```

Comprueba las 2 fixtures de aquí más los 5 ejemplos de `ejemplos/data/` y busca
cuatro defectos: aristas paralelas con la misma ruta, etiquetas encima de nodos o
de otras etiquetas, aristas que atraviesan un nodo, y extremos que no aterrizan
en el borde.

**Y comprueba este repo directamente.** Una de sus suites carga
`fluyo/js/geometry.js` —este archivo, el que ejecuta el navegador— en un contexto
de Node y verifica que produce exactamente la misma geometría que el port de
`fluyo-mcp/src/svg.ts`. Los dos son copias manuales el uno del otro; sin esa
comprobación, arreglar uno y olvidar el otro no lo nota nadie hasta que un
usuario ve el diagrama distinto en cada sitio.

Por eso: **si tocas `js/geometry.js`, el mismo cambio va en `svg.ts`**. El job
`drift` de CI en fluyo-mcp clona los dos repos y falla si divergen aunque sea 2px.

Para correrlo desde una copia local con los dos repos hermanados:

```sh
cd ../fluyo-mcp && npm test
```
