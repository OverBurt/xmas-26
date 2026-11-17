// Utilità comuni per le simulazioni di misura (headless, con la classe Game del gioco).
// Seme fisso → risultati riproducibili (vedi src/core/rng.js).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const { Game } = await import(ROOT + 'src/game/game.js');
export const { setSeed } = await import(ROOT + 'src/core/rng.js');
export const CFG = await import(ROOT + 'src/config.js');
export const levelPath = (id) => `${ROOT}src/game/levels/${id}.json`;
export const loadLevel = (id) => JSON.parse(readFileSync(levelPath(id), 'utf8'));

/** Griglia di tiri: angolo 0.1–1.35 rad × tensione 1.2–2.2 m (546 combinazioni per pacco). */
export const ANGLES = Array.from({ length: 26 }, (_, i) => 0.1 + i * 0.05);
export const PULLS = Array.from({ length: 21 }, (_, i) => 1.2 + i * 0.05);
export const GIFT_TYPES = ['small', 'standard', 'big'];

export function newGame(level, seed = 1) {
  setSeed(seed);
  const g = new Game(level);
  g.endIntro();
  return g;
}

/** Toglie la neve che tappa le aperture (stato "dopo che un lancio l'ha spazzata via"). */
export function removePlugs(g) {
  for (const h of g.houses) for (const p of h.plugs) {
    g.pw.destroyBody(p);
    g.slabs = g.slabs.filter((s) => s !== p);
  }
}

/**
 * Lancio completo (volo + assestamento) con angolo (rad sopra l'orizzontale) e tensione (m).
 * Restituisce {zone, house, points, tDeliver, broken, steps} oppure null se il pacco non c'è.
 */
export function shoot(g, type, angle, pull, { onlyFlight = false } = {}) {
  const gift = g.sleigh.gifts.find((x) => x.type === type);
  if (!gift || g.state !== 'ready') return null;
  g.sleigh.take(gift);
  const dx = -Math.cos(angle) * pull;
  const dy = -Math.sin(angle) * pull;
  const P = CFG.SLING.power;
  const n0 = g.deliveries.length;
  const b0 = g.fracture.broken;
  const served0 = g.houses.map((h) => h.served);
  g.launch({ gift, x: g.sling.x + dx, y: g.sling.y + dy, vx: -dx * P, vy: -dy * P });
  let steps = 0;
  let tDeliver = null;
  while ((g.state === 'flight' || (!onlyFlight && g.state === 'settle')) && steps < 1800) {
    g.step(1 / 60);
    steps++;
    if (tDeliver === null && g.deliveries.length > n0) {
      tDeliver = steps / 60;
      if (onlyFlight) break;
    }
  }
  const d = g.deliveries[n0] ?? null;
  return { zone: d?.type ?? null, points: d?.points ?? 0, house: g.houses.findIndex((h, i) => h.served > served0[i]), tDeliver, broken: g.fracture.broken - b0, steps };
}

/** Nome leggibile di un'apertura: "A camino", "B finestra"... */
export const openingKey = (house, zone) => `${'ABCDEFG'[house]} ${zone}`;
