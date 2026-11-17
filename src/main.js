import { Box, Vec2 } from 'planck';
import { VIEW_W, VIEW_H, MAX_DPR, SLING } from './config.js';
import { startLoop } from './core/loop.js';
import { attachInput } from './core/input.js';
import { setupFullscreen } from './core/fullscreen.js';
import { Game } from './game/game.js';
import { drawScene } from './render/sceneDraw.js';
import { LEVELS, findLevel } from './game/levels/index.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
if (DEBUG) document.body.classList.add('debug');

// ---------- Canvas e riquadro con proporzioni da smartphone orizzontale ----------
const frame = document.getElementById('frame');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const hud = document.getElementById('hud');
let pixelScale = 1;

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
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  pixelScale = canvas.width / VIEW_W;
}
window.addEventListener('resize', resize);
resize();
setupFullscreen({
  button: document.getElementById('fs-btn'),
  iosHint: document.getElementById('ios-hint'),
  onChange: resize,
});

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

// Miglior punteggio per livello (solo su questo dispositivo)
game.onEnd = (s) => {
  const best = store.get('xmas-best', {});
  const prev = best[game.level.id];
  if (!prev || s.score > prev.score) best[game.level.id] = { score: s.score, stars: s.stars };
  store.set('xmas-best', best);
};

const levelsEl = document.getElementById('levels');
function openLevels() {
  const best = store.get('xmas-best', {});
  const list = document.getElementById('level-list');
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
    const l = findLevel(btn.dataset.level);
    store.set('xmas-level', l.id);
    game.setLevel(l);
  }
  closeLevels();
});

attachInput(canvas, {
  down: (p) => game.pointerDown(p),
  move: (p) => game.pointerMove(p),
  up: (p) => game.pointerUp(p),
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

document.getElementById('controls').addEventListener('click', (e) => {
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
startLoop({
  update: (dt) => game.step(dt),
  render(alpha, elapsed, stats) {
    game.frame(elapsed);
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    drawScene(ctx, game, alpha);

    if (!DEBUG || (hudTimer += 1) % 15 !== 0) return;
    const c = game.pw.counts();
    hud.textContent =
      `FPS ${stats.fps} · fisica ${stats.physicsMs.toFixed(2)} ms · canvas ${canvas.width}×${canvas.height}\n` +
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
window.xmas = { game, wakeAll, stress, sim, fire, findShot };
