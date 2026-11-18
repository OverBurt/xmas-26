import { SNOW, GROUND_Y } from '../config.js';
import { createIceBody, createSnowCompound } from '../physics/fracture.js';
import { buildIceSculpture } from './iceSculpture.js';
import { buildCardCastle } from './cardCastle.js';
import { rect, centroid, ccw, GAP } from '../physics/polygon.js';

/**
 * Fortino di neve ad arcate costruito dai bambini (vedi buildArcade); con `storeys` > 1 è una torre.
 * @returns {{ bodies, x0, x1, top, iceTop?, ledges: {x0,x1}[] }}
 *   top = quota del muro in cima; ledges = spalti liberi ai lati della scultura (lì stanno i pupazzi)
 */
export function buildSnowFort(pw, def) {
  return buildArcade(pw, def);
}

/** Mattone (rettangolo) tra x0 e x1 appoggiato alla quota y0; `dens` = moltiplicatore di densità. */
function brick(pw, bodies, x0, x1, y0, dens = 1, h = SNOW.brick.h) {
  const bw = x1 - x0 - GAP; // piccolo spazio orizzontale tra i mattoni
  bodies.push(createIceBody(pw, rect(bw / 2, h / 2), (x0 + x1) / 2, y0 + h / 2 + GAP, 0, 0, false, 'snow', dens));
}

/**
 * Posizioni [x0, x1] dei mattoni della fila r (sfalsata: mezzo mattone ai bordi nelle file dispari).
 * La larghezza dei mattoni si adatta perché la fila copra esattamente W.
 */
function rowPositions(x, W, r, brickW = SNOW.brick.w) {
  const cols = Math.max(1, Math.round(W / brickW));
  const w = W / cols;
  const out = [];
  if (r % 2 === 0 || cols === 1) for (let c = 0; c < cols; c++) out.push([x + c * w, x + (c + 1) * w]);
  else {
    out.push([x, x + w / 2]);
    for (let c = 0; c < cols - 1; c++) out.push([x + w / 2 + c * w, x + w / 2 + (c + 1) * w]);
    out.push([x + cols * w - w / 2, x + cols * w]);
  }
  return out;
}

/** File di mattoni sfalsati a partire da y. Restituisce la quota raggiunta. */
function bondRows(pw, bodies, x, W, y, rows, dens = 1, brickW = SNOW.brick.w) {
  const { h } = SNOW.brick;
  for (let r = 0; r < rows; r++) {
    for (const [x0, x1] of rowPositions(x, W, r, brickW)) brick(pw, bodies, x0, x1, y, dens);
    y += h + GAP;
  }
  return y;
}

/**
 * Fortino ad arcate: `arches` archi larghi `archW` tra pilastri larghi `pierW`, alti `pierRows` file;
 * ogni arco è fatto di 5 conci a cuneo e due riempimenti ai lati; sopra, `upperRows` file di mattoni
 * sfalsati, poi eventualmente una scultura di ghiaccio. I pacchi possono passare sotto gli archi... finché reggono.
 *
 * Torre a più piani (`storeys` > 1), costruita come una torre vera:
 *  - `pierW`, `archW`, `pierRows`, `upperRows` possono essere array (un valore per piano):
 *    pilastri più larghi in basso e archi più stretti in alto → sagoma rastremata, ogni piano centrato;
 *  - neve compattata (più densa) in basso e più leggera in alto (`SNOW.storeyDensity`, o `density` nel JSON):
 *    il peso grava sui pezzi più robusti e la cima è la parte più facile da far cadere;
 *  - tra un piano e l'altro l'ultima fila è un solaio intero: le spinte orizzontali dei due pilastri
 *    dell'arco superiore si annullano dentro lo stesso corpo invece di far scivolare i mattoni sotto.
 * In cima: una scultura di ghiaccio (`ice`) oppure un castello di carte (`cards`, stessi parametri di cardCastle.js).
 * I pezzi sono pochi e grandi (vedi arcadeStorey).
 */
