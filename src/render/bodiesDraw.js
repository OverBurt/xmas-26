import { GFX } from '../config.js';
import { X, Y, S, V, px, coppie, limiti, makeSprite, blitAt } from './view.js';
import { neve, cappello, ghiaccio } from './snow.js';
import { drawGift, snowmanSprite } from './propsDraw.js';

const C = GFX.colors;
/** Debug prestazioni: `?salta=snow,ice,snowman,gift,glass` esclude tipi di corpo dal disegno. */
const SALTA = new Set((typeof location !== 'undefined' ? new URLSearchParams(location.search).get('salta') || '' : '').split(',').filter(Boolean));
const lerp = (a, b, t) => a + (b - a) * t;

/** Sprite dei pezzi interi, per corpo: si liberano da soli quando il corpo sparisce. `gen` li invalida al cambio di qualità. */
let sprites = new WeakMap();
export function resetBodySprites() {
  sprites = new WeakMap();
}

const poligoni = (b) => {
  const out = [];
  for (let f = b.getFixtureList(); f; f = f.getNext()) {
    const sh = f.getShape();
    if (sh.getType() !== 'circle') out.push(coppie(sh.m_vertices));
  }
  return out;
};

/** Sprite di un pezzo di neve intero (blocco, spalla d'arco composta, cappello del camino, cumulo alla porta). */
function spriteNeve(b, ud, ppm) {
  const polys = poligoni(b);
  const [x0, y0, x1, y1] = limiti(polys.flat());
  const m = 0.1;
  const lid = ud.plug && polys.length === 1 && polys[0].length === 6; // cappello di neve sul camino
  const drift = ud.plug && polys.length === 1 && polys[0].length === 4; // cumulo contro la porta
  return makeSprite(x0 - m - (lid ? 0.1 : 0), y0 - m - (lid ? 0.25 : 0), x1 + m + (lid ? 0.1 : 0), y1 + m + (lid ? 0.1 : 0), ppm, (c) => {
    if (lid) {
      // stesso linguaggio dei tetti: forma unica, bombata sopra, festoni e colature sotto
      cappello(c, () => y1, x0, x1, { sp: y1 - y0, dome: 0.08, maxGoccia: 0.22, gocce: 0.22, seme: 5 });
    } else if (drift) {
      const ord = [...polys[0]].sort((p, q) => p[1] - q[1]);
      const [bl, br] = ord.slice(0, 2).sort((p, q) => p[0] - q[0]);
      const [tl, tr] = ord.slice(2).sort((p, q) => p[0] - q[0]);
      const trac = () => {
        c.beginPath();
        c.moveTo(X(bl[0]), Y(bl[1]));
        c.bezierCurveTo(X(bl[0] + 0.55), Y(bl[1] + 0.05), X(tl[0] - 0.4), Y(tl[1] - 0.02), X(tl[0] + 0.1), Y(tl[1] - 0.04));
        c.quadraticCurveTo(X((tl[0] + tr[0]) / 2), Y(tl[1] + 0.03), X(tr[0] - 0.05), Y(tr[1] - 0.1));
        c.quadraticCurveTo(X(tr[0]), Y(tr[1] - 0.2), X(br[0]), Y(br[1]));
        c.closePath();
      };
      trac();
      c.fillStyle = C.neveFascia;
      c.fill();
      c.save();
      c.clip();
      c.translate(-S(0.05), -S(0.13));
      trac();
      c.fillStyle = '#fff';
      c.fill();
      c.restore();
      trac();
      c.strokeStyle = C.neveLinea;
      c.lineWidth = Math.max(1.1, S(0.03));
      c.lineJoin = 'round';
      c.stroke();
    } else if (polys.length === 1) {
      neve(c, px(polys[0]), { densa: ud.dens > 1 ? 0.2 : 0 });
    } else {
      // pezzo composto (concavo, es. la spalla di un arco): i poligoni si fondono in una maschera unica,
      // così non restano fili tra un poligono e l'altro; poi contorno, ombra e bianco come per gli altri blocchi
      const P = polys.map(px);
      const [bx0, by0, bx1, by1] = limiti(P.flat());
      const W = c.canvas.width;
      const H = c.canvas.height;
      const trac = (k) => {
        k.beginPath();
        for (const q of P) {
          q.forEach((p, i) => (i ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1])));
          k.closePath();
        }
      };
      const tela = () => {
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        return [cv, cv.getContext('2d')];
      };
      const [mask, m] = tela();
      m.lineJoin = 'round';
      trac(m);
      m.fillStyle = '#fff';
      m.strokeStyle = '#fff';
      m.lineWidth = 2;
      m.fill();
      m.stroke();
      const tinta = (riemp, dx = 0, dy = 0) => { // la maschera (eventualmente spostata) riempita con un colore o una sfumatura
        const [cv, k] = tela();
        k.drawImage(mask, dx, dy);
        k.globalCompositeOperation = 'source-in';
        k.fillStyle = riemp;
        k.fillRect(0, 0, W, H);
        return [cv, k];
      };
      c.lineJoin = 'round';
      trac(c);
      c.strokeStyle = C.neveLinea;
      c.lineWidth = Math.max(2.2, S(0.06)) + 2;
      c.stroke();
      c.drawImage(tinta(C.neveOmbra)[0], 0, 0);
      const d = Math.max(2, S(0.075));
      const g = c.createLinearGradient(0, by0, 0, by1 + 1);
      g.addColorStop(0, C.neve);
      g.addColorStop(1, C.neve2);
      const [bianco, k] = tinta(g, -d * 0.7, -d);
      k.globalCompositeOperation = 'source-atop';
      if (ud.dens > 1) {
        k.globalAlpha = 0.2;
        k.fillStyle = C.neveDensa;
        k.fillRect(0, 0, W, H);
        k.globalAlpha = 1;
      }
      k.fillStyle = '#fff'; // riflesso in alto a sinistra
      k.beginPath();
      k.roundRect(bx0 + (bx1 - bx0) * 0.14 + d, by0 + d * 1.1, Math.min(S(0.34), (bx1 - bx0) * 0.3), Math.max(2, S(0.05)), 4);
      k.fill();
      k.globalCompositeOperation = 'destination-in';
      k.drawImage(mask, 0, 0);
      c.drawImage(bianco, 0, 0);
    }
  });
}
function spriteGhiaccio(b, ppm) {
  const P = poligoni(b)[0];
  const [x0, y0, x1, y1] = limiti(P);
  let alto = 0;
  P.forEach((p, i) => { if (p[1] > P[alto][1]) alto = i; });
  return makeSprite(x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2, ppm, (c) => ghiaccio(c, px(P), b.getUserData().prism || b.getUserData().crystal ? { luce: alto } : {}));
}

