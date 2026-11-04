# FLUYO-PRIVACY-GEO-001 — La política declara proveedores, retención y contenido según lo comprobado

Estado: **READY FOR REVIEW.** El push a `main` despliega producción en Vercel y queda sujeto a los gates del PO.
Owner/agente actual: libre (espera al PO)

> Repo público: este documento no contiene métricas ni datos privados.

## Problema

La política describía lo que **envía el navegador**, no lo que **Umami obtiene de la petición y registra**. Al comprobar los proveedores apareció además una discrepancia preexistente: decía que `fluyo.space` estaba alojado en Google Cloud, y lo sirve Vercel. También tenía afirmaciones absolutas sobre el contenido de los diagramas. El tracking no cambia: es solo texto.

## Condiciones del PO

Sin trackers, cookies ni identificadores nuevos. No afirmar sin evidencia que la IP sin procesar se almacena en los registros de analítica. Un plazo sin confirmar no lleva cifra. Sin promesas nuevas que no se puedan verificar. Sin cambios en MCP, Umami ni la configuración de Vercel.

## Qué se hizo

- `privacidad/` y `privacy/`: proveedores por dominio, retención por proveedor, compartición sin «Con nadie», lo que Umami obtiene de la petición, contenido de los documentos (editor, fragmento `#d=`, query y MCP), derechos y fecha.
- `README.md` y `docs/index.html`: pageviews, fingerprinting y las afirmaciones absolutas sobre el contenido.
- `index.html` y `js/analytics.js`: solo comentarios; el código ejecutable no cambia.
- `AGENTS.md`: la restricción de privacidad distingue el editor de lo enviado explícitamente al MCP.
- `sw.js`: CACHE v124. Decisión 334.
- Tests: `test/fluyo-privacy-geo-001.test.cjs` y su capa `-undo.cjs`, encadenada desde `undoRuta`; CACHE actualizada en los tests que la fijan; `test/fluyo-brand-ruta-001.test.cjs` deshace esta tarea antes de contar líneas de `index.html`.

## Deuda: fallos históricos de la suite

La suite completa tiene 84 fallos en la base `145d9ac`, los mismos antes y después de esta tarea. 63 son `FluyoStoryClock is not defined`. Los otros 21 **no están investigados ni se corrigen aquí**:

| Archivo | Fallos | Causa aparente, sin confirmar |
|---|---|---|
| `fluyo-018-25.test.cjs` | 9 | Comparan geometría con un `HEAD` que ya se ha movido |
| `fluyo-018-27.test.cjs` | 4 | Comparan con `HEAD`, y uno exige un kernel de `fluyo-mcp` resincronizado |
| `fluyo-019-2.test.cjs` | 2 | Alcance frente a `HEAD` |
| `fluyo-016`, `fluyo-017-2-qa`, `fluyo-018-17`, `fluyo-018-7d` | 1 cada uno | Buscan texto de fuente o matrices que han cambiado |
| `fluyo-019-5.test.cjs` | 1 | Alcance frente a una base antigua |
| `fluyo-i18n-002-s2b.test.cjs` | 1 | Fallo a nivel de archivo |

## Handoff

- **Pruebas:** `node --test test/fluyo-privacy-geo-001.test.cjs`, en verde. `test/fluyo-018-25.test.cjs` lee `git status`: su test de alcance falla con el árbol sin commit y pasa con el árbol limpio.
- **Retención:** 6 meses es lo que Umami declara para Hobby, y 1 hora lo que Vercel documenta para sus `runtime logs` en Hobby; ninguno se ha comprobado con borrado real. Si cambia un plan, hay que revisar la política: nada lo vigila automáticamente.
- **Dominio alternativo:** `fluyo-app.vercel.app` es el mismo despliegue de Vercel, con la telemetría apagada por `ANALYTICS_HOSTS`; la política no necesita ampliarse.
- **Próximo paso:** verificar los gates del PO. Después: fijar la fecha del día real de publicación en los dos idiomas, comprobar que v124 sigue libre, integrar en `main`, y verificar en producción interceptando `*.umami.is`.
