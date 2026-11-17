import { Box, Vec2 } from 'planck';
import { GROUND_Y, GIFTS, TREE } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Albero alto con una chioma di cristalli di neve al posto delle foglie.
 *
 * - Il tronco è un corpo statico (il pacco ci rimbalza).
 * - I cristalli NON sono corpi fisici: sono punti fissi controllati a mano a ogni step
 *   (centinaia di cristalli costano quasi nulla). Quando un pacco ci passa attraverso,
 *   il cristallo si stacca e cade ondeggiando come una foglia, poi svanisce;
 *   ogni cristallo attraversato frena un po' il pacco (meno se il pacco è pesante).
 *   Il varco aperto resta libero per il lancio successivo.
 *
 * Definizione (JSON del livello):
 *  { x, trunkH, trunkW, crown: [{dx, dy, r}], spacing }
 *  crown: cerchi (relativi alla cima del tronco) la cui unione forma la chioma
 */
export class SnowTree {
  constructor(pw, def) {
    this.def = def;
    const { x, trunkH, trunkW = 0.7 } = def;
    this.base = { x, y: GROUND_Y };
    this.top = { x, y: GROUND_Y + trunkH };

    // Tronco: rastremato verso l'alto, prosegue un po' dentro la chioma
    const body = pw.world.createBody({ type: 'static' });
    body.createFixture({ shape: new Box(trunkW / 2, (trunkH + 1.5) / 2, new Vec2(x, GROUND_Y + (trunkH + 1.5) / 2)), friction: 0.6 });
    body.setUserData({ kind: 'tree' });
    this.body = body;

    // Rami (solo grafica): un ramo principale verso ogni lobo della chioma,
    // con 2–3 rametti laterali e qualche ramoscello in punta
    const circles = def.crown.map((c) => ({ x: x + c.dx, y: this.top.y + c.dy, r: c.r }));
    this.circles = circles;
    this.branches = buildBranches(x, this.top.y, circles);

    // Cristalli attaccati ai rami: lungo i rametti, alternati ai due lati, e a grappolo in punta
    this.crystals = growCrystals(this.branches, def.spacing ?? TREE.spacing);
    const xs = this.crystals.map((c) => c.x);
    const ys = this.crystals.map((c) => c.y);
    this.bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    this.falling = []; // cristalli staccati che cadono come foglie
    this.knocked = 0;
  }

  /**
   * Controllo dei pacchi contro i cristalli (a ogni step fisico).
   * Si usa il segmento percorso nello step (posizione precedente → attuale): anche a 24 m/s
   * il pacco non "salta" i cristalli.
   * @param {import('planck').Body[]} gifts
   * @param {Map} prev posizioni prima dello step (PhysicsWorld.prev)
   */
  collide(gifts, prev) {
    const b = this.bounds;
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
        this.falling.push({
          x: c.x,
          y: c.y,
          size: c.size,
          rot: c.rot,
          // spinta iniziale nella direzione del pacco, poi caduta lenta ondeggiante
          vx: v.x * TREE.push * rand(0.5, 1),
          vy: v.y * TREE.push * rand(0.5, 1) + rand(0, 0.6),
          spin: rand(-3, 3),
          phase: rand(0, Math.PI * 2),
          sway: rand(0.5, 1.1),
          life: rand(TREE.fallLife * 0.7, TREE.fallLife * 1.2),
        });
      }
      if (hits) {
        this.knocked += hits;
        // Ogni cristallo frena il pacco; il pacco pesante perde meno velocità.
        const keep = Math.max(0, 1 - TREE.drag / g.getMass()) ** hits;
        const v = g.getLinearVelocity();
        g.setLinearVelocity(new Vec2(v.x * keep, v.y * keep));
      }
    }
  }

  /** Cristalli che cadono come foglie (tempo reale). */
  update(dt) {
    const f = this.falling;
    let j = 0;
    for (let i = 0; i < f.length; i++) {
      const c = f[i];
      c.life -= dt;
      if (c.life <= 0 || c.y < GROUND_Y - 0.2) continue;
      // attrito dell'aria forte: la velocità tende a una caduta lenta, con ondeggiamento laterale
      const k = Math.min(1, TREE.airDrag * dt);
      c.vx += (0 - c.vx) * k;
      c.vy += (-TREE.fallSpeed - c.vy) * k;
      c.phase += dt * 3;
      c.x += (c.vx + Math.sin(c.phase) * c.sway) * dt;
      c.y += c.vy * dt;
      c.rot += (c.spin + Math.cos(c.phase) * 1.5) * dt;
      f[j++] = c;
    }
    f.length = j;
  }
}

