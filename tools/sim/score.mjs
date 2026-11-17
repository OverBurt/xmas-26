// Genera i punti delle aperture di un livello dalla difficoltà misurata (formula unica, neve compresa)
// e la soglia della prima stella (due consegne qualunque = le due aperture meno pagate).
// Salva anche la griglia dei tiri (out/<id>-grid.json) usata da play.mjs.
// Uso: node tools/sim/score.mjs <levelId> [--dry]
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadLevel, levelPath, newGame, shoot, ANGLES, PULLS, GIFT_TYPES, openingKey, CFG } from './lib.mjs';

const SEEDS = [1, 2]; // media su due semi: le fratture sono casuali

export function measure(level) {
  const hits = {};
  const cells = []; // {type, ai, pi, house, zone} per play.mjs (primo seme)
  for (const seed of SEEDS) for (const type of GIFT_TYPES) ANGLES.forEach((a, ai) => PULLS.forEach((p, pi) => {
    const g = newGame(level, seed);
    const r = shoot(g, type, a, p, { onlyFlight: true });
    if (!r.zone) return;
    const k = openingKey(r.house, r.zone);
    hits[k] = (hits[k] || 0) + 1 / SEEDS.length;
    if (seed === SEEDS[0]) cells.push({ type, ai, pi, house: r.house, zone: r.zone });
  }));
  return { hits, cells };
}

export function pointsFor(h) {
  const S = CFG.SCORE;
  const raw = h > 0 ? S.refPoints * (S.refHits / h) ** S.exponent : S.maxPoints;
  return Math.max(S.minPoints, Math.min(S.maxPoints, Math.round(raw / 50) * 50));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  const level = loadLevel(id);
  const { hits, cells } = measure(level);
  const all = [];
  level.houses.forEach((h, i) => {
    const set = (zone, obj) => {
      const n = hits[openingKey(i, zone)] || 0;
      obj.points = pointsFor(n);
      all.push(obj.points);
      console.log(`  ${openingKey(i, zone).padEnd(12)} tiri validi ${n.toFixed(1).padStart(6)} → ${obj.points}`);
    };
    if (h.door) set('door', h.door);
    for (const w of h.windows || []) set('window', w);
    if (h.chimney) set('chimney', h.chimney);
  });
  all.sort((a, b) => a - b);
  level.stars[0] = all[0] + all[1];
  console.log(`  prima stella (due consegne meno pagate): ${level.stars[0]}`);
  mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/${id}-grid.json`, import.meta.url), JSON.stringify(cells));
  if (!process.argv.includes('--dry')) writeFileSync(levelPath(id), JSON.stringify(level, null, 2) + '\n');
}
