import { Box, Vec2 } from 'planck';
import { GIFTS, GIFT_FRICTION, GIFT_RESTITUTION } from '../config.js';

/** Crea un pacco già in volo. `bullet` attiva la CCD contro il tunneling. */
export function launchGift(pw, type, x, y, vx, vy) {
  const def = GIFTS[type];
  const body = pw.world.createBody({
    type: 'dynamic',
    position: new Vec2(x, y),
    bullet: true,
  });
  body.createFixture({
    shape: new Box(def.w / 2, def.h / 2),
    density: def.density,
    friction: GIFT_FRICTION,
    restitution: GIFT_RESTITUTION,
  });
  body.setLinearVelocity(new Vec2(vx, vy));
  body.setAngularVelocity(-1.5); // leggera rotazione in volo
  body.setUserData({ kind: 'gift', type, hw: def.w / 2, hh: def.h / 2, color: def.color });
  return body;
}
