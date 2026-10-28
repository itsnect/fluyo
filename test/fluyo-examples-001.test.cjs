"use strict";
/* FLUYO-EXAMPLES-001 — el catálogo de /ejemplos: tres ejemplos, cada uno con dos Historias que se reproducen de verdad.

   Comprueba con el kernel real (vm):
   · regla de producto: todo ejemplo de la galería tiene ≥ 1 Historia y todos sus pasos llevan frase;
   · cada documento es válido y sus Historias dan el resultado que la tarjeta promete (éxito completo, fallo real con
     target_down, espera de llegada que de verdad retiene el paso);
   · las ediciones es/en tienen la misma estructura (solo cambia el texto);
   · los enlaces «▶» de la galería son exactamente el JSON publicado con esa Historia en primera posición (deriva).

   Regenerar los enlaces tras tocar un JSON:  node test/fluyo-examples-001.test.cjs --write */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "ejemplos", "data");
const GALLERY = path.join(ROOT, "ejemplos", "index.html");
const CATALOG = {
  "compra-online": { failure: { story: 2, step: 4 }, waits: { story: 1, step: 6 } },
  "inicio-de-sesion-oauth2": { failure: null, waits: { story: 1, step: 8 } },
  "pedido-asincrono-cola": { failure: { story: 2, step: 5 }, waits: null },
};

const ctx = vm.createContext({ TextEncoder, TextDecoder, atob, btoa, URL, console, CompressionStream, DecompressionStream, Uint8Array });
for (const f of ["config.js", "safe-svg.js", "model.js", "scenario-engine.js", "scenario-playback.js", "story-playback.js", "story-clock.js", "flow-semantics.js", "document-integrity.js", "link-codec.js"])
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), ctx, { filename: f });
const J = (v) => JSON.parse(JSON.stringify(v));
const load = (slug, lang = "es") => JSON.parse(fs.readFileSync(path.join(DATA, lang === "es" ? "" : lang, slug + ".fluyo.json"), "utf8"));
function run(page, sc) {
  ctx.__pg = J(page); ctx.__sc = J(sc);
  return J(vm.runInContext(`(()=>{ const r = FluyoStory.run(__pg, __sc); const sch = FluyoStoryClock.start(__pg, __sc, 0).playback.schedule;
    return { outcomes: FluyoStory.outcomes(r.trace, __sc, __pg), byStep: sch.byStep, ignored: sch.ignored }; })()`, ctx));
}
/* El documento del enlace: el mismo JSON con la Historia elegida en primera posición (el Viewer reproduce scenarios[0]). */
function rotated(d, storyId) {
  const c = J(d), sc = c.doc.pages[0].scenarios, i = sc.findIndex((s) => s.id === storyId);
  c.doc.pages[0].scenarios = [sc[i], ...sc.slice(0, i), ...sc.slice(i + 1)];
  return c;
}
function galleryLinks(html) {
  return [...html.matchAll(/<a [^>]*data-example="([^"]+)" data-story="(\d+)" href="\.\.\/s\/#d=([A-Za-z0-9_-]*)"/g)].map((m) => ({ slug: m[1], story: +m[2], payload: m[3] }));
}

if (process.argv.includes("--write")) {
  (async () => {
    let html = fs.readFileSync(GALLERY, "utf8");
    for (const l of galleryLinks(html)) {
      ctx.__d = rotated(load(l.slug), l.story);
      const payload = await vm.runInContext("encodeDeepLink(__d)", ctx);
      html = html.replace(`data-example="${l.slug}" data-story="${l.story}" href="../s/#d=${l.payload}"`, `data-example="${l.slug}" data-story="${l.story}" href="../s/#d=${payload}"`);
    }
    fs.writeFileSync(GALLERY, html);
    console.log("enlaces regenerados:", galleryLinks(html).length);
  })();
} else {
  test("la galería lista exactamente el catálogo, en la lista blanca, con un ▶ por Historia", () => {
    const html = fs.readFileSync(GALLERY, "utf8"), links = galleryLinks(html);
    const listed = [...new Set(links.map((l) => l.slug))];
    assert.deepEqual(listed, Object.keys(CATALOG));
    const examples = fs.readFileSync(path.join(ROOT, "js", "examples.js"), "utf8");
    for (const slug of listed) {
      assert.match(examples, new RegExp(`"${slug}": +1,`), slug + " en el catálogo de la lista blanca");
      assert.ok(html.includes(`href="../?ejemplo=${slug}"`), slug + " abre en el editor");
      const ids = load(slug).doc.pages[0].scenarios.map((s) => s.id);
      assert.deepEqual(links.filter((l) => l.slug === slug).map((l) => l.story), ids, slug + ": un ▶ por Historia, en orden");
    }
  });

  for (const [slug, expect] of Object.entries(CATALOG)) for (const lang of ["es", "en"]) {
    test(`${slug} (${lang}): válido, dos Historias narradas que hacen lo que la tarjeta promete`, () => {
      const d = load(slug, lang);
      ctx.__p = J(d);
      const v = J(vm.runInContext("FluyoIntegrity.validateProject(__p)", ctx));
      assert.equal(v.valid, true, JSON.stringify(v.errors));
      const page = d.doc.pages[0];
      assert.equal(page.scenarios.length, 2);
      for (const sc of page.scenarios) {
        assert.ok(sc.steps.every((s) => typeof s.message === "string" && s.message.trim()), sc.name + ": todos los pasos con frase");
        const r = run(page, sc);
        assert.deepEqual(r.ignored, []);
        const bad = r.outcomes.filter((o) => o.status === "not_completed");
        if (expect.failure && sc.id === expect.failure.story)
          assert.deepEqual(bad.map((o) => [o.stepId, o.reason]), [[expect.failure.step, "target_down"]], sc.name + ": un fallo real");
        else assert.deepEqual(bad, [], sc.name + ": todo se completa");
        if (expect.waits && sc.id === expect.waits.story) {
          const step = sc.steps.find((s) => s.id === expect.waits.step);
          assert.ok(r.byStep[step.id] > step.at, sc.name + ": la espera de llegada retiene el paso");
        }
      }
    });
  }

  test("ediciones es/en: la misma estructura, solo cambia el texto", () => {
    const TEXT = new Set(["label", "name", "message", "sentenceTemplate"]);
    const strip = (v) => Array.isArray(v) ? v.map(strip) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !TEXT.has(k)).map(([k, x]) => [k, strip(x)])) : v;
    for (const slug of Object.keys(CATALOG)) assert.deepEqual(strip(load(slug, "en")), strip(load(slug, "es")), slug);
  });

  test("los enlaces ▶ de la galería son el JSON publicado con esa Historia primero (sin deriva)", async () => {
    for (const l of galleryLinks(fs.readFileSync(GALLERY, "utf8"))) {
      assert.ok(l.payload, `${l.slug}#${l.story}: enlace generado (node test/fluyo-examples-001.test.cjs --write)`);
      ctx.__payload = l.payload;
      const got = await vm.runInContext("decodeDeepLink(__payload)", ctx);
      assert.deepEqual(J(got), rotated(load(l.slug), l.story), `${l.slug}#${l.story}: regenerar con --write`);
    }
  });
}
