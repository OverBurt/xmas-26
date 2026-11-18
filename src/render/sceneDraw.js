import { VIEW_H, VIEW_W, GFX, TURN } from '../config.js';
import { X, Y, S, setView, TAU, blit, resetAtlas } from './view.js';
import { quality } from './quality.js';
import { Backdrop } from './backdrop.js';
import { buildHills, drawHills, drawGround } from './terrainDraw.js';
import { buildHouseSprite, drawHouse } from './houseDraw.js';
import { buildTreeSprite, drawTree, buildPineSprite } from './treeDraw.js';
import { buildGiftSprites, drawGift, buildSleighSprite, drawSling, buildDecorSprites, drawSprites, resetSnowmanSprites } from './propsDraw.js';
import { drawBodies, resetBodySprites } from './bodiesDraw.js';
import { drawReindeer } from './reindeerDraw.js';
import { drawSnowfall, drawSmoke } from './weather.js';
import { drawWorldLabels, drawHud, drawIntroTitle, drawSummary, drawTrajectory, drawOffscreenArrow } from './hudDraw.js';

/**
 * Renderer della scena (M4, direzione "Notte di velluto"). Tutto è disegnato da codice in Canvas 2D:
 *  - lo sfondo in parallasse e ciò che non cambia (colline, case, pini, slitta, decorazioni, tronchi) stanno in
 *    sprite offscreen, costruiti una volta per livello e livello di qualità;
 *  - a ogni frame si disegnano gli sprite, il terreno nel tratto in vista, i corpi fisici, i cristalli,
 *    le particelle, la fionda, la traiettoria, il meteo e i testi.
 * Il disegno lavora in pixel logici (vedi `view.js`); solo le renne usano la trasformazione mondo della camera.
 */

/** Cache legata al livello e alla qualità (sfondo e sprite fissi). */
let fisso = null;
/** Debug prestazioni: `?salta=sfondo,terreno,pini,case,decor,alberi,renne,corpi,particelle,slitta,neve,testi` esclude parti del disegno. */
const SALTA = new Set((typeof location !== 'undefined' ? new URLSearchParams(location.search).get('salta') || '' : '').split(',').filter(Boolean));
const on = (k) => !SALTA.has(k);
/** Cache legata alla partita in corso (alberi: cambiano forma a ogni reset). */
let partita = null;

