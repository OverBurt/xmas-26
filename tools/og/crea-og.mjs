// Crea l'immagine di anteprima per i social (public/og.png, 1200×630): una schermata del primo livello con
// il titolo sopra, presa da Chrome headless. Prerequisiti: `npm run dev` attivo su :5173.
// Uso: node tools/og/crea-og.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'xmas-og-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${tmp}`, '--window-size=1200,630', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) {
  try {
    tabs = await (await fetch('http://localhost:9335/json')).json();
    if (tabs.some((t) => t.type === 'page')) break;
  } catch {}
  await dorme(200);
}
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const attese = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (attese.has(m.id)) { attese.get(m.id)(m.result); attese.delete(m.id); }
});
const cmd = (method, params = {}) => new Promise((r) => { attese.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
try {
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: 'http://localhost:5173/?level=borgo-addormentato' });
  for (let i = 0; i < 50 && !(await ev('!!window.xmas')); i++) await dorme(200);
  await ev(`(async () => {
    const g = xmas.game; g.endIntro();
    // scena a tutto schermo, senza cornice né pulsanti; inquadratura sulla slitta, il fortino e le case
    const st = document.createElement('style');
    st.textContent = '#controls,#hud,#audio-pannello{display:none!important} body{background:#0b1230!important} #frame{border-radius:0!important;box-shadow:none!important;width:1200px!important;height:563px!important;position:absolute;top:67px;left:0}' +
      '#og-titolo{position:absolute;top:0;left:0;width:1200px;height:67px;display:flex;align-items:center;justify-content:center;gap:18px;font:800 40px ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold",system-ui,sans-serif;color:#ffd36b;background:#0b1230;letter-spacing:.5px}' +
      '#og-titolo small{font:600 22px ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold",system-ui,sans-serif;color:#dfe6ff}';
    document.head.append(st);
    const t = document.createElement('div');
    t.id = 'og-titolo';
    t.innerHTML = "Biglietto d'auguri - GAME <small>lancia i regali nelle case!</small>";
    document.body.append(t);
    window.dispatchEvent(new Event('resize'));
    g.camera.setTarget(21, 42, 50);
    await new Promise((r) => setTimeout(r, 1800));
  })()`);
  const r = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  writeFileSync(join(ROOT, 'public/og.png'), Buffer.from(r.data, 'base64'));
  console.log('scritto public/og.png');
} finally {
  ws.close();
  chrome.kill();
}
