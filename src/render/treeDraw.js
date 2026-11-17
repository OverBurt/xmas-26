import { side } from '../entities/snowTree.js';

/**
 * Disegno dell'albero di cristalli: tronco e rami come nastri rastremati che seguono le curve,
 * cristalli di sette forme raggruppati per tipo (un tracciato per forma), cristalli che cadono.
 */

const BARK = '#4a3326';
const BARK_LIGHT = '#6b4a38';

/** Stile di ogni forma: riempimento e/o contorno. */
const STYLE = {
  fiocco: { stroke: '#e8f6ff', thick: true },
  stella: { fill: '#f6fbff' },
  gemma: { fill: 'rgba(150,225,255,0.75)', stroke: '#eaffff' },
  esagono: { fill: 'rgba(200,240,255,0.35)', stroke: '#dff6ff' },
  goccia: { fill: 'rgba(160,220,255,0.7)', stroke: '#f2fbff' },
  stalattite: { fill: 'rgba(185,235,255,0.8)', stroke: '#f0fcff' },
  neve: { fill: '#f7fbff', stroke: 'rgba(150,180,225,0.7)' },
};
const ORDER = ['neve', 'stalattite', 'goccia', 'esagono', 'gemma', 'stella', 'fiocco'];

export function drawTree(ctx, t, px) {
  // Tronco e rami: un solo riempimento (si sovrappongono nello stesso colore)
  ctx.fillStyle = BARK;
  ctx.beginPath();
  ribbon(ctx, t.trunk, true); // punta arrotondata, come i rami
  for (const b of t.branches) ribbon(ctx, b, true);
  ctx.fill();

  // Riflesso chiaro lungo il lato sinistro del tronco (corteccia)
  ctx.strokeStyle = BARK_LIGHT;
  ctx.lineWidth = Math.max(px, (t.def.trunkW ?? 0.7) * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const n = t.trunk.pts.length;
  for (let i = 1; i < n - 3; i++) {
    const { l } = side(t.trunk, i);
    const c = t.trunk.pts[i];
    const x = c.x + (l.x - c.x) * 0.55;
    const y = c.y + (l.y - c.y) * 0.55;
    if (i === 1) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Cristalli ancora attaccati, raggruppati per forma
  for (const shape of ORDER) {
    ctx.beginPath();
    let any = false;
    for (const c of t.crystals) {
      if (!c.alive || c.shape !== shape) continue;
      SHAPES[shape](ctx, c);
      any = true;
    }
    if (any) paint(ctx, shape, px);
  }

  // Cristalli che cadono (svaniscono nell'ultimo tratto)
  for (const c of t.falling) {
    ctx.globalAlpha = Math.min(1, c.life / 0.8);
    ctx.beginPath();
    SHAPES[c.shape](ctx, c);
    paint(ctx, c.shape, px);
  }
  ctx.globalAlpha = 1;
}

function paint(ctx, shape, px) {
  const st = STYLE[shape];
  if (st.fill) {
    ctx.fillStyle = st.fill;
    ctx.fill();
  }
  if (st.stroke) {
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = st.thick ? Math.max(1.6 * px, 0.035) : Math.max(px, 0.015);
    ctx.stroke();
  }
}

/** Nastro rastremato lungo una curva {pts, ws}; `cap` arrotonda la punta. */
function ribbon(ctx, curve, cap) {
  const n = curve.pts.length;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const s = side(curve, i);
    L.push(s.l);
    R.push(s.r);
  }
  ctx.moveTo(L[0].x, L[0].y);
  smooth(ctx, L);
  if (cap) {
    const p = curve.pts[n - 1];
    const r = curve.ws[n - 1] / 2;
    const a = Math.atan2(L[n - 1].y - p.y, L[n - 1].x - p.x);
    ctx.arc(p.x, p.y, r, a, a + Math.PI, true);
  } else {
    ctx.lineTo(R[n - 1].x, R[n - 1].y);
  }
  smooth(ctx, R.reverse(), true);
  ctx.closePath();
}

/** Linea morbida attraverso i punti (curve quadratiche sui punti medi). */
function smooth(ctx, P, fromCurrent = false) {
  if (fromCurrent) ctx.lineTo(P[0].x, P[0].y);
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i].x + P[i + 1].x) / 2;
    const my = (P[i].y + P[i + 1].y) / 2;
    ctx.quadraticCurveTo(P[i].x, P[i].y, mx, my);
  }
  ctx.lineTo(P[P.length - 1].x, P[P.length - 1].y);
}

/** Punto ruotato di `rot` attorno al centro del cristallo. */
function rp(c, dx, dy) {
  const co = Math.cos(c.rot);
  const si = Math.sin(c.rot);
  return [c.x + dx * co - dy * si, c.y + dx * si + dy * co];
}

function polyPath(ctx, c, pts) {
  const [x0, y0] = rp(c, pts[0][0], pts[0][1]);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(...rp(c, pts[i][0], pts[i][1]));
  ctx.closePath();
}

