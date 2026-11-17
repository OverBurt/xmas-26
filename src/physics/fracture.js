import { Polygon, Vec2 } from 'planck';
import { ICE, GLASS, FRACTURE, GIFTS } from '../config.js';
import { area, centroid, splitByLine, sanitize } from './polygon.js';

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Pre-frattura di un poligono convesso (coordinate locali del corpo).
 * Tagli trasversali leggermente inclinati lungo l'asse più lungo → schegge a trapezio,
 * più a volte un taglio diagonale che crea una scheggia appuntita.
 * Restituisce l'elenco dei pezzi (stesse coordinate) o null se il pezzo è troppo piccolo per rompersi.
 */
export function prefracture(poly, level) {
  if (level >= FRACTURE.maxLevel) return null;

  // Asse principale = direzione del lato più lungo
  let ax = 1;
  let ay = 0;
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l > best) {
      best = l;
      ax = (b.x - a.x) / l;
      ay = (b.y - a.y) / l;
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of poly) {
    const t = v.x * ax + v.y * ay;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const L = max - min;
  if (L < FRACTURE.minLength) return null;

  const n = level === 0 ? Math.max(2, Math.min(4, Math.round(L / 0.45))) : 2;
  let pieces = [poly];
  const c = centroid(poly);
  const cAxis = c.x * ax + c.y * ay;

  for (let i = 1; i < n; i++) {
    const s = min + L * (i / n + rand(-0.12, 0.12) / n);
    const p = { x: c.x + ax * (s - cAxis), y: c.y + ay * (s - cAxis) };
    const tilt = rand(-0.45, 0.45);
    const nrm = { x: ax * Math.cos(tilt) - ay * Math.sin(tilt), y: ax * Math.sin(tilt) + ay * Math.cos(tilt) };
    pieces = cutAll(pieces, p, nrm);
  }

  // Scheggia diagonale su un pezzo a caso
  if (level === 0 && Math.random() < 0.6 && pieces.length) {
    const i = Math.floor(Math.random() * pieces.length);
    const pc = centroid(pieces[i]);
    const tilt = rand(-0.3, 0.3);
    const px = -ay;
    const py = ax;
    const nrm = { x: px * Math.cos(tilt) - py * Math.sin(tilt), y: px * Math.sin(tilt) + py * Math.cos(tilt) };
    const split = cutAll([pieces[i]], pc, nrm);
    if (split.length === 2) pieces.splice(i, 1, ...split);
  }

  return pieces.length >= 2 ? pieces : null;
}

function cutAll(pieces, p, n) {
  const out = [];
  for (const piece of pieces) {
    const [a, b] = splitByLine(piece, p, n);
    const sa = sanitize(a);
    const sb = sanitize(b);
    if (sa && sb) out.push(sa, sb);
    else out.push(piece); // taglio degenere: il pezzo resta intero
  }
  return out;
}

const MATERIALS = { ice: ICE, glass: GLASS };

/**
 * Crea un corpo poligonale di ghiaccio o vetro (forma locale, centrata sull'origine del corpo).
 * Le schegge di vetro non si rompono più.
 */
export function createIceBody(pw, poly, x, y, angle, level, awake = true, material = 'ice') {
  const m = MATERIALS[material];
  const body = pw.world.createBody({ type: 'dynamic', position: new Vec2(x, y), angle, awake });
  body.createFixture({
    shape: new Polygon(poly.map((v) => new Vec2(v.x, v.y))),
    density: m.density,
    friction: m.friction,
    restitution: m.restitution,
  });
  body.setUserData({
    kind: material,
    level,
    poly,
    area: Math.abs(area(poly)),
    pieces: material === 'ice' ? prefracture(poly, level) : null,
    flash: 0,
    life: undefined, // definita per i detriti che svaniscono
  });
  return body;
}

