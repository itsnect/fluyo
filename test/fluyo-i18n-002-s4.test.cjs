"use strict";
/* FLUYO-I18N-002 S4 — Japonés y chino en el lienzo, la exportación y el CSS (sin kernel, sin web-fonts CJK).
   Lo que se prueba aquí (Node, sin navegador; el navegador real lo cubre fluyo-i18n-002-s4-browser.cjs):
   · corte del globo de mensaje: sin pérdida, ninguna línea pasa del ancho, kinsoku, pares sustitutos, con y sin Intl.Segmenter, y el
     texto sin CJK sale exactamente igual que con el algoritmo de siempre;
   · reserva tipográfica CJK del lienzo y de la exportación: solo con texto CJK, antes de la primera genérica, y los mismos valores que
     los tokens de css/system.css;
   · el CSS nuevo solo cuelga de :lang(ja) / :lang(zh) (o son tokens y caras local()): español, inglés y francés no cambian;
   · el SVG exportado con la reserva sigue pasando el sanitizador de imágenes;
   · alcance: ningún archivo del kernel ni ninguna fuente nueva, y undoS4 devuelve cada archivo a su estado anterior. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const lf = (s) => s.replace(/\r\n/g, "\n");

/* ───────────── contexto: render.js con sus dependencias puras ───────────── */
function makeCtx({ uiLang = "", segmenter = true } = {}) {
  const documentStub = { documentElement: { lang: uiLang } };
  const sandbox = {
    console, Math, Number, Array, Object, Set, Map, JSON, Error, TypeError, RangeError, RegExp, Date, String, Boolean, Symbol,
    parseInt, isNaN, isFinite, Infinity, NaN, URL, window: {}, performance: { now: () => 0 }, document: documentStub,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    run(code) { return vm.runInContext(code, ctx); },
  };
  const ctx = vm.createContext(sandbox);
  for (const f of ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js"]) vm.runInContext(read(f), ctx);
  vm.runInContext(read("js/render.js"), ctx);
  if (!segmenter) vm.runInContext("Intl = Object.assign({}, Intl); Intl.Segmenter = undefined;", ctx);
  ctx.setUi = (tag) => { documentStub.documentElement.lang = tag; };
  return ctx;
}
const json = (o) => JSON.parse(JSON.stringify(o));
/* ancho de prueba: 1 em (14) por carácter CJK o de ancho completo, 7 por el resto */
const WIDE = /[⺀-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]|[\u{20000}-\u{3FFFF}]/u;
const width = (t) => [...t].reduce((a, ch) => a + (WIDE.test(ch) ? 14 : 7), 0);
const stripWs = (s) => s.replace(/\s+/g, "");

/* ───────────── corpus (público, artificial) ───────────── */
const CORPUS = {
  JA_NOSPACE_20: "注文を受け付けて支払いを確認しました",
  JA_NOSPACE_120: "注文を受け付けて支払いを確認し、その後に倉庫チームへ通知して出荷準備を開始します。在庫が不足している場合は担当者へ連絡します。ご不明な点がございましたらサポートまでお問い合わせください。",
  ZH_NOSPACE_60: "订单已接受并确认付款，随后通知仓库团队开始备货。如果库存不足，请联系负责人处理，并更新订单状态。",
  MIX_UNITS: "注文ID 12345 を受付→Kafka経由で在庫サービス(v2.1)へ送信、応答は約250ms。",
  KINSOKU: "「在庫確認」の結果、（約250ms）かかりました。これで完了です。",
  QUOTES_ELLIPSIS: "「引用」“引用”……——確認します。",
  SURROGATES: "𠮷野家で📦を受け取る𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷𠮷",
  LATIN_URL: "https://example.com/very/long/path/without/spaces/ を確認してください。",
};
const NO_START = [..."、。，．・：；！？）〕］｝〉》」』】’”ーぁぃぅぇぉっゃゅょァィゥェォッャュョ"];
const NO_END = [..."（〔［｛〈《「『【‘“"];
const first = (s) => [...s][0], last = (s) => [...s].at(-1);

for (const [seg, label] of [[true, "con Intl.Segmenter"], [false, "sin Intl.Segmenter (reserva por carácter)"]]) {
  test(`globo ${label}: sin pérdida, ninguna línea pasa del ancho, kinsoku y pares sustitutos`, () => {
    const ctx = makeCtx({ segmenter: seg });
    ctx.measure = (t) => width(t);
    for (const limit of [112, 154, 226]) for (const [id, msg] of Object.entries(CORPUS)) {
      ctx.msg = msg; ctx.limit = limit;
      const lines = json(ctx.run("wrapCueMessage(msg, limit, measure)"));
      const where = `${id} @${limit}`;
      assert.equal(lines.join("").replace(/\s+/g, ""), stripWs(msg), where + ": sin pérdida ni reordenación");
      assert.ok(lines.length >= 1 && lines.every((l) => l.length > 0 && l === l.trim()), where + ": líneas no vacías y sin espacios de borde");
      for (const l of lines) {
        /* solo una palabra latina indivisible sola en su línea puede pasar del ancho (como en latín) */
        if (width(l) > limit) assert.ok(!/[^\x00-\x7F]/.test(l) || /^[\x21-\x7E]+$/.test(l), `${where}: «${l}» pasa de ${limit}`);
      }
      for (let i = 1; i < lines.length; i++) {
        if ([...lines[i - 1]].length > 1) {
          assert.ok(!NO_START.includes(first(lines[i])) || [...lines[i]].every((ch) => NO_START.includes(ch)), `${where}: línea ${i + 1} empieza por un signo de cierre «${first(lines[i])}»`);
          assert.ok(!NO_END.includes(last(lines[i - 1])), `${where}: línea ${i} termina en un signo de apertura «${last(lines[i - 1])}»`);
        }
      }
      for (const l of lines) assert.ok(!/[\uD800-\uDBFF]$/.test(l) && !/^[\uDC00-\uDFFF]/.test(l), where + ": ningún par sustituto partido");
    }
  });
}

test("globo: un mensaje CJK largo parte en varias líneas y uno corto cabe en una", () => {
  const ctx = makeCtx();
  ctx.measure = (t) => width(t);
  ctx.a = CORPUS.JA_NOSPACE_120; ctx.b = "確認";
  assert.ok(json(ctx.run("wrapCueMessage(a, 226, measure)")).length >= 5);
  assert.deepEqual(json(ctx.run("wrapCueMessage(b, 226, measure)")), ["確認"]);
  assert.deepEqual(json(ctx.run('wrapCueMessage("", 226, measure)')), []);
});

test("globo: el texto SIN CJK sale exactamente igual que con el algoritmo de siempre (palabras, espacios, palabra más ancha que la caja)", () => {
  const ctx = makeCtx();
  const reference = (message, limit) => {   /* el bucle de computeNodeCueLayout antes de S4, copiado tal cual */
    const lines = []; let line = "";
    for (const w of String(message).split(/\s+/).filter(Boolean)) {
      const t = line ? line + " " + w : w;
      if (width(t) > limit && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };
  ctx.measure = (t) => width(t);
  const msgs = ["Pago recibido", "Order accepted and payment captured, then notify the warehouse team", "  espacios   múltiples\ty\ntabs  ",
    "Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious_x", "Привет мир, это очень длинное сообщение", "café — «comillas» ¿qué? ¡hola!", "1 2 3 4 5 6 7 8 9 10 11 12 13", ""];
  for (const m of msgs) for (const limit of [60, 112, 154, 226]) {
    ctx.m = m; ctx.limit = limit;
    assert.deepEqual(json(ctx.run("wrapCueMessage(m, limit, measure)")), reference(m, limit), JSON.stringify(m) + " @" + limit);
  }
});

test("cue: computeNodeCueLayout usa wrapCueMessage y no se sale de la caja con texto CJK", () => {
  const ctx = makeCtx();
  ctx.measure = (t, font) => width(t);
  for (const position of ["above", "center", "below"]) {
    ctx.fx = { ...json(ctx.run("defaultNodeEffects()")), message: CORPUS.JA_NOSPACE_120, messagePosition: position, showSymbol: false };
    ctx.node = { x: 400, y: 300, w: 180, h: 70 };
    const L = json(ctx.run("computeNodeCueLayout(node, fx, null, measure)")).message;
    const maxW = position === "center" ? Math.max(96, 180 - 10) : Math.min(260, Math.max(140, 180 + 60));
    assert.ok(L.lines.length > 1, position);
    assert.ok(L.lines.every((l) => width(l) <= maxW - 14) && L.w <= maxW, position + ": caja y líneas dentro del máximo");
    assert.match(L.font, /Hiragino Sans.*Yu Gothic UI/, "la fuente del globo lleva la reserva japonesa");
  }
});

/* ───────────── reserva tipográfica ───────────── */
test("escritura del texto: kana → ja; solo han → idioma de la interfaz si es ja/zh; si no, neutra; sin CJK → null", () => {
  const c = makeCtx();
  const script = (text, ui) => { c.setUi(ui); c.t = text; return c.run("cjkScriptOf(t)"); };
  assert.equal(script("Order accepted", "ja"), null);
  assert.equal(script("Pago", "zh-Hans"), null);
  assert.equal(script("注文を確認", "es"), "ja", "con kana, japonés aunque la interfaz sea española");
  assert.equal(script("注文を確認", "zh-Hans"), "ja", "con kana, japonés aunque la interfaz sea china");
  assert.equal(script("订单服务", "es"), "any", "solo han con interfaz española: sin forzar");
  assert.equal(script("订单服务", "en"), "any");
  assert.equal(script("订单服务", "fr"), "any");
  assert.equal(script("订单服务", "zh-Hans"), "zh");
  assert.equal(script("订单服务", "zh"), "zh");
  assert.equal(script("订单服务", "ja"), "jahan", "solo han con interfaz japonesa: lista japonesa y, detrás, la china");
  assert.equal(script("ｱｲｳ", "es"), "ja", "kana de ancho medio");
});

test("reserva: va ANTES de la primera familia genérica (serif resuelve a SimSun con <html lang=zh-Hans>) y solo con CJK", () => {
  const c = makeCtx({ uiLang: "zh-Hans" });
  const reserve = (fam, text) => { c.fam = fam; c.t = text; return c.run("withCjkReserve(fam, t)"); };
  assert.equal(reserve("Georgia, serif", "Order"), "Georgia, serif", "sin CJK, intacta");
  assert.equal(reserve("'IBM Plex Mono', ui-monospace, Consolas, monospace", "pedido"), "'IBM Plex Mono', ui-monospace, Consolas, monospace");
  const zh = reserve("Georgia, serif", "订单");
  assert.ok(zh.startsWith('Georgia, "PingFang SC"') && zh.endsWith(", serif"), zh);
  const plex = reserve("'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace", "订单");
  assert.ok(plex.indexOf("PingFang SC") < plex.indexOf("ui-monospace") && plex.indexOf("ui-monospace") > 0, "antes de ui-monospace: " + plex);
  assert.equal(reserve("Arial", "订单").endsWith('Source Han Sans SC"'), true, "sin genérica, al final");
  assert.ok(reserve("'Times New Roman', Times, serif", "日本語のテスト").includes("Yu Gothic UI"), "con interfaz china, el kana manda: japonés");
  c.setUi("es"); assert.ok(reserve("Georgia, serif", "かな").includes("Hiragino Sans"));
  c.setUi("ja"); const jh = reserve("Georgia, serif", "订单"); assert.ok(jh.indexOf("Yu Gothic UI") < jh.indexOf("Microsoft YaHei UI") && jh.indexOf("Microsoft YaHei UI") < jh.indexOf(", serif"), "ja + zh antes de la genérica: " + jh);
});

test("objFont: la cadena del texto latino no cambia ni un byte; con CJK lleva la reserva", () => {
  const c = makeCtx({ uiLang: "es" });
  c.o1 = { label: "Servicio", font: null, bold: false }; c.o2 = { label: "注文サービス", font: null, bold: false }; c.o3 = { label: "x", font: "'Segoe UI', system-ui, sans-serif", bold: true };
  assert.equal(c.run("objFont(o1, 14, null)"), "14px Georgia, serif");
  assert.equal(c.run("objFont(o3, 14, null)"), "bold 14px 'Segoe UI', system-ui, sans-serif");
  assert.match(c.run("objFont(o2, 14, null)"), /^14px Georgia, "Hiragino Sans".*"Source Han Sans JP", serif$/);
  c.o4 = { label: "n" };   /* sin objeto de texto (símbolo, flujo) */
  assert.equal(c.run("objFont(null, 14, null)"), "14px Georgia, serif");
});

test("reserva: los valores de render.js son los de los tokens de css/system.css (un solo origen de verdad)", () => {
  const css = lf(read("css/system.css"));
  const tok = (name) => (css.match(new RegExp("\\n\\s*--" + name + ":([^;]+);")) || [])[1];
  const c = makeCtx();
  const d = json(c.run("CJK_RESERVE_DEFAULT"));
  assert.equal(d.ja, tok("font-cjk-ja"));
  assert.equal(d.zh, tok("font-cjk-zh"));
  assert.equal(d.any, tok("font-cjk"), "neutra = --font-cjk de :root");
  const lang = (l) => css.match(new RegExp(":root:lang\\(" + l + "\\)\\{\\s*--font-cjk:([^;]+);"))[1];
  assert.equal(lang("ja"), d.ja, ":lang(ja) de S0 usa la misma lista");
  assert.equal(lang("zh"), d.zh, ":lang(zh) de S0 usa la misma lista");
});

/* ───────────── CSS: solo japonés y chino ───────────── */
function s4Blocks() {
  const out = {};
  for (const f of ["css/system.css", "css/styles.css"]) {
    const css = lf(read(f)), at = css.indexOf("Escritura por idioma, S4");
    assert.ok(at > 0, f + ": bloque S4");
    const end = css.indexOf("/* Material inverso", at);
    out[f] = css.slice(css.lastIndexOf("/*", at), end > 0 ? end : undefined);   /* system.css: hasta el material inverso, que no es de S4 */
  }
  return out;
}
function topLevelCommas(sel) {
  const out = []; let depth = 0, cur = "";
  for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch; }
  out.push(cur.trim()); return out.filter(Boolean);
}
function rulesOf(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = []; let depth = 0, start = 0, buf = "";
  /* reglas de primer nivel y de @media: lista de [selector, cuerpo] */
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(stripped))) rules.push([m[1].trim().replace(/\s+/g, " "), m[2].trim()]);
  return rules;
}
test("CSS: todo lo nuevo cuelga de :lang(ja) / :lang(zh), de tokens nuevos, de caras local() o del atributo data-cjk", () => {
  const blocks = s4Blocks();
  const OK = [/^:root:is\(:lang\(ja\), :lang\(zh\)\)\s/, /^:root:lang\((ja|zh)\)(\s|$)/, /^:root$/, /^\.scPhrase input\.scPhraseText\[data-cjk\]$/, /^@font-face$/];
  for (const [f, css] of Object.entries(blocks)) {
    const rules = rulesOf(css.replace(/@font-face\s*\{/g, "@font-face{"));
    assert.ok(rules.length >= 3, f + ": reglas");
    for (const [sel] of rules) {
      for (const one of topLevelCommas(sel)) assert.ok(OK.some((re) => re.test(one)) || /^@media/.test(one), `${f}: «${one}» no está acotada a ja/zh`);
    }
  }
  /* el único @media nuevo es el de los tooltips (hover:hover), y su regla sigue acotada */
  assert.match(blocks["css/system.css"], /@media \(hover:hover\)\{\s*:root:is\(:lang\(ja\), :lang\(zh\)\) \[data-tip\]:is\(:hover, :focus-visible\)::after\{/);
});

test("CSS: puntuación con dos caras local() (sin descarga) delante de Plex/Playfair solo en ja/zh; ninguna web-font CJK", () => {
  const css = lf(read("css/system.css"));
  const faces = [...css.matchAll(/@font-face\{[\s\S]*?\}/g)].map((m) => m[0]);
  const punct = faces.filter((f) => /Fluyo Punct/.test(f));
  assert.equal(punct.length, 2);
  for (const f of punct) { assert.ok(/src:local\(/.test(f) && !/url\(/.test(f), "solo local()"); assert.match(f, /unicode-range:U\+2014,U\+2018-201D,U\+2026;/); }
  assert.match(css, /:root:lang\(ja\)\{\s*--font-mono:"Fluyo Punct JA","IBM Plex Mono"/);
  assert.match(css, /:root:lang\(zh\)\{\s*--font-mono:"Fluyo Punct ZH","IBM Plex Mono"/);
  /* el resto de la pila coincide con la base (un solo tail): misma lista tras la cara de puntuación */
  const base = (css.match(/\n  --font-mono:("IBM Plex Mono"[^;]+);/) || [])[1];
  assert.ok(base, "--font-mono base");
  for (const l of ["ja", "zh"]) assert.ok(css.includes('--font-mono:"Fluyo Punct ' + l.toUpperCase() + '",' + base + ";"), l + ": misma pila que la base");
  assert.deepEqual(fs.readdirSync(path.join(root, "assets/fonts")).sort(), ["OFL-ibm-plex-mono.txt", "OFL-playfair-display.txt", "ibm-plex-mono-latin-400.woff2", "ibm-plex-mono-latin-500.woff2", "playfair-display-latin-400.woff2"], "ninguna fuente nueva en el repo");
  assert.doesNotMatch(read("sw.js"), /noto|cjk|hiragino|yahei|woff2.*(jp|sc)\b/i, "ninguna fuente CJK en el precache");
});

test("CSS: los 16 literales de 9–11 px tienen suelo en ja/zh (12 px; 11 en iconos, riel y marcas) y se quitan cursiva y espaciado", () => {
  const sty = lf(read("css/styles.css")), block = s4Blocks()["css/styles.css"];
  const twelve = [".scFlowEnds", ".scFlowRows", ".scLibraryHint", ".scTogether", ".scWaits", ".scStoryRepair", ".scGroupWarning", ".scPhraseInsert button", ".scEventPreview h3"];
  const eleven = [".rail button", ".iconGrid button", ".scVisualSeg .s1", ".scDropLine span"];
  const line12 = block.split("\n").find((l) => /font-size:12px/.test(l) && l.includes(".scFlowEnds"));
  const line11 = block.split("\n").find((l) => /font-size:11px/.test(l) && l.includes(".rail button"));
  for (const s of twelve) assert.ok(line12.includes(s), s + " → 12 px");
  for (const s of eleven) assert.ok(line11.includes(s), s + " → 11 px");
  assert.match(block, /\.scStepMessage\{ font-style:normal; \}/);
  assert.match(block, /\.scEventPreview h3\{ letter-spacing:0; \}/);
  /* y los literales de origen siguen siendo los que eran (el español no cambia) */
  assert.match(sty, /\.iconGrid button\{[^}]*font-size:9px/);
  assert.match(sty, /\.scStepMessage\{[^}]*font-style:italic/);
});

test("CSS: en chino los rótulos y botones suben a 600 sin negrita sintética; japonés no cambia de peso", () => {
  const css = lf(read("css/system.css"));
  const m = css.match(/:root:lang\(zh\) :is\(([^)]*(?:\([^)]*\)[^)]*)*)\)\{\s*font-weight:600; font-synthesis-weight:none;\s*\}/);
  assert.ok(m, "regla de peso en chino");
  for (const s of ["body > header button", "#bottomBar button", ".touchBar button", ".kicker", ".menuKicker", ".tabs > button", ".seg > .segBtn", ".pgroup > summary", "kbd"]) assert.ok(m[1].includes(s), s);
  assert.doesNotMatch(css, /:root:lang\(ja\)[^{]*font-weight/);
});

test("CSS: tooltips en ja/zh parten y no pasan del ancho de la ventana; corte japonés por frases como mejora progresiva", () => {
  const css = lf(read("css/system.css"));
  assert.match(css, /width:max-content; max-width:min\(280px, calc\(100vw - 24px\)\); white-space:normal; overflow-wrap:anywhere;/);
  assert.match(css, /:root:lang\(ja\)\{[^}]*line-break:strict; word-break:auto-phrase;/);
  assert.match(css, /:root:lang\(zh\)\{[^}]*line-break:strict;/);
  assert.doesNotMatch(css.match(/:root:lang\(zh\)\{[^}]*\}/g).join(""), /auto-phrase/);
});

/* ───────────── exportación ───────────── */
test("export: cada canvas de exportación copia el idioma de la página y el SVG lleva la reserva solo con texto CJK", () => {
  const ex = lf(read("js/export.js"));
  assert.equal((ex.match(/copyPageLang\(off\);/g) || []).length, 2, "PNG/JPG y GIF");
  assert.match(ex, /function copyPageLang\(canvas\)\{\s*const root=typeof document!=="undefined" \? document\.documentElement : null;\s*if\(root && root\.lang\) canvas\.lang=root\.lang;/);
  assert.equal((ex.match(/withCjkReserve\(/g) || []).length, 4, "medidor y texto de nodo, etiqueta de arista y su colocación");
  assert.doesNotMatch(ex, /xml:lang|\blang="/, "sin xml:lang en el SVG: el sanitizador de imágenes (safe-svg.js, kernel) lo rechazaría; entra con la resincronización del MCP");
  /* el canvas de exportación sin DOM (pruebas de analítica) no falla */
  const c = vm.createContext({ document: undefined });
  vm.runInContext(ex.slice(ex.indexOf("function copyPageLang"), ex.indexOf("function exportStatic")), c);
  const canvas = {}; c.copyPageLang(canvas); assert.equal(canvas.lang, undefined);
});

test("export: un SVG con la reserva CJK en font-family sigue pasando el sanitizador de imágenes", () => {
  const c = makeCtx({ uiLang: "ja" });
  c.fam = 'Georgia, serif'; c.t = "注文サービス";
  const family = c.run("withCjkReserve(fam, t)");
  const attr = family.replace(/"/g, "&quot;");
  c.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text x="10" y="20" font-family="${attr}" font-size="14" fill="#000">注文サービス</text></svg>`;
  assert.doesNotThrow(() => c.run("sanitizeStaticSVG(svg)"));
});

test("interaction: el cuadro de edición del texto usa la misma pila con reserva", () => {
  const it = lf(read("js/interaction.js"));
  assert.equal((it.match(/fam:withCjkReserve\(fam,o\.label\)/g) || []).length, 2, "etiqueta de nodo y de arista");
});

/* ───────────── IME: guardas listas (parche posterior a S2a) ───────────── */
test("IME: las tres confirmaciones con Enter respetan isComposing — todas o ninguna (el parche posterior a S2a se aplica entero)", () => {
  const ui = lf(read("js/ui.js")), sc = lf(read("js/editor-scenarios.js"));
  const guarded = [
    /input\.onkeydown=ev=>\{ if\(ev\.key==="Enter" && !ev\.isComposing && ev\.keyCode!==229\)/.test(ui),
    (sc.match(/if \(e\.key === "Enter" && !e\.isComposing && e\.keyCode !== 229\) \{/g) || []).length === 2,
    /input\.dataset\.cjk = "1"/.test(sc),
  ];
  assert.ok(guarded.every(Boolean) || guarded.every((g) => !g), "parche aplicado a medias: " + JSON.stringify(guarded));
  if (!guarded.some(Boolean)) {   /* aún sin aplicar: las tres siguen siendo las de S2a y el parche las cubre */
    assert.match(ui, /input\.onkeydown=ev=>\{ if\(ev\.key==="Enter"\)\{ ev\.preventDefault\(\); commit\(\); \} \};/);
    assert.equal((sc.match(/input\.onkeydown = \(e\) => \{\s*if \(e\.key === "Enter"\) \{/g) || []).length, 2);
  }
});

/* ───────────── alcance ───────────── */
test("alcance: ningún archivo del kernel cambia; los marcadores de S4 solo están en sus archivos; undoS4 devuelve cada archivo a su estado anterior", () => {
  const { undoS4, PIECES, NEW_FILES, AFTER_S2A_FILES } = require("./fluyo-i18n-002-s4-undo.cjs");
  assert.deepEqual(NEW_FILES, []);
  const KERNEL = ["js/config.js", "js/safe-svg.js", "js/model.js", "js/scenario-engine.js", "js/scenario-playback.js", "js/story-playback.js", "js/document-integrity.js", "js/story-authoring.js", "js/story-clock.js", "js/geometry.js"];
  const MARKERS = /withCjkReserve|wrapCueMessage|copyPageLang|cjkScriptOf|Fluyo Punct|font-cjk-ja|font-cjk-zh|CJK_TEXT_RE|S4 \(FLUYO-I18N-002\)|FLUYO-I18N-002 S4/;
  for (const f of KERNEL) assert.doesNotMatch(read(f), MARKERS, f + " (kernel/geometría) sin cambios de S4");
  assert.deepEqual(Object.keys(PIECES).sort(), ["css/styles.css", "css/system.css", "js/editor-scenarios.js", "js/export.js", "js/interaction.js", "js/render.js", "js/ui.js"]);
  for (const f of Object.keys(PIECES)) {
    const undone = undoS4(f, read(f));
    if (AFTER_S2A_FILES.includes(f)) continue;           /* el parche posterior a S2a puede no estar aplicado: su prueba es la de IME */
    assert.doesNotMatch(undone, MARKERS, f + ": undoS4 quita todo lo de S4");
    assert.notEqual(undone, lf(read(f)), f + ": hay algo que deshacer");
  }
  for (const f of ["index.html", "s/index.html", "404.html", "js/i18n.js", "js/viewer.js", "js/present-story.js", "css/share.css"]) assert.doesNotMatch(read(f), MARKERS, f + " sin cambios de S4");
});

test("sw.js: ningún archivo servido nuevo (el precache es el mismo de antes; solo cambia CACHE)", () => {
  const sw = read("sw.js");
  assert.match(sw, /const CACHE = "fluyo-static-v\d+";/);
  assert.doesNotMatch(sw, /s4|cjk/i);
});
