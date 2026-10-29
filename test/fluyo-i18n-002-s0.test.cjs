"use strict";
/* FLUYO-I18N-002 S0 — Infraestructura de idioma para cinco idiomas (es · en · fr · ja · zh) y los que vengan.
   · runtime: registro de idiomas (código, etiqueta BCP 47, nombre propio, publicado), reserva idioma › inglés › español,
     plurales con las reglas del idioma del TEXTO usado, números con Intl, <html lang> con etiqueta completa (zh-Hans),
     detección del sistema solo entre idiomas publicados (otro → inglés), cambio en vivo con onChange.
   · catálogo: cada diccionario solo trae claves en uso, con los mismos marcadores y las categorías de plural de su idioma; el
     inglés está completo; lo que usan el Viewer y el 404 está en el archivo común y nada del editor se le cuela; ningún idioma
     se publica sin diccionario completo ni con texto de interfaz por migrar; tipografía francesa y puntuación CJK.
   · carga: el editor carga todos los diccionarios; el Viewer y el 404 solo los comunes; todos antes de i18n.js; todo en el
     precache (editor y Viewer); peso con presupuesto.
   · escritura: voces con reserva CJK del sistema antes de la genérica, :lang(ja)/:lang(zh) solo tocan tokens, sin webfonts CJK.
   · en vivo: Viewer y Present repintan lo suyo al cambiar de idioma; el documento no cambia.
   · pseudo-idioma de pruebas: todas las claves, marcadores intactos, +40 %.
   · alcance: solo los archivos de esta tarea; kernel, formato y documento intactos; undoS0 da la base EXACTA y va debajo de
     undoShell. Chrome real: test/fluyo-i18n-002-s0-browser.cjs. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const scan = require("./i18n-scan.cjs");
const { pseudo, pseudoDictionary } = require("./i18n-pseudo.cjs");
const { makeViewer } = require("./viewer-harness.cjs");

const root = path.join(__dirname, "..");
const gitRoot = process.env.FLUYO_GIT_ROOT || root;
const read = scan.read;
const BASE = "bb7881a";
const atBase = (f) => execFileSync("git", ["-C", gitRoot, "show", BASE + ":" + f], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
const DICT_FILES = fs.readdirSync(path.join(root, "js")).map((f) => "js/" + f).filter((f) => scan.DICT.test(f)).sort();
const COMMON = (code) => `js/i18n-${code}.js`, EDITOR = (code) => `js/i18n-${code}-editor.js`;

/* El runtime en un contexto propio, con los diccionarios que se pidan (por defecto, todos). */
function i18n({ search = "", stored = null, languages = [], document, files = DICT_FILES, extra = "" } = {}) {
  const store = new Map(stored === null ? [] : [["fluyo.ui.lang", stored]]);
  const errors = [];
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search }, navigator: { languages }, console: { error: (e) => errors.push(e) },
    localStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) }, document });
  for (const f of files) vm.runInContext(read(f), ctx);
  if (extra) vm.runInContext(extra, ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  ctx.store = store; ctx.errors = errors;
  ctx.I = vm.runInContext("FluyoI18n", ctx);
  return ctx;
}
const LANGS = [...i18n().I.LANGS].map((l) => ({ ...l }));   /* copia local: los arrays del contexto vm son de otro realm */
const CODES = LANGS.map((l) => l.code);
const catalogBase = () => new Map(scan.catalog().uses.map((u) => [u.key, u.es]));

/* ───────────── runtime ───────────── */

test("registro: cinco idiomas con su etiqueta BCP 47 y su nombre propio; publicado solo el español", () => {
  assert.deepEqual(LANGS.map((l) => [l.code, l.tag, l.name]), [
    ["es", "es", "Español"], ["en", "en", "English"], ["fr", "fr", "Français"], ["ja", "ja", "日本語"], ["zh", "zh-Hans", "简体中文"]]);
  assert.deepEqual(LANGS.filter((l) => l.released).map((l) => l.code), ["es"], "ningún idioma a medias se publica");
  const c = i18n();
  assert.deepEqual([...c.I.supported()], ["es", "en", "fr", "ja", "zh"]);
  assert.deepEqual([...c.I.released()], ["es"]);
  assert.deepEqual([...c.I.languages()].map((l) => [l.code, l.available]), CODES.map((x) => [x, true]));
  assert.equal(c.I.BASE, "es"); assert.equal(c.I.FALLBACK, "en");
  assert.deepEqual([...i18n({ files: [] }).I.languages()].map((l) => l.available), [true, false, false, false, false], "sin diccionarios, solo el español");
});

