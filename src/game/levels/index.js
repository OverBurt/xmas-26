import borgo from './borgo-addormentato.json';
import bosco from './bosco-di-cristallo.json';
import vetta from './vetta-del-gufo.json';

/**
 * Elenco dei livelli selezionabili, nell'ordine in cui compaiono nel selettore: tre livelli di difficoltà
 * crescente, nati dal livello di prova con il fortino stretto e la guglia (19/11). I vecchi JSON (il-villaggio,
 * prova-carte, prova-guglia e i precedenti) restano nella cartella come riferimento, fuori dal selettore.
 */
export const LEVELS = [borgo, bosco, vetta];

export function findLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
