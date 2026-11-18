import { AUDIO } from '../config.js';
import { campana, midi } from './effetti.js';

/**
 * Musica di sottofondo: ritornello di "Jingle Bells" (J. Pierpont, 1857, pubblico dominio) con un
 * arrangiamento nostro, semplice e tutto sintetizzato:
 *  - melodia: triangolo + onda quadra morbida filtrata (pizzicato); al giro successivo la suonano le campanelle, un'ottava sopra;
 *  - basso "um-pa" (fondamentale sul primo tempo, quinta sul terzo) con una scaletta che porta al Fa;
 *  - sonagli da slitta sugli ottavi (rumore filtrato acuto, accenti sul 2 e sul 4);
 *  - arpeggi di glockenspiel sull'accordo nelle battute in cui la melodia tiene la nota;
 *  - due battute di "respiro" (solo basso e sonagli) prima di ricominciare.
 * Tonalità Do maggiore, 4/4, tempo AUDIO.tempo. Programmata in anticipo (lookahead) sul tempo del contesto audio.
 * @typedef {import('./motore.js').Motore} Motore
 */

const E = 76, F = 77, G = 79, C = 72, D = 74;
// Melodia per battuta: [nota MIDI, durata in tempi]
const A1 = [[E, 1], [E, 1], [E, 2]];
const A3 = [[E, 1], [G, 1], [C, 1.5], [D, 0.5]];
const A4 = [[E, 4]];
const B5 = [[F, 1], [F, 1], [F, 1.5], [F, 0.5]];
const B6 = [[F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5]];
const MELODIA = [
  A1, A1, A3, A4, B5, B6, [[E, 1], [D, 1], [D, 1], [E, 1]], [[D, 2], [G, 2]],
  A1, A1, A3, A4, B5, B6, [[G, 1], [G, 1], [F, 1], [D, 1]], [[C, 4]],
  [], [], // respiro
];
// Accordi (fondamentale MIDI del basso, ottava 2–3) e tipo
const ACCORDI = [48, 48, 48, 48, 53, 48, 50, 43, 48, 48, 48, 48, 53, 48, 43, 48, 48, 48];
const MAGGIORE = [0, 4, 7];
// Battute con la nota tenuta: arpeggio di glockenspiel sui tempi 3–4
const ARPEGGI = new Set([3, 7, 11, 15, 16, 17]);
// Scalette del basso verso la battuta dopo (Do → Fa)
const SCALETTE = { 3: [48, 52, 55, 57], 11: [48, 52, 55, 57] };

const LOOKAHEAD = 0.25; // s di musica programmata in anticipo
const TICK = 60; // ms tra due programmazioni

export class Musica {
  /** @param {Motore} m */
  constructor(m) {
    this.m = m;
    this.timer = null;
    this.battuta = 0;
    this.giro = 0;
    this.prossima = 0; // istante (tempo del contesto) d'inizio della prossima battuta
  }

  avvia() {
    if (this.timer || !this.m.ctx) return;
    this.prossima = this.m.t + 0.15;
    this.timer = setInterval(() => this.programma(), TICK);
    this.programma();
  }

  ferma() {
    clearInterval(this.timer);
    this.timer = null;
  }

  programma() {
    const m = this.m;
    if (!m.attivo) {
      // contesto sospeso (muto, pagina nascosta): il tempo del contesto è fermo; si riparte da "adesso"
      if (m.ctx && this.prossima < m.t) this.prossima = m.t + 0.1;
      return;
    }
    if (this.prossima < m.t - 0.5) this.prossima = m.t + 0.05; // ritardo grosso (tab rallentata): niente raffica
    while (this.prossima < m.t + LOOKAHEAD) {
      this.suonaBattuta(this.battuta, this.prossima);
      this.prossima += (4 * 60) / AUDIO.tempo;
      if (++this.battuta >= MELODIA.length) {
        this.battuta = 0;
        this.giro++;
      }
    }
  }

  suonaBattuta(i, t0) {
    const m = this.m;
    const b = 60 / AUDIO.tempo; // durata di un tempo (s)
    const out = m.mus;
    // melodia
    let t = t0;
    const campanelle = this.giro % 2 === 1;
    for (const [n, d] of MELODIA[i]) {
      if (campanelle) campana(m, midi(n + 12), t, 0.28, Math.min(1.4, d * b * 1.6), out);
      else pizzicato(m, midi(n), t, d * b, 0.3, out);
      t += d * b;
    }
    // basso
    const r = ACCORDI[i];
    const sc = SCALETTE[i];
    if (sc) sc.forEach((n, k) => basso(m, midi(n), t0 + k * b, b * 0.9, out));
    else {
      basso(m, midi(r), t0, b * 1.8, out);
      basso(m, midi(r + 7), t0 + 2 * b, b * 1.8, out);
    }
    // sonagli sugli ottavi
    for (let k = 0; k < 8; k++) sonaglio(m, t0 + (k * b) / 2, k % 4 === 2 ? 0.16 : k % 2 ? 0.05 : 0.08, out);
    // arpeggio di glockenspiel sull'accordo (due ottave sopra il basso)
    if (ARPEGGI.has(i)) {
      const note = [...MAGGIORE, 12].map((s) => r + 24 + s + (r < 48 ? 12 : 0));
      note.forEach((n, k) => campana(m, midi(n), t0 + 2 * b + (k * b) / 2, 0.1, 0.9, out));
    }
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
