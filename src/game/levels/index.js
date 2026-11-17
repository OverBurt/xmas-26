import villaggioAlbero from './villaggio-albero.json';
import villaggioFortini from './villaggio-fortini.json';
import laCollina from './la-collina.json';

/** Elenco dei livelli selezionabili, nell'ordine in cui compaiono nel selettore. */
export const LEVELS = [villaggioAlbero, villaggioFortini, laCollina];

export function findLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
