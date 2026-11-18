import { VIEW_W, VIEW_H, GFX, GIFTS, SCORE } from '../config.js';
import { WALL } from '../entities/house.js';
import { centroid } from '../physics/polygon.js';
import { X, Y, TAU, stella5 } from './view.js';
import { drawGiftIcon } from './propsDraw.js';

const C = GFX.colors;
const FONT = GFX.font;
const ZONE_LABEL_OFFSET = 0.9;

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
/**
 * Etichetta dei punti di un'apertura: pillola scura con l'icona. Dorata se vale il massimo;
 * dopo una consegna il valore cala: l'etichetta si spegne e mostra una freccina in giù.
 */
function etichetta(c, tipo, punti, x, y, top, calata) {
  c.font = `600 14px ${FONT}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const txt = String(punti);
  const w = c.measureText(txt).width + 36 + (calata ? 12 : 0);
  c.fillStyle = C.hud;
  c.beginPath();
  c.roundRect(x - w / 2, y - 11, w, 22, 11);
  c.fill();
  c.strokeStyle = top ? C.oro : C.hudBordo;
  c.lineWidth = top ? 1.6 : 1;
  c.stroke();
  const col = top ? C.oro : calata ? '#c9d1f5' : '#fff';
  icona(c, tipo, x - w / 2 + 14, y, col);
  c.fillStyle = col;
  c.fillText(txt, x - w / 2 + 26, y + 1);
  if (calata) {
    c.beginPath();
    c.moveTo(x + w / 2 - 17, y - 3);
    c.lineTo(x + w / 2 - 9, y - 3);
    c.lineTo(x + w / 2 - 13, y + 4);
    c.fill();
  }
}

/** Valori delle aperture e punti fluttuanti, in coordinate schermo (testo sempre nitido). Vista = camera. */
export function drawWorldLabels(ctx, game) {
  for (const h of game.houses) {
    for (const z of h.zones) {
      const top = z.points >= SCORE.maxPoints && !z.count;
      if (z.type === 'chimney') etichetta(ctx, z.type, z.points, X(h.chimney.top.x + 0.9), Y(h.chimney.top.y + 0.75), top, z.count > 0);
      else {
        const c = centroid(z.poly);
        etichetta(ctx, z.type, z.points, X(c.x - WALL - ZONE_LABEL_OFFSET - 0.35), Y(c.y), top, z.count > 0);
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
  } else if (game.state === 'settle') hint = 'Tocca per continuare';
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

/** Pannello di fine livello: esito, stelle, punteggio, dettaglio, pulsanti (le loro posizioni vengono dal gioco). */
export function drawSummary(ctx, game) {
  const s = game.summary;
  const w = 540;
  const x = (VIEW_W - w) / 2;
  const y = 92;
  const h = 410;
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,26,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#222a6b');
  g.addColorStop(1, '#141a4a');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,107,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  testo(ctx, s.allServed ? 'Tutte le case servite!' : `Case servite: ${s.served} su ${s.houses}`, VIEW_W / 2, y + 40, 27, { col: '#fff', bordo: false });
  for (let i = 0; i < 3; i++) {
    const sx = VIEW_W / 2 + (i - 1) * 66;
    const sy = y + 100;
    const on = i < s.stars;
    if (on) {
      const al = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
      al.addColorStop(0, 'rgba(255,211,107,0.45)');
      al.addColorStop(1, 'rgba(255,211,107,0)');
      ctx.fillStyle = al;
      ctx.fillRect(sx - 44, sy - 44, 88, 88);
    }
    stella5(ctx, sx, sy, on ? 27 : 24);
    ctx.fillStyle = on ? C.oro : 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (on) {
      ctx.strokeStyle = C.oro2;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  testo(ctx, s.score.toLocaleString('it-IT'), VIEW_W / 2, y + 166, 46);
  const lines = [
    `Consegne: ${s.delivered} su ${s.thrown} lanci  ·  ${s.deliveryScore}`,
    s.crystals ? `Neve e cristalli: ${s.ice} + ${s.crystals}  ·  ${s.iceScore + s.crystalScore}` : `Neve rotta: ${s.ice}  ·  ${s.iceScore}`,
  ];
  if (s.bonus) lines.push(`Tutte le case servite  ·  +${s.bonus}`);
  if (s.penalty) lines.push(`Renne spaventate: ${s.reindeerHits}  ·  −${s.penalty}`);
  lines.forEach((l, i) => testo(ctx, l, VIEW_W / 2, y + 212 + i * 25, 16, { col: 'rgba(255,255,255,0.84)', peso: 500, bordo: false }));
  for (const b of game.buttons) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fillStyle = b.secondary ? '#2f3a86' : '#ff6f61';
    ctx.fill();
    testo(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 21, { col: '#fff', bordo: false, peso: 600 });
  }
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
