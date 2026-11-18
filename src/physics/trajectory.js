import { GRAVITY, PHYSICS_DT, TRAJECTORY } from '../config.js';

/**
 * Anteprima della traiettoria con lo stesso integratore di Box2D/Planck
 * (Euler semi-implicito: prima la velocità, poi la posizione, stesso dt),
 * così i punti coincidono con il volo reale fino al primo urto.
 * Si ferma al terreno o al bordo destro del livello. Restituisce un array piatto [x0,y0,x1,y1,...].
 */
export function predictTrajectory(x, y, vx, vy, steps = TRAJECTORY.steps, groundY = 0, maxX = Infinity, maxDist = Infinity) {
  const out = [];
  const x0 = x;
  const y0 = y;
  const d2 = maxDist * maxDist;
  for (let i = 1; i <= steps; i++) {
    vy += GRAVITY * PHYSICS_DT;
    x += vx * PHYSICS_DT;
    y += vy * PHYSICS_DT;
    if (y < groundY || x > maxX) break;
    // oltre `maxDist` metri dal punto di lancio non si mostra più niente (non dipende dalla forza del tiro)
    if ((x - x0) ** 2 + (y - y0) ** 2 > d2) break;
    if (i % TRAJECTORY.dotEvery === 0) out.push(x, y);
  }
  return out;
}
