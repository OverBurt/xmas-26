import { VIEW_W, VIEW_H, GFX } from '../config.js';

/**
 * Vista corrente del disegno. Tutto il rendering lavora in pixel logici (y verso il basso) e converte i metri
 * del mondo con X/Y/S: la stessa funzione disegna sullo schermo (vista = camera) o dentro uno sprite in cache
 * (vista = riquadro dello sprite).
 */
export const V = { ppm: 1, left: 0, bot: 0, h: VIEW_H };
export const X = (x) => (x - V.left) * V.ppm;
export const Y = (y) => V.h - (y - V.bot) * V.ppm;
export const S = (m) => m * V.ppm;
export function setView(ppm, left, bot, h) {
  V.ppm = ppm;
  V.left = left;
  V.bot = bot;
  V.h = h;
}
export const TAU = Math.PI * 2;

/**
 * Ingrandimento di HUD ed etichette sugli schermi piccoli. Il disegno è in px logici (1280×600): su un telefono
 * un px logico vale ~0.6 px dello schermo e i testi da 14 px diventerebbero illeggibili. `k` = 1 su desktop,
 * cresce fino a GFX.hudScaleMax quando la scena è rimpicciolita (impostato da main.js a ogni ridimensionamento).
 */
export const HUD = { k: 1 };
export function setHudScale(scalaCss) {
  HUD.k = Math.min(GFX.hudScaleMax, Math.max(1, GFX.hudScaleRef / scalaCss));
}

/**
 * Ingombro dei pulsanti DOM in alto a destra, in px logici (main.js lo aggiorna a ogni ridimensionamento):
 * `left` = bordo sinistro del gruppo, `bottom` = bordo inferiore. Sul telefono 1 px CSS vale ~1.6 px logici,
 * quindi i pulsanti occupano molto più spazio della vista logica che su desktop.
 */
export const UI = { left: VIEW_W, bottom: 0 };
export function setUiBox(left, bottom) {
  UI.left = left;
  UI.bottom = bottom;
}

/**
 * Posto del pannello di fine livello: disegnato per stare in x 360–920, y 16–516 (neve del bordo compresa).
 * Se i pulsanti in alto a destra lo toccherebbero (telefoni), il pannello scende sotto di loro e, se non ci sta
 * tutto, si rimpicciolisce attorno al centro orizzontale. Restituisce la trasformazione da applicare:
 * schermo = (x − VIEW_W/2)·f + VIEW_W/2, y·f + dy. La usano il disegno (hudDraw) e il tocco dei pulsanti (gestures).
 */
export function panelFit() {
  const P = GFX.pannello;
  if (UI.left > P.x1 + P.margine) return { f: 1, dy: 0 };
  const top = UI.bottom + P.margine;
  const f = Math.min(1, (VIEW_H - P.margine - top) / (P.y1 - P.y0));
  return { f, dy: Math.max(0, top - P.y0 * f) };
}

/** Generatore pseudo-casuale a seme fisso, separato da quello del gioco (non altera fratture e simulazioni). */
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h, k = 1) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * k));
  cv.height = Math.max(1, Math.ceil(h * k));
  const c = cv.getContext('2d');
  c.scale(k, k);
  return [cv, c];
}

/**
 * Sprite in cache: disegna una volta il riquadro del mondo [x0,x1]×[y0,y1] (metri) a `ppm` pixel per metro.
 * `draw(c)` usa X/Y/S come sullo schermo. Lo sprite si mette poi in scena con `blit`.
 */
export function makeSprite(x0, y0, x1, y1, ppm, draw) {
  const old = { ...V };
  const w = (x1 - x0) * ppm;
  const h = (y1 - y0) * ppm;
  const [cv, c] = makeCanvas(w, h);
  setView(ppm, x0, y0, h);
  draw(c);
  setView(old.ppm, old.left, old.bot, old.h);
  const sp = { cv, sx: 0, sy: 0, sw: cv.width, sh: cv.height, x0, y0, x1, y1 };
  if (!inAtlas(sp)) toBitmap(sp); // gli sprite grandi (case) restano a sé, caricati una volta sulla scheda video
  return sp;
}

/**
 * Atlante degli sprite piccoli (pezzi di neve e ghiaccio, pupazzi, pacchi, decorazioni...): tutti copiati dentro
 * pochi canvas grandi. Disegnare decine di immagini diverse costa molto alla scheda video del telefono
 * (S21: 27 FPS a scena ferma); dallo stesso atlante i disegni si raggruppano e il costo crolla.
 */