function costruisciFisso(game) {
  const tier = quality.tier;
  const ppm = tier.sprite;
  resetAtlas(); // sprite nuovi in un atlante nuovo
  buildGiftSprites(ppm);
  resetSnowmanSprites();
  resetBodySprites();
  const L = game.level;
  const sassi = L.stones || [];
  return {
    level: L,
    versione: quality.versione,
    backdrop: new Backdrop(L.bounds, tier, rifSfondo(game)),
    sassi,
    hills: buildHills(game.hills, sassi, ppm),
    houses: game.houses.map((h) => buildHouseSprite(h, ppm)),
    pines: game.pines.map((p, i) => buildPineSprite(p, i + 1, ppm)),
    decor: buildDecorSprites(L.decor, ppm),
    sleigh: buildSleighSprite(game.sleigh, ppm),
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx contesto già scalato alle coordinate logiche 1280×600
 * @param {object} [o] { debug: griglia metrica (solo con ?debug), hudTop: bordo inferiore dei pulsanti DOM (px logici) }
 */
export function drawScene(ctx, game, alpha, o = {}) {
  const { camera, pw, sling, sleigh } = game;
  if (!fisso || fisso.level !== game.level || fisso.versione !== quality.versione) {
    fisso = costruisciFisso(game);
    partita = null;
  }
  if (!partita || partita.pw !== pw) {
    partita = { pw, trees: game.trees.map((t) => buildTreeSprite(t, quality.tier.sprite)) };
  }
  const tier = quality.tier;
  const t = game.time || 0;

  // Sfondo in parallasse (coordinate schermo)
  if (on('sfondo')) {
    // il gufo guarda il pacco in volo, altrimenti il mouse o il dito (punto dello schermo)
    const g = game.current?.getPosition();
    const sguardo = g ? { x: (g.x - camera.x) * camera.ppm, y: VIEW_H - (g.y - camera.bottom) * camera.ppm } : o.puntatore;
    fisso.backdrop.draw(ctx, camera, t, sguardo);
  }
  else { ctx.fillStyle = '#0b1230'; ctx.fillRect(0, 0, 1280, 600); }

  // Da qui in poi: metri del mondo convertiti in pixel con la vista della camera
  setView(camera.ppm, camera.x, camera.bottom, VIEW_H);
  const left = camera.x;
  const right = camera.x + camera.viewW;

  if (o.debug) griglia(ctx, left, right, camera.bottom + camera.viewH);

  if (on('terreno')) {
    drawHills(ctx, fisso.hills);
    drawGround(ctx, left - 0.5, right + 0.5, fisso.sassi);
  }
  if (on('pini')) drawSprites(ctx, fisso.pines);
  if (on('case')) game.houses.forEach((h, i) => {
    drawHouse(ctx, h, fisso.houses[i]);
    if (tier.smoke && h.chimney && !h.def.snowCap) drawSmoke(ctx, h.chimney.top, t, i);
  });
  if (on('decor')) drawSprites(ctx, fisso.decor);
  if (on('alberi')) game.trees.forEach((tr, i) => drawTree(ctx, tr, partita.trees[i], t));

  // Renne: il loro modulo disegna in coordinate mondo
  if (on('renne') && game.reindeer.length) {
    ctx.save();
    camera.apply(ctx);
    for (const r of game.reindeer) drawReindeer(ctx, r, t);
    ctx.restore();
  }

  if (on('corpi')) drawBodies(ctx, pw, alpha, tier);
  if (on('particelle')) game.particles.draw(ctx);
  for (const p of game.puffs) drawPuff(ctx, p);

  // Slitta coi pacchi rimasti, fionda, pacco trascinato
  if (on('slitta')) blit(ctx, fisso.sleigh);
  for (const g of sleigh.gifts) drawGift(ctx, g.type, g.x, g.y);
  drawSling(ctx, sling);
  if (game.carry) {
    const c = game.carry;
    if (sling.distance(c.x, c.y) < 2) { // vicino alla fionda: anello che invita a lasciare il pacco
      ctx.strokeStyle = 'rgba(255,241,194,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(X(sling.x), Y(sling.y), S(0.6), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawGift(ctx, c.gift.type, c.x, c.y, 0, 1.1);
  }
  drawTrajectory(ctx, game.trajectory, camera.ppm);
  drawOffscreenArrow(ctx, game);

  if (on('neve')) drawSnowfall(ctx, camera, t, tier.snow);

  if (on('testi')) {
    drawWorldLabels(ctx, game);
    drawHud(ctx, game, o.hudTop);
  }
  if (game.state === 'intro' && game.intro) drawIntroTitle(ctx, game);
  if (game.state === 'end' && game.summary) drawSummary(ctx, game);
}

/** Griglia metrica di debug (solo con ?debug): una riga ogni metro. */
function griglia(ctx, left, right, top) {
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = 'rgba(160,175,240,0.16)';
  ctx.beginPath();
  for (let x = Math.floor(left); x <= right; x++) {
    ctx.moveTo(X(x), Y(0));
    ctx.lineTo(X(x), Y(top));
  }
  for (let y = 1; y <= top; y++) {
    ctx.moveTo(X(left), Y(y));
    ctx.lineTo(X(right), Y(y));
  }
  ctx.stroke();
}

/**
 * Riferimenti dello sfondo: l'inquadratura di mira del livello, la slitta e il punto da cui possono iniziare
 * le case del paese (oltre la chioma più a destra degli alberi, con un margine).
 */
function rifSfondo(game) {
  const cam = game.level.camera;
  const destra = cam.aimCenter + cam.aimW / 2; // contano solo gli alberi dentro l'inquadratura di mira
  const chiome = game.trees.filter((t) => t.base.x < destra).flatMap((t) => t.circles.map((c) => c.x + c.r));
  return {
    left: cam.aimCenter - cam.aimW / 2,
    ppm: VIEW_W / cam.aimW,
    slitta: game.sleigh.x + 0.3 + game.sleigh.bedW / 2, // centro del pianale (sleigh.x è il bordo sinistro)
    paeseDa: (chiome.length ? Math.max(...chiome) : game.sleigh.x) + GFX.paeseMargine,
  };
}

/**
 * Pacco non consegnato che svanisce: prima implode (si rimpicciolisce girando), poi una nuvoletta di sbuffi
 * bianchi si allarga dal centro, sale appena e si dissolve.
 */
function drawPuff(ctx, p) {
  if (p.t < TURN.puffImplode) {
    const k = 1 - p.t / TURN.puffImplode;
    drawGift(ctx, p.tipo, p.x, p.y, p.angle + (1 - k) * 2.5, k * k);
    return;
  }
  const u = Math.min(1, (p.t - TURN.puffImplode) / TURN.puffCloud); // 0..1
  const cresce = 1 - (1 - u) ** 3;
  ctx.save();
  ctx.globalAlpha = (1 - u) ** 1.5 * 0.9;
  ctx.fillStyle = '#ffffff';
  const sbuffi = [[0, 0, 0.3], [-1, 0.25, 0.22], [1, 0.2, 0.24], [-0.55, -0.6, 0.18], [0.6, -0.55, 0.2], [0.05, 0.8, 0.2], [-0.2, -0.15, 0.26]];
  for (const [dx, dy, r] of sbuffi) {
    ctx.beginPath();
    ctx.arc(X(p.x + dx * 0.42 * cresce), Y(p.y + dy * 0.42 * cresce + 0.25 * u), S(r * (0.5 + 0.7 * cresce) * (1 - u * 0.35)), 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(150,172,232,0.6)'; // qualche trattino che si allontana, come uno sbuffo da fumetto
  ctx.lineWidth = Math.max(1, S(0.04));
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    const r0 = 0.45 + 0.5 * cresce;
    ctx.beginPath();
    ctx.moveTo(X(p.x + Math.cos(a) * r0), Y(p.y + Math.sin(a) * r0));
    ctx.lineTo(X(p.x + Math.cos(a) * (r0 + 0.16)), Y(p.y + Math.sin(a) * (r0 + 0.16)));
    ctx.stroke();
  }
  ctx.restore();
}
