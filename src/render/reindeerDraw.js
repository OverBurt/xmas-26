import { REINDEER } from '../config.js';

/**
 * Disegno provvisorio delle renne (dalla direzione grafica A "Notte di velluto"): contorno da fumetto,
 * due pose ('bruca' di fianco, 'fronte' in camera) e la reazione allo spavento quando vengono colpite
 * (balzo, testa alzata, occhi sbarrati, orecchie dritte, corna che tremano, "!").
 * Si disegna in uno spazio locale in "pixel" (K per metro, y verso il basso) con l'origine ai piedi della renna.
 */
const K = 100;
const COL = {
  pelo: '#bb7c4c', pelo2: '#8c5636', crema: '#f6e2c0', corna: '#eed6a6', zoccolo: '#3a2430',
  naso: '#4a2c2a', contorno: '#1d1442', sciarpa: '#35c4a8', guance: '#ff8fa0',
};
const LW = 4; // spessore del contorno (0.04 m)
const S = (m) => m * K;
const TAU = Math.PI * 2;

function arto(c, pts, w, col) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = COL.contorno;
  c.lineWidth = w + LW * 2;
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
}

function ovale(c, p, rx, ry, col, rot = 0, bordo = true) {
  c.beginPath();
  c.ellipse(p[0], p[1], rx, ry, rot, 0, TAU);
  c.fillStyle = col;
  c.fill();
  if (bordo) {
    c.strokeStyle = COL.contorno;
    c.lineWidth = LW;
    c.stroke();
  }
}

/** Corno ramificato: fusto curvo e due punte. `P` converte (dx, dy) in pixel locali; `v` = verso. */
function corno(c, P, bx, by, v, k = 1) {
  const w = S(0.07 * k);
  arto(c, [P(bx + v * 0.2 * k, by + 0.34 * k), P(bx + v * 0.42 * k, by + 0.36 * k)], w * 0.85, COL.corna);
  arto(c, [P(bx + v * 0.12 * k, by + 0.2 * k), P(bx - v * 0.06 * k, by + 0.42 * k)], w * 0.85, COL.corna);
  arto(c, [P(bx, by), P(bx + v * 0.08 * k, by + 0.16 * k), P(bx + v * 0.2 * k, by + 0.34 * k), P(bx + v * 0.24 * k, by + 0.62 * k)], w, COL.corna);
}

/** Occhio: normale (pupilla che guarda gx, gy), chiuso (battito di ciglia) o sbarrato (spavento). */
function occhio(c, p, r, gx, gy, chiuso, sbarrato) {
  if (chiuso && !sbarrato) {
    c.beginPath();
    c.arc(p[0], p[1] - r * 0.3, r, 0.25, Math.PI - 0.25);
    c.strokeStyle = COL.contorno;
    c.lineWidth = Math.max(1.3, r * 0.3);
    c.lineCap = 'round';
    c.stroke();
    return;
  }
  const R = sbarrato ? r * 1.35 : r;
  ovale(c, p, R, R * 1.1, '#fff');
  c.fillStyle = '#1b1b2a';
  c.beginPath();
  c.arc(p[0] + (sbarrato ? 0 : gx * r), p[1] + (sbarrato ? 0 : gy * r), sbarrato ? r * 0.3 : r * 0.5, 0, TAU);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(p[0] + gx * r - r * 0.18, p[1] + gy * r - r * 0.2, r * 0.15, 0, TAU);
  c.fill();
}

