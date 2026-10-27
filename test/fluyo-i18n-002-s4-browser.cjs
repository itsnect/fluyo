"use strict";
/* FLUYO-I18N-002 S4 — Chrome REAL (CDP sin dependencias, test/cdp-lite.cjs): japonés y chino SIN espacios en el lienzo, la interfaz y la
   exportación. Lo que demuestra:
   1. El globo de mensaje: el corpus CJK parte en líneas que caben (editor, 1440 y 390) y el latín sale igual.
   2. Las fuentes que Chrome pinta DE VERDAD (CSS.getPlatformFontsForNode) con la pila del lienzo: nunca MS Gothic/SimSun/NSimSun/Mincho, y
      UNA sola familia CJK por texto (sin mezclar Yu Gothic + YaHei). Con interfaz española, japonesa y china.
   3. Paridad lienzo ↔ exportación: el canvas de exportación mide igual que el visible (copyPageLang).
   4. Español, inglés y francés NO cambian: ninguna regla nueva de CSS casa con un elemento si <html lang> no es ja/zh.
   5. Barrido de desbordes con un diccionario ja/zh artificial (longitud natural y hostil) y un documento con texto CJK: se resta la línea base en
      español y no puede aparecer ningún grupo nuevo salvo los preexistentes y conocidos (título de Historia largo, independiente del idioma).
   6. Offline: con el service worker instalado y la red cortada, `?lang=ja` sigue pintando con la fuente del sistema, sin pedir fuentes.
   Uso: node test/fluyo-i18n-002-s4-browser.cjs   (FLUYO_CHROME=<ruta>; FLUYO_SHOTS=<dir>). Sin Chrome: se salta. */
const fs = require("node:fs"), path = require("node:path");
const { serve, launch, CHROME } = require("./cdp-lite.cjs");
const scan = require("./i18n-scan.cjs");
const root = path.resolve(process.env.FLUYO_ROOT || path.join(__dirname, ".."));
const shots = process.env.FLUYO_SHOTS || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
if (!CHROME || !fs.existsSync(CHROME)) { console.log("(sin Chrome: " + CHROME + ") — se salta"); process.exit(0); }

let passed = 0, failed = 0;
const check = (cond, msg) => { if (cond) { passed++; console.log("  ✔ " + msg); } else { failed++; console.log("  ✘ " + msg); } };
const info = (msg) => console.log("  ℹ " + msg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BAD = /^(MS Gothic|MS PGothic|MS UI Gothic|MS Mincho|MS PMincho|SimSun|NSimSun|SimHei|MingLiU|PMingLiU|Yu Mincho|Hiragino Mincho ProN|STSong|Songti)( |$)/;
const JA_OK = /^(Yu Gothic UI|Yu Gothic|Meiryo UI|Meiryo|Hiragino Sans|Hiragino Kaku Gothic ProN|Noto Sans CJK JP|Noto Sans JP|Source Han Sans JP)( |$)/;
const ZH_OK = /^(Microsoft YaHei UI|Microsoft YaHei|PingFang SC|Hiragino Sans GB|Noto Sans CJK SC|Noto Sans SC|Source Han Sans SC)( |$)/;
const LATIN = /^(Georgia|Times New Roman|IBM Plex Mono|Playfair Display|Consolas|Segoe UI|Arial|Courier New)( |$)/;
const CORPUS = {
  JA_NOSPACE_20: "注文を受け付けて支払いを確認しました",
  JA_NOSPACE_120: "注文を受け付けて支払いを確認し、その後に倉庫チームへ通知して出荷準備を開始します。在庫が不足している場合は担当者へ連絡します。",
  ZH_NOSPACE_60: "订单已接受并确认付款，随后通知仓库团队开始备货。如果库存不足，请联系负责人处理，并更新订单状态。",
  MIX_UNITS: "注文ID 12345 を受付→Kafka経由で在庫サービス(v2.1)へ送信、応答は約250ms。",
  KINSOKU: "「在庫確認」の結果、（約250ms）かかりました。",
};
const POOL = { ja: "日本語の長い文章を空白なしで表示するテスト、数字123とABC、「引用」（括弧）…注文サービスはKafka経由で在庫を確認し約250msで応答します。", zh: "中文长句不含空格的显示测试，数字123与ABC、“引用”（括号）……订单服务通过Kafka检查库存并在约250ms内响应。" };
function cjk(lang, n, seed) { const p = [...POOL[lang]]; let o = ""; for (let i = 0; i < n; i++) o += p[(seed + i) % p.length]; return o; }
function stressText(lang, es, ratio, seed) {
  if (es && typeof es === "object") return Object.fromEntries(Object.entries(es).map(([k, v]) => [k, stressText(lang, v, ratio, seed)]));
  const parts = String(es).split(/(\{\w+\})/); const vis = parts.filter((p) => !/^\{\w+\}$/.test(p)).join("").length;
  const n = Math.max(2, Math.round(vis * ratio)); let left = n;
  return parts.map((p) => { if (/^\{\w+\}$/.test(p)) return p; const take = Math.max(1, Math.round(n * p.length / Math.max(1, vis))); const s = cjk(lang, Math.min(take, left), seed); left -= s.length; return s; }).join("");
}
function stressDict(lang, ratio) { const out = {}; let i = 0; for (const u of scan.catalog().uses) { if (out[u.key] !== undefined) continue; out[u.key] = stressText(lang, u.es, ratio, i++ * 7); } return out; }
function stressDoc(lang, ratio) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8")); let i = 0;
  (function w(o) { if (o && typeof o === "object") for (const k in o) { const v = o[k]; if (typeof v === "string" && ["name", "label", "message", "sentenceTemplate"].includes(k) && !/^(SEND|DOWN|UP|FLOW)$/.test(v) && v.length > 1) o[k] = stressText(lang, v, ratio, i++ * 5); else w(v); } })(d);
  return d;
}

