// Registra la musica del gioco in un file: sintetizza l'arrangiamento (src/audio/arrangiamento.js) con un
// OfflineAudioContext dentro Chrome headless (più veloce del tempo reale), rende il ciclo senza stacchi
// (le code oltre la fine si sommano all'inizio, gli anticipi prima dell'inizio si sommano alla fine),
// salva un WAV e lo codifica in AAC con afconvert (macOS) in public/audio/musica.m4a.
// Prerequisiti: `npm run dev` attivo su :5173. Uso: node tools/audio/registra-musica.mjs
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SR = 44100;
const KBPS = 48;
const tmp = mkdtempSync(join(tmpdir(), 'xmas-musica-'));

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${tmp}/prof`, '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { stdio: 'ignore' });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) {
  try {
    tabs = await (await fetch('http://localhost:9334/json')).json();
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
const ev = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r?.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r?.result?.value;
};

try {
  await cmd('Page.navigate', { url: 'http://localhost:5173/tools/audio/vuota.html' });
  await dorme(1500);
  const info = await ev(`(async () => {
    const A = await import('/src/audio/arrangiamento.js');
    const { AUDIO } = await import('/src/config.js');
    const sr = ${SR};
    const bar = (4 * 60) / AUDIO.tempo;
    const L = A.BATTUTE * A.GIRI * bar; // durata musicale del ciclo (s)
    const pre = 0.25, coda = 3;
    const N = Math.round(L * sr), P = Math.round(pre * sr), T = Math.round(coda * sr);
    const off = new OfflineAudioContext(1, P + N + T, sr);
    const out = off.createGain();
    out.connect(off.destination);
    const rumore = off.createBuffer(1, sr, sr);
    const dr = rumore.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < sr; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; dr[i] = (s / 0x3fffffff - 1) * 0.9; }
    const m = { ctx: off, mus: out, sfx: out, rumore };
    for (let g = 0; g < A.GIRI; g++) for (let i = 0; i < A.BATTUTE; i++) A.suonaBattuta(m, i, g, pre + (g * A.BATTUTE + i) * bar);
    const d = (await off.startRendering()).getChannelData(0);
    // ciclo chiuso: r[k] = suono nel ciclo + coda del ciclo precedente + anticipi del ciclo successivo
    const r = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      let v = d[P + k];
      if (k < T) v += d[P + N + k];
      if (k >= N - P) v += d[k - (N - P)];
      r[k] = v;
    }
    let picco = 0;
    for (let k = 0; k < N; k++) picco = Math.max(picco, Math.abs(r[k]));
    const scala = picco > 0.95 ? 0.95 / picco : 1; // niente saturazione: il gioco compensa con AUDIO.musicaGuadagno
    const pcm = new Int16Array(N);
    for (let k = 0; k < N; k++) pcm[k] = Math.max(-32767, Math.min(32767, Math.round(r[k] * scala * 32767)));
    // in base64 a pezzi (messaggi DevTools non enormi)
    const by = new Uint8Array(pcm.buffer);
    window.__pezzi = [];
    for (let o = 0; o < by.length; o += 1 << 20) {
      let bin = '';
      const p = by.subarray(o, o + (1 << 20));
      for (let i = 0; i < p.length; i += 8192) bin += String.fromCharCode.apply(null, p.subarray(i, i + 8192));
      window.__pezzi.push(btoa(bin));
    }
    return { L, N, picco, scala, pezzi: window.__pezzi.length };
  })()`);
  console.log('ciclo', info.L.toFixed(3), 's, picco', info.picco.toFixed(3), 'scala', info.scala.toFixed(3));
  const parti = [];
  for (let i = 0; i < info.pezzi; i++) parti.push(Buffer.from(await ev(`window.__pezzi[${i}]`), 'base64'));
  const pcm = Buffer.concat(parti);
  // intestazione WAV PCM 16 bit mono
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  const wav = join(tmp, 'musica.wav');
  writeFileSync(wav, Buffer.concat([h, pcm]));
  mkdirSync(join(ROOT, 'public/audio'), { recursive: true });
  const m4a = join(ROOT, 'public/audio/musica.m4a');
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(KBPS * 1000), '-q', '127', wav, m4a]);
  console.log('scritto', m4a, 'durata', info.L.toFixed(3), 's — metti AUDIO.musicaDurata =', +info.L.toFixed(4), 'e AUDIO.musicaGuadagno =', +(1 / info.scala).toFixed(3));
} finally {
  ws.close();
  chrome.kill();
}
