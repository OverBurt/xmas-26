import { VIEW_W, VIEW_H, GIFTS } from '../config.js';
import { WALL } from '../entities/house.js';
import { centroid } from '../physics/polygon.js';
import { drawTree, drawPine } from './treeDraw.js';
import { drawReindeer } from './reindeerDraw.js';

const ZONE_LABEL_OFFSET = 0.9;

function fillPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Renderer provvisorio (M1): forme semplici e leggibili sopra la griglia di debug.
 * L'ambientazione vera (cielo, parallasse, case disegnate) arriva in M4.
 */
export function drawScene(ctx, game, alpha) {
  const { camera, pw, sling, sleigh } = game;

  ctx.fillStyle = '#0b1230';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  camera.apply(ctx);
  const px = 1 / camera.ppm; // 1 px logico in metri
  const left = camera.x;
  const right = camera.x + camera.viewW;
  const top = camera.bottom + camera.viewH;

  // Griglia ogni metro
  ctx.lineWidth = px * 0.75;
  ctx.strokeStyle = 'rgba(120,140,220,0.10)';
  ctx.beginPath();
  for (let x = Math.floor(left); x <= right; x++) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, top);
  }
  for (let y = 1; y <= top; y++) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();

  // Terreno
  ctx.fillStyle = '#dfe8ff';
  ctx.fillRect(left - 1, camera.bottom - 1, camera.viewW + 2, -camera.bottom + 1);

  // Interni delle case (stanza calda dietro le aperture)
  // Colline innevate (stesso colore del terreno)
  ctx.fillStyle = '#dfe8ff';
  for (const hl of game.hills) fillPoly(ctx, hl.poly);

  for (const h of game.houses) drawHouse(ctx, h);
  for (const p of game.pines) drawPine(ctx, p, px);
  for (const t of game.trees) drawTree(ctx, t, px);
  for (const r of game.reindeer) drawReindeer(ctx, r, game.time || 0);

  // Corpi fisici (statici e dinamici), interpolati
  for (let b = pw.world.getBodyList(); b; b = b.getNext()) {
    const ud = b.getUserData();
    if (!ud || ud.kind === 'ground' || ud.kind === 'house' || ud.kind === 'tree' || ud.kind === 'pine' || ud.kind === 'reindeer' || ud.kind === 'hill') continue;
    const p = b.getPosition();
    const prev = pw.prev.get(b);
    const x = prev ? lerp(prev.x, p.x, alpha) : p.x;
    const y = prev ? lerp(prev.y, p.y, alpha) : p.y;
    const a = prev ? lerp(prev.a, b.getAngle(), alpha) : b.getAngle();

    if (ud.kind === 'ice') {
      // cristalli più luminosi delle lastre
      ctx.fillStyle = ud.crystal || ud.prism ? 'rgba(170,235,255,0.6)' : 'rgba(140,210,255,0.4)';
      ctx.strokeStyle = ud.crystal ? '#f0fcff' : '#bfe8ff';
    } else if (ud.kind === 'gift') {
      ctx.fillStyle = GIFTS[ud.type].color;
      ctx.strokeStyle = '#fff';
    } else if (ud.kind === 'house') {
      ctx.fillStyle = 'rgba(255,190,120,0.18)';
      ctx.strokeStyle = '#ffbe78';
    } else if (ud.kind === 'glass') {
      ctx.fillStyle = 'rgba(200,240,255,0.45)';
      ctx.strokeStyle = '#effbff';
    } else if (ud.kind === 'snow' || ud.kind === 'snowman') {
      ctx.fillStyle = '#eef4ff';
      ctx.strokeStyle = '#b9cbe8';
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    // Detriti che stanno per svanire
    if (ud.life !== undefined && ud.life < 0.6) ctx.globalAlpha = Math.max(0, ud.life / 0.6);
    const soft = ud.kind === 'snow' || ud.kind === 'snowman';
    ctx.lineWidth = (soft ? 2.5 : 1.5) * px;
    ctx.lineJoin = 'round';
    const fill = ctx.fillStyle;
    const stroke = ctx.strokeStyle;
    for (let f = b.getFixtureList(); f; f = f.getNext()) {
      const sh = f.getShape();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      const role = f.getUserData()?.role;
      if (role === 'foot') continue; // base piatta del pupazzo: nascosta dalla palla
      ctx.beginPath();
      if (sh.getType() === 'circle') {
        const c = sh.getCenter();
        ctx.arc(c.x, c.y, sh.getRadius(), 0, Math.PI * 2);
      } else {
        const v = sh.m_vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      if (role) drawSnowmanPart(ctx, role, sh.getCenter(), sh.getRadius(), ud.deco, px);
      // Prismi di ghiaccio: faccetta interna (il contorno rimpicciolito) come in una gemma
      if (ud.prism && sh.m_vertices) {
        const v = sh.m_vertices;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        v.forEach((q, i) => (i ? ctx.lineTo(q.x * 0.55, q.y * 0.55) : ctx.moveTo(q.x * 0.55, q.y * 0.55)));
        ctx.closePath();
        for (const q of v) {
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x * 0.55, q.y * 0.55);
        }
        ctx.stroke();
        ctx.strokeStyle = stroke;
      }
      // Cristallo: spigolo centrale chiaro dalla base alla punta (sfaccettatura)
      if (ud.crystal && sh.m_vertices?.length === 5) {
        const v = sh.m_vertices;
        let tip = v[0];
        for (const q of v) if (q.y > tip.y) tip = q;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.moveTo((v[0].x + v[1].x) / 2, Math.min(...v.map((q) => q.y)));
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        ctx.strokeStyle = stroke;
      }
    }
    if (ud.ball && ud.role) drawSnowmanPart(ctx, ud.role, { x: 0, y: 0 }, ud.r, ud.deco, px);
    if (ud.kind === 'gift') drawRibbon(ctx, GIFTS[ud.type], px);
    ctx.restore();
  }

  // Aperture: bagliore alla consegna
  for (const h of game.houses) {
    for (const z of h.zones) {
      if (z.glow <= 0) continue;
      ctx.fillStyle = `rgba(255,211,107,${Math.min(1, z.glow) * 0.6})`;
      fillPoly(ctx, z.poly);
    }
  }

  game.particles.draw(ctx);

  // Slitta e pacchi sopra
  drawSleigh(ctx, sleigh, px);
  for (const g of sleigh.gifts) drawGift(ctx, g.type, g.x, g.y, px);

  // Fionda: braccio posteriore, elastico dietro, pacco, elastico davanti, braccio anteriore
  const lx = sling.loadX;
  const ly = sling.loadY;
  const forkL = { x: sling.x - 0.35, y: sling.y + 0.15 };
  const forkR = { x: sling.x + 0.35, y: sling.y + 0.15 };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a5f36';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(sling.x, 0);
  ctx.lineTo(sling.x, sling.y - 0.6);
  ctx.lineTo(forkR.x, forkR.y);
  ctx.stroke();

  const band = sling.loaded && !sling.loadAnim;
  ctx.strokeStyle = '#d0453a';
  ctx.lineWidth = 0.08;
  if (band) {
    ctx.beginPath();
    ctx.moveTo(forkR.x, forkR.y);
    ctx.lineTo(lx, ly);
    ctx.stroke();
  }
  if (sling.loaded) drawGift(ctx, sling.loaded.type, lx, ly, px);
  ctx.beginPath();
  if (band) {
    ctx.moveTo(lx, ly);
    ctx.lineTo(forkL.x, forkL.y);
  } else {
    ctx.moveTo(forkR.x, forkR.y);
    ctx.lineTo(forkL.x, forkL.y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#a8794a';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(sling.x, sling.y - 0.6);
  ctx.lineTo(forkL.x, forkL.y);
  ctx.stroke();

  // Pacco trascinato
  if (game.carry) {
    const c = game.carry;
    const near = sling.distance(c.x, c.y) < 2;
    if (near) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(sling.x, sling.y, 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawGift(ctx, c.gift.type, c.x, c.y, px, 1.1);
  }

  // Anteprima traiettoria: puntini che si diradano
  const t = game.trajectory;
  if (t.length) {
    const n = t.length / 2;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - i / n)})`;
      ctx.beginPath();
      ctx.arc(t[i * 2], t[i * 2 + 1], 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pacco sopra il bordo della vista: freccia sul bordo superiore
  if (game.current) {
    const p = game.current.getPosition();
    if (p.y > top - 0.3) {
      const s = 0.35 * camera.viewW / 24;
      ctx.fillStyle = GIFTS[game.current.getUserData().type].color;
      ctx.beginPath();
      ctx.moveTo(p.x, top - 0.15 * s);
      ctx.lineTo(p.x - s, top - 1.4 * s);
      ctx.lineTo(p.x + s, top - 1.4 * s);
      ctx.fill();
    }
  }

  ctx.restore();

  drawWorldLabels(ctx, game);
  drawHud(ctx, game);
  if (game.state === 'intro' && game.intro) drawIntroTitle(ctx, game);
  if (game.state === 'end' && game.summary) drawSummary(ctx, game);
}

/** Valori delle aperture e punti fluttuanti, in coordinate schermo (testo sempre nitido). */
function drawWorldLabels(ctx, game) {
  const cam = game.camera;
  const sx = (x) => (x - cam.x) * cam.ppm;
  const sy = (y) => VIEW_H - (y - cam.bottom) * cam.ppm;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 14px system-ui, sans-serif';
  for (const h of game.houses) {
    for (const z of h.zones) {
      ctx.fillStyle = 'rgba(255,211,107,0.85)';
      if (z.type === 'chimney') ctx.fillText(z.points, sx(h.chimney.top.x), sy(h.chimney.top.y + 0.6));
      else {
        const c = centroid(z.poly);
        ctx.fillText(z.points, sx(c.x - WALL - ZONE_LABEL_OFFSET), sy(c.y));
      }
    }
  }
  for (const f of game.floaters) {
    const a = f.t < 1.2 ? 1 : 1 - (f.t - 1.2) / 0.6;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `800 ${f.big ? 40 : 30}px system-ui, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3a1d00';
    ctx.strokeText(f.text, sx(f.x), sy(f.y));
    ctx.fillStyle = f.bad ? '#ff7a7a' : '#ffd36b'; // punti tolti in rosso
    ctx.fillText(f.text, sx(f.x), sy(f.y));
  }
  ctx.restore();
}

