import { SNOW, GROUND_Y } from '../config.js';
import { createIceBody } from '../physics/fracture.js';
import { centroid, ccw, GAP } from '../physics/polygon.js';

/**
 * Igloo visto di lato: una cupola di blocchi di neve a cuneo che poggia sul terreno, vuota dentro.
 * Il blocco in cima ha la faccia superiore orizzontale: ci si può mettere un pupazzo,
 * che rende l'igloo un ostacolo alto sulla traiettoria.
 * @param {object} def { x: centro, r: raggio interno, blocks: numero di conci (dispari), y: quota del terreno }
 * @returns {{ bodies, top, cx }} top = quota della faccia superiore del blocco in cima
 */
export function buildIgloo(pw, def) {
  const cx = def.x;
  const ri = def.r ?? 1.2;
  const ro = ri + SNOW.brick.h;
  const N = def.blocks ?? 7; // dispari: c'è un concio in chiave con la faccia superiore orizzontale
  const base = GROUND_Y + (def.y || 0) + GAP;
  const at = (r, a) => ({ x: cx + Math.cos(a) * r, y: base + Math.sin(a) * r });
  const da = GAP / ((ri + ro) / 2) / 2;
  const bodies = [];

  for (let k = 0; k < N; k++) {
    const a0 = Math.PI - (k * Math.PI) / N - (k === 0 ? 0 : da);
    const a1 = Math.PI - ((k + 1) * Math.PI) / N + (k === N - 1 ? 0 : da);
    const world = [at(ri, a1), at(ro, a1), at(ro, a0), at(ri, a0)];
    const c = centroid(ccw(world));
    const local = ccw(world).map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    bodies.push(createIceBody(pw, local, c.x, c.y, 0, 0, false, 'snow'));
  }
  // faccia superiore del concio in chiave (corda esterna)
  const top = base + ro * Math.cos(Math.PI / (2 * N));
  return { bodies, top, cx };
}
