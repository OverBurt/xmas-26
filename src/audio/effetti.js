/**
 * Effetti sonori sintetizzati (oscillatori, rumore filtrato, inviluppi). Nessun file audio.
 * Ogni funzione riceve il motore (src/audio/motore.js), chiede una voce e programma i nodi; i nodi si
 * scollegano da soli a fine suono (onended). Volumi relativi 0–1, poi scalati dal bus degli effetti.
 * @typedef {import('./motore.js').Motore} Motore
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
/** Frequenza di una nota MIDI. */
export const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// ---------------------------------------------------------------- mattoni

/** Guadagno con inviluppo attacco/decadimento esponenziale. */
function inviluppo(m, dest, t, vol, att, dec) {
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  g.connect(dest);
  return g;
}

/** Oscillatore che parte a t e si ferma a t+dur (poi si scollega). */
function oscillatore(m, tipo, f, t, dur, dest) {
  const o = m.ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  o.onended = () => o.disconnect();
  return o;
}

/** Rumore bianco filtrato (tipo di filtro, frequenza, Q). Restituisce {src, filtro}. */
function rumore(m, t, dur, dest, tipo, f, q = 1) {
  const s = m.ctx.createBufferSource();
  s.buffer = m.rumore;
  s.loop = true;
  const fl = m.ctx.createBiquadFilter();
  fl.type = tipo;
  fl.frequency.setValueAtTime(f, t);
  fl.Q.value = q;
  s.connect(fl).connect(dest);
  s.start(t, Math.random() * 0.8);
  s.stop(t + dur + 0.05);
  s.onended = () => {
    s.disconnect();
    fl.disconnect();
  };
  return { src: s, filtro: fl };
}

/** Campanella: parziali non armoniche (tipo glockenspiel/campana) con decadimento più rapido sugli acuti. */
export function campana(m, f, t, vol, dur = 1.2, dest = m.sfx) {
  const parziali = [
    [1, 1, 1],
    [2.76, 0.42, 0.55],
    [5.4, 0.22, 0.32],
    [8.93, 0.1, 0.2],
  ];
  for (const [r, a, d] of parziali) {
    if (f * r > 16000) continue;
    const g = inviluppo(m, dest, t, vol * a, 0.003, dur * d);
    oscillatore(m, 'sine', f * r, t, dur * d, g);
  }
}

// ---------------------------------------------------------------- effetti di gioco

/**
 * Voce dell'elastico durante la mira: oggetto con aggiorna(tensione 0–1) e ferma().
 * Timbro da cartone animato: una voce nasale tipo kazoo (quadra + dente di sega un'ottava sotto, filtrate da una
 * "vocale" passa-banda che si apre da "uu" a "ii" con la tensione) con un vibrato di intonazione che si allarga
 * tirando, più uno squittio di gomma a ogni scatto di tensione in più ("nyeee... iik iik").
 */
export function elastico(m, cfg) {
  const voce = m.voce('tensione', 30, true);
  if (!voce) return null;
  const c = m.ctx;
  const t = m.t;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(cfg.gain, t + 0.06);
  out.connect(m.sfx);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  lp.connect(out);
  const vocale = c.createBiquadFilter(); // formante: dà il colore "nasale"
  vocale.type = 'bandpass';
  vocale.frequency.value = cfg.formant[0];
  vocale.Q.value = 3.5;
  vocale.connect(lp);
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = cfg.f0;
  const o2 = c.createOscillator(); // un'ottava sotto, più piano: corpo gommoso
  o2.type = 'sawtooth';
  o2.frequency.value = cfg.f0 / 2;
  const g2 = c.createGain();
  g2.gain.value = 0.5;
  const vib = c.createOscillator(); // vibrato sull'intonazione (cent), non sul volume
  vib.frequency.value = 5;
  const vibG = c.createGain();
  vibG.gain.value = cfg.vibrato * 0.5;
  vib.connect(vibG);
  vibG.connect(o.detune);
  vibG.connect(o2.detune);
  o.connect(vocale);
  o2.connect(g2).connect(vocale);
  for (const x of [o, o2, vib]) x.start(t);
  let finito = false;
  let scatto = 0; // ultimo scatto di tensione suonato
  let f = cfg.f0;
  return {
    aggiorna(k) {
      if (finito) return;
      f = cfg.f0 + (cfg.f1 - cfg.f0) * k ** 1.3;
      const ora = m.t;
      o.frequency.setTargetAtTime(f, ora, 0.05);
      o2.frequency.setTargetAtTime(f / 2, ora, 0.05);
      vocale.frequency.setTargetAtTime(cfg.formant[0] + (cfg.formant[1] - cfg.formant[0]) * k, ora, 0.06);
      vib.frequency.setTargetAtTime(5 + k * 4, ora, 0.1);
      vibG.gain.setTargetAtTime(cfg.vibrato * (0.5 + k), ora, 0.1);
      const n = Math.floor(k * cfg.scatti);
      if (n > scatto) squittio(m, f * 2.2, ora, cfg.gain * 1.6, out);
      scatto = n; // tornando indietro non suona, ma riparte da lì
    },
    ferma() {
      if (finito) return;
      finito = true;
      const ora = m.t;
      out.gain.cancelScheduledValues(ora);
      out.gain.setTargetAtTime(0.0001, ora, 0.03);
      for (const x of [o, o2, vib]) {
        x.stop(ora + 0.2);
        x.onended = () => x.disconnect();
      }
      setTimeout(() => {
        for (const x of [out, lp, vocale, g2, vibG]) x.disconnect();
      }, 400);
      m.liberaVoce(voce);
    },
  };
}

