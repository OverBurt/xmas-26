import { VIEW_W, VIEW_H, GFX, GIFTS, SCORE, INTRO } from '../config.js';
import { WALL, isPlugged } from '../entities/house.js';
import { centroid } from '../physics/polygon.js';
import { X, Y, TAU, stella5, V, setView, HUD, panelFit } from './view.js';
import { cappello } from './snow.js';
import { daCache } from './textCache.js';
import { drawGiftIcon } from './propsDraw.js';

const C = GFX.colors;
const FONT = GFX.font;
const ZONE_LABEL_OFFSET = 0.9;
const AZZURRO = '#9fe0ff'; // apertura tappata dalla neve

/** Testo col bordo scuro (punti, titoli). Coordinate schermo. */
function testo(c, txt, x, y, pxs, o = {}) {
  c.save();
  c.globalAlpha *= o.alfa ?? 1; // si somma alla trasparenza già impostata (etichette in dissolvenza, pannello che entra)
  c.font = `${o.peso || 700} ${pxs}px ${FONT}`;
  c.textAlign = o.all || 'center';
  c.textBaseline = 'middle';
  if (o.bordo !== false) {
    c.lineJoin = 'round';
    c.lineWidth = pxs * 0.14;
    c.strokeStyle = o.bordo || '#3a1d00';
    c.strokeText(txt, x, y);
  }
  c.fillStyle = o.col || C.oro;
  c.fillText(txt, x, y);
  c.restore();
}
function pillola(c, x, y, w, h) {
  c.fillStyle = C.hud;
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.fill();
  c.strokeStyle = C.hudBordo;
  c.lineWidth = 1;
  c.stroke();
}
function icona(c, tipo, x, y, col) {
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 1.5;
  if (tipo === 'chimney') {
    c.beginPath();
    c.moveTo(x - 6, y - 6);
    c.lineTo(x + 6, y - 6);
    c.lineTo(x + 3.5, y + 6);
    c.lineTo(x - 3.5, y + 6);
    c.closePath();
    c.fill();
  } else if (tipo === 'window') {
    c.beginPath();
    c.roundRect(x - 5.5, y - 5.5, 11, 11, 2);
    c.stroke();
    c.beginPath();
    c.moveTo(x, y - 5.5);
    c.lineTo(x, y + 5.5);
    c.moveTo(x - 5.5, y);
    c.lineTo(x + 5.5, y);
    c.stroke();
  } else {
    c.beginPath();
    c.roundRect(x - 4.5, y - 6.5, 9, 13, [4.5, 4.5, 0, 0]);
    c.fill();
  }
}
/** Fiocco di neve a sei raggi (contorno), centro (x, y), raggio r. */
function fiocco(c, x, y, r, col) {
  c.save();
  c.strokeStyle = col;
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    c.moveTo(x, y);
    c.lineTo(x + ca * r, y + sa * r);
    // rametti a metà raggio
    const mx = x + ca * r * 0.55;
    const my = y + sa * r * 0.55;
    for (const d of [-0.7, 0.7]) {
      c.moveTo(mx, my);
      c.lineTo(mx + Math.cos(a + d) * r * 0.38, my + Math.sin(a + d) * r * 0.38);
    }
  }
  c.stroke();
  c.restore();
}

/**
 * Etichetta dei punti di un'apertura: pillola scura con l'icona. Dorata se vale il massimo;
 * dopo una consegna il valore cala: l'etichetta si spegne e mostra una freccina in giù.
 * Tappata (neve sul camino o cumulo alla porta): bordo azzurro, fiocco di neve e un cuscinetto di neve
 * sul bordo superiore; torna normale quando la neve è stata tolta.
 */
