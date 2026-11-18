import { Polygon, Vec2 } from 'planck';
import { GROUND_Y, GIFTS, TREE } from '../config.js';
import { random } from '../core/rng.js';

const rand = (a, b) => a + random() * (b - a);
const sign = () => (random() < 0.5 ? -1 : 1);

/**
 * Albero alto con una chioma di cristalli di ghiaccio e neve al posto delle foglie.
 *
 * - Il tronco è sinuoso (curva con ondulazione) e rastremato; il corpo statico ne segue la forma
 *   con un quadrilatero per tratto, così il pacco rimbalza sul tronco vero. Il corpo arriva solo fino alla
 *   prima biforcazione: più in alto, dove il tronco si apre nei rami, il pacco passa attraverso.
 * - I rami sono curve morbide (arco + ondulazione), rastremate dalla base alla punta (solo grafica).
 * - I cristalli NON sono corpi fisici: sono punti fissi controllati a mano a ogni step
 *   (centinaia di cristalli costano quasi nulla). Quando un pacco ci passa attraverso,
 *   il cristallo si stacca e cade rapido a terra, poi svanisce; ogni cristallo attraversato frena un po' il pacco (meno se il pacco è pesante).
 *   Il varco aperto resta libero per il lancio successivo.
 * - Forme dei cristalli: fiocco, stella, gemma, esagono (ai lati dei rami), goccia e stalattite
 *   (appese sotto), neve (cuscinetto appoggiato sopra). Frequenze in `TREE.shapes`.
 *
 * Definizione (JSON del livello):
 *  { x, trunkH, trunkW, crown: [{dx, dy, r}], spacing, sway }
 *  crown: cerchi (relativi alla cima del tronco) la cui unione forma la chioma
 *  sway: sinuosità del tronco (m), default TREE.trunkSway
 */
export class SnowTree {
  constructor(pw, def) {
    this.def = def;
    const { x, trunkH, trunkW = 0.7 } = def;
    // Il tronco prosegue 1.5 m dentro la chioma
    this.trunk = buildTrunk(x, GROUND_Y, trunkH + 1.5, trunkW, def.sway ?? TREE.trunkSway);
    this.base = { x, y: GROUND_Y };
    this.top = at(this.trunk, trunkH / (trunkH + 1.5));

    const circles = def.crown.map((c) => ({ x: x + c.dx, y: this.top.y + c.dy, r: c.r }));
    this.circles = circles;
    this.branches = buildBranches(this.trunk, x, this.top.y, circles);

    // Corpo solido solo fino alla prima biforcazione (il ramo principale più basso): sopra, tra i rami,
    // il pacco passa attraverso e stacca i cristalli.
    this.forkY = Math.min(...this.branches.filter((b) => b.level === 0).map((b) => b.pts[0].y));
    const body = pw.world.createBody({ type: 'static' });
    const pts = this.trunk.pts;
    for (let i = 0; i < pts.length - 1 && pts[i].y < this.forkY; i++) {
      const a = side(this.trunk, i);
      let b = side(this.trunk, i + 1);
      if (pts[i + 1].y > this.forkY) {
        // ultimo tratto tagliato all'altezza della biforcazione
        const u = (this.forkY - pts[i].y) / (pts[i + 1].y - pts[i].y);
        const mix = (p, q) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
        b = { l: mix(a.l, b.l), r: mix(a.r, b.r) };
      }
      const quad = [a.l, a.r, b.r, b.l].map((p) => new Vec2(p.x, p.y));
      body.createFixture({ shape: new Polygon(quad), friction: 0.6 });
    }
    body.setUserData({ kind: 'tree' });
    this.body = body;

    this.crystals = growCrystals(this.branches, def.spacing ?? TREE.spacing);
    const xs = this.crystals.map((c) => c.x);
    const ys = this.crystals.map((c) => c.y);
    this.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    this.falling = []; // cristalli staccati che cadono
    this.knocked = 0;
  }

