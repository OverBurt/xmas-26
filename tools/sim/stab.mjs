// Stabilità: sveglia tutte le strutture senza urti, 8 s, spostamento massimo, rotture, corpi ancora svegli.
// Uso: node tools/sim/stab.mjs <levelId> [seed...]
import { loadLevel, newGame } from './lib.mjs';

export function stability(level, seed = 1) {
  const g = newGame(level, seed);
  const start = new Map(g.slabs.map((b) => [b, b.getPosition().clone()]));
  for (const b of g.slabs) b.setAwake(true);
  for (let i = 0; i < 480; i++) g.step(1 / 60);
  let max = 0;
  for (const [b, p] of start) if (!b.getUserData().dead) max = Math.max(max, Math.hypot(b.getPosition().x - p.x, b.getPosition().y - p.y));
  return { maxCm: +(max * 100).toFixed(1), broken: g.fracture.broken, awake: g.pw.counts().awake, bodies: g.pw.counts().dynamic };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [id, ...seeds] = process.argv.slice(2);
  for (const s of seeds.length ? seeds.map(Number) : [1, 2, 3, 4, 5]) console.log(id, 'seme', s, stability(loadLevel(id), s));
}