function etichetta(ctx, tipo, punti, x, y, top, calata, tappata) {
  // dalla cache: si ridisegna solo quando cambiano valore o stato (textCache.js)
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(HUD.k, HUD.k); // più grande sui telefoni
  daCache(ctx, `et|${tipo}|${punti}|${top}|${calata}|${tappata}`, 0, 0, 160, 40, 80, 26, (c) => disegnaEtichetta(c, tipo, punti, 0, 0, top, calata, tappata));
  ctx.restore();
}
function disegnaEtichetta(c, tipo, punti, x, y, top, calata, tappata) {
  c.font = `600 14px ${FONT}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const txt = String(punti);
  const w = c.measureText(txt).width + 36 + (calata ? 12 : 0) + (tappata ? 20 : 0);
  c.fillStyle = tappata ? 'rgba(14,30,72,0.82)' : C.hud;
  c.beginPath();
  c.roundRect(x - w / 2, y - 11, w, 22, 11);
  c.fill();
  c.strokeStyle = tappata ? AZZURRO : top ? C.oro : C.hudBordo;
  c.lineWidth = tappata ? 2 : top ? 1.6 : 1;
  c.stroke();
  const col = tappata ? AZZURRO : top ? C.oro : calata ? '#c9d1f5' : '#fff';
  icona(c, tipo, x - w / 2 + 14, y, col);
  c.fillStyle = col;
  c.fillText(txt, x - w / 2 + 26, y + 1);
  if (calata) {
    const ax = x + w / 2 - (tappata ? 37 : 17);
    c.beginPath();
    c.moveTo(ax, y - 3);
    c.lineTo(ax + 8, y - 3);
    c.lineTo(ax + 4, y + 4);
    c.fill();
  }
  if (tappata) {
    fiocco(c, x + w / 2 - 15, y, 7, '#ffffff');
    // cuscinetto di neve sopra la pillola (come il cappello sul camino)
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(x - w / 2 + 8, y - 9);
    c.quadraticCurveTo(x - w / 4, y - 19, x, y - 14);
    c.quadraticCurveTo(x + w / 4, y - 20, x + w / 2 - 8, y - 9);
    c.closePath();
    c.fill();
  }
}

/** Visibilità (0–1) delle etichette delle aperture: spariscono durante il lancio, ricompaiono a tiro finito. */
let etichetteAlfa = 1;
let etichetteT = null;

/**
 * Valori delle aperture e punti fluttuanti, in coordinate schermo (testo sempre nitido). Vista = camera.
 * Durante il volo e l'assestamento le etichette svaniscono (GFX.labelFade) e non si disegnano: scrivere testo
 * sul canvas costa (~1 ms per frame sul telefono) proprio mentre la fisica lavora di più.
 */
export function drawWorldLabels(ctx, game) {
  const now = game.time || 0;
  const dt = etichetteT === null ? 0 : Math.max(0, now - etichetteT);
  etichetteT = now;
  const lancio = game.state === 'flight' || game.state === 'settle';
  etichetteAlfa = Math.min(1, Math.max(0, etichetteAlfa + (lancio ? -1 : 1) * (dt / GFX.labelFade)));
  if (etichetteAlfa > 0) {
    ctx.save();
    ctx.globalAlpha = etichetteAlfa;
    disegnaEtichette(ctx, game);
    ctx.restore();
  }
  for (const f of game.floaters) punteggioVolante(ctx, f);
}

function disegnaEtichette(ctx, game) {
  const fuori = (HUD.k - 1) * 42; // etichette ingrandite (telefoni): si scostano perché non coprano l'apertura
  for (const h of game.houses) {
    for (const z of h.zones) {
      const top = z.points >= SCORE.maxPoints && !z.count;
      const tappata = z.type !== 'window' && isPlugged(h, z.type);
      if (z.type === 'chimney') etichetta(ctx, z.type, z.points, X(h.chimney.top.x + 0.9) + fuori, Y(h.chimney.top.y + 0.75) - fuori * 0.3, top, z.count > 0, tappata);
      else {
        const c = centroid(z.poly);
        etichetta(ctx, z.type, z.points, X(c.x - WALL - ZONE_LABEL_OFFSET - 0.35) - fuori, Y(c.y), top, z.count > 0, tappata);
      }
    }
  }
}

/**
 * Punteggio che vola via da un'apertura centrata (o i punti tolti da una renna, in rosso).
 * Entra con un "pop" elastico (da piccolo a più grande del normale e poi giusto), ha un alone dorato dietro e
 * un'ombra, sale rallentando e svanisce ingrandendosi un poco. Coordinate schermo, vista = camera.
 */
function punteggioVolante(c, f) {
  const L = SCORE.floaterLife;
  const t = f.t;
  const ent = Math.min(1, t / 0.32);
  const pop = ent < 1 ? 0.3 + 0.7 * ent + Math.sin(ent * Math.PI) * 0.45 : 1; // supera e torna: rimbalzo
  const usc = Math.max(0, (t - (L - 0.55)) / 0.55); // ultimi 0.55 s
  const a = 1 - usc;
  const k = pop * (1 + usc * 0.25);
  const x = X(f.x);
  const y = Y(f.y);
  const pxs = f.big ? 54 : 38;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.rotate(Math.sin(t * 5) * 0.04 * a); // leggero dondolio
  // alone dietro al numero
  const col = f.bad ? '255,120,120' : '255,211,107';
  const r = pxs * 1.5;
  const g = c.createRadialGradient(0, 0, 2, 0, 0, r);
  g.addColorStop(0, `rgba(${col},${0.5 * a})`);
  g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.fillRect(-r * 1.4, -r, r * 2.8, r * 2);
  // ombra morbida sotto e testo con il bordo scuro
  testo(c, f.text, 2, 4, pxs, { alfa: 0.35 * a, col: '#000', bordo: false, peso: 800 });
  testo(c, f.text, 0, 0, pxs, { alfa: a, col: f.bad ? '#ff8a8a' : C.oro, bordo: f.bad ? '#4a0d0d' : '#5a1e12', peso: 800 });
  c.restore();
}

/**
 * HUD: pacchi rimasti e punti in alto a sinistra, suggerimento del momento sotto, nome del livello a destra.
 * @param {number} [top] bordo inferiore dei pulsanti DOM in alto a destra (px logici): il nome va sotto
 */
export function drawHud(ctx, game, top = 0) {
  const tipi = game.sleigh.gifts.map((g) => g.type);
  if (game.sling.loaded) tipi.push(game.sling.loaded.type);
  if (game.carry) tipi.push(game.carry.gift.type);
  const punti = game.score.toLocaleString('it-IT');
  // Tre pezzi dalla cache (textCache.js): si ridisegnano solo quando cambia il contenuto.
  // Sui telefoni tutto è ingrandito di HUD.k: i due pezzi a sinistra attorno all'angolo, il nome attorno al suo bordo destro.
  const k = HUD.k;
  // durante la regia d'apertura pacchi e punti non si mostrano: in alto al centro c'è il nome del livello, che sui
  // telefoni (HUD ingrandito) arriverebbe a toccarli; resta solo "Tocca per saltare", al loro posto
  const regia = game.state === 'intro';
  if (!regia) {
    ctx.save();
    ctx.scale(k, k);
    daCache(ctx, `hud|${tipi.join(',')}|${punti}`, 0, 0, 460, 62, 0, 0, (c) => hudPacchiPunti(c, tipi, punti));
    ctx.restore();
  }
  const yn = Math.max(76, top + 8 + 10 * k); // sotto i pulsanti
  if (k <= GFX.hudNomeMax && game.state !== 'intro') { // durante la regia il nome è già grande in alto al centro; // sui telefoni (HUD ingrandito) il nome del livello non si mostra: toglie spazio alla scena
  ctx.save();
  ctx.translate(VIEW_W - 16, yn);
  ctx.scale(k, k);
  daCache(ctx, `nome|${game.level.name}`, 0, 0, 620, 24, 620, 12, (c) => {
    c.globalAlpha = 0.72;
    c.fillStyle = '#fff';
    c.textBaseline = 'middle';
    c.textAlign = 'right';
    c.font = `500 14px ${FONT}`;
    c.fillText(game.level.name, 0, 0);
  });
  ctx.restore();
  }
  let hint = '';
  if (game.mode === 'aim') hint = ''; // durante la mira niente testi sotto i punti
  else if (game.state === 'ready') {
    if (game.sling.loaded) hint = 'Tira indietro il pacco e rilascia';
    else if (game.sleigh.count) hint = 'Trascina un pacco sulla fionda e tira indietro';
  } else if (game.state === 'intro') hint = 'Tocca per saltare';
  if (hint) {
    ctx.save();
    ctx.scale(k, k);
    daCache(ctx, `hint|${hint}`, 0, regia ? 12 : 62, 460, 40, 0, 0, (c) => {
      c.font = `600 15px ${FONT}`;
      const w = c.measureText(hint).width + 36;
      pillola(c, 16, 4, w, 32);
      c.fillStyle = '#fff';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.globalAlpha = 0.9;
      c.fillText(hint, 34, 21);
    });
    ctx.restore();
  }
}

/** Pillola in alto a sinistra: pacchi rimasti e punti (px logici dall'angolo dello schermo). */
function hudPacchiPunti(ctx, tipi, punti) {
  ctx.font = `700 22px ${FONT}`;
  const wn = ctx.measureText(punti).width;
  const wi = Math.max(1, tipi.length) * 27 + 14;
  pillola(ctx, 16, 14, wi + 30 + wn + 56, 44);
  let x = 36;
  if (!tipi.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', x, 37);
  }
  for (const t of tipi) {
    drawGiftIcon(ctx, t, x + 4, 38, 30 * (t === 'big' ? 0.82 : 1));
    x += 27;
  }
  x = 16 + wi + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x, 22, 1.5, 28);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(punti, x + 14, 37);
  ctx.font = `500 13px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText('punti', x + 22 + wn, 39);
}

