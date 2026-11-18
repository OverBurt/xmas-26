// Geometria dei poligoni convessi (array di {x, y} in senso antiorario).
import { Settings } from 'planck';

/**
 * Distanza a riposo tra due poligoni a contatto: Planck li tiene separati di 2·polygonRadius − linearSlop (1.5 cm).
 * Ogni pezzo impilato va creato a questa distanza da quello sotto, altrimenti la pila "salta" al primo step.
 * Unica definizione, usata da tutti i costruttori (fortini, sculture, igloo, case, pupazzi…).
 */
export const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

/** Riordina i vertici di un poligono convesso in senso antiorario (attorno alla media dei vertici). */
export function ccw(poly) {
  const mx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
  const my = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return [...poly].sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));
}

export function area(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function centroid(poly) {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/**
 * Taglia un poligono convesso con una retta (punto p, normale n).
 * Restituisce [lato positivo, lato negativo]; un lato può essere vuoto.
 */
export function splitByLine(poly, p, n) {
  const pos = [];
  const neg = [];
  const d = poly.map((v) => (v.x - p.x) * n.x + (v.y - p.y) * n.y);
  for (let i = 0, len = poly.length; i < len; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % len];
    const da = d[i];
    const db = d[(i + 1) % len];
    if (da >= 0) pos.push(a);
    if (da <= 0) neg.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      const x = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      pos.push(x);
      neg.push({ ...x });
    }
  }
  return [pos, neg];
}

/** Elimina vertici troppo vicini (Box2D li rifiuterebbe) e controlla che il poligono sia utilizzabile. */
export function sanitize(poly, minEdge = 0.02, minArea = 0.003) {
  const out = [];
  for (const v of poly) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(v.x - last.x, v.y - last.y) > minEdge) out.push(v);
  }
  if (out.length > 2) {
    const f = out[0];
    const l = out[out.length - 1];
    if (Math.hypot(f.x - l.x, f.y - l.y) <= minEdge) out.pop();
  }
  if (out.length < 3 || out.length > 8) return null;
  if (Math.abs(area(out)) < minArea) return null;
  return out;
}

/** Rettangolo centrato nell'origine. */
export function rect(hw, hh) {
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}
