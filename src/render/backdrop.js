import { VIEW_W, VIEW_H, GFX, CAMERA } from '../config.js';
import { TAU, seeded, makeCanvas, stella4, toBitmap } from './view.js';

const C = GFX.colors;
/** Scala a cui sono dipinti i piani (pixel per metro alla vista di riferimento) e riga dell'orizzonte nel layer. */
const PPM_REF = VIEW_W / GFX.refViewW;
const ORIZ = VIEW_H + CAMERA.bottom * PPM_REF;

/**
 * Sfondo in parallasse, pre-renderizzato una volta per livello su canvas offscreen:
 * cielo con luna e stelle (fermo), montagne lontane e medie, colline morbide, profilo della città, pini alti.
 * A ogni frame sono 6 drawImage più le poche stelle che tremolano.
 */
export class Backdrop {
  /** @param {{minX:number,maxX:number}} bounds  @param {object} tier livello di qualità (GFX.tiers) */
  constructor(bounds, tier) {
    this.bounds = bounds;
    this.tier = tier;
    const k = tier.layer;
    const [sky, cs] = makeCanvas(VIEW_W, VIEW_H, k);
    cielo(cs);
    this.sky = sky;
    toBitmap(this, 'sky');
    this.layers = [];
    const add = (name, paint) => {
      const p = GFX.parallax[name];
      const W = larghezza(bounds, p);
      const [cv, c] = makeCanvas(W, VIEW_H, k);
      paint(c, W);
      const L = { cv, W, f: p.f, zoom: p.zoom };
      toBitmap(L);
      this.layers.push(L);
    };
    add('lontane', (c, W) => montagne(c, W, 0));
    add('medie', (c, W) => montagne(c, W, 1));
    add('colline', (c, W) => colline(c, W));
    add('paese', (c, W) => paese(c, W));
    add('pini', (c, W) => piniAlti(c, W));
    const R = seeded(2024);
    this.lumi = Array.from({ length: 16 }, () => ({ x: R() * VIEW_W, y: 20 + R() * 250, r: 2.6 + R() * 2.6, a: 0.7 + R() * 1.1, c: 0.35 + R() * 0.5, p: R() * TAU, q: R() * TAU, s: R() * TAU }));
  }