function buildArcade(pw, def) {
  const { w } = SNOW.brick;
  const { x, arches, pierRows = 4, upperRows = 3 } = def;
  const storeys = def.storeys ?? 1;
  const per = (v, s, d) => (v === undefined ? d : Array.isArray(v) ? v[Math.min(s, v.length - 1)] : v);
  const densities = def.density ?? (storeys > 1 ? SNOW.storeyDensity : [1]);

  // Geometria di ogni piano
  const plan = [];
  for (let s = 0; s < storeys; s++) {
    const pierW = per(def.pierW, s, w);
    const archW = per(def.archW, s, 2 * w);
    plan.push({ pierW, archW, width: arches * archW + (arches + 1) * pierW });
  }
  const width0 = plan[0].width;
  const bodies = [];
  let y = GROUND_Y + (def.y || 0);
  let sx = x;
  let sw = width0;
  for (let s = 0; s < storeys; s++) {
    const p = plan[s];
    sx = x + (width0 - p.width) / 2; // piano centrato su quello sotto
    sw = p.width;
    y = arcadeStorey(pw, bodies, sx, y, {
      arches,
      archW: p.archW,
      pierW: p.pierW,
      pierRows: per(pierRows, s),
      upperRows: per(upperRows, s),
      floor: s < storeys - 1,
      dens: per(densities, s, 1),
    });
  }
  // Castello di carte in cima (tende di lastre di ghiaccio e blocchi di neve, vedi cardCastle.js)
  if (def.cards) {
    const cc = buildCardCastle(pw, { ...def.cards, x: sx + sw / 2, y });
    bodies.push(...cc.bodies);
    return { bodies, x0: x, x1: x + width0, top: y, iceTop: cc.top, ledges: [] };
  }

  // Scultura di ghiaccio sopra il muro (piramide, torre di prismi, ponte...).
  // `margin` lascia liberi i bordi del muro: sono gli spalti dove possono stare i pupazzi.
  if (def.ice) {
    const margin = def.ice.margin ?? 0;
    const sc = buildIceSculpture(pw, def.ice.sculpture, sx + margin, sx + sw - margin, y);
    bodies.push(...sc.bodies);
    const ledges = margin >= 0.9 ? [{ x0: sx, x1: sx + margin }, { x0: sx + sw - margin, x1: sx + sw }] : [];
    return { bodies, x0: x, x1: x + width0, top: y, iceTop: sc.top, ledges };
  }
  return { bodies, x0: x, x1: x + width0, top: y, ledges: [] };
}

/**
 * Un piano del fortino ad arcate appoggiato alla quota `base`. Restituisce la quota raggiunta.
 * Pochi pezzi grandi (meno corpi da simulare, crolli più leggibili):
 *  - ogni pilastro è un blocco unico alto `pierRows` file;
 *  - ogni arco è fatto di 3 corpi: due "spalle" composte (due conci + il riempimento sopra di loro
 *    + l'eventuale blocchetto sopra il pilastro) e la chiave al centro;
 *  - le file sopra gli archi usano mattoni lunghi (`SNOW.longBrick`); sotto un altro piano l'ultima
 *    fila è un solaio intero.
 */
