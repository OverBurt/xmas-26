import { Circle, Polygon, Vec2 } from 'planck';
import { GROUND_Y, REINDEER } from '../config.js';

/**
 * Renna (decorazione solida): corpo statico, il pacco ci rimbalza contro e non si rompe.
 * Quando viene colpita si spaventa (balzo, occhi sbarrati, "!") e poi torna alla posa normale;
 * il gioco emette l'evento 'renna' (servirà per il verso quando ci sarà l'audio).
 * Pose: 'bruca' (di fianco, a testa bassa, ogni tanto alza il muso) e 'fronte' (guarda in camera).
 * Le zampe non sono solide: un pacco può passare sotto la pancia.
 * Definizione (JSON del livello, `reindeer`): { x, y (quota del terreno), pose, facing (±1, solo 'bruca') }
 */
export function buildReindeer(pw, def) {
  const g = GROUND_Y + (def.y || 0);
  const v = def.facing ?? 1;
  const pose = def.pose || 'bruca';
  const body = pw.world.createBody({ type: 'static', position: new Vec2(def.x, g) });
  const fx = { friction: 0.5, restitution: REINDEER.restitution };
  if (pose === 'bruca') {
    // tronco: ellisse approssimata da un ottagono
    const torso = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      torso.push(new Vec2(Math.cos(a) * 0.76, 0.98 + Math.sin(a) * 0.42));
    }
    body.createFixture({ shape: new Polygon(torso), ...fx });
    // collo e testa (bassa, verso il terreno)
    const head = [[0.55, 1.25], [0.9, 1.22], [1.62, 0.62], [1.58, 0.16], [1.08, 0.14], [0.55, 0.78]];
    body.createFixture({ shape: new Polygon(head.map(([x, y]) => new Vec2(v * x, y))), ...fx });
  } else {
    body.createFixture({ shape: new Circle(new Vec2(0, 0.98), 0.5), ...fx });
    body.createFixture({ shape: new Circle(new Vec2(0, 1.64), 0.36), ...fx });
  }
  const r = { body, x: def.x, g, pose, facing: v, scare: 0, spaventata: -Infinity, hits: 0, hitBy: new Set() }; // hitBy: oggetti che l'hanno già colpita
  body.setUserData({ kind: 'reindeer', reindeer: r });
  return r;
}
