import { Settings } from 'planck';
import { SNOW, GROUND_Y } from '../config.js';
import { createIceBody, createSnowCompound } from '../physics/fracture.js';
import { buildIceSculpture } from './iceSculpture.js';
import { rect, centroid } from '../physics/polygon.js';

/** Distanza a riposo tra due poligoni (vedi iceTower.js): i mattoni nascono già appoggiati. */
const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

/**
 * Fortino di neve costruito dai bambini.
 * - tipo "muro" (default): mattoni sfalsati e merli in cima
 * - tipo "arcate" (`arches` > 0): pilastri, archi a conci di neve, muro sopra e merli
 * - `keepMerlons`: merli che non mancano mai (quelli con un pupazzo sopra)
 * @returns {{ bodies, x0, x1, top, merlons: {x0,x1}[] }} top = quota sopra i merli
 */
export function buildSnowFort(pw, def) {
  return def.arches ? buildArcade(pw, def) : buildWall(pw, def);
}

/** Mattone (rettangolo) tra x0 e x1 appoggiato alla quota y0. */
function brick(pw, bodies, x0, x1, y0, h = SNOW.brick.h) {
  const bw = x1 - x0 - GAP; // piccolo spazio orizzontale tra i mattoni
  bodies.push(createIceBody(pw, rect(bw / 2, h / 2), (x0 + x1) / 2, y0 + h / 2 + GAP, 0, 0, false, 'snow'));
}

/** Posizioni [x0, x1] dei mattoni della fila r (sfalsata: mezzo mattone ai bordi nelle file dispari). */
function rowPositions(x, W, r) {
  const { w } = SNOW.brick;
  const cols = Math.round(W / w);
  const out = [];
  if (r % 2 === 0) for (let c = 0; c < cols; c++) out.push([x + c * w, x + (c + 1) * w]);
  else {
    out.push([x, x + w / 2]);
    for (let c = 0; c < cols - 1; c++) out.push([x + w / 2 + c * w, x + w / 2 + (c + 1) * w]);
    out.push([x + cols * w - w / 2, x + cols * w]);
  }
  return out;
}

/** File di mattoni sfalsati a partire da y. Restituisce la quota raggiunta. */
function bondRows(pw, bodies, x, W, y, rows) {
  const { h } = SNOW.brick;
  for (let r = 0; r < rows; r++) {
    for (const [x0, x1] of rowPositions(x, W, r)) brick(pw, bodies, x0, x1, y);
    y += h + GAP;
  }
  return y;
}

/**
 * Merli in cima: un mattone sì e uno no della fila successiva (così poggiano sempre su mattoni).
 * `skip` toglie qualche merlo a caso, come se il tempo li avesse sbriciolati (mai quelli con un pupazzo).
 */
function merlonRow(pw, bodies, x, W, rows, y, keep = []) {
  const merlons = [];
  const pos = rowPositions(x, W, 0); // sempre mattoni interi, anche sopra una fila sfalsata
  for (let i = 0; i < pos.length; i += 2) merlons.push({ x0: pos[i][0], x1: pos[i][1] });
  merlons.forEach((m, i) => {
    m.present = keep.includes(i) || Math.random() > MERLON_DECAY;
    if (m.present) brick(pw, bodies, m.x0, m.x1, y);
  });
  return merlons;
}

/** Probabilità che un merlo manchi (neve sbriciolata dal tempo). */
const MERLON_DECAY = 0.25;

function buildWall(pw, def) {
  const { w, h } = SNOW.brick;
  const { x, cols, rows, crenels = true } = def;
  const W = cols * w;
  const bodies = [];
  const y = bondRows(pw, bodies, x, W, GROUND_Y + (def.y || 0), rows);
  const merlons = crenels ? merlonRow(pw, bodies, x, W, rows, y, def.keepMerlons) : [];
  return { bodies, x0: x, x1: x + W, top: crenels ? y + h + GAP : y, merlons };
}

/**
 * Fortino ad arcate: `arches` archi larghi `archW` tra pilastri larghi un mattone,
 * alti `pierRows` file; ogni arco è fatto di 5 conci a cuneo e due riempimenti ai lati;
 * sopra, `upperRows` file di mattoni sfalsati e i merli.
 * I pacchi possono passare sotto gli archi... finché reggono.
 */
