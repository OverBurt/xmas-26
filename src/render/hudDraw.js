import { VIEW_W, VIEW_H, GFX, GIFTS, SCORE } from '../config.js';
import { WALL, isPlugged } from '../entities/house.js';
import { centroid } from '../physics/polygon.js';
import { X, Y, TAU, stella5 } from './view.js';
import { drawGiftIcon } from './propsDraw.js';

const C = GFX.colors;
const FONT = GFX.font;
const ZONE_LABEL_OFFSET = 0.9;
const AZZURRO = '#9fe0ff'; // apertura tappata dalla neve

/** Testo col bordo scuro (punti, titoli). Coordinate schermo. */
function testo(c, txt, x, y, pxs, o = {}) {
  c.save();
  c.globalAlpha = o.alfa ?? 1;
  c.font = `${o.peso || 700} ${pxs}px ${FONT}`;
  c.textAlign = o.all || 'center';
  c.textBaseline = 'middle';
  if (o.bordo !== false) {
    c.lineJoin = 'round';
    c.lineWidth = pxs * 0.14;
    c.strokeStyle = o.bordo || '#3a1d00';
    c.strokeText(txt, x, y);
  }
  c.fillStyle = o.col || C.oro;
  c.fillText(txt, x, y);
  c.restore();
}
function pillola(c, x, y, w, h) {
  c.fillStyle = C.hud;
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.fill();
  c.strokeStyle = C.hudBordo;
  c.lineWidth = 1;
  c.stroke();
}
function icona(c, tipo, x, y, col) {
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 1.5;
  if (tipo === 'chimney') {
    c.beginPath();
    c.moveTo(x - 6, y - 6);
    c.lineTo(x + 6, y - 6);
    c.lineTo(x + 3.5, y + 6);
    c.lineTo(x - 3.5, y + 6);
    c.closePath();
    c.fill();
  } else if (tipo === 'window') {
    c.beginPath();
    c.roundRect(x - 5.5, y - 5.5, 11, 11, 2);
    c.stroke();
    c.beginPath();
    c.moveTo(x, y - 5.5);
    c.lineTo(x, y + 5.5);
    c.moveTo(x - 5.5, y);
    c.lineTo(x + 5.5, y);
    c.stroke();
  } else {
    c.beginPath();
    c.roundRect(x - 4.5, y - 6.5, 9, 13, [4.5, 4.5, 0, 0]);
    c.fill();
  }
}
/** Fiocco di neve a sei raggi (contorno), centro (x, y), raggio r. */
function fiocco(c, x, y, r, col) {
  c.save();
  c.strokeStyle = col;
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    c.moveTo(x, y);
    c.lineTo(x + ca * r, y + sa * r);
    // rametti a metà raggio
    const mx = x + ca * r * 0.55;
    const my = y + sa * r * 0.55;
    for (const d of [-0.7, 0.7]) {
      c.moveTo(mx, my);
      c.lineTo(mx + Math.cos(a + d) * r * 0.38, my + Math.sin(a + d) * r * 0.38);
    }
  }
  c.stroke();
  c.restore();
}

/**
 * Etichetta dei punti di un'apertura: pillola scura con l'icona. Dorata se vale il massimo;
 * dopo una consegna il valore cala: l'etichetta si spegne e mostra una freccina in giù.
 * Tappata (neve sul camino o cumulo alla porta): bordo azzurro, fiocco di neve e un cuscinetto di neve
 * sul bordo superiore; torna normale quando la neve è stata tolta.
 */
