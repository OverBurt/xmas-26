import { GFX } from '../config.js';
import { X, Y, S, V, TAU, liscia, makeSprite, blit } from './view.js';

const C = GFX.colors;

/** Sasso tondo mezzo sepolto: sporge al massimo ~8 cm dalla superficie, col suo berretto di neve. */
function sasso(c, x, y, r) {
  c.beginPath();
  c.ellipse(X(x), Y(y), S(r * 1.35), S(r * 0.8), 0, 0, TAU);
  const g = c.createLinearGradient(0, Y(y + r), 0, Y(y - r));
  g.addColorStop(0, C.pietra);
  g.addColorStop(1, C.pietra2);
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = C.contorno;
  c.lineWidth = Math.max(1, S(0.03));
  c.stroke();
  c.fillStyle = C.neve;
  c.beginPath();
  c.ellipse(X(x), Y(y + r * 0.38), S(r * 1.12), S(r * 0.5), 0, Math.PI, 0);
  c.quadraticCurveTo(X(x), Y(y + r * 0.2), X(x - r * 1.12), Y(y + r * 0.38));
  c.fill();
}

/**
 * Collina (trapezio fisico): pendii a S entro ~8 cm dal trapezio, spalle tonde, cima appena ondulata,
 * tre strati sinuosi all'interno. `sassi` = [[x, y, r]] con y > 0 (dentro il fianco).
 */
function collina(c, hill, sassi) {
  const [p0, p1, p2, p3] = hill.poly; // base sx, base dx, cima dx, cima sx
  const a = p3.x, b = p2.x, h = p3.y - p0.y, g0 = p0.y, sl = a - p0.x, sr = p1.x - b;
  const cima = (x) => g0 + h - 0.035 + 0.035 * Math.sin(x * 0.9 + 1);
  const sinistra = () => {
    c.moveTo(X(a - sl), Y(g0));
    c.bezierCurveTo(X(a - sl * 0.66), Y(g0 + h * 0.27), X(a - sl * 0.33), Y(g0 + h * 0.73), X(a - sl * 0.09), Y(g0 + h * 0.92));
    c.quadraticCurveTo(X(a + 0.05), Y(g0 + h + 0.01), X(a + 0.5), Y(cima(a + 0.5)));
    liscia(c, cima, a + 0.5, b - 0.5);
  };
  const sagoma = () => {
    c.beginPath();
    sinistra();
    c.quadraticCurveTo(X(b - 0.05), Y(g0 + h + 0.01), X(b + sr * 0.09), Y(g0 + h * 0.92));
    c.bezierCurveTo(X(b + sr * 0.33), Y(g0 + h * 0.73), X(b + sr * 0.66), Y(g0 + h * 0.27), X(b + sr), Y(g0));
    c.closePath();
  };
  const g = c.createLinearGradient(0, Y(g0 + h), 0, Y(g0));
  g.addColorStop(0, C.neve);
  g.addColorStop(1, '#c9d5f6');
  sagoma();
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  const om = c.createLinearGradient(X(a - sl), 0, X(a + 2.2), 0);
  om.addColorStop(0, 'rgba(127,155,224,0.34)');
  om.addColorStop(1, 'rgba(127,155,224,0)');
  c.fillStyle = om;
  c.fillRect(X(a - sl), Y(g0 + h + 0.2), S(sl + 2.2), S(h + 0.2)); // pendio in ombra, sfumato
  for (const [yy, k, amp] of [[0.72, 1.0, 0.08], [0.43, 3.1, 0.067], [0.18, 5.0, 0.057]]) { // strati: fasce tonali con un filo di luce sopra
    const f = (x) => g0 + h * (yy + amp * Math.sin(x * 0.33 + k) + amp * 0.35 * Math.sin(x * 0.81 + k * 1.7));
    c.beginPath();
    liscia(c, f, a - sl, b + sr, true);
    c.lineTo(X(b + sr), Y(g0 - 0.2));
    c.lineTo(X(a - sl), Y(g0 - 0.2));
    c.closePath();
    c.fillStyle = 'rgba(127,155,224,0.13)';
    c.fill();
    c.beginPath();
    liscia(c, (x) => f(x) + 0.03, a - sl, b + sr, true);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = Math.max(1.2, S(0.04));
    c.stroke();
  }
  for (const [sx, sy, r] of sassi) if (sy > g0 && sx > p0.x && sx < p1.x) sasso(c, sx, sy, r);
  c.restore();
  c.beginPath();
  sinistra();
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(1.5, S(0.06));
  c.lineJoin = 'round';
  c.stroke();
}

