import { Settings } from 'planck';
import { ICE, GROUND_Y } from '../config.js';
import { createIceBody } from '../physics/fracture.js';
import { rect } from '../physics/polygon.js';

/**
 * Distanza a riposo tra due poligoni in Box2D/Planck: ogni poligono ha una "pelle"
 * (polygonRadius) e il solver li lascia separati di 2·radius − linearSlop.
 * Creando le lastre già a questa distanza la pila nasce in equilibrio e non "salta".
 */
const GAP = 2 * Settings.polygonRadius - Settings.linearSlop;

function createSlab(pw, cx, cy, hw, hh, angle = 0) {
  // Le pile nascono addormentate: niente jitter all'avvio, si svegliano al primo urto.
  return createIceBody(pw, rect(hw, hh), cx, cy, angle, 0, false);
}

/**
 * "Castello di carte" a piramide: ogni piano ha `bays` campate (colonne verticali)
 * coperte da un'unica lastra orizzontale; ogni piano superiore ha una campata in meno.
 * @param {number} x0 centro della prima colonna in basso a sinistra
 * @param {number[]} baysPerFloor es. [3, 2, 1]
 */
export function buildIceTower(pw, x0, baysPerFloor) {
  const t = ICE.thickness;
  const h = ICE.columnHeight;
  const bay = ICE.bay;
  const slabs = [];
  let baseY = GROUND_Y;
  let left = x0;
  let prevBays = baysPerFloor[0];

  for (const bays of baysPerFloor) {
    // Un piano più stretto si centra sopra quello sottostante.
    left += ((prevBays - bays) * bay) / 2;
    prevBays = bays;
    // Colonne
    for (let i = 0; i <= bays; i++) {
      slabs.push(createSlab(pw, left + i * bay, baseY + h / 2 + GAP, t / 2, h / 2));
    }
    // Lastra orizzontale che copre tutte le colonne del piano
    const span = bays * bay + t;
    const cx = left + (bays * bay) / 2;
    const cy = baseY + h + t / 2 + 2 * GAP;
    slabs.push(createSlab(pw, cx, cy, span / 2, t / 2));

    baseY = cy + t / 2;
  }
  return slabs;
}