function etichetta(c, tipo, punti, x, y, top, calata, tappata) {
  c.font = `600 14px ${FONT}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const txt = String(punti);
  const w = c.measureText(txt).width + 36 + (calata ? 12 : 0) + (tappata ? 20 : 0);
  c.fillStyle = tappata ? 'rgba(14,30,72,0.82)' : C.hud;
  c.beginPath();
  c.roundRect(x - w / 2, y - 11, w, 22, 11);
  c.fill();
  c.strokeStyle = tappata ? AZZURRO : top ? C.oro : C.hudBordo;
  c.lineWidth = tappata ? 2 : top ? 1.6 : 1;
  c.stroke();
  const col = tappata ? AZZURRO : top ? C.oro : calata ? '#c9d1f5' : '#fff';
  icona(c, tipo, x - w / 2 + 14, y, col);
  c.fillStyle = col;
  c.fillText(txt, x - w / 2 + 26, y + 1);
  if (calata) {
    const ax = x + w / 2 - (tappata ? 37 : 17);
    c.beginPath();
    c.moveTo(ax, y - 3);
    c.lineTo(ax + 8, y - 3);
    c.lineTo(ax + 4, y + 4);
    c.fill();
  }
  if (tappata) {
    fiocco(c, x + w / 2 - 15, y, 7, '#ffffff');
    // cuscinetto di neve sopra la pillola (come il cappello sul camino)
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(x - w / 2 + 8, y - 9);
    c.quadraticCurveTo(x - w / 4, y - 19, x, y - 14);
    c.quadraticCurveTo(x + w / 4, y - 20, x + w / 2 - 8, y - 9);
    c.closePath();
    c.fill();
  }
}

/** Valori delle aperture e punti fluttuanti, in coordinate schermo (testo sempre nitido). Vista = camera. */
export function drawWorldLabels(ctx, game) {
  for (const h of game.houses) {
    for (const z of h.zones) {
      const top = z.points >= SCORE.maxPoints && !z.count;
      const tappata = z.type !== 'window' && isPlugged(h, z.type);
      if (z.type === 'chimney') etichetta(ctx, z.type, z.points, X(h.chimney.top.x + 0.9), Y(h.chimney.top.y + 0.75), top, z.count > 0, tappata);
      else {
        const c = centroid(z.poly);
        etichetta(ctx, z.type, z.points, X(c.x - WALL - ZONE_LABEL_OFFSET - 0.35), Y(c.y), top, z.count > 0, tappata);
      }
    }
  }
  for (const f of game.floaters) {
    const a = f.t < SCORE.floaterLife - 0.6 ? 1 : 1 - (f.t - SCORE.floaterLife + 0.6) / 0.6; // svanisce nell'ultimo 0.6 s
    testo(ctx, f.text, X(f.x), Y(f.y), f.big ? 40 : 30, { alfa: Math.max(0, a), col: f.bad ? '#ff8a8a' : C.oro }); // punti tolti in rosso
  }
}

/**
 * HUD: pacchi rimasti e punti in alto a sinistra, suggerimento del momento sotto, nome del livello a destra.
 * @param {number} [top] bordo inferiore dei pulsanti DOM in alto a destra (px logici): il nome va sotto
 */
export function drawHud(ctx, game, top = 0) {
  const tipi = game.sleigh.gifts.map((g) => g.type);
  if (game.sling.loaded) tipi.push(game.sling.loaded.type);
  if (game.carry) tipi.push(game.carry.gift.type);
  const punti = game.score.toLocaleString('it-IT');
  ctx.font = `700 22px ${FONT}`;
  const wn = ctx.measureText(punti).width;
  const wi = Math.max(1, tipi.length) * 27 + 14;
  pillola(ctx, 16, 14, wi + 30 + wn + 56, 44);
  let x = 36;
  if (!tipi.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', x, 37);
  }
  for (const t of tipi) {
    drawGiftIcon(ctx, t, x + 4, 38, 30 * (t === 'big' ? 0.82 : 1));
    x += 27;
  }
  x = 16 + wi + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x, 22, 1.5, 28);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(punti, x + 14, 37);
  ctx.font = `500 13px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText('punti', x + 22 + wn, 39);
  ctx.globalAlpha = 0.72;
  ctx.textAlign = 'right';
  ctx.font = `500 14px ${FONT}`;
  // sotto i pulsanti: su desktop a 76, sul telefono (pulsanti più grandi nella vista logica) più in basso
  ctx.fillText(game.level.name, VIEW_W - 16, Math.max(76, top + 16));
  ctx.globalAlpha = 1;

  let hint = '';
  if (game.state === 'ready') {
    if (game.sling.loaded) hint = 'Tira indietro il pacco e rilascia';
    else if (game.sleigh.count) hint = 'Trascina un pacco sulla fionda e tira indietro';
  } else if (game.veloce) {
    drawFastBadge(ctx, game);
  } else if (game.state === 'settle' || (game.state === 'flight' && game.stateTime > 0.6)) hint = 'Tocca per accelerare';
  else if (game.state === 'intro') hint = 'Tocca per saltare';
  if (hint) {
    ctx.font = `600 15px ${FONT}`;
    const w = ctx.measureText(hint).width + 36;
    pillola(ctx, 16, 66, w, 32);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.9;
    ctx.fillText(hint, 34, 83);
    ctx.globalAlpha = 1;
  }
}

