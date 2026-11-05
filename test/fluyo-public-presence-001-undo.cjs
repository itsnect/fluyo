"use strict";
/* FLUYO-PUBLIC-PRESENCE-001 — Deshace en un texto los cambios de esta tarea en los archivos servidos (el correo de contacto, los enlaces a
   redes, las fechas legales y la fila de privacidad del correo). La constante CACHE de sw.js la resuelve cada test. Es la última de la
   cadena: undoGeo (fluyo-privacy-geo-001-undo.cjs) la llama la primera, así los alcances de slices anteriores la reciben sin cambiar.
   Cada pieza se sustituye por el texto exacto de la base de esta tarea (5d10065, v124). Generado del diff con una línea de contexto.
   El alcance de esta tarea lo vigila test/fluyo-public-presence-001.test.cjs. */
const BASE_PRESENCE = "5d10065";
/* Esta tarea no añade archivos servidos. */
const NEW_FILES = [];

/* [texto de esta tarea, texto de la base]. Si el texto de esta tarea no está (otra versión del archivo), no se toca nada. */
const PIECES = {
  "404.html": [
    [
      "    </nav>\n    <nav aria-label=\"Redes sociales de Fluyo\" data-i18n-aria-label=\"shell.social\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n  </div>",
      "    </nav>\n  </div>"
    ]
  ],
  "css/styles.css": [
    [
      "#siteLinks{display:grid; grid-template-columns:1fr 1fr; gap:1px;}\n#socialLinks{display:grid; grid-template-columns:repeat(3,1fr); gap:1px;}\n.moreLinks .ossLink{align-items:flex-start;}",
      "#siteLinks{display:grid; grid-template-columns:1fr 1fr; gap:1px;}\n.moreLinks .ossLink{align-items:flex-start;}"
    ]
  ],
  "docs/index.html": [
    [
      "    </nav>\n    <nav aria-label=\"Redes sociales de Fluyo\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n  </div>",
      "    </nav>\n  </div>"
    ]
  ],
  "ejemplos/index.html": [
    [
      "    </nav>\n    <nav aria-label=\"Redes sociales de Fluyo\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n  </div>",
      "    </nav>\n  </div>"
    ]
  ],
  "index.html": [
    [
      "      </a>\n      <nav id=\"socialLinks\" aria-label=\"Redes sociales de Fluyo\" data-i18n-aria-label=\"more.social\">\n        <a class=\"menuItem\" href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram</a>\n        <a class=\"menuItem\" href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok</a>\n        <a class=\"menuItem\" href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube</a>\n      </nav>\n      <p class=\"hint moreNote\" data-i18n=\"more.oss\">Fluyo es libre y de código abierto. Tu contribución es bienvenida.</p>",
      "      </a>\n      <p class=\"hint moreNote\" data-i18n=\"more.oss\">Fluyo es libre y de código abierto. Tu contribución es bienvenida.</p>"
    ]
  ],
  "js/i18n-en-editor.js": [
    [
      "  \"more.links\":\"Project links\",\n  \"more.social\":\"Fluyo on social media\",\n  \"more.contribute\":\"Contribute on GitHub\",",
      "  \"more.links\":\"Project links\",\n  \"more.contribute\":\"Contribute on GitHub\","
    ]
  ],
  "js/i18n-en.js": [
    [
      "  \"shell.legal\":\"Legal and project\",\n  \"shell.social\":\"Fluyo on social media\",\n  \"shell.privacy\":\"Privacy\",",
      "  \"shell.legal\":\"Legal and project\",\n  \"shell.privacy\":\"Privacy\","
    ]
  ],
  "privacidad/index.html": [
    [
      "<h1>Política de privacidad</h1>\n<p class=\"lead\">Última actualización: 5 de noviembre de 2026.</p>\n",
      "<h1>Política de privacidad</h1>\n<p class=\"lead\">Última actualización: 4 de noviembre de 2026.</p>\n"
    ],
    [
      "<p>Fluyo es un proyecto de software libre mantenido por <strong>itsnect</strong> (Claudio Jiménez Flores), con domicilio en Chile. No es una empresa constituida, no vende nada, no tiene clientes y no procesa pagos.</p>\n<p>Contacto para cualquier asunto de privacidad: <strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong>. Más vías en la <a href=\"../soporte/\">página de soporte</a>.</p>\n",
      "<p>Fluyo es un proyecto de software libre mantenido por <strong>itsnect</strong> (Claudio Jiménez Flores), con domicilio en Chile. No es una empresa constituida, no vende nada, no tiene clientes y no procesa pagos.</p>\n<p>Contacto para cualquier asunto de privacidad: <strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong>. Más vías en la <a href=\"../soporte/\">página de soporte</a>.</p>\n"
    ],
    [
      "  <tr><td><strong>Cloudflare</strong></td><td>En cdnjs, la petición de los archivos de <code>gif.js</code>: IP y user-agent. Como DNS de <code>fluyo.space</code>, las consultas de resolución; no las peticiones HTTP</td><td>Entrega de la librería de GIF y DNS</td></tr>\n  <tr><td><strong>Cloudflare y Google</strong></td><td>Solo si escribes a <code>hello@fluyo.space</code>: tu dirección y tu mensaje. Cloudflare los recibe y los reenvía a la cuenta de Gmail del proyecto, donde se leen y se contestan</td><td>Atender tu consulta</td></tr>\n</table>",
      "  <tr><td><strong>Cloudflare</strong></td><td>En cdnjs, la petición de los archivos de <code>gif.js</code>: IP y user-agent. Como DNS de <code>fluyo.space</code>, las consultas de resolución; no las peticiones HTTP</td><td>Entrega de la librería de GIF y DNS</td></tr>\n</table>"
    ],
    [
      "  <li>Los datos que sí existen fuera de tu equipo son los logs de plataforma, con la retención indicada arriba cuando está confirmada; los registros operativos y de seguridad que Vercel, Umami o Cloudflare puedan tener; y los registros de sesión de Umami, descritos en «Telemetría de producto». Como no están vinculados a una cuenta, normalmente no podemos localizar los tuyos.</li>\n  <li>Aun así, si quieres ejercer cualquier derecho de acceso, rectificación, supresión, oposición o portabilidad, escribe a <strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong> y se atiende.</li>\n</ul>",
      "  <li>Los datos que sí existen fuera de tu equipo son los logs de plataforma, con la retención indicada arriba cuando está confirmada; los registros operativos y de seguridad que Vercel, Umami o Cloudflare puedan tener; y los registros de sesión de Umami, descritos en «Telemetría de producto». Como no están vinculados a una cuenta, normalmente no podemos localizar los tuyos.</li>\n  <li>Aun así, si quieres ejercer cualquier derecho de acceso, rectificación, supresión, oposición o portabilidad, escribe a <strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong> y se atiende.</li>\n</ul>"
    ],
    [
      "    </nav>\n    <nav aria-label=\"Redes sociales de Fluyo\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n    <a class=\"siteLang\" href=\"../privacy/\" hreflang=\"en\" lang=\"en\">English</a>",
      "    </nav>\n    <a class=\"siteLang\" href=\"../privacy/\" hreflang=\"en\" lang=\"en\">English</a>"
    ]
  ],
  "privacy/index.html": [
    [
      "<h1>Privacy Policy</h1>\n<p class=\"lead\">Last updated: 5 November 2026. <a href=\"../privacidad/\">Versión en español</a>.</p>\n",
      "<h1>Privacy Policy</h1>\n<p class=\"lead\">Last updated: 4 November 2026. <a href=\"../privacidad/\">Versión en español</a>.</p>\n"
    ],
    [
      "<p>Fluyo is an open-source project maintained by <strong>itsnect</strong> (Claudio Jiménez Flores), based in Chile. It is not an incorporated company, sells nothing, has no customers and processes no payments.</p>\n<p>Contact for any privacy matter: <strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong>. Further channels on the <a href=\"../support/\">support page</a>.</p>\n",
      "<p>Fluyo is an open-source project maintained by <strong>itsnect</strong> (Claudio Jiménez Flores), based in Chile. It is not an incorporated company, sells nothing, has no customers and processes no payments.</p>\n<p>Contact for any privacy matter: <strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong>. Further channels on the <a href=\"../support/\">support page</a>.</p>\n"
    ],
    [
      "  <tr><td><strong>Cloudflare</strong></td><td>On cdnjs, the request for the <code>gif.js</code> files: IP and user agent. As DNS for <code>fluyo.space</code>, the resolution queries; not the HTTP requests</td><td>Delivery of the GIF library and DNS</td></tr>\n  <tr><td><strong>Cloudflare and Google</strong></td><td>Only if you write to <code>hello@fluyo.space</code>: your address and your message. Cloudflare receives them and forwards them to the project's Gmail account, where they are read and answered</td><td>Handling your enquiry</td></tr>\n</table>",
      "  <tr><td><strong>Cloudflare</strong></td><td>On cdnjs, the request for the <code>gif.js</code> files: IP and user agent. As DNS for <code>fluyo.space</code>, the resolution queries; not the HTTP requests</td><td>Delivery of the GIF library and DNS</td></tr>\n</table>"
    ],
    [
      "  <li>The data that does exist outside your machine is the platform logs, with the retention stated above where it is confirmed; any operational and security logs Vercel, Umami or Cloudflare may have; and Umami's session records, described under “Product analytics”. Since they are not linked to an account, we normally cannot locate yours.</li>\n  <li>Even so, if you wish to exercise any right of access, rectification, erasure, objection or portability, write to <strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong> and it will be handled.</li>\n</ul>",
      "  <li>The data that does exist outside your machine is the platform logs, with the retention stated above where it is confirmed; any operational and security logs Vercel, Umami or Cloudflare may have; and Umami's session records, described under “Product analytics”. Since they are not linked to an account, we normally cannot locate yours.</li>\n  <li>Even so, if you wish to exercise any right of access, rectification, erasure, objection or portability, write to <strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong> and it will be handled.</li>\n</ul>"
    ],
    [
      "    </nav>\n    <nav aria-label=\"Fluyo on social media\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n    <a class=\"siteLang\" href=\"../privacidad/\" hreflang=\"es\" lang=\"es\">Español</a>",
      "    </nav>\n    <a class=\"siteLang\" href=\"../privacidad/\" hreflang=\"es\" lang=\"es\">Español</a>"
    ]
  ],
  "soporte/index.html": [
    [
      "<h2>Correo de soporte</h2>\n<p><strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong></p>\n<p>Escribe en <strong>español o en inglés</strong>, lo que te resulte cómodo.</p>\n\n<h2>Redes oficiales</h2>\n<p>Las novedades de Fluyo también se publican en <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\">Instagram</a>, <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\">TikTok</a> y <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\">YouTube</a>. Para soporte, usa el correo o los issues.</p>\n\n<h2>Tiempo de respuesta</h2>",
      "<h2>Correo de soporte</h2>\n<p><strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong></p>\n<p>Escribe en <strong>español o en inglés</strong>, lo que te resulte cómodo.</p>\n\n<h2>Tiempo de respuesta</h2>"
    ],
    [
      "    </nav>\n    <nav aria-label=\"Redes sociales de Fluyo\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n    <a class=\"siteLang\" href=\"../support/\" hreflang=\"en\" lang=\"en\">English</a>",
      "    </nav>\n    <a class=\"siteLang\" href=\"../support/\" hreflang=\"en\" lang=\"en\">English</a>"
    ]
  ],
  "support/index.html": [
    [
      "<h2>Support email</h2>\n<p><strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong></p>\n<p>Write in <strong>English or Spanish</strong>, whichever suits you.</p>\n\n<h2>Official social media</h2>\n<p>Fluyo news is also posted on <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\">Instagram</a>, <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\">TikTok</a> and <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\">YouTube</a>. For support, use email or issues.</p>\n\n<h2>Response time</h2>",
      "<h2>Support email</h2>\n<p><strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong></p>\n<p>Write in <strong>English or Spanish</strong>, whichever suits you.</p>\n\n<h2>Response time</h2>"
    ],
    [
      "    </nav>\n    <nav aria-label=\"Fluyo on social media\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n    <a class=\"siteLang\" href=\"../soporte/\" hreflang=\"es\" lang=\"es\">Español</a>",
      "    </nav>\n    <a class=\"siteLang\" href=\"../soporte/\" hreflang=\"es\" lang=\"es\">Español</a>"
    ]
  ],
  "terminos/index.html": [
    [
      "<h1>Términos de servicio</h1>\n<p class=\"lead\">Última actualización: 5 de noviembre de 2026. <a href=\"../terms/\">English version</a>.</p>\n",
      "<h1>Términos de servicio</h1>\n<p class=\"lead\">Última actualización: 3 de agosto de 2026. <a href=\"../terms/\">English version</a>.</p>\n"
    ],
    [
      "<h2>13. Contacto</h2>\n<p>Para cualquier pregunta sobre estos términos: <strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong>, o a través de la <a href=\"../soporte/\">página de soporte</a>.</p>\n",
      "<h2>13. Contacto</h2>\n<p>Para cualquier pregunta sobre estos términos: <strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong>, o a través de la <a href=\"../soporte/\">página de soporte</a>.</p>\n"
    ],
    [
      "    </nav>\n    <nav aria-label=\"Redes sociales de Fluyo\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n    <a class=\"siteLang\" href=\"../terms/\" hreflang=\"en\" lang=\"en\">English</a>",
      "    </nav>\n    <a class=\"siteLang\" href=\"../terms/\" hreflang=\"en\" lang=\"en\">English</a>"
    ]
  ],
  "terms/index.html": [
    [
      "<h1>Terms of Service</h1>\n<p class=\"lead\">Last updated: 5 November 2026. <a href=\"../terminos/\">Versión en español</a>.</p>\n",
      "<h1>Terms of Service</h1>\n<p class=\"lead\">Last updated: 3 August 2026. <a href=\"../terminos/\">Versión en español</a>.</p>\n"
    ],
    [
      "<h2>13. Contact</h2>\n<p>For any question about these terms: <strong><a href=\"mailto:hello@fluyo.space\">hello@fluyo.space</a></strong>, or through the <a href=\"../support/\">support page</a>.</p>\n",
      "<h2>13. Contact</h2>\n<p>For any question about these terms: <strong><a href=\"mailto:nectdnb@gmail.com\">nectdnb@gmail.com</a></strong>, or through the <a href=\"../support/\">support page</a>.</p>\n"
    ],
    [
      "    </nav>\n    <nav aria-label=\"Fluyo on social media\">\n      <a href=\"https://www.instagram.com/fluyospace/\" target=\"_blank\" rel=\"noopener\" translate=\"no\">Instagram<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.tiktok.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">TikTok<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n      <a href=\"https://www.youtube.com/@fluyospace\" target=\"_blank\" rel=\"noopener\" translate=\"no\">YouTube<svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-arrow\"/></svg></a>\n    </nav>\n    <a class=\"siteLang\" href=\"../terminos/\" hreflang=\"es\" lang=\"es\">Español</a>",
      "    </nav>\n    <a class=\"siteLang\" href=\"../terminos/\" hreflang=\"es\" lang=\"es\">Español</a>"
    ]
  ]
};
function undoPresence(file, src) {
  const f = file.replace(/\\/g, "/"), pieces = PIECES[f];
  if (!pieces) return src;
  let out = src.replace(/\r\n/g, "\n");
  for (const [mine, base] of pieces) if (out.includes(mine)) out = out.replace(mine, () => base);
  return out;
}
module.exports = { undoPresence, PIECES, NEW_FILES, BASE_PRESENCE };
