/**
 * Particelle non fisiche (schegge di ghiaccio, scintille): pool a dimensione fissa,
 * nessuna collisione, solo gravità leggera e dissolvenza.
 */
export class Particles {
  constructor(max = 220) {
    this.max = max;
    this.list = [];
  }

  /**
   * @param {object} [o] opzioni: size [min,max] (m), life [min,max] (s), gravity, drag, spread (m)
   */
  burst(x, y, n, speed = 3, color = '#e6f6ff', o = {}) {
    const size = o.size || [0.04, 0.11];
    const lifeR = o.life || [0.4, 0.9];
    const spread = o.spread ?? 0.4;
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
      l[j++] = p;
    }
    l.length = j;
  }

  /** Da chiamare con la trasformazione della camera già applicata. */
  draw(ctx) {
    for (const p of this.list) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.4);
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