/** Tracciati delle forme (aggiunti al path corrente, centro in c.x, c.y). */
const SHAPES = {
  /** Fiocco a sei bracci, con due rametti per braccio. */
  fiocco(ctx, c) {
    const r = c.size;
    for (let i = 0; i < 3; i++) {
      const a = c.rot + (i * Math.PI) / 3;
      ctx.moveTo(c.x - Math.cos(a) * r, c.y - Math.sin(a) * r);
      ctx.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
    for (let i = 0; i < 6; i++) {
      const a = c.rot + (i * Math.PI) / 3;
      const mx = c.x + Math.cos(a) * r * 0.55;
      const my = c.y + Math.sin(a) * r * 0.55;
      for (const s of [-0.6, 0.6]) {
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a + s) * r * 0.35, my + Math.sin(a + s) * r * 0.35);
      }
    }
  },
  /** Stellina scintillante a quattro punte (con punte minori in diagonale). */
  stella(ctx, c) {
    const r = c.size;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const R = i % 2 ? r * 0.45 : r;
      const a0 = a - Math.PI / 8;
      pts.push([Math.cos(a0) * r * 0.16, Math.sin(a0) * r * 0.16], [Math.cos(a) * R, Math.sin(a) * R]);
    }
    polyPath(ctx, c, pts);
  },
  /** Gemma allungata (rombo con facce). */
  gemma(ctx, c) {
    const r = c.size;
    polyPath(ctx, c, [[0, r], [r * 0.45, r * 0.25], [r * 0.32, -r * 0.55], [0, -r * 0.8], [-r * 0.32, -r * 0.55], [-r * 0.45, r * 0.25]]);
  },
  /** Piastrina esagonale con un esagono interno. */
  esagono(ctx, c) {
    for (const k of [1, 0.5]) {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        pts.push([Math.cos(a) * c.size * k, Math.sin(a) * c.size * k]);
      }
      polyPath(ctx, c, pts);
    }
  },
  /** Goccia appesa: punta in alto (attaccata al ramo), pancia tonda in basso. */
  goccia(ctx, c) {
    const r = c.size;
    const d = 1.7 * r; // distanza della punta dal centro
    const al = Math.acos(r / d);
    const up = Math.PI / 2 + c.rot;
    ctx.moveTo(c.x + Math.cos(up) * d, c.y + Math.sin(up) * d);
    ctx.arc(c.x, c.y, r, up - al, up + al - 2 * Math.PI, true);
    ctx.closePath();
  },
  /** Stalattite: base larga in alto, punta sottile in basso, leggermente irregolare. */
  stalattite(ctx, c) {
    const L = c.size;
    const w = L * (0.22 + c.k * 0.12);
    const j = (c.k - 0.5) * w * 0.5;
    polyPath(ctx, c, [
      [-w / 2, L / 2],
      [w / 2, L / 2],
      [w * 0.3, L * 0.1],
      [w * 0.12 + j, -L * 0.25],
      [j * 0.5, -L / 2],
      [-w * 0.15 + j, -L * 0.2],
      [-w * 0.3, L * 0.15],
    ]);
  },
  /** Cuscinetto di neve: tre lobi tondi uniti. */
  neve(ctx, c) {
    const r = c.size;
    for (const [dx, dy, k] of [[0, 0.15, 1], [-0.75, -0.2, 0.72], [0.75, -0.18, 0.78]]) {
      const [x, y] = rp(c, dx * r, dy * r);
      ctx.moveTo(x + r * k, y);
      ctx.arc(x, y, r * k, 0, Math.PI * 2);
    }
  },
};

/** Pino innevato: tronco, tre piani di rami verde scuro, neve sui bordi superiori di ogni piano. */
export function drawPine(ctx, p, px) {
  ctx.fillStyle = '#4a3326';
  fillPts(ctx, p.trunk);
  p.tiers.forEach((t, i) => {
    ctx.fillStyle = i % 2 ? '#1f5a45' : '#235f4a';
    fillPts(ctx, t);
    // neve: fascia lungo i due lati superiori, con un bordo ondulato sotto
    const [a, b, c] = t;
    const k = 0.42; // quanto scende la neve lungo i lati
    const l = { x: c.x + (a.x - c.x) * k, y: c.y + (a.y - c.y) * k };
    const r = { x: c.x + (b.x - c.x) * k, y: c.y + (b.y - c.y) * k };
    ctx.fillStyle = '#eef5ff';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(r.x, r.y);
    const n = 4;
    for (let j = 1; j <= n; j++) {
      const x = r.x + ((l.x - r.x) * j) / n;
      const y = r.y + ((l.y - r.y) * j) / n;
      const mx = r.x + ((l.x - r.x) * (j - 0.5)) / n;
      const my = r.y + ((l.y - r.y) * (j - 0.5)) / n;
      ctx.quadraticCurveTo(mx, my - (c.y - l.y) * 0.18, x, y);
    }
    ctx.closePath();
    ctx.fill();
  });
}

function fillPts(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}