  /**
   * Controllo dei pacchi contro i cristalli (a ogni step fisico).
   * Si usa il segmento percorso nello step (posizione precedente → attuale): anche a 24 m/s
   * il pacco non "salta" i cristalli.
   * @param {import('planck').Body[]} gifts
   * @param {Map} prev posizioni prima dello step (PhysicsWorld.prev)
   * @returns {number} cristalli staccati in questo step
   */
  collide(gifts, prev) {
    const b = this.bounds;
    let tot = 0;
    for (const g of gifts) {
      const p = g.getPosition();
      const q = prev.get(g) || p;
      // scarto veloce: segmento fuori dal rettangolo della chioma
      if (Math.max(p.x, q.x) < b.minX - 1 || Math.min(p.x, q.x) > b.maxX + 1) continue;
      if (Math.max(p.y, q.y) < b.minY - 1 || Math.min(p.y, q.y) > b.maxY + 1) continue;

      const ud = g.getUserData();
      const d = GIFTS[ud.type];
      const reach = Math.max(d.w, d.h) * 0.5 + TREE.crystalRadius;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const len2 = dx * dx + dy * dy || 1e-9;
      let hits = 0;
      for (const c of this.crystals) {
        if (!c.alive) continue;
        // distanza punto-segmento
        let t = ((c.x - q.x) * dx + (c.y - q.y) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = q.x + dx * t - c.x;
        const ey = q.y + dy * t - c.y;
        if (ex * ex + ey * ey > reach * reach) continue;
        c.alive = false;
        hits++;
        const v = g.getLinearVelocity();
        const heavy = c.shape === 'goccia' || c.shape === 'stalattite';
        this.falling.push({
          ...c,
          // spinta iniziale nella direzione del pacco, poi caduta rapida a terra (update)
          vx: v.x * TREE.push * rand(0.5, 1),
          vy: v.y * TREE.push * rand(0.5, 1) + rand(0, 0.6),
          spin: heavy ? rand(-1, 1) : rand(-4, 4),
          life: TREE.fallLife,
        });
        // tre estrazioni a vuoto: la sequenza del generatore resta quella di prima (fratture e misure identiche)
        random();
        random();
        random();
      }
      if (hits) {
        tot += hits;
        this.knocked += hits;
        // Ogni cristallo frena il pacco; il pacco pesante perde meno velocità.
        const keep = Math.max(0, 1 - TREE.drag / g.getMass()) ** hits;
        const v = g.getLinearVelocity();
        g.setLinearVelocity(new Vec2(v.x * keep, v.y * keep));
      }
    }
    return tot;
  }

  /**
   * Cristalli staccati (tempo reale): cadono rapidi per gravità, girando un poco; arrivati a terra si fermano
   * e svaniscono in TREE.groundFade secondi.
   */
  update(dt) {
    const f = this.falling;
    let j = 0;
    for (let i = 0; i < f.length; i++) {
      const c = f[i];
      c.life -= dt;
      if (c.life <= 0) continue;
      if (!c.aTerra) {
        c.vy -= TREE.fallGravity * dt;
        c.vx *= Math.max(0, 1 - 1.5 * dt);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.spin * dt;
        const suolo = GROUND_Y + c.size * 0.35;
        if (c.y <= suolo) {
          c.y = suolo;
          c.aTerra = true;
          c.life = Math.min(c.life, TREE.groundFade);
        }
      }
      f[j++] = c;
    }
    f.length = j;
  }
}

// ------------------------------------------------------------------ geometria delle curve

/**
 * Curva rastremata: `pts` punti della linea mediana, `ws` larghezze.
 * I punti sono a passo uniforme, quindi il parametro t ∈ [0,1] si mappa sull'indice.
 */
function at(curve, t) {
  const { pts } = curve;
  const f = Math.min(Math.max(t, 0), 1) * (pts.length - 1);
  const i = Math.min(Math.floor(f), pts.length - 2);
  const u = f - i;
  return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * u, y: pts[i].y + (pts[i + 1].y - pts[i].y) * u };
}

