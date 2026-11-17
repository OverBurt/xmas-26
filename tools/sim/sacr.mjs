// "Sacrifico un lancio": quanti tiri standard diventano validi dopo un primo lancio di demolizione?
// Uso: node tools/sim/sacr.mjs <levelId> [tipo angolo tensione]...  (default: alcuni lanci del pacco grande)
import { loadLevel, newGame, shoot, ANGLES, PULLS } from './lib.mjs';

export function afterSacrifice(level, pre, seed = 7) {
  let ok = 0, pts = 0, n = 0, broken = 0, preZone = null;
  for (let i = 0; i < ANGLES.length; i += 1) for (let j = 0; j < PULLS.length; j += 2) {
    const g = newGame(level, seed);
    if (pre) { const r = shoot(g, ...pre); broken = r.broken; preZone = r.zone; }
    const r = shoot(g, 'standard', ANGLES[i], PULLS[j], { onlyFlight: true });
    n++;
    if (r.zone) { ok++; pts += r.points; }
  }
  return { ok, n, ptsPerShot: Math.round(pts / n), broken, preZone };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [id, ...rest] = process.argv.slice(2);
  const L = loadLevel(id);
  const pres = [];
  for (let i = 0; i + 2 < rest.length; i += 3) pres.push([rest[i], +rest[i + 1], +rest[i + 2]]);
  const list = [null, ...(pres.length ? pres : [['big', 0.2, 2.2], ['big', 0.35, 2.2], ['big', 0.5, 2.2]])];
  const base = afterSacrifice(L, null);
  for (const pre of list) {
    const r = pre ? afterSacrifice(L, pre) : base;
    console.log(`${pre ? pre.join(' ') : 'nessun sacrificio'}: validi ${r.ok}/${r.n} (×${(r.ok / base.ok).toFixed(2)}), punti medi ${r.ptsPerShot}${pre ? `, rotti ${r.broken}, consegna ${r.preZone}` : ''}`);
  }
}