test("reserva: idioma › inglés › español; lo que falta se anota; nunca se pinta una clave", () => {
  const extra = 'FLUYO_LOCALES.fr["only.en"]=undefined; delete FLUYO_LOCALES.fr["only.en"]; FLUYO_LOCALES.en["only.en"]="English only";';
  const fr = i18n({ search: "?lang=fr", extra });
  assert.equal(fr.I.t("present.exit", "Salir"), "Quitter");
  assert.equal(fr.I.t("only.en", "Solo español"), "English only", "falta en francés → inglés");
  assert.equal(fr.I.t("ni.en.ni.fr", "Texto base"), "Texto base", "falta en los dos → español");
  assert.deepEqual([...fr.I.missing()], ["fr:ni.en.ni.fr", "fr:only.en"]);
  const en = i18n({ search: "?lang=en" });
  assert.equal(en.I.t("no.existe", "Texto base"), "Texto base");
  assert.deepEqual([...en.I.missing()], ["en:no.existe"], "en inglés la reserva es directamente el español");
  const es = i18n();
  assert.equal(es.I.t("present.exit", "Salir"), "Salir");
  assert.deepEqual([...es.I.missing()], [], "en español no falta nada: el texto base ES el español");
  assert.equal(i18n({ search: "?lang=ja" }).I.t("story.kicker", "Historia · {name}", { name: "Cliente solicita un préstamo" }), "ストーリー · Cliente solicita un préstamo",
    "el nombre del autor no se traduce");
});

test("plurales: las reglas del idioma del TEXTO usado (japonés sin plurales; francés 0 = singular; reserva inglesa con reglas inglesas)", () => {
  const P = { one: "{count} página", other: "{count} páginas" };
  const extra = 'FLUYO_LOCALES.ja["p.n"]={other:"{count} ページ"}; FLUYO_LOCALES.fr["p.n"]={one:"{count} page", other:"{count} pages"}; FLUYO_LOCALES.en["p.n"]={one:"{count} page", other:"{count} pages"};';
  const ja = i18n({ search: "?lang=ja", extra }), fr = i18n({ search: "?lang=fr", extra }), es = i18n({ extra });
  assert.equal(ja.I.t("p.n", P, { count: 1 }), "1 ページ");
  assert.equal(ja.I.t("p.n", P, { count: 5 }), "5 ページ");
  assert.equal(fr.I.t("p.n", P, { count: 0 }), "0 page", "en francés 0 es singular");
  assert.equal(es.I.t("p.n", P, { count: 0 }), "0 páginas", "en español 0 es plural");
  const zh = i18n({ search: "?lang=zh", extra });   /* zh no lo tiene: cae al inglés y se elige con reglas inglesas */
  assert.equal(zh.I.t("p.n", P, { count: 1 }), "1 page");
  assert.equal(zh.I.t("p.n", P, { count: 2 }), "2 pages");
});

test("etiqueta y formato: <html lang> lleva la etiqueta completa (zh-Hans); los números siguen al idioma", () => {
  const n = 1234.5;
  const fmt = (code) => i18n({ search: "?lang=" + code }).I.num(n);
  assert.equal(fmt("en"), "1,234.5");
  assert.equal(fmt("ja"), "1,234.5");
  assert.equal(fmt("zh"), "1,234.5");
  assert.equal(fmt("fr"), "1 234,5", "francés: espacio fino y coma");
  assert.equal(i18n().I.num(n), new Intl.NumberFormat("es").format(n));
  assert.equal(i18n().I.num(0.3, { maximumFractionDigits: 1 }), "0,3");
  assert.equal(i18n({ search: "?lang=zh" }).I.tag(), "zh-Hans");
  assert.equal(i18n({ search: "?lang=ja" }).I.tag(), "ja");
  assert.equal(i18n().I.tagOf("qps"), "qps", "un diccionario fuera del registro (pseudo-idioma) usa su código");
});

