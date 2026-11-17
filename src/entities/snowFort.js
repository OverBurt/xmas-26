import { Settings } from 'planck';
import { SNOW, GROUND_Y } from '../config.js';
import { createIceBody } from '../physics/fracture.js';
import { rect } from '../physics/polygon.js';

/** Distanza a riposo tra due poligoni (vedi iceTower.js): i mattoni nascono già appoggiati. */
const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

/**
 * Fortino di neve costruito dai bambini: mattoni sfalsati (come un muro vero, molto più stabile
 * del castello di carte) e merli in cima.
 * @param {object} def { x: bordo sinistro, cols: mattoni per fila, rows, crenels: bool }
 * @returns {{ bodies, x0, x1, top }} top = quota sopra i merli (con 5 colonne il merlo centrale regge un pupazzo)
 */
export function buildSnowFort(pw, def) {
  const { w, h } = SNOW.brick;
  const { x, cols, rows, crenels = true } = def;
  const bodies = [];
  const brick = (x0, x1, y0) => {
    const bw = x1 - x0 - GAP; // piccolo spazio orizzontale tra i mattoni
    bodies.push(createIceBody(pw, rect(bw / 2, h / 2), (x0 + x1) / 2, y0 + h / 2 + GAP, 0, 0, false, 'snow'));
  };

  let y = GROUND_Y;
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < cols; c++) brick(x + c * w, x + (c + 1) * w, y);
    } else {
      // fila sfalsata: mezzo mattone ai bordi
      brick(x, x + w / 2, y);
      for (let c = 0; c < cols - 1; c++) brick(x + w / 2 + c * w, x + w / 2 + (c + 1) * w, y);
      brick(x + cols * w - w / 2, x + cols * w, y);
    }
    y += h + GAP;
  }
  if (crenels) {
    // Merli alternati (con un numero dispari di mattoni ci sono merli su entrambi gli angoli)
    for (let c = 0; c < cols; c += 2) brick(x + c * w, x + (c + 1) * w, y);
  }
  // top: quota d'appoggio in cima (sopra i merli, se ci sono)
  return { bodies, x0: x, x1: x + cols * w, top: crenels ? y + h + GAP : y };
}
