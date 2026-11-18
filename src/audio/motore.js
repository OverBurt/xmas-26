import { AUDIO } from '../config.js';

/**
 * Motore audio (Web Audio): contesto, bus, sblocco al primo gesto, muto, pausa con la pagina nascosta.
 *
 *   sorgenti → sfx ─┐
 *   sorgenti → mus ─┴→ master → compressore → uscita
 *
 * Il contesto nasce solo dentro un gesto dell'utente (regola dei browser): prima di allora `ctx` è null
 * e ogni richiesta di suono viene ignorata. Con il muto il contesto viene sospeso (niente lavoro inutile).
 * `stats` conta i suoni richiesti per nome e le voci contemporanee (per le prove: `xmas.audio.stats`).
 */
export class Motore {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.muto = leggiMuto();
    this.voci = []; // istanti di fine delle voci di effetti in corso
    this.stats = { suoni: {}, maxVoci: 0, scartati: 0, creato: null };
    this.alSblocco = []; // funzioni da chiamare quando il contesto è pronto (es. avvio della musica)
    this.alMuto = []; // funzioni chiamate al cambio del muto (pulsante)
  }

  /** Crea/riprende il contesto. Va chiamata dentro un gesto dell'utente. */
  sblocca() {
    // Fuori da un gesto il browser lo rifiuterebbe (con un avviso in console): si aspetta il prossimo tocco
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.stats.creato = performance.now();
      this.costruisci();
      for (const fn of this.alSblocco) fn();
    }
    if (!this.muto && this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
  }

  costruisci() {
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.comp.connect(c.destination);
    this.master = c.createGain();
    this.master.gain.value = this.muto ? 0 : AUDIO.master;
    this.master.connect(this.comp);
    this.sfx = c.createGain();
    this.sfx.gain.value = AUDIO.sfx;
    this.sfx.connect(this.master);
    this.mus = c.createGain();
    this.mus.gain.value = 0;
    this.mus.connect(this.master);
    // Rumore bianco (1 s) riusato da tutti i fruscii
    const n = c.sampleRate;
    this.rumore = c.createBuffer(1, n, n);
    const d = this.rumore.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x3fffffff - 1) * 0.9;
    }
  }

  /** Il motore può suonare adesso? */
  get attivo() {
    return !!this.ctx && !this.muto && this.ctx.state === 'running';
  }

  get t() {
    return this.ctx.currentTime;
  }

  /**
   * Prenota una voce di effetti lunga `durata` s. Restituisce false se ce ne sono già troppe
   * (un suono importante, `prio`, passa comunque). Registra il nome nelle statistiche.
   * Restituisce l'istante di fine prenotato (per liberare prima la voce con `liberaVoce`) oppure 0.
   */
  voce(nome, durata, prio = false) {
    if (!this.attivo) return 0;
    const ora = this.t;
    this.voci = this.voci.filter((f) => f > ora);
    if (this.voci.length >= AUDIO.maxVoices && !prio) {
      this.stats.scartati++;
      return 0;
    }
    const fine = ora + durata;
    this.voci.push(fine);
    this.stats.suoni[nome] = (this.stats.suoni[nome] || 0) + 1;
    if (this.voci.length > this.stats.maxVoci) this.stats.maxVoci = this.voci.length;
    return fine;
  }

  /** Libera una voce prenotata prima del tempo (suoni continui fermati a mano). */
  liberaVoce(fine) {
    const i = this.voci.indexOf(fine);
    if (i >= 0) this.voci.splice(i, 1);
  }

  /** Commuta il muto (pulsante e tasto M); la preferenza resta sul dispositivo. */
  impostaMuto(m) {
    this.muto = m;
    try {
      localStorage.setItem(AUDIO.storageKey, m ? '1' : '0');
    } catch {}
    if (this.ctx) {
      const g = this.master.gain;
      g.cancelScheduledValues(this.t);
      g.setTargetAtTime(m ? 0 : AUDIO.master, this.t, 0.03);
      if (m) setTimeout(() => this.muto && this.ctx.suspend().catch(() => {}), 150);
      else if (!document.hidden) this.ctx.resume().catch(() => {});
    }
    for (const fn of this.alMuto) fn(m);
  }

  /** Pagina nascosta → contesto sospeso; al ritorno riprende (se non è muto). */
  visibilita(nascosta) {
    if (!this.ctx) return;
    if (nascosta) this.ctx.suspend().catch(() => {});
    else if (!this.muto) this.ctx.resume().catch(() => {});
  }
}

function leggiMuto() {
  try {
    return localStorage.getItem(AUDIO.storageKey) === '1';
  } catch {
    return false;
  }
}
