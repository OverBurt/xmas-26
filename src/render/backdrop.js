import { VIEW_W, VIEW_H, GFX, CAMERA } from '../config.js';
import { TAU, seeded, makeCanvas, stella4, toBitmap } from './view.js';

const C = GFX.colors;
/** Scala a cui sono dipinti i piani (pixel per metro alla vista di riferimento) e riga dell'orizzonte nel layer. */
const PPM_REF = VIEW_W / GFX.refViewW;
const ORIZ = VIEW_H + CAMERA.bottom * PPM_REF;

/**
 * Sfondo in parallasse, pre-renderizzato una volta per livello su canvas offscreen:
 * cielo con luna e stelle (fermo), montagne lontane e medie, profilo della città, pini alti.
 * Ogni piano ha un gradiente verticale che scurisce salendo: le sagome scure del piano davanti risaltano.
 * A ogni frame sono 5 drawImage più le poche stelle che tremolano; in più il primo piano davanti alla scena (drawFront).
 */
export class Backdrop {
  /**
   * @param {{minX:number,maxX:number}} bounds  @param {object} tier livello di qualità (GFX.tiers)
   * @param {{left:number, ppm:number, slitta:number, paeseDa:number}} rif inquadratura di mira (bordo sinistro
   *   in m, pixel per metro) e due punti del mondo da rispettare in quella vista: la slitta, dietro cui stanno
   *   tre pini, e il punto da cui iniziano le case del paese (a destra dell'albero).
   */
  constructor(bounds, tier, rif) {
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
      // x nel piano (px) che, con la camera nell'inquadratura di mira, sta davanti al punto wx del mondo
      const s = 1 + (rif.ppm / PPM_REF - 1) * p.zoom;
      const lx = (wx) => ((wx - rif.left) * rif.ppm + (rif.left - bounds.minX) * rif.ppm * p.f) / s;
      const extra = paint(c, W, lx);
      const L = { cv, W, f: p.f, zoom: p.zoom, gufo: extra?.gufo };
      toBitmap(L);
      this.layers.push(L);
    };
    // Montagne: le vette a mano (aggiunte, spostate, alzate) si danno in px dello schermo nell'inquadratura di mira.
    // Per le regolazioni, in console: __vetteLontane e __vetteMedie (indice, x sullo schermo, altezza, larghezza).
    for (const [k, nome, debug] of [[0, 'lontane', '__vetteLontane'], [1, 'medie', '__vetteMedie']]) {
      const p = GFX.parallax[nome];
      const s = 1 + (rif.ppm / PPM_REF - 1) * p.zoom;
      const off = (rif.left - bounds.minX) * rif.ppm * p.f;
      const schermoAlPiano = (sx) => (sx + off) / s;
      add(nome, (c, W) => {
        const pk = montagne(c, W, k, schermoAlPiano);
        if (typeof window !== 'undefined') window[debug] = pk.map((v, i) => ({ i, x: Math.round(v.x * s - off), h: Math.round(v.h), w: Math.round(v.w) }));
      });
    }
    add('paese', (c, W, lx) => paese(c, W, lx(rif.paeseDa)));
    // punto dello schermo (px logici) → punto del piano dei pini, con la camera nell'inquadratura di mira
    const sulPiano = (p, sx, sy) => {
      const s = 1 + (rif.ppm / PPM_REF - 1) * p.zoom;
      const hy = VIEW_H + CAMERA.bottom * rif.ppm;
      return { x: (sx + (rif.left - bounds.minX) * rif.ppm * p.f) / s, y: (sy - hy + ORIZ * s) / s, s };
    };
    const luna = sulPiano(GFX.parallax.pini, GFX.moon.x, GFX.moon.y);
    add('pini', (c, W, lx) => piniAlti(c, W, lx(rif.slitta), lx(rif.paeseDa), luna));
    // Primo piano, davanti alla scena (non nella qualità bassa): una striscia bassa ancorata al bordo inferiore,
    // che scorre più in fretta del piano di gioco. Nell'inquadratura di mira resta libero il tratto di slitta e fionda.
    this.front = null;
    if (tier.front) {
      const p = GFX.parallax.primo;
      const W = larghezza(bounds, p);
      const [cv, c] = makeCanvas(W, p.alto, k);
      const s = 1 + (rif.ppm / PPM_REF - 1) * p.zoom;
      const lx = (wx) => ((wx - rif.left) * rif.ppm + (rif.left - bounds.minX) * rif.ppm * p.f) / s;
      primoPiano(c, W, p.alto, lx(rif.liberoDa), lx(rif.liberoA));
      this.front = { cv, W, f: p.f, zoom: p.zoom, alto: p.alto };
      toBitmap(this.front);
    }
    const R = seeded(2024);
    this.lumi = Array.from({ length: 16 }, () => ({ x: R() * VIEW_W, y: 20 + R() * 250, r: 2.6 + R() * 2.6, a: 0.7 + R() * 1.1, c: 0.35 + R() * 0.5, p: R() * TAU, q: R() * TAU, s: R() * TAU }));
  }

  /** @param {{x:number,y:number}|null} [sguardo] punto dello schermo (px logici) che guarda il gufo */
  draw(ctx, camera, t, sguardo) {
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
      if (L.gufo) this.pupille(ctx, L.gufo, -dx * L.f, hy - ORIZ * s, s, sguardo);
    }
  }

  /** Primo piano: da disegnare dopo la scena di gioco (una drawImage). */
  drawFront(ctx, camera) {
    const L = this.front;
    if (!L) return;
    const ppm = camera.ppm;
    const s = 1 + (ppm / PPM_REF - 1) * L.zoom;
    ctx.drawImage(L.cv, -(camera.x - this.bounds.minX) * ppm * L.f, VIEW_H - L.alto * s, L.W * s, L.alto * s);
  }

  /**
   * Pupille del gufo, disegnate a ogni frame sopra il piano dei pini: guardano il punto `sguardo` (schermo).
   * Lo sguardo si muove morbido verso il bersaglio; senza bersaglio torna a guardare avanti, un po' in basso.
   */
  pupille(ctx, G, ox, oy, s, sguardo) {
    const cx = ox + G.x * s;
    const cy = oy + G.y * s;
    let tx = 0;
    let ty = 0.35;
    if (sguardo) {
      const vx = sguardo.x - cx;
      const vy = sguardo.y - cy;
      const d = Math.hypot(vx, vy) || 1;
      const k = Math.min(1, d / 60); // vicinissimo: pupille quasi al centro
      tx = (vx / d) * k;
      ty = (vy / d) * k;
    }
    const o = (this.occhio ||= { x: 0, y: 0.35 });
    o.x += (tx - o.x) * 0.18;
    o.y += (ty - o.y) * 0.18;
    const u = G.u * s;
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 5 * u;
      const ey = cy;
      const px = ex + o.x * 2.1 * u;
      const py = ey + o.y * 2.1 * u;
      ctx.fillStyle = C.gufo;
      ctx.beginPath();
      ctx.ellipse(px, py, 2.7 * u, 2.9 * u, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(px - 1 * u, py - 1.2 * u, 0.95 * u, 0, TAU);
      ctx.fill();
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
  // luna: dipinta nel cielo, quindi tutti i piani delle montagne le passano davanti
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

/** Un piano di montagne largo W: vette di altezza molto varia (una su tre è alta, le altre sparse), cime innevate. Restituisce le vette. */
function montagne(c, W, k, schermoAlPiano) {
  const R = seeded(91 + k * 37);
  // Schiacciamento verticale (GFX.montiForma): le vette scendono di scala, le valli salgono sopra l'orizzonte;
  // `tondo` mescola il profilo a punta (fianchi dritti) con una campana a coseno (cima e piedi arrotondati),
  // `sposta` trasla tutte le vette in orizzontale
  const { scala, valle, tondo = 0, sposta = 0 } = GFX.montiForma[k];
  const [per, h0, h1, w0, w1] = [[4.6, 250, 520, 240, 410], [5.6, 200, 400, 190, 310]][k];
  const n = Math.max(3, Math.round((per * W) / 1300));
  const pk = [];
  // traslate a sinistra, una vetta in più in fondo copre la fine del piano (le precedenti restano identiche)
  for (let i = 0; i < n + (sposta < 0 ? 1 : 0); i++) {
    const alta = i % 3 === (k + 1) % 3;
    pk.push({ x: ((i + 0.5 + (R() - 0.5) * 0.9) / n) * W + sposta, h: h0 + (h1 - h0) * (alta ? 0.72 + R() * 0.28 : R() * 0.62), w: w0 + R() * (w1 - w0) });
  }
  // spostamenti a mano di singole vette (GFX.montiForma[k].spostaVette: {indice: px dello schermo})
  for (const [i, d] of Object.entries(GFX.montiForma[k].spostaVette || {})) if (pk[i]) pk[i].x += schermoAlPiano ? d * (schermoAlPiano(1) - schermoAlPiano(0)) : d;
  // vette alzate a mano (GFX.montiForma[k].alzaVette: {indice: altezza in più, nelle stesse unità di h})
  for (const [i, d] of Object.entries(GFX.montiForma[k].alzaVette || {})) if (pk[i]) pk[i].h += d;
  // vette tolte a mano (GFX.montiForma[k].togliVette: indici): altezza zero, gli indici delle altre non cambiano
  for (const i of GFX.montiForma[k].togliVette || []) if (pk[i]) pk[i].h = 0;
  // vette aggiunte a mano (GFX.montiForma[k].vette: x in px dello schermo nell'inquadratura di mira, h e w come le altre)
  for (const v of GFX.montiForma[k].vette || []) pk.push({ x: schermoAlPiano ? schermoAlPiano(v.x) : v.x, h: v.h, w: v.w, forma: v.forma });
  // Forme diverse (GFX.montiForma[k].varieta): ogni vetta riceve una forma da un generatore a parte, così
  // posizioni e altezze restano quelle di prima (e le regolazioni a mano valgono ancora).
  if (GFX.montiForma[k].varieta) {
    const RF = seeded(4242 + k);
    const FORME = ['aguzza', 'altopiano', 'asimmetrica', 'doppia', 'tonda'];
    pk.forEach((p, i) => {
      const f = FORME[(i + Math.floor(RF() * 2)) % FORME.length];
      p.forma ||= f; // una vetta aggiunta a mano può avere la sua forma (`forma`)
      p.lato = RF() < 0.5 ? -1 : 1; // da che parte sta il fianco lungo / la cima secondaria
    });
  }
  /** Profilo di una vetta a distanza relativa d (0 = cima, 1 = piede); `s` = lato (-1 sinistra, +1 destra). */
  const profilo = (p, dx) => {
    const lato = Math.sign(dx) || 1;
    switch (p.forma) {
      case 'aguzza': { // fianchi concavi: punta sottile e piede largo
        const d = Math.abs(dx) / p.w;
        return d >= 1 ? 0 : p.h * (1 - d) ** 1.7;
      }
      case 'altopiano': { // cima piatta e larga, fianchi ripidi
        const d = Math.abs(dx) / p.w;
        return d >= 1 ? 0 : p.h * Math.min(1, (1 - d) * 2.1) * (1 - 0.06 * Math.sin(dx * 0.08));
      }
      case 'asimmetrica': { // un fianco ripido e corto, l'altro lungo e dolce
        const w = p.w * (lato === p.lato ? 1.45 : 0.6);
        const d = Math.abs(dx) / w;
        return d >= 1 ? 0 : p.h * (1 - d) ** (lato === p.lato ? 1.25 : 0.85);
      }
      case 'doppia': { // due cime vicine con una sella in mezzo
        const d1 = Math.abs(dx) / p.w;
        const d2 = Math.abs(dx - p.lato * p.w * 0.42) / (p.w * 0.75);
        return Math.max(d1 >= 1 ? 0 : p.h * (1 - d1), d2 >= 1 ? 0 : p.h * 0.84 * (1 - d2) ** 1.2);
      }
      case 'roccia': { // vetta "vera": asimmetrica, con una spalla sul fianco lungo e piccole irregolarità di roccia
        const lungo = lato === p.lato;
        const d = Math.abs(dx) / (p.w * (lungo ? 1.25 : 0.7));
        const cima = d >= 1 ? 0 : p.h * (1 - d) ** (lungo ? 0.95 : 1.15);
        const ds = Math.abs(dx - p.lato * p.w * 0.55) / (p.w * 0.45);
        const spalla = ds >= 1 ? 0 : p.h * 0.6 * (0.5 + 0.5 * Math.cos(Math.PI * ds));
        return Math.max(cima, spalla) * (1 + 0.035 * Math.sin(dx * 0.16 + 1) + 0.025 * Math.sin(dx * 0.41));
      }
      case 'tonda': { // dorso arrotondato
        const d = Math.abs(dx) / (p.w * 1.1);
        return d >= 1 ? 0 : p.h * (0.5 + 0.5 * Math.cos(Math.PI * d));
      }
      default: {
        const d = Math.abs(dx) / p.w;
        return d >= 1 ? 0 : p.h * ((1 - d) * (1 - tondo) + (0.5 + 0.5 * Math.cos(Math.PI * d)) * tondo);
      }
    }
  };
  const quota = (x) => {
    let m = 0;
    for (const p of pk) {
      if (Math.abs(x - p.x) > p.w * 1.5) continue;
      const v = profilo(p, x - p.x);
      if (v > m) m = v;
    }
    return m;
  };
  const pts = [];
  const qq = [];
  for (let x = -6; x <= W + 6; x += 6) {
    const q = quota(x);
    qq.push(q);
    pts.push([x, ORIZ - (valle + q * 0.92 * scala + 7 * Math.sin(x * 0.045 + k) + 3 * Math.sin(x * 0.13))]);
  }
  const trac = () => {
    c.beginPath();
    c.moveTo(-6, VIEW_H);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.lineTo(W + 6, VIEW_H);
    c.closePath();
  };
  const gr = c.createLinearGradient(0, ORIZ - valle - h1 * scala, 0, ORIZ);
  gr.addColorStop(0, C.monti[k][0]); // in cima, più scuro
  gr.addColorStop(1, C.monti[k][1]); // alla base, più chiaro
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
    const hh = qq[i]; // quota della vetta prima dello schiacciamento: la neve resta sulle stesse cime
    c.lineTo(p[0], p[1] + Math.max(0, hh - soglia) * 0.5 * scala + (hh > soglia ? (i % 2) * 7 * (1 - tondo) : -2));
  });
  c.lineTo(W + 6, 0);
  c.closePath();
  c.fillStyle = C.cime;
  c.globalAlpha = 1 - k * 0.3;
  c.fill();
  c.restore();
  return pk;
}