/** Nome del livello al centro mentre la camera mostra le case (dissolvenza in entrata e uscita). */
function drawIntroTitle(ctx, game) {
  const t = game.intro.t;
  const a = Math.min(1, t / 0.3) * Math.min(1, Math.max(0, (1.9 - t) / 0.6)); // sparisce mentre la camera si allarga
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 52px system-ui, sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(5,8,26,0.6)';
  const [title, sub] = game.level.name.split(' · ');
  ctx.strokeText(title, VIEW_W / 2, VIEW_H * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, VIEW_W / 2, VIEW_H * 0.3);
  if (sub) {
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(sub, VIEW_W / 2, VIEW_H * 0.3 + 46);
  }
  ctx.restore();
}

function drawSummary(ctx, game) {
  const s = game.summary;
  const w = 520;
  const h = 360;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2 - 10;
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,26,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#16204d';
  ctx.strokeStyle = '#3c4a8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 24);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillText(s.allServed ? 'Tutte le case servite!' : `Case servite: ${s.served} su ${s.houses}`, VIEW_W / 2, y + 24);

  // Stelle
  for (let i = 0; i < 3; i++) {
    drawStar(ctx, VIEW_W / 2 + (i - 1) * 62, y + 98, i < s.stars ? 24 : 22, i < s.stars);
  }

  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillStyle = '#ffd36b';
  ctx.fillText(s.score.toLocaleString('it-IT'), VIEW_W / 2, y + 134);

  ctx.font = '500 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const lines = [
    `Consegne: ${s.delivered} su ${s.thrown} lanci  ·  ${s.deliveryScore}`,
    s.crystals ? `Neve e cristalli: ${s.ice} + ${s.crystals}  ·  ${s.iceScore + s.crystalScore}` : `Neve rotta: ${s.ice}  ·  ${s.iceScore}`,
  ];
  if (s.bonus) lines.push(`Tutte le case servite  ·  +${s.bonus}`);
  if (s.penalty) lines.push(`Renne spaventate: ${s.reindeerHits}  ·  −${s.penalty}`);
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, y + 190 + i * 26));

  for (const b of game.buttons) {
    ctx.fillStyle = b.secondary ? '#2c3a7a' : '#ff6f61';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, on) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? '#ffd36b' : 'rgba(255,255,255,0.12)';
  ctx.fill();
}

