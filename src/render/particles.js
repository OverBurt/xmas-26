import { X, Y, S, TAU } from './view.js';

/**
 * Particelle non fisiche: pool a dimensione fissa, nessuna collisione, solo gravità leggera e dissolvenza.
 * Tre forme: polvere di neve (dischetti morbidi che si allargano), schegge di ghiaccio e vetro (triangoli sottili),
 * scintille a quattro punte alla consegna. Si disegnano raggruppate per forma e fascia di opacità
 * (una dozzina di riempimenti per frame, non uno per particella).
 */
export class Particles {
  constructor(max = 220) {
    this.max = max;
    this.list = [];
  }

  /**
   * @param {object} [o] opzioni: size [min,max] (m), life [min,max] (s), gravity, drag, spread (m),
   *   shape 'dust' | 'shard' | 'spark' (se manca: oro = scintille, con attrito = polvere, altrimenti schegge)
   */
  burst(x, y, n, speed = 3, color = '#e6f6ff', o = {}) {
    const size = o.size || [0.04, 0.11];
    const lifeR = o.life || [0.4, 0.9];
    const spread = o.spread ?? 0.4;
    const shape = o.shape || (color === '#ffd36b' ? 'spark' : o.drag ? 'dust' : 'shard');
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = lifeR[0] + Math.random() * (lifeR[1] - lifeR[0]);
      this.list.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + 1.5,
        life,
        max: life,
        size: size[0] + Math.random() * (size[1] - size[0]),
        color,
        shape,
        rot: a,
        spin: (Math.random() - 0.5) * 8,
        alt: i % 3 === 0, // variante di colore (bianco tra le schegge e le scintille)
        gravity: o.gravity ?? 6,
        drag: o.drag ?? 0,
      });
    }
  }

  update(dt) {
    const l = this.list;
    let j = 0;
    for (let i = 0; i < l.length; i++) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.gravity * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      l[j++] = p;
    }
    l.length = j;
  }

  /** Da chiamare con la vista impostata sulla camera (pixel logici). */
  draw(ctx) {
    if (!this.list.length) return;
    for (const [shape, alt, col] of GRUPPI) {
      for (let f = 0; f < 4; f++) {
        let any = false;
        ctx.beginPath();
        for (const p of this.list) {
          if (p.shape !== shape || p.alt !== alt) continue;
          const u = p.life / p.max; // 1 = appena nata
          if (Math.min(3, Math.floor(u * 4)) !== f) continue;
          any = true;
          const x = X(p.x);
          const y = Y(p.y);
          if (shape === 'dust') {
            const r = S(p.size) * (0.55 + 0.9 * (1 - u));
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
          } else if (shape === 'shard') {
            const l = S(p.size) * 1.5;
            ctx.moveTo(x + Math.cos(p.rot) * l, y + Math.sin(p.rot) * l);
            ctx.lineTo(x + Math.cos(p.rot + 2.4) * l * 0.4, y + Math.sin(p.rot + 2.4) * l * 0.4);
            ctx.lineTo(x + Math.cos(p.rot - 2.4) * l * 0.4, y + Math.sin(p.rot - 2.4) * l * 0.4);
            ctx.closePath();
          } else {
            const r = S(p.size) * (0.9 + 1.4 * u);
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4;
              const rr = i % 2 ? r * 0.32 : r;
              if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
              else ctx.moveTo(x + rr, y);
            }
            ctx.closePath();
          }
        }
        if (!any) continue;
        ctx.globalAlpha = shape === 'dust' ? 0.2 + f * 0.2 : 0.3 + f * 0.23;
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Gruppi di disegno: [forma, variante, colore]. */
const GRUPPI = [
  ['dust', false, '#ffffff'], ['dust', true, '#ffffff'],
  ['shard', false, '#8fe9ff'], ['shard', true, '#ffffff'],
  ['spark', false, '#ffd36b'], ['spark', true, '#ffffff'],
];
