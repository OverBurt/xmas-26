import { REINDEER } from '../config.js';

/**
 * Disegno provvisorio delle renne (dalla direzione grafica A "Notte di velluto"): contorno da fumetto,
 * due pose ('fianco' di profilo che ogni tanto si gira, 'fronte' in camera) e la reazione allo spavento quando vengono colpite
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

/**
 * Renna di fianco, a testa alta: guarda dritto davanti a sé e ogni tanto gira la testa verso la camera
 * (REINDEER.sguardo: ciclo, durata dello sguardo in camera, tempo del giro). Il giro è un'unica testa i cui pezzi
 * (muso, occhi, orecchie, corna) scivolano dalla vista di profilo a quella di fronte: `giro` 0 = profilo, 1 = in camera.
 * `paura` = avanzamento dello spavento (0..1) o null: spaventata guarda in camera con gli occhi sbarrati.
 */
function fianco(c, r, t, paura, trema) {
  const v = r.facing;
  const P = (dx, dy) => [v * dx * K, -dy * K];
  const sb = paura !== null;
  const G = REINDEER.sguardo;
  const u = (t + r.x * 1.37) % G.ciclo; // ogni renna ha il suo ritmo
  const lin = Math.min(1, Math.max(0, Math.min((u - (G.ciclo - G.camera)) / G.giro, (G.ciclo - u) / G.giro)));
  const giro = sb ? 1 : lin * lin * (3 - 2 * lin);
  const mix = (a, b) => a + (b - a) * giro;
  const chiuso = t % 3.7 < 0.13;
  const coda = sb ? Math.sin(t * 30) * 0.6 : t % 5 < 1.3 ? Math.sin(t * 16) * 0.5 : 0;
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
  // collo dritto e testa alta (respira appena)
  const H = [1.0, 1.76 + 0.015 * Math.sin(t * 1.3 + r.x)];
  arto(c, [P(0.55, 1.12), P(0.78, 1.42), P(H[0] - 0.1, H[1] - 0.2)], S(0.28), COL.pelo);
  arto(c, [P(0.5, 1.3), P(0.86, 1.14)], S(0.13), COL.sciarpa);
  arto(c, [P(0.6, 1.2), P(0.55, 0.86)], S(0.11), COL.sciarpa);
  const Q = (dx, dy) => P(H[0] + dx + trema, H[1] + dy);
  // corna: di profilo tutte e due piegate all'indietro, di fronte aperte ai lati
  corno(c, Q, mix(-0.14, -0.15), 0.2, mix(-0.5, -1), 0.85);
  corno(c, Q, mix(0.02, 0.15), 0.21, mix(-0.5, 1), 0.9);
  // orecchie: una all'indietro di profilo, due ai lati di fronte (dritte se spaventata)
  if (giro > 0.05) ovale(c, Q(mix(0.1, 0.38), mix(0.16, sb ? 0.24 : 0.12)), S(0.15 * giro), S(0.075 * giro), COL.pelo2, v * mix(-0.3, sb ? -1.2 : -0.5));
  ovale(c, Q(mix(-0.25, -0.38), mix(0.15, sb ? 0.24 : 0.1)), S(0.15), S(0.075), COL.pelo2, v * mix(0.7, sb ? 1.2 : 0.6));
  ovale(c, Q(0, 0), S(0.31), S(0.27), COL.pelo);
  const muso = [mix(0.2, 0), mix(-0.08, -0.14)];
  ovale(c, Q(...muso), S(mix(0.2, 0.26)), S(mix(0.15, 0.19)), COL.crema);
  if (sb) ovale(c, Q(muso[0], muso[1] - 0.07), S(0.065), S(0.08), '#3a1d2a'); // bocca a "O"
  else if (giro > 0.6) { // sorriso, solo quando guarda in camera
    c.strokeStyle = COL.contorno;
    c.lineWidth = LW;
    c.lineCap = 'round';
    c.globalAlpha = (giro - 0.6) / 0.4;
    c.beginPath();
    c.moveTo(...Q(-0.12, muso[1] - 0.06));
    c.quadraticCurveTo(...Q(0, muso[1] - 0.15), ...Q(0.12, muso[1] - 0.06));
    c.stroke();
    c.globalAlpha = 1;
  }
  ovale(c, Q(mix(0.34, 0), mix(-0.05, -0.06)), S(mix(0.075, 0.1)), S(mix(0.055, 0.07)), COL.naso);
  // occhi: uno solo di profilo (guarda avanti), due di fronte (guardano noi)
  const gx = v * mix(0.3, 0);
  if (giro > 0.3) occhio(c, Q(mix(0.24, 0.14), mix(0.08, 0.1)), S(0.09 * Math.min(1, (giro - 0.3) / 0.5)), gx, 0.05, chiuso, sb);
  occhio(c, Q(mix(0.04, -0.14), mix(0.08, 0.1)), S(mix(0.085, 0.1)), gx, 0.05, chiuso, sb);
  return Q(0, 0.95); // punto sopra la testa (per il "!")
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
  ctx.ellipse(0, 0, S(r.pose === 'fianco' ? 0.95 : 0.6) * (1 - balzo * 0.8), S(0.1), 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -S(balzo));
  const sopra = r.pose === 'fianco' ? fianco(ctx, r, t, paura, trema) : fronte(ctx, r, t, paura, trema);
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