/** Sprite in cache delle colline del livello (non cambiano mai). */
export function buildHills(hills, sassi, ppm) {
  return hills.map((hl) => {
    const xs = hl.poly.map((p) => p.x);
    const ys = hl.poly.map((p) => p.y);
    return makeSprite(Math.min(...xs) - 0.2, Math.min(...ys) - 0.05, Math.max(...xs) + 0.2, Math.max(...ys) + 0.2, Math.min(ppm, 64), (c) => collina(c, hl, sassi));
  });
}
export function drawHills(ctx, sprites) {
  for (const sp of sprites) blit(ctx, sp);
}

/**
 * Terreno, disegnato a ogni frame solo nel tratto in vista. La linea d'appoggio fisica resta dritta:
 * sono sinuosi il bordo della neve (pochi centimetri sopra la linea) e le due falde sotto la superficie.
 */
export function drawGround(ctx, x0, x1, sassi) {
  const yb = V.h + 2;
  const g = ctx.createLinearGradient(0, Y(0), 0, yb);
  g.addColorStop(0, '#f4f7ff');
  g.addColorStop(1, '#b6c6f0');
  ctx.fillStyle = g;
  ctx.fillRect(X(x0), Y(0), S(x1 - x0), yb - Y(0));
  // fasce di neve più in basso: onde lunghe e larghe, a più frequenze (GFX.terreno)
  const T = GFX.terreno;
  for (const [d, k, col] of [[-0.14, 0.0, 'rgba(127,155,224,0.22)'], [-0.3, 2.6, 'rgba(127,155,224,0.3)'], [-0.46, 4.1, 'rgba(110,138,214,0.34)']]) {
    const f = (x) => d + T.fascia * (Math.sin(x * 0.45 + k) + 0.45 * Math.sin(x * 1.05 + k * 2.3) + 0.2 * Math.sin(x * 2.2 + k));
    ctx.beginPath();
    liscia(ctx, f, x0, x1, true);
    ctx.lineTo(X(x1), yb);
    ctx.lineTo(X(x0), yb);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }
  // bordo della neve: cumuli morbidi sopra la linea d'appoggio (i piedi degli oggetti affondano appena nella neve)
  const orlo = (x) => T.orlo * (0.6 + 0.55 * Math.sin(x * 0.62 + 0.6) + 0.3 * Math.sin(x * 1.37 + 2) + 0.1 * Math.sin(x * 2.9 + 1.1));
  ctx.beginPath();
  liscia(ctx, orlo, x0, x1, true);
  ctx.lineTo(X(x1), Y(-0.08));
  ctx.lineTo(X(x0), Y(-0.08));
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // ombra azzurra appena sotto la cresta dei cumuli: dà volume alle onde
  ctx.beginPath();
  liscia(ctx, (x) => orlo(x) - 0.045 - 0.02 * Math.sin(x * 0.53 + 1.4), x0, x1, true);
  ctx.strokeStyle = 'rgba(150,172,232,0.45)';
  ctx.lineWidth = Math.max(1, S(0.035));
  ctx.stroke();
  for (const [sx, sy, r] of sassi) if (sy <= 0 && sx > x0 - 1 && sx < x1 + 1) sasso(ctx, sx, sy, r);
}