/**
 * Cristalli lungo i rami. Sul ramo principale solo verso la punta, sui rametti e ramoscelli
 * per tutta la lunghezza, a passo irregolare e alternati sui due lati; in punta un grappolo.
 */
function growCrystals(branches, step) {
  const out = [];
  const crystal = (x, y, big = false) =>
    out.push({ x, y, size: big ? rand(0.16, 0.22) : rand(0.11, 0.17), rot: rand(0, Math.PI / 3), alive: true });

  for (const b of branches) {
    const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
    const from = b.level === 0 ? 0.6 : 0.25;
    let t = from + rand(0, 0.1);
    let side = Math.random() < 0.5 ? 1 : -1;
    while (t < 0.95) {
      const p = quad(b, t);
      const q = quad(b, Math.min(1, t + 0.02));
      const dl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const nx = -(q.y - p.y) / dl;
      const ny = (q.x - p.x) / dl;
      const off = rand(0.1, 0.22) * side;
      crystal(p.x + nx * off, p.y + ny * off);
      side = -side;
      t += (step * rand(0.6, 1.3)) / len;
    }
    // Grappolo in punta (più ricco sui ramoscelli)
    const tip = quad(b, 1);
    const n = b.level === 2 ? 3 : b.level === 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const r = i === 0 ? rand(0, 0.06) : rand(0.16, 0.26);
      crystal(tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r, i === 0);
    }
  }
  return out;
}

/** Punto su una curva quadratica. */
function quad(b, t) {
  const u = 1 - t;
  return {
    x: u * u * b.x0 + 2 * u * t * b.cx + t * t * b.x1,
    y: u * u * b.y0 + 2 * u * t * b.cy + t * t * b.y1,
  };
}

/**
 * Struttura dei rami: livello 0 = rami principali (spessi), 1 = rametti, 2 = ramoscelli.
 * Ogni ramo è una curva quadratica {x0,y0,cx,cy,x1,y1,level}.
 */
function buildBranches(x, topY, circles) {
  const out = [];
  const add = (x0, y0, ang, len, level, bend) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const mx = (x0 + x1) / 2 - Math.sin(ang) * bend;
    const my = (y0 + y1) / 2 + Math.cos(ang) * bend;
    const b = { x0, y0, cx: mx, cy: my, x1, y1, level };
    out.push(b);
    return b;
  };

  for (const c of circles) {
    const y0 = topY - 0.4 + rand(0, 1.1);
    // il ramo principale arriva verso il bordo esterno del lobo
    const tx = c.x + (c.x - x) * 0.45;
    const ty = c.y + c.r * 0.55;
    const ang = Math.atan2(ty - y0, tx - x);
    const len = Math.hypot(tx - x, ty - y0);
    const main = add(x, y0, ang, len, 0, rand(-0.3, 0.3));

    const twigs = 3 + Math.round(Math.random());
    for (let i = 0; i < twigs; i++) {
      const t = 0.3 + (i / twigs) * 0.6 + rand(-0.05, 0.05);
      const p = quad(main, t);
      const side = i % 2 ? 1 : -1;
      const a = ang + side * rand(0.5, 0.95);
      const twig = add(p.x, p.y, a, c.r * rand(0.6, 0.95), 1, rand(-0.15, 0.15));
      // ramoscello in punta
      const q = quad(twig, rand(0.55, 0.8));
      add(q.x, q.y, a + side * rand(0.35, 0.7), c.r * rand(0.25, 0.45), 2, 0);
    }
  }
  return out;
}
