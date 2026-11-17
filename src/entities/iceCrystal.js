import { Settings } from 'planck';
import { createIceBody } from '../physics/fracture.js';

const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

/**
 * Cristallo di ghiaccio: prisma a base piatta (sta in piedi) con la punta a "matita",
 * eventualmente inclinata (`skew`). È un corpo solido di ghiaccio: colpito forte si frantuma
 * in schegge come le lastre.
 */
function crystalPoly(w, h, skew) {
  return [
    { x: -w / 2, y: 0 },
    { x: w / 2, y: 0 },
    { x: w / 2 + skew * 0.7, y: h * 0.68 },
    { x: skew, y: h },
    { x: -w / 2 + skew * 0.7, y: h * 0.68 },
  ];
}

function crystal(pw, x, y, w, h, skew) {
  const poly = crystalPoly(w, h, skew);
  // corpo centrato più o meno nel baricentro: lo spostiamo di h/3
  const cy = h * 0.4;
  const local = poly.map((p) => ({ x: p.x, y: p.y - cy }));
  const b = createIceBody(pw, local, x, y + cy + GAP, 0, 0, false, 'ice');
  b.getUserData().crystal = true;
  return b;
}

/**
 * Grappolo di cristalli: uno alto al centro e due più bassi ai lati, con le punte
 * che si aprono verso l'esterno. `scale` ne regola la grandezza.
 */
export function buildCrystalCluster(pw, cx, y, scale = 1) {
  const w = 0.24 * scale;
  return [
    crystal(pw, cx - w * 1.05, y, w * 0.9, 0.75 * scale, -0.12 * scale),
    crystal(pw, cx, y, w, 1.15 * scale, 0),
    crystal(pw, cx + w * 1.05, y, w * 0.9, 0.85 * scale, 0.12 * scale),
  ];
}
