import { buildHouse } from '../entities/house.js';
import { buildSnowFort } from '../entities/snowFort.js';
import { buildSnowman } from '../entities/snowman.js';
import { SnowTree } from '../entities/snowTree.js';
import { buildHill } from '../entities/hill.js';
import { buildPine } from '../entities/pine.js';
import { buildCardCastle } from '../entities/cardCastle.js';
import { buildReindeer } from '../entities/reindeer.js';
import { buildIgloo } from '../entities/igloo.js';

/**
 * Costruisce nel mondo fisico tutti gli oggetti del livello (JSON in src/game/levels/).
 * L'ordine di costruzione è parte del comportamento: alcuni costruttori usano il generatore con seme
 * (src/core/rng.js), quindi cambiarlo cambia i livelli (e le misure di tools/sim).
 * @returns {{forts, slabs, trees, hills, pines, reindeer, houses}}
 *   slabs = corpi che si rompono / svaniscono: neve, ghiaccio, pupazzi (poi anche schegge di vetro)
 */
export function buildLevel(pw, L) {
  const forts = (L.forts || []).map((f) => buildSnowFort(pw, f));
  const slabs = forts.flatMap((f) => f.bodies);
  // Castelli di carte (prova): tende di lastre di ghiaccio e blocchi di neve orizzontali
  for (const cc of L.cardCastles || []) slabs.push(...buildCardCastle(pw, cc).bodies);
  const trees = (L.trees || []).map((t) => new SnowTree(pw, t));
  // Igloo, eventualmente con un pupazzo in cima
  for (const ig of L.igloos || []) {
    const igloo = buildIgloo(pw, ig);
    slabs.push(...igloo.bodies);
    if (ig.snowman) slabs.push(buildSnowman(pw, igloo.cx, igloo.top));
  }
  const hills = (L.hills || []).map((h) => buildHill(pw, h));
  const pines = (L.pines || []).map((p) => buildPine(pw, p));
  const reindeer = (L.reindeer || []).map((r) => buildReindeer(pw, r));
  for (const sm of L.snowmen || []) {
    // "fort": indice di un fortino → il pupazzo sta in cima: su uno spalto ("side": 0 sinistro, 1 destro)
    // oppure al centro (+ "dx"); con "cima": true sopra la scultura di ghiaccio; senza "fort" sta a terra in "x"
    const f = sm.fort !== undefined ? forts[sm.fort] : null;
    if (sm.fort !== undefined && !f) continue;
    const ledge = f && sm.side !== undefined ? f.ledges[sm.side] : null;
    const x = ledge ? (ledge.x0 + ledge.x1) / 2 : f ? (f.x0 + f.x1) / 2 + (sm.dx || 0) : sm.x;
    slabs.push(buildSnowman(pw, x, f ? (sm.cima && f.iceTop !== undefined ? f.iceTop : f.top) : sm.y || 0));
  }
  const houses = L.houses.map((h) => buildHouse(pw, h));
  // Valore delle aperture: base dal JSON, cala a ogni consegna ripetuta (SCORE.repeat, vedi scoring.js)
  for (const h of houses) for (const z of h.zones) {
    z.base = z.points;
    z.count = 0;
  }
  for (const h of houses) slabs.push(...h.plugs);
  return { forts, slabs, trees, hills, pines, reindeer, houses };
}
