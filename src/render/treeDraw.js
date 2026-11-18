import { GFX, TREE } from '../config.js';
import { side } from '../entities/snowTree.js';
import { X, Y, S, V, seeded, spess, coppie, makeSprite, blit } from './view.js';
import { palla } from './snow.js';

const C = GFX.colors;

/**
 * Albero di cristalli: tronco e rami (nastri rastremati color prugna col contorno scuro) stanno in uno sprite in cache,
 * perché non cambiano mai; i cristalli di sette forme si disegnano a ogni frame, un tracciato per forma.
 */

/** Stile di ogni forma: riempimento e/o contorno. Tutte fredde (bianco, ghiaccio, azzurro). */
const STYLE = {
  fiocco: { stroke: '#f2f9ff', thick: true },
  stella: { fill: '#f0fbff', stroke: '#8fdcff' },
  gemma: { fill: 'rgba(143,233,255,0.85)', stroke: '#eafcff' },
  esagono: { fill: 'rgba(190,236,255,0.4)', stroke: '#dff6ff' },
  goccia: { fill: 'rgba(120,205,255,0.8)', stroke: '#f2fbff' },
  stalattite: { fill: 'rgba(170,230,255,0.85)', stroke: '#f0fcff' },
  neve: { fill: '#ffffff', stroke: '#8ea3dc' },
};
const ORDER = ['neve', 'stalattite', 'goccia', 'esagono', 'gemma', 'stella', 'fiocco'];

/** Porta il contesto dai pixel della vista alle coordinate mondo (metri, y verso l'alto). */
function mondo(ctx) {
  ctx.translate(X(0), Y(0));
  ctx.scale(V.ppm, -V.ppm);
}

