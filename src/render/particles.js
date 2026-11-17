/**
 * Particelle non fisiche (schegge di ghiaccio, scintille): pool a dimensione fissa,
 * nessuna collisione, solo gravità leggera e dissolvenza.
 */
export class Particles {
  constructor(max = 220) {
    this.max = max;
    this.list = [];
  }

  burst(x, y, n, speed = 3, color = '#e6f6ff') {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.5;
      this.list.push({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + 1.5,
        life,
        max: life,
        size: 0.04 + Math.random() * 0.07,
        color,
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
      p.vy -= 6 * dt;
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
      ctx.globalAlpha = p.life / p.max;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
