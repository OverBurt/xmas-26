import { Polygon, Circle, Vec2 } from 'planck';
import { ICE, GLASS, SNOW, SNOWMAN, FRACTURE, GIFTS } from '../config.js';
import { area, centroid, splitByLine, sanitize } from './polygon.js';
import { random } from '../core/rng.js';

const rand = (a, b) => a + random() * (b - a);

// ---------------------------------------------------------------- pre-frattura

/**
 * Ghiaccio: tagli trasversali leggermente inclinati lungo l'asse più lungo → schegge a trapezio,
 * più a volte un taglio diagonale che crea una scheggia appuntita.
 * Restituisce l'elenco dei pezzi (stesse coordinate locali) o null se il pezzo non si rompe più.
 */
export function prefracture(poly, level) {
  if (level >= FRACTURE.maxLevel) return null;
  const { ax, ay, min, L } = mainAxis(poly);
  if (L < FRACTURE.minLength) return null;

  const n = level === 0 ? Math.max(2, Math.min(4, Math.round(L / 0.45))) : 2;
  let pieces = [poly];
  const c = centroid(poly);
  const cAxis = c.x * ax + c.y * ay;
  for (let i = 1; i < n; i++) {
    const s = min + L * (i / n + rand(-0.12, 0.12) / n);
    const p = { x: c.x + ax * (s - cAxis), y: c.y + ay * (s - cAxis) };
    pieces = cutAll(pieces, p, rotate({ x: ax, y: ay }, rand(-0.45, 0.45)));
  }
  if (level === 0 && random() < 0.6 && pieces.length) {
    const i = Math.floor(random() * pieces.length);
    const split = cutAll([pieces[i]], centroid(pieces[i]), rotate({ x: -ay, y: ax }, rand(-0.3, 0.3)));
    if (split.length === 2) pieces.splice(i, 1, ...split);
  }
  return pieces.length >= 2 ? pieces : null;
}

/**
 * Neve: 1–2 tagli irregolari in direzioni qualsiasi (zolle tozze, non schegge),
 * poi gli spigoli vengono smussati per un aspetto "a grumo".
 */
export function snowPieces(poly, level) {
  const a = Math.abs(area(poly));
  if (level >= 2 || a < 0.08) return null;

  // Assi di neve (pezzi lunghi e sottili): si spezzano di traverso, in tronconi irregolari
  const { ax, ay, min, L } = mainAxis(poly);
  if (L * L > 4 * a) {
    const n = Math.max(2, Math.min(level === 0 ? 5 : 2, Math.round(L / 0.6)));
    const c0 = centroid(poly);
    const cAxis = c0.x * ax + c0.y * ay;
    let pieces = [poly];
    for (let i = 1; i < n; i++) {
      const s = min + L * (i / n + rand(-0.15, 0.15) / n);
      const p = { x: c0.x + ax * (s - cAxis), y: c0.y + ay * (s - cAxis) };
      pieces = cutAll(pieces, p, rotate({ x: ax, y: ay }, rand(-0.5, 0.5)));
    }
    pieces = pieces.map(lumpify);
    return pieces.length >= 2 ? pieces : null;
  }

  const c = centroid(poly);
  const size = Math.sqrt(a);
  const cuts = level === 0 ? 2 : 1;
  let pieces = [poly];
  let ang = rand(0, Math.PI);
  for (let i = 0; i < cuts; i++) {
    const p = { x: c.x + rand(-0.2, 0.2) * size, y: c.y + rand(-0.2, 0.2) * size };
    pieces = cutAll(pieces, p, { x: Math.cos(ang), y: Math.sin(ang) });
    ang += Math.PI / 2 + rand(-0.5, 0.5);
  }
  pieces = pieces.map(lumpify);
  return pieces.length >= 2 ? pieces : null;
}

/** Smussa 1–2 spigoli di un pezzo convesso (resta convesso). */
function lumpify(poly) {
  let out = poly;
  const chops = random() < 0.5 ? 1 : 2;
  for (let k = 0; k < chops && out.length < 7; k++) {
    const i = Math.floor(random() * out.length);
    const prev = out[(i + out.length - 1) % out.length];
    const v = out[i];
    const next = out[(i + 1) % out.length];
    const t1 = rand(0.15, 0.3);
    const t2 = rand(0.15, 0.3);
    const a = { x: v.x + (prev.x - v.x) * t1, y: v.y + (prev.y - v.y) * t1 };
    const b = { x: v.x + (next.x - v.x) * t2, y: v.y + (next.y - v.y) * t2 };
    const cand = [...out.slice(0, i), a, b, ...out.slice(i + 1)];
    const ok = sanitize(cand);
    if (ok) out = ok;
  }
  return out;
}

