import { Polygon, Vec2 } from 'planck';
import { GROUND_Y } from '../config.js';
import { centroid } from '../physics/polygon.js';

/**
 * Casa vista in sezione ("casa delle bambole").
 *
 * - Le pareti laterali convergono verso l'alto (`lean`): il muro sinistro, rivolto alla fionda,
 *   è inclinato e offre più superficie ai pacchi che arrivano dall'alto a sinistra.
 * - Porta e finestre sono aperture vere nel muro sinistro, chiuse da un vetro che si infrange
 *   se colpito abbastanza forte (altrimenti il pacco rimbalza).
 * - Il camino sta sulla falda sinistra, inclinato verso sinistra, e si allarga verso l'alto (imbuto).
 *
 * Un pacco è consegnato quando il suo centro entra in una "zona di consegna" (poligono convesso):
 * subito dietro porta/finestre, oppure dentro il condotto del camino.
 *
 * Definizione (JSON del livello):
 *  { x, w, h, roof, lean,
 *    door: {h, points}, windows: [{y, h, points}],
 *    chimney: {pos, bottom, top, h, tilt, points} }
 *  chimney.pos: posizione lungo la falda sinistra (0 = gronda, 1 = colmo)
 *  chimney.bottom/top: larghezza interna alla base e in cima; tilt: gradi verso sinistra
 */
export const WALL = 0.28;
const EAVE = 0.35;
const CHIMNEY_WALL = 0.14;
const ZONE_DEPTH = 0.6;
const PANE = 0.045; // mezzo spessore del vetro

export function buildHouse(pw, def) {
  const { x, w, h, roof, lean = 0, door, windows = [], chimney } = def;
  const g = GROUND_Y;
  const body = pw.world.createBody({ type: 'static' });
  const fx = { friction: 0.6, restitution: 0.2 };
  const poly = (pts) => body.createFixture({ shape: new Polygon(pts.map((p) => new Vec2(p.x, p.y))), ...fx });

  /** Bordo esterno dei muri all'altezza y (relativa al terreno). */
  const xl = (y) => x + (lean * y) / h;
  const xr = (y) => x + w - (lean * y) / h;
  const P = (px, py) => ({ x: px, y: g + py });

  // Muro sinistro: tratti pieni tra le aperture
  const gaps = [];
  if (door) gaps.push({ type: 'door', y0: 0, y1: door.h, points: door.points });
  for (const win of windows) gaps.push({ type: 'window', y0: win.y, y1: win.y + win.h, points: win.points });
  gaps.sort((a, b) => a.y0 - b.y0);
  const leftQuad = (y0, y1, a = 0, b = WALL) => [P(xl(y0) + a, y0), P(xl(y0) + b, y0), P(xl(y1) + b, y1), P(xl(y1) + a, y1)];
  let y = 0;
  for (const gap of gaps) {
    if (gap.y0 > y + 0.01) poly(leftQuad(y, gap.y0));
    y = gap.y1;
  }
  if (h > y + 0.01) poly(leftQuad(y, h));

  // Muro destro
  poly([P(xr(0) - WALL, 0), P(xr(0), 0), P(xr(h), h), P(xr(h) - WALL, h)]);

  // Tetto
  const eaveL = P(xl(h) - EAVE, h);
  const eaveR = P(xr(h) + EAVE, h);
  const apex = P((xl(h) + xr(h)) / 2, h + roof);
  poly([eaveL, eaveR, apex]);

  const zones = [];
  const panes = [];

  // Aperture: zona dietro il muro + vetro al centro dello spessore
  for (const gap of gaps) {
    zones.push({
      type: gap.type,
      points: gap.points,
      poly: leftQuad(gap.y0, gap.y1, WALL, WALL + ZONE_DEPTH),
      glow: 0,
    });
    const pane = leftQuad(gap.y0, gap.y1, WALL / 2 - PANE, WALL / 2 + PANE);
    const c = centroid(pane);
    const pb = pw.world.createBody({ type: 'static', position: new Vec2(c.x, c.y) });
    const local = pane.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    pb.createFixture({ shape: new Polygon(local.map((p) => new Vec2(p.x, p.y))), friction: 0.3, restitution: 0.1 });
    pb.setUserData({ kind: 'glass', pane: true, poly: local, broken: false });
    panes.push(pb);
  }

  // Camino a imbuto sulla falda sinistra, inclinato verso sinistra
  let chimneyGeom = null;
  if (chimney) {
    const t = chimney.pos ?? 0.35;
    const base = { x: eaveL.x + (apex.x - eaveL.x) * t, y: eaveL.y + (apex.y - eaveL.y) * t };
    const a = ((chimney.tilt ?? 0) * Math.PI) / 180; // positivo = cima verso sinistra
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const T = (lx, ly) => ({ x: base.x + lx * cos - ly * sin, y: base.y + lx * sin + ly * cos });
    const bw = chimney.bottom / 2;
    const tw = chimney.top / 2;
    const H = chimney.h;
    const below = -1.0; // le pareti affondano nel tetto
    const wallL = [T(-bw - CHIMNEY_WALL, below), T(-bw, below), T(-tw, H), T(-tw - CHIMNEY_WALL, H)];
    const wallR = [T(bw, below), T(bw + CHIMNEY_WALL, below), T(tw + CHIMNEY_WALL, H), T(tw, H)];
    poly(wallL);
    poly(wallR);
    zones.push({
      type: 'chimney',
      points: chimney.points,
      poly: [T(-bw, below), T(bw, below), T(tw, H - 0.25), T(-tw, H - 0.25)],
      glow: 0,
    });
    chimneyGeom = { wallL, wallR, mouth: [T(-tw, H), T(tw, H)], top: T(0, H) };
  }

  body.setUserData({ kind: 'house' });
  const interior = [P(xl(0) + WALL, 0), P(xr(0) - WALL, 0), P(xr(h) - WALL, h), P(xl(h) + WALL, h)];
  return { body, def, zones, panes, interior, chimney: chimneyGeom, served: 0 };
}

/** Punto dentro un poligono convesso (vertici in senso antiorario). */
function inside(poly, px, py) {
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if ((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x) < 0) return false;
  }
  return true;
}

/** Zona di consegna che contiene il punto, oppure null. */
export function zoneAt(house, px, py) {
  for (const z of house.zones) if (inside(z.poly, px, py)) return z;
  return null;
}
