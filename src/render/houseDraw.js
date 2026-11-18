import { GFX } from '../config.js';
import { WALL, EAVE, CHIMNEY_WALL, PANE } from '../entities/house.js';
import { X, Y, S, TAU, px, tracciato, limiti, spess, stella5, makeSprite, blit } from './view.js';
import { cappello } from './snow.js';

const C = GFX.colors;
const FONT = GFX.font;
const MURO = WALL;

/**
 * Geometria della casa per il disegno, ricavata dalla definizione del livello con le stesse formule di
 * `entities/house.js` (i poligoni fisici non cambiano: qui servono solo i punti per disegnarci sopra).
 */
function geoCasa(d) {
  const g = d.y || 0;
  const { x, w, h, roof, lean = 0 } = d;
  const xl = (y) => x + (lean * y) / h;
  const xr = (y) => x + w - (lean * y) / h;
  const P = (a, b) => [a, g + b];
  const varchi = [];
  if (d.door) varchi.push({ t: 'porta', y0: 0, y1: d.door.h });
  for (const win of d.windows || []) varchi.push({ t: 'finestra', y0: win.y, y1: win.y + win.h });
  varchi.sort((a, b) => a.y0 - b.y0);
  const lq = (y0, y1, a = 0, b = MURO) => [P(xl(y0) + a, y0), P(xl(y0) + b, y0), P(xl(y1) + b, y1), P(xl(y1) + a, y1)];
  const muri = [];
  let y = 0;
  for (const q of varchi) {
    if (q.y0 > y + 0.01) muri.push(lq(y, q.y0));
    y = q.y1;
  }
  if (h > y + 0.01) muri.push(lq(y, h));
  const eL = P(xl(h) - EAVE, h);
  const eR = P(xr(h) + EAVE, h);
  const ap = P((xl(h) + xr(h)) / 2, h + roof);
  const G = {
    d, g, xl, xr, P, varchi, lq, muri, eL, eR, ap,
    destro: [P(xr(0) - MURO, 0), P(xr(0), 0), P(xr(h), h), P(xr(h) - MURO, h)],
    interno: [P(xl(0) + MURO, 0), P(xr(0) - MURO, 0), P(xr(h) - MURO, h), P(xl(h) + MURO, h)],
  };
  const ch = d.chimney;
  if (ch) {
    const t = ch.pos ?? 0.35;
    const base = [eL[0] + (ap[0] - eL[0]) * t, eL[1] + (ap[1] - eL[1]) * t];
    const a = ((ch.tilt ?? 0) * Math.PI) / 180;
    const co = Math.cos(a);
    const si = Math.sin(a);
    const T = (lx, ly) => [base[0] + lx * co - ly * si, base[1] + lx * si + ly * co];
    const bw = ch.bottom / 2;
    const tw = ch.top / 2;
    Object.assign(G, { T, bw, tw, H: ch.h, CW: CHIMNEY_WALL, canna: [T(-bw, -1), T(bw, -1), T(tw, ch.h), T(-tw, ch.h)] });
  }
  return G;
}

