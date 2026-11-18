import { AUDIO } from '../config.js';

/**
 * Musica di sottofondo: riproduce in loop la registrazione già pronta (public/audio/musica.m4a), fatta una volta
 * con tools/audio/registra-musica.mjs dall'arrangiamento in arrangiamento.js. Nel gioco non si sintetizza niente:
 * una sola sorgente che legge un buffer costa pochissimo (prima la sintesi nota per nota pesava ~22% di un core
 * sul telefono).
 *
 * Il file si scarica e si decodifica una volta, al primo avvio dell'audio. Il loop è senza stacchi: la
 * registrazione è ciclica (le code delle ultime note sono già sommate all'inizio) e Chrome (Mac e Android, misurato)
 * toglie da solo il ritardo del codificatore AAC, quindi il buffer dura esattamente il ciclo musicale
 * (AUDIO.musicaDurata). Se un browser lo lasciasse, il buffer sarebbe più lungo: si salta il ritardo standard.
 * @typedef {import('./motore.js').Motore} Motore
 */
export class Musica {
  /** @param {Motore} m */
  constructor(m) {
    this.m = m;
    this.buffer = null;
    this.sorgente = null;
    this.carico = null; // promessa del caricamento in corso
  }

  avvia() {
    if (this.sorgente || !this.m.ctx) return;
    this.carica().then((b) => {
      if (!b || this.sorgente) return;
      const c = this.m.ctx;
      const s = c.createBufferSource();
      s.buffer = b;
      s.loop = true;
      const inizio = b.duration > AUDIO.musicaDurata + 0.02 ? RITARDO_AAC : 0;
      s.loopStart = inizio;
      s.loopEnd = inizio + AUDIO.musicaDurata;
      const g = c.createGain();
      g.gain.value = AUDIO.musicaGuadagno;
      s.connect(g).connect(this.m.mus);
      s.start(c.currentTime + 0.05, inizio);
      this.sorgente = s;
      this.guadagno = g;
    });
  }

  ferma() {
    this.sorgente?.stop();
    this.sorgente?.disconnect();
    this.guadagno?.disconnect();
    this.sorgente = null;
  }

  carica() {
    this.carico ||= fetch(`${import.meta.env?.BASE_URL ?? '/'}audio/musica.m4a`)
      .then((r) => r.arrayBuffer())
      .then((a) => this.m.ctx.decodeAudioData(a))
      .then((b) => (this.buffer = b))
      .catch(() => null);
    return this.carico;
  }
}

/** Ritardo iniziale standard del codificatore AAC (2112 campioni a 44.1 kHz), se il browser non lo toglie. */
const RITARDO_AAC = 2112 / 44100;
