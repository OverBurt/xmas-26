// Controllo di regressione (npm test): ogni livello dell'elenco deve restare stabile
// (svegliato senza urti: spostamento ≤ MAX_CM, nessuna rottura, tutto torna a dormire).
const MAX_CM = 4; // i fortini ad arcate si assestano di qualche cm (ponte di ghiaccio, riempimenti)
import { stability } from './stab.mjs';
const { LEVELS } = await import('../../src/game/levels/index.js', { with: { type: 'json' } }).catch(async () => {
  // Node non importa i JSON senza attributi: carico l'elenco a mano
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../src/game/levels/index.js', import.meta.url), 'utf8');
  const ids = [...src.matchAll(/from '\.\/(.+)\.json'/g)].map((m) => m[1]);
  return { LEVELS: ids.map((id) => JSON.parse(readFileSync(new URL(`../../src/game/levels/${id}.json`, import.meta.url), 'utf8'))) };
});
let ok = true;
for (const L of LEVELS) for (const seed of [1, 2, 3]) {
  const r = stability(L, seed);
  const pass = r.maxCm <= MAX_CM && r.broken === 0 && r.awake === 0;
  ok &&= pass;
  console.log(`${pass ? 'ok ' : 'NO '} ${L.id} seme ${seed}: ${r.maxCm} cm, rotti ${r.broken}, svegli ${r.awake}, corpi ${r.bodies}`);
}
process.exit(ok ? 0 : 1);
