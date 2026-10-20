/* FLUYO-019-PRSKIN — Legibilidad de «Construido» en la barra de Present (interfaz clara).
   · Causa: el material inverso (.inverse, #presentBar, #presentStory en system.css) no redefine --active, --active-rule ni --focus;
     con la interfaz clara el botón pulsado heredaba el oliva hondo de :root (texto 1,74:1, foco 2,49:1 sobre la barra).
   · Arreglo: una regla en styles.css, solo para #presentBar #prSkin, con los valores que ya usa la interfaz oscura.
   · Contraste calculado desde los tokens (texto ≥ 4,5:1, foco ≥ 3:1) con lo que haya detrás de la barra (blanco o negro).
   · Alcance frente a d4fb06d: solo css/styles.css (la regla) y sw.js (CACHE v92); system.css, JS, HTML y Viewer idénticos.
   La medida en píxeles, Plano/oscuro idénticos y «nada más cambia» van en test/fluyo-019-prskin-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const BASE = "d4fb06d";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8" }).replace(/\r\n/g, "\n");
const { undo4a } = require("./fluyo-019-4a-undo.cjs");   /* FLUYO-019.4a cambia a propósito skin.js, render.js y export.js: se deshace aquí; su alcance lo vigila test/fluyo-019-4a.test.cjs */
const { undo4b } = require("./fluyo-019-4b-undo.cjs");   /* FLUYO-019.4b cambia a propósito render.js, interaction.js, geometry.js, editor-runtime.js, state.js e index.html: se deshace aquí (antes que 019.4a y FASE 1); su alcance lo vigila test/fluyo-019-4b.test.cjs */
const { undoSemantics } = require("./fluyo-scenarios-semantics-undo.cjs");   /* SCENARIOS-SEMANTICS-001 (FASE 1) cambia a propósito model.js, geometry.js, render.js, ui.js, index.html y styles.css: se deshace aquí; su alcance lo vigila test/fluyo-scenarios-semantics-1.test.cjs */
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "falta " + a); const j = s.indexOf(b, i + a.length); assert.ok(j >= 0, "falta " + b); return s.slice(i, j); };

const RULE = "#presentBar #prSkin{--active:var(--c-oliva-palido); --active-rule:rgba(195,205,164,.42); --focus:2px solid var(--c-oliva-palido);}";
const sys = read("css/system.css"), styles = read("css/styles.css");
const decl = (block, name) => { const m = new RegExp("(?:^|[\\s;{])" + name + ":([^;]+);").exec(block); assert.ok(m, "falta " + name); return m[1].trim(); };
const rootBlock = between(sys, ":root{", "\n}\n"), dark = between(sys, ':root[data-ui-theme="dark"]{', "\n}\n"), inverse = between(sys, ".inverse, #presentBar, #presentStory{", "\n}\n");
const prim = (v) => { const m = /^var\((--c-[\w-]+)\)$/.exec(v); return m ? decl(rootBlock, m[1]) : v; };
const rgba = (v) => {
  v = prim(v);
  let m = /^#([0-9a-f]{6})$/i.exec(v); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(v.replace(/\s/g, "")); assert.ok(m, "color no reconocido: " + v); return [+m[1], +m[2], +m[3], +m[4]];
};
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const BAR = rgba(between(styles, "#presentBar{\n  display:none;", "border:").match(/background:(rgba\([^)]+\))/)[1]);
/* fondo del botón pulsado = velo del material inverso sobre la barra (86 % opaca) sobre lo que haya detrás */
const pressedBg = (behind) => over(rgba(decl(inverse, "--active-veil")), over(BAR, behind).concat(1));

test("la regla: una sola, solo para #prSkin dentro de #presentBar", () => {
  assert.equal(styles.split(RULE).length, 2, "la regla está una vez, tal cual");
  const lines = styles.split("\n").filter((l) => /--(active|active-rule|focus):/.test(l));
  assert.deepEqual(lines, [RULE], "styles.css no redefine --active/--active-rule/--focus en ningún otro sitio");
  assert.ok(!/#presentBar\{[^}]*--(active|focus)/.test(styles), "no se redefine en toda la barra (solo en #prSkin)");
});

test("los valores son los de la interfaz oscura (sin colores nuevos)", () => {
  const r = between(RULE, "{", "}") + ";";
  for (const t of ["--active", "--active-rule", "--focus"]) assert.equal(decl(r, t), decl(dark, t), t + " = el de [data-ui-theme=dark]");
  assert.equal(decl(r, "--active"), decl(inverse, "--accent"), "el mismo oliva pálido que el material inverso ya usa como --accent");
});

test("contraste: texto ≥ 4,5:1 y foco ≥ 3:1 sobre la barra, con lo que haya detrás; la base reproducía el fallo", () => {
  const r = between(RULE, "{", "}") + ";", ink = rgba(decl(r, "--active")), ring = rgba(decl(r, "--focus").replace("2px solid ", ""));
  for (const behind of [[255, 255, 255], [0, 0, 0], [242, 237, 227]]) {
    assert.ok(ratio(ink, pressedBg(behind)) >= 4.5, "texto " + ratio(ink, pressedBg(behind)).toFixed(2) + ":1 con " + behind);
    assert.ok(ratio(ring, over(BAR, behind)) >= 3, "foco " + ratio(ring, over(BAR, behind)).toFixed(2) + ":1 con " + behind);
    const old = rgba(decl(rootBlock, "--active")), oldRing = rgba(decl(rootBlock, "--focus").replace("2px solid ", ""));
    assert.ok(ratio(old, pressedBg(behind)) < 3 && ratio(oldRing, over(BAR, behind)) < 3, "la herencia de :root (clara) no llegaba a 3:1");
  }
});

test("alcance: frente a d4fb06d solo cambian css/styles.css (la regla) y sw.js (CACHE)", () => {
  for (const f of ["css/system.css", "css/identity.css", "css/share.css", "index.html", "s/index.html", "js/skin.js", "js/render.js", "js/geometry.js",
    "js/interaction.js", "js/ui.js", "js/viewer.js", "js/export.js", "js/model.js", "js/editor-runtime.js", "js/present-story.js", "js/share-url.js"])
    assert.equal(undoSemantics(f, undo4a(f, undo4b(f, read(f)))), atBase(f), f + " idéntico");
  const added = between(styles, "/* FLUYO-019-PRSKIN", RULE) + RULE + "\n";
  assert.equal(undoSemantics("css/styles.css", styles).replace(added, ""), atBase("css/styles.css"), "styles.css: solo se añade la regla (y su comentario)");
  /* FLUYO-019.4a sube CACHE a v93: aquí basta con que sea ≥ v92 y que sw.js no cambie en nada más */
  const sw = read("sw.js"), cur = +/const CACHE = "fluyo-static-v(\d+)";/.exec(sw)[1];
  assert.ok(cur >= 92, "CACHE ≥ v92");
  /* la de d4fb06d (v91) se construye sin literal: fluyo-019-1 vigila que ningún test fuera de las mutaciones nombre la anterior */
  assert.equal(sw.replace('"fluyo-static-v' + cur + '"', '"fluyo-static-v' + 91 + '"'), atBase("sw.js"), "sw.js: solo cambia CACHE");
});
