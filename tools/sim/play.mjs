// Partite intere (5 pacchi) con giocatori simulati: sceglie il tiro col miglior valore atteso sulla griglia
// (out/<id>-grid.json, da score.mjs) e lo esegue con un errore gaussiano su angolo e tensione.
// Stampa la distribuzione dei punteggi e, con --stars, scrive le soglie di 2ª e 3ª stella
// (2ª = mediana del giocatore medio, 3ª = suo 90° percentile, arrotondate a 100).
// Uso: node tools/sim/play.mjs <levelId> [N] [--stars]
import { readFileSync, writeFileSync } from 'node:fs';
import { loadLevel, levelPath, newGame, shoot, ANGLES, PULLS, setSeed } from './lib.mjs';

const id = process.argv[2];
const N = +(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 150);
const level = loadLevel(id);
const cells = JSON.parse(readFileSync(new URL(`./out/${id}-grid.json`, import.meta.url), 'utf8'));
const NA = ANGLES.length, NP = PULLS.length;
let rs = 12345;
const rnd = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

// Punti di ogni cella (con i valori attuali del JSON) e media pesata dal rumore del giocatore
const pts = (c) => { const h = level.houses[c.house]; return c.zone === 'door' ? h.door.points : c.zone === 'chimney' ? h.chimney.points : h.windows[0].points; };
function expected(sa, sp) {
  const E = {};
  for (const type of ['small', 'standard', 'big']) {
    const raw = new Float64Array(NA * NP);
    for (const c of cells) if (c.type === type) raw[c.ai * NP + c.pi] = pts(c);
    const out = new Float64Array(NA * NP);
    const ka = sa / 0.05, kp = sp / 0.05;
    for (let a = 0; a < NA; a++) for (let p = 0; p < NP; p++) {
      let s = 0, w = 0;
      for (let a2 = Math.max(0, a - 6); a2 < Math.min(NA, a + 7); a2++) for (let p2 = Math.max(0, p - 6); p2 < Math.min(NP, p + 7); p2++) {
        const k = Math.exp(-0.5 * (((a2 - a) / ka) ** 2 + ((p2 - p) / kp) ** 2)); s += k * raw[a2 * NP + p2]; w += k;
      }
      out[a * NP + p] = s / w;
    }
    E[type] = out;
  }
  return E;
}
function play(E, sa, sp, seed) {
  const g = newGame(level, seed);
  while (g.state === 'ready' && g.sleigh.count) {
    let best = null;
    for (const type of new Set(g.sleigh.gifts.map((x) => x.type))) E[type].forEach((v, c) => { if (!best || v > best.v) best = { v, type, c }; });
    const a = ANGLES[(best.c / NP) | 0] + gauss() * sa;
    const p = Math.max(1, Math.min(2.2, PULLS[best.c % NP] + gauss() * sp));
    shoot(g, best.type, a, p);
  }
  return { score: g.summary?.score ?? g.score, delivered: g.deliveries.length };
}
const q = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f * arr.length))];
const res = {};
for (const [name, sa, sp] of [['esperto', 0.015, 0.03], ['medio', 0.03, 0.06], ['principiante', 0.06, 0.12]]) {
  const E = expected(sa, sp);
  const games = Array.from({ length: N }, (_, i) => play(E, sa, sp, 100 + i));
  const sc = games.map((x) => x.score).sort((a, b) => a - b);
  const two = games.filter((x) => x.delivered >= 2).length;
  res[name] = sc;
  console.log(`${name.padEnd(12)} p10 ${q(sc, 0.1)}  p50 ${q(sc, 0.5)}  p90 ${q(sc, 0.9)}  max ${sc.at(-1)}  | ≥2 consegne ${Math.round((100 * two) / N)}%  consegne medie ${(games.reduce((s, x) => s + x.delivered, 0) / N).toFixed(2)}`);
}
if (process.argv.includes('--stars')) {
  level.stars[1] = Math.round(q(res.medio, 0.5) / 100) * 100;
  level.stars[2] = Math.round(q(res.medio, 0.9) / 100) * 100;
  writeFileSync(levelPath(id), JSON.stringify(level, null, 2) + '\n');
  console.log('soglie stelle', level.stars);
}
const st = level.stars;
for (const name in res) {
  const s = res[name];
  const pct = [0, 1, 2, 3].map((n) => Math.round((100 * s.filter((v) => [0, ...st].filter((t) => v >= t).length - 1 === n).length) / s.length));
  console.log(`  ${name.padEnd(12)} stelle 0/1/2/3 %: ${pct.join('/')}`);
}
setSeed(1);