/** Squittio di gomma: brevissimo "iik" che sale (sinusoide + triangolo), sul bus `dest`. */
function squittio(m, f, t, vol, dest) {
  const g = inviluppo(m, dest, t, vol, 0.004, 0.07);
  for (const [tipo, r, a] of [['sine', 1, 1], ['triangle', 1.5, 0.35]]) {
    const ga = m.ctx.createGain();
    ga.gain.value = a;
    ga.connect(g);
    const o = oscillatore(m, tipo, f * r, t, 0.08, ga);
    o.frequency.exponentialRampToValueAtTime(f * r * 1.45, t + 0.06);
    o.addEventListener('ended', () => ga.disconnect());
  }
}

/** Lancio: schiocco dell'elastico (colpo di rumore + "twang" che scende) e fruscio d'aria che dura con la velocità. */
export function lancio(m, velocita) {
  if (!m.voce('lancio', 0.9, true)) return;
  const t = m.t;
  const k = clamp(velocita / 24, 0.3, 1);
  // schiocco
  rumore(m, t, 0.05, inviluppo(m, m.sfx, t, 0.8 * k, 0.001, 0.05), 'highpass', 1800, 0.7);
  const tw = inviluppo(m, m.sfx, t, 0.5 * k, 0.002, 0.22);
  const o = oscillatore(m, 'triangle', 260, t, 0.25, tw);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
  // fruscio
  const dur = 0.35 + 0.45 * k;
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16 * k, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(m.sfx);
  const { filtro } = rumore(m, t, dur, g, 'bandpass', 2400, 1.4);
  filtro.frequency.exponentialRampToValueAtTime(600, t + dur);
}

/** Neve che si rompe: tonfo morbido (sinusoide grave) + fruscio filtrato basso. vol 0–1, grande 0–1 (area). */
export function neve(m, vol, grande) {
  if (!m.voce('rottura-neve', 0.45)) return;
  const t = m.t + rnd(0, 0.015);
  const dur = 0.18 + grande * 0.3;
  const g = inviluppo(m, m.sfx, t, 0.5 * vol, 0.004, dur);
  const { filtro } = rumore(m, t, dur, g, 'lowpass', 900 + rnd(-150, 250) - grande * 300, 0.8);
  filtro.frequency.exponentialRampToValueAtTime(200, t + dur);
  const th = inviluppo(m, m.sfx, t, 0.45 * vol, 0.003, 0.12 + grande * 0.12);
  const o = oscillatore(m, 'sine', 120 - grande * 40, t, 0.25, th);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
}

/** Pupazzo di neve che si separa: tonfo più grave e un "puff". */
export function pupazzo(m, vol) {
  neve(m, vol, 0.8);
  if (!m.voce('rottura-pupazzo', 0.3)) return;
  const t = m.t;
  const g = inviluppo(m, m.sfx, t, 0.3 * vol, 0.01, 0.25);
  const o = oscillatore(m, 'sine', 90, t, 0.3, g);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
}