  draw(ctx, camera, t) {
    ctx.drawImage(this.sky, 0, 0, VIEW_W, VIEW_H);
    // Stelle che tremolano in modo irregolare: tre sinusoidi con periodi non multipli tra loro, più lampi brevi
    const n = this.tier.twinkle;
    if (n) {
      ctx.fillStyle = C.stelle;
      for (let i = 0; i < n; i++) {
        const s = this.lumi[i];
        const f = 0.5 * Math.sin(t * s.a + s.p) + 0.3 * Math.sin(t * s.a * 1.618 + s.q) + 0.2 * Math.sin(t * s.a * 2.718 + s.s);
        const lampo = Math.max(0, Math.sin(t * s.c + s.q) * Math.sin(t * s.c * 0.377 + s.p)) ** 6;
        const b = Math.max(0.05, (0.42 + 0.34 * f) * (1 + 0.18 * Math.sin(t * 23.1 + s.s * 7)) + lampo * 1.3);
        ctx.globalAlpha = Math.min(1, b);
        stella4(ctx, s.x, s.y, s.r * (0.55 + 0.75 * Math.min(1.6, b)), 0.2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const ppm = camera.ppm;
    const hy = VIEW_H + camera.bottom * ppm; // riga dell'orizzonte (linea del terreno) sullo schermo
    const dx = (camera.x - this.bounds.minX) * ppm;
    for (const L of this.layers) {
      const s = 1 + (ppm / PPM_REF - 1) * L.zoom;
      ctx.drawImage(L.cv, -dx * L.f, hy - ORIZ * s, L.W * s, VIEW_H * s);
    }
  }
}

/** Larghezza (px del layer) che copre ogni posizione e zoom della camera per un piano con parallasse `p`. */
function larghezza(bounds, p) {
  const span = bounds.maxX - bounds.minX;
  let W = VIEW_W;
  for (let v = 14; v <= span; v += 2) {
    const ppm = VIEW_W / v;
    const s = 1 + (ppm / PPM_REF - 1) * p.zoom;
    W = Math.max(W, (VIEW_W + (span - v) * ppm * p.f) / s);
  }
  W = Math.max(W, VIEW_W / (1 + (VIEW_W / span / PPM_REF - 1) * p.zoom));
  return Math.ceil(W) + 40;
}

function cielo(c) {
  const R = seeded(4621);
  const g = c.createLinearGradient(0, 0, 0, ORIZ);
  C.cielo.forEach((col, i) => g.addColorStop([0, 0.42, 0.78, 1][i], col));
  c.fillStyle = g;
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  c.fillStyle = C.stelle;
  for (let i = 0; i < GFX.stars; i++) {
    c.globalAlpha = 0.35 + R() * 0.6;
    c.beginPath();
    c.arc(R() * VIEW_W, Math.pow(R(), 1.4) * ORIZ * 0.82, 0.5 + R() * 1.1, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
  // luna bassa sull'orizzonte: le vette più alte le passano davanti (si legge lontana, dietro le montagne)
  const { x: mx, y: my, r: mr } = GFX.moon;
  for (const [rr, a] of [[230, 0.16], [110, 0.24]]) {
    const h = c.createRadialGradient(mx, my, mr * 0.6, mx, my, rr);
    h.addColorStop(0, `rgba(255,214,140,${a})`);
    h.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = h;
    c.fillRect(mx - rr, my - rr, rr * 2, rr * 2);
  }
  c.fillStyle = C.luna;
  c.beginPath();
  c.arc(mx, my, mr, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(214,160,90,0.28)';
  for (const [dx, dy, r] of [[-14, -10, 9], [12, 8, 12], [-6, 18, 5], [18, -18, 5]]) {
    c.beginPath();
    c.arc(mx + dx, my + dy, r, 0, TAU);
    c.fill();
  }
}

/** Un piano di montagne largo W: vette di altezza molto varia (una su tre è alta, le altre sparse), cime innevate. */
function montagne(c, W, k) {
  const R = seeded(91 + k * 37);
  const [per, h0, h1, w0, w1] = [[4.6, 250, 520, 240, 410], [5.6, 200, 400, 190, 310]][k];
  const n = Math.max(3, Math.round((per * W) / 1300));
  const pk = [];
  for (let i = 0; i < n; i++) {
    const alta = i % 3 === (k + 1) % 3;
    pk.push({ x: ((i + 0.5 + (R() - 0.5) * 0.9) / n) * W, h: h0 + (h1 - h0) * (alta ? 0.72 + R() * 0.28 : R() * 0.62), w: w0 + R() * (w1 - w0) });
  }
  const quota = (x) => {
    let m = 0;
    for (const p of pk) {
      const v = p.h * (1 - Math.abs(x - p.x) / p.w);
      if (v > m) m = v;
    }
    return m;
  };
  const pts = [];
  for (let x = -6; x <= W + 6; x += 6) pts.push([x, ORIZ - (quota(x) * 0.92 + 26 + 7 * Math.sin(x * 0.045 + k) + 3 * Math.sin(x * 0.13))]);
  const trac = () => {
    c.beginPath();
    c.moveTo(-6, VIEW_H);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.lineTo(W + 6, VIEW_H);
    c.closePath();
  };
  const gr = c.createLinearGradient(0, ORIZ - h1, 0, ORIZ);
  gr.addColorStop(0, C.monti[k]);
  gr.addColorStop(1, C.monti[k + 1]);
  trac();
  c.fillStyle = gr;
  c.fill();
  c.save();
  trac();
  c.clip();
  const soglia = h0 + (h1 - h0) * 0.42;
  c.beginPath();
  c.moveTo(-6, 0);
  pts.forEach((p, i) => {
    const hh = ORIZ - p[1];
    c.lineTo(p[0], p[1] + Math.max(0, hh - soglia) * 0.5 + (hh > soglia ? (i % 2) * 7 : -2));
  });
  c.lineTo(W + 6, 0);
  c.closePath();
  c.fillStyle = C.cime;
  c.globalAlpha = 1 - k * 0.3;
  c.fill();
  c.restore();
}

/** Colline: due dorsali tonde e dolci, senza punte, con un filo di neve sulla cresta. */
function colline(c, W) {
  for (const [base, amp, fr, ph, c1, c2] of [[205, 46, 0.0031, 0.6, C.monti[2], '#242a66'], [150, 40, 0.0043, 2.9, '#232962', '#1e2459']]) {
    const yy = (x) => ORIZ - (base + amp * Math.sin(x * fr + ph) + amp * 0.42 * Math.sin(x * fr * 2.2 + ph * 1.9) + amp * 0.16 * Math.sin(x * fr * 4.1 + ph));
    const gr = c.createLinearGradient(0, ORIZ - base - amp * 1.6, 0, ORIZ);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    c.beginPath();
    c.moveTo(-6, VIEW_H);
    for (let x = -6; x <= W + 6; x += 5) c.lineTo(x, yy(x));
    c.lineTo(W + 6, VIEW_H);
    c.closePath();
    c.fillStyle = gr;
    c.fill();
    c.beginPath();
    for (let x = -6; x <= W + 6; x += 5) x === -6 ? c.moveTo(x, yy(x) + 1) : c.lineTo(x, yy(x) + 1);
    c.strokeStyle = 'rgba(206,216,255,0.16)';
    c.lineWidth = 2;
    c.stroke();
  }
}

/** Abete di sfondo (sagoma senza contorno). Con un generatore `R` ogni albero è diverso; `alto` = slanciato a più piani. */
function abete(c, x, y, h, col, neveCol, R, alto) {
  const r = R || (() => 0.5);
  const n = R ? (alto ? 4 : 3) + Math.floor(r() * 3) : 3;
  const w = h * (R ? (alto ? 0.17 + r() * 0.1 : 0.22 + r() * 0.2) : 0.36);
  const piega = R ? (r() - 0.5) * 0.7 : 0;
  const piani = [];
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const top = y - h + ((h * i) / n) * 0.82;
    const base = y - h + (h * (i + 1)) / n + (i === n - 1 ? 0 : h * 0.05);
    const ww = w * (0.4 + (0.6 * (i + 1)) / n);
    const wl = ww * (R ? 0.78 + r() * 0.44 : 1);
    const wr = ww * (R ? 0.78 + r() * 0.44 : 1);
    const dl = R ? h * 0.035 * (r() - 0.35) : 0;
    const dr = R ? h * 0.035 * (r() - 0.35) : 0;
    const tx = x + (i === 0 ? piega * w * 0.45 : piega * w * 0.12);
    piani.push([top, base, wl, wr, tx]);
    c.beginPath();
    c.moveTo(tx, top);
    c.quadraticCurveTo(x + wr * 0.35, base - (h * 0.3) / n, x + wr, base + dr);
    c.quadraticCurveTo(x + (wr - wl) * 0.3, base + h * 0.045, x - wl, base + dl);
    c.quadraticCurveTo(x - wl * 0.35, base - (h * 0.3) / n, tx, top);
    c.fill();
  }
  c.fillRect(x - w * 0.07, y - 2, w * 0.14, 10);
  if (!neveCol) return;
  c.fillStyle = neveCol;
  c.globalAlpha = 0.6;
  for (const [top, base, wl, wr, tx] of piani) {
    if (R && r() < 0.18) continue;
    const fl = R ? 0.15 + r() * 0.5 : 0.5;
    const fr = R ? 0.15 + r() * 0.5 : 0.5;
    const hh = base - top;
    const yl = top + hh * (0.25 + fl * 0.6);
    const yr = top + hh * (0.25 + fr * 0.6);
    c.beginPath();
    c.moveTo(tx, top);
    c.quadraticCurveTo(x + wr * fr * 0.5, yr - hh * 0.2, x + wr * fr, yr);
    c.quadraticCurveTo(x + wr * fr * 0.4, yr - hh * 0.12, x, (yl + yr) / 2 + hh * 0.04);
    c.quadraticCurveTo(x - wl * fl * 0.4, yl - hh * 0.12, x - wl * fl, yl);
    c.quadraticCurveTo(x - wl * fl * 0.5, yl - hh * 0.2, tx, top);
    c.fill();
  }
  c.globalAlpha = 1;
}

/** Profilo della città: colle sinuoso, case con tetti innevati e finestre accese, due campanili. Sagoma fredda, senza contorni. */
function paese(c, W) {
  const R = seeded(808);
  const yc = (x) => ORIZ - (132 + 30 * Math.sin(x * 0.0046 + 1) + 14 * Math.sin(x * 0.013 + 2.4));
  const colle = (dy, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, VIEW_H);
    for (let x = 0; x <= W + 6; x += 6) c.lineTo(x, yc(x) + dy);
    c.lineTo(W + 6, VIEW_H);
    c.fill();
  };
  colle(0, C.paese);
  for (let i = 0; i < Math.round(W / 60); i++) {
    const x = R() * W;
    abete(c, x, yc(x) + 6, 30 + R() * 34, C.paese2, null, R);
  }
  const casetta = (bx, by, w, h, th, tono) => {
    c.fillStyle = tono;
    c.fillRect(bx - w / 2, by - h, w, h + 30);
    c.fillStyle = C.paeseTetto;
    c.beginPath();
    c.moveTo(bx - w / 2 - 5, by - h);
    c.lineTo(bx, by - h - th);
    c.lineTo(bx + w / 2 + 5, by - h);
    c.closePath();
    c.fill();
    c.fillStyle = C.paeseNeve;
    c.beginPath();
    c.moveTo(bx - w / 2 - 6, by - h);
    c.lineTo(bx, by - h - th - 2);
    c.lineTo(bx + w / 2 + 6, by - h);
    c.lineTo(bx + w / 2 - 2, by - h - 1);
    c.quadraticCurveTo(bx + w * 0.2, by - h - th * 0.45, bx, by - h - th * 0.62);
    c.quadraticCurveTo(bx - w * 0.2, by - h - th * 0.45, bx - w / 2 + 2, by - h - 1);
    c.closePath();
    c.fill();
    if (R() < 0.6) {
      const kx = bx + (R() < 0.5 ? -1 : 1) * w * 0.24;
      c.fillStyle = tono;
      c.fillRect(kx - 3, by - h - th * 0.75 - 8, 6, 14);
      c.fillStyle = C.paeseNeve;
      c.fillRect(kx - 4, by - h - th * 0.75 - 10, 8, 3);
    }
    const n = w > 38 ? 3 : 2; // finestre: quasi tutte accese
    for (let i = 0; i < n; i++) {
      const fx = bx - w / 2 + (w * (i + 0.5)) / n;
      c.fillStyle = R() < 0.78 ? C.paeseLuce : C.paeseTetto;
      c.fillRect(fx - 3, by - h * 0.72, 6, 8);
    }
    if (h > 34 && R() < 0.7) {
      c.fillStyle = C.paeseLuce;
      c.fillRect(bx - 2.5, by - h - th * 0.42, 5, 6);
    }
  };
  const gruppi = Math.max(3, Math.round(W / 560));
  for (let gi = 0; gi < gruppi; gi++) {
    const gx = ((gi + 0.5) / gruppi) * W;
    if (gi % 2 === 1) { // campanile: alternati uno alto con la cuspide e uno più basso con la cupola
      const bx = gx + 14;
      const by = yc(bx) + 10;
      const alto = gi % 4 === 1;
      const hh = alto ? 104 : 74;
      const ww = alto ? 20 : 24;
      c.fillStyle = C.paese3;
      c.fillRect(bx - ww / 2, by - hh, ww, hh + 30);
      c.fillStyle = C.paeseTetto;
      c.beginPath();
      if (alto) {
        c.moveTo(bx - ww / 2 - 4, by - hh);
        c.lineTo(bx, by - hh - 46);
        c.lineTo(bx + ww / 2 + 4, by - hh);
      } else c.ellipse(bx, by - hh, ww / 2 + 3, 16, 0, Math.PI, 0);
      c.closePath();
      c.fill();
      c.fillStyle = C.paeseNeve;
      c.beginPath();
      if (alto) {
        c.moveTo(bx - 7, by - hh - 27);
        c.lineTo(bx, by - hh - 48);
        c.lineTo(bx + 7, by - hh - 27);
        c.quadraticCurveTo(bx, by - hh - 33, bx - 7, by - hh - 27);
      } else c.ellipse(bx, by - hh - 8, ww / 2 - 2, 8, 0, Math.PI, 0);
      c.closePath();
      c.fill();
      c.fillStyle = C.paeseLuce;
      c.beginPath();
      c.roundRect(bx - 4, by - hh + 10, 8, 14, [4, 4, 0, 0]);
      c.fill();
      c.fillRect(bx - 2.5, by - hh + 42, 5, 8);
    }
    const n = 5 + Math.floor(R() * 3);
    for (let j = 0; j < n; j++) {
      const bx = gx + (j - (n - 1) / 2) * 40 + (R() - 0.5) * 16;
      casetta(bx, yc(bx) + 10 + R() * 6, 28 + R() * 24, 22 + R() * 24, 14 + R() * 18, R() < 0.5 ? C.paese2 : C.paese3);
    }
  }
  colle(16, C.paese); // la neve del colle copre i piedi delle case
}

/** Pini alti subito dietro la scena: collina bassa e sinuosa, alberi con la base sulla linea del terreno di gioco. */
function piniAlti(c, W) {
  const R = seeded(3131);
  const toni = C.piniLontani;
  const yy = (x) => ORIZ - (34 + 20 * Math.sin(x * 0.0058 + 0.8) + 9 * Math.sin(x * 0.0139 + 2.2));
  c.beginPath();
  c.moveTo(-6, VIEW_H);
  for (let x = -6; x <= W + 6; x += 5) c.lineTo(x, yy(x));
  c.lineTo(W + 6, VIEW_H);
  c.closePath();
  c.fillStyle = C.collinaPini;
  c.fill();
  c.beginPath();
  for (let x = -6; x <= W + 6; x += 5) x === -6 ? c.moveTo(x, yy(x) + 1) : c.lineTo(x, yy(x) + 1);
  c.strokeStyle = 'rgba(120,135,210,0.3)';
  c.lineWidth = 2;
  c.stroke();
  // alti 225–350 px alla vista di riferimento (le case di gioco ne misurano circa 265), stretti, a gruppi radi
  for (let x = -30 + R() * 80; x < W + 60; x += R() < 0.25 ? 56 + R() * 36 : 230 + R() * 270) {
    const h = 225 + R() * 125;
    abete(c, x, ORIZ + 2, h, toni[Math.floor(R() * 3)], C.piniNeve, R, true);
    if (R() < 0.45) abete(c, x + 38 + R() * 26, ORIZ + 2, h * (0.42 + R() * 0.2), toni[Math.floor(R() * 3)], C.piniNeve, R, true); // un giovane accanto
  }
}
