import { GFX } from '../config.js';

const ORDINE = ['bassa', 'media', 'alta'];

/**
 * Livello di qualità grafica. Parte da "alta" e scende da solo se i frame sono lenti
 * (mai durante il volo di un pacco); `?qualita=alta|media|bassa` lo fissa.
 * `versione` cambia a ogni passaggio: chi tiene sprite in cache li ricostruisce.
 */
export const quality = {
  nome: 'alta',
  tier: GFX.tiers.alta,
  auto: true,
  versione: 0,
  tempo: 0, // secondi trascorsi dall'avvio (o dall'ultimo cambio)
  somma: 0,
  frame: 0,
};

export function initQuality(params) {
  const q = params.get('qualita');
  if (q && GFX.tiers[q]) {
    quality.nome = q;
    quality.tier = GFX.tiers[q];
    quality.auto = false;
  }
}

/**
 * Da chiamare a ogni frame con il tempo trascorso dal frame precedente (s).
 * `fermo` = momento tranquillo in cui si può cambiare livello. Restituisce true se il livello è cambiato.
 */
export function sampleQuality(elapsed, fermo) {
  if (!quality.auto || quality.nome === 'bassa') return false;
  quality.tempo += elapsed;
  if (quality.tempo < GFX.auto.warmup) return false;
  quality.somma += elapsed;
  quality.frame++;
  if (quality.somma < GFX.auto.window) return false;
  const medio = (quality.somma / quality.frame) * 1000;
  quality.somma = 0;
  quality.frame = 0;
  if (medio <= GFX.auto.slowMs || !fermo) return false;
  quality.nome = ORDINE[ORDINE.indexOf(quality.nome) - 1];
  quality.tier = GFX.tiers[quality.nome];
  quality.versione++;
  quality.tempo = 0;
  return true;
}