test("idioma de la carga: ?lang › preferencia › sistema (solo publicados; otro → inglés) › español", () => {
  assert.equal(i18n({ search: "?lang=zh-TW" }).I.locale(), "zh", "zh-TW/zh-HK → chino simplificado");
  assert.equal(i18n({ search: "?lang=ja-JP", stored: "fr" }).I.locale(), "ja", "la URL manda en esta carga");
  assert.equal(i18n({ stored: "fr" }).I.locale(), "fr", "la preferencia guardada, aunque el idioma no esté publicado (solo la escribe el selector)");
  assert.equal(i18n({ stored: "de", languages: ["fr-FR"] }).I.locale(), "es", "preferencia desconocida → sistema → solo publicados → español");
  /* Hoy: solo el español publicado. Nadie recibe por detección un idioma a medias. */
  for (const langs of [["en-US"], ["fr-CA", "en"], ["ja-JP"], ["zh-CN"], ["de-DE"], []]) assert.equal(i18n({ languages: langs }).I.locale(), "es", JSON.stringify(langs));
  assert.equal(i18n({ languages: ["es-MX"] }).I.locale(), "es");
  /* Cuando se publiquen: la regla del producto. */
  const withPub = (codes, langs) => { const c = i18n(); for (const l of c.I.LANGS) l.released = l.code === "es" || codes.includes(l.code); return c.I.detect(langs); };
  assert.equal(withPub(["en"], ["de-DE", "it"]), "en", "cualquier otro → inglés");
  assert.equal(withPub(["en"], ["fr-CA", "en-GB"]), "en", "francés sin publicar: el siguiente publicado de la lista");
  assert.equal(withPub(["en", "fr"], ["fr-CA", "en-GB"]), "fr");
  assert.equal(withPub(["en", "fr", "ja", "zh"], ["ja-JP"]), "ja");
  assert.equal(withPub(["en", "fr", "ja", "zh"], ["zh-TW"]), "zh");
  assert.equal(withPub(["en", "fr", "ja", "zh"], ["de", "es-AR"]), "es", "el primero publicado de la lista del sistema, aunque no sea el primero");
  assert.equal(withPub([], ["de"]), null, "sin inglés publicado no hay «otro → inglés»: español (la resolución cae al base)");
  assert.doesNotMatch(read("js/i18n.js"), /AUTO_DETECT/, "la detección ya no es un interruptor: la gobierna LANGS[].released");
});

test("setLocale y onChange: avisa al cambiar (no si es el mismo), la baja funciona, un suscriptor que falla no tumba a los demás", () => {
  const c = i18n();
  const seen = [];
  const off = c.I.onChange((l) => seen.push("a:" + l));
  c.I.onChange(() => { throw new Error("roto"); });
  c.I.onChange((l) => seen.push("b:" + l));
  c.I.setLocale("ja");
  c.I.setLocale("ja");
  off();
  c.I.setLocale("es", { persist: true });
  assert.deepEqual(seen, ["a:ja", "b:ja", "b:es"]);
  assert.equal(c.errors.length, 2, "el error se registra en consola");
  assert.equal(c.store.get("fluyo.ui.lang"), "es");
  assert.equal(c.I.setLocale("xx"), "es", "lo desconocido es español");
});

/* DOM falso mínimo (como test/fluyo-i18n-001.test.cjs). */
function fakeDom() {
  const all = [];
  const text = (data) => ({ nodeType: 3, data });
  const el = (attrs, children = []) => {
    const e = { nodeType: 1, attrs: { ...attrs }, childNodes: children, get children() { return this.childNodes.filter((n) => n.nodeType === 1); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); },
      get textContent() { return this.childNodes.map((n) => n.nodeType === 3 ? n.data : n.textContent).join(""); },
      set textContent(v) { this.childNodes = [text(v)]; } };
    all.push(e); return e;
  };
  const doc = { documentElement: { lang: "es" }, querySelectorAll: (sel) => { const a = sel.slice(1, -1); return all.filter((e) => a in e.attrs); } };
  return { doc, el, text };
}
test("applyDom en vivo por los cinco idiomas y vuelta al español byte a byte; <html lang> con etiqueta completa", () => {
  const { doc, el, text } = fakeDom();
  const play = el({ "data-i18n": "story.playStory" }, [text("▶ Reproducir historia")]);
  const exit = el({ "data-i18n-title": "present.exitLong", title: "Salir de la presentación" }, []);
  /* el resto de «Abrir en Fluyo»: en chino empieza por «（», que NO es un glifo del texto base (defecto encontrado en Chrome) */
  const rest = el({ "data-i18n": "viewer.openRest" }, [text(" en Fluyo")]);
  const c = i18n({ document: doc });
  for (const code of ["zh", "ja", "es", "zh", "es"]) c.I.setLocale(code);
  assert.equal(rest.textContent, " en Fluyo", "ida y vuelta por zh/ja: el marco del texto base se conserva, el «（» de la traducción no se queda");
  c.I.setLocale("zh");
  assert.equal(rest.textContent, " （Fluyo）");
  const want = { es: ["es", "▶ Reproducir historia", "Salir de la presentación"], en: ["en", "▶ Play story", "Exit presentation"], fr: ["fr", "▶ Lire l'histoire", "Quitter la présentation"],
    ja: ["ja", "▶ ストーリーを再生", "プレゼンを終了"], zh: ["zh-Hans", "▶ 播放故事", "退出演示"] };
  for (const code of ["en", "fr", "ja", "zh", "es"]) {
    c.I.setLocale(code);
    assert.deepEqual([doc.documentElement.lang, play.textContent, exit.getAttribute("title")], want[code], code);
  }
});

/* ───────────── catálogo ───────────── */