/** Disegno della casa (parte fissa) dentro il suo sprite: tutto tranne vetri, neve fisica, bagliori e fumo. */
function casa(c, G) {
  const { d, g, xl, xr } = G, L = spess();
  const stile = d.stile || 'baita';
  const K = { ...C, ...(C.stiliCasa?.[stile] || {}) }; // tavolozza della casa (config: GFX.colors.stiliCasa)
  c.lineJoin = 'round'; c.lineCap = 'round';
  // 1. alone di luce da porta e finestra
  for (const q of G.varchi) {
    const xa = X(xl((q.y0 + q.y1) / 2)), ya = Y(g + (q.y0 + q.y1) / 2), rr = S(2.6);
    const gr = c.createRadialGradient(xa, ya, 2, xa, ya, rr); gr.addColorStop(0, 'rgba(255,196,110,0.42)'); gr.addColorStop(1, 'rgba(255,196,110,0)');
    c.save(); c.beginPath(); c.rect(xa - rr, Y(g + d.h + 3), rr + S(0.2), S(d.h + 3)); c.clip(); c.fillStyle = gr; c.fillRect(xa - rr, ya - rr, rr * 2, rr * 2); c.restore();
  }
  // 2. interno. Baita: tre locali (soggiorno sotto; cameretta e stanza del gatto sopra). Casetta: due (cucina sotto,
  //    soffitta sopra). Solaio e tramezzo sono solo disegno.
  c.save(); tracciato(c, px(G.interno)); c.clip();
  {
    const x0 = d.x, yS = g + (d.door ? d.door.h : d.h * 0.48) + 0.14, yF = yS + 0.13, yT = g + d.h, xm = d.x + d.w * 0.48, Lf = Math.max(1, L * 0.8), legno = '#7d4b3c';
    const B = (x, y, w, h, r, col) => { c.beginPath(); c.roundRect(X(x), Y(y + h), S(w), S(h), S(r)); c.fillStyle = col; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke(); };
    const E = (x, y, rx, ry, col, rot = 0) => { c.beginPath(); c.ellipse(X(x), Y(y), S(rx), S(ry), rot, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke(); };
    const fx = X(xr(0) - MURO - 1.0), fy = Y(g + 0.5), gi = c.createRadialGradient(fx, fy, 6, fx, fy, S(6.5));
    gi.addColorStop(0, K.interno[0]); gi.addColorStop(0.5, K.interno[1]); gi.addColorStop(1, K.interno[2]);
    c.fillStyle = gi; c.fillRect(X(x0), Y(yT), S(d.w), S(d.h));
    if (stile === 'casetta') arredaCasetta({ c, G, d, g, x0, yS, yF, yT, B, E, Lf, legno });
    else {
    c.fillStyle = 'rgba(255,240,190,0.5)'; c.fillRect(X(x0), Y(yT), S(xm - x0), S(yT - yS)); // cameretta: parete chiara
    c.fillStyle = 'rgba(226,120,120,0.34)'; c.fillRect(X(xm), Y(yT), S(d.w), S(yT - yS)); // stanza del gatto: parete rosata
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = S(0.09); for (let x = x0 + 0.75; x < xm; x += 0.42) { c.beginPath(); c.moveTo(X(x), Y(yT)); c.lineTo(X(x), Y(yF)); c.stroke(); } // righe
    c.fillStyle = 'rgba(255,255,255,0.2)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(X(xm + 0.3 + (i % 5) * 0.55 + (Math.floor(i / 5) % 2) * 0.27), Y(yF + 0.35 + Math.floor(i / 5) * 0.55), S(0.07), 0, TAU); c.fill(); } // pois

    // ── soggiorno
    E(x0 + 3.3, g + 0.14, 1.05, 0.09, '#cf5566');
    const cx0 = xr(0) - MURO - 1.6; // caminetto
    B(cx0, g + 0.08, 1.4, 1.16, 0.26, '#96524f'); B(cx0 - 0.13, g + 1.2, 1.66, 0.19, 0.09, '#b86c5c');
    c.fillStyle = '#2a0f18'; c.beginPath(); c.roundRect(X(cx0 + 0.23), Y(g + 0.98), S(0.94), S(0.9), [S(0.45), S(0.45), 0, 0]); c.fill();
    for (const [dx, hh, col] of [[0.5, 0.62, '#ff8a3c'], [0.9, 0.5, '#ff8a3c'], [0.7, 0.42, '#ffe28a']]) { c.fillStyle = col; c.beginPath(); c.moveTo(X(cx0 + dx - 0.17), Y(g + 0.1)); c.quadraticCurveTo(X(cx0 + dx - 0.24), Y(g + 0.1 + hh * 0.55), X(cx0 + dx + 0.04), Y(g + 0.1 + hh)); c.quadraticCurveTo(X(cx0 + dx + 0.2), Y(g + 0.1 + hh * 0.5), X(cx0 + dx + 0.17), Y(g + 0.1)); c.fill(); }
    for (const [dx, col] of [[0.3, '#e03a45'], [1.1, '#35c4a8']]) { B(cx0 + dx - 0.08, g + 0.86, 0.16, 0.36, 0.05, col); E(cx0 + dx - 0.13, g + 0.86, 0.14, 0.09, col); } // calze
    const px0 = x0 + 2.62; // poltrona panciuta, girata verso il fuoco
    B(px0, g + 0.1, 0.4, 1.25, 0.2, '#278f7d'); B(px0 + 0.12, g + 0.1, 1.0, 0.56, 0.22, '#35b39c'); E(px0 + 1.0, g + 0.74, 0.2, 0.15, '#278f7d'); E(px0 + 0.62, g + 0.72, 0.3, 0.12, '#ffe6a8', -0.1);
    const ax = x0 + 1.72; // alberello con la stella e i regali sotto
    B(ax - 0.08, g + 0.1, 0.16, 0.3, 0.03, legno);
    for (let i = 0; i < 3; i++) { const yb = g + 0.34 + i * 0.44, hw = 0.66 - i * 0.16; c.beginPath(); c.moveTo(X(ax), Y(yb + 0.75)); c.quadraticCurveTo(X(ax + hw * 0.5), Y(yb + 0.2), X(ax + hw), Y(yb)); c.quadraticCurveTo(X(ax), Y(yb - 0.14), X(ax - hw), Y(yb)); c.quadraticCurveTo(X(ax - hw * 0.5), Y(yb + 0.2), X(ax), Y(yb + 0.75)); c.fillStyle = '#2c8a66'; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke(); }
    [[-0.3, 0.52, '#ffe28a'], [0.24, 0.64, '#ff6f61'], [-0.1, 1.0, '#ff6f61'], [0.14, 1.22, '#ffe28a'], [-0.02, 1.56, '#8fe9ff']].forEach(([dx, dy, col]) => { c.fillStyle = col; c.beginPath(); c.arc(X(ax + dx), Y(g + dy), Math.max(1.7, S(0.07)), 0, TAU); c.fill(); });
    c.fillStyle = '#fff2b8'; stella5(c, X(ax), Y(g + 1.98), S(0.17)); c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke();
    for (const [dx, w, h, col, nas] of [[-0.86, 0.4, 0.34, C.pacchi.standard[0], '#ffe08a'], [0.5, 0.34, 0.27, C.pacchi.small[0], '#fff'], [0.92, 0.26, 0.4, C.pacchi.big[0], '#d8344a']]) { B(ax + dx, g + 0.1, w, h, 0.05, col); c.fillStyle = nas; c.fillRect(X(ax + dx + w / 2 - 0.04), Y(g + 0.1 + h), S(0.08), S(h)); }
    for (let i = 0; i < 10; i++) { const u = (i + 0.5) / 10, wd = d.w - 2 * (d.lean * (yS - g)) / d.h - 2 * MURO - 0.3; c.fillStyle = ['#ffe28a', '#ff8a7a', '#8ff0d2'][i % 3]; c.beginPath(); c.arc(X(xl(yS - g) + MURO + 0.15 + u * wd), Y(yS - 0.16 - 0.09 * Math.sin(u * Math.PI * 5)), Math.max(1.6, S(0.06)), 0, TAU); c.fill(); } // lucine

    // ── cameretta: letto col piumone a stelle, chi dorme, quadretto, tenda alla finestra
    const lx0 = x0 + 1.18;
    B(lx0, yF, 1.62, 0.3, 0.08, '#a0704c'); B(lx0 + 1.5, yF, 0.17, 1.0, 0.08, '#a0704c');
    E(lx0 + 1.2, yF + 0.5, 0.27, 0.14, '#fff6dc', -0.15); E(lx0 + 1.14, yF + 0.68, 0.17, 0.15, '#f4cba2');
    c.fillStyle = '#6b3f2a'; c.beginPath(); c.arc(X(lx0 + 1.17), Y(yF + 0.72), S(0.17), Math.PI * 1.05, Math.PI * 2.05); c.fill();
    c.beginPath(); c.moveTo(X(lx0 - 0.06), Y(yF + 0.22)); c.bezierCurveTo(X(lx0 - 0.05), Y(yF + 0.85), X(lx0 + 0.4), Y(yF + 0.72), X(lx0 + 0.5), Y(yF + 0.62)); c.bezierCurveTo(X(lx0 + 0.65), Y(yF + 0.84), X(lx0 + 0.98), Y(yF + 0.8), X(lx0 + 1.04), Y(yF + 0.48)); c.lineTo(X(lx0 + 1.04), Y(yF + 0.22)); c.closePath();
    c.fillStyle = '#5c82dc'; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke();
    c.fillStyle = '#ffe28a'; for (const [dx, dy] of [[0.2, 0.5], [0.55, 0.42], [0.82, 0.58]]) { stella5(c, X(lx0 + dx), Y(yF + dy), S(0.08)); c.fill(); }
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${Math.max(7, S(0.26))}px ${FONT}`; c.fillText('z', X(lx0 + 0.86), Y(yF + 1.06)); c.font = `700 ${Math.max(9, S(0.36))}px ${FONT}`; c.fillText('Z', X(lx0 + 0.6), Y(yF + 1.36));
    B(lx0 + 0.02, yF + 1.12, 0.36, 0.3, 0.04, C.oro); c.fillStyle = '#35508f'; c.fillRect(X(lx0 + 0.08), Y(yF + 1.36), S(0.24), S(0.18)); c.fillStyle = '#fff'; c.beginPath(); c.arc(X(lx0 + 0.26), Y(yF + 1.3), S(0.04), 0, TAU); c.fill();
    const fin = G.varchi.find((q) => q.t === 'finestra') || { y0: d.h * 0.55, y1: d.h * 0.92 }, wx = (yy) => xl(yy) + MURO; // tenda: drappo raccolto, dentro la stanza
    c.beginPath(); c.moveTo(X(wx(fin.y1) - 0.05), Y(g + fin.y1 + 0.04)); c.lineTo(X(wx(fin.y1) + 0.62), Y(g + fin.y1 + 0.04)); c.bezierCurveTo(X(wx(fin.y1) + 0.58), Y(g + fin.y1 - 0.5), X(wx(fin.y0) + 0.3), Y(g + fin.y0 + 0.85), X(wx(fin.y0) + 0.1), Y(g + fin.y0 + 0.55)); c.quadraticCurveTo(X(wx(fin.y0) + 0.34), Y(g + fin.y0 + 0.25), X(wx(fin.y0) + 0.3), Y(g + fin.y0 + 0.02)); c.lineTo(X(wx(fin.y0) - 0.05), Y(g + fin.y0 + 0.02)); c.closePath();
    c.fillStyle = '#e25d6e'; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke();
    E(wx(fin.y0) + 0.12, g + fin.y0 + 0.55, 0.07, 0.07, C.oro);

    // ── stanza del gatto: tappeto, gatto rosso con la coda a ricciolo, lampada a campana, pianta
    E(xm + 1.0, yF + 0.04, 0.8, 0.07, '#35c4a8');
    const gx = xm + 0.78, pelo = '#f28c3a';
    c.beginPath(); c.moveTo(X(gx + 0.25), Y(yF + 0.2)); c.bezierCurveTo(X(gx + 0.85), Y(yF + 0.1), X(gx + 0.95), Y(yF + 0.85), X(gx + 0.6), Y(yF + 0.8)); c.strokeStyle = C.contorno; c.lineWidth = S(0.15) + Lf * 2; c.lineCap = 'round'; c.stroke(); c.strokeStyle = pelo; c.lineWidth = S(0.15); c.stroke();
    E(gx, yF + 0.38, 0.33, 0.36, pelo); E(gx - 0.04, yF + 0.3, 0.17, 0.22, '#ffe6c4');
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(X(gx - 0.04 + s * 0.22), Y(yF + 0.92)); c.lineTo(X(gx - 0.04 + s * 0.2), Y(yF + 1.2)); c.lineTo(X(gx - 0.04 + s * 0.04), Y(yF + 1.02)); c.closePath(); c.fillStyle = pelo; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke(); }
    E(gx - 0.04, yF + 0.86, 0.27, 0.22, pelo);
    c.fillStyle = '#1b1b2a'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(X(gx - 0.04 + s * 0.11), Y(yF + 0.89), Math.max(1, S(0.035)), Math.max(1.4, S(0.055)), 0, 0, TAU); c.fill(); }
    c.fillStyle = '#ff8fa0'; c.beginPath(); c.arc(X(gx - 0.04), Y(yF + 0.8), Math.max(1, S(0.035)), 0, TAU); c.fill();
    const lx = xm + 1.72, ly = yT - 0.48; // lampada
    c.strokeStyle = C.contorno; c.lineWidth = Lf; c.beginPath(); c.moveTo(X(lx), Y(yT)); c.lineTo(X(lx), Y(ly)); c.stroke();
    c.fillStyle = 'rgba(255,246,196,0.45)'; c.beginPath(); c.arc(X(lx), Y(ly - 0.3), S(0.42), 0, TAU); c.fill();
    c.beginPath(); c.moveTo(X(lx - 0.34), Y(ly - 0.3)); c.quadraticCurveTo(X(lx - 0.3), Y(ly + 0.06), X(lx), Y(ly + 0.06)); c.quadraticCurveTo(X(lx + 0.3), Y(ly + 0.06), X(lx + 0.34), Y(ly - 0.3)); c.closePath(); c.fillStyle = '#ff6f61'; c.fill(); c.stroke();
    E(lx, ly - 0.34, 0.13, 0.1, '#fff6c4');
    const vx = xr(yF - g) - MURO - 0.55; // pianta nel vaso
    for (const [dx, dy, rot] of [[-0.16, 0.62, -0.6], [0.14, 0.66, 0.5], [0, 0.8, 0]]) E(vx + dx, yF + dy, 0.11, 0.26, '#2c8a66', rot);
    B(vx - 0.17, yF, 0.34, 0.36, 0.08, '#c8694e');

    // ── solaio e tramezzo (solo grafica): travi tonde appena incurvate
    const trave = (trac, w) => { trac(); c.lineCap = 'butt'; c.strokeStyle = C.contorno; c.lineWidth = S(w) + Lf * 2; c.stroke(); c.strokeStyle = legno; c.lineWidth = S(w); c.stroke(); };
    trave(() => { c.beginPath(); c.moveTo(X(xm + 0.03), Y(yS)); c.quadraticCurveTo(X(xm + 0.14), Y((yS + yT) / 2), X(xm - 0.03), Y(yT)); }, 0.15);
    trave(() => { c.beginPath(); c.moveTo(X(x0), Y(yS + 0.05)); c.bezierCurveTo(X(x0 + d.w * 0.3), Y(yS - 0.01), X(x0 + d.w * 0.7), Y(yS + 0.11), X(x0 + d.w), Y(yS + 0.05)); }, 0.16);
    trave(() => { c.beginPath(); c.moveTo(X(x0), Y(g + 0.04)); c.lineTo(X(x0 + d.w), Y(g + 0.04)); }, 0.12);
    }
  }
  c.restore();
  // 3. camino a imbuto, storto e panciuto
  const camino = () => {
    if (!G.T) return;
    tracciato(c, px(G.canna)); c.fillStyle = '#160b1a'; c.fill();
    const b = G.T(0, -0.6), t = G.T(0, G.H), gc = c.createLinearGradient(X(b[0]), Y(b[1]), X(t[0]), Y(t[1]));
    gc.addColorStop(0, 'rgba(255,166,74,0.9)'); gc.addColorStop(0.75, 'rgba(255,166,74,0.1)'); gc.addColorStop(1, 'rgba(255,166,74,0)'); c.fillStyle = gc; c.fill();
    const TX = (lx, ly) => { const p = G.T(lx, ly); return [X(p[0]), Y(p[1])]; };
    for (const sg of [-1, 1]) {
      // parete: faccia interna dritta (è quella che conta per la consegna), faccia esterna panciuta in basso e stretta in vita
      const ib = TX(sg * G.bw, -1), it = TX(sg * G.tw, G.H), et = TX(sg * (G.tw + G.CW), G.H), eb = TX(sg * (G.bw + G.CW), -1);
      const c1 = TX(sg * (G.tw + G.CW - 0.2), G.H * 0.62), c2 = TX(sg * (G.bw + G.CW + 0.34), G.H * 0.2);
      const P = [ib, it, et, eb], [, y0, , y1] = limiti(P), gm = c.createLinearGradient(0, y0, 0, y1); gm.addColorStop(0, K.camino); gm.addColorStop(1, K.camino2);
      c.beginPath(); c.moveTo(...ib); c.lineTo(...it); c.lineTo(...et); c.bezierCurveTo(...c1, ...c2, ...eb); c.closePath();
      c.fillStyle = gm; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
      c.strokeStyle = 'rgba(60,20,40,0.5)'; c.lineWidth = Math.max(1, S(0.025)); // corsi di mattoni ad arco
      for (const v of [0.2, 0.55, 0.9]) { const k = (v + 1) / (G.H + 1), xi = sg * (G.bw + (G.tw - G.bw) * k), p = TX(xi, v), q = TX(xi + sg * G.CW, v - 0.03), m = TX(xi + sg * G.CW * 0.5, v + 0.05); c.beginPath(); c.moveTo(...p); c.quadraticCurveTo(...m, ...q); c.stroke(); }
      // orlo grosso, a salsicciotto ricurvo
      const o1 = TX(sg * (G.tw + G.CW / 2) - 0.13, G.H - 0.05), o2 = TX(sg * (G.tw + G.CW / 2), G.H + 0.05), o3 = TX(sg * (G.tw + G.CW / 2) + 0.13, G.H - 0.05);
      c.beginPath(); c.moveTo(...o1); c.quadraticCurveTo(...o2, ...o3); c.strokeStyle = C.contorno; c.lineWidth = S(0.2) + L * 2; c.stroke(); c.strokeStyle = K.camino; c.lineWidth = S(0.2); c.stroke();
    }
  };
  camino();
  // 4. muri: faccia esterna appena panciuta (entro 8 cm dal poligono), faccia interna morbida verso la stanza
  for (const m of [...G.muri, G.destro]) {
    const P = px(m), [, y0, , y1] = limiti(P), gm = c.createLinearGradient(0, y0, 0, y1); gm.addColorStop(0, K.muro); gm.addColorStop(1, K.muro2);
    const dx = m === G.destro, sg = dx ? 1 : -1, [eb, ib, it, et] = dx ? [P[1], P[0], P[3], P[2]] : P; // esterno/interno, basso/alto
    const alt = Math.abs(ib[1] - it[1]), dentro = Math.min(S(0.15), alt * 0.2) * -sg, fuori = Math.min(S(0.07), alt * 0.12) * sg, my = (eb[1] + et[1]) / 2;
    c.beginPath(); c.moveTo(eb[0], eb[1]); c.lineTo(ib[0], ib[1]); c.quadraticCurveTo((ib[0] + it[0]) / 2 + dentro * 2, (ib[1] + it[1]) / 2, it[0], it[1]); c.lineTo(et[0], et[1]);
    if (dx) c.bezierCurveTo(et[0] + (eb[0] - et[0]) * 0.33 + fuori * 2.2, et[1] + (eb[1] - et[1]) * 0.33, et[0] + (eb[0] - et[0]) * 0.66 - fuori * 1.2, et[1] + (eb[1] - et[1]) * 0.66, eb[0] + fuori * 1.3, eb[1]);
    else c.quadraticCurveTo((eb[0] + et[0]) / 2 + fuori * 2, my, eb[0], eb[1]);
    c.closePath(); c.fillStyle = gm; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
    c.strokeStyle = 'rgba(255,220,230,0.3)'; c.lineWidth = Math.max(1, S(0.035)); c.beginPath(); c.moveTo(eb[0] - sg * S(0.09), eb[1] - S(0.14)); c.quadraticCurveTo((eb[0] + et[0]) / 2 - sg * S(0.06), my, et[0] - sg * S(0.09), et[1] + S(0.14)); c.stroke();
  }
  // 5. tetto: falde appena incurvate, colmo tondo, orlo a festoni; tutto dentro il triangolo fisico
  const a = G.eL, b = G.ap, e = G.eR, k = 0.1;
  const tetto = () => {
    c.beginPath(); c.moveTo(X(a[0]), Y(a[1]));
    c.quadraticCurveTo(X((a[0] + b[0]) / 2 + k), Y((a[1] + b[1]) / 2 - k), X(b[0] - 0.14), Y(b[1] - 0.16));
    c.quadraticCurveTo(X(b[0]), Y(b[1]), X(b[0] + 0.14), Y(b[1] - 0.16));
    c.quadraticCurveTo(X((e[0] + b[0]) / 2 - k), Y((e[1] + b[1]) / 2 - k), X(e[0]), Y(e[1]));
    const n = 7, w = (e[0] - a[0]) / n;
    for (let i = 0; i < n; i++) c.quadraticCurveTo(X(e[0] - (i + 0.5) * w), Y(a[1] + 0.26), X(e[0] - (i + 1) * w), Y(a[1]));
    c.closePath();
  };
  const tri = px([a, e, b]), gt = c.createLinearGradient(0, tri[2][1], 0, tri[0][1]); gt.addColorStop(0, K.tetto); gt.addColorStop(1, K.tetto2);
  tetto(); c.fillStyle = gt; c.fill();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(20,6,40,0.45)'; c.lineWidth = Math.max(1, S(0.03));
  if (stile === 'casetta') { // tegole a file: righe orizzontali appena curve e giunti sfalsati
    for (let r = 0; r < 8; r++) {
      const yy = a[1] + 0.42 + r * 0.38;
      c.beginPath(); c.moveTo(X(a[0]), Y(yy)); c.quadraticCurveTo(X((a[0] + e[0]) / 2), Y(yy - 0.05), X(e[0]), Y(yy)); c.stroke();
      for (let x = a[0] + (r % 2) * 0.22; x < e[0]; x += 0.44) { c.beginPath(); c.moveTo(X(x), Y(yy)); c.lineTo(X(x), Y(yy - 0.3)); c.stroke(); }
    }
  } else for (let r = 0; r < 5; r++) for (let x = a[0] + (r % 2) * 0.3; x < e[0]; x += 0.6) { c.beginPath(); c.arc(X(x + 0.3), Y(a[1] + 0.55 + r * 0.42), S(0.3), 0.15, Math.PI - 0.15); c.stroke(); } // scandole a squame
  c.restore();
  tetto(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
  // Cappello di neve: una forma unica che segue le falde. Sopra è bombato e sta ~10 cm oltre la falda fisica, deborda di 14 cm
  // oltre le gronde; sotto ha festoni irregolari e colature di lunghezze diverse (corte vicino alle gronde). Solo disegno.
  const mF = (b[1] - a[1]) / (b[0] - a[0]), rA = 0.3, tettoY = (x) => b[1] - mF * (Math.sqrt((x - b[0]) ** 2 + rA * rA) - rA * 0.6);
  const bordo = (x) => Math.min(1, Math.min(x - a[0] + 0.14, e[0] + 0.14 - x) / 1.1);
  cappello(c, tettoY, a[0] - 0.14, e[0] + 0.14, { sp: (x) => 0.34 + 0.3 * bordo(x), seme: Math.round(d.x * 3) + 2, maxGoccia: 0.5, gocce: 0.3, corte: (x) => Math.abs(x - b[0]) < 0.6 || bordo(x) < 0.85 });
  const wx = X(b[0]), wy = Y(a[1] + d.roof * 0.36), wr = S(0.36);
  if (stile === 'casetta') { // oblò illuminato sul timpano, con la crociera
    const r = S(0.34);
    c.beginPath(); c.arc(wx, wy, r, 0, TAU); c.fillStyle = '#ffd98a'; c.fill();
    c.strokeStyle = C.contorno; c.lineWidth = S(0.13) + L * 2; c.stroke(); c.strokeStyle = C.telaio; c.lineWidth = S(0.13); c.stroke();
    c.strokeStyle = C.telaio; c.lineWidth = Math.max(1.5, S(0.05)); c.beginPath(); c.moveTo(wx - r, wy); c.lineTo(wx + r, wy); c.moveTo(wx, wy - r); c.lineTo(wx, wy + r); c.stroke();
  } else { // ghirlanda sul timpano
    c.strokeStyle = C.contorno; c.lineWidth = S(0.2) + L * 2; c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.stroke();
    c.strokeStyle = '#2f8f6d'; c.lineWidth = S(0.2); c.stroke();
    c.fillStyle = '#ff6f61'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(wx + s * S(0.14), wy + wr, S(0.15), S(0.09), s * 0.5, 0, TAU); c.fill(); }
    c.fillStyle = '#ffe28a'; for (const an of [0.6, 2.2, 3.9, 5.4]) { c.beginPath(); c.arc(wx + Math.cos(an) * wr, wy + Math.sin(an) * wr, Math.max(1.5, S(0.05)), 0, TAU); c.fill(); }
  }
  // parte del camino sopra la falda, ridisegnata sopra il tetto e sopra la neve
  if (G.T) {
    const nx = -(b[1] - a[1]), ny = b[0] - a[0];
    c.save(); tracciato(c, px([a, b, [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]])); c.clip(); camino(); c.restore();
    // orli innevati del camino aperto (quello tappato ha il suo cappello di neve, che è un corpo fisico)
    if (!d.snowCap) for (const sg of [-1, 1]) { const p = G.T(sg * (G.tw + G.CW / 2), G.H + 0.1), q = G.T(sg * (G.tw + G.CW / 2) + 0.2, G.H + 0.1), ml = (q[1] - p[1]) / (q[0] - p[0]); cappello(c, (x) => p[1] + (x - p[0]) * ml, p[0] - 0.21, p[0] + 0.21, { sp: 0.12, dome: 0.11, maxGoccia: 0.2, gocce: 0.4, seme: sg + 3 }); }
  }
  // 6. telai a cuscinetto di porta e finestre, con la neve sugli architravi (i vetri si disegnano a ogni frame)
  G.varchi.forEach((q, i) => {
    for (const yy of q.t === 'porta' ? [q.y1 + 0.08] : [q.y0 - 0.09, q.y1 + 0.08]) {
      c.beginPath(); c.roundRect(X(xl(yy) - 0.14), Y(g + yy + 0.085), S(MURO + 0.24), S(0.17), S(0.085)); c.fillStyle = C.telaio; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = L; c.stroke();
      if (yy > q.y1) cappello(c, () => g + yy + 0.17, xl(yy) - 0.18, xl(yy) + MURO + 0.12, { sp: 0.08, dome: 0.1, maxGoccia: 0.2, gocce: 0.3, seme: i + 11 });
    }
  });
}

/**
 * Arredamento della casetta (due locali), solo disegno dentro il clip dell'interno:
 *  - cucina: piastrelle, stufa smaltata con il fuoco e la pentola che fuma, tavola con la tovaglia a quadretti e la
 *    torta con la candelina, mensola con i barattoli, il cane che dorme sotto la tavola;
 *  - soffitta: carta a righe, libreria, sedia a dondolo con il gomitolo, lampada a stella appesa, tenda alla finestra.
 */
function arredaCasetta({ c, G, d, g, x0, yS, yF, yT, B, E, Lf, legno }) {
  const dx = (yy) => G.xr(yy - g) - MURO; // bordo interno destro
  // pareti: piastrelle in cucina, carta da parati azzurrina a righe in soffitta
  c.fillStyle = 'rgba(255,255,255,0.16)';
  for (let r = 0; r < 4; r++) for (let x = x0 + (r % 2) * 0.17; x < x0 + d.w; x += 0.34) c.fillRect(X(x), Y(g + 0.32 + r * 0.24), S(0.15), S(0.15));
  c.fillStyle = 'rgba(120,180,255,0.2)'; c.fillRect(X(x0), Y(yT), S(d.w), S(yT - yS));
  c.strokeStyle = 'rgba(255,255,255,0.24)'; c.lineWidth = S(0.07);
  for (let x = x0 + 0.5; x < x0 + d.w; x += 0.36) { c.beginPath(); c.moveTo(X(x), Y(yT)); c.lineTo(X(x), Y(yF)); c.stroke(); }

  // ── cucina
  E(x0 + d.w * 0.5, g + 0.12, 1.1, 0.08, '#e0a43a'); // tappeto
  const xs = dx(g) - 1.05; // stufa smaltata
  B(xs, g + 0.08, 0.9, 0.86, 0.14, '#3f74c4'); B(xs - 0.06, g + 0.92, 1.02, 0.1, 0.04, '#2a3f6e');
  c.fillStyle = '#2a0f18'; c.beginPath(); c.roundRect(X(xs + 0.2), Y(g + 0.66), S(0.5), S(0.36), S(0.08)); c.fill();
  c.fillStyle = '#ff9a3c'; c.beginPath(); c.roundRect(X(xs + 0.26), Y(g + 0.6), S(0.38), S(0.24), S(0.06)); c.fill();
  c.fillStyle = '#ffe28a'; c.beginPath(); c.roundRect(X(xs + 0.36), Y(g + 0.52), S(0.18), S(0.14), S(0.05)); c.fill();
  B(xs + 0.2, g + 1.02, 0.52, 0.34, 0.1, '#d84b4b'); B(xs + 0.15, g + 1.34, 0.62, 0.07, 0.03, '#b53a3a'); E(xs + 0.46, g + 1.45, 0.07, 0.05, '#b53a3a'); // pentola
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = S(0.05); c.lineCap = 'round'; // vapore
  for (const o of [0, 0.22]) { c.beginPath(); c.moveTo(X(xs + 0.34 + o), Y(g + 1.55)); c.bezierCurveTo(X(xs + 0.22 + o), Y(g + 1.7), X(xs + 0.48 + o), Y(g + 1.8), X(xs + 0.32 + o), Y(g + 1.96)); c.stroke(); }
  const xt = x0 + d.w * 0.3; // tavola con la tovaglia a quadretti
  B(xt + 0.08, g + 0.08, 0.08, 0.66, 0.03, legno); B(xt + 1.04, g + 0.08, 0.08, 0.66, 0.03, legno);
  // il cane che dorme sotto la tavola (acciambellato, orecchio giù, coda a ricciolo)
  const cx = xt + 0.6, pelo = '#c27c3e';
  c.beginPath(); c.moveTo(X(cx + 0.28), Y(g + 0.2)); c.quadraticCurveTo(X(cx + 0.48), Y(g + 0.3), X(cx + 0.36), Y(g + 0.42)); c.strokeStyle = C.contorno; c.lineWidth = S(0.09) + Lf * 2; c.stroke(); c.strokeStyle = pelo; c.lineWidth = S(0.09); c.stroke();
  E(cx, g + 0.25, 0.34, 0.18, pelo); E(cx - 0.27, g + 0.27, 0.16, 0.13, pelo); E(cx - 0.4, g + 0.23, 0.07, 0.05, '#3a2418');
  E(cx - 0.22, g + 0.33, 0.07, 0.12, '#7a4a26', 0.5);
  c.strokeStyle = C.contorno; c.lineWidth = Lf; c.beginPath(); c.arc(X(cx - 0.31), Y(g + 0.31), S(0.04), 0.2, Math.PI - 0.2); c.stroke(); // occhio chiuso
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${Math.max(7, S(0.22))}px ${FONT}`; c.fillText('z', X(cx - 0.05), Y(g + 0.6));
  c.beginPath(); c.moveTo(X(xt - 0.06), Y(g + 0.82)); c.lineTo(X(xt + 1.26), Y(g + 0.82)); c.lineTo(X(xt + 1.2), Y(g + 0.52)); c.quadraticCurveTo(X(xt + 0.6), Y(g + 0.46), X(xt), Y(g + 0.52)); c.closePath();
  c.fillStyle = '#f4f1ea'; c.fill(); c.save(); c.clip(); c.fillStyle = 'rgba(214,60,70,0.7)';
  for (let i = 0; i < 7; i++) c.fillRect(X(xt - 0.04 + i * 0.2), Y(g + 0.82), S(0.1), S(0.36));
  for (let j = 0; j < 2; j++) c.fillRect(X(xt - 0.1), Y(g + 0.78 - j * 0.16), S(1.4), S(0.06));
  c.restore(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke();
  B(xt + 0.38, g + 0.84, 0.46, 0.26, 0.06, '#fff0dc'); E(xt + 0.61, g + 1.1, 0.25, 0.06, '#ff8fb0'); // torta glassata
  B(xt + 0.59, g + 1.12, 0.04, 0.16, 0.01, '#ffffff'); E(xt + 0.61, g + 1.33, 0.035, 0.06, '#ffd36b'); // candelina
  B(xt - 0.05, g + 1.52, 1.3, 0.07, 0.03, legno); // mensola con i barattoli
  for (const [ox, w, h, col] of [[0.05, 0.22, 0.3, '#8fd6c4'], [0.36, 0.18, 0.22, '#ffb36b'], [0.62, 0.24, 0.34, '#f0e6ff'], [0.95, 0.18, 0.24, '#ff8f9c']]) { B(xt + ox, g + 1.59, w, h, 0.05, col); B(xt + ox - 0.01, g + 1.59 + h, w + 0.02, 0.06, 0.02, '#c9a27a'); }

  // ── soffitta
  const xb = x0 + d.w * 0.4; // libreria
  B(xb, yF, 0.9, 1.3, 0.05, legno);
  for (let r = 0; r < 3; r++) {
    const yb = yF + 0.08 + r * 0.42;
    c.fillStyle = '#5a3424'; c.fillRect(X(xb + 0.06), Y(yb + 0.36), S(0.78), S(0.36));
    let x = xb + 0.09;
    for (const [w, h, col] of [[0.09, 0.3, '#e25d6e'], [0.12, 0.26, '#5c82dc'], [0.08, 0.32, '#ffd36b'], [0.11, 0.28, '#35b39c'], [0.1, 0.24, '#c17bd6'], [0.09, 0.3, '#ff8a3c']].slice(r, r + 5)) {
      c.fillStyle = col; c.fillRect(X(x), Y(yb + h), S(w), S(h)); x += w + 0.03;
    }
  }
  const xd = dx(yF) - 1.0; // sedia a dondolo con il gomitolo e i ferri
  c.strokeStyle = C.contorno; c.lineWidth = S(0.08) + Lf * 2; c.lineCap = 'round';
  const dondolo = () => { c.beginPath(); c.moveTo(X(xd - 0.05), Y(yF + 0.12)); c.quadraticCurveTo(X(xd + 0.4), Y(yF - 0.04), X(xd + 0.85), Y(yF + 0.12)); };
  dondolo(); c.stroke(); c.strokeStyle = legno; c.lineWidth = S(0.08); c.stroke();
  B(xd + 0.12, yF + 0.1, 0.07, 0.42, 0.02, legno); B(xd + 0.6, yF + 0.1, 0.07, 0.42, 0.02, legno);
  B(xd + 0.05, yF + 0.5, 0.72, 0.12, 0.05, '#c96a4a'); B(xd + 0.6, yF + 0.5, 0.14, 0.85, 0.06, legno); E(xd + 0.38, yF + 0.66, 0.28, 0.08, '#ffd4a8'); // cuscino
  E(xd - 0.2, yF + 0.13, 0.13, 0.12, '#e25d6e'); // gomitolo
  c.strokeStyle = '#e25d6e'; c.lineWidth = S(0.025); c.beginPath(); c.moveTo(X(xd - 0.1), Y(yF + 0.18)); c.quadraticCurveTo(X(xd + 0.1), Y(yF + 0.5), X(xd + 0.3), Y(yF + 0.66)); c.stroke();
  c.strokeStyle = '#d8d8e8'; c.lineWidth = S(0.03); for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(X(xd - 0.3), Y(yF + 0.2 + s2 * 0.04)); c.lineTo(X(xd - 0.02), Y(yF + 0.3 - s2 * 0.06)); c.stroke(); }
  const xl0 = x0 + d.w * 0.66, yl = yT - 0.55; // lampada a stella appesa
  c.strokeStyle = C.contorno; c.lineWidth = Lf; c.beginPath(); c.moveTo(X(xl0), Y(yT)); c.lineTo(X(xl0), Y(yl + 0.2)); c.stroke();
  c.fillStyle = 'rgba(255,240,180,0.4)'; c.beginPath(); c.arc(X(xl0), Y(yl), S(0.45), 0, TAU); c.fill();
  c.fillStyle = '#ffe28a'; stella5(c, X(xl0), Y(yl), S(0.22)); c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke();
  // tenda verde alla finestra (drappo raccolto)
  const fin = G.varchi.find((q) => q.t === 'finestra');
  if (fin) {
    const wx = (yy) => G.xl(yy) + MURO;
    c.beginPath(); c.moveTo(X(wx(fin.y1) - 0.05), Y(g + fin.y1 + 0.04)); c.lineTo(X(wx(fin.y1) + 0.55), Y(g + fin.y1 + 0.04)); c.bezierCurveTo(X(wx(fin.y1) + 0.5), Y(g + fin.y1 - 0.5), X(wx(fin.y0) + 0.28), Y(g + fin.y0 + 0.8), X(wx(fin.y0) + 0.1), Y(g + fin.y0 + 0.5)); c.quadraticCurveTo(X(wx(fin.y0) + 0.3), Y(g + fin.y0 + 0.22), X(wx(fin.y0) + 0.26), Y(g + fin.y0 + 0.02)); c.lineTo(X(wx(fin.y0) - 0.05), Y(g + fin.y0 + 0.02)); c.closePath();
    c.fillStyle = '#4fb38f'; c.fill(); c.strokeStyle = C.contorno; c.lineWidth = Lf; c.stroke();
    E(wx(fin.y0) + 0.12, g + fin.y0 + 0.5, 0.07, 0.07, C.oro);
  }
  // solaio (solo grafica): trave appena incurvata
  c.beginPath(); c.moveTo(X(x0), Y(yS + 0.05)); c.bezierCurveTo(X(x0 + d.w * 0.3), Y(yS + 0.11), X(x0 + d.w * 0.7), Y(yS - 0.01), X(x0 + d.w), Y(yS + 0.05));
  c.lineCap = 'butt'; c.strokeStyle = C.contorno; c.lineWidth = S(0.16) + Lf * 2; c.stroke(); c.strokeStyle = legno; c.lineWidth = S(0.16); c.stroke();
}

/** Sprite in cache di una casa (creato al caricamento del livello). Restituisce anche la geometria per i dettagli per frame. */
export function buildHouseSprite(house, ppm) {
  const G = geoCasa(house.def);
  const d = house.def;
  let top = G.ap[1] + 0.45;
  if (G.T) top = Math.max(top, G.T(-G.tw - G.CW, G.H)[1] + 0.5, G.T(G.tw + G.CW, G.H)[1] + 0.5);
  const sprite = makeSprite(d.x - 2.9, G.g - 0.12, d.x + d.w + 0.75, top, ppm, (c) => casa(c, G));
  return { sprite, G };
}

/** Parte della casa che cambia: vetri ancora interi (con traversine e pomello) e bagliore dorato delle consegne. */
export function drawHouse(ctx, house, cache) {
  blit(ctx, cache.sprite);
  for (const pane of house.panes) {
    const ud = pane.getUserData();
    if (!ud || ud.broken) continue;
    const p = pane.getPosition();
    const v = ud.poly.map((q) => [X(p.x + q.x), Y(p.y + q.y)]); // [basso sx, basso dx, alto dx, alto sx]
    tracciato(ctx, v);
    ctx.fillStyle = C.vetro;
    ctx.globalAlpha = 0.88;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, S(0.03));
    ctx.beginPath();
    ctx.moveTo(v[0][0], v[0][1]);
    ctx.lineTo(v[3][0], v[3][1]);
    ctx.stroke();
    const porta = ud.opening === 'door';
    const m = S(MURO / 2 - 0.04 - PANE); // le traversine attraversano lo spessore del muro
    ctx.strokeStyle = C.telaio;
    ctx.lineWidth = Math.max(1.5, S(0.05));
    ctx.lineCap = 'round';
    for (const u of porta ? [0.5] : [0.33, 0.66]) {
      const ax = v[0][0] + (v[3][0] - v[0][0]) * u, ay = v[0][1] + (v[3][1] - v[0][1]) * u;
      const bx = v[1][0] + (v[2][0] - v[1][0]) * u;
      ctx.beginPath();
      ctx.moveTo(ax - m, ay);
      ctx.lineTo(bx + m, ay);
      ctx.stroke();
      if (porta) { // pomello dorato
        ctx.fillStyle = C.oro;
        ctx.beginPath();
        ctx.arc(ax - m - S(0.05), ay, Math.max(1.8, S(0.07)), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = C.contorno;
        ctx.lineWidth = Math.max(1, spess() * 0.8);
        ctx.stroke();
      }
    }
  }
}
