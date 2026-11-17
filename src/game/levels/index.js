import ilVillaggio from './il-villaggio.json';
import provaCarte from './prova-carte.json';

/**
 * Elenco dei livelli selezionabili, nell'ordine in cui compaiono nel selettore.
 * Per ora un solo livello (decisione dell'utente, 18/11): i vecchi JSON restano nella cartella come riferimento.
 */
export const LEVELS = [ilVillaggio, provaCarte];

export function findLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
