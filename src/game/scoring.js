import { SCORE, TURN } from '../config.js';
import { zoneAt } from '../entities/house.js';
import { shatterGlass } from './contacts.js';

/**
 * Regole di consegna e punteggio.
 * @typedef {import('./game.js').Game} Game
 */

/** Punteggio totale: consegne + neve/ghiaccio rotto (in base alla superficie) + cristalli + bonus − renne colpite. */
export function totalScore(g) {
  return Math.max(0, g.deliveryScore + breakScore(g) + crystals(g) * SCORE.crystal + g.bonus - g.penalty);
}

export function breakScore(g) {
  return Math.round(g.fracture.brokenArea * SCORE.perArea);
}

export function crystals(g) {
  return g.trees.reduce((n, t) => n + t.knocked, 0);
}

/** Consegna di un pacco in un'apertura: punti, valore ridotto per la prossima volta, effetti. Evento 'consegna'. */
export function deliver(g, body, house, zone) {
  const p = body.getPosition();
  // Porta o finestra: il vetro si rompe sempre con la consegna (anche se il pacco è entrato nella zona prima
  // di toccarlo, o l'ha attraversato in un solo step perché velocissimo)
  const vetro = zone.pane?.getUserData();
  if (vetro && !vetro.broken) {
    vetro.broken = true;
    const v = body.getLinearVelocity();
    g.glassQueue.push({ pane: zone.pane, by: body, vx: v.x, vy: v.y });
    shatterGlass(g);
  }
  const pts = zone.points;
  g.deliveryScore += pts;
  g.deliveries.push({ type: zone.type, points: pts });
  // La prossima consegna nella stessa apertura vale meno (arrotondata a 10)
  zone.count++;
  zone.points = Math.max(10, Math.round((zone.base * SCORE.repeat ** zone.count) / 10) * 10);
  house.served++;
  g.deliveredThisTurn = true;
  // niente bagliore sull'apertura: il punteggio vola via ben visibile (hudDraw.js)
  g.floaters.push({ text: `+${pts.toLocaleString('it-IT')}`, x: p.x, y: p.y + 0.6, t: 0, big: true, vx: (p.x < house.def.x ? -1 : 1) * SCORE.floaterDrift })
  g.particles.burst(p.x, p.y, 18, 3, '#ffd36b');
  const x = p.x;
  const y = p.y;
  g.pw.destroyBody(body);
  if (body === g.current) g.current = null;
  g.emit('consegna', { tipo: zone.type, punti: pts, casa: g.houses.indexOf(house), ripetizione: zone.count, x, y });
}

/**
 * Dopo lo step: consegne dal bordo interno del camino (in coda dalle callback), pacchi entrati in una
 * zona di consegna, pacchi usciti dal mondo.
 */
export function checkDeliveries(g) {
  for (const d of g.pendingDeliveries) {
    if (!g.thrown.includes(d.gift)) continue; // già consegnato o uscito
    deliver(g, d.gift, d.house, d.zone);
    g.thrown = g.thrown.filter((x) => x !== d.gift);
  }
  g.pendingDeliveries = [];

  const b = g.level.bounds;
  const m = TURN.outMargin;
  g.thrown = g.thrown.filter((gift) => {
    const p = gift.getPosition();
    for (const h of g.houses) {
      const z = zoneAt(h, p.x, p.y);
      if (z) {
        deliver(g, gift, h, z);
        return false;
      }
    }
    if (p.y > -m && p.x > b.minX - m && p.x < b.maxX + m) return true;
    g.pw.destroyBody(gift);
    if (gift === g.current) g.current = null;
    return false;
  });
}

/** Riepilogo di fine livello (assegna il bonus "tutte le case servite"). */
export function summarize(g) {
  // Premio per aver servito tutte le case (almeno una consegna ciascuna).
  const allServed = g.houses.every((h) => h.served > 0);
  if (allServed) g.bonus = SCORE.allServedBonus;
  const score = totalScore(g);
  const stars = g.level.stars.filter((t) => score >= t).length;
  const nCrystals = crystals(g);
  return {
    score,
    stars,
    delivered: g.deliveries.length,
    thrown: g.stats.shots,
    deliveryScore: g.deliveryScore,
    ice: g.fracture.broken,
    iceScore: breakScore(g),
    crystals: nCrystals,
    crystalScore: nCrystals * SCORE.crystal,
    bonus: g.bonus,
    penalty: g.penalty,
    reindeerHits: g.reindeer.reduce((n, r) => n + r.hits, 0),
    allServed,
    served: g.houses.filter((h) => h.served > 0).length,
    houses: g.houses.length,
  };
}