/** Renna che bruca, di fianco; ogni tanto alza il muso verso di noi. `paura` = avanzamento dello spavento (0..1) o null. */
function bruca(c, r, t, paura, trema) {
  const v = r.facing;
  const P = (dx, dy) => [v * dx * K, -dy * K];
  const alza = paura !== null ? 1 : Math.max(0, Math.sin(t * 0.55)) ** 3;
  const chiuso = t % 3.7 < 0.13;
  const coda = paura !== null ? Math.sin(t * 30) * 0.6 : t % 5 < 1.3 ? Math.sin(t * 16) * 0.5 : 0;
  for (const [a, b] of [[-0.42, -0.47], [0.4, 0.47]]) {
    arto(c, [P(a, 0.8), P(b, 0.1)], S(0.11), COL.pelo2);
    arto(c, [P(b, 0.09), P(b, 0.04)], S(0.13), COL.zoccolo);
  }
  ovale(c, P(-0.8, 1.12), S(0.13), S(0.08), COL.crema, -v * (0.6 + coda));
  ovale(c, P(0, 0.98), S(0.78), S(0.43), COL.pelo);
  c.save();
  c.beginPath();
  c.ellipse(...P(0, 0.98), S(0.78), S(0.43), 0, 0, TAU);
  c.clip();
  ovale(c, P(0.05, 0.68), S(0.6), S(0.2), COL.crema, 0, false);
  c.restore();
  for (const [a, b] of [[-0.6, -0.58], [0.56, 0.62]]) {
    arto(c, [P(a, 0.82), P(b, 0.1)], S(0.12), COL.pelo);
    arto(c, [P(b, 0.09), P(b, 0.04)], S(0.14), COL.zoccolo);
  }
  const H = [1.3 - 0.12 * alza, 0.38 + 0.5 * alza];
  arto(c, [P(0.6, 1.1), P(0.95, 0.95 + 0.12 * alza), P(H[0] - 0.14, H[1] + 0.14)], S(0.28), COL.pelo);
  arto(c, [P(0.6, 0.86), P(0.84, 1.1)], S(0.13), COL.sciarpa);
  arto(c, [P(0.64, 0.9), P(0.6, 0.62)], S(0.11), COL.sciarpa);
  const Q = (dx, dy) => P(H[0] + dx + trema, H[1] + dy);
  corno(c, Q, 0.16, 0.2, 0.75, 0.8);
  corno(c, Q, -0.02, 0.22, 0.75, 0.9);
  // orecchio: dritto se spaventata
  ovale(c, Q(-0.27, paura !== null ? 0.26 : 0.16), S(0.14), S(0.07), COL.pelo2, v * (paura !== null ? -1.1 : 0.7));
  ovale(c, Q(0, 0), S(0.31), S(0.26), COL.pelo);
  ovale(c, Q(0.18, -0.1), S(0.2), S(0.15), COL.crema);
  ovale(c, Q(0.31, -0.08), S(0.075), S(0.055), COL.naso);
  const sb = paura !== null;
  occhio(c, Q(-0.03, 0.07), S(0.078), v * 0.15, -0.3, chiuso, sb);
  occhio(c, Q(0.16, 0.09), S(0.07), v * 0.15, -0.3, chiuso, sb);
  if (alza < 0.5) {
    c.strokeStyle = '#7fb38a';
    c.lineWidth = Math.max(1.5, S(0.035));
    c.lineCap = 'round';
    for (const [dx, an] of [[0.2, -0.3], [0.27, 0.1], [0.34, 0.4]]) {
      const p = Q(dx, -0.2);
      const q = Q(dx + an * 0.2, -0.36);
      c.beginPath();
      c.moveTo(...p);
      c.lineTo(...q);
      c.stroke();
    }
  }
  return Q(0, 0.75); // punto sopra la testa (per il "!")
}