/** Pacco sopra il bordo della vista: freccia del suo colore sul bordo superiore. */
export function drawOffscreenArrow(ctx, game) {
  if (!game.current) return;
  const p = game.current.getPosition();
  const cam = game.camera;
  if (p.y <= cam.bottom + cam.viewH - 0.3) return;
  const x = X(p.x);
  ctx.fillStyle = C.pacchi[game.current.getUserData().type]?.[0] || GIFTS[game.current.getUserData().type].color;
  ctx.strokeStyle = C.contorno;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, 6);
  ctx.lineTo(x - 13, 26);
  ctx.lineTo(x + 13, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Pagina di avvio, sopra la scena del livello ferma nell'inquadratura di mira (il gufo sulla luna guarda PLAY):
 * velo scuro che lascia libera la luna, filo di lucine, titolo dorato con le scintille, sottotitolo, pulsante PLAY
 * che pulsa e, se ce ne sono, le stelle già prese. Misure in GFX.titolo. `o.stelle` = {n, max} (da main.js).
 */
export function drawTitle(ctx, game, o = {}) {
  const T = GFX.titolo;
  const t = game.time || 0;
  const m = GFX.moon;
  ctx.save();
  const velo = ctx.createRadialGradient(m.x, m.y, 70, m.x, m.y, 620);
  velo.addColorStop(0, 'rgba(5,8,26,0)');
  velo.addColorStop(1, 'rgba(5,8,26,0.62)');
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // filo di lucine appeso sopra il titolo
  const col = ['#ff6f61', '#ffd36b', '#5fe0b8', '#8fc8ff'];
  const x0 = T.x - 340;
  const lf = 590; // lunghezza del filo: si ferma prima della luna
  const filo = (u) => T.y - 92 + 26 * 4 * u * (1 - u);
  ctx.strokeStyle = 'rgba(20,16,60,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) ctx.lineTo(x0 + (i / 40) * lf, filo(i / 40));
  ctx.stroke();
  for (let i = 0; i < 15; i++) {
    const u = (i + 0.5) / 15;
    const on = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.9);
    ctx.fillStyle = col[i % 4];
    ctx.globalAlpha = 0.3 * on;
    ctx.beginPath();
    ctx.arc(x0 + u * lf, filo(u) + 6, 11, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.65 + 0.35 * on;
    ctx.beginPath();
    ctx.arc(x0 + u * lf, filo(u) + 6, 4.6, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // titolo (ondeggia appena) con l'etichetta GAME e le scintille
  const yt = T.y + Math.sin(t * 1.3) * 3;
  testo(ctx, "Biglietto d'auguri", T.x + 3, yt + 5, 74, { col: 'rgba(0,0,0,0.35)', bordo: false, peso: 800 });
  testo(ctx, "Biglietto d'auguri", T.x, yt, 74, { col: C.oro, bordo: '#5a1e12', peso: 800 });
  ctx.fillStyle = '#ff6f61';
  ctx.strokeStyle = '#5a1e12';
  ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(T.x + 248, yt + 52);
  ctx.rotate(-0.09);
  ctx.beginPath();
  ctx.roundRect(-52, -19, 104, 38, 19);
  ctx.fill();
  ctx.stroke();
  testo(ctx, 'GAME', 0, 1, 23, { col: '#fff', bordo: false, peso: 800 });
  ctx.restore();
  ctx.fillStyle = '#fff6d8';
  for (let i = 0; i < 9; i++) {
    const a = Math.max(0, Math.sin(t * 2.1 + i * 2.3));
    if (a < 0.05) continue;
    ctx.globalAlpha = a;
    scintilla(ctx, T.x + (hash(i + 400) - 0.5) * 700, yt - 60 + hash(i + 410) * 130, 4 + a * 6);
  }
  ctx.globalAlpha = 1;
  testo(ctx, 'Lancia i regali nelle case del villaggio', T.x - 30, T.y + 88, 24, { col: 'rgba(255,255,255,0.92)', bordo: 'rgba(12,14,52,0.6)', peso: 600 });
  // pulsante PLAY: pillola corallo con il triangolo, pulsa piano e ha un alone caldo
  const B = T.play;
  const k = 1 + 0.035 * Math.sin(t * 3.2);
  ctx.translate(B.x, B.y);
  const al = ctx.createRadialGradient(0, 0, 20, 0, 0, 210);
  al.addColorStop(0, 'rgba(255,150,110,0.38)');
  al.addColorStop(1, 'rgba(255,150,110,0)');
  ctx.fillStyle = al;
  ctx.fillRect(-210, -210, 420, 420);
  ctx.scale(k, k);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.roundRect(-B.w / 2 + 2, -B.h / 2 + 8, B.w, B.h, B.h / 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -B.h / 2, 0, B.h / 2);
  g.addColorStop(0, '#ff8a6f');
  g.addColorStop(1, '#e8453f');
  ctx.beginPath();
  ctx.roundRect(-B.w / 2, -B.h / 2, B.w, B.h, B.h / 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; // riflesso in alto
  ctx.beginPath();
  ctx.roundRect(-B.w / 2 + 16, -B.h / 2 + 9, B.w - 32, B.h * 0.3, B.h * 0.15);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-74, -22);
  ctx.lineTo(-38, 0);
  ctx.lineTo(-74, 22);
  ctx.closePath();
  ctx.fill();
  testo(ctx, 'PLAY', 28, 2, 44, { col: '#fff', bordo: false, peso: 800 });
  ctx.restore();
  if (o.stelle?.n) testo(ctx, `★ ${o.stelle.n} su ${o.stelle.max}`, T.x, T.play.y + 78, 20, { col: C.oro, bordo: 'rgba(12,14,52,0.7)', peso: 700 });
}

/** Nome del livello al centro mentre la camera mostra le case (dissolvenza in entrata e uscita). */
export function drawIntroTitle(ctx, game) {
  const t = game.intro.t;
  const a = Math.min(1, t / 0.3) * Math.min(1, Math.max(0, (INTRO.attesa + INTRO.titoloSfuma - t) / INTRO.titoloSfuma)); // resta `attesa` secondi, poi sfuma; la camera parte dopo
  if (a <= 0) return;
  const [title, sub] = game.level.name.split(' · ');
  // in alto, sul cielo scuro: non sopra le case che la camera sta mostrando
  testo(ctx, title, VIEW_W / 2, INTRO.titoloY, 56, { col: '#fff', bordo: 'rgba(12,14,52,0.75)', alfa: a });
  if (sub) testo(ctx, sub, VIEW_W / 2, INTRO.titoloY + 48, 24, { col: 'rgba(255,255,255,0.85)', peso: 500, bordo: false, alfa: a });
}

/** Generatore pseudo-casuale fisso per le decorazioni del pannello (stesse posizioni a ogni frame). */
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Scintilla a quattro punte (stella "brillio"). */
function scintilla(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
}

/**
 * Decorazioni leggere della schermata finale (tempo reale t, s dall'apertura): neve che scende su tutto
 * lo schermo, stelle cadenti in alto (le scintille attorno al titolo sono in `scintilleTitolo`, le lucine in `lucine`).
 * Nessuna allocazione per frame, una manciata di riempimenti.
 */
function decorazioni(c, t) {
  // neve: 46 fiocchi, cadono lenti e ondeggiano; ricompaiono in alto
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.beginPath();
  for (let i = 0; i < 46; i++) {
    const r = 1.4 + hash(i) * 2.6;
    const v = 22 + hash(i + 50) * 36;
    const fy = ((hash(i + 100) * VIEW_H + t * v) % (VIEW_H + 20)) - 10;
    const fx = hash(i + 150) * VIEW_W + Math.sin(t * 0.9 + i) * 14;
    c.moveTo(fx + r, fy);
    c.arc(fx, fy, r, 0, TAU);
  }
  c.fill();
  // stelle cadenti: tre, a turno, attraversano il cielo in diagonale con una scia
  for (let i = 0; i < 3; i++) {
    const per = 3.4 + i * 1.1;
    const k = ((t + i * 1.7) % per) / 1.1; // 0..1 durante il passaggio, poi pausa
    if (k > 1) continue;
    const sx = 140 + hash(i + 200) * 900 + k * 260;
    const sy = 20 + hash(i + 210) * 90 + k * 110;
    const a = Math.sin(k * Math.PI);
    const g = c.createLinearGradient(sx - 90, sy - 38, sx, sy);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(1, `rgba(255,240,200,${0.85 * a})`);
    c.strokeStyle = g;
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx - 90, sy - 38);
    c.lineTo(sx, sy);
    c.stroke();
    c.globalAlpha = a;
    c.fillStyle = '#fff6d8';
    scintilla(c, sx, sy, 6);
    c.globalAlpha = 1;
  }
}

/** Scintille attorno al titolo del pannello finale (stessa trasformazione del pannello). */
function scintilleTitolo(c, t, y) {
  // scintille attorno al titolo
  c.fillStyle = C.oro;
  for (let i = 0; i < 8; i++) {
    const a = Math.max(0, Math.sin(t * 2.2 + i * 2.1));
    if (a < 0.05) continue;
    const lato = i % 2 ? 1 : -1;
    const sx = VIEW_W / 2 + lato * (150 + hash(i + 300) * 90);
    const sy = y + 22 + hash(i + 310) * 46;
    c.globalAlpha = a;
    scintilla(c, sx, sy, 4 + a * 5);
  }
  c.globalAlpha = 1;
}

/**
 * Lucine colorate lungo il bordo superiore del pannello finale, disegnate prima del cappello di neve:
 * spuntano da sotto la neve, che ne copre la parte alta.
 */
function lucine(c, t, x, y, w) {
  const a0 = c.globalAlpha; // dissolvenza d'entrata del pannello
  const col = ['#ff6f61', '#ffd36b', '#5fe0b8', '#8fc8ff'];
  const filo = (u) => y + 25 + Math.sin(u * Math.PI * 5) * 2;
  for (let i = 0; i < 15; i++) {
    const u = (i + 0.5) / 15;
    const lx = x + 30 + u * (w - 60);
    const ly = filo(u);
    const on = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.9);
    c.globalAlpha = a0 * 0.35 * on;
    c.fillStyle = col[i % 4];
    c.beginPath();
    c.arc(lx, ly, 8, 0, TAU);
    c.fill();
    c.globalAlpha = a0 * (0.6 + 0.4 * on);
    c.beginPath();
    c.arc(lx, ly, 3.6, 0, TAU);
    c.fill();
  }
  c.globalAlpha = a0;
}

/** Istante (tempo reale del gioco) in cui è comparso il riepilogo: per l'animazione d'entrata. */
const apertura = new WeakMap();

/**
 * Schermata finale "Buone Feste!": titolo festoso, esito, stelle, punteggio, dettaglio, pulsanti
 * (le loro posizioni vengono dal gioco, turn.js), decorazioni leggere. Nessun messaggio personalizzato.
 */
export function drawSummary(ctx, game) {
  const s = game.summary;
  const now = game.time || 0;
  if (!apertura.has(s)) apertura.set(s, now);
  const t = now - apertura.get(s);
  const w = 560;
  const x = (VIEW_W - w) / 2;
  const y = 30; // il pannello parte più in alto: sotto la neve del bordo resta aria prima del titolo
  const h = 486;
  const yc = y + 36; // origine dei contenuti (titolo, stelle, punteggio)
  ctx.save();
  ctx.fillStyle = `rgba(5,8,26,${0.6 * Math.min(1, t / 0.4)})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // posto del pannello: sui telefoni scende sotto i pulsanti in alto e, se serve, si rimpicciolisce (view.panelFit)
  const fit = panelFit();
  ctx.translate(VIEW_W / 2, fit.dy);
  ctx.scale(fit.f, fit.f);
  ctx.translate(-VIEW_W / 2, 0);
  // entrata: il pannello sale e si ingrandisce un poco (0.35 s, rimbalzo leggero)
  const k = Math.min(1, t / 0.35);
  const pop = 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.04;
  ctx.globalAlpha = k;
  ctx.translate(VIEW_W / 2, y + h / 2 + (1 - k) * 30);
  ctx.scale(0.92 + 0.08 * pop, 0.92 + 0.08 * pop);
  ctx.translate(-VIEW_W / 2, -(y + h / 2));
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a2f7a');
  g.addColorStop(1, '#141a4a');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,107,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // neve sul bordo superiore del pannello: lo stesso cappello di neve dei tetti (bordo bombato, festoni e colature).
  // Il cappello lavora in metri: vista temporanea a GFX.panelSnowPpm px/m con l'origine in basso a sinistra.
  const vista = { ...V };
  const kn = GFX.panelSnowPpm;
  lucine(ctx, t, x, y, w);
  setView(kn, 0, 0, VIEW_H);
  const bordo = (VIEW_H - y) / kn;
  cappello(ctx, () => bordo, (x + 10) / kn, (x + w - 10) / kn, { sp: 0.3, su: 0.06, dome: 0.12, maxGoccia: 0.42, gocce: 0.3, seme: 9 });
  setView(vista.ppm, vista.left, vista.bot, vista.h);

  testo(ctx, 'Buone Feste!', VIEW_W / 2, yc + 54, 50, { col: C.oro, bordo: '#5a1e12', peso: 800 });
  testo(ctx, s.allServed ? 'Tutte le case servite!' : `Case servite: ${s.served} su ${s.houses}`, VIEW_W / 2, yc + 98, 20, { col: 'rgba(255,255,255,0.9)', bordo: false, peso: 600 });
  for (let i = 0; i < 3; i++) {
    const sx = VIEW_W / 2 + (i - 1) * 66;
    const sy = yc + 146;
    const on = i < s.stars;
    // le stelle guadagnate si accendono una dopo l'altra
    const ki = on ? Math.min(1, Math.max(0, (t - 0.35 - i * 0.25) / 0.25)) : 1;
    if (on && ki > 0) {
      const al = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
      al.addColorStop(0, `rgba(255,211,107,${0.45 * ki})`);
      al.addColorStop(1, 'rgba(255,211,107,0)');
      ctx.fillStyle = al;
      ctx.fillRect(sx - 44, sy - 44, 88, 88);
    }
    const r = on ? 24 + 3 * ki + Math.sin(ki * Math.PI) * 6 : 24;
    stella5(ctx, sx, sy, r);
    ctx.fillStyle = on && ki > 0 ? C.oro : 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (on && ki > 0) {
      ctx.strokeStyle = C.oro2;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  testo(ctx, s.score.toLocaleString('it-IT'), VIEW_W / 2, yc + 206, 44);
  const lines = [
    `Consegne: ${s.delivered} su ${s.thrown} lanci  ·  ${s.deliveryScore}`,
    s.crystals ? `Neve e cristalli: ${s.ice} + ${s.crystals}  ·  ${s.iceScore + s.crystalScore}` : `Neve rotta: ${s.ice}  ·  ${s.iceScore}`,
  ];
  if (s.bonus) lines.push(`Tutte le case servite  ·  +${s.bonus}`);
  if (s.penalty) lines.push(`Renne spaventate: ${s.reindeerHits}  ·  −${s.penalty}`);
  if (s.totalStars !== undefined) lines.push(`Stelle in tutto: ${s.totalStars} su ${s.maxStars}`); // totale sui livelli (main.js)
  const kd = Math.min(HUD.k, 1.3); // dettaglio più leggibile sui telefoni (c'è spazio fino ai pulsanti)
  lines.forEach((l, i) => testo(ctx, l, VIEW_W / 2, yc + 246 + i * 23 * kd, 15 * kd, { col: 'rgba(255,255,255,0.84)', peso: 500, bordo: false }));
  for (const b of game.buttons) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fillStyle = b.secondary ? '#2f3a86' : '#ff6f61';
    ctx.fill();
    testo(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 21, { col: '#fff', bordo: false, peso: 600 });
  }
  ctx.globalAlpha = 1;
  scintilleTitolo(ctx, t, yc);
  ctx.restore();
  ctx.save();
  decorazioni(ctx, t);
  ctx.restore();
}

/** Anteprima della traiettoria: puntini color crema che rimpiccioliscono e sbiadiscono (4 riempimenti in tutto). */
export function drawTrajectory(ctx, t, ppm) {
  const n = t.length / 2;
  if (!n) return;
  ctx.fillStyle = C.traiettoria;
  const r0 = Math.max(1.8, ppm * 0.085);
  for (let f = 0; f < 4; f++) {
    ctx.beginPath();
    for (let i = Math.floor((n * f) / 4); i < Math.floor((n * (f + 1)) / 4); i++) {
      const r = r0 * (1 - (i / n) * 0.45);
      const x = X(t[i * 2]);
      const y = Y(t[i * 2 + 1]);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.globalAlpha = 0.95 - f * 0.2;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
