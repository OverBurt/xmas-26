import { AUDIO } from '../config.js';
import { Motore } from './motore.js';
import { Musica } from './musica.js';
import * as fx from './effetti.js';

/**
 * Regia sonora: collega gli eventi di Game (game.on) agli effetti, guida la musica e il pulsante muto.
 *
 *  tensione  → tono dell'elastico che sale con la tensione (seguito a ogni frame finché si mira)
 *  annullato → "tunf" smorzato
 *  lancio    → schiocco + fruscio (più lungo con la velocità)
 *  rottura   → neve: tonfo/fruscio filtrato · ghiaccio: tintinnio · pupazzo: tonfo grave
 *              (raggruppate: al massimo AUDIO.breakMax suoni per materiale ogni AUDIO.breakWindow s,
 *               volume da forza e area, le rotture in più alzano il volume del gruppo)
 *  vetro     → frantumi (vetri ravvicinati: un solo suono)
 *  consegna  → campanelle (porta 2 note, finestra 3, camino 5 + accordo); tono che sale con i punti
 *  renna     → verso buffo
 *  fine      → jingle; poi la musica si attenua
 *  accelera  → (dal tocco che accelera la simulazione) fruscio veloce
 * Musica: bassa, scende durante la mira, si attenua a fine livello.
 *
 * @param {import('../game/game.js').Game} game
 * @param {{button?: HTMLElement}} opts pulsante muto (DOM)
 */
export function avviaAudio(game, { button } = {}) {
  const m = new Motore();
  const musica = new Musica(m);
  let tono = null; // tono dell'elastico in corso
  let livelloMusica = -1; // ultimo fattore di volume applicato alla musica
  /** Rotture in attesa per materiale: {lista, ultimo (ms)} */
  const rotture = { ice: { lista: [], ultimo: -1e9 }, snow: { lista: [], ultimo: -1e9 }, snowman: { lista: [], ultimo: -1e9 } };
  let ultimoVetro = -1e9;

  m.alSblocco.push(() => musica.avvia());

  // Sblocco al primo gesto (lo stesso tocco che chiede lo schermo intero): pointerdown/up, clic, tasto.
  const sblocca = () => {
    m.sblocca();
    if (m.ctx && m.ctx.state === 'running') {
      for (const ev of ['pointerdown', 'pointerup', 'keydown']) window.removeEventListener(ev, sblocca, true);
    }
  };
  for (const ev of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(ev, sblocca, true);
  document.addEventListener('visibilitychange', () => m.visibilita(document.hidden));

  // ---------------------------------------------------------------- eventi di gioco
  game.on('tensione', () => {
    tono?.ferma();
    tono = m.attivo ? fx.elastico(m, AUDIO.tension) : null;
  });
  const fermaTono = () => {
    tono?.ferma();
    tono = null;
  };
  game.on('annullato', () => {
    fermaTono();
    if (m.attivo) fx.annullato(m);
  });
  game.on('lancio', (e) => {
    fermaTono();
    if (m.attivo) fx.lancio(m, e.velocita);
  });
  game.on('rottura', (e) => {
    if (!m.attivo) return;
    const r = rotture[e.materiale];
    if (r) r.lista.push(e);
  });
  game.on('vetro', () => {
    const ora = performance.now();
    if (!m.attivo || ora - ultimoVetro < AUDIO.glassWindow * 1000) return;
    ultimoVetro = ora;
    fx.vetro(m);
  });
  game.on('consegna', (e) => m.attivo && fx.consegna(m, e.tipo, e.punti, e.ripetizione));
  game.on('renna', () => m.attivo && fx.renna(m));
  game.on('fine', (s) => m.attivo && fx.jingle(m, s.stars));
  game.on('accelera', () => m.attivo && fx.accelera(m));

  /** Rotture raccolte: per materiale al massimo breakMax suoni per finestra, i più forti; gli altri alzano il volume. */
  function suonaRotture() {
    const ora = performance.now();
    for (const mat in rotture) {
      const r = rotture[mat];
      if (!r.lista.length || ora - r.ultimo < AUDIO.breakWindow * 1000) continue;
      r.ultimo = ora;
      const lista = r.lista.sort((a, b) => b.forza - a.forza);
      r.lista = [];
      const extra = Math.min(1.6, 1 + 0.12 * (lista.length - AUDIO.breakMax)); // un crollo suona più pieno
      for (let i = 0; i < Math.min(AUDIO.breakMax, lista.length); i++) {
        const e = lista[i];
        const forte = Math.min(1, 0.3 + 0.28 * Math.log2(1 + e.forza)); // forza 0.1 → 0.34, 2 → 0.74, 6+ → 1
        const grande = Math.min(1, Math.sqrt(e.area) / 1.4);
        const vol = Math.min(1, forte * (0.65 + 0.35 * grande) * (lista.length > AUDIO.breakMax ? extra : 1) * (i ? 0.7 : 1));
        if (mat === 'ice') fx.ghiaccio(m, vol, grande);
        else if (mat === 'snowman') fx.pupazzo(m, vol);
        else fx.neve(m, vol, grande);
      }
    }
  }

  // ---------------------------------------------------------------- muto
  function disegnaPulsante() {
    if (!button) return;
    button.innerHTML = m.muto ? ICONA_MUTO : ICONA_SUONO;
    button.setAttribute('aria-pressed', m.muto ? 'true' : 'false');
    button.title = m.muto ? 'Audio spento (tasto M)' : 'Audio acceso (tasto M)';
    button.classList.toggle('spento', m.muto);
  }
  function commuta() {
    m.sblocca(); // anche il pulsante è un gesto: se l'audio non era ancora partito parte ora
    m.impostaMuto(!m.muto);
    if (m.muto) fermaTono();
    disegnaPulsante();
  }
  button?.addEventListener('click', commuta);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') commuta();
  });
  disegnaPulsante();

  /** A ogni frame: tono dell'elastico, rotture raggruppate, volume della musica. */
  function aggiorna() {
    if (!m.ctx) return;
    if (tono) {
      if (game.mode === 'aim' && m.attivo) tono.aggiorna(game.sling.tension);
      else fermaTono();
    }
    if (!m.attivo) return;
    suonaRotture();
    const f = game.state === 'end' ? AUDIO.musicEnd : game.mode === 'aim' ? AUDIO.musicAim : 1;
    if (f !== livelloMusica) {
      // a fine livello si attenua dopo il jingle (più lento), il resto in fretta
      m.mus.gain.cancelScheduledValues(m.t);
      m.mus.gain.setTargetAtTime(AUDIO.music * f, m.t, f === AUDIO.musicEnd ? 1.2 : livelloMusica < 0 ? 1 : AUDIO.duckTime);
      livelloMusica = f;
    }
  }

  return { motore: m, musica, aggiorna, commuta, stats: m.stats };
}

const SVG = (inner) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>${inner}</svg>`;
const ICONA_SUONO = SVG('<path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>');
const ICONA_MUTO = SVG('<path d="M16 9.5l5 5M21 9.5l-5 5"/>');
