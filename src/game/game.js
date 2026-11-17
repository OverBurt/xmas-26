import { CAMERA, SLING, TURN, TRAJECTORY, SCORE, GLASS, VIEW_W, VIEW_H } from '../config.js';
import { Camera } from '../core/camera.js';
import { PhysicsWorld } from '../physics/world.js';
import { predictTrajectory } from '../physics/trajectory.js';
import { buildIceTower } from '../entities/iceTower.js';
import { buildHouse, zoneAt } from '../entities/house.js';
import { buildSnowFort } from '../entities/snowFort.js';
import { buildSnowman } from '../entities/snowman.js';
import { launchGift } from '../entities/gift.js';
import { Slingshot } from '../entities/slingshot.js';
import { Sleigh } from '../entities/sleigh.js';
import { Fracture, createIceBody, prefracture } from '../physics/fracture.js';
import { Vec2 } from 'planck';
import { Particles } from '../render/particles.js';
import { centroid } from '../physics/polygon.js';

/**
 * Stati del turno:
 *  ready  → in attesa: si prende un pacco dalla slitta, lo si carica, si mira
 *  flight → pacco in volo, la camera lo segue
 *  settle → il pacco è fermo/uscito, si aspetta che la scena si assesti
 *  end    → pacchi finiti (o tutte le case servite): riepilogo
 */
export class Game {
  constructor(level) {
    this.level = level;
    this.camera = new Camera(level.bounds);
    this.reset();
  }

  reset() {
    const L = this.level;
    this.pw = new PhysicsWorld();
    // Corpi che si rompono / svaniscono: ghiaccio, neve, pupazzi, schegge di vetro
    this.slabs = (L.towers || []).flatMap((t) => buildIceTower(this.pw, t.x, t.floors));
    this.forts = (L.forts || []).map((f) => buildSnowFort(this.pw, f));
    for (const f of this.forts) this.slabs.push(...f.bodies);
    for (const sm of L.snowmen || []) {
      // "fort": indice di un fortino → il pupazzo sta in cima, al centro
      const f = sm.fort !== undefined ? this.forts[sm.fort] : null;
      const x = f ? (f.x0 + f.x1) / 2 + (sm.dx || 0) : sm.x;
      this.slabs.push(buildSnowman(this.pw, x, f ? f.top : 0));
    }
    this.houses = L.houses.map((h) => buildHouse(this.pw, h));
    for (const h of this.houses) this.slabs.push(...h.plugs);
    this.sleigh = new Sleigh(L.sleigh.x, L.gifts);
    this.sling = new Slingshot(L.sling.x, L.sling.y);
    this.thrown = []; // corpi dei pacchi lanciati
    this.current = null; // pacco in volo
    this.state = 'ready';
    this.stateTime = 0;
    this.trajectory = [];
    this.carry = null; // pacco trascinato dalla slitta {gift, x, y, moved}
    this.mode = null; // gesto in corso: 'aim' | 'carry' | 'pan'
    this.panIdle = null;
    this.stats = { shots: 0, maxImpulse: 0 };
    this.deliveryScore = 0;
    this.bonus = 0;
    this.deliveries = []; // {type, points}
    this.floaters = []; // testi "+1000" nel mondo
    this.summary = null; // riepilogo di fine livello
    this.buttons = []; // pulsanti del pannello finale (coordinate logiche)
    this.particles = new Particles();
    this.fracture = new Fracture(this.pw, this.particles);

    // Vetri: se l'urto è abbastanza forte il contatto viene annullato (il pacco passa)
    // e il vetro si frantuma dopo lo step; altrimenti il pacco rimbalza normalmente.
    this.glassQueue = [];
    this.pw.onPreSolve = (contact) => {
      let pane = contact.getFixtureA().getBody();
      let other = contact.getFixtureB().getBody();
      if (pane.getUserData()?.kind !== 'glass') [pane, other] = [other, pane];
      const ud = pane.getUserData();
      if (ud?.kind !== 'glass' || !ud.pane || !other.isDynamic()) return;
      if (ud.broken) {
        contact.setEnabled(false);
        return;
      }
      const n = contact.getWorldManifold(null)?.normal;
      if (!n) return;
      const v = other.getLinearVelocity();
      const vn = Math.abs(v.x * n.x + v.y * n.y);
      // Porta: un pacco che arriva rotolando o scivolando a terra entra sempre.
      const giftAtDoor = ud.opening === 'door' && other.getUserData()?.kind === 'gift';
      if (giftAtDoor || other.getMass() * vn > GLASS.breakImpulse) {
        ud.broken = true;
        contact.setEnabled(false);
        this.glassQueue.push({ pane, by: other, vx: v.x, vy: v.y });
      }
    };

    this.pw.onImpulse = (body, impulse, other) => {
      const ud = body.getUserData();
      if (!ud || (ud.kind !== 'ice' && ud.kind !== 'snow' && ud.kind !== 'snowman')) return;
      if (impulse > this.stats.maxImpulse) this.stats.maxImpulse = impulse;
      this.fracture.hit(body, impulse, other);
    };

    this.aimView();
    this.camera.snap();
  }

