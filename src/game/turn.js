import { CAMERA, TURN, VIEW_W, VIEW_H } from '../config.js';
import { launchGift } from '../entities/gift.js';
import { summarize } from './scoring.js';

/**
 * Stati del turno (g.state) e passaggi tra uno e l'altro:
 *  intro  → regia d'apertura (intro.js), un tocco la salta
 *  ready  → in attesa: si prende un pacco dalla slitta, lo si carica, si mira (gestures.js)
 *  flight → pacco in volo, la camera lo segue
 *  settle → il pacco è fermo/uscito, si aspetta che la scena si assesti
 *  end    → pacchi finiti: riepilogo
 * @typedef {import('./game.js').Game} Game
 */

/** Lancio di un pacco: shot = {gift, x, y, vx, vy}. Evento 'lancio'. */
export function launch(g, shot) {
  const body = launchGift(g.pw, shot.gift.type, shot.x, shot.y, shot.vx, shot.vy);
  g.thrown.push(body);
  g.current = body;
  g.stats.shots++;
  g.stats.maxImpulse = 0;
  g.deliveredThisTurn = false;
  g.setState('flight');
  g.camera.setTarget(g.camera.cx, CAMERA.flightViewW, 2.5);
  g.camera.followViewW = CAMERA.flightViewW;
  g.camera.follow = () => {
    if (!g.current) return null;
    const p = g.current.getPosition();
    const v = g.current.getLinearVelocity();
    return { x: p.x, y: p.y, vx: v.x, vy: v.y };
  };
  g.emit('lancio', { tipo: shot.gift.type, x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, velocita: Math.hypot(shot.vx, shot.vy) });
}

/** I pacchi lanciati sono fermi (o usciti/consegnati)? Oltre TURN.maxGiftWait si va avanti comunque. */
export function giftsResting(g) {
  if (g.stateTime > TURN.maxGiftWait) return true;
  return g.thrown.every((b) => b.getLinearVelocity().length() < TURN.stopSpeed);
}

export function nextTurn(g) {
  // L'ultimo pacco deve essere fermo prima del riepilogo: una consegna tardiva deve contare.
  if (g.giftsLeft === 0 && !giftsResting(g)) return;
  g.current = null;
  svanisci(g);
  // Il livello termina solo quando non ci sono più pacchi da lanciare.
  if (g.giftsLeft === 0) {
    endLevel(g);
  } else {
    g.setState('ready');
    g.aimView();
  }
}

/**
 * I pacchi non consegnati, ormai fermi, implodono in una nuvoletta che si dissolve (disegno: sceneDraw.js):
 * il corpo viene tolto dal mondo (siamo dopo lo step, non in una callback). Evento 'svanito' per ogni pacco.
 */
function svanisci(g) {
  for (const b of g.thrown) {
    const p = b.getPosition();
    const tipo = b.getUserData().type;
    g.puffs.push({ x: p.x, y: p.y, angle: b.getAngle(), tipo, t: 0 });
    g.pw.destroyBody(b);
    g.emit('svanito', { tipo, x: p.x, y: p.y });
  }
  g.thrown = [];
}

/** Fine del livello: riepilogo, pulsanti del pannello, panoramica. Evento 'fine' (dati = riepilogo). */
export function endLevel(g) {
  g.summary = summarize(g);
  // Pulsanti in basso nel pannello (coordinate logiche)
  const by = VIEW_H / 2 + 136; // sotto il dettaglio del pannello "Buone Feste" (hudDraw.drawSummary)
  g.buttons = [
    { action: 'levels', label: 'Livelli', x: VIEW_W / 2 - 230, y: by, w: 210, h: 56, secondary: true },
    { action: 'retry', label: 'Riprova', x: VIEW_W / 2 + 20, y: by, w: 210, h: 56 },
  ];
  g.setState('end');
  const b = g.level.bounds;
  g.camera.follow = null;
  g.camera.setTarget((b.minX + b.maxX) / 2, b.maxX - b.minX, 2);
  g.emit('fine', g.summary);
}

/** Passaggi di stato a ogni step fisico: fine del volo, fine dell'assestamento. */
export function updateTurn(g) {
  if (g.state === 'flight') {
    const gift = g.current;
    const stopped = !gift || (g.stateTime > TURN.minFlight && gift.getLinearVelocity().length() < TURN.stopSpeed);
    if (stopped || g.stateTime > TURN.maxFlight) {
      g.camera.follow = null;
      g.setState('settle');
    }
  } else if (g.state === 'settle') {
    // Dopo una consegna la camera resta un attimo sulla casa per godersi i punti.
    const minSettle = g.deliveredThisTurn ? TURN.deliveryLinger : 0;
    const calm = g.pw.counts().awake === 0 || g.stateTime > TURN.maxSettle;
    // Scena ferma: i pacchi non consegnati svaniscono subito, poi si resta ancora TURN.afterPause a guardare
    // prima di tornare all'inquadratura di mira (o al riepilogo).
    if (g.fermoDa === null && g.stateTime > minSettle && calm && giftsResting(g)) {
      g.fermoDa = g.stateTime;
      svanisci(g);
    }
    if (g.fermoDa !== null && g.stateTime - g.fermoDa >= TURN.afterPause) nextTurn(g);
  }
}
