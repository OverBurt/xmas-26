// Misura dei consumi sul telefono: per ogni configurazione ricarica il gioco con una parte del disegno spenta
// (`?salta=`), arriva all'inquadratura di mira e misura per DURATA secondi (con --solo "a,b" solo le configurazioni nominate):
//  - CPU dei processi (da `top`, % di un core: 100 = un core pieno): pagina (renderer), processo grafico di
//    Chrome (GPU), browser, e il compositore di Android (surfaceflinger)
//  - lavoro del thread principale della pagina (DevTools: TaskDuration / tempo, % di un core)
//  - FPS e ms medi di disegno del gioco
// L'audio è acceso in tutte le configurazioni tranne "senza audio". Con --giri N le configurazioni si ripetono
// alternate e alla fine si stampa la mediana di ogni valore.
// Prerequisiti: come cdp.mjs (adb, `adb forward tcp:9222 ...`, `adb reverse tcp:5173 ...`), telefono sbloccato
// e in orizzontale, gioco aperto in Chrome. Uso: node tools/phone/consumi.mjs [--crollo] [--giri 2]
import { execSync } from 'node:child_process';

const DURATA = 6; // s di misura per configurazione
const args = process.argv.slice(2);
const CROLLO = args.includes('--crollo'); // misura durante un tiro che fa crollare il fortino invece che a scena ferma
const GIRI = args.includes('--giri') ? +args[args.indexOf('--giri') + 1] : 1;

const PARTI = ['sfondo', 'terreno', 'pini', 'case', 'decor', 'alberi', 'renne', 'corpi', 'particelle', 'slitta', 'neve', 'testi'];
const SOLO = args.includes('--solo') ? args[args.indexOf('--solo') + 1].split(',') : null; // es. --solo "tutto acceso,senza audio"
const TUTTE = [
  { nome: 'tutto acceso', salta: '' },
  ...PARTI.map((p) => ({ nome: `senza ${p}`, salta: p })),
  { nome: 'senza audio', salta: '', muto: true },
  { nome: 'solo cielo (tutto spento)', salta: PARTI.join(',') },
  { nome: 'pagina vuota', url: 'about:blank' },
];
const CONF = SOLO ? TUTTE.filter((c) => SOLO.includes(c.nome)) : TUTTE;

const tabs = await (await fetch('http://localhost:9222/json')).json();
const page = tabs.find((t) => t.type === 'page' && t.url.includes('localhost:5173'));
if (!page) throw new Error('Nessuna scheda del gioco aperta in Chrome sul telefono');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const attese = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (attese.has(m.id)) {
    attese.get(m.id)(m.result);
    attese.delete(m.id);
  }
});
const cdp = (method, params = {}) =>
  new Promise((r) => {
    attese.set(++id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;
const arrot = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(1)]));
const dorme = (s) => new Promise((r) => setTimeout(r, s * 1000));
const metrica = async () => {
  const { metrics } = await cdp('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
};
/** CPU media (% di un core) per gruppo di processi nell'intervallo, dal secondo campione di top. */
const cpuProcessi = (sec) => {
  const out = execSync(`adb shell top -b -d ${sec} -n 2 -o %CPU,ARGS`, { encoding: 'utf8' });
  const blocchi = out.split(/^Tasks:/m);
  const ultimo = blocchi[blocchi.length - 1];
  const g = { pagina: 0, gpu: 0, browser: 0, sf: 0 };
  for (const riga of ultimo.split('\n')) {
    const m = riga.trim().match(/^([\d.]+)\s+(\S+)/);
    if (!m) continue;
    const [v, nome] = [+m[1], m[2]];
    if (nome.startsWith('com.android.chrome:sandboxed_process')) g.pagina += v;
    else if (nome.startsWith('com.android.chrome:privileged_process')) g.gpu += v;
    else if (nome === 'com.android.chrome') g.browser += v;
    else if (nome.includes('surfaceflinger')) g.sf += v;
  }
  return g;
};

await cdp('Performance.enable');
const [w, h] = execSync('adb shell wm size', { encoding: 'utf8' }).match(/(\d+)x(\d+)/).slice(1).map(Number);
const centro = `${Math.max(w, h) / 2} ${Math.min(w, h) / 2}`; // orizzontale

const righe = [];
for (let giro = 0; giro < GIRI; giro++) {
  for (const c of CONF) {
    const url = c.url || `http://localhost:5173/?level=borgo-addormentato&debug${c.salta ? `&salta=${c.salta}` : ''}`;
    await cdp('Page.navigate', { url });
    await dorme(3.5);
    if (c.url) {
      const cpu = cpuProcessi(DURATA);
      const r = { conf: c.nome, ...arrot(cpu), totale: +(cpu.pagina + cpu.gpu + cpu.browser).toFixed(1) };
      righe.push(r);
      console.log(JSON.stringify(r));
      continue;
    }
    execSync(`adb shell input tap ${centro}`); // schermo intero (il primo tocco serve solo a questo)
    await dorme(1);
    execSync(`adb shell input tap ${centro}`); // sblocca l'audio e salta l'intro
    await dorme(1);
    await js(`(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 60 && xmas.game.state !== 'ready'; i++) { xmas.game.endIntro?.(); await w(150); } return xmas.game.state; })()`);
    // audio acceso, spento solo dove richiesto (si guarda la preferenza di muto, non lo stato del contesto,
    // che subito dopo il tocco può non essere ancora partito)
    const muto = await js('!!xmas.audio?.motore?.muto');
    if (!!c.muto !== muto) await js('xmas.audio.commuta()');
    await dorme(2);
    if (CROLLO) await js("xmas.fire('big', 0.45, 2.0)");
    await js('xmas.perf.reset()');
    const m0 = await metrica();
    const t0 = Date.now();
    const cpu = cpuProcessi(DURATA);
    const m1 = await metrica();
    const dt = (Date.now() - t0) / 1000;
    const pg = await js(`(() => { const h = document.getElementById('hud').textContent; const fps = +h.match(/FPS (\\d+)/)[1];
      const hz = +h.match(/\\((\\d+) Hz/)[1];
      return { fps, hz, disegno: xmas.perf.renderMs / Math.max(1, xmas.perf.frames), audio: !!xmas.audio?.motore?.attivo }; })()`);
    const r = {
      conf: c.nome,
      ...arrot(cpu),
      totale: +(cpu.pagina + cpu.gpu + cpu.browser).toFixed(1),
      threadPagina: +((100 * (m1.TaskDuration - m0.TaskDuration)) / dt).toFixed(1),
      script: +((100 * (m1.ScriptDuration - m0.ScriptDuration)) / dt).toFixed(1),
      fps: pg.fps,
      hz: pg.hz,
      disegnoMs: +pg.disegno.toFixed(2),
      audio: pg.audio,
    };
    righe.push(r);
    console.log(JSON.stringify(r));
  }
}
ws.close();

// mediane per configurazione
if (GIRI > 1) {
  console.log('\nMEDIANE');
  const med = (a) => {
    const b = [...a].sort((x, y) => x - y);
    return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
  };
  for (const c of CONF) {
    const rr = righe.filter((r) => r.conf === c.nome);
    const out = { conf: c.nome };
    for (const k of Object.keys(rr[0])) if (typeof rr[0][k] === 'number') out[k] = +med(rr.map((r) => r[k])).toFixed(2);
    console.log(JSON.stringify(out));
  }
}
