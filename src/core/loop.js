import { PHYSICS_DT, MAX_SUBSTEPS, MAX_FPS } from '../config.js';

/**
 * Loop a timestep fisso con accumulatore.
 * update(dt) gira a 60 Hz esatti; render(alpha) riceve la frazione di step
 * residua per interpolare le posizioni tra lo stato precedente e quello attuale.
 */
export function startLoop({ update, render }) {
  let last = performance.now();
  let acc = 0;
  const stats = { fps: 0, physicsMs: 0, steps: 0, droppedTime: 0 };
  let frames = 0;
  let fpsTimer = 0;
  let physicsAcc = 0;

  const minFrameMs = 1000 / MAX_FPS - 2; // tolleranza per il jitter di rAF

  function frame(now) {
    // Schermi a 120 Hz: salta un frame su due (stessa fisica, metà lavoro di disegno).
    if (now - last < minFrameMs) {
      requestAnimationFrame(frame);
      return;
    }
    let elapsed = (now - last) / 1000;
    last = now;
    // Tab in background o pausa lunga: non recuperare il tempo perso.
    if (elapsed > 0.25) elapsed = 0.25;
    acc += elapsed;

    let steps = 0;
    const t0 = performance.now();
    while (acc >= PHYSICS_DT && steps < MAX_SUBSTEPS) {
      update(PHYSICS_DT);
      acc -= PHYSICS_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS && acc >= PHYSICS_DT) {
      // Il dispositivo non regge: scarta il ritardo invece di accumularlo (spirale della morte).
      stats.droppedTime += acc;
      acc = 0;
    }
    physicsAcc += performance.now() - t0;
    stats.steps = steps;

    render(acc / PHYSICS_DT, elapsed, stats);

    frames++;
    fpsTimer += elapsed;
    if (fpsTimer >= 0.5) {
      stats.fps = Math.round(frames / fpsTimer);
      stats.physicsMs = physicsAcc / frames;
      frames = 0;
      fpsTimer = 0;
      physicsAcc = 0;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return stats;
}