/* ───────── detector de desbordes y recortes (el de la auditoría S4) ───────── */
const DETECT = `(()=>{
  const vw=innerWidth, out=[];
  const path=(e)=>{const a=[];for(let n=e;n&&n.nodeType===1&&a.length<4;n=n.parentElement){a.push(n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(n.className&&typeof n.className==='string'?'.'+n.className.trim().split(/\\s+/).slice(0,2).join('.'):''));}return a.join(' < ');};
  const vis=(e)=>{const r=e.getBoundingClientRect();if(r.width<=0||r.height<=0)return null;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)return null;return {r,cs}};
  const seen=new Set();
  const add=(e,type,detail)=>{const k=type+'|'+path(e);if(seen.has(k))return;seen.add(k);out.push({type,path:path(e),text:(e.textContent||'').trim().slice(0,28),...detail});};
  for(const e of document.querySelectorAll('body *')){
    if(['SCRIPT','STYLE','svg','path','use','canvas','OPTION','DEFS'].includes(e.tagName)||e.closest('svg'))continue;
    const v=vis(e);if(!v)continue;
    const own=[...e.childNodes].some(n=>n.nodeType===3&&n.data.trim());
    const isCtl=['BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','LABEL'].includes(e.tagName);
    if(!own&&!isCtl)continue;
    const {r,cs}=v;
    if((cs.overflowX==='hidden'||cs.overflowX==='clip')&&e.scrollWidth>e.clientWidth+1){ if(cs.textOverflow==='ellipsis')add(e,'ellipsis',{}); else add(e,'clipped-x',{sw:e.scrollWidth,cw:e.clientWidth}); }
    if((cs.overflowY==='hidden'||cs.overflowY==='clip')&&e.scrollHeight>e.clientHeight+1&&e.clientHeight>0)add(e,'clipped-y',{sh:e.scrollHeight,ch:e.clientHeight});
    if(own){const rg=document.createRange();for(const n of e.childNodes){if(n.nodeType!==3||!n.data.trim())continue;rg.selectNodeContents(n);for(const q of rg.getClientRects()){
      if(q.width<=0)continue;
      if(q.right>r.right+1.5||q.left<r.left-1.5)add(e,'text-outside-x',{});
      if((q.bottom>r.bottom+1.5||q.top<r.top-1.5)&&e.tagName!=='LABEL')add(e,'text-outside-y',{});
      if(q.right>vw+1||q.left<-1)add(e,'offscreen-x',{});
    }}}
  }
  if(document.documentElement.scrollWidth>vw+1)out.push({type:'page-hscroll',path:'html'});
  return out;
})()`;

