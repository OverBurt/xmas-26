// Crea le anteprime dei livelli per la pagina di scelta (public/livelli/<id>.webp, 640×300): una schermata della
// scena di ogni livello, senza HUD, inquadrata sulle case. Da rifare quando un livello cambia.
// Prerequisiti: `npm run dev` attivo su :5173. Uso: npm run anteprime
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const W = 640;
const H = 420; // altezza della scena nella pagina (1280×600 in scala): si fotografa la fascia centrale...
const TAGLIO = 300; // ...e solo i 300 px in basso, dove stanno case e ostacoli
const FRAME_W = Math.round((H * 1280) / 600);
const dir = join(ROOT, 'src/game/levels');
const livelli = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const tmp = mkdtempSync(join(tmpdir(), 'xmas-anteprime-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${tmp}`, `--window-size=${FRAME_W},${H}`, '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) {
  try {
    tabs = await (await fetch('http://localhost:9336/json')).json();
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
  mkdirSync(join(ROOT, 'public/livelli'), { recursive: true });
  await cmd('Emulation.setDeviceMetricsOverride', { width: FRAME_W, height: H, deviceScaleFactor: 1, mobile: false });
  for (const L of livelli) {
    // inquadratura: tutte le case del livello con un po' d'aria ai lati (almeno 26 m in vista)
    const x0 = Math.min(...L.houses.map((h) => h.x));
    const x1 = Math.max(...L.houses.map((h) => h.x + h.w));
    const vistaW = (Math.max(26, x1 - x0 + 3) * FRAME_W) / W; // si vede solo la fascia centrale larga W su FRAME_W
    await cmd('Page.navigate', { url: `http://localhost:5173/?level=${L.id}&salta=testi&qualita=alta` });
    await dorme(600);
    for (let i = 0; i < 50 && !(await ev('!!window.xmas')); i++) await dorme(200);
    await ev(`(async () => {
      const g = xmas.game; g.endIntro();
      const st = document.createElement('style');
      st.textContent = '#controls,#hud,#audio-pannello,#rotate,#ios-hint{display:none!important} body{display:block!important;background:#0b1230!important} #frame{border-radius:0!important;box-shadow:none!important;width:${FRAME_W}px!important;height:${H}px!important;position:absolute;top:0;left:0}';
      document.head.append(st);
      window.dispatchEvent(new Event('resize'));
      g.camera.setTarget(${(x0 + x1) / 2}, ${vistaW}, 50);
      await new Promise((r) => setTimeout(r, 1800));
    })()`);
    const r = await cmd('Page.captureScreenshot', { format: 'webp', quality: 82, clip: { x: (FRAME_W - W) / 2, y: H - TAGLIO, width: W, height: TAGLIO, scale: 1 } });
    const file = join(ROOT, `public/livelli/${L.id}.webp`);
    writeFileSync(file, Buffer.from(r.data, 'base64'));
    console.log('scritto', file, Math.round(Buffer.from(r.data, 'base64').length / 1024), 'kB');
  }
} finally {
  ws.close();
  chrome.kill();
}