/**
 * Casa provvisoria (M3): stanza calda, condotto del camino scuro, muri/tetto/camino pieni.
 * Il tetto copre la parte del condotto che affonda nella falda.
 */
function drawHouse(ctx, h) {
  ctx.fillStyle = 'rgba(255,170,90,0.16)';
  fillPoly(ctx, h.interior);
  const flue = h.zones.find((z) => z.type === 'chimney');
  if (flue) {
    ctx.fillStyle = '#140c18';
    fillPoly(ctx, flue.poly);
  }
  ctx.fillStyle = '#6a4458';
  for (let f = h.body.getFixtureList(); f; f = f.getNext()) fillPoly(ctx, f.getShape().m_vertices);
}

/** Dettagli del pupazzo disegnati sulla palla (ruotano con lei quando rotola). */
function drawSnowmanPart(ctx, role, c, r, deco, px) {
  if (!deco) return;
  const f = deco.facing; // -1: guarda verso la fionda
  if (role === 'head') {
    ctx.fillStyle = '#1d1d28';
    for (const ex of [-0.32, 0.18]) {
      ctx.beginPath();
      ctx.arc(c.x + ex * r * -f, c.y + r * 0.22, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    // Naso a carota
    ctx.fillStyle = '#f08a24';
    ctx.beginPath();
    ctx.moveTo(c.x + f * r * 0.15, c.y + r * 0.05);
    ctx.lineTo(c.x + f * r * 1.05, c.y - r * 0.05);
    ctx.lineTo(c.x + f * r * 0.15, c.y - r * 0.15);
    ctx.fill();
    // Sciarpa sotto la testa
    ctx.fillStyle = deco.scarf;
    ctx.fillRect(c.x - r * 0.85, c.y - r * 1.0, r * 1.7, r * 0.26);
    ctx.fillRect(c.x - f * r * 0.55, c.y - r * 1.55, r * 0.26, r * 0.6);
  } else if (role === 'mid') {
    ctx.fillStyle = '#1d1d28';
    for (const by of [0.35, 0, -0.35]) {
      ctx.beginPath();
      ctx.arc(c.x + f * r * 0.15, c.y + by * r, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGift(ctx, type, x, y, px, scale = 1) {
  const d = GIFTS[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = d.color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5 * px;
  ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
  ctx.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
  drawRibbon(ctx, d, px);
  ctx.restore();
}

function drawRibbon(ctx, d, px) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const r = Math.min(d.w, d.h) * 0.14;
  ctx.fillRect(-r / 2, -d.h / 2, r, d.h);
  ctx.fillRect(-d.w / 2, -r / 2, d.w, r);
}

function drawSleigh(ctx, s, px) {
  const x0 = s.x;
  const x1 = s.x + s.bedW + 0.6;
  const y = s.bedY;
  ctx.lineWidth = 2 * px;
  // Pattino con la punta arricciata
  ctx.strokeStyle = '#ffd36b';
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  ctx.moveTo(x0, 0.08);
  ctx.lineTo(x1, 0.08);
  ctx.quadraticCurveTo(x1 + 0.6, 0.1, x1 + 0.5, 0.6);
  ctx.quadraticCurveTo(x1 + 0.4, 0.9, x1 + 0.15, 0.75);
  ctx.stroke();
  // Montanti
  ctx.beginPath();
  ctx.moveTo(x0 + 0.5, 0.08);
  ctx.lineTo(x0 + 0.5, y - 0.2);
  ctx.moveTo(x1 - 0.5, 0.08);
  ctx.lineTo(x1 - 0.5, y - 0.2);
  ctx.stroke();
  // Cassone
  ctx.fillStyle = '#b8323a';
  ctx.beginPath();
  ctx.moveTo(x0 - 0.1, y);
  ctx.lineTo(x1 + 0.1, y);
  ctx.lineTo(x1 + 0.25, y - 0.45);
  ctx.lineTo(x0, y - 0.45);
  ctx.quadraticCurveTo(x0 - 0.35, y - 0.2, x0 - 0.1, y);
  ctx.fill();
}

function drawHud(ctx, game) {
  ctx.save();
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Pacchi: ${game.giftsLeft}   ·   Punti: ${game.score}`, 20, 18);
  ctx.save();
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(game.level.name, VIEW_W - 22, 84); // sotto i pulsanti
  ctx.restore();

  let hint = '';
  if (game.state === 'ready') {
    if (game.sling.loaded) hint = 'Tira indietro il pacco e rilascia';
    else hint = 'Trascina un pacco sulla fionda e tira indietro, o tira direttamente dalla fionda';
  } else if (game.state === 'settle') hint = 'Tocca per continuare';
  else if (game.state === 'intro') hint = 'Tocca per saltare';

  if (hint) {
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(hint, 20, 48);
  }
  ctx.restore();
}
