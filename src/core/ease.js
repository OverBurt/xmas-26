// Curve di andamento (0..1 → 0..1) condivise da animazioni e regia.

/** Accelera e rallenta (ease-in-out cubica): regia d'apertura. */
export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Parte veloce e frena (ease-out cubica, t oltre 1 resta a 1): caricamento della fionda. */
export function easeOut(t) {
  return 1 - (1 - Math.min(t, 1)) ** 3;
}