function mainAxis(poly) {
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
  return { ax, ay, min, L: max - min };
}

const rotate = (v, t) => ({ x: v.x * Math.cos(t) - v.y * Math.sin(t), y: v.x * Math.sin(t) + v.y * Math.cos(t) });

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

/** Ottagono che approssima un cerchio (per sbriciolare le palle di neve in zolle). */
function octagon(r) {
  const out = [];
  for (let i = 0; i < 8; i++) out.push({ x: Math.cos((i * Math.PI) / 4) * r, y: Math.sin((i * Math.PI) / 4) * r });
  return out;
}

// ---------------------------------------------------------------- corpi

const MATERIALS = { ice: ICE, glass: GLASS, snow: SNOW };

/**
 * Crea un corpo poligonale di ghiaccio, neve o vetro (forma locale, centrata sull'origine del corpo).
 * Le schegge di vetro non si rompono più.
 */
export function createIceBody(pw, poly, x, y, angle, level, awake = true, material = 'ice', dens = 1) {
  const m = MATERIALS[material];
  const body = pw.world.createBody({ type: 'dynamic', position: new Vec2(x, y), angle, awake });
  body.createFixture({
    shape: new Polygon(poly.map((v) => new Vec2(v.x, v.y))),
    density: m.density * dens,
    friction: m.friction,
    restitution: m.restitution,
  });
  let pieces = null;
  if (material === 'ice') pieces = prefracture(poly, level);
  else if (material === 'snow') pieces = snowPieces(poly, level);
  body.setUserData({
    kind: material,
    level,
    poly,
    area: Math.abs(area(poly)),
    pieces,
    dens, // moltiplicatore di densità (neve compattata alla base dei fortini alti): scala anche la soglia di rottura
    flash: 0,
    life: undefined, // definita per i detriti che svaniscono
  });
  return body;
}

/**
 * Blocco di neve composto da più poligoni convessi (es. il riempimento sopra un arco, che è concavo).
 * Quando si rompe, ogni poligono diventa una zolla a sé.
 */
export function createSnowCompound(pw, polys, x, y, angle = 0, awake = false, dens = 1) {
  const body = pw.world.createBody({ type: 'dynamic', position: new Vec2(x, y), angle, awake });
  for (const poly of polys) {
    body.createFixture({
      shape: new Polygon(poly.map((v) => new Vec2(v.x, v.y))),
      density: SNOW.density * dens,
      friction: SNOW.friction,
      restitution: SNOW.restitution,
    });
  }
  body.setUserData({
    kind: 'snow',
    level: 0,
    area: polys.reduce((a, p) => a + Math.abs(area(p)), 0),
    pieces: polys,
    dens,
    flash: 0,
    life: undefined,
  });
  return body;
}

/** Palla di neve (dal pupazzo): rotola, e con un colpo deciso si sbriciola. */
export function createSnowball(pw, r, x, y, angle, role) {
  const body = pw.world.createBody({ type: 'dynamic', position: new Vec2(x, y), angle });
  body.createFixture({ shape: new Circle(r), density: SNOW.density, friction: SNOW.friction, restitution: SNOW.restitution });
  body.setAngularDamping(0.6);
  body.setUserData({ kind: 'snow', ball: true, r, role, level: 1, area: Math.PI * r * r, pieces: null, flash: 0 });
  return body;
}

// ---------------------------------------------------------------- gestore

/**
 * Gestore delle rotture: durante lo step raccoglie gli impulsi oltre soglia,
 * dopo lo step sostituisce i corpi con i loro pezzi (il mondo non si può modificare dentro lo step).
 */
export class Fracture {
  constructor(pw, particles) {
    this.pw = pw;
    this.particles = particles;
    this.queue = new Map(); // body → {eff, by}
    this.broken = 0;
    this.brokenArea = 0; // m² di neve/ghiaccio rotto (punteggio proporzionale alla superficie)
    /** Pacchi che hanno sfondato la neve in questo step (vengono rallentati). */
    this.absorbed = new Set();
    /**
     * Callback ({materiale, area, x, y, pezzi, forza, daPacco}) per ogni rottura applicata, chiamata da process()
     * cioè dopo lo step (mai dentro le callback di contatto). La usa Game per l'evento 'rottura'.
     */
    this.onBreak = null;
  }

