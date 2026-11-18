import { Circle, Polygon, Vec2 } from 'planck';
import { GROUND_Y, REINDEER } from '../config.js';

/**
 * Renna (decorazione solida): corpo statico, il pacco ci rimbalza contro e non si rompe.
 * Quando viene colpita si spaventa (balzo, occhi sbarrati, "!") e poi torna alla posa normale;
 * il gioco emette l'evento 'renna' (servirà per il verso quando ci sarà l'audio).
 * Pose: 'fianco' (di profilo, a testa alta: guarda dritto davanti a sé e ogni tanto si gira verso la camera)
 * e 'fronte' (guarda in camera). Le zampe non sono solide: un pacco può passare sotto la pancia.
 * Definizione (JSON del livello, `reindeer`): { x, y (quota del terreno), pose, facing (±1, solo 'fianco') }
 */
export function buildReindeer(pw, def) {
  const g = GROUND_Y + (def.y || 0);
  const v = def.facing ?? 1;
  const pose = def.pose || 'fianco';
  const body = pw.world.createBody({ type: 'static', position: new Vec2(def.x, g) });
  const fx = { friction: 0.5, restitution: REINDEER.restitution };
  if (pose === 'fianco') {
    // tronco: ellisse approssimata da un ottagono
    const torso = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      torso.push(new Vec2(Math.cos(a) * 0.76, 0.98 + Math.sin(a) * 0.42));
    }
    body.createFixture({ shape: new Polygon(torso), ...fx });
    // collo e testa alta (sagoma unica per la testa di profilo e girata verso la camera; corna escluse)
    const head = [[0.5, 1.2], [0.85, 1.05], [1.3, 1.55], [1.32, 1.95], [1.0, 2.08], [0.7, 1.95]];
    body.createFixture({ shape: new Polygon(head.map(([x, y]) => new Vec2(v * x, y))), ...fx });
  } else {
    body.createFixture({ shape: new Circle(new Vec2(0, 0.98), 0.5), ...fx });
    body.createFixture({ shape: new Circle(new Vec2(0, 1.64), 0.36), ...fx });
  }
  const r = { body, x: def.x, g, pose, facing: v, scare: 0, spaventata: -Infinity, hits: 0, hitBy: new Set() }; // hitBy: oggetti che l'hanno già colpita
  body.setUserData({ kind: 'reindeer', reindeer: r });
  return r;
}