/**
 * Pacco non consegnato che svanisce: un "Fiu!" di vento. Soffio di rumore in un passa-banda stretto che sale
 * veloce di tono e sfuma (la "f" e la "iu"), con sotto un fischio leggero che sale insieme.
 */
export function svanito(m) {
  if (!m.voce('svanito', 0.45)) return;
  const t = m.t;
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.07);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  g.connect(m.sfx);
  const { filtro } = rumore(m, t, 0.45, g, 'bandpass', 500, 5);
  filtro.frequency.exponentialRampToValueAtTime(3200, t + 0.3);
  setTimeout(() => g.disconnect(), 700);
  const o = oscillatore(m, 'sine', 700, t + 0.03, 0.32, inviluppo(m, m.sfx, t + 0.03, 0.05, 0.06, 0.26));
  o.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
}

/** Ghiaccio: tintinnio cristallino (3–5 note acute brevi e casuali) più uno scricchiolio. */
export function ghiaccio(m, vol, grande) {
  if (!m.voce('rottura-ghiaccio', 0.8)) return;
  const t = m.t;
  rumore(m, t, 0.06, inviluppo(m, m.sfx, t, 0.25 * vol, 0.001, 0.06), 'highpass', 3500, 1);
  const n = 3 + Math.round(grande * 2);
  for (let i = 0; i < n; i++) {
    const f = rnd(1800, 4200) * (1 - grande * 0.25);
    const ti = t + i * rnd(0.025, 0.06);
    const g = inviluppo(m, m.sfx, ti, 0.14 * vol, 0.001, rnd(0.15, 0.45));
    oscillatore(m, 'sine', f, ti, 0.5, g);
    oscillatore(m, 'sine', f * 2.31, ti, 0.2, inviluppo(m, m.sfx, ti, 0.05 * vol, 0.001, 0.12));
  }
}

/** Cristalli dell'albero staccati: tintinnio lieve e acuto, 2–4 note brevissime più un fruscio sottile. `n` = quanti, `gain` volume. */
export function cristalli(m, n, gain = 1) {
  if (!m.voce('cristalli', 0.3)) return;
  const t = m.t;
  const vol = gain * Math.min(1.6, 0.7 + Math.log2(1 + n) * 0.3);
  rumore(m, t, 0.04, inviluppo(m, m.sfx, t, 0.12 * vol, 0.001, 0.04), 'highpass', 6000, 1);
  const k = Math.min(4, 2 + Math.floor(n / 2));
  for (let i = 0; i < k; i++) {
    const ti = t + i * rnd(0.015, 0.045);
    const f = rnd(3200, 6800);
    oscillatore(m, 'sine', f, ti, 0.2, inviluppo(m, m.sfx, ti, rnd(0.05, 0.09) * vol, 0.001, rnd(0.05, 0.16)));
  }
}
/** Vetro: schianto di rumore acuto + molti frammenti tintinnanti che cadono. */
export function vetro(m, vol = 1) {
  if (!m.voce('vetro', 0.9, true)) return;
  const t = m.t;
  const g = inviluppo(m, m.sfx, t, 0.45 * vol, 0.002, 0.25);
  const { filtro } = rumore(m, t, 0.3, g, 'highpass', 2500, 0.8);
  filtro.frequency.exponentialRampToValueAtTime(6000, t + 0.25);
  for (let i = 0; i < 9; i++) {
    const ti = t + 0.02 + Math.random() ** 1.6 * 0.5;
    const f = rnd(2500, 7000);
    oscillatore(m, 'sine', f, ti, 0.15, inviluppo(m, m.sfx, ti, rnd(0.04, 0.1) * vol, 0.001, rnd(0.05, 0.14)));
  }
}

/**
 * Consegna: arpeggio di campanelle in pentatonica maggiore. Porta 2 note, finestra 3, camino 5 con
 * scintillio finale. Il tono di partenza sale con i punti (50 → grave, 3000 → acuto); le ripetizioni
 * (consegne successive nella stessa apertura) sono un po' più brevi.
 */
