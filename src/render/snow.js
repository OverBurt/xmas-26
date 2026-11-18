import { GFX } from '../config.js';
import { X, Y, S, TAU, seeded, tracciato, limiti, liscia, stella4 } from './view.js';

const C = GFX.colors;

/**
 * Neve "da cartone" dei corpi (blocchi del forte, zolle, palle): volume tondo, ombra azzurra in basso a destra,
 * riflesso bianco in alto a sinistra, contorno pervinca. `trac()` deve tracciare la sagoma in pixel.
 */
export function neveTrac(c, trac, [x0, y0, x1, y1], o = {}) {
  trac();
  c.fillStyle = C.neveOmbra;
  c.fill();
  c.save();
  c.clip();
  const d = Math.max(2, S(0.075));
  c.translate(-d * 0.7, -d);
  const g = c.createLinearGradient(0, y0, 0, y1 + 1);
  g.addColorStop(0, C.neve);
  g.addColorStop(1, C.neve2);
  trac();
  c.fillStyle = g;
  c.fill();
  c.translate(d * 0.7, d);
  if (o.densa) {
    c.globalAlpha = o.densa;
    c.fillStyle = C.neveDensa;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.globalAlpha = 1;
  }
  const w = x1 - x0;
  if (w > S(0.34) && !o.liscia) {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.roundRect(x0 + w * 0.14 + d, y0 + d * 1.1, Math.min(S(0.34), w * 0.3), Math.max(2, S(0.05)), 4);
    c.fill();
  }
  c.restore();
  trac();
  c.strokeStyle = C.neveLinea;
  c.lineWidth = Math.max(1.1, S(0.03));
  c.lineJoin = 'round';
  c.stroke();
}
/** Blocco di neve da un poligono in pixel. */
export function neve(c, P, o = {}) {
  neveTrac(c, () => tracciato(c, P, o.r ?? Math.max(2.5, S(0.09))), limiti(P), o);
}
export function palla(c, x, y, r) {
  neveTrac(c, () => { c.beginPath(); c.arc(x, y, r, 0, TAU); }, [x - r, y - r, x + r, y + r], { liscia: true });
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(x - r * 0.35, y - r * 0.45, r * 0.22, r * 0.13, -0.6, 0, TAU);
  c.fill();
}

/**
 * Cappello di neve (neve posata): forma unica e compatta appoggiata sulla superficie y = f(x) tra x0 e x1 (metri).
 * Bordo alto tondo e bombato (`su` + `dome`), bordo basso a festoni irregolari con colature tonde di lunghezze diverse;
 * due toni piatti: bianco pieno e una fascia azzurro-grigia lungo il bordo inferiore e sotto le colature.
 * `sp` = spessore verso il basso (numero o funzione di x); `corte(x)` vieta le colature lunghe in quel punto.
 */
export function cappello(c, f, x0, x1, o = {}) {
  const R = seeded((o.seme || 1) * 131 + 7);
  const spf = typeof o.sp === 'function' ? o.sp : () => o.sp ?? 0.3;
  const su = o.su ?? 0;
  const dome = o.dome ?? 0;
  const maxG = o.maxGoccia ?? 0.5;
  const prob = o.gocce ?? 0.28;
  const corte = o.corte || (() => false);
  const W = x1 - x0;
  const top = (x) => f(x) + su + dome * Math.sin((Math.PI * (x - x0)) / W);
  const bot = (x) => f(x) - spf(x);
  const fascia = o.fascia ?? Math.min(0.1, spf((x0 + x1) / 2) * 0.42);
  const seg = [];
  let x = x1;
  while (x > x0 + 1e-3) {
    let lungo = R() < prob && !corte(x);
    let w = lungo ? 0.15 + R() * 0.08 : 0.24 + R() * 0.3;
    if (x - w - x0 < 0.14) {
      w = x - x0;
      if (w > 0.3) lungo = false;
    }
    seg.push([x, x - w, lungo ? maxG * (0.4 + R() * 0.6) : 0.04 + R() * 0.09, lungo]);
    x -= w;
  }
  const rr = Math.min(0.16, W * 0.2);
  const trac = () => {
    c.beginPath();
    c.moveTo(X(x0), Y(bot(x0)));
    c.quadraticCurveTo(X(x0 - rr * 0.6), Y(top(x0)), X(x0 + rr), Y(top(x0 + rr)));
    liscia(c, top, x0 + rr, x1 - rr);
    c.quadraticCurveTo(X(x1 + rr * 0.6), Y(top(x1)), X(x1), Y(bot(x1)));
    for (const [xa, xb, dd, lungo] of seg) {
      if (lungo) c.bezierCurveTo(X(xa - (xa - xb) * 0.04), Y(bot(xa) - dd * 1.33), X(xb + (xa - xb) * 0.04), Y(bot(xb) - dd * 1.33), X(xb), Y(bot(xb)));
      else c.quadraticCurveTo(X((xa + xb) / 2), Y((bot(xa) + bot(xb)) / 2 - dd * 2), X(xb), Y(bot(xb)));
    }
    c.closePath();
  };
  trac();
  c.fillStyle = C.neveFascia;
  c.fill();
  c.save();
  c.clip();
  c.translate(0, -S(fascia));
  trac();
  c.fillStyle = '#fff';
  c.fill();
  c.restore();
  trac();
  c.strokeStyle = C.neveLinea;
  c.lineWidth = Math.max(1.1, S(0.03));
  c.lineJoin = 'round';
  c.stroke();
}

/** Ghiaccio: traslucido, spigoli vivi, bordo chiaro, riflesso diagonale. Poligono in pixel. */
export function ghiaccio(c, P, o = {}) {
  const [x0, y0, x1, y1] = limiti(P);
  const w = Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.ghiaccio);
  g.addColorStop(1, C.ghiaccio2);
  tracciato(c, P);
  c.globalAlpha = 0.78;
  c.fillStyle = g;
  c.fill();
  c.globalAlpha = 1;
  c.save();
  tracciato(c, P);
  c.clip();
  c.translate(cx, cy);
  c.rotate(0.6);
  c.fillStyle = '#fff';
  c.globalAlpha = 0.5;
  c.fillRect(-w * 0.16, -w, Math.max(2, w * 0.11), w * 2);
  c.fillRect(w * 0.04, -w, Math.max(1, w * 0.04), w * 2);
  c.restore();
  tracciato(c, P);
  c.strokeStyle = C.ghiaccioBordo;
  c.lineWidth = Math.max(1.2, S(0.03));
  c.lineJoin = 'round';
  c.stroke();
  if (o.luce !== undefined) {
    c.fillStyle = '#fff';
    stella4(c, P[o.luce][0], P[o.luce][1], Math.max(4, S(0.14)), 0.2);
    c.fill();
  }
}
