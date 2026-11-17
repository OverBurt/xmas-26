import { Polygon, Vec2 } from 'planck';
import { GROUND_Y } from '../config.js';

/**
 * Collina innevata: altopiano piatto tra x0 e x1 alto h, con pendii ai lati (larghi `slope`).
 * Serve a mettere le case a quote diverse. Corpo statico.
 */
export function buildHill(pw, def) {
  const { x0, x1, h, slope = 3 } = def;
  const g = GROUND_Y;
  const poly = [
    { x: x0 - slope, y: g },
    { x: x1 + (def.slopeR ?? slope), y: g },
    { x: x1, y: g + h },
    { x: x0, y: g + h },
  ];
  const body = pw.world.createBody({ type: 'static' });
  body.createFixture({ shape: new Polygon(poly.map((p) => new Vec2(p.x, p.y))), friction: 0.9 });
  body.setUserData({ kind: 'hill' });
  return { body, poly };
}
