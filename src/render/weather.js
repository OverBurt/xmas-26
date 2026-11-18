import { VIEW_W, VIEW_H } from '../config.js';
import { X, Y, TAU, seeded } from './view.js';

/** Neve che cade: pool fisso di fiocchi in coordinate schermo, con un po' di parallasse sullo scorrimento. */
const R = seeded(77);
const FIOCCHI = Array.from({ length: 160 }, () => ({ x: R() * VIEW_W, y: R() * VIEW_H, r: 0.8 + R() * R() * 2.6, v: 18 + R() * 30, f: R() * TAU }));

export function drawSnowfall(ctx, camera, t, n) {
  if (!n) return;
  const dx = camera.x * camera.ppm;
  ctx.fillStyle = '#fff';
  // tre fasce di opacità (fiocchi piccoli e lontani, medi, grandi): tre riempimenti in tutto
  for (let f = 0; f < 3; f++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s = FIOCCHI[i];
      if (Math.min(2, Math.floor((s.r - 0.8) / 0.87)) !== f) continue;
      const y = (s.y + t * s.v) % VIEW_H;
      const x = (((s.x + Math.sin(t * 0.8 + s.f) * 12 * s.r - dx * (0.3 + s.r * 0.25)) % VIEW_W) + VIEW_W) % VIEW_W;
      ctx.moveTo(x + s.r, y);
      ctx.arc(x, y, s.r, 0, TAU);
    }
    ctx.globalAlpha = 0.4 + f * 0.22;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Fumo dal camino aperto di una casa: sei sbuffi che salgono, si allargano e svaniscono. `top` = centro della bocca (m). */
export function drawSmoke(ctx, top, t, seme = 0) {
  ctx.fillStyle = 'rgba(214,220,255,0.3)';
  const k = X(1) - X(0); // pixel per metro
  for (let i = 0; i < 6; i++) {
    const u = (t * 0.16 + i / 6 + seme * 0.37) % 1;
    ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9;
    ctx.beginPath();
    ctx.arc(X(top.x - 0.1) - u * 0.8 * k + Math.sin(u * 7 + i) * 0.2 * k, Y(top.y) - (0.27 + u * 2.5) * k, (0.16 + u * 0.43) * k, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