  /** Punteggio totale: consegne + ghiaccio rotto + bonus pacchi avanzati. */
  get score() {
    return this.deliveryScore + this.fracture.broken * SCORE.icePerBreak + this.bonus;
  }

  get giftsLeft() {
    return this.sleigh.count + (this.sling.loaded ? 1 : 0) + (this.carry ? 1 : 0);
  }

  aimView() {
    const c = this.level.camera;
    this.camera.follow = null;
    this.camera.setTarget(c.aimCenter, c.aimW, CAMERA.speed);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  // ---------------------------------------------------------------- input

  pointerDown(p) {
    const w = this.camera.screenToWorld(p.x, p.y);
    this.panIdle = null;

    if (this.state === 'end') {
      const b = this.buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (b?.action === 'retry') this.reset();
      return;
    }
    if (this.state === 'settle') {
      // Tocco durante l'assestamento: salta l'attesa.
      this.nextTurn();
      this.mode = null;
      return;
    }
    if (this.state !== 'ready') return;

    // Tocco sulla fionda: se è vuota si arma da sola con il primo pacco della slitta.
    if (!this.sling.loaded && this.sleigh.count > 0 && this.sling.distance(w.x, w.y) <= SLING.grabRadius) {
      this.sling.arm(this.sleigh.take(this.sleigh.gifts[0]));
    }
    if (this.sling.tryGrab(w.x, w.y)) {
      this.startAim(w);
      return;
    }
    const g = this.sleigh.hit(w.x, w.y);
    if (g) {
      this.sleigh.take(g);
      this.carry = { gift: g, x: w.x, y: w.y, sx: p.x, sy: p.y, moved: false, home: { x: g.x, y: g.y } };
      this.mode = 'carry';
      this.aimView();
      return;
    }
    this.mode = 'pan';
    this.panLast = p;
  }

  pointerMove(p) {
    const w = this.camera.screenToWorld(p.x, p.y);
    if (this.mode === 'aim') {
      // La camera zooma mentre si tende: per la mira si usa la camera "congelata" a inizio gesto,
      // così la tensione dipende solo dal dito e non dallo zoom.
      const a = this.aimCam;
      this.sling.drag(p.x / a.ppm + a.x, (VIEW_H - p.y) / a.ppm + a.bottom);
      this.updateAim();
    } else if (this.mode === 'carry') {
      const c = this.carry;
      c.x = w.x;
      c.y = w.y;
      if (Math.hypot(p.x - c.sx, p.y - c.sy) > 12) c.moved = true;
      // Arrivato sulla fionda: si arma e lo stesso gesto prosegue come mira.
      if (this.sling.distance(w.x, w.y) < SLING.armRadius) {
        const prev = this.sling.loaded ? this.sling.unload() : null;
        if (prev) this.sleigh.putBack(prev);
        this.sling.arm(c.gift);
        this.carry = null;
        this.startAim(w);
      }
    } else if (this.mode === 'pan') {
      this.camera.pan(-(p.x - this.panLast.x) / this.camera.ppm);
      this.panLast = p;
    }
  }

  pointerUp() {
    if (this.mode === 'aim') {
      const shot = this.sling.release();
      this.trajectory = [];
      this.aimView();
      if (shot) this.launch(shot);
    } else if (this.mode === 'carry') {
      const c = this.carry;
      // Tap sul pacco, oppure rilascio vicino alla fionda → carica.
      if (!c.moved || this.sling.distance(c.x, c.y) < SLING.loadRadius) {
        const prev = this.sling.loaded ? this.sling.unload() : null;
        this.sling.load(c.gift, c.moved ? c.x : c.home.x, c.moved ? c.y : c.home.y);
        if (prev) this.sleigh.putBack(prev);
      } else {
        this.sleigh.putBack(c.gift);
      }
      this.carry = null;
    } else if (this.mode === 'pan') {
      this.panIdle = 0;
    }
    this.mode = null;
  }

  startAim(w) {
    const c = this.camera;
    this.aimCam = { ppm: c.ppm, x: c.x, bottom: c.bottom };
    this.mode = 'aim';
    this.sling.aiming = true;
    this.sling.drag(w.x, w.y);
    this.aimView();
    this.updateAim();
  }

  updateAim() {
    const s = this.sling;
    const v = s.velocity;
    const steps = Math.round(TRAJECTORY.steps * this.level.preview);
    this.trajectory = predictTrajectory(s.loadX, s.loadY, v.vx, v.vy, steps);
    // Leggero zoom-out man mano che si tende l'elastico
    const c = this.level.camera;
    this.camera.setTarget(c.aimCenter + s.tension * CAMERA.pullZoomOut * 0.5, c.aimW + s.tension * CAMERA.pullZoomOut);
  }

  launch(shot) {
    const body = launchGift(this.pw, shot.gift.type, shot.x, shot.y, shot.vx, shot.vy);
    this.thrown.push(body);
    this.current = body;
    this.stats.shots++;
    this.stats.maxImpulse = 0;
    this.deliveredThisTurn = false;
    this.setState('flight');
    this.camera.setTarget(this.camera.cx, CAMERA.flightViewW, 2.5);
    this.camera.followViewW = CAMERA.flightViewW;
    this.camera.follow = () => {
      if (!this.current) return null;
      const p = this.current.getPosition();
      const v = this.current.getLinearVelocity();
      return { x: p.x, y: p.y, vx: v.x, vy: v.y };
    };
  }

  nextTurn() {
    this.current = null;
    // Il livello termina solo quando non ci sono più pacchi da lanciare.
    if (this.giftsLeft === 0) {
      this.endLevel();
    } else {
      this.setState('ready');
      this.aimView();
    }
  }

  endLevel() {
    // Premio per aver servito tutte le case (almeno una consegna ciascuna).
    const allServed = this.houses.every((h) => h.served > 0);
    if (allServed) this.bonus = SCORE.allServedBonus;
    const score = this.score;
    const stars = this.level.stars.filter((t) => score >= t).length;
    this.summary = {
      score,
      stars,
      delivered: this.deliveries.length,
      thrown: this.stats.shots,
      deliveryScore: this.deliveryScore,
      ice: this.fracture.broken,
      iceScore: this.fracture.broken * SCORE.icePerBreak,
      bonus: this.bonus,
      allServed,
      served: this.houses.filter((h) => h.served > 0).length,
      houses: this.houses.length,
    };
    // Pulsante "Riprova" al centro in basso del pannello
    this.buttons = [{ action: 'retry', label: 'Riprova', x: VIEW_W / 2 - 110, y: VIEW_H / 2 + 120, w: 220, h: 56 }];
    this.setState('end');
    const b = this.level.bounds;
    this.camera.follow = null;
    this.camera.setTarget((b.minX + b.maxX) / 2, b.maxX - b.minX, 2);
  }

  /** Frantuma i vetri colpiti durante lo step: schegge dinamiche che svaniscono. */
  shatterGlass() {
    for (const { pane, by, vx, vy } of this.glassQueue) {
      const ud = pane.getUserData();
      const p = pane.getPosition().clone();
      this.pw.destroyBody(pane);
      for (const h of this.houses) h.panes = h.panes.filter((b) => b !== pane);
      const pieces = (prefracture(ud.poly, 0) || [ud.poly]).flatMap((pc) => prefracture(pc, 0) || [pc]);
      for (const pc of pieces) {
        const c = centroid(pc);
        const local = pc.map((q) => ({ x: q.x - c.x, y: q.y - c.y }));
        const shard = createIceBody(this.pw, local, p.x + c.x, p.y + c.y, 0, 2, true, 'glass');
        shard.setLinearVelocity(new Vec2(vx * 0.35 + (Math.random() - 0.5) * 2, vy * 0.35 + Math.random() * 1.5));
        shard.setAngularVelocity((Math.random() - 0.5) * 10);
        shard.getUserData().life = GLASS.shardLife + Math.random();
        this.slabs.push(shard);
      }
      this.particles.burst(p.x, p.y, 16, 3.5, '#dff6ff');
      if (by.getUserData()?.kind === 'gift') {
        const v = by.getLinearVelocity();
        by.setLinearVelocity(new Vec2(v.x * GLASS.slowdown, v.y * GLASS.slowdown));
      }
    }
    this.glassQueue = [];
  }

  deliver(body, house, zone) {
    const p = body.getPosition();
    this.deliveryScore += zone.points;
    this.deliveries.push({ type: zone.type, points: zone.points });
    house.served++;
    this.deliveredThisTurn = true;
    zone.glow = 1.6;
    this.floaters.push({ text: `+${zone.points}`, x: p.x, y: p.y + 0.6, t: 0, big: zone.type === 'chimney' });
    this.particles.burst(p.x, p.y, 18, 3, '#ffd36b');
    this.pw.destroyBody(body);
    if (body === this.current) this.current = null;
  }

  // ---------------------------------------------------------------- update

  /** Passo fisico a timestep fisso. */
  step(dt) {
    this.pw.step();
    this.stateTime += dt;

    // Rotture raccolte durante lo step, poi detriti che svaniscono
    const { added } = this.fracture.process(this.pw.counts().dynamic);
    const gone = this.fracture.updateDebris(this.slabs, dt);
    if (added.length || gone.length) {
      this.slabs = this.slabs.filter((b) => !b.getUserData().dead).concat(added);
    }

    if (this.glassQueue.length) this.shatterGlass();

    for (const s of this.slabs) {
      const ud = s.getUserData();
      if (ud.flash > 0) ud.flash = Math.max(0, ud.flash - dt * 2);
    }

    // Consegne e pacchi usciti dal mondo
    const b = this.level.bounds;
    this.thrown = this.thrown.filter((g) => {
      const p = g.getPosition();
      for (const h of this.houses) {
        const z = zoneAt(h, p.x, p.y);
        if (z) {
          this.deliver(g, h, z);
          return false;
        }
      }
      if (p.y > -5 && p.x > b.minX - 5 && p.x < b.maxX + 5) return true;
      this.pw.destroyBody(g);
      if (g === this.current) this.current = null;
      return false;
    });

    if (this.state === 'flight') {
      const g = this.current;
      const stopped = !g || (this.stateTime > TURN.minFlight && g.getLinearVelocity().length() < TURN.stopSpeed);
      if (stopped || this.stateTime > TURN.maxFlight) {
        this.camera.follow = null;
        this.setState('settle');
      }
    } else if (this.state === 'settle') {
      // Dopo una consegna la camera resta un attimo sulla casa per godersi i punti.
      const minSettle = this.deliveredThisTurn ? TURN.deliveryLinger : 0;
      if (this.stateTime > minSettle && (this.pw.counts().awake === 0 || this.stateTime > TURN.maxSettle)) this.nextTurn();
    }
  }

  /** Aggiornamenti a tempo reale (camera, animazioni). */
  frame(dt) {
    this.sling.update(dt);
    this.particles.update(dt);
    for (const h of this.houses) for (const z of h.zones) if (z.glow > 0) z.glow = Math.max(0, z.glow - dt);
    for (const f of this.floaters) {
      f.t += dt;
      f.y += dt * 0.8;
    }
    this.floaters = this.floaters.filter((f) => f.t < 1.8);
    if (this.panIdle !== null && (this.panIdle += dt) > TURN.panReturn) {
      this.panIdle = null;
      if (this.state === 'ready') this.aimView();
    }
    this.camera.update(dt);
  }
}