  threshold(ud) {
    if (ud.kind === 'snowman') return SNOWMAN.splitImpulse;
    // la soglia scala con la densità: a parità di colpo un mattone più pesante non diventa più fragile
    if (ud.kind === 'snow') return ud.ball ? SNOWMAN.ballImpulse : SNOW.breakImpulse * SNOW.levelFactor ** ud.level * (ud.dens ?? 1);
    if (ud.kind === 'ice') return ud.pieces ? ICE.breakImpulse * FRACTURE.levelFactor ** ud.level : Infinity;
    return Infinity;
  }

  /** Chiamata da post-solve. `other` è l'altro corpo del contatto. */
  hit(body, impulse, other, speed = Infinity) {
    const ud = body.getUserData();
    if (!ud || ud.dead) return;
    // Corpi che poggiano l'uno sull'altro (assestamento di una pila alta) non si rompono:
    // serve un urto vero, con i due corpi che si vengono incontro abbastanza in fretta.
    if (speed < FRACTURE.minImpactSpeed) return;
    const o = other.getUserData();
    // I pacchi hanno un moltiplicatore di danno (il piccolo quasi non rompe, il grande sfonda).
    const k = o && o.kind === 'gift' ? GIFTS[o.type].damage : 1;
    const eff = impulse * k;
    let threshold = this.threshold(ud);
    // La neve che cade a terra (o su una collina) si sbriciola molto più facilmente
    const snowy = ud.kind === 'snow' || ud.kind === 'snowman';
    if (snowy && (o?.kind === 'ground' || o?.kind === 'hill')) threshold *= SNOW.groundFactor;
    if (eff <= threshold) return;
    const prev = this.queue.get(body);
    if (!prev || eff > prev.eff) this.queue.set(body, { eff, by: o?.kind === 'gift' ? other : prev?.by });
  }

  /**
   * Applica le rotture in coda.
   * @param {number} dynamicCount corpi dinamici attuali (per rispettare il budget)
   * @returns {{added: any[]}}
   */
  process(dynamicCount) {
    const added = [];
    if (!this.queue.size) return { added };

    // Prima i colpi più forti, finché c'è budget.
    const list = [...this.queue].sort((a, b) => b[1].eff - a[1].eff);
    this.queue.clear();
    let count = dynamicCount;
    let done = 0;
    for (const [body, hit] of list) {
      const { eff, by } = hit;
      const ud = body.getUserData();
      if (ud.dead) continue;
      // Al massimo maxPerStep rotture per step: le altre restano in coda per gli step successivi
      // (un crollo grande non crea decine di corpi nello stesso frame → niente scatti)
      if (done >= FRACTURE.maxPerStep) {
        this.queue.set(body, hit);
        continue;
      }
      done++;
      const extra = ud.pieces ? ud.pieces.length - 1 : ud.kind === 'snowman' ? 2 : 0;
      if (count + extra > FRACTURE.maxBodies) continue; // salta solo le rotture che aggiungono corpi

      const at = body.getPosition();
      const x = at.x;
      const y = at.y;
      let pieces;
      if (ud.kind === 'snowman') pieces = this.splitSnowman(body);
      else if (ud.pieces) pieces = this.shatter(body, eff, ud.pieces);
      else if (ud.ball && ud.r > 0.33) pieces = this.shatter(body, eff, snowPieces(octagon(ud.r), 1) || [octagon(ud.r)]);
      else pieces = this.crumble(body);

      added.push(...pieces);
      count += pieces.length - 1;
      if (ud.kind !== 'snowman') {
        this.broken++;
        this.brokenArea += ud.area || 0;
      }
      if ((ud.kind === 'snow' || ud.kind === 'snowman') && by && !by.getUserData()?.dead) this.absorbed.add(by);
      this.onBreak?.({ materiale: ud.kind, area: ud.area || 0, x, y, pezzi: pieces.length, forza: eff, daPacco: !!by });
    }

    // La neve frena il pacco che la sfonda
    for (const g of this.absorbed) {
      const v = g.getLinearVelocity();
      g.setLinearVelocity(new Vec2(v.x * SNOW.absorb, v.y * SNOW.absorb));
    }
    this.absorbed.clear();
    return { added };
  }

