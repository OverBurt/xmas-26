import { AUDIO } from '../config.js';

/**
 * Motore audio (Web Audio): contesto, bus, sblocco al primo gesto, volumi e muto separati di musica ed effetti,
 * pausa con la pagina nascosta.
 *
 *   sorgenti → sfx ─┐
 *   sorgenti → mus ─┴→ master → compressore → uscita
 *
 * Il contesto nasce solo dentro un gesto dell'utente (regola dei browser): prima di allora `ctx` è null
 * e ogni richiesta di suono viene ignorata. Musica ed effetti hanno ciascuno acceso/spento e volume (`prefs`, salvate
 * sul dispositivo); con entrambi spenti (`muto`) il contesto viene sospeso (niente lavoro inutile). Con gli effetti
 * spenti non si sintetizza nessun effetto.
 * `stats` conta i suoni richiesti per nome e le voci contemporanee (per le prove: `xmas.audio.stats`).
 */
export class Motore {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.prefs = leggiPrefs(); // {musica: {on, vol}, effetti: {on, vol}}, vol 0–1
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
    this.sfx.gain.value = this.volEffetti;
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

  /** Musica ed effetti entrambi spenti: il contesto resta sospeso. */
  get muto() {
    return !this.prefs.musica.on && !this.prefs.effetti.on;
  }

  /** Fattore di volume scelto per la musica (0 se spenta). */
  get volMusica() {
    return this.prefs.musica.on ? this.prefs.musica.vol : 0;
  }

  /** Guadagno del bus degli effetti (0 se spenti). */
  get volEffetti() {
    return AUDIO.sfx * (this.prefs.effetti.on ? this.prefs.effetti.vol : 0);
  }

  /** Il motore può suonare adesso? */
  get attivo() {
    return !!this.ctx && !this.muto && this.ctx.state === 'running';
  }

  /** Si possono suonare effetti adesso? (con gli effetti spenti non si sintetizzano nemmeno) */
  get effettiAttivi() {
    return this.attivo && this.prefs.effetti.on;
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
    if (!this.effettiAttivi) return 0;
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

  /** Spegne o riaccende tutto (tasto M): musica ed effetti insieme, i volumi restano. */
  impostaMuto(m) {
    this.prefs.musica.on = !m;
    this.prefs.effetti.on = !m;
    this.applica();
  }

  /** Cambia acceso/spento (`on`) e/o volume (`vol`, 0–1) di un canale: 'musica' o 'effetti'. */
  imposta(canale, { on, vol } = {}) {
    const p = this.prefs[canale];
    if (on !== undefined) p.on = on;
    if (vol !== undefined) p.vol = Math.min(1, Math.max(0, vol));
    this.applica();
  }

  /** Applica e salva le preferenze: guadagni, contesto sospeso se tutto è spento, avviso agli ascoltatori. */
  applica() {
    try {
      localStorage.setItem(AUDIO.storageKey, JSON.stringify(this.prefs));
    } catch {}
    const m = this.muto;
    if (this.ctx) {
      const t = this.t;
      for (const [g, v] of [[this.master.gain, m ? 0 : AUDIO.master], [this.sfx.gain, this.volEffetti]]) {
        g.cancelScheduledValues(t);
        g.setTargetAtTime(v, t, 0.03);
      }
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

/** Preferenze salvate; dalla vecchia versione (solo muto '1'/'0') si passa a musica ed effetti insieme. */
function leggiPrefs() {
  const base = (on) => ({ musica: { on, vol: 1 }, effetti: { on, vol: 1 } });
  try {
    const v = localStorage.getItem(AUDIO.storageKey);
    if (v === '1' || v === '0') return base(v === '0');
    const p = JSON.parse(v);
    if (p?.musica && p?.effetti) return { musica: { on: !!p.musica.on, vol: +p.musica.vol || 0 }, effetti: { on: !!p.effetti.on, vol: +p.effetti.vol || 0 } };
  } catch {}
  return base(true);
}