export function consegna(m, tipo, punti, ripetizione = 1) {
  if (!m.voce('consegna-' + tipo, 1.8, true)) return;
  const t = m.t + 0.02;
  const scala = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const base = 72 + Math.round(clamp(Math.log2(Math.max(50, punti) / 50) / Math.log2(60), 0, 1) * 7); // C5…G5
  const n = tipo === 'chimney' ? 5 : tipo === 'window' ? 3 : 2;
  const passo = tipo === 'chimney' ? 0.075 : 0.1;
  const note = Math.max(2, n - (ripetizione > 1 ? 1 : 0));
  for (let i = 0; i < note; i++) campana(m, midi(base + scala[i * (tipo === 'door' ? 2 : 1)]), t + i * passo, 0.11, 1.1);
  if (tipo === 'chimney') {
    // accordo finale e scintille
    const tf = t + note * passo;
    for (const s of [0, 4, 7]) campana(m, midi(base + 12 + s), tf, 0.06, 1.6);
    for (let i = 0; i < 6; i++) campana(m, midi(base + 24 + scala[(Math.random() * 6) | 0]), tf + 0.05 + i * 0.06, 0.03, 0.4);
  }
}

/**
 * Renna colpita: un verso buffo. Dente di sega con due formanti (una "vocale" che passa da "o" ad "e"),
 * altezza che sale e ricade con un vibrato largo: un belato-trombetta breve.
 */
export function renna(m) {
  if (!m.voce('renna', 0.6, true)) return;
  const c = m.ctx;
  const t = m.t;
  const dur = 0.42;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(0.32, t + 0.03);
  out.gain.setValueAtTime(0.3, t + dur * 0.6);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(m.sfx);
  const f1 = c.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 6;
  f1.frequency.setValueAtTime(500, t);
  f1.frequency.linearRampToValueAtTime(750, t + dur);
  const f2 = c.createBiquadFilter();
  f2.type = 'bandpass';
  f2.Q.value = 8;
  f2.frequency.setValueAtTime(900, t);
  f2.frequency.linearRampToValueAtTime(1900, t + dur);
  f1.connect(out);
  f2.connect(out);
  const o = c.createOscillator();
  o.type = 'sawtooth';
  const f0 = rnd(190, 230);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f0 * 1.6, t + 0.12);
  o.frequency.linearRampToValueAtTime(f0 * 0.8, t + dur);
  const vib = c.createOscillator();
  vib.frequency.value = 11;
  const vg = c.createGain();
  vg.gain.value = f0 * 0.09;
  vib.connect(vg).connect(o.frequency);
  o.connect(f1);
  o.connect(f2);
  for (const x of [o, vib]) {
    x.start(t);
    x.stop(t + dur + 0.05);
  }
  o.onended = () => {
    for (const x of [o, vib, vg, f1, f2, out]) x.disconnect();
  };
}

/** Rilascio senza tensione sufficiente: piccolo "tunf" smorzato che scende. */
export function annullato(m) {
  if (!m.voce('annullato', 0.25, true)) return;
  const t = m.t;
  const g = m.ctx.createBiquadFilter();
  g.type = 'lowpass';
  g.frequency.value = 600;
  g.connect(inviluppo(m, m.sfx, t, 0.22, 0.005, 0.16));
  const o = oscillatore(m, 'triangle', 330, t, 0.2, g);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.16);
}

/**
 * Fine livello: jingle di campanelle (salita sull'accordo, poi accordo tenuto). Più stelle → una nota
 * in più in cima e uno scintillio.
 */
export function jingle(m, stelle = 0) {
  if (!m.voce('fine', 2.6, true)) return;
  const t = m.t + 0.05;
  const mel = [67, 72, 76, 79, 84]; // G4 C5 E5 G5 C6
  const n = 3 + Math.min(2, stelle);
  for (let i = 0; i < n; i++) campana(m, midi(mel[i]), t + i * 0.13, 0.12, 1.2);
  const tf = t + n * 0.13 + 0.05;
  for (const s of [60, 64, 67, 72]) campana(m, midi(s), tf, 0.07, 2.2);
  // basso morbido sotto l'accordo
  oscillatore(m, 'triangle', midi(48), tf, 1.6, inviluppo(m, m.sfx, tf, 0.18, 0.02, 1.5));
  if (stelle >= 3) for (let i = 0; i < 8; i++) campana(m, midi(84 + [0, 4, 7, 12][i % 4]), tf + 0.1 + i * 0.07, 0.05, 0.5);
}
