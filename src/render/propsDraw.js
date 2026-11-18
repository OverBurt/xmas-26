import { GFX, GIFTS } from '../config.js';
import { X, Y, S, V, TAU, spess, stella5, makeSprite, blit, blitAt, arto as artoV, ovale as ovaleV } from './view.js';
import { neveTrac, palla, cappello } from './snow.js';

const C = GFX.colors;
const arto = (c, pts, w, col) => artoV(c, pts, w, col, C.contorno);
const ovale = (c, p, rx, ry, col, rot = 0, bordo = true) => ovaleV(c, p, rx, ry, col, rot, bordo ? C.contorno : null);

// ---------------------------------------------------------------- pacchi

/** Pacco col fiocco, disegnato al centro (x, y) in pixel; `k` = pixel per metro. */
function pacco(c, tipo, x, y, k, rot = 0) {
  const d = GIFTS[tipo], w = d.w * k, h = d.h * k, col = C.pacchi[tipo], r = Math.min(w, h) * 0.16, n = Math.min(w, h) * 0.2;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, r); c.fillStyle = col[0]; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(20,0,60,0.16)'; c.fillRect(w * 0.2, -h / 2, w, h); c.fillRect(-w / 2, h * 0.3, w, h);
  c.fillStyle = col[1]; c.fillRect(-n / 2, -h / 2, n, h); c.fillRect(-w / 2, -n / 2, w, n);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.roundRect(-w / 2 + r * 0.6, -h / 2 + r * 0.5, w * 0.22, Math.max(1.5, h * 0.07), 3); c.fill();
  c.restore();
  c.lineWidth = Math.max(1.2, k * 0.035); c.strokeStyle = C.contorno; c.lineJoin = 'round';
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, r); c.stroke();
  c.fillStyle = col[1]; // fiocco: due asole e un nodo
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * n * 0.85, -h / 2 - n * 0.42, n * 0.85, n * 0.5, s * 0.55, 0, TAU); c.fill(); c.stroke(); }
  c.beginPath(); c.arc(0, -h / 2 - n * 0.15, n * 0.36, 0, TAU); c.fill(); c.stroke();
  c.restore();
}

let giftSprites = null;
/** Sprite dei tre tipi di pacco (usati sulla slitta, sulla fionda, in volo e nell'HUD). */
export function buildGiftSprites(ppm) {
  giftSprites = {};
  for (const tipo of Object.keys(GIFTS)) {
    const d = GIFTS[tipo];
    const m = 0.14 + Math.min(d.w, d.h) * 0.45; // margine per contorno e fiocco
    giftSprites[tipo] = makeSprite(-d.w / 2 - 0.08, -d.h / 2 - 0.08, d.w / 2 + 0.08, d.h / 2 + m, ppm * 1.5, (c) => pacco(c, tipo, X(0), Y(0), V.ppm));
  }
}
/** Pacco nel mondo: centro (x, y) in metri, angolo in radianti (verso antiorario, come i corpi fisici). */
export function drawGift(ctx, tipo, x, y, angle = 0, scale = 1) {
  blitAt(ctx, giftSprites[tipo], x, y, angle, scale);
}
/** Pacco in coordinate schermo (HUD): `k` = pixel per metro. */
export function drawGiftIcon(ctx, tipo, sx, sy, k) {
  const sp = giftSprites[tipo];
  ctx.drawImage(sp.cv, sp.sx, sp.sy, sp.sw, sp.sh, sx + sp.x0 * k, sy - sp.y1 * k, (sp.x1 - sp.x0) * k, (sp.y1 - sp.y0) * k);
}

// ---------------------------------------------------------------- slitta e fionda

