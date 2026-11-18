import { CAMERA, SCORE, TURN } from '../config.js';
import { Camera } from '../core/camera.js';
import { Emitter } from '../core/emitter.js';
import { PhysicsWorld } from '../physics/world.js';
import { Slingshot } from '../entities/slingshot.js';
import { Sleigh } from '../entities/sleigh.js';
import { Fracture } from '../physics/fracture.js';
import { Particles } from '../render/particles.js';
import { buildLevel } from './levelBuilder.js';
import { attachContacts, shatterGlass } from './contacts.js';
import { startIntro, updateIntro, endIntro } from './intro.js';
import { pointerDown, pointerMove, pointerUp } from './gestures.js';
import { launch, nextTurn, endLevel, updateTurn } from './turn.js';
import { deliver, checkDeliveries, totalScore, breakScore, crystals } from './scoring.js';

/**
 * Facciata del gioco: tiene lo stato della partita e coordina i moduli.
 *  - levelBuilder.js  costruzione del livello dal JSON
 *  - contacts.js      callback di contatto (vetri, camino, renne, rotture) e frantumazione dei vetri
 *  - turn.js          stati del turno (intro → ready → flight → settle → … → end), lancio, fine livello
 *  - gestures.js      gesti: prendere/trascinare un pacco, mirare, spostare la vista
 *  - scoring.js       consegne, punteggio, riepilogo
 *  - intro.js         regia d'apertura
 *
 * Eventi (game.on(nome, fn) / game.off / game.emit), per l'audio e la regia (M5). Tutti emessi fuori dalle
 * callback di contatto (dopo pw.step o da un gesto), quindi un ascoltatore può toccare il gioco senza rischi:
 *  'stato'     {stato, prima}                         cambio di stato del turno
 *  'tensione'  {tipo}                                 inizio della mira (pacco agganciato all'elastico)
 *  'annullato' {}                                     rilascio con tensione troppo bassa: niente lancio
 *  'lancio'    {tipo, x, y, vx, vy, velocita}         pacco lanciato (velocita in m/s, max ~24)
 *  'rottura'   {materiale, area, x, y, pezzi, forza, daPacco}  neve/ghiaccio/pupazzo che si rompe
 *               materiale: 'ice' | 'snow' | 'snowman'; area in m²; forza = impulso efficace (N·s)
 *  'vetro'     {apertura, x, y, daPacco}              vetro di porta/finestra infranto (apertura: 'door' | 'window')
 *  'consegna'  {tipo, punti, casa, ripetizione, x, y} tipo: 'chimney' | 'window' | 'door'; casa = indice;
 *               ripetizione = consegne in quell'apertura compresa questa (1 = prima)
 *  'renna'     {renna, x, y, colpi, punti, daPacco}   renna spaventata e punti tolti (punti negativi)
 *  'fine'      riepilogo (vedi scoring.summarize)    fine livello
 * Gli ascoltatori sopravvivono a reset() e setLevel().
 *
 * Callback rimasta: onLevels() (pulsante "Livelli" del pannello finale, la gestisce main.js).
 */
export class Game extends Emitter {
  constructor(level) {
    super();
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
    this.pw = new PhysicsWorld();
    const built = buildLevel(this.pw, this.level);
    this.forts = built.forts;
    this.slabs = built.slabs; // corpi che si rompono / svaniscono: neve, ghiaccio, pupazzi, schegge di vetro
    this.trees = built.trees;
    this.hills = built.hills;
    this.pines = built.pines;
    this.reindeer = built.reindeer;
    this.houses = built.houses;
    this.sleigh = new Sleigh(this.level.sleigh.x, this.level.gifts);
    this.sling = new Slingshot(this.level.sling.x, this.level.sling.y);
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
    this.penalty = 0; // punti tolti (renne colpite)
    this.bonus = 0;
    this.deliveries = []; // {type, points}
    this.floaters = []; // testi "+1000" nel mondo
    this.summary = null; // riepilogo di fine livello
    this.buttons = []; // pulsanti del pannello finale (coordinate logiche)
    this.particles = new Particles();
    this.fracture = new Fracture(this.pw, this.particles);
    this.fracture.onBreak = (e) => this.emit('rottura', e);
    attachContacts(this);
    startIntro(this);
  }

