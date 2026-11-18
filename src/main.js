import { Box, Vec2 } from 'planck';
import { VIEW_W, VIEW_H, MAX_DPR, SLING, IDLE_DIV } from './config.js';
import { startLoop } from './core/loop.js';
import { attachInput } from './core/input.js';
import { setupFullscreen } from './core/fullscreen.js';
import { setupShare } from './core/share.js';
import { Game } from './game/game.js';
import { drawScene } from './render/sceneDraw.js';
import { setHudScale } from './render/view.js';
import { quality, initQuality, sampleQuality } from './render/quality.js';
import { LEVELS, findLevel } from './game/levels/index.js';
import { avviaAudio } from './audio/regia.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
initQuality(new URLSearchParams(location.search)); // ?qualita=alta|media|bassa fissa il livello grafico
if (DEBUG) document.body.classList.add('debug');

// ---------- Canvas e riquadro con proporzioni da smartphone orizzontale ----------
const frame = document.getElementById('frame');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');
const controls = document.getElementById('controls');
let pixelScale = 1;
/** Bordo inferiore dei pulsanti DOM in px logici: il nome del livello sul canvas va disegnato sotto. */
let controlsBottom = 0;

function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const desktop = matchMedia('(min-width: 900px) and (hover: hover)').matches;
  const margin = desktop ? 60 : 0;
  const s = Math.min((vw - margin) / VIEW_W, (vh - margin) / VIEW_H);
  const cssW = Math.floor(VIEW_W * s);
  const cssH = Math.floor(VIEW_H * s);
  frame.style.width = `${cssW}px`;
  frame.style.height = `${cssH}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, quality.tier.dpr);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  pixelScale = canvas.width / VIEW_W;
  setHudScale(s); // telefoni: HUD ed etichette più grandi
  // Su un telefono 1 px CSS vale ~1.6 px logici: i pulsanti occupano più spazio nella vista logica
  const fr = frame.getBoundingClientRect();
  controlsBottom = (controls.getBoundingClientRect().bottom - fr.top) / s;
}
window.addEventListener('resize', resize);
resize();
setupFullscreen({
  button: document.getElementById('fs-btn'),
  iosHint: document.getElementById('ios-hint'),
  onChange: resize,
});

setupShare({ button: document.getElementById('share-btn'), avviso: document.getElementById('avviso') });

// ---------- Gioco e livelli ----------
const store = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
};
const params = new URLSearchParams(location.search);
const game = new Game(findLevel(params.get('level') || store.get('xmas-level', null)));

// Audio sintetizzato (src/audio/): si sblocca al primo tocco, pulsante muto e tasto M
const audio = avviaAudio(game, { button: document.getElementById('muto-btn'), pannello: document.getElementById('audio-pannello') });

// Miglior punteggio per livello (solo su questo dispositivo)
game.on('fine', (s) => {
  const best = store.get('xmas-best', {});
  const prev = best[game.level.id];
  if (!prev || s.score > prev.score) best[game.level.id] = { score: s.score, stars: s.stars };
  store.set('xmas-best', best);
  // totale delle stelle (il meglio di ogni livello), mostrato nel pannello finale e nel selettore
  s.totalStars = stelleTotali(best);
  s.maxStars = LEVELS.length * 3;
});
function stelleTotali(best) {
  return LEVELS.reduce((n, l) => n + (best[l.id]?.stars || 0), 0);
}

/** Passa a un livello: lo ricorda come ultimo scelto e dice al gioco se ce n'è uno dopo (pulsante "Avanti"). */
function vaiAlLivello(l) {
  store.set('xmas-level', l.id);
  game.hasNext = LEVELS.indexOf(l) < LEVELS.length - 1;
  game.setLevel(l);
}
game.hasNext = LEVELS.indexOf(game.level) < LEVELS.length - 1;
game.onNext = () => {
  const i = LEVELS.indexOf(game.level);
  if (i >= 0 && i < LEVELS.length - 1) vaiAlLivello(LEVELS[i + 1]);
};

const levelsEl = document.getElementById('levels');
function openLevels() {
  const best = store.get('xmas-best', {});
  const list = document.getElementById('level-list');
  levelsEl.querySelector('h2').textContent = `Scegli il livello · ★ ${stelleTotali(best)} su ${LEVELS.length * 3}`;
  list.replaceChildren(
    ...LEVELS.map((l) => {
      const b = document.createElement('button');
      b.dataset.level = l.id;
      if (l.id === game.level.id) b.className = 'current';
      const name = document.createElement('span');
      name.textContent = l.name;
      const rec = document.createElement('span');
      rec.className = 'best';
      const r = best[l.id];
      rec.textContent = r ? `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}  ${r.score}` : '—';
      b.append(name, rec);
      return b;
    }),
  );
  levelsEl.hidden = false;
}
function closeLevels() {
  levelsEl.hidden = true;
}
game.onLevels = openLevels;

levelsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) {
    if (e.target === levelsEl) closeLevels(); // tocco fuori dal pannello
    return;
  }
  if (btn.dataset.level) {
    vaiAlLivello(findLevel(btn.dataset.level));
  }
  closeLevels();
});

/** Ultima posizione del mouse o del dito (px logici): la guarda il gufo sulla luna. */
let puntatore = null;
attachInput(canvas, {
  down: (p) => game.pointerDown(p),
  move: (p) => game.pointerMove(p),
  up: (p) => game.pointerUp(p),
  hover: (p) => { puntatore = p; },
});

/** Debug: sveglia tutte le lastre senza urti (test di stabilità). */
function wakeAll() {
  for (const s of game.slabs) s.setAwake(true);
}

/** Debug: 40 blocchi che cadono dall'alto, per misurare il costo della fisica. */
function stress() {
  const { pw, camera } = game;
  for (let i = 0; i < 40; i++) {
    const b = pw.world.createBody({
      type: 'dynamic',
      position: new Vec2(camera.x + 2 + Math.random() * (camera.viewW - 4), 10 + Math.random() * 6),
      angle: Math.random() * Math.PI,
    });
    const hw = 0.15 + Math.random() * 0.3;
    const hh = 0.1 + Math.random() * 0.2;
    b.createFixture({ shape: new Box(hw, hh), density: 1, friction: 0.6 });
    b.setUserData({ kind: 'ice', flash: 0 });
    game.slabs.push(b); // così il lampeggio decade come per le lastre
  }
}

controls.addEventListener('click', (e) => {
  const action = e.target.dataset?.action;
  if (action === 'reset') game.reset();
  if (action === 'levels') openLevels();
  if (action === 'wake') wakeAll();
  if (action === 'stress') stress();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'r') game.reset();
  if (e.key === 'l') (levelsEl.hidden ? openLevels() : closeLevels());
  if (e.key === 'Escape') closeLevels();
  if (DEBUG && e.key === 'w') wakeAll();
  if (DEBUG && e.key === 's') stress();
});

// ---------- Loop ----------
let hudTimer = 0;
/** Misure del disegno (debug e prove): medie da azzerare a mano con `xmas.perf.reset()`. */
const perf = {
  frames: 0,
  renderMs: 0, // somma dei tempi di disegno
  worstMs: 0, // disegno più lento
  worstFrameMs: 0, // intervallo più lungo tra due frame
  reset() { this.frames = 0; this.renderMs = 0; this.worstMs = 0; this.worstFrameMs = 0; },
};
/** Un aggiornamento del loop = uno step fisico a dt fisso. */
function update(dt) {
  game.step(dt);
}

startLoop({
  update,
  idle: () => game.fermo,
  render(alpha, elapsed, stats) {
    game.frame(elapsed);
    audio.aggiorna();
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    const t0 = performance.now();
    drawScene(ctx, game, alpha, { debug: DEBUG, hudTop: controlsBottom, puntatore });
    const ms = performance.now() - t0;
    perf.frames++;
    perf.renderMs += ms;
    if (ms > perf.worstMs) perf.worstMs = ms;
    if (elapsed * 1000 > perf.worstFrameMs) perf.worstFrameMs = elapsed * 1000;
    // Qualità automatica: si scende di livello solo a scena ferma (mai durante un volo)
    // (a scena ferma i frame sono volutamente più radi, IDLE_DIV: il tempo misurato si riporta al frame normale)
    if (sampleQuality(game.fermo ? elapsed / IDLE_DIV : elapsed, game.state === 'ready' || game.state === 'end')) resize();

    if (!DEBUG || (hudTimer += 1) % 15 !== 0) return;
    const c = game.pw.counts();
    hud.textContent =
      `FPS ${stats.fps} (${stats.hz} Hz ÷${stats.every}) · fisica ${stats.physicsMs.toFixed(2)} ms · disegno ${(perf.renderMs / Math.max(1, perf.frames)).toFixed(2)} ms (max ${perf.worstMs.toFixed(1)}) · ${quality.nome} · canvas ${canvas.width}×${canvas.height}\n` +
      `corpi ${c.dynamic} · svegli ${c.awake} · stato ${game.state} · lanci ${game.stats.shots}\n` +
      `impulso max ultimo lancio ${game.stats.maxImpulse.toFixed(2)}`;
  },
});

/**
 * Debug: tiro con angolo (rad, sopra l'orizzontale) e tensione (m).
 * `sim` lo simula in un mondo separato e restituisce l'apertura raggiunta (o null);
 * `fire` lo esegue nel gioco visibile.
 */
function shotParams(g, angle, pull) {
  const dx = -Math.cos(angle) * pull;
  const dy = -Math.sin(angle) * pull;
  return { x: g.sling.x + dx, y: g.sling.y + dy, vx: -dx * SLING.power, vy: -dy * SLING.power };
}
function sim(type, angle, pull) {
  const g = new Game(game.level);
  g.launch({ gift: { type }, ...shotParams(g, angle, pull) });
  for (let i = 0; i < 480 && !g.deliveries.length && g.state === 'flight'; i++) g.step(1 / 60);
  return g.deliveries[0]?.type ?? null;
}
function fire(type, angle, pull) {
  const gift = game.sleigh.gifts.find((x) => x.type === type);
  if (game.state !== 'ready' || !gift) return false;
  game.sleigh.take(gift);
  game.launch({ gift, ...shotParams(game, angle, pull) });
  return true;
}
/** Cerca un tiro che consegna da una certa apertura. */
function findShot(type, zone, a0 = 0.1, a1 = 1.35, p0 = 1.2, p1 = 2.2) {
  for (let a = a0; a <= a1; a += 0.025) for (let p = p0; p <= p1; p += 0.05) if (sim(type, a, p) === zone) return [a, p];
  return null;
}

// Accesso da console/DevTools per test e taratura.
window.xmas = { game, wakeAll, stress, sim, fire, findShot, perf, quality, audio };

// Funzionamento offline (solo nel build pubblicato): il service worker mette in cache il gioco alla prima visita
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