const ATLAS = GFX.atlas;
let atlante = null;
/** Da chiamare quando si ricostruiscono gli sprite (nuovo livello o qualità): si riparte con un atlante vuoto. */
export function resetAtlas() {
  atlante = null;
}
function inAtlas(sp) {
  const w = sp.sw;
  const h = sp.sh;
  if (w > ATLAS.maxSprite || h > ATLAS.maxSprite) return false;
  const nuovo = () => {
    const [cv, c] = makeCanvas(ATLAS.size, ATLAS.size);
    atlante = { cv, c, x: 0, y: 0, riga: 0 };
  };
  if (!atlante) nuovo();
  if (atlante.x + w > ATLAS.size) { // riga piena: si va a capo
    atlante.x = 0;
    atlante.y += atlante.riga + ATLAS.pad;
    atlante.riga = 0;
  }
  if (atlante.y + h > ATLAS.size) nuovo(); // atlante pieno: se ne apre un altro
  atlante.c.drawImage(sp.cv, atlante.x, atlante.y);
  sp.cv = atlante.cv;
  sp.sx = atlante.x;
  sp.sy = atlante.y;
  atlante.x += w + ATLAS.pad;
  atlante.riga = Math.max(atlante.riga, h);
  return true;
}

/**
 * Un canvas grande ma fermo (sfondo, case) si può convertire in ImageBitmap: si carica sulla scheda video
 * una volta sola. Appena pronto sostituisce il canvas.
 */
export function toBitmap(sp, key = 'cv') {
  if (typeof createImageBitmap !== 'function') return;
  createImageBitmap(sp[key]).then((bmp) => { sp[key] = bmp; }, () => {});
}
/** Disegna uno sprite fermo nel mondo. */
export function blit(ctx, sp, dx = 0, dy = 0) {
  ctx.drawImage(sp.cv, sp.sx, sp.sy, sp.sw, sp.sh, X(sp.x0 + dx), Y(sp.y1 + dy), S(sp.x1 - sp.x0), S(sp.y1 - sp.y0));
}
/** Disegna uno sprite costruito in coordinate locali di un corpo, alla posizione e all'angolo del corpo. */
export function blitAt(ctx, sp, x, y, angle = 0, scale = 1) {
  ctx.save();
  ctx.translate(X(x), Y(y));
  if (angle) ctx.rotate(-angle);
  const k = V.ppm * scale;
  ctx.drawImage(sp.cv, sp.sx, sp.sy, sp.sw, sp.sh, sp.x0 * k, -sp.y1 * k, (sp.x1 - sp.x0) * k, (sp.y1 - sp.y0) * k);
  ctx.restore();
}

// ---------------------------------------------------------------- tracciati

export const px = (pts) => pts.map((p) => [X(p[0]), Y(p[1])]);
export const rett = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** Da vertici {x,y} (corpi fisici) a coppie [x,y]. */
export const coppie = (pts) => pts.map((p) => [p.x, p.y]);

/** Poligono chiuso in pixel; con `r` gli spigoli sono arrotondati. */
export function tracciato(c, P, r = 0) {
  c.beginPath();
  const n = P.length;
  if (!r) for (let i = 0; i < n; i++) i ? c.lineTo(P[i][0], P[i][1]) : c.moveTo(P[i][0], P[i][1]);
  else {
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = m(P[n - 1], P[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const q = m(P[i], P[(i + 1) % n]);
      c.arcTo(P[i][0], P[i][1], q[0], q[1], r);
    }
  }
  c.closePath();
}
export function stella4(c, x, y, r, k = 0.28) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * k : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
export function stella5(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
export function limiti(P) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of P) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return [x0, y0, x1, y1];
}
/** Spessore del contorno scuro "da fumetto", proporzionale alla scala. */
export const spess = () => Math.max(1.3, S(0.04));

/** Curva continua y = f(x) campionata fitta (circa ogni 4 px): nessuna spezzata visibile. */
export function liscia(c, f, x0, x1, inizia) {
  const passo = Math.max(0.03, 4 / V.ppm);
  for (let x = x0, i = 0; ; x += passo, i++) {
    const xx = Math.min(x, x1);
    if (inizia && i === 0) c.moveTo(X(xx), Y(f(xx)));
    else c.lineTo(X(xx), Y(f(xx)));
    if (xx >= x1) break;
  }
}

/** Linea spessa con le punte tonde e il contorno scuro (zampe, pali, rami). Punti in pixel. */
export function arto(c, pts, w, col, contorno) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = contorno;
  c.lineWidth = w + spess() * 2;
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
}
export function ovale(c, p, rx, ry, col, rot = 0, contorno = null) {
  c.beginPath();
  c.ellipse(p[0], p[1], rx, ry, rot, 0, TAU);
  c.fillStyle = col;
  c.fill();
  if (contorno) {
    c.strokeStyle = contorno;
    c.lineWidth = spess();
    c.stroke();
  }
}