  // ---------------------------------------------------------------- stato e camera

  setState(s) {
    const prima = this.state;
    this.state = s;
    this.stateTime = 0;
    this.emit('stato', { stato: s, prima });
  }

  aimView() {
    const c = this.level.camera;
    this.camera.follow = null;
    this.camera.setTarget(c.aimCenter, c.aimW, CAMERA.speed);
  }

  startIntro() {
    startIntro(this);
  }

  endIntro() {
    endIntro(this);
  }

  // ---------------------------------------------------------------- punteggio

  /** Punteggio totale: consegne + neve/ghiaccio rotto (in base alla superficie) + cristalli + bonus − renne colpite. */
  get score() {
    return totalScore(this);
  }

  get breakScore() {
    return breakScore(this);
  }

  get crystals() {
    return crystals(this);
  }

  get giftsLeft() {
    return this.sleigh.count + (this.sling.loaded ? 1 : 0) + (this.carry ? 1 : 0);
  }

  deliver(body, house, zone) {
    deliver(this, body, house, zone);
  }

  // ---------------------------------------------------------------- gesti e turno

  pointerDown(p) {
    pointerDown(this, p);
  }

  pointerMove(p) {
    pointerMove(this, p);
  }

  pointerUp(p) {
    pointerUp(this, p);
  }

  /** shot = {gift: {type}, x, y, vx, vy} */
  launch(shot) {
    launch(this, shot);
  }

  nextTurn() {
    nextTurn(this);
  }

  endLevel() {
    endLevel(this);
  }

  // ---------------------------------------------------------------- update

  /** Passo fisico a timestep fisso. L'ordine delle fasi fa parte del comportamento (generatore con seme). */
  step(dt) {
    this.pw.step();
    this.stateTime += dt;
    for (const t of this.trees) t.collide(this.thrown, this.pw.prev);

    // Rotture raccolte durante lo step (evento 'rottura'), poi detriti che svaniscono
    const { added } = this.fracture.process(this.pw.counts().dynamic);
    const gone = this.fracture.updateDebris(this.slabs, dt);
    if (added.length || gone.length) {
      this.slabs = this.slabs.filter((b) => !b.getUserData().dead).concat(added);
    }

    if (this.glassQueue.length) shatterGlass(this);

    for (const s of this.slabs) {
      const ud = s.getUserData();
      if (ud.flash > 0) ud.flash = Math.max(0, ud.flash - dt * 2);
    }

    // Eventi nati nelle callback di contatto (renne): emessi ora, a mondo fermo
    if (this.contactEvents.length) {
      const list = this.contactEvents;
      this.contactEvents = [];
      for (const [name, data] of list) this.emit(name, data);
    }

    checkDeliveries(this);
    updateTurn(this);
  }

  /** Aggiornamenti a tempo reale (camera, animazioni). */
  frame(dt) {
    this.time = (this.time || 0) + dt; // tempo reale (animazioni)
    for (const r of this.reindeer) if (r.scare > 0) r.scare = Math.max(0, r.scare - dt);
    this.sling.update(dt);
    this.particles.update(dt);
    for (const t of this.trees) t.update(dt);
    for (const h of this.houses) for (const z of h.zones) if (z.glow > 0) z.glow = Math.max(0, z.glow - dt);
    for (const f of this.floaters) {
      f.t += dt;
      f.y += dt * SCORE.floaterRise;
    }
    this.floaters = this.floaters.filter((f) => f.t < SCORE.floaterLife);
    if (this.panIdle !== null && (this.panIdle += dt) > TURN.panReturn) {
      this.panIdle = null;
      if (this.state === 'ready') this.aimView();
    }
    if (this.state === 'intro') updateIntro(this, dt);
    else this.camera.update(dt);
  }
}