/** Indicatore "▶▶" della simulazione accelerata (al posto del suggerimento), con due triangoli che pulsano. */
function drawFastBadge(ctx, game) {
  pillola(ctx, 16, 66, 70, 32);
  const t = game.time || 0;
  for (let i = 0; i < 2; i++) {
    const x = 36 + i * 15;
    ctx.globalAlpha = 0.55 + 0.45 * Math.max(0, Math.sin(t * 9 - i * 1.2));
    ctx.fillStyle = C.oro;
    ctx.beginPath();
    ctx.moveTo(x, 74);
    ctx.lineTo(x + 13, 82);
    ctx.lineTo(x, 90);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Pacco sopra il bordo della vista: freccia del suo colore sul bordo superiore. */
export function drawOffscreenArrow(ctx, game) {
  if (!game.current) return;
  const p = game.current.getPosition();
  const cam = game.camera;
  if (p.y <= cam.bottom + cam.viewH - 0.3) return;
  const x = X(p.x);
  ctx.fillStyle = C.pacchi[game.current.getUserData().type]?.[0] || GIFTS[game.current.getUserData().type].color;
  ctx.strokeStyle = C.contorno;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, 6);
  ctx.lineTo(x - 13, 26);
  ctx.lineTo(x + 13, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Nome del livello al centro mentre la camera mostra le case (dissolvenza in entrata e uscita). */
export function drawIntroTitle(ctx, game) {
  const t = game.intro.t;
  const a = Math.min(1, t / 0.3) * Math.min(1, Math.max(0, (1.9 - t) / 0.6)); // sparisce mentre la camera si allarga
  if (a <= 0) return;
  const [title, sub] = game.level.name.split(' · ');
  testo(ctx, title, VIEW_W / 2, VIEW_H * 0.3, 56, { col: '#fff', bordo: 'rgba(12,14,52,0.75)', alfa: a });
  if (sub) testo(ctx, sub, VIEW_W / 2, VIEW_H * 0.3 + 50, 24, { col: 'rgba(255,255,255,0.85)', peso: 500, bordo: false, alfa: a });
}

/** Generatore pseudo-casuale fisso per le decorazioni del pannello (stesse posizioni a ogni frame). */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Scintilla a quattro punte (stella "brillio"). */
function scintilla(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
}

/**
 * Decorazioni leggere della schermata finale (tempo reale t, s dall'apertura): neve che scende su tutto
 * lo schermo, stelle cadenti in alto, scintille attorno al titolo, lucine colorate sul bordo del pannello.
 * Nessuna allocazione per frame, una manciata di riempimenti.
 */
function decorazioni(c, t, x, y, w) {
  // neve: 46 fiocchi, cadono lenti e ondeggiano; ricompaiono in alto
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.beginPath();
  for (let i = 0; i < 46; i++) {
    const r = 1.4 + hash(i) * 2.6;
    const v = 22 + hash(i + 50) * 36;
    const fy = ((hash(i + 100) * VIEW_H + t * v) % (VIEW_H + 20)) - 10;
    const fx = hash(i + 150) * VIEW_W + Math.sin(t * 0.9 + i) * 14;
    c.moveTo(fx + r, fy);
    c.arc(fx, fy, r, 0, TAU);
  }
  c.fill();
  // stelle cadenti: tre, a turno, attraversano il cielo in diagonale con una scia
  for (let i = 0; i < 3; i++) {
    const per = 3.4 + i * 1.1;
    const k = ((t + i * 1.7) % per) / 1.1; // 0..1 durante il passaggio, poi pausa
    if (k > 1) continue;
    const sx = 140 + hash(i + 200) * 900 + k * 260;
    const sy = 20 + hash(i + 210) * 90 + k * 110;
    const a = Math.sin(k * Math.PI);
    const g = c.createLinearGradient(sx - 90, sy - 38, sx, sy);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(1, `rgba(255,240,200,${0.85 * a})`);
    c.strokeStyle = g;
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx - 90, sy - 38);
    c.lineTo(sx, sy);
    c.stroke();
    c.globalAlpha = a;
    c.fillStyle = '#fff6d8';
    scintilla(c, sx, sy, 6);
    c.globalAlpha = 1;
  }
  // scintille attorno al titolo
  c.fillStyle = C.oro;
  for (let i = 0; i < 8; i++) {
    const a = Math.max(0, Math.sin(t * 2.2 + i * 2.1));
    if (a < 0.05) continue;
    const lato = i % 2 ? 1 : -1;
    const sx = VIEW_W / 2 + lato * (150 + hash(i + 300) * 90);
    const sy = y + 22 + hash(i + 310) * 46;
    c.globalAlpha = a;
    scintilla(c, sx, sy, 4 + a * 5);
  }
  c.globalAlpha = 1;
  // lucine sul bordo superiore del pannello, a festone
  const col = ['#ff6f61', '#ffd36b', '#5fe0b8', '#8fc8ff'];
  for (let i = 0; i < 15; i++) {
    const u = (i + 0.5) / 15;
    const lx = x + 30 + u * (w - 60);
    const ly = y + 2 + Math.sin(u * Math.PI * 3) * 5;
    const on = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.9);
    c.globalAlpha = 0.35 * on;
    c.fillStyle = col[i % 4];
    c.beginPath();
    c.arc(lx, ly, 8, 0, TAU);
    c.fill();
    c.globalAlpha = 0.6 + 0.4 * on;
    c.beginPath();
    c.arc(lx, ly, 3.6, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

/** Istante (tempo reale del gioco) in cui è comparso il riepilogo: per l'animazione d'entrata. */
const apertura = new WeakMap();

/**
 * Schermata finale "Buone Feste!": titolo festoso, esito, stelle, punteggio, dettaglio, pulsanti
 * (le loro posizioni vengono dal gioco, turn.js), decorazioni leggere. Nessun messaggio personalizzato.
 */
export function drawSummary(ctx, game) {
  const s = game.summary;
  const now = game.time || 0;
  if (!apertura.has(s)) apertura.set(s, now);
  const t = now - apertura.get(s);
  const w = 560;
  const x = (VIEW_W - w) / 2;
  const y = 66;
  const h = 450;
  ctx.save();
  ctx.fillStyle = `rgba(5,8,26,${0.6 * Math.min(1, t / 0.4)})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // entrata: il pannello sale e si ingrandisce un poco (0.35 s, rimbalzo leggero)
  const k = Math.min(1, t / 0.35);
  const pop = 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.04;
  ctx.globalAlpha = k;
  ctx.translate(VIEW_W / 2, y + h / 2 + (1 - k) * 30);
  ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);
  ctx.translate(-VIEW_W / 2, -(y + h / 2));
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a2f7a');
  g.addColorStop(1, '#141a4a');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,107,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // neve sul bordo superiore del pannello
  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 4);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    ctx.quadraticCurveTo(x + 20 + (u - 0.05) * (w - 40), y - 9 - hash(i + 400) * 6, x + 20 + u * (w - 40), y + 1);
  }
  ctx.lineTo(x + w - 20, y + 6);
  ctx.quadraticCurveTo(x + w / 2, y + 12, x + 20, y + 6);
  ctx.closePath();
  ctx.fill();

  testo(ctx, 'Buone Feste!', VIEW_W / 2, y + 54, 50, { col: C.oro, bordo: '#5a1e12', peso: 800 });
  testo(ctx, s.allServed ? 'Tutte le case servite!' : `Case servite: ${s.served} su ${s.houses}`, VIEW_W / 2, y + 98, 20, { col: 'rgba(255,255,255,0.9)', bordo: false, peso: 600 });
  for (let i = 0; i < 3; i++) {
    const sx = VIEW_W / 2 + (i - 1) * 66;
    const sy = y + 146;
    const on = i < s.stars;
    // le stelle guadagnate si accendono una dopo l'altra
    const ki = on ? Math.min(1, Math.max(0, (t - 0.35 - i * 0.25) / 0.25)) : 1;
    if (on && ki > 0) {
      const al = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
      al.addColorStop(0, `rgba(255,211,107,${0.45 * ki})`);
      al.addColorStop(1, 'rgba(255,211,107,0)');
      ctx.fillStyle = al;
      ctx.fillRect(sx - 44, sy - 44, 88, 88);
    }
    const r = on ? 24 + 3 * ki + Math.sin(ki * Math.PI) * 6 : 24;
    stella5(ctx, sx, sy, r);
    ctx.fillStyle = on && ki > 0 ? C.oro : 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (on && ki > 0) {
      ctx.strokeStyle = C.oro2;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  testo(ctx, s.score.toLocaleString('it-IT'), VIEW_W / 2, y + 206, 44);
  const lines = [
    `Consegne: ${s.delivered} su ${s.thrown} lanci  ·  ${s.deliveryScore}`,
    s.crystals ? `Neve e cristalli: ${s.ice} + ${s.crystals}  ·  ${s.iceScore + s.crystalScore}` : `Neve rotta: ${s.ice}  ·  ${s.iceScore}`,
  ];
  if (s.bonus) lines.push(`Tutte le case servite  ·  +${s.bonus}`);
  if (s.penalty) lines.push(`Renne spaventate: ${s.reindeerHits}  ·  −${s.penalty}`);
  lines.forEach((l, i) => testo(ctx, l, VIEW_W / 2, y + 246 + i * 23, 15, { col: 'rgba(255,255,255,0.84)', peso: 500, bordo: false }));
  for (const b of game.buttons) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fillStyle = b.secondary ? '#2f3a86' : '#ff6f61';
    ctx.fill();
    testo(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 21, { col: '#fff', bordo: false, peso: 600 });
  }
  ctx.restore();
  ctx.save();
  decorazioni(ctx, t, x, y, w);
  ctx.restore();
}

/** Anteprima della traiettoria: puntini color crema che rimpiccioliscono e sbiadiscono (4 riempimenti in tutto). */
export function drawTrajectory(ctx, t, ppm) {
  const n = t.length / 2;
  if (!n) return;
  ctx.fillStyle = C.traiettoria;
  const r0 = Math.max(1.8, ppm * 0.085);
  for (let f = 0; f < 4; f++) {
    ctx.beginPath();
    for (let i = Math.floor((n * f) / 4); i < Math.floor((n * (f + 1)) / 4); i++) {
      const r = r0 * (1 - (i / n) * 0.45);
      const x = X(t[i * 2]);
      const y = Y(t[i * 2 + 1]);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.globalAlpha = 0.95 - f * 0.2;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