function widthAt(curve, t) {
  const { ws } = curve;
  const f = Math.min(Math.max(t, 0), 1) * (ws.length - 1);
  const i = Math.min(Math.floor(f), ws.length - 2);
  return ws[i] + (ws[i + 1] - ws[i]) * (f - i);
}

/** Direzione (angolo) della curva in t. */
function angleAt(curve, t) {
  const a = at(curve, Math.max(0, t - 0.03));
  const b = at(curve, Math.min(1, t + 0.03));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Bordi sinistro/destro della curva al punto i (rispetto al verso di percorrenza). */
export function side(curve, i) {
  const { pts, ws } = curve;
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const h = ws[i] / 2;
  const p = pts[i];
  return { l: { x: p.x + nx * h, y: p.y + ny * h }, r: { x: p.x - nx * h, y: p.y - ny * h } };
}

/** Tronco: sale sinuoso (onda che parte da zero alla base), largo alla base con un piede svasato. */
function buildTrunk(x, y0, H, w, sway) {
  const N = 16;
  const phase = rand(0, Math.PI * 2);
  const freq = rand(0.7, 0.95); // poco meno di un'onda intera sull'altezza
  const lean = rand(-0.15, 0.15);
  const pts = [];
  const ws = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    const off = sway * (Math.sin(2 * Math.PI * freq * s + phase) - Math.sin(phase)) + lean * s * H * 0.1;
    pts.push({ x: x + off, y: y0 + s * H });
    const flare = Math.max(0, 1 - s * 6) ** 2; // piede del tronco
    const tip = Math.max(0, (s - 0.8) / 0.2) ** 1.5; // in cima si assottiglia come un ramo
    ws.push(w * (1.25 - 0.8 * s + 0.6 * flare) * (1 - 0.6 * tip));
  }
  return { pts, ws };
}

/**
 * Ramo morbido: dalla base `p0` nella direzione `ang` per `len` metri; si incurva di `bend`
 * (arco) con un'ondulazione `wiggle`; la larghezza passa da w0 a w1.
 */
function curvyBranch(p0, ang, len, w0, w1, bend, wiggle, level) {
  const M = 12;
  const phase = rand(0, Math.PI * 2);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const pts = [];
  const ws = [];
  for (let k = 0; k <= M; k++) {
    const s = k / M;
    const off = bend * Math.sin(Math.PI * s) + wiggle * Math.sin(3 * Math.PI * s + phase) * s;
    pts.push({ x: p0.x + ux * len * s - uy * off, y: p0.y + uy * len * s + ux * off });
    ws.push(w0 + (w1 - w0) * s ** 0.8);
  }
  return { pts, ws, len, level };
}

/**
 * Struttura dei rami: livello 0 = rami principali (spessi), 1 = rametti, 2 = ramoscelli.
 * Un ramo principale per ogni lobo della chioma, che parte dal tronco sinuoso.
 */
function buildBranches(trunk, x, topY, circles) {
  const out = [];
  const H = trunk.pts.at(-1).y - trunk.pts[0].y;
  for (const c of circles) {
    // punto di partenza sul tronco, nella parte alta
    const s0 = Math.min(0.97, (topY - 0.4 + rand(0, 1.1) - trunk.pts[0].y) / H);
    const p0 = at(trunk, s0);
    // il ramo principale arriva verso il bordo esterno del lobo
    const tx = c.x + (c.x - x) * 0.45;
    const ty = c.y + c.r * 0.55;
    const ang = Math.atan2(ty - p0.y, tx - p0.x);
    const len = Math.hypot(tx - p0.x, ty - p0.y);
    const w0 = widthAt(trunk, s0) * 0.55;
    const main = curvyBranch(p0, ang, len, w0, 0.05, TREE.branchBend * rand(0.5, 1) * sign(), TREE.branchWiggle, 0);
    out.push(main);

    const twigs = 3 + Math.round(random());
    for (let i = 0; i < twigs; i++) {
      const t = 0.3 + (i / twigs) * 0.6 + rand(-0.05, 0.05);
      const p = at(main, t);
      const sd = i % 2 ? 1 : -1;
      const a = angleAt(main, t) + sd * rand(0.5, 0.95);
      const tw = curvyBranch(
        p, a, c.r * rand(0.6, 0.95), widthAt(main, t) * 0.65, 0.025,
        TREE.branchBend * 0.5 * rand(0.4, 1) * sign(), TREE.branchWiggle * 0.6, 1,
      );
      out.push(tw);
      // ramoscello in punta
      const u = rand(0.55, 0.8);
      out.push(
        curvyBranch(
          at(tw, u), angleAt(tw, u) + sd * rand(0.35, 0.7), c.r * rand(0.25, 0.45), widthAt(tw, u) * 0.7, 0.015,
          TREE.branchBend * 0.25 * sign(), 0.03, 2,
        ),
      );
    }
  }
  return out;
}

