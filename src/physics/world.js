import { World, Edge, Vec2 } from 'planck';
import {
  GRAVITY,
  GROUND_Y,
  PHYSICS_DT,
  VELOCITY_ITERATIONS,
  POSITION_ITERATIONS,
} from '../config.js';

/**
 * Wrapper del mondo Planck: creazione, step, stato precedente per l'interpolazione
 * e raccolta degli impulsi di contatto (usati in M2 per la rottura).
 */
export class PhysicsWorld {
  constructor() {
    this.world = new World({ gravity: new Vec2(0, GRAVITY) });
    /** @type {Map<import('planck').Body, {x:number,y:number,a:number}>} */
    this.prev = new Map();
    /** Callback (body, impulse, otherBody) per ogni contatto risolto. */
    this.onImpulse = null;
    /** Callback (contact) prima della risoluzione: può disabilitare il contatto (vetri che si infrangono). */
    this.onPreSolve = null;

    this.world.on('pre-solve', (contact) => this.onPreSolve?.(contact));

    this.world.on('post-solve', (contact, impulse) => {
      if (!this.onImpulse) return;
      const n = contact.getManifold().pointCount;
      let max = 0;
      for (let i = 0; i < n; i++) max = Math.max(max, impulse.normalImpulses[i]);
      if (max <= 0) return;
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      this.onImpulse(a, max, b);
      this.onImpulse(b, max, a);
    });

    this.ground = this.world.createBody({ type: 'static' });
    this.ground.createFixture({
      shape: new Edge(new Vec2(-50, GROUND_Y), new Vec2(100, GROUND_Y)),
      friction: 0.9,
    });
    this.ground.setUserData({ kind: 'ground' });
  }

  step() {
    // Salva lo stato prima dello step: il render interpola prev → attuale.
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      if (!b.isDynamic()) continue;
      const p = b.getPosition();
      let s = this.prev.get(b);
      if (!s) {
        s = { x: 0, y: 0, a: 0 };
        this.prev.set(b, s);
      }
      s.x = p.x;
      s.y = p.y;
      s.a = b.getAngle();
    }
    this.world.step(PHYSICS_DT, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
  }

  destroyBody(body) {
    this.prev.delete(body);
    this.world.destroyBody(body);
  }

  /** Conteggi per l'HUD di debug. */
  counts() {
    let dynamic = 0;
    let awake = 0;
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      if (!b.isDynamic()) continue;
      dynamic++;
      if (b.isAwake()) awake++;
    }
    return { dynamic, awake };
  }
}