function buildArcade(pw, def) {
  const { w, h } = SNOW.brick;
  const { x, arches, pierRows = 4, upperRows = 3, crenels = true } = def;
  const archW = def.archW ?? 2 * w;
  const pierW = w;
  const ring = (pierW - 3 * GAP) / 2; // spessore dei conci: due archi vicini stanno su un pilastro
  const bodies = [];
  const base = GROUND_Y + (def.y || 0);
  const width = arches * archW + (arches + 1) * pierW;

  // Pilastri
  for (let i = 0; i <= arches; i++) {
    const px = x + i * (archW + pierW);
    let y = base;
    for (let r = 0; r < pierRows; r++) {
      brick(pw, bodies, px, px + pierW, y);
      y += h + GAP;
    }
  }
  const spring = base + pierRows * (h + GAP) + GAP; // imposta degli archi

  // Archi
  const ri = archW / 2;
  const ro = ri + ring;
  const N = 5;
  const keyTop = spring + (ro + GAP) * Math.sin((2 * Math.PI) / 5); // quota sopra chiave e riempimenti
  for (let i = 0; i < arches; i++) {
    const cx = x + pierW + i * (archW + pierW) + archW / 2;
    const at = (r, a) => ({ x: cx + Math.cos(a) * r, y: spring + Math.sin(a) * r });

    // Conci a cuneo, con un piccolo spazio angolare tra l'uno e l'altro
    const da = GAP / ((ri + ro) / 2) / 2;
    for (let k = 0; k < N; k++) {
      const a0 = Math.PI - (k * Math.PI) / N - (k === 0 ? 0 : da);
      const a1 = Math.PI - ((k + 1) * Math.PI) / N + (k === N - 1 ? 0 : da);
      bodies.push(polyBody(pw, ccw([at(ri, a1), at(ro, a1), at(ro, a0), at(ri, a0)])));
    }

    // Riempimenti ai lati della chiave (concavi → due triangoli ciascuno)
    for (const side of [-1, 1]) {
      const R = ro + GAP;
      const A = { x: cx + side * R, y: spring };
      const B = at(R, side < 0 ? (4 * Math.PI) / 5 : Math.PI / 5);
      const C = at(R, side < 0 ? (3 * Math.PI) / 5 : (2 * Math.PI) / 5);
      const D = { x: cx + side * R, y: keyTop };
      const c = centroid(ccw([A, B, C, D]));
      const tris = [ccw([A, B, D]), ccw([B, C, D])].map((t) => t.map((p) => ({ x: p.x - c.x, y: p.y - c.y })));
      bodies.push(createSnowCompound(pw, tris, c.x, c.y));
    }
  }

  // Pilastri esterni: blocchetto che riempie lo spazio accanto all'arco
  const fillW = pierW - ring - 2 * GAP;
  if (fillW > 0.08) {
    for (const fx of [x, x + width - fillW]) {
      bodies.push(
        polyBody(pw, [
          { x: fx, y: spring },
          { x: fx + fillW, y: spring },
          { x: fx + fillW, y: keyTop },
          { x: fx, y: keyTop },
        ]),
      );
    }
  }

  // Muro sopra gli archi
  const y = bondRows(pw, bodies, x, width, keyTop, upperRows);

  // Scultura di ghiaccio sopra il muro (piramide, torre di prismi, ponte...).
  // `margin` lascia liberi i bordi del muro: lì possono stare i pupazzi.
  if (def.ice) {
    const margin = def.ice.margin ?? 0;
    const sc = buildIceSculpture(pw, def.ice.sculpture, x + margin, x + width - margin, y);
    bodies.push(...sc.bodies);
    const sides = margin >= 0.9 ? [{ x0: x, x1: x + margin }, { x0: x + width - margin, x1: x + width }] : [];
    return { bodies, x0: x, x1: x + width, top: y, iceTop: sc.top, merlons: sides.map((m) => ({ ...m, present: true })) };
  }

  const merlons = crenels ? merlonRow(pw, bodies, x, width, upperRows, y, def.keepMerlons) : [];
  return { bodies, x0: x, x1: x + width, top: crenels ? y + h + GAP : y, merlons };
}

/** Corpo di neve da un poligono convesso in coordinate mondo. */
function polyBody(pw, world) {
  const c = centroid(world);
  return createIceBody(pw, world.map((p) => ({ x: p.x - c.x, y: p.y - c.y })), c.x, c.y, 0, 0, false, 'snow');
}

/** Ordina i vertici di un poligono convesso in senso antiorario. */
function ccw(poly) {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return [...poly].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}