// ------------------------------------------------------------------ cristalli

const SIDE_SHAPES = ['fiocco', 'stella', 'gemma', 'esagono'];

/** Forma a caso con le frequenze di TREE.shapes. */
function pickShape() {
  const entries = Object.entries(TREE.shapes);
  let r = random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return 'fiocco';
}

/** Dimensione tipica di ogni forma (m): raggio, o lunghezza per la stalattite. */
const SIZE = {
  fiocco: [0.11, 0.17],
  stella: [0.1, 0.16],
  gemma: [0.1, 0.15],
  esagono: [0.08, 0.12],
  goccia: [0.05, 0.08],
  stalattite: [0.22, 0.45],
  neve: [0.08, 0.12],
};

/**
 * Cristalli lungo i rami. Sul ramo principale solo verso la punta, sui rametti e ramoscelli
 * per tutta la lunghezza, a passo irregolare e alternati sui due lati; in punta un grappolo.
 * Il punto (x, y) è il centro della forma, usato anche per le collisioni.
 */
function growCrystals(branches, step) {
  const out = [];
  const add = (shape, x, y, big = false) => {
    const [a, b] = SIZE[shape];
    const size = rand(a, b) * (big ? 1.3 : 1) * TREE.crystalScale;
    const hanging = shape === 'goccia' || shape === 'stalattite';
    out.push({ shape, x, y, size, rot: hanging ? 0 : rand(0, Math.PI * 2), k: random(), alive: true });
    return size;
  };

  for (const b of branches) {
    const from = b.level === 0 ? 0.6 : 0.25;
    let t = from + rand(0, 0.1);
    let sd = sign();
    while (t < 0.95) {
      const p = at(b, t);
      const w = widthAt(b, t);
      const shape = pickShape();
      if (shape === 'goccia' || shape === 'stalattite') {
        // appesa sotto il ramo: il centro sta sotto il bordo inferiore
        const [a, z] = SIZE[shape];
        const s = rand(a, z);
        const drop = shape === 'stalattite' ? s / 2 : s * 1.4; // posizione dalla misura base: il gioco non cambia
        out.push({ shape, x: p.x, y: p.y - w / 2 - drop, size: s * TREE.crystalScale, rot: 0, k: random(), alive: true });
      } else if (shape === 'neve') {
        // cuscinetto appoggiato sopra il ramo
        const [a, z] = SIZE.neve;
        const s = rand(a, z);
        out.push({ shape, x: p.x, y: p.y + w / 2 + s * 0.55, size: s * TREE.crystalScale, rot: rand(-0.3, 0.3), k: random(), alive: true });
      } else {
        const ang = angleAt(b, t);
        const off = rand(0.1, 0.22) * sd;
        add(shape, p.x - Math.sin(ang) * off, p.y + Math.cos(ang) * off);
        sd = -sd;
      }
      t += (step * rand(0.6, 1.3)) / b.len;
    }
    // Grappolo in punta (più ricco sui ramoscelli): forme "da lato", la prima più grande
    const tip = at(b, 1);
    const n = b.level === 2 ? 3 : b.level === 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const r = i === 0 ? rand(0, 0.06) : rand(0.16, 0.26);
      const shape = SIDE_SHAPES[Math.floor(random() * SIDE_SHAPES.length)];
      add(shape, tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r, i === 0);
    }
  }
  return out;
}