/**
 * Gestore delle rotture: durante lo step raccoglie gli impulsi oltre soglia,
 * dopo lo step sostituisce le lastre con i loro pezzi (il mondo non si può modificare dentro lo step).
 */
export class Fracture {
  constructor(pw, particles) {
    this.pw = pw;
    this.particles = particles;
    this.queue = new Map();
    this.broken = 0;
  }

  /** Chiamata da post-solve. `other` è l'altro corpo del contatto. */
  hit(body, impulse, other) {
    const ud = body.getUserData();
    if (!ud || ud.kind !== 'ice' || !ud.pieces || ud.dead) return;
    const o = other.getUserData();
    // I pacchi hanno un moltiplicatore di danno (il piccolo quasi non rompe, il grande sfonda).
    const k = o && o.kind === 'gift' ? GIFTS[o.type].damage : 1;
    const eff = impulse * k;
    const threshold = ICE.breakImpulse * FRACTURE.levelFactor ** ud.level;
    if (eff > threshold) this.queue.set(body, Math.max(this.queue.get(body) || 0, eff));
  }

  /**
   * Applica le rotture in coda.
   * @param {number} dynamicCount corpi dinamici attuali (per rispettare il budget)
   * @returns {{removed: any[], added: any[]}}
   */
  process(dynamicCount) {
    const removed = [];
    const added = [];
    if (!this.queue.size) return { removed, added };

    // Prima i colpi più forti, finché c'è budget.
    const list = [...this.queue].sort((a, b) => b[1] - a[1]);
    this.queue.clear();
    let count = dynamicCount;
    for (const [body, eff] of list) {
      const ud = body.getUserData();
      if (ud.dead) continue;
      if (count + ud.pieces.length - 1 > FRACTURE.maxBodies) break;
      const pieces = this.shatter(body, eff);
      removed.push(body);
      added.push(...pieces);
      count += pieces.length - 1;
      this.broken++;
    }
    return { removed, added };
  }

  shatter(body, eff) {
    const ud = body.getUserData();
    const pos = body.getPosition().clone();
    const angle = body.getAngle();
    const v = body.getLinearVelocity().clone();
    const w = body.getAngularVelocity();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ud.dead = true;
    this.pw.destroyBody(body);

    // Più forte il colpo, più i pezzi si separano (limitato)
    const kick = Math.min(FRACTURE.kick * (eff / ICE.breakImpulse), FRACTURE.kick * 3);
    const out = [];
    for (const piece of ud.pieces) {
      const c = centroid(piece);
      const local = piece.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
      const rx = c.x * cos - c.y * sin;
      const ry = c.x * sin + c.y * cos;
      const nb = createIceBody(this.pw, local, pos.x + rx, pos.y + ry, angle, ud.level + 1);
      const rl = Math.hypot(rx, ry) || 1;
      nb.setLinearVelocity(new Vec2(v.x - w * ry + (rx / rl) * kick * rand(0.3, 1), v.y + w * rx + (ry / rl) * kick * rand(0.3, 1)));
      nb.setAngularVelocity(w + rand(-2, 2));
      const nud = nb.getUserData();
      nud.flash = ud.flash;
      if (nud.area < FRACTURE.debrisArea) nud.life = FRACTURE.debrisLife + rand(0, 1.5);
      out.push(nb);
    }
    this.particles?.burst(pos.x, pos.y, 10, Math.min(2 + kick, 6));
    return out;
  }

  /** Detriti piccoli: svaniscono dopo qualche secondo. Restituisce i corpi rimossi. */
  updateDebris(slabs, dt) {
    const removed = [];
    for (const b of slabs) {
      const ud = b.getUserData();
      if (ud.life === undefined || ud.dead) continue;
      ud.life -= dt;
      if (ud.life <= 0) {
        const p = b.getPosition();
        this.particles?.burst(p.x, p.y, 3, 1);
        ud.dead = true;
        this.pw.destroyBody(b);
        removed.push(b);
      }
    }
    return removed;
  }
}
