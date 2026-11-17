// Difficoltà delle aperture: tiri validi per casa/apertura sulla griglia completa (3 pacchi × 546).
// Uso: node tools/sim/grid.mjs <levelId> [--noplug] [--seed N] [--json]
import { loadLevel, newGame, removePlugs, shoot, ANGLES, PULLS, GIFT_TYPES, openingKey } from './lib.mjs';

export function grid(level, { plug = true, seed = 1, types = GIFT_TYPES } = {}) {
  const hits = {};
  let direct = 0; // tiri validi tesi (angolo < 35°)
  for (const type of types) for (const a of ANGLES) for (const p of PULLS) {
    const g = newGame(level, seed);
    if (!plug) removePlugs(g);
    const r = shoot(g, type, a, p, { onlyFlight: true });
    if (!r.zone) continue;
    const k = openingKey(r.house, r.zone);
    hits[k] = (hits[k] || 0) + 1;
    if (a < 0.61) direct++;
  }
  return { hits, direct };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const id = args[0];
  const seed = args.includes('--seed') ? +args[args.indexOf('--seed') + 1] : 1;
  const r = grid(loadLevel(id), { plug: !args.includes('--noplug'), seed });
  if (args.includes('--json')) console.log(JSON.stringify(r));
  else {
    console.log(`${id}${args.includes('--noplug') ? ' (senza neve)' : ''}: tiri validi tesi ${r.direct}`);
    for (const [k, v] of Object.entries(r.hits).sort()) console.log(`  ${k.padEnd(12)} ${v}`);
  }
}