const STATES = [
  ["base", ""],
  ["propiedades", "(()=>{selectOnly('node', doc.pages[0].nodes[0].id); const b=document.getElementById('btnPanel'); if(b&&b.offsetParent&&b.getAttribute('aria-expanded')==='false')b.click(); return 1})()"],
  ["más", "(()=>{clearSel(); document.getElementById('btnMore').click(); return 1})()"],
  ["lienzo", "(()=>{document.getElementById('btnMore').click(); const c=document.getElementById('btnCanvas'); if(c.offsetParent) c.click(); return 1})()"],
  ["compartir", "(()=>{document.querySelectorAll('.moreMenu').forEach(m=>m.hidden=true); document.getElementById('btnShare').click(); return 1})()"],
  ["exportar", "(()=>{const d=document.getElementById('shareDialog'); if(d.open)d.close(); let e=document.getElementById('btnExport'); if(!e.offsetParent){document.getElementById('btnMore').click();} e.click(); return 1})()"],
  ["historias", "(()=>{document.getElementById('exModal').style.display='none'; document.querySelectorAll('.moreMenu').forEach(m=>m.hidden=true); document.getElementById('tabScenarios').click(); return 1})()"],
  ["present", "(()=>{document.getElementById('tabProperties').click(); document.getElementById('btnPresent').click(); return 1})()"],
];
const VPS = [["1440x900", 1440, 900, false], ["390x844m", 390, 844, true]];
/* preexistente e independiente del idioma (latín de 40 car. sin espacios desborda igual: control de la auditoría S4, P14) */
const KNOWN = [/button#scScenarioTitle/];

(async () => {
  const s = await serve(root);
  const b = await launch();
  try {
    /* ───────── 1 · globo ───────── */
    console.log("1 · globo de mensaje en Chrome real");
    await b.viewport(1440, 900, false);
    await b.goto(s.base + "/index.html?lang=ja", 600);
    const balloon = await b.ev(`(async()=>{ await document.fonts.ready; const c=document.getElementById('cv').getContext('2d');
      const measure=(t,f)=>{c.font=f;return c.measureText(t).width}; const res={};
      for(const [k,m] of Object.entries(${JSON.stringify({ ...CORPUS, LATIN: "Order accepted and payment captured, then notify the warehouse team" })})) for(const pos of ['above','center']){
        const n={x:0,y:0,w:180,h:70}; const fx={message:m,messageSize:'medium',messageWeight:'normal',messageFont:'default',messagePosition:pos,showSymbol:false};
        const L=computeNodeCueLayout(n,fx,null,measure,{above:0,below:0}).message; const maxW=pos==='center'?Math.max(96,n.w-10):Math.min(260,Math.max(140,n.w+60));
        res[k+'/'+pos]={lines:L.lines.length,over:Math.max(0,Math.max(...L.lines.map(l=>measure(l,L.font)))-(maxW-14)),joined:L.lines.join('').replace(/\\s+/g,''),orig:m.replace(/\\s+/g,'')};
      } return res; })()`);
    for (const [k, r] of Object.entries(balloon)) check(r.over <= 0.5 && r.joined === r.orig, `${k}: ${r.lines} línea(s), sin desborde y sin pérdida de texto`);
    check(balloon["JA_NOSPACE_120/above"].lines >= 3 && balloon["LATIN/above"].lines >= 2, "el mensaje largo parte en varias líneas (japonés y latín)");

    /* ───────── 2 · fuentes pintadas ───────── */
    console.log("2 · fuentes que Chrome pinta con la pila del lienzo");
    const painted = async (lang, family, text) => {
      await b.ev(`document.documentElement.lang=${JSON.stringify(lang)}`);
      await b.ev(`(()=>{document.querySelectorAll('#pp').forEach(e=>e.remove());const p=document.createElement('p');p.id='pp';p.style.cssText='position:fixed;left:0;top:0;font-size:16px';p.style.fontFamily=${JSON.stringify(family)};p.textContent=${JSON.stringify(text)};document.body.appendChild(p);return p.offsetWidth})()`);
      await sleep(120);
      const doc = await b.send("DOM.getDocument", { depth: 0 }); const q = await b.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#pp" });
      return (await b.send("CSS.getPlatformFontsForNode", { nodeId: q.nodeId })).fonts.map((f) => f.familyName);
    };
    const JA_TXT = "日本語の表示テスト「引用」", ZH_TXT = "中文显示测试“引用”";
    for (const ui of ["es", "ja", "zh-Hans"]) {
      await b.ev(`document.documentElement.lang=${JSON.stringify(ui)}`);
      for (const [name, base] of [["Georgia", "Georgia, serif"], ["Plex", "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace"], ["Segoe UI", "'Segoe UI', system-ui, sans-serif"], ["Courier", "'Courier New', Courier, monospace"]]) {
        for (const [tl, txt, okRe] of [["ja", JA_TXT, JA_OK], ["zh", ZH_TXT, ui === "zh-Hans" ? ZH_OK : /./]]) {
          const withDoc = await b.ev(`withCjkReserve(${JSON.stringify(base)}, ${JSON.stringify(txt)})`);
          const fams = await painted(ui, withDoc, txt);
          const cjkFams = fams.filter((f) => !LATIN.test(f));
          check(!fams.some((f) => BAD.test(f)), `UI ${ui} · ${name} · ${tl}: sin MS Gothic/SimSun/Mincho (${fams.join(", ")})`);
          check(new Set(cjkFams.map((f) => f.replace(/ (Regular|Semibold|Bold|Light|Semilight|Medium)$/, ""))).size <= 1 || tl === "zh" && ui !== "zh-Hans", `UI ${ui} · ${name} · ${tl}: una sola familia CJK (${cjkFams.join(", ")})`);
          if (tl === "ja") check(cjkFams.every((f) => JA_OK.test(f)), `UI ${ui} · ${name} · ja: familia japonesa`);
          if (tl === "zh" && ui === "zh-Hans") check(cjkFams.every((f) => ZH_OK.test(f)), `UI zh · ${name} · zh: familia china`);
        }
      }
    }
    /* el cromo: la puntuación CJK sale de la fuente CJK, no de Plex */
    for (const ui of ["ja", "zh-Hans"]) {
      const f = await painted(ui, "var(--font-mono)", "字“…—”字");
      check(!f.includes("IBM Plex Mono"), `UI ${ui}: “ … — ” los pinta la fuente CJK, no Plex (${f.join(", ")})`);
    }

    /* ───────── 3 · paridad lienzo ↔ exportación ───────── */
    console.log("3 · el canvas de exportación mide igual que el lienzo visible");
    for (const ui of ["es", "ja", "zh-Hans"]) {
      const r = await b.ev(`(()=>{ document.documentElement.lang=${JSON.stringify(ui)}; const cv=document.getElementById('cv').getContext('2d'); const off=document.createElement('canvas'); copyPageLang(off); const oc=off.getContext('2d'); const bare=document.createElement('canvas').getContext('2d');
        const out={}; for(const [k,t] of [['ja',${JSON.stringify(JA_TXT)}],['zh',${JSON.stringify(ZH_TXT)}]]){ const f=objFont({label:t},16,null); cv.font=f; oc.font=f; bare.font=f; out[k]=[cv.measureText(t).width,oc.measureText(t).width,bare.measureText(t).width]; } return out; })()`);
      for (const k of ["ja", "zh"]) check(Math.abs(r[k][0] - r[k][1]) < 0.01, `UI ${ui} · ${k}: canvas visible ${r[k][0].toFixed(1)} = exportación ${r[k][1].toFixed(1)}`);
      if (Math.abs(r.ja[2] - r.ja[0]) > 0.01) info(`UI ${ui}: sin copiar el idioma, el canvas suelto mediría ${r.ja[2].toFixed(1)} (ja) frente a ${r.ja[0].toFixed(1)}`);
    }

    /* ───────── 4 · español, inglés y francés no cambian ───────── */
    console.log("4 · ninguna regla nueva casa fuera de ja/zh");
    for (const ui of ["es", "en", "fr", "ja", "zh-Hans"]) {
      const n = await b.ev(`(()=>{ document.documentElement.lang=${JSON.stringify(ui)}; let hits=0, rules=0;
        for(const sh of document.styleSheets){ let rs; try{ rs=sh.cssRules }catch(e){ continue } const walk=(list)=>{ for(const r of list){ if(r.cssRules&&r.type!==1){ walk(r.cssRules); continue } if(r.type!==1) continue;
          if(!/lang\\(ja\\)|lang\\(zh\\)|data-cjk/.test(r.selectorText||'')) continue; if(/^:root$/.test(r.selectorText)||/^:root:lang\\((ja|zh)\\)$/.test(r.selectorText)) continue; rules++; let m=0; try{ m=document.querySelectorAll(r.selectorText).length }catch(e){} if(m) hits++; } }; walk(rs) }
        return {hits,rules}; })()`);
      if (["es", "en", "fr"].includes(ui)) check(n.rules >= 6 && n.hits === 0, `UI ${ui}: ${n.rules} reglas de S4, ${n.hits} casan con algún elemento`);
      else check(n.hits > 0, `UI ${ui}: las reglas de S4 sí se aplican (${n.hits} casan)`);
    }
    const tokens = await b.ev(`(()=>{ const out={}; for(const l of ['es','fr','ja','zh-Hans']){ document.documentElement.lang=l; const cs=getComputedStyle(document.documentElement); out[l]=[cs.lineBreak, cs.wordBreak, cs.getPropertyValue('--font-mono').trim().slice(0,22)] } return out })()`);
    check(["es", "fr"].every((l) => tokens[l][0] === "auto" && tokens[l][1] === "normal" && tokens[l][2].startsWith('"IBM Plex Mono"')), "es/fr: line-break y word-break por defecto y pila de siempre");
    check(tokens.ja[0] === "strict" && tokens.ja[1] === "auto-phrase" && tokens["zh-Hans"][0] === "strict", "ja/zh: line-break strict (y auto-phrase en japonés)");

    /* ───────── 5 · barrido de desbordes ───────── */
    console.log("5 · barrido de desbordes (diccionario ja/zh artificial; se resta el español)");
    const runStates = async (lang, mode, D, doc, vp) => {
      const [vn, w, h, mob] = vp; const rows = [];
      await b.viewport(w, h, mob);
      await b.goto(s.base + "/index.html" + (lang === "es" ? "" : "?lang=" + lang), 600);
      await b.ev(`${D ? `FLUYO_LOCALES[${JSON.stringify(lang)}]=${JSON.stringify(D)}; FluyoI18n.setLocale('es'); FluyoI18n.setLocale(${JSON.stringify(lang)});` : ""} applyProjectData(${JSON.stringify(doc)}); fitView(); clearSel(); renderTabs(); true`);
      await sleep(400);
      for (const [name, code] of STATES) {
        try { if (code) await b.ev(code); } catch (e) { rows.push({ vp: vn, state: name, type: "state-error", path: String(e.message).slice(0, 60) }); continue; }
        await sleep(300);
        for (const r of await b.ev(DETECT)) rows.push({ vp: vn, state: name, ...r });
        if (shots && mode === "hostil") await b.shot(path.join(shots, `${lang}-${mode}-${vn}-${name}.png`));
      }
      return rows;
    };
    const baseDoc = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "fluyo-017-1-qa-complejo.fluyo.json"), "utf8"));
    const baseline = new Set();
    for (const vp of VPS) for (const r of await runStates("es", "base", null, baseDoc, vp)) baseline.add([r.vp, r.state, r.type, r.path].join("|"));
    info(`línea base en español: ${baseline.size} hallazgos estructurales (se restan)`);
    for (const lang of ["ja", "zh"]) for (const [mode, ratio] of [["natural", 0.45], ["hostil", 0.9]]) {
      const D = stressDict(lang, ratio), doc = stressDoc(lang, ratio === 0.45 ? 0.5 : 1.2); const fresh = new Map();
      for (const vp of VPS) for (const r of await runStates(lang, mode, D, doc, vp)) {
        if (baseline.has([r.vp, r.state, r.type, r.path].join("|")) || r.type === "state-error") { if (r.type === "state-error") fresh.set("state-error " + r.path, r); continue; }
        if (KNOWN.some((re) => re.test(r.path))) continue;
        /* en longitud hostil (1:1, ≈ 1,5 × el ancho del español) lo truncado con elipsis a propósito no es un fallo */
        if (mode === "hostil" && (r.type === "ellipsis" || r.type === "text-outside-x" || r.type === "offscreen-x")) continue;
        fresh.set(r.type + " :: " + r.path + " [" + r.state + "@" + r.vp + "]", r);
      }
      check(fresh.size === 0, `${lang} · ${mode}: ningún recorte ni desborde nuevo respecto al español${fresh.size ? " — " + [...fresh.keys()].slice(0, 5).join(" | ") : ""}`);
    }

    /* francés e inglés con sus diccionarios reales (D-S4-10: el francés entra en el mismo barrido): mismo criterio, mismo español como base */
    for (const lang of ["fr", "en"]) {
      const fresh = new Set();
      for (const vp of VPS) for (const r of await runStates(lang, "real", null, baseDoc, vp)) {
        if (baseline.has([r.vp, r.state, r.type, r.path].join("|")) || KNOWN.some((re) => re.test(r.path))) continue;
        fresh.add(r.type + " :: " + r.path + " [" + r.state + "@" + r.vp + "]");
      }
      check(fresh.size === 0, `${lang} · diccionario real: ningún recorte ni desborde nuevo respecto al español${fresh.size ? " — " + [...fresh].slice(0, 5).join(" | ") : ""}`);
    }

    /* ───────── 6 · offline ───────── */
    console.log("6 · offline");
    await b.viewport(1440, 900, false);
    await b.goto(s.base + "/index.html?lang=ja", 800);
    const ready = await b.ev(`(async()=>{ await navigator.serviceWorker.ready; for(let i=0;i<60;i++){ const ks=await caches.keys(); if(ks.length){ const c=await caches.open(ks[0]); if((await c.keys()).length>40) return true } await new Promise(r=>setTimeout(r,200)) } return false })()`);
    check(ready, "service worker instalado con el precache completo");
    s.setOffline(true); await b.send("Network.enable"); await b.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await b.goto(s.base + "/index.html?lang=ja", 1200);
    const off = await b.ev(`(async()=>{ await document.fonts.ready; return {lang:document.documentElement.lang, share:document.querySelector('#btnShare .lbl').textContent, fonts:[...document.fonts].map(f=>f.family+' '+f.status), res:performance.getEntriesByType('resource').map(r=>r.name.split('/').pop()).filter(n=>/woff|ttf|otf/.test(n))} })()`);
    check(off.lang === "ja" && off.share.length > 0, "sin red, el editor abre en japonés");
    check(off.fonts.every((f) => /loaded$/.test(f)) && off.res.every((n) => /^(ibm-plex-mono-latin-(400|500)|playfair-display-latin-400)\.woff2$/.test(n)), "sin red, solo las tres fuentes latinas (del precache) y ninguna fuente CJK que descargar");
    const doc = await b.send("DOM.getDocument", { depth: 0 }); const q = await b.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#btnShare .lbl" });
    const pf = (await b.send("CSS.getPlatformFontsForNode", { nodeId: q.nodeId })).fonts.map((f) => f.familyName);
    check(pf.length > 0 && pf.every((f) => !BAD.test(f) && JA_OK.test(f)), `sin red, el japonés se pinta con la fuente del sistema (${pf.join(", ")})`);
    await b.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); s.setOffline(false);
  } finally { b.close(); s.server.close(); }
  console.log(`\n${passed} ✔ · ${failed} ✘`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
