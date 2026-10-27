"use strict";
/* Arnés mínimo de Chrome real por CDP, SIN dependencias (Node ≥ 22: WebSocket global). Lo usa test/fluyo-i18n-002-s4-browser.cjs, que no
   necesita Playwright. Sirve el repo desde un servidor local y lanza Chrome sin cabeza con un perfil temporal. FLUYO_CHROME = ruta. */
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const CHROME = process.env.FLUYO_CHROME || [process.env.PROGRAMFILES && process.env.PROGRAMFILES + "/Google/Chrome/Application/chrome.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find((p) => fs.existsSync(p));
const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
let offline = false;
function serve(root) {
  return new Promise((res) => {
    const server = http.createServer((req, rs) => {
      if (offline) { req.socket.destroy(); return; }
      try {
        let rel = decodeURIComponent(new URL("http://x" + req.url).pathname); if (rel.endsWith("/")) rel += "index.html";
        const file = path.resolve(root, "." + rel);
        if (!file.startsWith(path.resolve(root))) throw 0;
        const body = fs.readFileSync(file);
        rs.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); rs.end(body);
      } catch { rs.writeHead(404); rs.end(); }
    });
    server.listen(0, "127.0.0.1", () => res({ server, base: "http://127.0.0.1:" + server.address().port, setOffline: (v) => { offline = v; } }));
  });
}
async function launch(extra = []) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "s4-prof-"));
  const proc = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + prof, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--force-device-scale-factor=1", "--window-size=1440,900", ...extra, "about:blank"], { stdio: "ignore" });
  let list;
  for (let i = 0; i < 60; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(); const handlers = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const { ok, ko } = pend.get(d.id); pend.delete(d.id); d.error ? ko(new Error(d.error.message)) : ok(d.result); } else handlers.forEach((h) => h(d)); };
  const send = (method, params = {}) => new Promise((ok, ko) => { const i = ++id; pend.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (h) => handlers.push(h);
  const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; };
  const goto = async (url, wait = 600) => { await send("Page.navigate", { url }); await new Promise((r) => setTimeout(r, 400)); for (let i = 0; i < 80; i++) { const s = await ev("document.readyState").catch(() => ""); if (s === "complete") break; await new Promise((r) => setTimeout(r, 100)); } await new Promise((r) => setTimeout(r, wait)); };
  const shot = async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); };
  const viewport = (w, h, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile }).then(() => mobile ? send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }) : send("Emulation.setTouchEmulationEnabled", { enabled: false }));
  const close = () => { try { ws.close(); proc.kill(); } catch {} };
  await send("Page.enable"); await send("DOM.enable"); await send("CSS.enable"); await send("Runtime.enable");
  return { send, ev, goto, shot, viewport, close, on };
}
module.exports = { serve, launch, CHROME };
