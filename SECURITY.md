# Política de seguridad

## Dónde reportar

Abre un [security advisory privado](https://github.com/itsnect/fluyo/security/advisories/new) en este repositorio. Si no puedes, abre un issue normal **sin incluir los detalles del exploit** y pide un canal privado.

Por favor, no publiques el detalle en un issue público hasta que haya un arreglo disponible.

## Qué superficie tiene Fluyo

Conviene ser concreto, porque la superficie es pequeña y eso ayuda a saber qué buscar:

- **No hay backend, ni cuentas, ni base de datos.** Fluyo es un sitio de archivos estáticos. No hay servidor que comprometer, ni credenciales que filtrar, ni datos de usuarios almacenados en ningún lado.
- **Los diagramas no salen del navegador.** El autoguardado escribe en `localStorage`, en la máquina del usuario.
- **La única dependencia externa** es [gif.js](https://github.com/jnordberg/gif.js), cargada desde cdnjs para codificar el GIF.

El vector realista es, por tanto, **abrir un archivo `.fluyo.json` de origen desconocido**: ese archivo es la única entrada que la aplicación procesa y que puede venir de un tercero. Si encuentras una forma de que un `.fluyo.json` malicioso ejecute código, exfiltre datos o escape del canvas, eso es exactamente lo que queremos saber.

También nos interesa:

- Cualquier forma de que se envíen datos del diagrama a un sitio externo.
- Cualquier forma de que la telemetría se active fuera del dominio oficial (la condición está en [`js/analytics.js`](js/analytics.js)).
- Problemas en el service worker que permitan servir contenido manipulado.

## Qué no cuenta como vulnerabilidad

- Que un usuario pueda romper **su propio** diagrama o su propio `localStorage`. Todo corre en su navegador; ahí no hay frontera de confianza que cruzar.
- Que la exportación a GIF falle sin conexión o con un bloqueador de anuncios. Es una limitación conocida y está documentada.

## Versiones

El proyecto se despliega de forma continua desde `main`. No hay ramas de soporte: el arreglo va a `main` y a producción.
