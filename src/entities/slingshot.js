import { SLING } from '../config.js';

/**
 * Fionda: carico, presa, tensione (clampata) e velocità di lancio.
 * La potenza è proporzionale alla tensione, la direzione è opposta al trascinamento.
 */
export class Slingshot {
  constructor(x, y) {
    this.x = x; // punto di riposo dell'elastico (sacca)
    this.y = y;
    /** Pacco caricato ({id, type}) o null. */
    this.loaded = null;
    this.aiming = false;
    this.pullX = 0; // vettore tensione, m
    this.pullY = 0;
    /** Animazione di caricamento: posizione di partenza e avanzamento 0..1. */
    this.loadAnim = null;
  }

  load(gift, fromX, fromY) {
    this.loaded = gift;
    this.pullX = this.pullY = 0;
    this.loadAnim = { x: fromX, y: fromY, t: 0 };
  }

  /** Carica senza animazione (gesto che prosegue direttamente in mira). */
  arm(gift) {
    this.loaded = gift;
    this.loadAnim = null;
    this.pullX = this.pullY = 0;
  }

  unload() {
    const g = this.loaded;
    this.loaded = null;
    this.aiming = false;
    this.loadAnim = null;
    return g;
  }

  /** Distanza dal punto di carico (sacca a riposo). */
  distance(wx, wy) {
    return Math.hypot(wx - this.x, wy - this.y);
  }

  tryGrab(wx, wy) {
    if (!this.loaded || this.distance(wx, wy) > SLING.grabRadius) return false;
    this.aiming = true;
    this.loadAnim = null;
    this.drag(wx, wy);
    return true;
  }

  /**
   * Il dito in (wx, wy). `reach` = metri di dito per la tensione massima (corsa lunga, vedi SLING.strokePx):
   * la frazione di corsa passa per la risposta dolce e diventa la tensione disegnata (≤ maxPull).
   */
  drag(wx, wy, reach = this.reach || SLING.maxPull) {
    const dx = wx - this.x;
    const dy = wy - this.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      this.pullX = this.pullY = 0;
      return;
    }
    const t = Math.min(1, len / reach);
    const k = SLING.soft;
    const pull = SLING.maxPull * (t * (1 - k) + k * (1 - (1 - t) ** 2));
    this.pullX = (dx / len) * pull;
    this.pullY = (dy / len) * pull;
  }

  update(dt) {
    if (this.loadAnim && (this.loadAnim.t += dt / 0.22) >= 1) this.loadAnim = null;
  }

  /** Posizione del pacco caricato (animazione di caricamento inclusa). */
  get loadX() {
    const a = this.loadAnim;
    return a ? a.x + (this.x - a.x) * ease(a.t) : this.x + this.pullX;
  }
  get loadY() {
    const a = this.loadAnim;
    // piccolo arco durante il caricamento
    return a ? a.y + (this.y - a.y) * ease(a.t) + Math.sin(a.t * Math.PI) * 0.6 : this.y + this.pullY;
  }

  /** Tensione normalizzata 0..1. */
  get tension() { return Math.hypot(this.pullX, this.pullY) / SLING.maxPull; }

  get velocity() {
    return { vx: -this.pullX * SLING.power, vy: -this.pullY * SLING.power };
  }

  /** Rilascio: restituisce il colpo, oppure null se la tensione è troppo bassa (il pacco resta caricato). */
  release() {
    this.aiming = false;
    if (this.tension < SLING.minTension) {
      this.pullX = this.pullY = 0;
      return null;
    }
    const shot = { gift: this.loaded, x: this.loadX, y: this.loadY, ...this.velocity };
    this.loaded = null;
    this.pullX = this.pullY = 0;
    return shot;
  }
}

const ease = (t) => 1 - (1 - Math.min(t, 1)) ** 3;
