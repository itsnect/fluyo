"use strict";
/* FLUYO-018.10 — la documentación del editor sigue el contrato MCP tras retirar edit_diagram (D3).

   docs/index.html (asset servido y precacheado) y README.md listaban «nueve tools», con edit_diagram, desde antes de 017. Ahora:
     · la tabla de docs/ nombra exactamente las 15 tools del contrato (y, si fluyo-mcp está al lado, las mismas que registra su server.ts);
     · edit_diagram solo aparece como retirada; los recuentos dicen 15;
     · README.md nombra las 15 y no edit_diagram;
     · sw.js: CACHE v72 (cambió un asset servido) y ./docs/ sigue en el precache. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const CONTRACT = ["author_document", "create_diagram", "create_from_template", "describe_document", "duplicate_node", "export_diagram", "list_anims",
  "list_colors", "list_fonts", "list_icons", "list_templates", "propose_layout", "reorder_nodes", "run_story", "set_theme"];
const docs = read("docs/index.html");
const tableTools = () => {
  const i = docs.indexOf("<h3>Las quince tools</h3>");
  assert.ok(i > 0, "falta la sección «Las quince tools»");
  const table = docs.slice(i, docs.indexOf("</table>", i));
  return [...table.matchAll(/<tr><td><code>([a-z_]+)<\/code><\/td>/g)].map((m) => m[1]);
};
const sentencesWith = (text, word) => text.replace(/<[^>]+>/g, "").split(/(?<=[.!?])\s+/).filter((x) => x.includes(word));

test("docs/: la tabla nombra exactamente las 15 tools del contrato, una vez cada una", () => {
  const t = tableTools();
  assert.equal(t.length, 15);
  assert.deepEqual([...t].sort(), CONTRACT);
});

test("docs/: la tabla coincide con las tools que registra fluyo-mcp (si está al lado)", { skip: !fs.existsSync(path.join(__dirname, "..", "..", "fluyo-mcp", "src", "server.ts")) && "fluyo-mcp no está al lado" }, () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "..", "fluyo-mcp", "src", "server.ts"), "utf8");
  const registered = [...server.matchAll(/server\.registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual([...tableTools()].sort(), registered);
});

test("docs/: edit_diagram solo aparece como retirada y los recuentos dicen 15", () => {
  const m = sentencesWith(docs, "edit_diagram");
  assert.ok(m.length >= 1);
  for (const s of m) assert.match(s, /retir/, s);
  assert.doesNotMatch(docs, /nueve tools|Las nueve|9 tools/i);
  assert.match(docs, /sus 15 tools/);
  assert.match(docs, /Las quince tools, sus schemas/);
  assert.doesNotMatch(docs, /<code>relayout<\/code>/);
});

test("README.md: nombra las 15 tools y no edit_diagram", () => {
  const readme = read("README.md");
  const mcp = readme.slice(readme.indexOf("## Servidor MCP"), readme.indexOf("---", readme.indexOf("## Servidor MCP")));
  for (const t of CONTRACT) assert.ok(mcp.includes("`" + t + "`"), t);
  assert.doesNotMatch(readme, /edit_diagram|nueve tools/);
  assert.match(mcp, /quince tools/);
});

test("sw.js: CACHE v72 y ./docs/ en el precache de páginas (PAGE_ASSETS)", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v75";/);
  const pages = /const PAGE_ASSETS = \[([\s\S]*?)\];/.exec(sw)[1];
  assert.ok(pages.includes('"./docs/"'), "./docs/ debe seguir en el precache de páginas");
  assert.match(sw, /cache\.addAll\(PAGE_ASSETS\)/, "y ese precache se instala");
});
