import { Vec2 } from 'planck';
import { GLASS, HOUSE, REINDEER, SCORE } from '../config.js';
import { createIceBody, prefracture } from '../physics/fracture.js';
import { centroid } from '../physics/polygon.js';
import { random } from '../core/rng.js';

/**
 * Regole legate ai contatti fisici: vetri che si infrangono, consegna dal bordo interno del camino,
 * renne spaventate, rottura di neve/ghiaccio.
 *
 * Regola: dentro le callback di contatto il mondo Planck NON si modifica (né si emettono eventi, perché
 * un ascoltatore potrebbe farlo): tutto va in coda e viene applicato dopo pw.step() da Game.step
 * (shatterGlass, g.pendingDeliveries, g.contactEvents, Fracture.process).
 * Il WorldManifold è quello riusato di PhysicsWorld (pw.wm): nessuna allocazione per contatto.
 * @param {import('./game.js').Game} g
 */
export function attachContacts(g) {
  const pw = g.pw;
  g.glassQueue = []; // vetri colpiti durante lo step
  g.pendingDeliveries = []; // consegne dal bordo del camino {gift, house, zone}
  g.contactEvents = []; // eventi nati nelle callback ([nome, dati]), emessi dopo lo step

  pw.onPreSolve = (contact) => {
    checkChimneyEdge(g, contact); // anche contatti iniziati fuori che scivolano sullo spigolo
    checkGlass(g, contact);
  };
  pw.onBeginContact = (contact) => {
    checkChimneyEdge(g, contact);
    checkReindeer(g, contact);
  };
  pw.onImpulse = (body, impulse, other, speed) => {
    const ud = body.getUserData();
    if (!ud || (ud.kind !== 'ice' && ud.kind !== 'snow' && ud.kind !== 'snowman')) return;
    if (impulse > g.stats.maxImpulse) g.stats.maxImpulse = impulse;
    g.fracture.hit(body, impulse, other, speed);
  };
}

/** Vetri: il contatto viene annullato (il pacco passa) e il vetro si frantuma dopo lo step. */
function checkGlass(g, contact) {
  let pane = contact.getFixtureA().getBody();
  let other = contact.getFixtureB().getBody();
  if (pane.getUserData()?.kind !== 'glass') [pane, other] = [other, pane];
  const ud = pane.getUserData();
  if (ud?.kind !== 'glass' || !ud.pane || !other.isDynamic()) return;
  if (ud.broken) {
    contact.setEnabled(false);
    return;
  }
  if (!contact.getManifold().pointCount) return; // senza punti Planck non riempie il manifold
  const n = contact.getWorldManifold(g.pw.wm)?.normal;
  if (!n) return;
  const v = other.getLinearVelocity();
  const vn = Math.abs(v.x * n.x + v.y * n.y);
  // Un pacco rompe sempre il vetro di porte e finestre (anche arrivando piano o rotolando);
  // gli altri oggetti (neve, schegge, pupazzi) solo se l'urto supera la soglia.
  const byGift = other.getUserData()?.kind === 'gift';
  if (byGift || other.getMass() * vn > GLASS.breakImpulse) {
    ud.broken = true;
    contact.setEnabled(false);
    g.glassQueue.push({ pane, by: other, vx: v.x, vy: v.y });
  }
}

/** Pacco che tocca il lato interno del camino (spigolo della bocca compreso): consegna in coda. */
function checkChimneyEdge(g, contact) {
  let fx = contact.getFixtureA();
  let gift = contact.getFixtureB().getBody();
  if (fx.getUserData()?.part !== 'chimney') [fx, gift] = [contact.getFixtureB(), fx.getBody()];
  if (fx.getUserData()?.part !== 'chimney' || gift.getUserData()?.kind !== 'gift') return;
  const house = g.houses.find((h) => h.body === fx.getBody());
  const n = contact.getManifold().pointCount;
  if (!house || !n) return;
  const wm = contact.getWorldManifold(g.pw.wm);
  if (!wm) return;
  for (let i = 0; i < n; i++) {
    const p = wm.points[i];
    if (house.chimney.inner.some(([a, b]) => distToSegment(p, a, b) < HOUSE.chimneyEdge)) {
      const zone = house.zones.find((z) => z.type === 'chimney');
      if (!g.pendingDeliveries.some((d) => d.gift === gift)) g.pendingDeliveries.push({ gift, house, zone });
      return;
    }
  }
}

