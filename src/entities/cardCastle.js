import { Settings } from 'planck';
import { GROUND_Y } from '../config.js';
import { createIceBody } from '../physics/fracture.js';
import { rect } from '../physics/polygon.js';
import { ICE } from '../config.js';
import { centroid } from '../physics/polygon.js';

const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

/**
 * "Castello di carte" (prova): piani di tende ad A di lastre di ghiaccio appoggiate l'una all'altra,
 * separati da blocchi di neve orizzontali che poggiano sulle punte delle tende; ogni piano ha una tenda in meno.
 * Definizione (JSON, `cardCastles`): { x (centro), levels (tende del piano terra), half (mezza base della tenda),
 *   h (altezza della tenda), pitch (distanza tra le tende, default 2·half + 0.05), floorH (spessore della neve),
 *   overhang (sporgenza del blocco oltre le punte), topW (larghezza del blocco in cima),
 *   cap (larghezza della cima piatta di ogni lastra: il blocco sopra poggia di piatto, non su uno spigolo) }
 * @returns {{ bodies, x0, x1, top }}
 */
export function buildCardCastle(pw, def) {
  const { x, levels = 3, half = 0.7, h = 1.6, floorH = 0.26, overhang = 0.45, topW = 1.8 } = def;
  const pitch = def.pitch ?? 2 * half + 0.05;
  const bodies = [];
  let y = GROUND_Y + (def.y || 0);
  for (let k = 0; k < levels; k++) {
    const n = levels - k;
    const c0 = x - ((n - 1) * pitch) / 2;
    for (let i = 0; i < n; i++) bodies.push(...cardTent(pw, c0 + i * pitch, y, half, h, def.cap ?? 0.12));
    // punta delle tende: tent() appoggia la base a y + GAP e arriva a h sopra
    const apex = y + GAP + h;
    // blocco di neve orizzontale che poggia sulle punte (in cima un blocco solo, largo topW)
    const w = n > 1 ? (n - 1) * pitch + 2 * overhang : topW;
    const yb = apex + GAP;
    bodies.push(createIceBody(pw, rect(w / 2, floorH / 2), x, yb + floorH / 2, 0, 0, false, 'snow'));
    y = yb + floorH;
  }
  const w0 = (levels - 1) * pitch + 2 * half;
  return { bodies, x0: x - w0 / 2, x1: x + w0 / 2, top: y };
}

/**
 * Tenda ad A di due lastre di ghiaccio: base piatta, faccia verticale di contatto in cima e una piccola
 * cima piatta larga `cap` (senza, un blocco appoggiato su una sola tenda starebbe in equilibrio su uno spigolo).
 */
function cardTent(pw, cx, y, half, h, cap) {
  const t = ICE.thickness * 1.25; // spessore orizzontale della lastra
  const d = t * (h / half); // altezza della faccia di contatto
  const g = GAP / 2;
  const yb = y + GAP;
  const left = [
    { x: cx - half, y: yb },
    { x: cx - half + t, y: yb },
    { x: cx - g, y: yb + h - d },
    { x: cx - g, y: yb + h },
    { x: cx - g - cap, y: yb + h },
  ];
  const right = left.map((p) => ({ x: 2 * cx - p.x, y: p.y })).reverse();
  return [left, right].map((w) => {
    const c = centroid(w);
    return createIceBody(pw, w.map((p) => ({ x: p.x - c.x, y: p.y - c.y })), c.x, c.y, 0, 0, false, 'ice');
  });
}