/** Sprite di tronco e rami (creato a ogni nuova partita: l'albero cambia forma). */
export function buildTreeSprite(t, ppm) {
  let x0 = 1e9, y0 = 0, x1 = -1e9, y1 = -1e9;
  for (const cv of [t.trunk, ...t.branches]) for (const p of cv.pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const radici = buildRoots(t);
  for (const r of radici) for (const p of r.pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
  }
  const m = 0.25;
  return makeSprite(x0 - m, y0 - 0.12, x1 + m, y1 + 0.3, ppm, (c) => {
    const u = 1 / V.ppm;
    c.save();
    mondo(c);
    // niente sotto la linea del terreno (il bordo inferiore del tronco e delle radici resta nascosto)
    c.beginPath();
    c.rect(x0 - m, -0.03, x1 - x0 + 2 * m, y1 + 1);
    c.clip();
    c.lineJoin = 'round';
    c.beginPath();
    ribbon(c, t.trunk, true); // punta arrotondata, come i rami
    for (const b of t.branches) ribbon(c, b, true);
    for (const r of radici) ribbon(c, r, true); // stesso tracciato: contorno unico, le giunture non si vedono
    c.strokeStyle = C.contorno;
    c.lineWidth = 2.6 * u;
    c.stroke();
    c.fillStyle = C.corteccia;
    c.fill();
    // Luce lungo il lato sinistro del tronco
    c.strokeStyle = C.corteccia2;
    c.lineWidth = Math.max(u, (t.def.trunkW ?? 0.7) * 0.12);
    c.lineCap = 'round';
    c.beginPath();
    const n = t.trunk.pts.length;
    for (let i = 1; i < n - 3; i++) {
      const { l } = side(t.trunk, i);
      const p = t.trunk.pts[i];
      const x = p.x + (l.x - p.x) * 0.5;
      const y = p.y + (l.y - p.y) * 0.5;
      if (i === 1) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    cumuloAlPiede(c, t, radici, u);
    c.restore();
  });
}

/**
 * Radici: per lato due curve rastremate che escono dalla parte bassa del tronco e si allargano a terra,
 * una lunga e una corta, con piccole variazioni per albero (generatore con seme dalla posizione).
 * Stessa struttura delle curve del tronco ({pts, ws}), così si disegnano con `ribbon`.
 */
function buildRoots(t) {
  const R = seeded(Math.round(t.def.x * 100) + 7);
  const B = t.trunk.pts[0];
  const W0 = t.trunk.ws[0];
  const out = [];
  for (const lato of [-1, 1]) {
    for (const [lung, alto, spess] of [[0.95, 0.42, 0.42], [0.5, 0.26, 0.3]]) {
      const len = W0 * lung * (0.85 + R() * 0.3);
      // attacco sull'asse del tronco (che è sinuoso), dentro il tronco: nessuna punta che sporge
      const ya = W0 * alto;
      const ia = t.trunk.pts.findIndex((p) => p.y >= ya);
      const a = { x: t.trunk.pts[Math.max(0, ia)].x, y: ya };
      const k = { x: B.x + lato * W0 * (0.55 + R() * 0.1), y: W0 * 0.06 };
      const b = { x: B.x + lato * (W0 * 0.5 + len), y: -0.03 - R() * 0.03 };
      const pts = [];
      const ws = [];
      const N = 10;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const q = 1 - s;
        pts.push({ x: q * q * a.x + 2 * q * s * k.x + s * s * b.x, y: q * q * a.y + 2 * q * s * k.y + s * s * b.y });
        ws.push(W0 * spess * (1 - s) ** 1.4 + 0.035);
      }
      out.push({ pts, ws });
    }
  }
  return out;
}

/** Cumulo di neve morbido al piede dell'albero: copre l'attacco con il terreno, le punte delle radici spuntano fuori. */
function cumuloAlPiede(c, t, radici, u) {
  const B = t.trunk.pts[0];
  const W0 = t.trunk.ws[0];
  const xs = radici.map((r) => r.pts.at(-1).x);
  const r0 = (Math.max(...xs) - Math.min(...xs)) * 0.36;
  const h = Math.min(0.16, W0 * 0.2);
  const f = (x) => {
    const d = (x - B.x) / r0;
    return Math.abs(d) >= 1 ? -0.04 : -0.04 + (h + 0.04) * (1 - d * d) ** 1.6;
  };
  c.beginPath();
  c.moveTo(B.x - r0, -0.1);
  for (let i = 0; i <= 40; i++) {
    const x = B.x - r0 + (2 * r0 * i) / 40;
    c.lineTo(x, f(x));
  }
  c.lineTo(B.x + r0, -0.1);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  // filo d'ombra azzurra sul bordo del cumulo
  c.beginPath();
  for (let i = 4; i <= 36; i++) {
    const x = B.x - r0 + (2 * r0 * i) / 40;
    i === 4 ? c.moveTo(x, f(x)) : c.lineTo(x, f(x));
  }
  c.strokeStyle = 'rgba(150,170,230,0.55)';
  c.lineWidth = 1.4 * u;
  c.stroke();
}

/** Albero a ogni frame: sprite di tronco e rami, poi i cristalli attaccati e quelli che cadono. */
export function drawTree(ctx, t, sprite, tempo = 0) {
  blit(ctx, sprite);
  const px = 1 / V.ppm;
  ctx.save();
  mondo(ctx);
  // Ondeggiamento al vento (solo disegno: le posizioni dei contatti restano ferme). Ogni cristallo ha la sua fase
  // (c.k), più una raffica lenta che attraversa la chioma da sinistra a destra; in alto e in punta ai rami si
  // muovono di più, gocce e stalattiti dondolano come pendoli (più rotazione che spostamento).
  const W = TREE.vento;
  const yBase = t.top.y;
  for (const shape of ORDER) {
    ctx.beginPath();
    let any = false;
    const appeso = shape === 'goccia' || shape === 'stalattite';
    for (const c of t.crystals) {
      if (!c.alive || c.shape !== shape) continue;
      const raffica = 0.6 + 0.4 * Math.sin(tempo * W.raffica - c.x * 0.7);
      const onda = Math.sin(tempo * W.velocita * (0.8 + 0.4 * c.k) + c.k * 6.28) * raffica;
      const quota = Math.min(1, Math.max(0.3, (c.y - yBase + 1) / 3));
      const x0 = c.x, y0 = c.y, r0 = c.rot;
      c.x += onda * W.ampiezza * quota * (appeso ? 0.4 : 1);
      c.y += Math.cos(tempo * W.velocita * 1.3 + c.k * 9) * W.ampiezza * 0.3 * quota * raffica;
      c.rot += onda * (appeso ? W.pendolo : W.rotazione);
      SHAPES[shape](ctx, c);
      c.x = x0; c.y = y0; c.rot = r0;
      any = true;
    }
    if (any) paint(ctx, shape, px);
  }
  // Cristalli che cadono (svaniscono nell'ultimo tratto)
  for (const c of t.falling) {
    ctx.globalAlpha = c.aTerra ? Math.min(1, c.life / TREE.groundFade) : 1; // svanisce solo a terra
    ctx.beginPath();
    SHAPES[c.shape](ctx, c);
    paint(ctx, c.shape, px);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function paint(ctx, shape, px) {
  const st = STYLE[shape];
  if (shape === 'neve') { // cuscinetto di neve: prima il contorno, poi il bianco (niente righe tra i lobi)
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = Math.max(2 * px, 0.03);
    ctx.stroke();
    ctx.fillStyle = st.fill;
    ctx.fill();
    return;
  }
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

/** Pino di gioco: il corpo fisico (tronco + tre triangoli) non cambia; dentro quella sagoma ogni pino, dal suo seme, è diverso. */
function pino(c, G, seme = 1) {
  const R = seeded(seme * 7919 + 13), r = (a, b) => a + R() * (b - a), L = spess(), [v1, v2] = C.verdi[seme % C.verdi.length];
  c.lineJoin = 'round'; c.lineCap = 'round';
  const [tx0, ty0] = G.tronco[0], tx1 = G.tronco[1][0], ty1 = G.tronco[2][1], st = r(-0.07, 0.07);
  c.beginPath(); c.moveTo(X(tx0 - 0.05), Y(ty0)); c.quadraticCurveTo(X(tx0 + st), Y((ty0 + ty1) / 2), X(tx0 + 0.02), Y(ty1)); c.lineTo(X(tx1 - 0.02), Y(ty1)); c.quadraticCurveTo(X(tx1 + st), Y((ty0 + ty1) / 2), X(tx1 + 0.05), Y(ty0)); c.closePath();
  c.fillStyle = C.corteccia; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
  const piega = r(-0.2, 0.2);
  G.piani.forEach(([a, b, t], i) => {
    const half = (b[0] - a[0]) / 2, hh = t[1] - a[1];
    const tip = i === 2 ? [t[0] + piega, t[1] - 0.02] : [t[0] + r(-0.06, 0.06), t[1]];
    const A = [a[0] + r(0, 0.12), a[1] + r(0, 0.16)], B = [b[0] - r(0, 0.12), b[1] + r(0, 0.16)]; // punte rientrate e rialzate
    const cl = r(0.2, 0.58), cr = r(0.2, 0.58), n = 3 + Math.floor(R() * 3), larg = [], prof = [];
    let tot = 0; for (let j = 0; j < n; j++) { const w = r(0.6, 1.4); larg.push(w); tot += w; prof.push(r(0.12, 0.36)); }
    const trac = () => {
      c.beginPath(); c.moveTo(X(tip[0]), Y(tip[1]));
      c.quadraticCurveTo(X(t[0] + half * cr), Y(a[1] + hh * 0.36), X(B[0]), Y(B[1]));
      let xx = B[0], yy = B[1]; // orlo a ciuffi irregolari, sempre dentro il triangolo
      for (let j = 0; j < n; j++) { const nx = j === n - 1 ? A[0] : xx - ((B[0] - A[0]) * larg[j]) / tot, ny = j === n - 1 ? A[1] : a[1] + prof[j] * 0.22; c.quadraticCurveTo(X((xx + nx) / 2), Y(Math.max(yy, ny) + prof[j]), X(nx), Y(ny)); xx = nx; yy = ny; }
      c.quadraticCurveTo(X(t[0] - half * cl), Y(a[1] + hh * 0.36), X(tip[0]), Y(tip[1])); c.closePath();
    };
    const g = c.createLinearGradient(X(a[0]), 0, X(b[0]), 0); g.addColorStop(0, v1); g.addColorStop(1, v2);
    trac(); c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.fillStyle = 'rgba(0,18,40,0.22)'; c.fillRect(X(a[0]), Y(a[1] + hh * 0.2), S(half * 2), S(hh * 0.2)); // ombra sotto i rami
    // neve: quanto scende su ciascun lato cambia da piano a piano
    const kl = R() < 0.2 ? 0.1 : r(0.25, 0.72), kr = R() < 0.2 ? 0.1 : r(0.25, 0.72);
    const l = [tip[0] + (A[0] - tip[0]) * kl - 0.3, tip[1] + (A[1] - tip[1]) * kl], q = [tip[0] + (B[0] - tip[0]) * kr + 0.3, tip[1] + (B[1] - tip[1]) * kr];
    const gd = [0, 1, 2, 3].map(() => (R() < 0.22 ? r(0.3, 0.42) : r(0.08, 0.2))); // festoni: qualcuno scende a colatura
    for (const [col, dy] of [[C.neveFascia, -0.1], [C.neve, 0]]) {
      c.fillStyle = col; c.beginPath(); c.moveTo(X(tip[0]), Y(tip[1] + 0.4)); c.lineTo(X(q[0]), Y(q[1] + dy));
      for (let j = 1; j <= 4; j++) c.quadraticCurveTo(X(q[0] + ((l[0] - q[0]) * (j - 0.5)) / 4), Y(q[1] + ((l[1] - q[1]) * (j - 0.5)) / 4 + dy - hh * gd[j - 1]), X(q[0] + ((l[0] - q[0]) * j) / 4), Y(q[1] + ((l[1] - q[1]) * j) / 4 + dy));
      c.closePath(); c.fill();
    }
    c.restore();
    trac(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
    if (R() < 0.55) { const s = R() < 0.5 ? A : B; palla(c, X(s[0] + (s === A ? 0.16 : -0.16)), Y(s[1] + 0.1), S(r(0.09, 0.13))); } // grumo di neve su una punta
  });
}

/** Sprite di un pino di gioco, generato dal suo seme (uno per pino, creato al caricamento del livello). */
export function buildPineSprite(p, seme, ppm) {
  const G = { tronco: coppie(p.trunk), piani: p.tiers.map(coppie) };
  const half = (G.piani[0][1][0] - G.piani[0][0][0]) / 2;
  return makeSprite(p.x - half - 0.45, p.g - 0.05, p.x + half + 0.45, p.g + p.h + 0.25, ppm, (c) => pino(c, G, seme));
}