/** Slitta (senza i pacchi, che si disegnano a ogni frame): pattino dorato con ricciolo e spirale, schienale arricciato, lanterna. */
function slitta(c, x0) {
  const y = 0.75, L = spess(); c.lineCap = 'round'; c.lineJoin = 'round';
  const P = (dx, dy) => [X(x0 + dx), Y(dy)];
  const doppia = (trac, col, w) => { trac(); c.strokeStyle = C.contorno; c.lineWidth = S(w) + L * 2; c.stroke(); c.strokeStyle = col; c.lineWidth = S(w); c.stroke(); };
  // lanterna appesa al ricciolo dello schienale
  const lan = P(-0.86, 1.42), al = c.createRadialGradient(lan[0], lan[1], 1, lan[0], lan[1], S(1.1));
  al.addColorStop(0, 'rgba(255,214,120,0.5)'); al.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = al; c.fillRect(lan[0] - S(1.1), lan[1] - S(1.1), S(2.2), S(2.2));
  // pattino: ricciolo dietro, spirale grande davanti
  doppia(() => { c.beginPath(); c.moveTo(...P(-0.62, 0.42)); c.bezierCurveTo(...P(-0.9, 0.5), ...P(-0.85, 0.09), ...P(-0.3, 0.09)); c.lineTo(...P(3.7, 0.09)); c.bezierCurveTo(...P(4.45, 0.09), ...P(4.55, 0.75), ...P(4.3, 1.12)); c.bezierCurveTo(...P(4.12, 1.4), ...P(3.72, 1.3), ...P(3.78, 1.0)); c.bezierCurveTo(...P(3.82, 0.8), ...P(4.08, 0.82), ...P(4.04, 1.0)); }, C.oro, 0.1);
  doppia(() => { c.beginPath(); c.moveTo(...P(0.55, 0.1)); c.bezierCurveTo(...P(0.35, 0.22), ...P(0.8, 0.3), ...P(0.6, 0.42)); c.moveTo(...P(3.45, 0.1)); c.bezierCurveTo(...P(3.25, 0.22), ...P(3.7, 0.3), ...P(3.5, 0.42)); }, C.oro, 0.08);
  // scocca: fianco basso sotto i pacchi, schienale alto arricciato, muso tondo
  const scocca = () => {
    c.beginPath(); c.moveTo(...P(0.12, y)); c.lineTo(...P(3.9, y));
    c.bezierCurveTo(...P(4.2, y), ...P(4.3, 0.62), ...P(4.1, 0.42)); c.bezierCurveTo(...P(3.9, 0.3), ...P(3.6, 0.3), ...P(3.3, 0.3)); c.lineTo(...P(0.5, 0.3));
    c.bezierCurveTo(...P(-0.5, 0.3), ...P(-0.85, 0.9), ...P(-0.62, 1.6)); c.bezierCurveTo(...P(-0.5, 2.0), ...P(0.0, 2.12), ...P(0.2, 1.86)); c.bezierCurveTo(...P(0.36, 1.64), ...P(0.1, 1.44), ...P(-0.06, 1.6));
    c.bezierCurveTo(...P(-0.16, 1.72), ...P(-0.02, 1.84), ...P(0.05, 1.76)); c.bezierCurveTo(...P(-0.12, 1.92), ...P(-0.36, 1.8), ...P(-0.36, 1.5)); c.bezierCurveTo(...P(-0.36, 1.15), ...P(-0.15, 0.9), ...P(0.12, y)); c.closePath();
  };
  const g = c.createLinearGradient(0, Y(2), 0, Y(0.3)); g.addColorStop(0, C.slitta); g.addColorStop(1, C.slitta2);
  scocca(); c.fillStyle = g; c.fill();
  c.save(); c.clip();
  c.fillStyle = C.verdeacqua; c.fillRect(X(x0 - 1), Y(0.42), S(6), S(0.07)); // filetto verde acqua
  c.strokeStyle = C.oro; c.lineWidth = Math.max(1.5, S(0.045)); // volute dorate
  c.beginPath(); c.moveTo(...P(0.5, 0.56)); c.bezierCurveTo(...P(0.9, 0.72), ...P(1.2, 0.46), ...P(1.5, 0.58)); c.bezierCurveTo(...P(1.72, 0.66), ...P(1.62, 0.5), ...P(1.52, 0.54));
  c.moveTo(...P(3.8, 0.56)); c.bezierCurveTo(...P(3.4, 0.72), ...P(3.1, 0.46), ...P(2.8, 0.58)); c.bezierCurveTo(...P(2.58, 0.66), ...P(2.68, 0.5), ...P(2.78, 0.54));
  c.moveTo(...P(-0.42, 1.2)); c.bezierCurveTo(...P(-0.5, 0.9), ...P(-0.2, 0.7), ...P(-0.05, 0.6)); c.stroke();
  c.fillStyle = C.oro; stella5(c, ...P(2.15, 0.56), S(0.11)); c.fill();
  c.restore();
  scocca(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
  // bordo di pelliccia sul pianale e campanelli
  for (let i = 0; i < 13; i++) palla(c, X(x0 + 0.28 + i * 0.3), Y(y - 0.1), S(0.1));
  for (const dx of [0.6, 3.5]) { c.fillStyle = C.oro; c.beginPath(); c.arc(...P(dx, 0.46), S(0.085), 0, TAU); c.fill(); c.strokeStyle = C.contorno; c.lineWidth = L * 0.8; c.stroke(); }
  // lanterna
  c.strokeStyle = C.contorno; c.lineWidth = L; c.beginPath(); c.moveTo(...P(-0.62, 1.6)); c.quadraticCurveTo(...P(-0.9, 1.8), ...P(-0.86, 1.56)); c.stroke();
  c.beginPath(); c.roundRect(lan[0] - S(0.12), lan[1] - S(0.14), S(0.24), S(0.3), S(0.06)); c.fillStyle = '#fff0b0'; c.fill(); c.stroke();
  c.fillStyle = C.oro2; c.fillRect(lan[0] - S(0.14), lan[1] - S(0.17), S(0.28), S(0.06)); c.fillRect(lan[0] - S(0.14), lan[1] + S(0.14), S(0.28), S(0.05));
}

export function buildSleighSprite(sleigh, ppm) {
  return makeSprite(sleigh.x - 2.1, -0.05, sleigh.x + 4.75, 2.7, ppm, (c) => slitta(c, sleigh.x));
}

/** Fionda: ramo a forcella con legatura a righe; `tiro` = vettore di tensione (m) col pacco caricato, oppure null a riposo. */
function fionda(c, x, y, tiro, tipo = 'standard') {
  if (tiro && Math.hypot(tiro[0], tiro[1]) < 0.02) tiro = [-0.02, 0]; // pacco appena caricato: sacca dietro, verso la slitta
  const fL = [x - 0.35, y + 0.15], fR = [x + 0.35, y + 0.15], nodo = [x, y - 0.6], L = spess();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const ramo = (trac, col, w) => { trac(); c.strokeStyle = C.contorno; c.lineWidth = S(w) + L * 2; c.stroke(); c.strokeStyle = col; c.lineWidth = S(w); c.stroke(); };
  const fascia = (a, b) => { c.strokeStyle = C.contorno; c.lineWidth = S(0.085) + L; c.beginPath(); c.moveTo(X(a[0]), Y(a[1])); c.lineTo(X(b[0]), Y(b[1])); c.stroke(); c.strokeStyle = C.elastico; c.lineWidth = S(0.085); c.stroke(); };
  const sacca = tiro ? [x + tiro[0], y + tiro[1]] : [x, y - 0.1];
  ramo(() => { c.beginPath(); c.moveTo(X(nodo[0]), Y(nodo[1])); c.quadraticCurveTo(X(x + 0.42), Y(y - 0.45), X(fR[0]), Y(fR[1])); }, C.legno2, 0.2); // braccio dietro
  fascia(fR, sacca);
  if (tiro) drawGift(c, tipo, sacca[0], sacca[1], 0.15);
  { // sacca di cuoio: a riposo un rettangolino, in tensione una fascia dietro il pacco, di traverso al tiro
    let p = [sacca[0] - 0.17, sacca[1]], q = [sacca[0] + 0.17, sacca[1]];
    if (tiro) { const n = Math.hypot(tiro[0], tiro[1]), ux = tiro[0] / n, uy = tiro[1] / n, d = GIFTS[tipo], o = Math.max(d.w, d.h) / 2 + 0.06; p = [sacca[0] + ux * o - uy * 0.26, sacca[1] + uy * o + ux * 0.26]; q = [sacca[0] + ux * o + uy * 0.26, sacca[1] + uy * o - ux * 0.26]; }
    c.beginPath(); c.moveTo(X(p[0]), Y(p[1])); c.lineTo(X(q[0]), Y(q[1])); c.strokeStyle = C.contorno; c.lineWidth = S(0.16) + L * 2; c.stroke(); c.strokeStyle = C.legno2; c.lineWidth = S(0.16); c.stroke();
  }
  fascia(sacca, fL);
  ramo(() => { c.beginPath(); c.moveTo(X(x + 0.05), Y(0)); c.bezierCurveTo(X(x - 0.12), Y(0.6), X(x + 0.1), Y(1.3), X(nodo[0]), Y(nodo[1])); c.quadraticCurveTo(X(x - 0.42), Y(y - 0.45), X(fL[0]), Y(fL[1])); }, C.legno, 0.22);
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = S(0.04); c.beginPath(); c.moveTo(X(x - 0.02), Y(0.3)); c.bezierCurveTo(X(x - 0.13), Y(0.8), X(x + 0.03), Y(1.3), X(x - 0.05), Y(y - 0.75)); c.stroke();
  for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? '#fff' : C.elastico; c.lineWidth = S(0.07); c.beginPath(); c.moveTo(X(x - 0.13), Y(y - 0.86 + i * 0.075)); c.lineTo(X(x + 0.13), Y(y - 0.83 + i * 0.075)); c.stroke(); }
  for (const f of [fL, fR]) { c.fillStyle = C.legno; c.strokeStyle = C.contorno; c.lineWidth = L; c.beginPath(); c.arc(X(f[0]), Y(f[1]), S(0.13), 0, TAU); c.fill(); c.stroke(); }
  neveTrac(c, () => { c.beginPath(); c.ellipse(X(x), Y(0.02), S(0.6), S(0.16), 0, Math.PI, 0); c.closePath(); }, [X(x - 0.6), Y(0.18), X(x + 0.6), Y(0)], { liscia: true });
}