  shatter(body, eff, piecesDef) {
    const ud = body.getUserData();
    const material = ud.kind;
    const M = material === 'snow' ? SNOW : FRACTURE;
    const pos = body.getPosition().clone();
    const angle = body.getAngle();
    const v = body.getLinearVelocity().clone();
    const w = body.getAngularVelocity();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ud.dead = true;
    this.pw.destroyBody(body);

    // Più forte il colpo, più i pezzi si separano (limitato)
    const base = material === 'snow' ? SNOW.breakImpulse : ICE.breakImpulse;
    const kick = Math.min(M.kick * (eff / base), M.kick * 3);
    const out = [];
    for (const piece of piecesDef) {
      const c = centroid(piece);
      const local = piece.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
      const rx = c.x * cos - c.y * sin;
      const ry = c.x * sin + c.y * cos;
      const nb = createIceBody(this.pw, local, pos.x + rx, pos.y + ry, angle, (ud.level ?? 0) + 1, true, material, ud.dens ?? 1);
      const rl = Math.hypot(rx, ry) || 1;
      nb.setLinearVelocity(new Vec2(v.x - w * ry + (rx / rl) * kick * rand(0.3, 1), v.y + w * rx + (ry / rl) * kick * rand(0.3, 1)));
      nb.setAngularVelocity(w + rand(-2, 2));
      const nud = nb.getUserData();
      nud.flash = ud.flash;
      if (ud.plug) nud.life = M.debrisLife + rand(0, 0.8); // i cumuli sulle aperture si sciolgono via presto
      else if (nud.area < M.debrisArea) nud.life = M.debrisLife + rand(0, 1.5);
      out.push(nb);
    }
    if (material === 'snow') this.powder(pos.x, pos.y, 14 + Math.round(ud.area * 30), 1.5 + kick);
    else this.particles?.burst(pos.x, pos.y, 10, Math.min(2 + kick, 6));
    return out;
  }

  /** Il pezzo di neve si disfa in polvere. */
  crumble(body) {
    const ud = body.getUserData();
    const p = body.getPosition();
    this.powder(p.x, p.y, 8 + Math.round(ud.area * 40), 1.5);
    ud.dead = true;
    this.pw.destroyBody(body);
    return [];
  }

  /** Il pupazzo si separa nelle sue palle (ognuna eredita la velocità del punto in cui si trova). */
  splitSnowman(body) {
    const ud = body.getUserData();
    const out = [];
    for (let f = body.getFixtureList(); f; f = f.getNext()) {
      const role = f.getUserData()?.role;
      if (!role || role === 'foot') continue;
      const sh = f.getShape();
      const wp = body.getWorldPoint(sh.getCenter());
      const v = body.getLinearVelocityFromWorldPoint(wp);
      const ball = createSnowball(this.pw, sh.getRadius(), wp.x, wp.y, body.getAngle(), role);
      ball.setLinearVelocity(new Vec2(v.x + rand(-0.3, 0.3), v.y + rand(0, 0.4)));
      ball.setAngularVelocity(body.getAngularVelocity() + rand(-1.5, 1.5));
      ball.getUserData().deco = ud.deco;
      out.push(ball);
    }
    const p = body.getPosition();
    this.powder(p.x, p.y + 0.6, 10, 1.2);
    ud.dead = true;
    this.pw.destroyBody(body);
    return out;
  }

  powder(x, y, n, speed) {
    this.particles?.burst(x, y, n, speed, '#f4f8ff', SNOW.powder);
  }

  /** Detriti piccoli: svaniscono dopo qualche secondo. Restituisce i corpi rimossi. */
  updateDebris(bodies, dt) {
    const removed = [];
    for (const b of bodies) {
      const ud = b.getUserData();
      if (ud.life === undefined || ud.dead) continue;
      ud.life -= dt;
      if (ud.life <= 0) {
        const p = b.getPosition();
        if (ud.kind === 'snow') this.powder(p.x, p.y, 5, 0.8);
        else this.particles?.burst(p.x, p.y, 3, 1);
        ud.dead = true;
        this.pw.destroyBody(b);
        removed.push(b);
      }
    }
    return removed;
  }
}
