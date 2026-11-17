import { VIEW_W, VIEW_H, CAMERA } from '../config.js';

/**
 * Camera 2D laterale.
 * - Il bordo inferiore resta fisso poco sotto il terreno: zoomando fuori la vista cresce verso l'alto.
 * - `viewW` è la larghezza del mondo visibile (m): più grande = più zoom-out.
 * - Movimento morbido verso un target (esponenziale, indipendente dal framerate),
 *   inseguimento di un corpo (`follow`) e pan manuale.
 */
export class Camera {
  constructor(bounds) {
    this.minX = bounds.minX;
    this.maxX = bounds.maxX;
    this.bottom = CAMERA.bottom;
    this.cx = 0; // centro orizzontale attuale
    this.viewW = 24;
    this.tcx = 0; // target
    this.tViewW = 24;
    this.speed = CAMERA.speed;
    /** Funzione che restituisce {x, y, vx, vy} da inseguire, oppure null. */
    this.follow = null;
    /** Zoom minimo durante l'inseguimento: si allarga se il bersaglio sale troppo. */
    this.followViewW = 30;
  }

  get ppm() { return VIEW_W / this.viewW; }
  get viewH() { return VIEW_H / this.ppm; }
  /** Bordo sinistro visibile (m). */
  get x() { return this.cx - this.viewW / 2; }

  setTarget(cx, viewW = this.tViewW, speed = CAMERA.speed) {
    this.tcx = cx;
    this.tViewW = viewW;
    this.speed = speed;
  }

  snap() {
    this.cx = this.tcx;
    this.viewW = this.tViewW;
    this.clamp();
  }

  /** Pan manuale: sposta subito camera e target. */
  pan(dxWorld) {
    this.follow = null;
    this.cx += dxWorld;
    this.clamp();
    this.tcx = this.cx;
  }

  update(dt) {
    if (this.follow) {
      const f = this.follow();
      if (f) {
        this.tcx = f.x + f.vx * CAMERA.lookAhead;
        // Zoom-out per tenere il bersaglio in vista anche nei pallonetti alti.
        const needH = f.y + Math.max(0, f.vy) * 0.4 + CAMERA.followMarginTop - this.bottom;
        this.tViewW = Math.max(this.followViewW, (needH * VIEW_W) / VIEW_H);
      }
    }
    const k = 1 - Math.exp(-dt * this.speed);
    this.viewW += (this.tViewW - this.viewW) * k;
    this.cx += (this.tcx - this.cx) * k;
    this.clamp();
  }

  clamp() {
    const span = this.maxX - this.minX;
    if (this.viewW > span) this.viewW = span;
    const half = this.viewW / 2;
    this.cx = Math.min(Math.max(this.cx, this.minX + half), this.maxX - half);
  }

  /** Applica la trasformazione mondo→schermo (contesto già in coordinate logiche). */
  apply(ctx) {
    const s = this.ppm;
    ctx.translate(-this.x * s, VIEW_H + this.bottom * s);
    ctx.scale(s, -s);
  }

  screenToWorld(sx, sy) {
    const s = this.ppm;
    return { x: sx / s + this.x, y: (VIEW_H - sy) / s + this.bottom };
  }
}
