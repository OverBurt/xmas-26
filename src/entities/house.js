import { Polygon, Vec2 } from 'planck';
import { GROUND_Y, HOUSE } from '../config.js';
import { centroid, GAP } from '../physics/polygon.js';
import { createIceBody } from '../physics/fracture.js';

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
 *    chimney: {pos, bottom, top, h, tilt, points},
 *    y: quota del terreno (default 0),
 *    snowCap: bool (cappello di neve sul camino), doorDrift: bool (cumulo davanti alla porta) }
 *  chimney.pos: posizione lungo la falda sinistra (0 = gronda, 1 = colmo)
 *  chimney.bottom/top: larghezza interna alla base e in cima; tilt: gradi verso sinistra
 */
// Misure in config.js (HOUSE); esportate anche per il disegno (src/render/houseDraw.js, hudDraw.js).
export const WALL = HOUSE.wall;
export const EAVE = HOUSE.eave;
export const CHIMNEY_WALL = HOUSE.chimneyWall;
export const PANE = HOUSE.pane; // mezzo spessore del vetro
const ZONE_DEPTH = HOUSE.zoneDepth;
const DOOR_REACH = HOUSE.doorReach;

/**
 * Neve che tappa un'apertura: dorme finché non viene colpita, i suoi pezzi si sciolgono presto.
 * `apertura` ('chimney' | 'door') e la posizione iniziale servono solo all'etichetta "tappato" (hudDraw).
 */
function snowPlug(pw, poly, x, y, angle, apertura) {
  const b = createIceBody(pw, poly, x, y, angle, 0, false, 'snow');
  const ud = b.getUserData();
  ud.plug = true;
  ud.apertura = apertura;
  ud.x0 = x;
  ud.y0 = y;
  return b;
}

/**
 * L'apertura di tipo `tipo` della casa è ancora tappata dalla neve? Sì finché il suo tappo esiste
 * (non si è rotto) ed è rimasto vicino al posto di partenza (HOUSE.plugMoved).
 */
export function isPlugged(house, tipo) {
  for (const b of house.plugs) {
    const ud = b.getUserData();
    if (ud.apertura !== tipo || ud.dead) continue;
    const p = b.getPosition();
    if (Math.hypot(p.x - ud.x0, p.y - ud.y0) < HOUSE.plugMoved) return true;
  }
  return false;
}

export function buildHouse(pw, def) {
  const { x, w, h, roof, lean = 0, door, windows = [], chimney } = def;
  const g = GROUND_Y + (def.y || 0); // quota del terreno sotto la casa (case su una collina)
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
  const plugs = [];

  // Aperture: zona dietro il muro + vetro al centro dello spessore
  for (const gap of gaps) {
    zones.push({
      type: gap.type,
      points: gap.points,
      // Finestre: basta che il centro del pacco superi il vetro.
      // Porta: conta già un pacco arrivato a contatto (rotolando o scivolando a terra).
      poly: leftQuad(gap.y0, gap.y1, gap.type === 'door' ? WALL / 2 - DOOR_REACH : WALL / 2, WALL + ZONE_DEPTH),
      glow: 0,
    });
    const pane = leftQuad(gap.y0, gap.y1, WALL / 2 - PANE, WALL / 2 + PANE);
    const c = centroid(pane);
    const pb = pw.world.createBody({ type: 'static', position: new Vec2(c.x, c.y) });
    const local = pane.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
    pb.createFixture({ shape: new Polygon(local.map((p) => new Vec2(p.x, p.y))), friction: 0.3, restitution: 0.1 });
    pb.setUserData({ kind: 'glass', pane: true, opening: gap.type, poly: local, broken: false });
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
    // Le pareti del camino sono marcate: un pacco che ne tocca il lato interno è consegnato
    poly(wallL).setUserData({ part: 'chimney' });
    poly(wallR).setUserData({ part: 'chimney' });
    zones.push({
      type: 'chimney',
      points: chimney.points,
      poly: [T(-bw, below), T(bw, below), T(tw, H - 0.25), T(-tw, H - 0.25)],
      glow: 0,
    });
    chimneyGeom = {
      wallL,
      wallR,
      mouth: [T(-tw, H), T(tw, H)],
      top: T(0, H),
      angle: a,
      // facce interne del condotto (dalla falda alla bocca): toccarle, spigolo compreso, vale la consegna
      inner: [
        [T(-bw, below), T(-tw, H)],
        [T(bw, below), T(tw, H)],
      ],
    };

    // Cappello di neve che tappa il camino: va fatto cadere o sbriciolato prima di poterci entrare
    if (def.snowCap) {
      const hw = tw + CHIMNEY_WALL + 0.12;
      const lid = [
        { x: -hw, y: -0.16 },
        { x: hw, y: -0.16 },
        { x: hw * 0.9, y: 0.08 },
        { x: hw * 0.5, y: 0.2 },
        { x: -hw * 0.5, y: 0.2 },
        { x: -hw * 0.9, y: 0.08 },
      ];
      const c = T(0, H + 0.16 + GAP);
      plugs.push(snowPlug(pw, lid, c.x, c.y, a, 'chimney'));
    }
  }

  // Cumulo di neve contro la porta (spinto dal vento): copre il vetro finché non viene sfondato
  if (def.doorDrift && door) {
    const dh = Math.min(door.h * 0.75, 1.35);
    const right = (yy) => xl(yy) + WALL / 2 - PANE - GAP;
    const world = [P(x - 1.6, 0), P(right(0), 0), P(right(dh), dh), P(x - 0.45, dh)];
    const c = centroid(world);
    plugs.push(snowPlug(pw, world.map((p) => ({ x: p.x - c.x, y: p.y - c.y })), c.x, c.y + GAP, 0, 'door'));
  }

  body.setUserData({ kind: 'house' });
  const interior = [P(xl(0) + WALL, 0), P(xr(0) - WALL, 0), P(xr(h) - WALL, h), P(xl(h) + WALL, h)];
  return { body, def, zones, panes, plugs, interior, chimney: chimneyGeom, served: 0 };
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
