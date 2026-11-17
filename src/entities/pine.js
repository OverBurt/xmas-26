import { Polygon, Vec2 } from 'planck';
import { GROUND_Y, PINE } from '../config.js';

/**
 * Pino innevato: corpo statico (il pacco ci rimbalza) fatto di un tronco e tre "piani" triangolari
 * di rami, dal più largo in basso al più stretto in cima. Usato come ostacolo (tra le case)
 * e come cornice ai bordi del livello.
 * Definizione (JSON del livello): { x, y (quota del terreno, default 0), h (altezza, default PINE.h) }
 */
export function buildPine(pw, def) {
  const h = def.h ?? PINE.h;
  const g = GROUND_Y + (def.y || 0);
  const x = def.x;
  const body = pw.world.createBody({ type: 'static' });
  const tw = PINE.trunkW / 2;
  const trunk = [
    { x: x - tw, y: g },
    { x: x + tw, y: g },
    { x: x + tw, y: g + PINE.trunkH },
    { x: x - tw, y: g + PINE.trunkH },
  ];
  body.createFixture({ shape: new Polygon(trunk.map((p) => new Vec2(p.x, p.y))), friction: 0.6, restitution: 0.15 });
  // Tre piani di rami sovrapposti (triangoli convessi)
  const tiers = [];
  const crown = h - PINE.trunkH * 0.6;
  for (let i = 0; i < 3; i++) {
    const y0 = g + PINE.trunkH * 0.6 + crown * 0.27 * i;
    const half = h * PINE.width * 0.5 * (1 - i * 0.24);
    const apex = y0 + crown * (i === 2 ? 0.46 : 0.42);
    const tri = [{ x: x - half, y: y0 }, { x: x + half, y: y0 }, { x, y: apex }];
    tiers.push(tri);
    body.createFixture({ shape: new Polygon(tri.map((p) => new Vec2(p.x, p.y))), friction: 0.6, restitution: 0.15 });
  }
  body.setUserData({ kind: 'pine' });
  return { body, x, g, h, trunk, tiers };
}