test("diccionarios: un archivo común y uno del editor por idioma del registro, y ninguno más", () => {
  const expected = CODES.filter((c) => c !== "es").flatMap((c) => [COMMON(c), EDITOR(c)]).sort();
  assert.deepEqual(DICT_FILES, expected);
  for (const f of DICT_FILES) {
    const src = read(f), code = f.match(scan.DICT)[1];
    assert.match(src, new RegExp(`FLUYO_LOCALES\\.${code}=Object\\.assign\\(FLUYO_LOCALES\\.${code} \\|\\| \\{\\}, \\{`), f + ": se suma a lo que ya haya (común + editor, en cualquier orden)");
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /\bFluyoI18n\b|\bdocument\.|\bwindow\.|\bfunction\b|=>/, f + ": solo datos");
  }
});

test("catálogo: cada idioma trae solo claves en uso, sin vacíos, con los mismos marcadores y los plurales de SU idioma; el inglés, completo", () => {
  const base = catalogBase(), dicts = scan.dictionaries();
  for (const code of CODES.filter((c) => c !== "es")) {
    const d = dicts[code], all = { ...d.common, ...d.editor }, tag = LANGS.find((l) => l.code === code).tag;
    const cats = new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
    assert.deepEqual(Object.keys(d.common).filter((k) => k in d.editor), [], code + ": ninguna clave en los dos archivos");
    assert.deepEqual(Object.keys(all).filter((k) => !base.has(k)), [], code + ": claves que nadie usa");
    for (const [k, v] of Object.entries(all)) {
      const es = base.get(k);
      if (typeof es === "string") assert.ok(typeof v === "string" && v.trim(), `${code} ${k}: texto no vacío`);
      else {
        assert.ok(v && typeof v === "object" && typeof v.other === "string", `${code} ${k}: plural con «other»`);
        assert.deepEqual(Object.keys(v).filter((c) => !cats.includes(c)), [], `${code} ${k}: solo categorías de ${tag} (${cats.join(", ")})`);
      }
      assert.deepEqual(scan.placeholders(v), scan.placeholders(es), `${code} ${k}: mismos marcadores {param}`);
    }
  }
  const en = { ...dicts.en.common, ...dicts.en.editor };
  assert.deepEqual([...base.keys()].filter((k) => !(k in en)), [], "el inglés (primer idioma tras el español) está completo");
});

test("común / editor: lo que usan el Viewer y el 404 está en el archivo común; el común no trae nada que el Viewer y el 404 no usen", () => {
  const viewerHtml = read("s/index.html");
  const viewerJs = [...viewerHtml.matchAll(/<script src="\.\.\/(js\/[^"]+)"/g)].map((m) => m[1]);
  const uses = scan.catalog().uses;
  const shared = new Set(uses.filter((u) => u.file === "s/index.html" || u.file === "404.html" || viewerJs.includes(u.file)).map((u) => u.key));
  const dicts = scan.dictionaries();
  for (const code of CODES.filter((c) => c !== "es")) {
    assert.deepEqual(Object.keys(dicts[code].editor).filter((k) => shared.has(k)), [], code + ": nada del Viewer en el archivo del editor");
    assert.deepEqual(Object.keys(dicts[code].common).filter((k) => !shared.has(k)), [], code + ": el común no trae texto solo del editor");
  }
  assert.deepEqual(Object.keys(dicts.en.common).sort(), [...shared].sort(), "el inglés común cubre exactamente el Viewer y el 404");
});

/* Por qué un idioma no se puede publicar todavía (vacío = publicable). */
function releaseProblems(code) {
  const base = catalogBase(), d = scan.dictionaries()[code] || { common: {}, editor: {} }, all = { ...d.common, ...d.editor };
  const problems = [...base.keys()].filter((k) => !(k in all)).map((k) => "sin traducir: " + k);
  const h = scan.hardcoded();
  const pending = Object.values(h.js).reduce((a, b) => a + b, 0) + Object.values(h.html).reduce((a, b) => a + b, 0);
  if (pending) problems.push(`${pending} textos de interfaz sin migrar (test/i18n-scan.cjs)`);
  return problems;
}
test("puerta de publicación: un idioma solo se publica con el diccionario completo y la interfaz sin texto por migrar", () => {
  for (const l of LANGS.filter((x) => x.released && x.code !== "es")) assert.deepEqual(releaseProblems(l.code), [], l.code + " está publicado");
  assert.ok(releaseProblems("en").length > 0, "hoy el inglés NO es publicable: queda interfaz por migrar (S1–S3)");
  assert.ok(releaseProblems("en").every((p) => !p.startsWith("sin traducir")), "lo que ya está migrado, el inglés lo tiene entero");
});

