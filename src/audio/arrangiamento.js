import { AUDIO } from '../config.js';
import { campana, midi } from './effetti.js';

/**
 * Musica di sottofondo: ritornello e strofa di "Jingle Bells" (J. Pierpont, 1857, pubblico dominio) con un
 * arrangiamento nostro, semplice e tutto sintetizzato. Giro: ritornello (16 battute), strofa (16), respiro (2).
 *  - melodia: triangolo + onda quadra morbida filtrata (pizzicato); al giro successivo la suonano le campanelle, un'ottava sopra;
 *  - basso "um-pa" (fondamentale sul primo tempo, quinta sul terzo) con le scalette che portano al Fa;
 *  - sonagli da slitta sugli ottavi (rumore filtrato acuto, accenti sul 2 e sul 4);
 *  - arpeggi di glockenspiel sull'accordo nelle battute in cui la melodia tiene la nota;
 *  - due battute di "respiro" (solo basso e sonagli) prima di ricominciare.
 * Tonalità Do maggiore, 4/4, tempo AUDIO.tempo.
 *
 * Questo file NON gira nel gioco: serve a registrare la musica in un file (tools/audio/registra-musica.mjs),
 * che il gioco poi si limita a riprodurre (musica.js). Due giri (melodia pizzicata, poi campanelle) = un ciclo.
 * Ogni nota è sfasata a caso di pochi millesimi (AUDIO.sfasamento) e la melodia un po' stonata (AUDIO.stonatura):
 * suona "a mano". Il risultato è fissato nella registrazione.
 * @typedef {{ctx: BaseAudioContext, mus: AudioNode, sfx: AudioNode, rumore: AudioBuffer}} Uscita
 */

const E = 76, F = 77, G = 79, C = 72, D = 74, A = 81;
// note dell'ottava sotto, usate nella strofa
const SOL = 67, LA = 69, SI = 71;
// Melodia per battuta: [nota MIDI, durata in tempi]
const A1 = [[E, 1], [E, 1], [E, 2]];
const A3 = [[E, 1], [G, 1], [C, 1.5], [D, 0.5]];
const A4 = [[E, 4]];
const B5 = [[F, 1], [F, 1], [F, 1.5], [F, 0.5]];
const B6 = [[F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5]];
const MELODIA = [
  A1, A1, A3, A4, B5, B6, [[E, 1], [D, 1], [D, 1], [E, 1]], [[D, 2], [G, 2]],
  A1, A1, A3, A4, B5, B6, [[G, 1], [G, 1], [F, 1], [D, 1]], [[C, 4]],
  // strofa
  [[SOL, 1], [E, 1], [D, 1], [C, 1]], [[SOL, 3], [SOL, 0.5], [SOL, 0.5]], [[SOL, 1], [E, 1], [D, 1], [C, 1]], [[LA, 4]],
  [[LA, 1], [F, 1], [E, 1], [D, 1]], [[SI, 4]], [[G, 1], [G, 1], [F, 1], [D, 1]], [[E, 4]],
  [[SOL, 1], [E, 1], [D, 1], [C, 1]], [[SOL, 4]], [[SOL, 1], [E, 1], [D, 1], [C, 1]], [[LA, 3], [LA, 1]],
  [[LA, 1], [F, 1], [E, 1], [D, 1]], [[G, 1], [G, 1], [G, 1], [G, 1]], [[A, 1], [G, 1], [F, 1], [D, 1]], [[C, 2], [G, 2]],
  [], [], // respiro
];
// Accordi (fondamentale MIDI del basso, ottava 2–3) e tipo
const ACCORDI = [
  48, 48, 48, 48, 53, 48, 50, 43, 48, 48, 48, 48, 53, 48, 43, 48, // ritornello
  48, 48, 48, 53, 53, 43, 43, 48, 48, 48, 48, 53, 53, 43, 43, 48, // strofa
  48, 48, // respiro
];
const MAGGIORE = [0, 4, 7];
// Battute con la nota tenuta: arpeggio di glockenspiel sui tempi 3–4
const ARPEGGI = new Set([3, 7, 11, 15, 19, 21, 23, 25, 32, 33]);
// Scalette del basso verso la battuta dopo (Do → Fa)
const SCALETTE = { 3: [48, 52, 55, 57], 11: [48, 52, 55, 57], 18: [48, 52, 55, 57], 26: [48, 52, 55, 57] };