function arcadeStorey(pw, bodies, x, base, { arches, archW, pierW, pierRows, upperRows, floor, dens }) {
  const { h } = SNOW.brick;
  // Spessore dei conci: al massimo quello di un pilastro largo un mattone diviso tra due archi
  const ring = (Math.min(pierW, SNOW.brick.w) - 3 * GAP) / 2;
  const width = arches * archW + (arches + 1) * pierW;

  // Pilastri: un blocco ciascuno
  const pierH = pierRows * (h + GAP) - GAP;
  for (let i = 0; i <= arches; i++) {
    const px = x + i * (archW + pierW);
    brick(pw, bodies, px, px + pierW, base, dens, pierH);
  }
  const spring = base + pierRows * (h + GAP) + GAP; // imposta degli archi

  const ri = archW / 2;
  const ro = ri + ring;
  const R = ro + GAP; // raggio esterno dei riempimenti
  const N = 5;
  const keyTop = spring + R * Math.sin((2 * Math.PI) / 5); // quota sopra chiave e riempimenti
  const centers = [];
  for (let i = 0; i < arches; i++) centers.push(x + pierW + i * (archW + pierW) + archW / 2);

  // Blocchetto sopra ogni pilastro, tra i riempimenti (o il bordo): finisce nella spalla vicina
  const pierFill = [];
  for (let i = 0; i <= arches; i++) {
    const L = i === 0 ? x : centers[i - 1] + R + GAP / 2;
    const Rt = i === arches ? x + width : centers[i] - R - GAP / 2;
    pierFill.push(Rt - L > 0.08 + GAP ? [{ x: L + (i === 0 ? 0 : GAP / 2), y: spring }, { x: Rt - GAP / 2, y: spring }, { x: Rt - GAP / 2, y: keyTop }, { x: L + (i === 0 ? 0 : GAP / 2), y: keyTop }] : null);
  }

  for (let i = 0; i < arches; i++) {
    const cx = centers[i];
    const at = (r, a) => ({ x: cx + Math.cos(a) * r, y: spring + Math.sin(a) * r });
    const da = GAP / ((ri + ro) / 2) / 2; // piccolo spazio angolare tra i conci
    const vous = (k) => {
      const a0 = Math.PI - (k * Math.PI) / N - (k === 0 ? 0 : da);
      const a1 = Math.PI - ((k + 1) * Math.PI) / N + (k === N - 1 ? 0 : da);
      return ccw([at(ri, a1), at(ro, a1), at(ro, a0), at(ri, a0)]);
    };
    const fill = (side) => {
      const A = { x: cx + side * R, y: spring };
      const B = at(R, side < 0 ? (4 * Math.PI) / 5 : Math.PI / 5);
      const C = at(R, side < 0 ? (3 * Math.PI) / 5 : (2 * Math.PI) / 5);
      const D = { x: cx + side * R, y: keyTop };
      return [ccw([A, B, D]), ccw([B, C, D])];
    };
    // Spalla sinistra: conci 0–1, riempimento sinistro, blocchetto sopra il pilastro a sinistra
    const left = [vous(0), vous(1), ...fill(-1)];
    if (pierFill[i]) left.push(pierFill[i]);
    // Spalla destra: conci 3–4, riempimento destro (+ blocchetto del pilastro esterno destro)
    const right = [vous(3), vous(4), ...fill(1)];
    if (i === arches - 1 && pierFill[arches]) right.push(pierFill[arches]);
    bodies.push(compound(pw, left, dens), polyBody(pw, vous(2), dens), compound(pw, right, dens));
  }

  // Muro sopra gli archi (mattoni lunghi); sotto un altro piano l'ultima fila è un solaio intero
  const y = bondRows(pw, bodies, x, width, keyTop, floor ? upperRows - 1 : upperRows, dens, SNOW.longBrick);
  if (!floor) return y;
  brick(pw, bodies, x, x + width, y, dens);
  return y + h + GAP;
}

/** Corpo di neve composto da più poligoni convessi in coordinate mondo. */
function compound(pw, polys, dens = 1) {
  const c = centroid(polys[0]);
  return createSnowCompound(pw, polys.map((pl) => pl.map((p) => ({ x: p.x - c.x, y: p.y - c.y }))), c.x, c.y, 0, false, dens);
}

/** Corpo di neve da un poligono convesso in coordinate mondo. */
function polyBody(pw, world, dens = 1) {
  const c = centroid(world);
  return createIceBody(pw, world.map((p) => ({ x: p.x - c.x, y: p.y - c.y })), c.x, c.y, 0, 0, false, 'snow', dens);
}
