/**
 * Generatore casuale con seme (mulberry32): tutto ciò che influisce sulla partita
 * (fratture, merli, cristalli dell'albero...) lo usa al posto di Math.random,
 * così le simulazioni di misura (tools/sim) sono riproducibili fissando il seme.
 * Nel gioco il seme cambia a ogni avvio.
 */
let state = (Math.random() * 2 ** 32) >>> 0;

export function setSeed(seed) {
  state = seed >>> 0;
}

export function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