/** Battute in un giro e giri in un ciclo della registrazione. */
export const BATTUTE = MELODIA.length;
export const GIRI = 2;

/**
 * Programma la battuta `i` del giro `giro` a partire dall'istante t0 (s) sul contesto di `m`.
 * @param {Uscita} m
 */
export function suonaBattuta(m, i, giro, t0) {
  const b = 60 / AUDIO.tempo; // durata di un tempo (s)
  const out = m.mus;
  // sfasamento casuale di ogni nota (pochi millesimi): suona "a mano", meno meccanica
  const j = () => (Math.random() * 2 - 1) * AUDIO.sfasamento;
  // melodia un po' stonata: ogni nota calante o crescente a caso di qualche cent
  const st = () => 2 ** (((Math.random() * 2 - 1) * AUDIO.stonatura) / 1200);
  // melodia
  let t = t0;
  const campanelle = giro % 2 === 1;
  for (const [n, d] of MELODIA[i]) {
    if (campanelle) campana(m, midi(n + 12) * st(), t + j(), 0.28, Math.min(1.4, d * b * 1.6), out);
    else pizzicato(m, midi(n) * st(), t + j(), d * b, 0.3, out);
    t += d * b;
  }
  // basso
  const r = ACCORDI[i];
  const sc = SCALETTE[i];
  if (sc) sc.forEach((n, k) => basso(m, midi(n), t0 + k * b + j(), b * 0.9, out));
  else {
    basso(m, midi(r), t0 + j(), b * 1.8, out);
    basso(m, midi(r + 7), t0 + 2 * b + j(), b * 1.8, out);
  }
  // sonagli sugli ottavi
  for (let k = 0; k < 8; k++) sonaglio(m, t0 + (k * b) / 2 + j(), k % 4 === 2 ? 0.16 : k % 2 ? 0.05 : 0.08, out);
  // arpeggio di glockenspiel sull'accordo (due ottave sopra il basso)
  if (ARPEGGI.has(i)) {
    const note = [...MAGGIORE, 12].map((s) => r + 24 + s + (r < 48 ? 12 : 0));
    note.forEach((n, k) => campana(m, midi(n), t0 + 2 * b + (k * b) / 2 + j(), 0.1, 0.9, out));
  }
}
/** Nota di melodia pizzicata: triangolo + quadra filtrata, attacco rapido e decadimento. */
function pizzicato(m, f, t, dur, vol, dest) {
  const c = m.ctx;
  const g = c.createGain();
  const fine = t + Math.min(dur * 0.95, 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, fine + 0.08);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 6, t);
  lp.frequency.exponentialRampToValueAtTime(f * 2, t + 0.25);
  lp.connect(g).connect(dest);
  const o1 = c.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = c.createOscillator();
  o2.type = 'square';
  o2.frequency.value = f * 1.003;
  const g2 = c.createGain();
  g2.gain.value = 0.18;
  o1.connect(lp);
  o2.connect(g2).connect(lp);
  for (const o of [o1, o2]) {
    o.start(t);
    o.stop(fine + 0.1);
  }
  o1.onended = () => {
    for (const x of [o1, o2, g2, lp, g]) x.disconnect();
  };
}

/** Basso morbido: sinusoide + triangolo, pizzicato. */
function basso(m, f, t, dur, dest) {
  const c = m.ctx;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.42, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(dest);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.05);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}

/** Sonaglio da slitta: colpo di rumore acuto filtrato passa-banda, brevissimo. */
function sonaglio(m, t, vol, dest) {
  const c = m.ctx;
  const s = c.createBufferSource();
  s.buffer = m.rumore;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 7500 + Math.random() * 1500;
  bp.Q.value = 2.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  s.connect(bp).connect(g).connect(dest);
  s.start(t, Math.random() * 0.8, 0.12);
  s.onended = () => {
    s.disconnect();
    bp.disconnect();
    g.disconnect();
  };
}
