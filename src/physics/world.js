import { World, Edge, Vec2, WorldManifold } from 'planck';
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
    /**
     * WorldManifold riusato da tutte le callback di contatto (contact.getWorldManifold(pw.wm)) invece di
     * allocarne uno nuovo a ogni contatto. Valido solo fino alla prossima chiamata: non conservarne i punti.
     * Attenzione: con 0 punti di contatto Planck lo restituisce senza riempirlo → controllare prima
     * contact.getManifold().pointCount.
     */
    this.wm = new WorldManifold();
    /** @type {Map<import('planck').Body, {x:number,y:number,a:number}>} */
    this.prev = new Map();
    /** Callback (body, impulse, otherBody, approachSpeed) per ogni contatto risolto. */
    this.onImpulse = null;
    /** Callback (contact) prima della risoluzione: può disabilitare il contatto (vetri che si infrangono). */
    this.onPreSolve = null;

    // Prima della risoluzione si misura la velocità d'avvicinamento dei due corpi nel punto di contatto:
    // serve a distinguere un urto vero da un corpo che semplicemente poggia su un altro.
    this.world.on('pre-solve', (contact) => {
      contact.approachSpeed = approachSpeed(contact, this.wm);
      this.onPreSolve?.(contact);
    });
    /** Callback (contact) quando due corpi iniziano a toccarsi. */
    this.onBeginContact = null;
    this.world.on('begin-contact', (contact) => this.onBeginContact?.(contact));

    this.world.on('post-solve', (contact, impulse) => {
      if (!this.onImpulse) return;
      const n = contact.getManifold().pointCount;
      let max = 0;
      for (let i = 0; i < n; i++) max = Math.max(max, impulse.normalImpulses[i]);
      if (max <= 0) return;
      const a = contact.getFixtureA().getBody();
      const b = contact.getFixtureB().getBody();
      const v = contact.approachSpeed ?? 0;
      this.onImpulse(a, max, b, v);
      this.onImpulse(b, max, a, v);
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

/**
 * Velocità relativa (m/s) con cui i due corpi si vengono incontro lungo la normale del contatto.
 * Senza allocazioni: `wm` è il manifold riusato e la velocità di un punto (v + ω × r, come
 * Body.getLinearVelocityFromWorldPoint, stesse operazioni) è calcolata a mano.
 */
function approachSpeed(contact, wm) {
  const n = contact.getManifold().pointCount;
  if (!n || !contact.getWorldManifold(wm)) return 0;
  const A = contact.getFixtureA().getBody();
  const B = contact.getFixtureB().getBody();
  const la = A.getLinearVelocity();
  const lb = B.getLinearVelocity();
  const ca = A.getWorldCenter();
  const cb = B.getWorldCenter();
  const wa = A.getAngularVelocity();
  const wb = B.getAngularVelocity();
  let best = 0;
  for (let i = 0; i < n; i++) {
    const p = wm.points[i];
    const vax = la.x + -wa * (p.y - ca.y);
    const vay = la.y + wa * (p.x - ca.x);
    const vbx = lb.x + -wb * (p.y - cb.y);
    const vby = lb.y + wb * (p.x - cb.x);
    const vn = (vbx - vax) * wm.normal.x + (vby - vay) * wm.normal.y;
    best = Math.max(best, Math.abs(vn));
  }
  return best;
}