/** Renna di fronte, buffa: occhioni un po' strabici, lingua di lato, lucine tra le corna. */
function fronte(c, r, t, paura, trema) {
  const P = (dx, dy) => [dx * K, -dy * K];
  const sb = paura !== null;
  const chiuso = (t + 1.9) % 4.3 < 0.13;
  const coda = sb ? Math.sin(t * 30) * 0.6 : (t + 2) % 6 < 1.2 ? Math.sin(t * 16) * 0.5 : 0;
  const inc = sb ? trema * 2 : 0.05 * Math.sin(t * 0.9);
  for (const s of [-1, 1]) {
    arto(c, [P(s * 0.34, 0.8), P(s * 0.38, 0.1)], S(0.11), COL.pelo2);
    arto(c, [P(s * 0.38, 0.09), P(s * 0.38, 0.04)], S(0.13), COL.zoccolo);
  }
  ovale(c, P(0.52, 1.12), S(0.12), S(0.08), COL.crema, -0.5 - coda);
  ovale(c, P(0, 0.98), S(0.5), S(0.5), COL.pelo);
  ovale(c, P(0, 0.86), S(0.28), S(0.32), COL.crema, 0, false);
  for (const s of [-1, 1]) {
    arto(c, [P(s * 0.17, 0.7), P(s * 0.19, 0.1)], S(0.13), COL.pelo);
    arto(c, [P(s * 0.19, 0.09), P(s * 0.19, 0.04)], S(0.15), COL.zoccolo);
  }
  // la testa dondola appena (o trema se spaventata)
  const Q = (dx, dy) => {
    const co = Math.cos(inc);
    const si = Math.sin(inc);
    return P(dx * co - (dy - 1.3) * si, 1.3 + dx * si + (dy - 1.3) * co);
  };
  corno(c, Q, -0.15, 1.88, -1);
  corno(c, Q, 0.15, 1.88, 1);
  if (sb) {
    ovale(c, Q(-0.38, 1.86), S(0.17), S(0.08), COL.pelo2, 1.3);
    ovale(c, Q(0.38, 1.86), S(0.17), S(0.08), COL.pelo2, -1.3);
  } else {
    ovale(c, Q(-0.42, 1.72), S(0.17), S(0.08), COL.pelo2, 0.9);
    ovale(c, Q(0.4, 1.8), S(0.17), S(0.08), COL.pelo2, -0.35);
  }
  ovale(c, Q(0, 1.64), S(0.36), S(0.31), COL.pelo);
  ovale(c, Q(0, 1.48), S(0.27), S(0.2), COL.crema);
  if (sb) {
    ovale(c, Q(0, 1.4), S(0.07), S(0.09), '#3a1d2a'); // bocca a "O"
  } else {
    c.strokeStyle = COL.contorno;
    c.lineWidth = LW;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(...Q(-0.13, 1.42));
    c.quadraticCurveTo(...Q(0.02, 1.33), ...Q(0.16, 1.44));
    c.stroke();
    ovale(c, Q(0.11, 1.36), S(0.055), S(0.07), COL.guance, 0.3); // lingua di lato
  }
  ovale(c, Q(0, 1.55), S(0.1), S(0.07), COL.naso);
  occhio(c, Q(-0.15, 1.73), S(0.115), 0.22, 0.05, chiuso, sb);
  occhio(c, Q(0.15, 1.73), S(0.1), -0.25, 0.1, chiuso, sb);
  // filo di lucine tra le corna (lampeggiano più in fretta se spaventata)
  c.strokeStyle = '#2a2350';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(...Q(-0.4, 2.42));
  c.quadraticCurveTo(...Q(0, 1.95), ...Q(0.4, 2.42));
  c.stroke();
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.5) / 5;
    const on = Math.sin(t * (sb ? 14 : 3) + i * 1.7) > -0.3;
    c.fillStyle = ['#ffe28a', '#ff8a7a', '#8ff0d2'][i % 3];
    c.globalAlpha = on ? 1 : 0.45;
    c.beginPath();
    c.arc(...Q(-0.4 + 0.8 * u, 2.42 - 0.47 * 4 * u * (1 - u) - 0.04), Math.max(1.8, S(0.055)), 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
  return Q(0, 2.6);
}

export function drawReindeer(ctx, r, t) {
  // spavento: 0..1 dall'urto; null se tranquilla
  const paura = r.scare > 0 ? 1 - r.scare / REINDEER.scareTime : null;
  const balzo = paura !== null ? Math.sin(Math.min(1, paura * 2.2) * Math.PI) * REINDEER.jump : 0;
  const trema = paura !== null ? Math.sin(t * 55) * 0.05 * (1 - paura) : 0;
  ctx.save();
  ctx.translate(r.x, r.g);
  ctx.scale(1 / K, -1 / K);
  // ombra a terra (resta giù mentre la renna salta)
  ctx.fillStyle = 'rgba(40,50,110,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, S(r.pose === 'bruca' ? 0.95 : 0.6) * (1 - balzo * 0.8), S(0.1), 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -S(balzo));
  const sopra = r.pose === 'bruca' ? bruca(ctx, r, t, paura, trema) : fronte(ctx, r, t, paura, trema);
  if (paura !== null && paura < 0.85) {
    // "!" sopra la testa
    ctx.font = `800 ${S(0.55)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = LW * 1.5;
    ctx.strokeStyle = COL.contorno;
    ctx.fillStyle = '#ffd36b';
    ctx.strokeText('!', sopra[0], sopra[1]);
    ctx.fillText('!', sopra[0], sopra[1]);
  }
  ctx.restore();
}
