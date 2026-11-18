import { CAMERA, INTRO, VIEW_W, VIEW_H } from '../config.js';
import { easeInOut } from '../core/ease.js';

/**
 * Regia d'apertura del livello: zoom sulle case → panoramica su tutto lo stage →
 * zoom sulla zona di lancio (slitta e fionda). Un tocco la salta.
 * @param {import('./game.js').Game} g
 */
export function startIntro(g) {
  const cam = g.camera;
  const L = g.level;
  // Inquadratura delle case: larga quanto basta per contenerle tutte, camini compresi
  let x0 = Infinity;
  let x1 = -Infinity;
  let top = 0;
  for (const h of g.houses) {
    const d = h.def;
    x0 = Math.min(x0, d.x - 1.5);
    x1 = Math.max(x1, d.x + d.w + 1.5);
    top = Math.max(top, (d.y || 0) + d.h + d.roof + (d.chimney?.h || 0) + 1);
  }
  const fitW = (w, topY) => Math.max(w, ((topY - CAMERA.bottom) * VIEW_W) / VIEW_H);
  const houses = { cx: (x0 + x1) / 2, w: fitW(x1 - x0, top) };
  const pano = { cx: (L.bounds.minX + L.bounds.maxX) / 2, w: L.bounds.maxX - L.bounds.minX };
  const aim = { cx: L.camera.aimCenter, w: L.camera.aimW };
  // Un unico movimento continuo: curva (Bézier quadratica) che parte dalle case,
  // si allarga passando vicino alla panoramica senza fermarsi e arriva sulla zona di lancio.
  g.intro = { t: 0, from: houses, via: pano, to: aim, duration: INTRO.duration };
  cam.follow = null;
  cam.cx = houses.cx;
  cam.viewW = houses.w;
  cam.clamp();
  g.setState('intro');
}

/** Avanza la regia; a fine intro si passa allo stato "ready". */
export function updateIntro(g, dt) {
  const it = g.intro;
  it.t += dt;
  if (it.t >= it.duration) {
    endIntro(g);
    return;
  }
  const k = easeInOut(it.t / it.duration);
  const bez = (a, b, c) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * b + k * k * c;
  g.camera.cx = bez(it.from.cx, it.via.cx, it.to.cx);
  g.camera.viewW = bez(it.from.w, it.via.w, it.to.w);
  g.camera.clamp();
}

export function endIntro(g) {
  g.intro = null;
  g.setState('ready');
  g.aimView();
  // se l'intro è stata saltata la camera raggiunge la fionda con il suo inseguimento morbido
}