/** Fionda del gioco: a riposo, col pacco che arriva (animazione di carico) o tesa col pacco nella sacca. */
export function drawSling(ctx, sling) {
  const teso = sling.loaded && !sling.loadAnim;
  fionda(ctx, sling.x, sling.y, teso ? [sling.pullX, sling.pullY] : null, sling.loaded?.type);
  if (sling.loaded && sling.loadAnim) drawGift(ctx, sling.loaded.type, sling.loadX, sling.loadY);
}

// ---------------------------------------------------------------- pupazzi

/** Una palla del pupazzo coi suoi dettagli, centrata in (0,0): ruota con la palla quando il pupazzo si divide. */
function pallaPupazzo(c, role, r, sciarpa) {
  const x = X(0), y = Y(0), rr = S(r), k = V.ppm;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (role === 'mid') { // rametti curvi
    c.strokeStyle = C.corteccia;
    c.lineWidth = Math.max(1.5, k * 0.05);
    c.beginPath();
    c.moveTo(x - rr * 0.8, y); c.quadraticCurveTo(x - rr * 1.5, y - rr * 0.1, x - rr * 1.9, y - rr * 0.8);
    c.moveTo(x + rr * 0.8, y); c.quadraticCurveTo(x + rr * 1.5, y - rr * 0.2, x + rr * 1.8, y - rr * 0.95);
    c.stroke();
  }
  palla(c, x, y, rr);
  if (role === 'mid') {
    c.fillStyle = '#1b1b2a';
    for (const by of [-0.35, 0, 0.35]) { c.beginPath(); c.arc(x - rr * 0.15, y + by * rr, Math.max(1, rr * 0.09), 0, TAU); c.fill(); }
  } else if (role === 'head') {
    const berretto = sciarpa === '#2f9e6b' || sciarpa === '#3a6fd8' ? '#e2453c' : C.verdeacqua;
    c.fillStyle = sciarpa; c.strokeStyle = C.contorno; c.lineWidth = Math.max(1, k * 0.03);
    c.beginPath(); c.roundRect(x - rr * 0.95, y + rr * 0.68, rr * 1.9, rr * 0.42, rr * 0.2); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(x + rr * 0.3, y + rr * 0.9, rr * 0.4, rr * 0.95, rr * 0.15); c.fill(); c.stroke();
    // berretto di lana col pompon (decorazione: sporge dal cerchio fisico di ~10 cm)
    c.fillStyle = berretto; c.beginPath(); c.arc(x, y - rr * 0.25, rr * 0.95, Math.PI * 1.08, Math.PI * 1.92); c.quadraticCurveTo(x, y - rr * 0.75, x - rr * 0.9, y - rr * 0.48); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + rr * 0.1, y - rr * 1.22, rr * 0.26, 0, TAU); c.fill(); c.strokeStyle = C.neveLinea; c.stroke();
    c.fillStyle = '#1b1b2a';
    for (const ex of [-0.42, 0.1]) { c.beginPath(); c.arc(x + ex * rr, y - rr * 0.05, Math.max(1, rr * 0.11), 0, TAU); c.fill(); }
    c.strokeStyle = '#1b1b2a'; c.lineWidth = Math.max(1, k * 0.025); c.beginPath(); c.arc(x - rr * 0.2, y + rr * 0.2, rr * 0.35, 0.3, 2.2); c.stroke(); // sorriso
    c.fillStyle = '#ff8f2a'; c.strokeStyle = C.contorno; // carota verso la fionda
    c.beginPath(); c.moveTo(x - rr * 0.15, y + rr * 0.02); c.quadraticCurveTo(x - rr * 0.8, y + rr * 0.02, x - rr * 1.2, y + rr * 0.2); c.quadraticCurveTo(x - rr * 0.6, y + rr * 0.28, x - rr * 0.15, y + rr * 0.26); c.closePath(); c.fill(); c.stroke();
  }
}
const pupazzi = new Map();
export function resetSnowmanSprites() {
  pupazzi.clear();
}
/** Sprite di una palla di pupazzo (in cache per ruolo, sciarpa e raggio). */
export function snowmanSprite(role, r, sciarpa, ppm) {
  const key = `${role}|${sciarpa}|${r.toFixed(2)}`;
  let sp = pupazzi.get(key);
  if (!sp) {
    const m = r * 2.2 + 0.1;
    sp = makeSprite(-m, -m, m, m, ppm * 1.25, (c) => pallaPupazzo(c, role, r, sciarpa || '#e2453c'));
    pupazzi.set(key, sp);
  }
  return sp;
}

