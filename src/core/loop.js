import { PHYSICS_DT, MAX_SUBSTEPS, MAX_FPS } from '../config.js';

/** Aggiornamenti consecutivi necessari per cambiare il divisore N (isteresi contro la frequenza variabile). */
const CAMBIO_N = 30;

/**
 * Loop a timestep fisso con accumulatore.
 * update(dt) gira a 60 Hz esatti; render(alpha) riceve la frazione di step
 * residua per interpolare le posizioni tra lo stato precedente e quello attuale.
 *
 * Tetto ai FPS (MAX_FPS) senza scatti: si disegna un aggiornamento dello schermo ogni N, con N intero
 * = il più grande per cui frequenza/N ≥ MAX_FPS. Così la cadenza resta regolare:
 *   60 Hz → 60 FPS · 90 Hz → 90 · 120 Hz → 60 · 144 Hz → 72 · 240 Hz → 60.
 * (Il vecchio filtro "salta se sono passati meno di 1/MAX_FPS" su 90/144 Hz scartava frame in modo
 * irregolare e dava 45/48 FPS. Un accumulatore che puntasse a 60 esatti su 90 Hz alternerebbe
 * 1 e 2 aggiornamenti per frame: 60 FPS medi ma a scatti, peggio di 90 regolari.)
 * La frequenza dello schermo si stima dagli intervalli tra le chiamate di requestAnimationFrame;
 * il tempo dall'ultimo disegno è accumulato e si disegna quando arriva a N periodi (meno mezzo periodo
 * di tolleranza), quindi un aggiornamento perso dal browser non sfasa la cadenza.
 */
export function startLoop({ update, render }) {
  let last = performance.now(); // ultimo frame disegnato
  let lastTick = last; // ultima chiamata di rAF (disegnata o no)
  let acc = 0;
  const stats = { fps: 0, physicsMs: 0, steps: 0, droppedTime: 0, hz: 60, every: 1 };
  let frames = 0;
  let fpsTimer = 0;
  let physicsAcc = 0;
  let period = 1000 / 60; // stima del periodo dello schermo (ms), media mobile
  let every = 1; // aggiornamenti dello schermo per ogni frame disegnato
  let conferme = 0; // aggiornamenti consecutivi con una stima di N diversa da quella in uso

  function frame(now) {
    const tick = now - lastTick;
    lastTick = now;
    // Media mobile degli intervalli plausibili (fuori i salti per tab in background o caricamenti)
    if (tick > 3 && tick < 50) period += (tick - period) * 0.1;
    // Frame dello schermo per ogni frame disegnato (0.15 di tolleranza: 119.6 Hz conta come 120).
    // Isteresi: su schermi a frequenza variabile (es. ~112 Hz) la stima oscilla e N salterebbe tra 1 e 2;
    // N cambia solo se il nuovo valore resta lo stesso per CAMBIO_N aggiornamenti di fila.
    const proposta = Math.max(1, Math.floor(1000 / period / MAX_FPS + 0.15));
    if (proposta !== every) {
      if (++conferme >= CAMBIO_N) {
        every = proposta;
        conferme = 0;
      }
    } else conferme = 0;
    if (now - last < every * period - period / 2) {
      requestAnimationFrame(frame);
      return;
    }
    let elapsed = (now - last) / 1000;
    last = now;
    stats.every = every;
    stats.hz = Math.round(1000 / period);
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