/** Tracciato di un poligono locale del corpo, col contesto già traslato e ruotato sul corpo. */
function locale(ctx, v, k) {
  ctx.beginPath();
  ctx.moveTo(v[0].x * k, -v[0].y * k);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x * k, -v[i].y * k);
  ctx.closePath();
}

/**
 * Tutti i corpi dinamici, interpolati tra due passi di fisica: neve (sprite per i pezzi interi, due riempimenti
 * per le zolle), ghiaccio traslucido, schegge di vetro, pupazzi, pacchi.
 */
export function drawBodies(ctx, pw, alpha, tier) {
  const k = V.ppm;
  const lw = Math.max(1, S(0.03));
  for (let b = pw.world.getBodyList(); b; b = b.getNext()) {
    const ud = b.getUserData();
    if (!ud || ud.pane || ud.dead) continue;
    const kind = ud.kind;
    if (kind !== 'snow' && kind !== 'ice' && kind !== 'glass' && kind !== 'gift' && kind !== 'snowman') continue;
    if (SALTA.has(kind)) continue;
    const p = b.getPosition();
    const prev = pw.prev.get(b);
    const x = prev ? lerp(prev.x, p.x, alpha) : p.x;
    const y = prev ? lerp(prev.y, p.y, alpha) : p.y;
    const a = prev ? lerp(prev.a, b.getAngle(), alpha) : b.getAngle();
    const fade = ud.life !== undefined && ud.life < 0.6 ? Math.max(0, ud.life / 0.6) : 1; // detriti che svaniscono
    if (fade < 1) ctx.globalAlpha = fade;

    if (kind === 'gift') {
      drawGift(ctx, ud.type, x, y, a);
    } else if (kind === 'snowman') {
      const co = Math.cos(a);
      const si = Math.sin(a);
      const parti = [];
      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const role = f.getUserData()?.role;
        if (role && role !== 'foot') parti.push([role, f.getShape()]);
      }
      parti.sort((q, r) => q[1].getCenter().y - r[1].getCenter().y); // dal basso: la testa (con la sciarpa) sopra
      for (const [role, sh] of parti) {
        const c = sh.getCenter();
        blitAt(ctx, snowmanSprite(role, sh.getRadius(), ud.deco?.scarf, tier.sprite), x + c.x * co - c.y * si, y + c.x * si + c.y * co, a);
      }
    } else if (kind === 'snow' && ud.ball) {
      blitAt(ctx, snowmanSprite(ud.role || 'base', ud.r, ud.deco?.scarf, tier.sprite), x, y, a);
    } else if ((kind === 'snow' || kind === 'ice') && ud.level === 0) {
      let sp = sprites.get(b);
      if (!sp) {
        sp = kind === 'snow' ? spriteNeve(b, ud, tier.sprite) : spriteGhiaccio(b, tier.sprite);
        sprites.set(b, sp);
      }
      blitAt(ctx, sp, x, y, a);
    } else {
      // frammenti: disegno diretto, senza cache (nascono a decine durante un crollo)
      ctx.save();
      ctx.translate(X(x), Y(y));
      ctx.rotate(-a);
      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const v = f.getShape().m_vertices;
        if (!v) continue;
        if (kind === 'snow') {
          // zolla tonda: ombra azzurra sotto, bianco rimpicciolito sopra, spigoli smussati dal contorno
          ctx.lineJoin = 'round';
          locale(ctx, v, k);
          ctx.fillStyle = C.neveOmbra;
          ctx.strokeStyle = C.neveLinea;
          ctx.lineWidth = lw * 2.2;
          ctx.stroke();
          ctx.fill();
          let cx = 0, cy = 0;
          for (const q of v) { cx += q.x / v.length; cy += q.y / v.length; }
          ctx.beginPath();
          for (let i = 0; i < v.length; i++) {
            const qx = (cx + (v[i].x - cx) * 0.8) * k - lw, qy = -(cy + (v[i].y - cy) * 0.8) * k - lw * 1.5;
            if (i) ctx.lineTo(qx, qy);
            else ctx.moveTo(qx, qy);
          }
          ctx.closePath();
          ctx.fillStyle = C.neve;
          ctx.strokeStyle = C.neve;
          ctx.lineWidth = lw * 2;
          ctx.stroke();
          ctx.fill();
        } else if (kind === 'ice') {
          locale(ctx, v, k);
          ctx.fillStyle = 'rgba(120,214,255,0.62)';
          ctx.fill();
          ctx.strokeStyle = C.ghiaccioBordo;
          ctx.lineWidth = lw * 1.2;
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; // riflesso: un tratto dal primo spigolo verso il centro
          ctx.beginPath();
          ctx.moveTo((v[0].x * 0.7 + v[1].x * 0.3) * k, -(v[0].y * 0.7 + v[1].y * 0.3) * k);
          ctx.lineTo((v[v.length - 1].x * 0.6 + v[1].x * 0.4) * k, -(v[v.length - 1].y * 0.6 + v[1].y * 0.4) * k);
          ctx.stroke();
        } else {
          locale(ctx, v, k);
          ctx.fillStyle = 'rgba(201,243,255,0.7)';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = lw;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (fade < 1) ctx.globalAlpha = 1;
  }
}