// ---------------------------------------------------------------- decorazioni del piano di gioco (nessun corpo fisico)

function lampione(c, x, g) {
  const P = (dx, dy) => [X(x + dx), Y(g + dy)], ferro = '#2c2755', lz = P(0.42, 2.72), rg = S(2.3);
  const al = c.createRadialGradient(lz[0], lz[1], 2, lz[0], lz[1], rg); al.addColorStop(0, 'rgba(255,214,120,0.5)'); al.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = al; c.fillRect(lz[0] - rg, lz[1] - rg, rg * 2, rg * 2);
  arto(c, [P(0, 0), P(0.03, 1.6), P(0, 3.1), P(0.14, 3.34), P(0.36, 3.3), P(0.42, 3.08)], S(0.11), ferro);
  arto(c, [P(-0.02, 0.02), P(0.0, 0.5)], S(0.2), ferro);
  c.beginPath(); c.moveTo(...P(0.27, 2.98)); c.lineTo(...P(0.57, 2.98)); c.lineTo(...P(0.52, 2.5)); c.lineTo(...P(0.32, 2.5)); c.closePath(); c.fillStyle = '#fff0b0'; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = spess(); c.lineJoin = 'round'; c.stroke();
  arto(c, [P(0.24, 3.0), P(0.6, 3.0)], S(0.08), ferro); arto(c, [P(0.31, 2.47), P(0.53, 2.47)], S(0.07), ferro);
  cappello(c, () => g + 3.04, x + 0.2, x + 0.64, { sp: 0.06, dome: 0.13, maxGoccia: 0.22, gocce: 0.35, seme: 9 });
  for (const s of [-1, 1]) ovale(c, P(0.03 + s * 0.1, 1.72), S(0.11), S(0.07), '#ff6f61', s * 0.5); // fiocco rosso
  cappello(c, () => g + 0.04, x - 0.4, x + 0.4, { sp: 0.05, dome: 0.16, gocce: 0, seme: 2 });
}
function cartello(c, x, g) {
  const P = (dx, dy) => [X(x + dx), Y(g + dy)], lz = P(-0.5, 0.78), rg = S(1.1);
  const al = c.createRadialGradient(lz[0], lz[1], 1, lz[0], lz[1], rg); al.addColorStop(0, 'rgba(255,214,120,0.45)'); al.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = al; c.fillRect(lz[0] - rg, lz[1] - rg, rg * 2, rg * 2);
  arto(c, [P(0.02, 0), P(-0.02, 0.7), P(0.02, 1.42)], S(0.13), C.legno2);
  arto(c, [P(0, 1.02), P(-0.5, 1.06)], S(0.06), C.legno2); arto(c, [P(-0.5, 1.04), P(-0.5, 0.92)], S(0.025), C.contorno);
  c.beginPath(); c.roundRect(lz[0] - S(0.1), lz[1] - S(0.13), S(0.2), S(0.26), S(0.05)); c.fillStyle = '#fff0b0'; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = spess(); c.stroke();
  c.beginPath(); c.moveTo(...P(-0.5, 1.02)); c.lineTo(...P(0.52, 1.1)); c.lineTo(...P(0.82, 1.34)); c.lineTo(...P(0.5, 1.54)); c.lineTo(...P(-0.52, 1.46)); c.closePath(); c.fillStyle = C.legno; c.fill(); c.lineJoin = 'round'; c.stroke(); // tavola a freccia verso le case
  c.strokeStyle = 'rgba(60,30,10,0.35)'; c.lineWidth = Math.max(1, S(0.025)); c.beginPath(); c.moveTo(...P(-0.4, 1.2)); c.lineTo(...P(0.6, 1.28)); c.stroke();
  pacco(c, 'standard', ...P(-0.12, 1.26), V.ppm * 0.5, 0.08);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(...P(0.2, 1.33)); c.lineTo(...P(0.44, 1.35)); c.lineTo(...P(0.44, 1.42)); c.lineTo(...P(0.62, 1.31)); c.lineTo(...P(0.45, 1.19)); c.lineTo(...P(0.45, 1.26)); c.lineTo(...P(0.2, 1.24)); c.closePath(); c.fill();
  cappello(c, (xx) => g + 1.46 + (xx - (x - 0.52)) * 0.078, x - 0.54, x + 0.52, { sp: 0.05, dome: 0.11, maxGoccia: 0.3, gocce: 0.3, seme: 4 });
  cappello(c, () => g + 0.04, x - 0.36, x + 0.38, { sp: 0.05, dome: 0.14, gocce: 0, seme: 3 });
}
function cespuglio(c, x, g, k = 1) {
  const P = (dx, dy) => [X(x + dx * k), Y(g + dy * k)];
  for (const [dx, dy, r, col] of [[-0.38, 0.22, 0.3, C.pino2], [0.36, 0.2, 0.28, C.pino2], [0, 0.32, 0.4, C.pino]]) ovale(c, P(dx, dy), S(r * k), S(r * k * 0.9), col);
  c.fillStyle = '#ff6f61'; for (const [dx, dy] of [[-0.3, 0.14], [0.12, 0.2], [0.42, 0.12], [-0.05, 0.4]]) { c.beginPath(); c.arc(...P(dx, dy), Math.max(1.6, S(0.05 * k)), 0, TAU); c.fill(); }
  cappello(c, (xx) => g + (0.5 - 0.5 * ((xx - x) / (0.62 * k)) ** 2) * k, x - 0.56 * k, x + 0.56 * k, { sp: 0.14 * k, su: 0.12 * k, maxGoccia: 0.22 * k, gocce: 0.3, seme: Math.round(x * 7) });
}
function slittino(c, x, g) {
  const P = (dx, dy) => [X(x + dx), Y(g + dy)];
  arto(c, [P(-0.05, 0.02), P(0.5, 0.75), P(0.62, 1.12), P(0.5, 1.26), P(0.36, 1.16)], S(0.07), C.legno2);
  arto(c, [P(0.25, 0.02), P(0.8, 0.75), P(0.92, 1.12), P(0.8, 1.26), P(0.66, 1.16)], S(0.07), C.legno);
  for (const u of [0.25, 0.5, 0.75]) arto(c, [P(-0.05 + 0.6 * u * 0.9 + 0.02, 0.02 + 0.85 * u), P(0.25 + 0.6 * u * 0.9 + 0.05, 0.02 + 0.85 * u)], S(0.09), C.oro);
  arto(c, [P(0.5, 1.24), P(0.3, 0.7), P(0.02, 0.5)], S(0.03), '#e03a45'); // cordicella
  cappello(c, () => g + 0.04, x - 0.3, x + 0.5, { sp: 0.05, dome: 0.12, gocce: 0, seme: 6 });
}

