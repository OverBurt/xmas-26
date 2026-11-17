import { CAMERA, SLING, TURN, TRAJECTORY, SCORE, GLASS, INTRO, VIEW_W, VIEW_H } from '../config.js';
import { Camera } from '../core/camera.js';
import { PhysicsWorld } from '../physics/world.js';
import { predictTrajectory } from '../physics/trajectory.js';
import { buildIceTower } from '../entities/iceTower.js';
import { buildHouse, zoneAt } from '../entities/house.js';
import { buildSnowFort } from '../entities/snowFort.js';
import { buildSnowman } from '../entities/snowman.js';
import { SnowTree } from '../entities/snowTree.js';
import { buildHill } from '../entities/hill.js';
import { buildIgloo } from '../entities/igloo.js';
import { launchGift } from '../entities/gift.js';
import { Slingshot } from '../entities/slingshot.js';
import { Sleigh } from '../entities/sleigh.js';
import { Fracture, createIceBody, prefracture } from '../physics/fracture.js';
import { Vec2 } from 'planck';
import { Particles } from '../render/particles.js';
import { centroid } from '../physics/polygon.js';

/**
 * Stati del turno:
 *  intro  → regia d'apertura (case → panoramica → zona di lancio), un tocco la salta
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

  /** Cambia livello e lo fa ripartire. */
  setLevel(level) {
    this.level = level;
    this.camera.minX = level.bounds.minX;
    this.camera.maxX = level.bounds.maxX;
    this.reset();
  }

  reset() {
    const L = this.level;
    this.pw = new PhysicsWorld();
    // Corpi che si rompono / svaniscono: ghiaccio, neve, pupazzi, schegge di vetro
    this.slabs = (L.towers || []).flatMap((t) => buildIceTower(this.pw, t.x, t.floors));
    // I merli su cui sta un pupazzo non devono mancare
    this.forts = (L.forts || []).map((f, i) => {
      const keep = (L.snowmen || []).filter((sm) => sm.fort === i && sm.merlon !== undefined).map((sm) => sm.merlon);
      return buildSnowFort(this.pw, { ...f, keepMerlons: [...(f.keepMerlons || []), ...keep] });
    });
    for (const f of this.forts) this.slabs.push(...f.bodies);
    this.trees = (L.trees || []).map((t) => new SnowTree(this.pw, t));
    // Igloo, eventualmente con un pupazzo in cima
    for (const ig of L.igloos || []) {
      const igloo = buildIgloo(this.pw, ig);
      this.slabs.push(...igloo.bodies);
      if (ig.snowman) this.slabs.push(buildSnowman(this.pw, igloo.cx, igloo.top));
    }
    this.hills = (L.hills || []).map((h) => buildHill(this.pw, h));
    for (const sm of L.snowmen || []) {
      // "fort": indice di un fortino → il pupazzo sta in cima, al centro
      if (sm.fort !== undefined && !this.forts[sm.fort]) continue;
      const f = sm.fort !== undefined ? this.forts[sm.fort] : null;
      // "merlon": indice del merlo su cui sta il pupazzo; altrimenti al centro del fortino
      const m = f && sm.merlon !== undefined ? f.merlons[sm.merlon] : null;
      const x = m ? (m.x0 + m.x1) / 2 : f ? (f.x0 + f.x1) / 2 + (sm.dx || 0) : sm.x;
      this.slabs.push(buildSnowman(this.pw, x, f ? f.top : sm.y || 0));
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

    // Vetri: il contatto viene annullato (il pacco passa) e il vetro si frantuma dopo lo step.
    this.glassQueue = [];
    this.pw.onPreSolve = (contact) => {
      this.checkChimneyEdge(contact); // anche contatti iniziati fuori che scivolano sullo spigolo
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
      // Un pacco rompe sempre il vetro di porte e finestre (anche arrivando piano o rotolando);
      // gli altri oggetti (neve, schegge, pupazzi) solo se l'urto supera la soglia.
      const byGift = other.getUserData()?.kind === 'gift';
      if (byGift || other.getMass() * vn > GLASS.breakImpulse) {
        ud.broken = true;
        contact.setEnabled(false);
        this.glassQueue.push({ pane, by: other, vx: v.x, vy: v.y });
      }
    };

    // Pacco che tocca il lato interno del camino (spigolo della bocca compreso): consegnato.
    // La consegna avviene dopo lo step (il mondo non si modifica dentro una callback).
    this.pendingDeliveries = [];
    this.pw.onBeginContact = (contact) => this.checkChimneyEdge(contact);

    this.pw.onImpulse = (body, impulse, other, speed) => {
      const ud = body.getUserData();
      if (!ud || (ud.kind !== 'ice' && ud.kind !== 'snow' && ud.kind !== 'snowman')) return;
      if (impulse > this.stats.maxImpulse) this.stats.maxImpulse = impulse;
      this.fracture.hit(body, impulse, other, speed);
    };

    this.startIntro();
  }

  // ---------------------------------------------------------------- intro

  /**
   * Regia d'apertura del livello: zoom sulle case → panoramica su tutto lo stage →
   * zoom sulla zona di lancio (slitta e fionda). Un tocco la salta.
   */
  startIntro() {
    const cam = this.camera;
    const L = this.level;
    // Inquadratura delle case: larga quanto basta per contenerle tutte, camini compresi
    let x0 = Infinity;
    let x1 = -Infinity;
    let top = 0;
    for (const h of this.houses) {
      const d = h.def;
      x0 = Math.min(x0, d.x - 1.5);
      x1 = Math.max(x1, d.x + d.w + 1.5);
      top = Math.max(top, (d.y || 0) + d.h + d.roof + (d.chimney?.h || 0) + 1);
    }
    const fitW = (w, topY) => Math.max(w, ((topY - CAMERA.bottom) * VIEW_W) / VIEW_H);
    const houses = { cx: (x0 + x1) / 2, w: fitW(x1 - x0, top) };
    const pano = { cx: (L.bounds.minX + L.bounds.maxX) / 2, w: L.bounds.maxX - L.bounds.minX };
    const aim = { cx: L.camera.aimCenter, w: L.camera.aimW };
    // Un unico movimento continuo: curva (Bézier quadratica) che parte dalle case,
    // si allarga passando vicino alla panoramica senza fermarsi e arriva sulla zona di lancio.
    this.intro = { t: 0, from: houses, via: pano, to: aim, duration: INTRO.duration };
    cam.follow = null;
    cam.cx = houses.cx;
    cam.viewW = houses.w;
    cam.clamp();
    this.setState('intro');
  }

  /** Avanza la regia; a fine intro si passa allo stato "ready". */
  updateIntro(dt) {
    const it = this.intro;
    it.t += dt;
    if (it.t >= it.duration) {
      this.endIntro();
      return;
    }
    const k = ease(it.t / it.duration);
    const bez = (a, b, c) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * b + k * k * c;
    this.camera.cx = bez(it.from.cx, it.via.cx, it.to.cx);
    this.camera.viewW = bez(it.from.w, it.via.w, it.to.w);
    this.camera.clamp();
  }

  endIntro() {
    this.intro = null;
    this.setState('ready');
    this.aimView();
    // se l'intro è stata saltata la camera raggiunge la fionda con il suo inseguimento morbido
  }

  /** Punteggio totale: consegne + ghiaccio rotto + bonus pacchi avanzati. */
  get score() {
    return this.deliveryScore + this.fracture.broken * SCORE.icePerBreak + this.crystals * SCORE.crystal + this.bonus;
  }

  get crystals() {
    return this.trees.reduce((n, t) => n + t.knocked, 0);
  }

  get giftsLeft() {
    return this.sleigh.count + (this.sling.loaded ? 1 : 0) + (this.carry ? 1 : 0);
  }

  /** Pacco che tocca il lato interno del camino (spigolo della bocca compreso): consegna in coda. */
  checkChimneyEdge(contact) {
    let fx = contact.getFixtureA();
    let gift = contact.getFixtureB().getBody();
    if (fx.getUserData()?.part !== 'chimney') [fx, gift] = [contact.getFixtureB(), fx.getBody()];
    if (fx.getUserData()?.part !== 'chimney' || gift.getUserData()?.kind !== 'gift') return;
    const house = this.houses.find((h) => h.body === fx.getBody());
    const wm = contact.getWorldManifold(null);
    const n = contact.getManifold().pointCount;
    if (!house || !wm) return;
    for (let i = 0; i < n; i++) {
      const p = wm.points[i];
      if (house.chimney.inner.some(([a, b]) => distToSegment(p, a, b) < CHIMNEY_EDGE)) {
        const zone = house.zones.find((z) => z.type === 'chimney');
        if (!this.pendingDeliveries.some((d) => d.gift === gift)) this.pendingDeliveries.push({ gift, house, zone });
        return;
      }
    }
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

    if (this.state === 'intro') {
      this.endIntro(); // tocco durante l'intro: si salta
      return;
    }
    if (this.state === 'end') {
      const b = this.buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (b?.action === 'retry') this.reset();
      if (b?.action === 'levels') this.onLevels?.();
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
    // Mirando la slitta non serve più: il bordo sinistro si ferma poco dietro la fionda
    // (spazio per il pacco tirato indietro) e tutto il resto dell'inquadratura va verso destra;
    // tendendo l'elastico la camera si allarga ancora.
    const w = this.level.camera.aimW + s.tension * CAMERA.pullZoomOut;
    const left = s.x - SLING.maxPull - CAMERA.aimBehind;
    this.camera.setTarget(left + w / 2, w);
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
      crystals: this.crystals,
      crystalScore: this.crystals * SCORE.crystal,
      bonus: this.bonus,
      allServed,
      served: this.houses.filter((h) => h.served > 0).length,
      houses: this.houses.length,
    };
    // Pulsanti in basso nel pannello
    const by = VIEW_H / 2 + 120;
    this.buttons = [
      { action: 'levels', label: 'Livelli', x: VIEW_W / 2 - 230, y: by, w: 210, h: 56, secondary: true },
      { action: 'retry', label: 'Riprova', x: VIEW_W / 2 + 20, y: by, w: 210, h: 56 },
    ];
    this.onEnd?.(this.summary);
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
    for (const t of this.trees) t.collide(this.thrown, this.pw.prev);

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

    // Consegne dal bordo interno del camino
    for (const d of this.pendingDeliveries) {
      if (!this.thrown.includes(d.gift)) continue; // già consegnato o uscito
      this.deliver(d.gift, d.house, d.zone);
      this.thrown = this.thrown.filter((g) => g !== d.gift);
    }
    this.pendingDeliveries = [];

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
    for (const t of this.trees) t.update(dt);
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
    if (this.state === 'intro') this.updateIntro(dt);
    else this.camera.update(dt);
  }
}

/** Accelera e rallenta (ease-in-out cubica). */
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Tolleranza (m) per considerare un contatto sul lato interno del camino (metà del bordo superiore). */
const CHIMNEY_EDGE = 0.07;

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
