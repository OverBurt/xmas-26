import { Settings } from 'planck';
import { ICE } from '../config.js';
import { createIceBody } from '../physics/fracture.js';
import { centroid } from '../physics/polygon.js';
import { buildCrystalCluster } from './iceCrystal.js';

/** Distanza a riposo tra due poligoni: i pezzi nascono già appoggiati. */
const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

/**
 * Sculture di ghiaccio da mettere in cima ai fortini: forme geometriche fatte di lastre inclinate,
 * prismi esagonali e triangolari, con i cristalli. Tutti i pezzi sono solidi e si frantumano.
 *
 * Composizioni (`kind`):
 *  - "piramide": due grandi lastre appoggiate l'una all'altra ad A, con i cristalli sotto la punta
 *  - "torre":    prisma esagonale → lastra → prisma esagonale più piccolo → prisma triangolare in cima
 *  - "ponte":    due prismi esagonali come pile, una lastra sopra, una tenda ad A e due triangoli;
 *                i cristalli stanno sotto il ponte
 * @returns {{ bodies, top }}
 */
export function buildIceSculpture(pw, kind, x0, x1, y) {
  const bodies = [];
  const cx = (x0 + x1) / 2;
  const W = x1 - x0;
  const add = (b) => (Array.isArray(b) ? bodies.push(...b) : bodies.push(b));
  let top = y;

  if (kind === 'piramide') {
    const half = Math.min(1.35, W / 2 - 0.35);
    const h = half * 1.45;
    add(tent(pw, cx, y, half, h));
    add(buildCrystalCluster(pw, cx, y, Math.min(0.85, (h - 0.35) / 1.15)));
    // due piccoli prismi triangolari agli angoli
    if (W / 2 - half > 0.5) {
      add(triPrism(pw, x0 + 0.32, y, 0.55, 0.5));
      add(triPrism(pw, x1 - 0.32, y, 0.55, 0.5));
    }
    top = y + h;
  } else if (kind === 'torre') {
    let yy = y;
    add(hexPrism(pw, cx, yy, 1.2, 0.7));
    yy += 0.7 + GAP;
    yy = slab(pw, bodies, cx - Math.min(0.7, W / 2), cx + Math.min(0.7, W / 2), yy);
    add(hexPrism(pw, cx, yy, 0.9, 0.6));
    yy += 0.6 + GAP;
    add(triPrism(pw, cx, yy, 0.8, 0.85));
    top = yy + 0.85;
  } else if (kind === 'ponte') {
    const pierW = 0.8;
    const pierH = 1.0;
    const span = Math.min(W, 4.2);
    const l = cx - span / 2;
    const r = cx + span / 2;
    add(hexPrism(pw, l + pierW / 2, y, pierW, pierH));
    add(hexPrism(pw, r - pierW / 2, y, pierW, pierH));
    add(buildCrystalCluster(pw, cx, y, 0.72));
    let yy = slab(pw, bodies, l, r, y + pierH + GAP);
    add(tent(pw, cx, yy, 0.85, 1.2));
    add(triPrism(pw, l + 0.35, yy, 0.6, 0.55));
    add(triPrism(pw, r - 0.35, yy, 0.6, 0.55));
    top = yy + 1.2;
  }
  return { bodies, top };
}

// ---------------------------------------------------------------- pezzi

/** Corpo di ghiaccio da un poligono convesso in coordinate mondo (vertici in senso antiorario). */
function iceBody(pw, world, prism = true) {
  const c = centroid(world);
  const b = createIceBody(pw, world.map((p) => ({ x: p.x - c.x, y: p.y - c.y })), c.x, c.y, 0, 0, false, 'ice');
  b.getUserData().prism = prism;
  return b;
}

/** Lastra orizzontale da x0 a x1 appoggiata a y. Restituisce la quota sopra la lastra. */
function slab(pw, bodies, x0, x1, y) {
  const t = ICE.thickness;
  bodies.push(
    iceBody(
      pw,
      [
        { x: x0, y: y + GAP },
        { x: x1, y: y + GAP },
        { x: x1, y: y + GAP + t },
        { x: x0, y: y + GAP + t },
      ],
      false,
    ),
  );
  return y + GAP + t;
}

/**
 * Tenda ad A: due lastre inclinate con la base orizzontale (poggiano di piatto)
 * e una faccia verticale in cima con cui si appoggiano l'una all'altra.
 */
function tent(pw, cx, y, half, h) {
  const t = ICE.thickness * 1.25; // spessore orizzontale della lastra
  const d = t * (h / half); // altezza della faccia di contatto in cima
  const g = GAP / 2;
  const yb = y + GAP;
  const left = [
    { x: cx - half, y: yb },
    { x: cx - half + t, y: yb },
    { x: cx - g, y: yb + h - d },
    { x: cx - g, y: yb + h },
  ];
  const right = [
    { x: cx + g, y: yb + h - d },
    { x: cx + half - t, y: yb },
    { x: cx + half, y: yb },
    { x: cx + g, y: yb + h },
  ];
  return [iceBody(pw, left, false), iceBody(pw, ccw(right), false)];
}

/** Prisma esagonale con base e cima piatte (largo w, alto h; le facce piatte sono il 70% della larghezza). */
function hexPrism(pw, cx, y, w, h) {
  const yb = y + GAP;
  const k = w * 0.15;
  return iceBody(pw, [
    { x: cx - w / 2 + k, y: yb },
    { x: cx + w / 2 - k, y: yb },
    { x: cx + w / 2, y: yb + h / 2 },
    { x: cx + w / 2 - k, y: yb + h },
    { x: cx - w / 2 + k, y: yb + h },
    { x: cx - w / 2, y: yb + h / 2 },
  ]);
}

/** Prisma triangolare con la base piatta (punta in alto). */
function triPrism(pw, cx, y, w, h) {
  const yb = y + GAP;
  return iceBody(pw, [
    { x: cx - w / 2, y: yb },
    { x: cx + w / 2, y: yb },
    { x: cx, y: yb + h },
  ]);
}

function ccw(poly) {
  const mx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const my = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return [...poly].sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));
}
