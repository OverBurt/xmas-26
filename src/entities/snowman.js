import { Box, Circle, Vec2 } from 'planck';
import { GAP } from '../physics/polygon.js';
import { SNOW, SNOWMAN } from '../config.js';
import { random } from '../core/rng.js';

const SCARVES = ['#e2453c', '#2f9e6b', '#3a6fd8', '#f0a91c'];
const OVERLAP = 0.12; // le palle sono un po' "schiacciate" l'una sull'altra

/**
 * Pupazzo di neve: un solo corpo con tre palle e una base piatta (sta in piedi),
 * finché un colpo non lo separa in palle che rotolano (vedi Fracture.splitSnowman).
 * @param {number} x centro, @param {number} y base d'appoggio
 */
export function buildSnowman(pw, x, y) {
  const [r0, r1, r2] = SNOWMAN.radii;
  const body = pw.world.createBody({ type: 'dynamic', position: new Vec2(x, y + GAP), awake: false });
  const fx = { density: SNOW.density, friction: SNOW.friction, restitution: SNOW.restitution };

  const y0 = r0 + 0.03;
  const y1 = y0 + r0 + r1 - OVERLAP;
  const y2 = y1 + r1 + r2 - OVERLAP;
  body.createFixture({ shape: new Box(r0 * 0.7, 0.06, new Vec2(0, 0.06)), ...fx, userData: { role: 'foot' } });
  body.createFixture({ shape: new Circle(new Vec2(0, y0), r0), ...fx, userData: { role: 'base' } });
  body.createFixture({ shape: new Circle(new Vec2(0, y1), r1), ...fx, userData: { role: 'mid' } });
  body.createFixture({ shape: new Circle(new Vec2(0, y2), r2), ...fx, userData: { role: 'head' } });

  body.setUserData({
    kind: 'snowman',
    level: 0,
    flash: 0,
    deco: { scarf: SCARVES[Math.floor(random() * SCARVES.length)], facing: -1 },
  });
  return body;
}
