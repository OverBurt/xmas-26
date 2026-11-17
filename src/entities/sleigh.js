import { GIFTS } from '../config.js';

const BED_Y = 0.75; // altezza del pianale (m)
const BED_W = 3.4; // larghezza utile del pianale
const GAP = 0.08;

/**
 * Slitta con i pacchi ancora da lanciare. I pacchi qui non sono corpi fisici:
 * sono solo disposti sul pianale (righe impilate) e si possono afferrare in qualsiasi ordine.
 */
export class Sleigh {
  constructor(x, giftTypes) {
    this.x = x; // bordo sinistro
    this.bedY = BED_Y;
    this.bedW = BED_W;
    this.gifts = giftTypes.map((type, i) => ({ id: i, type }));
    this.layout();
  }

  get count() { return this.gifts.length; }

  /** Ricalcola le posizioni: righe da sinistra a destra, poi una riga sopra. */
  layout() {
    let cx = this.x + 0.3;
    let rowY = this.bedY;
    let rowH = 0;
    for (const g of this.gifts) {
      const d = GIFTS[g.type];
      if (cx + d.w > this.x + 0.3 + this.bedW) {
        cx = this.x + 0.6;
        rowY += rowH + 0.02;
        rowH = 0;
      }
      g.x = cx + d.w / 2;
      g.y = rowY + d.h / 2;
      cx += d.w + GAP;
      rowH = Math.max(rowH, d.h);
    }
  }

  /** Pacco sotto il punto (con un margine per il dito); il più in alto vince. */
  hit(wx, wy, margin = 0.25) {
    for (let i = this.gifts.length - 1; i >= 0; i--) {
      const g = this.gifts[i];
      const d = GIFTS[g.type];
      if (Math.abs(wx - g.x) <= d.w / 2 + margin && Math.abs(wy - g.y) <= d.h / 2 + margin) return g;
    }
    return null;
  }

  take(gift) {
    this.gifts = this.gifts.filter((g) => g !== gift);
    this.layout();
    return gift;
  }

  /** Rimette un pacco sulla slitta nella sua posizione originale (per id). */
  putBack(gift) {
    this.gifts.push(gift);
    this.gifts.sort((a, b) => a.id - b.id);
    this.layout();
  }
}