test("tipografía de cada idioma: francés con espacios insecables; japonés y chino con puntuación de ancho completo", () => {
  const dicts = scan.dictionaries();
  for (const [k, v] of Object.entries({ ...dicts.fr.common, ...dicts.fr.editor })) {
    for (const s of typeof v === "string" ? [v] : Object.values(v)) {
      assert.doesNotMatch(s, / [:;!?»]/, `fr ${k}: «${s}» espacio normal antes de : ; ! ? »`);
      assert.doesNotMatch(s, /« /, `fr ${k}: espacio normal tras «`);
      assert.doesNotMatch(s, /[^\s  (][;!?]/, `fr ${k}: falta el espacio fino antes de ; ! ?`);
    }
  }
  for (const code of ["ja", "zh"]) {
    for (const [k, v] of Object.entries({ ...dicts[code].common, ...dicts[code].editor })) {
      for (const s of typeof v === "string" ? [v] : Object.values(v)) {
        assert.doesNotMatch(s, /[぀-ヿ㐀-鿿][,:;!?]/, `${code} ${k}: puntuación ASCII tras un carácter CJK («${s}»)`);
        assert.doesNotMatch(s, /[぀-ヿ㐀-鿿]\.(\s|$)/, `${code} ${k}: punto ASCII tras CJK («${s}»)`);
      }
    }
  }
});

/* ───────────── carga, offline y peso ───────────── */

test("carga: el editor, todos los diccionarios; el Viewer y el 404, solo los comunes; todos antes de i18n.js, y i18n.js antes que quien pinta", () => {
  const others = CODES.filter((c) => c !== "es");
  const pages = [["index.html", "js/", others.flatMap((c) => [COMMON(c), EDITOR(c)])], ["s/index.html", "../js/", others.map(COMMON)], ["404.html", "/js/", others.map(COMMON)]];
  for (const [page, pre, files] of pages) {
    const h = read(page);
    const scripts = [...h.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    const at = scripts.indexOf(pre + "i18n.js");
    assert.ok(at > 0, page + ": carga i18n.js");
    const dicts = scripts.filter((s) => /\/i18n-[a-z]+(-editor)?\.js$/.test(s));
    assert.deepEqual(dicts, files.map((f) => pre + f.slice(3)), page + ": los diccionarios que le tocan, en orden");
    assert.deepEqual(scripts.slice(at - dicts.length, at), dicts, page + ": los diccionarios, justo antes de i18n.js");
    if (page !== "404.html") assert.ok(at < scripts.indexOf(pre + "config.js"), page + ": i18n.js antes que config.js");
    assert.ok(h.includes('css/system.css"'), page + ": carga system.css (escritura por idioma)");
  }
});

test("offline: todo diccionario en el precache del editor; los comunes, en el del Viewer; CACHE v109", () => {
  const sw = read("sw.js");
  const list = (name) => [...sw.match(new RegExp("const " + name + " = \\[([\\s\\S]*?)\\];"))[1].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]);
  const A = list("ASSETS"), V = list("VIEWER_ASSETS");
  for (const f of DICT_FILES) assert.ok(A.includes(f), "ASSETS: " + f);
  assert.deepEqual(V.filter((f) => scan.DICT.test(f)), CODES.filter((c) => c !== "es").map(COMMON), "VIEWER_ASSETS: solo los comunes");
  assert.match(sw, /const CACHE = "fluyo-static-v119";/);
});

test("peso: presupuesto de diccionarios (Viewer ≤ 64 KB, editor ≤ 400 KB, sin comprimir); medido aquí, no lazy loading", () => {
  const size = (f) => Buffer.byteLength(read(f));
  const others = CODES.filter((c) => c !== "es");
  const viewer = others.map(COMMON).reduce((a, f) => a + size(f), 0) + size("js/i18n.js");
  const editor = DICT_FILES.reduce((a, f) => a + size(f), 0) + size("js/i18n.js");
  assert.ok(viewer <= 64 * 1024, `Viewer: ${viewer} B`);
  assert.ok(editor <= 400 * 1024, `editor: ${editor} B`);
});

/* ───────────── escritura (CSS) ───────────── */

test("escritura: la sans CJK del sistema antes que la genérica; :lang(ja) y :lang(zh) solo tocan tokens; sin webfonts CJK", () => {
  const css = read("css/system.css");
  const tok = (name, src = css) => (src.match(new RegExp("--" + name + ":([^;]+);")) || [])[1];
  assert.ok(tok("font-cjk"), "--font-cjk");
  assert.match(tok("font-mono"), /^"IBM Plex Mono",.*var\(--font-cjk\),monospace$/, "mono: Plex › mono del sistema › CJK › genérica");
  assert.match(tok("font-serif"), /^"Playfair Display",.*var\(--font-cjk\),serif$/, "serif: Playfair › serifas › CJK › genérica");
  const ja = css.match(/:root:lang\(ja\)\{([^}]*)\}/)[1], zh = css.match(/:root:lang\(zh\)\{([^}]*)\}/)[1];
  assert.match(tok("font-cjk", ja), /^"Hiragino Sans".*"Yu Gothic UI".*Meiryo.*"Noto Sans CJK JP"/);
  assert.match(tok("font-cjk", zh), /^"PingFang SC".*"Microsoft YaHei UI".*"Noto Sans CJK SC"/);
  const both = css.match(/:root:lang\(ja\), :root:lang\(zh\)\{([^}]*)\}/)[1];
  assert.deepEqual([...both.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort(), ["--case-kicker", "--fs-field", "--fs-label", "--fs-micro", "--track-micro"], "solo tokens");
  assert.match(css, /:root:lang\(ja\) \*, :root:lang\(zh\) \*\{ text-transform:none !important; \}/, "sin mayúsculas artificiales");
  const faces = [...css.matchAll(/@font-face\{[\s\S]*?\}/g)].map((m) => m[0]);
  /* FLUYO-I18N-002 S4 añade dos caras con local() (sin descarga) para la puntuación CJK: las que se descargan siguen siendo las tres de siempre */
  const served = faces.filter((f) => /src:url\(/.test(f));
  assert.equal(served.length, 3, "las tres de siempre");
  assert.ok(served.every((f) => /unicode-range:U\+0000-00FF/.test(f)), "solo latín");
  assert.ok(faces.filter((f) => !/src:url\(/.test(f)).every((f) => /src:local\(/.test(f) && !/url\(/.test(f)), "las demás, solo local()");
  assert.doesNotMatch(read("sw.js"), /noto|cjk|hiragino|yahei/i, "ninguna fuente CJK en el precache");
});

/* ───────────── en vivo ───────────── */

const PAGO = `
  const pg=P(); pg.nodes=[N(1,200,"Cliente"),N(2,600,"Comercio")]; pg.edges=[{id:3,from:1,to:2,label:""}]; pg.nextId=4;
  const sc=createScenario(pg,"Cliente solicita un préstamo");
  const pago=createEventType({name:"Pago",primitive:"FLOW",sentenceTemplate:"{source} paga a {target}",visual:{value:"💵"}});
  createStep(sc,{at:0,action:"SEND",edgeId:3,eventTypeId:pago.id});
  createStep(sc,{at:2000,action:"SEND",edgeId:3,eventTypeId:pago.id});`;
async function shared(search) {
  const b = makeViewer();
  const project = JSON.parse(JSON.stringify(b.run(`(function(){
    doc={theme:"dark",customBg:"",eventTypes:[],nextEventTypeId:1,pages:[blankPage("Página 1")],cur:0};
    const N=(id,x,label)=>({id,shape:"rect",x,y:240,w:170,h:76,label,color:"#3aa7e8"});
    ${PAGO}
    return serializeProject();
  })()`)));
  b.run(read("js/share-url.js")); b.context.project = project; b.context.location.href = "https://fluyo.space/";
  const hash = new URL(await b.run('createShareUrl(project,"https://fluyo.space/",{story:true})')).hash;
  const v = makeViewer({ search, hash });
  await v.boot(); await v.waitForPhase((p) => p === "ready" || p === "error");
  return v;
}
test("Viewer en vivo: banda, pestañas y aviso cambian de idioma sin recargar; el contenido del autor y el documento, intactos", async () => {
  const v = await shared("");
  const docBefore = JSON.stringify(v.run("serializeProject()"));
  v.run("doc.pages[0].name=''; buildTabs();");
  const band = () => [v.el("stKicker").textContent, v.el("stPlay").textContent, v.el("stTitle").textContent];
  assert.deepEqual(band(), ["Historia", "▶ Reproducir historia", "Cliente solicita un préstamo"]);
  v.run('FluyoI18n.setLocale("ja")');
  assert.deepEqual(band(), ["ストーリー", "▶ ストーリーを再生", "Cliente solicita un préstamo"], "japonés: la interfaz cambia, el título del autor no");
  assert.equal([...v.el("pgTabs").children].slice(-1)[0].textContent, "ページ 1", "pestaña sin nombre, en japonés");
  v.el("stPlay").onclick(); v.frames(2);
  assert.equal(v.el("stKicker").textContent, "ストーリー · Cliente solicita un préstamo");
  v.run('FluyoI18n.setLocale("zh")');
  assert.equal(v.el("stKicker").textContent, "故事 · Cliente solicita un préstamo");
  assert.equal(v.el("stStop").textContent, "■ 停止");
  v.run('FluyoI18n.setLocale("es")');
  assert.equal(v.el("stKicker").textContent, "Historia · Cliente solicita un préstamo");
  assert.equal(v.el("stStop").textContent, "■ Detener");
  v.run("doc.pages[0].name='Página 1';");
  assert.equal(JSON.stringify(v.run("serializeProject()")), docBefore, "el documento no cambia");
  /* FLUYO-STORIES-2.0 S2a: la portada enseña el desenlace (S1b) antes de reproducir; sus claves son es + en y fr/ja/zh caen al
     inglés, como decidió S1b. Cualquier otra clave que falte sigue siendo un fallo. */
  assert.deepEqual([...v.run("FluyoI18n.missing()")].filter((k) => !/^(fr|ja|zh):story\.(outcome\.(ok|failed)|others)$/.test(k)), []);
  const bad = makeViewer({ search: "?s=otra" });
  await bad.boot();
  assert.equal(bad.el("status").textContent, "El enlace del diagrama no es válido.");
  bad.run('FluyoI18n.setLocale("fr")');
  assert.equal(bad.el("status").textContent, "Le lien du diagramme n'est pas valide.", "el aviso de error también");
});

test("Present del editor en vivo: el mando y el encabezado repintan al cambiar de idioma (onChange de present-story.js)", () => {
  const els = {};
  const $ = (id) => (els[id] ||= { id, hidden: false, disabled: false, className: "", textContent: "", title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  const ctx = vm.createContext({ URLSearchParams, Intl, location: { search: "" }, $, document: {}, presenting: true, console,
    scActiveScenario: () => ({ name: "Pago", steps: [{}] }), scStatus: "running", scIsPaused: () => true, scErrors: [], scPlayback: null, scNodeFallback: () => "",
    edgeById: () => null, doc: { pages: [{}, {}] }, FluyoPresentStory: { MAX_DOTS: 12 },
    FluyoStory: { describe: () => ({ title: "Pago", moments: [{ label: "a" }], idx: 0, caption: "Cliente paga", summary: "" }) } });
  for (const f of DICT_FILES) vm.runInContext(read(f), ctx);
  vm.runInContext(read("js/i18n.js"), ctx);
  vm.runInContext(read("js/present-story.js"), ctx);
  vm.runInContext("presentStoryRefresh()", ctx);
  assert.equal(els.psStop.textContent, "■ Detener");
  assert.equal(els.psCaption.textContent, "En pausa · Cliente paga");
  vm.runInContext('FluyoI18n.setLocale("en")', ctx);
  assert.equal(els.psStop.textContent, "■ Stop", "el glifo cacheado (psLast) se repinta");
  assert.equal(els.psCaption.textContent, "Paused · Cliente paga");
  vm.runInContext('FluyoI18n.setLocale("ja")', ctx);
  assert.equal(els.psCaption.textContent, "一時停止中 · Cliente paga");
});

/* ───────────── pseudo-idioma ───────────── */

test("pseudo-idioma de pruebas: todas las claves, marcadores intactos, +40 % y entre ⟦ ⟧; nunca se publica", () => {
  const p = pseudoDictionary(), base = catalogBase();
  assert.deepEqual(Object.keys(p).sort(), [...base.keys()].sort());
  for (const [k, v] of Object.entries(p)) assert.deepEqual(scan.placeholders(v), scan.placeholders(base.get(k)), k);
  const s = pseudo("Historia · {name}");
  assert.match(s, /^⟦Ĥîšţöŕîã · \{name\}~+⟧$/);
  assert.ok(pseudo("Reproducir").length >= Math.ceil("Reproducir".length * 1.4));
  const c = i18n({ search: "?lang=qps", extra: "FLUYO_LOCALES.qps=" + JSON.stringify(p) + ";" });
  assert.equal(c.I.locale(), "qps", "?lang acepta cualquier diccionario cargado");
  assert.deepEqual([...c.I.released()], ["es"], "pero no lo publica ni lo detecta");
  for (const f of ["index.html", "s/index.html", "404.html", "sw.js"]) assert.doesNotMatch(read(f), /qps|i18n-pseudo/, f);
});

/* ───────────── alcance ───────────── */

test("alcance frente a " + BASE + ": solo los archivos de esta tarea; undoS0 da la base EXACTA y va debajo de undoShell; kernel y documento intactos", () => {
  try { atBase("sw.js"); } catch { return; }   // sin git
  const { undoS0, PIECES, NEW_FILES, BASE_S0 } = require("./fluyo-i18n-002-s0-undo.cjs");
  assert.equal(BASE_S0, BASE);
  const FILES = ["404.html", "css/system.css", "index.html", "js/i18n-en.js", "js/i18n.js", "js/present-story.js", "js/viewer.js", "s/index.html", "sw.js"];
  assert.deepEqual(Object.keys(PIECES).sort(), FILES);
  assert.deepEqual(NEW_FILES, ["js/i18n-en-editor.js", "js/i18n-fr.js", "js/i18n-fr-editor.js", "js/i18n-ja.js", "js/i18n-ja-editor.js", "js/i18n-zh.js", "js/i18n-zh-editor.js"]);
  const SERVED = ["js", "s", "css", "assets", "index.html", "404.html", "sw.js", "manifest.webmanifest", "docs", "ejemplos", "privacidad", "privacy", "soporte", "support", "terminos", "terms"];
  /* S1 va encima: lo que solo cambia S1 (sin S1, igual que la base) no cuenta para el alcance de S0 */
  const { undoS1, PIECES: PIECES_S1, NEW_FILES: NEW_S1 } = require("./fluyo-i18n-002-s1-undo.cjs");
  /* FLUYO-I18N-002 S2a, encima de S1: undoS1 la deshace antes; lo que solo cambia S2a tampoco cuenta */
  const { PIECES: PIECES_S2A } = require("./fluyo-i18n-002-s2a-undo.cjs");
  const { PIECES: PIECES_S4 } = require("./fluyo-i18n-002-s4-undo.cjs");   /* FLUYO-I18N-002 S4, encima de S2a */
  const { PIECES: PIECES_S2B } = require("./fluyo-i18n-002-s2b-undo.cjs");   /* FLUYO-I18N-002 S2b, encima de S4 */
  const { PIECES: PIECES_S3A } = require("./fluyo-i18n-002-s3a-undo.cjs");   /* FLUYO-I18N-002 S3a, encima de S2b */
  const { undoEx, PIECES: PIECES_EX, NEW_FILES: NEW_EX } = require("./fluyo-examples-001-undo.cjs");   /* FLUYO-EXAMPLES-001 va encima de S3b (undoS3b la deshace antes) */
  const { PIECES: PIECES_S1A } = require("./fluyo-stories-2-0-s1a-undo.cjs");   /* FLUYO-STORIES-2.0 S1a va encima de EXAMPLES (undoEx la deshace antes) */
  const { PIECES: PIECES_S1B } = require("./fluyo-stories-2-0-s1b-undo.cjs");   /* FLUYO-STORIES-2.0 S1b va encima de S1a (undoS1a la deshace antes) */
  const { PIECES: PIECES_ST2A } = require("./fluyo-stories-2-0-s2a-undo.cjs");   /* FLUYO-STORIES-2.0 S2a va encima de S1b (undoS1b la deshace antes) */
  const s1Only = (f) => NEW_S1.includes(f) || NEW_EX.includes(f) || ((!!PIECES_S1[f] || !!PIECES_S2A[f] || !!PIECES_S4[f] || !!PIECES_S2B[f] || !!PIECES_S3A[f] || !!PIECES_EX[f] || !!PIECES_S1A[f] || !!PIECES_S1B[f] || !!PIECES_ST2A[f]) && !FILES.includes(f) && !NEW_FILES.includes(f) && undoS1(f, read(f)) === atBase(f));
  const changed = execFileSync("git", ["-C", gitRoot, "diff", "--name-only", BASE, "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !s1Only(f));
  const untracked = execFileSync("git", ["-C", gitRoot, "ls-files", "--others", "--exclude-standard", "--", ...SERVED], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !s1Only(f));
  assert.deepEqual([...new Set([...changed, ...untracked])].sort(), [...FILES, ...NEW_FILES].sort());
  for (const f of FILES) {
    let out = undoS0(f, read(f));
    if (f === "sw.js") out = out.replace('"fluyo-static-v119"', '"fluyo-static-v' + (109 - 1) + '"');
    assert.equal(out, atBase(f), f + ": undoS0 exacto");
  }
  assert.ok(read("test/fluyo-shell-001-undo.cjs").includes("src = undoS0(file, src);"), "undoShell deshace antes esta tarea");
  /* el kernel del MCP y el modelo del documento: ni un byte; nadie del kernel habla con FluyoI18n */
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js",
    "js/story-authoring.js", "js/story-clock.js", "js/flow-semantics.js", "js/render.js", "js/export.js", "js/state.js", "js/deeplink.js", "js/share-url.js", "js/link-codec.js", "js/share-loader.js"]) {
    assert.equal(undoS0(f, read(f)), atBase(f), f + " sin cambios (S1, encima, se deshace antes)");
  }
  const src = read("js/i18n.js");
  assert.doesNotMatch(src, /\bdoc\b|settings|projectToSerializable|scheduleAutosave|pushUndo/, "el runtime no lee ni escribe el documento");
  assert.doesNotMatch(read("js/viewer.js").slice(read("js/viewer.js").indexOf("FluyoI18n.onChange")), /pushUndo|scheduleAutosave|doc\.pages\[[^\]]*\]\.\w+=/, "el repintado no toca el documento");
});