/**
 * Un corpo in movimento che urta una renna la spaventa e toglie punti (solo stato e animazione: il mondo
 * fisico non cambia, quindi si può fare dentro la callback). L'evento 'renna' è accodato ed emesso dopo lo step.
 */
function checkReindeer(g, contact) {
  let a = contact.getFixtureA().getBody();
  let b = contact.getFixtureB().getBody();
  if (a.getUserData()?.kind !== 'reindeer') [a, b] = [b, a];
  const r = a.getUserData()?.reindeer;
  if (!r || !b.isDynamic() || b.getLinearVelocity().length() < REINDEER.minSpeed) return;
  // Già spaventata da un attimo: si misura in tempo fisico (simTime), così l'esito non dipende dalla
  // velocità di riproduzione (accelerazione dei tempi morti) né dal frame rate.
  if (g.simTime - r.spaventata < REINDEER.cooldown) return;
  r.spaventata = g.simTime;
  r.scare = REINDEER.scareTime; // animazione (decresce col tempo reale in game.frame)
  // Ogni oggetto conta una volta sola per renna: un pacco che rimbalza sulla testa non toglie punti due volte
  if (r.hitBy.has(b)) return;
  r.hitBy.add(b);
  r.hits++;
  // Colpire una renna toglie un po' di punti
  g.penalty += SCORE.reindeerPenalty;
  const p = r.body.getPosition();
  g.floaters.push({ text: `−${SCORE.reindeerPenalty}`, x: p.x, y: p.y + 2.6, t: 0, big: false, bad: true });
  g.contactEvents.push(['renna', { renna: r, x: p.x, y: p.y, colpi: r.hits, punti: -SCORE.reindeerPenalty, daPacco: b.getUserData()?.kind === 'gift' }]);
}

/** Frantuma i vetri colpiti durante lo step: schegge dinamiche che svaniscono. Evento 'vetro'. */
export function shatterGlass(g) {
  for (const { pane, by, vx, vy } of g.glassQueue) {
    const ud = pane.getUserData();
    const p = pane.getPosition().clone();
    g.pw.destroyBody(pane);
    for (const h of g.houses) h.panes = h.panes.filter((b) => b !== pane);
    const pieces = (prefracture(ud.poly, 0) || [ud.poly]).flatMap((pc) => prefracture(pc, 0) || [pc]);
    for (const pc of pieces) {
      const c = centroid(pc);
      const local = pc.map((q) => ({ x: q.x - c.x, y: q.y - c.y }));
      const shard = createIceBody(g.pw, local, p.x + c.x, p.y + c.y, 0, 2, true, 'glass');
      shard.setLinearVelocity(new Vec2(vx * GLASS.shardInherit + (random() - 0.5) * 2, vy * GLASS.shardInherit + random() * 1.5));
      shard.setAngularVelocity((random() - 0.5) * 10);
      shard.getUserData().life = GLASS.shardLife + random();
      g.slabs.push(shard);
    }
    g.particles.burst(p.x, p.y, 16, 3.5, '#dff6ff');
    const byGift = by.getUserData()?.kind === 'gift';
    if (byGift) {
      const v = by.getLinearVelocity();
      by.setLinearVelocity(new Vec2(v.x * GLASS.slowdown, v.y * GLASS.slowdown));
    }
    g.emit('vetro', { apertura: ud.opening, x: p.x, y: p.y, daPacco: byGift });
  }
  g.glassQueue = [];
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
