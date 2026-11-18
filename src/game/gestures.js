import { CAMERA, SLING, TRAJECTORY, VIEW_H, GESTURE } from '../config.js';
import { predictTrajectory } from '../physics/trajectory.js';

/**
 * Gesti (Pointer Events in coordinate logiche 1280×600) → azioni del gioco.
 * g.mode = gesto in corso: 'aim' (mira) | 'carry' (pacco trascinato dalla slitta) | 'pan' (sposta la vista).
 * @typedef {import('./game.js').Game} Game
 */

/** @param {Game} g */
export function pointerDown(g, p) {
  const w = g.camera.screenToWorld(p.x, p.y);
  g.panIdle = null;

  if (g.state === 'intro') {
    g.endIntro(); // tocco durante l'intro: si salta
    return;
  }
  if (g.state === 'end') {
    const b = g.buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (b?.action === 'retry') g.reset();
    if (b?.action === 'levels') g.onLevels?.();
    if (b?.action === 'next') g.onNext?.();
    return;
  }
  if (g.state === 'flight' || g.state === 'settle') {
    // Tocco durante il volo o l'assestamento: nessun effetto, si aspetta che il turno finisca
    g.mode = null;
    return;
  }
  if (g.state !== 'ready') return;

  // Tocco sulla fionda: se è vuota si arma da sola con il primo pacco della slitta.
  if (!g.sling.loaded && g.sleigh.count > 0 && g.sling.distance(w.x, w.y) <= SLING.grabRadius) {
    g.sling.arm(g.sleigh.take(g.sleigh.gifts[0]));
  }
  if (g.sling.tryGrab(w.x, w.y)) {
    startAim(g, w);
    return;
  }
  const gift = g.sleigh.hit(w.x, w.y);
  if (gift) {
    g.sleigh.take(gift);
    g.carry = { gift, x: w.x, y: w.y, sx: p.x, sy: p.y, moved: false, home: { x: gift.x, y: gift.y } };
    g.mode = 'carry';
    g.aimView();
    return;
  }
  g.mode = 'pan';
  g.panLast = p;
}

/** @param {Game} g */
export function pointerMove(g, p) {
  const w = g.camera.screenToWorld(p.x, p.y);
  if (g.mode === 'aim') {
    // La camera zooma mentre si tende: per la mira si usa la camera "congelata" a inizio gesto,
    // così la tensione dipende solo dal dito e non dallo zoom.
    const a = g.aimCam;
    g.sling.drag(p.x / a.ppm + a.x, (VIEW_H - p.y) / a.ppm + a.bottom);
    updateAim(g);
  } else if (g.mode === 'carry') {
    const c = g.carry;
    c.x = w.x;
    c.y = w.y;
    if (Math.hypot(p.x - c.sx, p.y - c.sy) > GESTURE.tapSlop) c.moved = true;
    // Arrivato sulla fionda: si arma e lo stesso gesto prosegue come mira.
    if (g.sling.distance(w.x, w.y) < SLING.armRadius) {
      const prev = g.sling.loaded ? g.sling.unload() : null;
      if (prev) g.sleigh.putBack(prev);
      g.sling.arm(c.gift);
      g.carry = null;
      startAim(g, w);
    }
  } else if (g.mode === 'pan') {
    g.camera.pan(-(p.x - g.panLast.x) / g.camera.ppm);
    g.panLast = p;
  }
}

/** @param {Game} g */
export function pointerUp(g) {
  if (g.mode === 'aim') {
    const shot = g.sling.release();
    g.trajectory = [];
    g.aimView();
    if (shot) g.launch(shot);
    else g.emit('annullato', {}); // tensione troppo bassa: il pacco resta sulla fionda
  } else if (g.mode === 'carry') {
    const c = g.carry;
    // Tap sul pacco, oppure rilascio vicino alla fionda → carica.
    if (!c.moved || g.sling.distance(c.x, c.y) < SLING.loadRadius) {
      const prev = g.sling.loaded ? g.sling.unload() : null;
      g.sling.load(c.gift, c.moved ? c.x : c.home.x, c.moved ? c.y : c.home.y);
      if (prev) g.sleigh.putBack(prev);
    } else {
      g.sleigh.putBack(c.gift);
    }
    g.carry = null;
  } else if (g.mode === 'pan') {
    g.panIdle = 0;
  }
  g.mode = null;
}

/** Inizio della mira (evento 'tensione'). */
function startAim(g, w) {
  const c = g.camera;
  g.aimCam = { ppm: c.ppm, x: c.x, bottom: c.bottom };
  // Corsa lunga: metri di dito (con la camera di inizio gesto) per arrivare alla tensione massima
  g.sling.reach = SLING.strokePx / c.ppm;
  g.mode = 'aim';
  g.sling.aiming = true;
  g.sling.drag(w.x, w.y);
  g.aimView();
  updateAim(g);
  g.emit('tensione', { tipo: g.sling.loaded?.type ?? null });
}

/** Traiettoria prevista e inquadratura durante la mira. */
function updateAim(g) {
  const s = g.sling;
  const v = s.velocity;
  // Quanta traiettoria si vede dipende dal livello ed è una distanza dalla fionda (`previewDist`, metri): non cresce
  // tirando più forte. Senza `previewDist` si vede l'arco intero (o la frazione `preview` dei vecchi livelli).
  const L = g.level;
  const steps = Math.round(TRAJECTORY.steps * (L.previewDist ? 1 : L.preview ?? 1));
  g.trajectory = predictTrajectory(s.loadX, s.loadY, v.vx, v.vy, steps, 0, L.bounds.maxX, L.previewDist ?? Infinity);
  // Mirando la slitta non serve più: il bordo sinistro si ferma poco dietro la fionda
  // (spazio per il pacco tirato indietro) e tutto il resto dell'inquadratura va verso destra;
  // tendendo l'elastico la camera si allarga ancora.
  // A tensione massima la vista arriva a `camera.aimMaxW` (se il livello lo indica): deve comprendere anche la
  // casa più lontana, altrimenti non si vede dove si mira. Senza, si allarga di CAMERA.pullZoomOut.
  const cam = g.level.camera;
  const w = cam.aimW + s.tension * (cam.aimMaxW ? Math.max(0, cam.aimMaxW - cam.aimW) : CAMERA.pullZoomOut);
  const left = s.x - SLING.maxPull - CAMERA.aimBehind;
  g.camera.setTarget(left + w / 2, w);
}