/** Mescola due colori esadecimali (#rrggbb): t = 0 → a, t = 1 → b. */
function mescola(a, b, t) {
  const n = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t)).join(',')})`;
}

/** Gradiente verticale da `alto` (y0) a `basso` (y1): i piani scuriscono salendo. */
function verticale(c, y0, y1, alto, basso) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, alto);
  g.addColorStop(1, basso);
  return g;
}

/** Abete di sfondo (sagoma senza contorno). Con un generatore `R` ogni albero è diverso; `alto` = slanciato a più piani. */
function abete(c, x, y, h, col, neveCol, R, alto, dritto = false) {
  const r = R || (() => 0.5);
  const n = R ? (alto ? 4 : 3) + Math.floor(r() * 3) : 3;
  const w = h * (R ? (alto ? 0.17 + r() * 0.1 : 0.22 + r() * 0.2) : 0.36);
  const piega = R ? (r() - 0.5) * 0.7 * (dritto ? 0 : 1) : 0; // `dritto`: punta esattamente sopra x
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

/**
 * Profilo della città: colle sinuoso, case con tetti innevati e finestre accese, campanili. Sagoma fredda, senza contorni.
 * Le case iniziano da `da` (px del piano): a sinistra, dietro la slitta e l'albero, solo il colle con qualche abete.
 */
function paese(c, W, da) {
  const R = seeded(808);
  const yc = (x) => ORIZ - (132 + GFX.parallax.paese.alza + 30 * Math.sin(x * 0.0046 + 1) + 14 * Math.sin(x * 0.013 + 2.4));
  const colle = (dy, col) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, VIEW_H);
    for (let x = 0; x <= W + 6; x += 6) c.lineTo(x, yc(x) + dy);
    c.lineTo(W + 6, VIEW_H);
    c.fill();
  };
  // colle a gradiente: scuro in cima (dietro le case), più chiaro verso l'orizzonte
  const grColle = verticale(c, ORIZ - (132 + GFX.parallax.paese.alza + 44), ORIZ, C.paeseGrad[0], C.paeseGrad[1]);
  colle(0, grColle);
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
  const gruppi = Math.max(3, Math.round((W - da) / 560));
  for (let gi = 0; gi < gruppi; gi++) {
    const gx = da + 150 + (gi / gruppi) * (W - da);
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
      if (bx < da + 20) continue;
      casetta(bx, yc(bx) + 10 + R() * 6, 28 + R() * 24, 22 + R() * 24, 14 + R() * 18, R() < 0.5 ? C.paese2 : C.paese3);
    }
  }
  colle(16, grColle); // il colle davanti copre i piedi delle case
}

/**
 * Pini alti subito dietro la scena: collina bassa e sinuosa, alberi con la base sulla linea del terreno di gioco.
 * Dietro la slitta (`xs`, px del piano) un gruppo fisso di quattro pini; da lì fino a `xa` (oltre la chioma
 * dell'albero di gioco) nessun pino, così l'albero si legge bene; più a destra gruppi radi a caso.
 * Un pino dritto ha la punta al centro della luna (`luna`, px del piano) nell'inquadratura di mira, con un gufo
 * nero appollaiato in cima, in sagoma contro la luna.
 */
function piniAlti(c, W, xs, xa, luna) {
  const R = seeded(3131);
  const toni = C.piniLontani;
  const su = GFX.parallax.pini.alza;
  const yy = (x) => ORIZ - (34 + su + 20 * Math.sin(x * 0.0058 + 0.8) + 9 * Math.sin(x * 0.0139 + 2.2));
  c.beginPath();
  c.moveTo(-6, VIEW_H);
  for (let x = -6; x <= W + 6; x += 5) c.lineTo(x, yy(x));
  c.lineTo(W + 6, VIEW_H);
  c.closePath();
  c.fillStyle = verticale(c, ORIZ - (34 + su + 29), ORIZ, C.collinaPini[0], C.collinaPini[1]);
  c.fill();
  c.beginPath();
  for (let x = -6; x <= W + 6; x += 5) x === -6 ? c.moveTo(x, yy(x) + 1) : c.lineTo(x, yy(x) + 1);
  c.strokeStyle = 'rgba(120,135,210,0.3)';
  c.lineWidth = 2;
  c.stroke();
  // alti 225–350 px alla vista di riferimento (le case di gioco ne misurano circa 265), stretti, a gruppi radi
  // i pini dietro la slitta: il secondo più alto, gli altri più bassi e diversi tra loro
  // ogni pino ha il suo gradiente: il tono scuro in cima, più chiaro verso la base
  const tono = (y, h) => {
    const t = toni[Math.floor(R() * 3)];
    return verticale(c, y - h, y, t, mescola(t, C.piniBase, GFX.piniSchiarita));
  };
  const y0 = ORIZ + 2 - su;
  // alone scuro sfumato attorno a ogni pino: la sagoma si stacca dalle montagne chiare dietro
  // (dipinto una volta sola nel piano in cache, a ogni frame non costa nulla)
  c.shadowColor = C.piniAlone;
  c.shadowBlur = GFX.piniAlone;
  for (const [ox, h] of [[-78, 250], [0, 340], [70, 280], [150, 215]]) abete(c, xs + ox, y0, h, tono(y0, h), C.piniNeve, R, true);
  for (let x = -30 + R() * 80; x < W + 60; x += R() < 0.25 ? 56 + R() * 36 : 230 + R() * 270) {
    if (x > xs - 250 && x < Math.max(xs + 300, xa)) continue; // spazio libero attorno al gruppo e dietro l'albero
    if (Math.abs(x - luna.x) < 150) continue; // lì c'è il pino della luna
    const h = 225 + R() * 125;
    abete(c, x, y0, h, tono(y0, h), C.piniNeve, R, true);
    if (R() < 0.45) {
      const hg = h * (0.42 + R() * 0.2);
      abete(c, x + 38 + R() * 26, y0, hg, tono(y0, hg), C.piniNeve, R, true); // un giovane accanto
    }
  }
  c.shadowBlur = 0;
  c.shadowColor = 'transparent';
  // pino della luna (generatore a parte: gli altri pini restano identici)
  const G = GFX.gufo;
  const punta = luna.y + G.sotto / luna.s; // la punta poco sotto il centro: il gufo sta al centro della luna
  const hl = y0 - punta;
  const RL = seeded(77);
  const xl = luna.x + G.dx / luna.s; // un po' fuori centro rispetto alla luna
  abete(c, xl, y0, hl, verticale(c, punta, y0, toni[2], mescola(toni[2], C.piniBase, GFX.piniSchiarita)), C.piniNeve, RL, true, true);
  const u = G.alto / luna.s / 34;
  gufo(c, xl, punta, G.alto / luna.s);
  return { gufo: { x: xl, y: punta - 24 * u, u } }; // centro degli occhi (px del piano): le pupille si disegnano a ogni frame
}

/**
 * Primo piano (dall'anteprima della direzione A, piano 1,30): cumuli di neve bassi in ombra azzurra, qualche
 * cespuglio innevato e qualche paletto di steccato, appoggiati al bordo inferiore dello schermo. Canvas largo W e
 * alto H px; tra `da` e `a` (px del piano: slitta e fionda nell'inquadratura di mira) non si disegna niente.
 * Tutto resta basso (GFX.parallax.primo.alto): davanti alla scena copre solo la fascia sotto il terreno e poco più.
 */
function primoPiano(c, W, H, da, a) {
  const R = seeded(555);
  const P = GFX.parallax.primo;
  for (let x = R() * 200; x < W; x += 260 + R() * 420) {
    const w = 110 + R() * 150;
    const h = 20 + R() * 18;
    const steccato = R() < P.steccati;
    const cespuglio = R() < P.cespugli;
    const bx = x + w + 60 + R() * 80;
    if (x + w + 170 > da && x - 20 < a) continue; // tratto libero davanti a slitta e fionda
    if (steccato) {
      c.strokeStyle = '#3a2a55';
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const fx = x + w * 0.2 + i * 34;
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(fx, H);
        c.lineTo(fx + 2, H - 44 - (i % 2) * 5);
        c.stroke();
      }
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x + w * 0.2 - 12, H - 28);
      c.lineTo(x + w * 0.2 + 80, H - 34);
      c.stroke();
      c.fillStyle = '#e6ecff';
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(x + w * 0.2 + i * 34 + 2, H - 46 - (i % 2) * 5, 6, 3.5, 0, 0, TAU);
        c.fill();
      }
    }
    if (cespuglio) {
      c.fillStyle = '#1b3f52';
      for (const [dx, r] of [[-22, 20], [20, 18], [0, 27]]) {
        c.beginPath();
        c.arc(bx + dx, H - 6, r, 0, TAU);
        c.fill();
      }
      c.fillStyle = '#b9c7ee';
      c.beginPath();
      c.ellipse(bx, H - 24, 30, 11, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#e6ecff';
      c.beginPath();
      c.ellipse(bx, H - 27, 28, 9, 0, 0, TAU);
      c.fill();
    }
    const g = c.createLinearGradient(0, H - h - 8, 0, H);
    g.addColorStop(0, '#d5defa');
    g.addColorStop(1, '#8a9ad8');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, H + 2);
    c.bezierCurveTo(x + w * 0.2, H - h * 1.3, x + w * 0.55, H - h * 1.2, x + w * 0.7, H - h * 0.5);
    c.bezierCurveTo(x + w * 0.82, H - h * 0.9, x + w * 0.95, H - h * 0.4, x + w, H + 2);
    c.fill();
    c.strokeStyle = '#f4f7ff';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x + w * 0.1, H - h * 0.55);
    c.bezierCurveTo(x + w * 0.25, H - h * 1.12, x + w * 0.45, H - h * 1.1, x + w * 0.6, H - h * 0.7);
    c.stroke();
  }
}

/**
 * Gufo nero in sagoma, da cartone: tondo e paffuto, testa larga con i ciuffetti, alette e zampette, e due occhioni
 * del colore della luna (le pupille, che si muovono, le disegna Backdrop.pupille). Zampe in (x, y), alto circa `h` px.
 */
function gufo(c, x, y, h) {
  const u = h / 34;
  const ov = (cx, cy, rx, ry, rot = 0) => {
    c.beginPath();
    c.ellipse(x + cx * u, y + cy * u, rx * u, ry * u, rot, 0, TAU);
    c.fill();
  };
  c.fillStyle = C.gufo;
  // ciuffetti tondi sulla testa, piegati in fuori
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + sx * 4 * u, y - 30 * u);
    c.quadraticCurveTo(x + sx * 9 * u, y - 31 * u, x + sx * 11.5 * u, y - 35.5 * u);
    c.quadraticCurveTo(x + sx * 12 * u, y - 29 * u, x + sx * 10 * u, y - 25 * u);
    c.closePath();
    c.fill();
  }
  ov(0, -11, 10, 11.5); // pancia
  ov(0, -24, 11.5, 9); // testa larga
  for (const sx of [-1, 1]) ov(sx * 9.6, -11.5, 3.6, 7.5, sx * 0.28); // alette
  for (const sx of [-1, 1]) for (const d of [-1.2, 0, 1.2]) ov(sx * 3.6 + d, 0.2, 0.9, 1.3); // dita delle zampette
  // occhioni: bianco-luna, pupille grandi guardano un po' in basso verso il centro, punto di luce
  c.fillStyle = C.luna;
  for (const sx of [-1, 1]) ov(sx * 5, -24, 4.9, 5.1);
  // (le pupille seguono lo sguardo: Backdrop.pupille, a ogni frame)
  // becco piccolo a punta tra gli occhi, nel colore della luna più caldo
  c.fillStyle = 'rgba(255,196,110,0.95)';
  c.beginPath();
  c.moveTo(x - 1.4 * u, y - 20.4 * u);
  c.lineTo(x + 1.4 * u, y - 20.4 * u);
  c.lineTo(x, y - 17.6 * u);
  c.closePath();
  c.fill();
  // piumette della pancia: tre "v" appena accennate
  c.strokeStyle = 'rgba(255,225,160,0.22)';
  c.lineWidth = Math.max(1, 0.7 * u);
  c.lineCap = 'round';
  for (const [dx, dy] of [[-3, -11], [3, -11], [0, -7]]) {
    c.beginPath();
    c.moveTo(x + (dx - 1.4) * u, y + (dy - 1) * u);
    c.lineTo(x + dx * u, y + dy * u);
    c.lineTo(x + (dx + 1.4) * u, y + (dy - 1) * u);
    c.stroke();
  }
}