const DECORI = {
  lampione: { fn: (c, d) => lampione(c, d.x, d.y || 0), box: [-2.0, -0.05, 2.9, 5.15] },
  cartello: { fn: (c, d) => cartello(c, d.x, d.y || 0), box: [-1.7, -0.05, 1.0, 2.0] },
  cespuglio: { fn: (c, d) => cespuglio(c, d.x, d.y || 0, d.k || 1), box: [-0.8, -0.05, 0.8, 0.9] },
  slittino: { fn: (c, d) => slittino(c, d.x, d.y || 0), box: [-0.45, -0.05, 1.1, 1.5] },
};
/** Sprite delle decorazioni del livello (`decor` nel JSON: [{ type, x, y?, k? }]). */
export function buildDecorSprites(decor, ppm) {
  const out = [];
  for (const d of decor || []) {
    const def = DECORI[d.type];
    if (!def) continue;
    const k = d.type === 'cespuglio' ? d.k || 1 : 1;
    const g = d.y || 0;
    out.push(makeSprite(d.x + def.box[0] * k, g + def.box[1], d.x + def.box[2] * k, g + def.box[3] * k, ppm, (c) => def.fn(c, d)));
  }
  return out;
}
export function drawSprites(ctx, list) {
  for (const sp of list) blit(ctx, sp);
}
