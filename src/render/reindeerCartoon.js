import { REINDEER } from '../config.js';

/**
 * Renne da cartone animate a fotogrammi (stile scelto dall'utente: zampe lunghe e sottili, muso lungo con il
 * nasone scuro, sorriso bianco, corna fini). Disegno originale, fatto a codice.
 *
 * Ogni renna ha una pellicola di pose ("fotogrammi") che scatta a FPS fotogrammi al secondo, senza interpolare:
 *  - 'bruca' (di fianco, a quattro zampe): mastica a testa bassa, alza il muso e guarda in giro, sbatte gli occhi,
 *    scodinzola, scalpita;
 *  - 'fronte' (in piedi su due zampe): ferma, sbatte gli occhi, saluta, mani sui fianchi, balletto.
 * Colpita: tre fotogrammi di spavento (urto, salto a zampe larghe con la lingua fuori, atterraggio tremante).
 * Le pose restano dentro l'ingombro del corpo fisico (entities/reindeer.js), che non cambia.
 * Spazio locale in "pixel" (K per metro, y verso il basso), origine ai piedi.
 */
const K = 100;
const FPS = 7; // fotogrammi al secondo
const TAU = Math.PI * 2;
const LW = 3; // contorno
const COL = {
  pelo: '#b9693a', pelo2: '#8f4a27', pancia: '#d99a6a', corna: '#5c3222', zoccolo: '#3b2018',
  naso: '#6a2a26', contorno: '#1d1442', bocca: '#ffffff', lingua: '#ff7f8f', occhio: '#ffffff',
};

// ---------------------------------------------------------------- pellicole (nomi dei fotogrammi)
const rip = (nome, n) => Array(n).fill(nome);
const FILM = {
  bruca: [
    ...rip('giu1', 2), ...rip('giu2', 2), ...rip('giu1', 2), ...rip('giu2', 2), ...rip('giu1', 2), ...rip('giu2', 2),
    ...rip('su', 6), 'chiusi', ...rip('su', 3), 'coda1', 'coda2', 'coda1', 'coda2', ...rip('su', 3),
    'scalpita', 'su', 'scalpita', 'su', 'chiusi', ...rip('su', 2),
  ],
  fronte: [
    ...rip('ferma', 6), 'chiusi', ...rip('ferma', 4), 'saluta1', 'saluta2', 'saluta1', 'saluta2', 'saluta1', 'saluta2',
    ...rip('ferma', 3), ...rip('fianchi', 5), 'fianchiChiusi', ...rip('fianchi', 3),
    ...rip('ballo1', 2), ...rip('ballo2', 2), ...rip('ballo1', 2), ...rip('ballo2', 2), ...rip('ferma', 3),
  ],
};

// ---------------------------------------------------------------- mattoni del disegno
/** Arto: spezzata con le giunture tonde, contorno scuro e zoccolo in fondo. */
function arto(c, pts, w, col, zoccolo = true) {
  const linea = () => {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  };
  c.lineCap = 'round';
  c.lineJoin = 'round';
  linea();
  c.strokeStyle = COL.contorno;
  c.lineWidth = w + LW * 2;
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
  if (!zoccolo) return;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  c.beginPath();
  c.moveTo(b[0] - ((b[0] - a[0]) / d) * 9, b[1] - ((b[1] - a[1]) / d) * 9);
  c.lineTo(b[0], b[1]);
  c.strokeStyle = COL.zoccolo;
  c.lineWidth = w + 1;
  c.stroke();
}
function ovale(c, x, y, rx, ry, col, rot = 0, bordo = true) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  c.fillStyle = col;
  c.fill();
  if (bordo) {
    c.strokeStyle = COL.contorno;
    c.lineWidth = LW;
    c.stroke();
  }
}

/**
 * Testa di profilo con il muso verso +x, ruotata di `a` attorno al centro del cranio (hx, hy).
 * o: { occhi: 'aperti'|'chiusi'|'sgranati', bocca: 'sorriso'|'mastica1'|'mastica2'|'o', lingua, trema, guarda: [dx, dy] }
 */
function testa(c, hx, hy, a, o = {}) {
  c.save();
  c.translate(hx, hy);
  c.rotate(a);
  // corna fini (dietro il cranio), con i rametti
  c.save();
  c.rotate((o.trema || 0) * 1.5);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const [bx, k] of [[-6, -1], [7, 1]]) {
    const corno = () => {
      c.beginPath();
      c.moveTo(bx, -13);
      c.quadraticCurveTo(bx + k * 4, -34, bx + k * 16, -52);
      c.moveTo(bx + k * 3, -27);
      c.lineTo(bx - k * 9, -40);
      c.moveTo(bx + k * 8, -38);
      c.lineTo(bx - k * 2, -54);
      c.moveTo(bx + k * 12, -46);
      c.lineTo(bx + k * 25, -50);
    };
    corno();
    c.strokeStyle = COL.contorno;
    c.lineWidth = 5 + LW * 1.4;
    c.stroke();
    corno();
    c.strokeStyle = COL.corna;
    c.lineWidth = 5;
    c.stroke();
  }
  c.restore();
  ovale(c, -17, -5, 10, 5.5, COL.pelo2, -0.5); // orecchio
  // muso lungo + cranio: prima i contorni, poi i riempimenti (un'unica sagoma senza giunture)
  const muso = () => {
    c.beginPath();
    c.roundRect(2, -10, 54, 22, 11);
  };
  const cranio = () => {
    c.beginPath();
    c.arc(0, 0, 18, 0, TAU);
  };
  c.strokeStyle = COL.contorno;
  c.lineWidth = LW * 2;
  muso();
  c.stroke();
  cranio();
  c.stroke();
  c.fillStyle = COL.pelo;
  muso();
  c.fill();
  cranio();
  c.fill();
  // bocca
  const b = o.bocca || 'sorriso';
  if (b === 'sorriso') {
    c.beginPath();
    c.moveTo(12, 4);
    c.quadraticCurveTo(30, 22, 48, 3);
    c.quadraticCurveTo(30, 9, 12, 4);
    c.fillStyle = COL.bocca;
    c.fill();
    c.strokeStyle = COL.contorno;
    c.lineWidth = LW * 0.8;
    c.stroke();
  } else if (b === 'o') {
    ovale(c, 34, 9, 7, 8, '#3a1420');
  } else {
    // mastica: bocca chiusa che si sposta, con un filo d'erba
    c.beginPath();
    c.moveTo(18, 7);
    c.quadraticCurveTo(32, b === 'mastica1' ? 11 : 5, 46, 7);
    c.strokeStyle = COL.contorno;
    c.lineWidth = LW;
    c.stroke();
    c.strokeStyle = '#69c27a';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(40, 8);
    c.lineTo(b === 'mastica1' ? 50 : 46, 20);
    c.moveTo(44, 8);
    c.lineTo(b === 'mastica1' ? 57 : 54, 17);
    c.stroke();
  }
  if (o.lingua) ovale(c, 38, 18, 5, 9, COL.lingua, -0.2);
  ovale(c, 49, -6, 11, 9.5, COL.naso, 0.1); // nasone
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.ellipse(46, -10, 3.5, 2.2, -0.4, 0, TAU);
  c.fill();
  // occhi: due ovali vicini in cima al cranio
  const occhi = o.occhi || 'aperti';
  const [gx, gy] = o.guarda || [1.5, 0.5];
  for (const [ex, ey] of [[13, -15], [2, -16]]) {
    if (occhi === 'chiusi') {
      c.beginPath();
      c.arc(ex, ey + 2, 6, Math.PI * 1.1, Math.PI * 1.9);
      c.strokeStyle = COL.contorno;
      c.lineWidth = LW;
      c.stroke();
      continue;
    }
    const g = occhi === 'sgranati' ? 1.3 : 1;
    ovale(c, ex, ey, 6.5 * g, 8.5 * g, COL.occhio);
    c.fillStyle = COL.contorno;
    c.beginPath();
    c.arc(ex + gx, ey + gy, occhi === 'sgranati' ? 1.8 : 2.8, 0, TAU);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- 'bruca': di fianco, a quattro zampe
function bruca(c, f, spav) {
  const su = f !== 'giu1' && f !== 'giu2';
  const bob = f === 'giu2' ? 2 : 0;
  const salto = spav === 'salto';
  const trema = spav === 'atterra1' ? 3 : spav === 'atterra2' ? -3 : 0;
  // zampe lontane (più scure), poi il corpo, poi le vicine
  const zampa = (hx, piede, alza, col) => arto(c, [[hx, -70 + bob], [hx + (piede - hx) * 0.45 + (salto ? 0 : 3), -36 - alza * 0.5], [piede + trema, -alza]], 9, col);
  const lontane = salto ? [[-44, -92, 26], [44, 96, 30]] : [[-44, -48, 0], [44, 40, f === 'scalpita' ? 0 : 0]];
  const vicine = salto ? [[-58, -112, 20], [58, 112, 24]] : [[-58, -62, 0], [58, 56, f === 'scalpita' ? 26 : 0]];
  for (const [hx, p, al] of lontane) zampa(hx, p, al, COL.pelo2);
  // coda
  const coda = f === 'coda1' ? -0.9 : f === 'coda2' ? 0.3 : spav ? -1.1 : -0.3;
  ovale(c, -74 - Math.cos(coda) * 6, -112 + bob + Math.sin(coda) * 8, 12, 6, COL.pelo2, coda + 2.4);
  // collo (dietro il corpo)
  const H = su || spav ? [92, -176] : [126, -52 + bob]; // centro del cranio
  arto(c, [[56, -112 + bob], [(56 + H[0]) / 2 + (su || spav ? -4 : 10), (-112 + H[1]) / 2], [H[0] - 6, H[1] + (su || spav ? 12 : -8)]], 20, COL.pelo, false);
  ovale(c, 0, -98 + bob, 74, 40, COL.pelo);
  ovale(c, 2, -84 + bob, 52, 22, COL.pancia, 0, false);
  for (const [hx, p, al] of vicine) zampa(hx, p, al, COL.pelo);
  // testa
  const occhi = spav ? 'sgranati' : f === 'chiusi' ? 'chiusi' : 'aperti';
  const bocca = spav ? 'o' : f === 'giu1' ? 'mastica1' : f === 'giu2' ? 'mastica2' : 'sorriso';
  const a = su || spav ? -0.12 : 0.95;
  testa(c, H[0], H[1], a, { occhi, bocca, lingua: salto, trema: trema * 0.02, guarda: su ? [-1.5, 1] : [1.5, 1.5] });
  return [H[0], H[1] - 62];
}

// ---------------------------------------------------------------- 'fronte': in piedi su due zampe
function fronte(c, f, spav) {
  const salto = spav === 'salto';
  const trema = spav === 'atterra1' ? 3 : spav === 'atterra2' ? -3 : 0;
  const lean = f === 'ballo1' ? -7 : f === 'ballo2' ? 7 : f === 'fianchi' || f === 'fianchiChiusi' ? 3 : 0;
  // gambe
  const piedi = salto ? [[-34, -16], [36, -22]] : f === 'ballo1' ? [[-18, 0], [26, -10]] : f === 'ballo2' ? [[-26, -10], [18, 0]] : [[-16 + trema, 0], [16 - trema, 0]];
  arto(c, [[-13 + lean * 0.3, -56], [-18 + (piedi[0][0] + 16) * 0.5, -28], piedi[0]], 9, COL.pelo2);
  arto(c, [[13 + lean * 0.3, -56], [18 + (piedi[1][0] - 16) * 0.5, -28], piedi[1]], 9, COL.pelo);
  ovale(c, -30 + lean * 0.4, -66, 10, 5, COL.pelo2, 0.6); // codino
  // braccio lontano, corpo, braccio vicino
  const S = [-24 + lean, -126]; // spalle
  const D = [26 + lean, -126];
  let mS, mD; // mani
  if (spav) [mS, mD] = [[-58 + lean, -176], [60 + lean, -180]];
  else if (f === 'saluta1') [mS, mD] = [[-34, -72], [62, -192]];
  else if (f === 'saluta2') [mS, mD] = [[-34, -72], [74, -176]];
  else if (f === 'fianchi' || f === 'fianchiChiusi') [mS, mD] = [[-26 + lean, -84], [30 + lean, -84]];
  else if (f === 'ballo1') [mS, mD] = [[-66, -150], [40, -78]];
  else if (f === 'ballo2') [mS, mD] = [[-40, -78], [68, -150]];
  else [mS, mD] = [[-34, -72], [36, -72]];
  const gomito = (s, m, lato) => (f === 'fianchi' || f === 'fianchiChiusi' ? [s[0] + lato * 24, (s[1] + m[1]) / 2] : [(s[0] + m[0]) / 2 + lato * 6, (s[1] + m[1]) / 2 + 6]);
  arto(c, [S, gomito(S, mS, -1), mS], 8, COL.pelo2);
  ovale(c, lean * 0.6, -100, 33, 52, COL.pelo, lean * 0.006);
  ovale(c, 3 + lean * 0.6, -94, 19, 37, COL.pancia, lean * 0.006, false);
  arto(c, [D, gomito(D, mD, 1), mD], 8, COL.pelo);
  // collo corto e testa
  const H = [2 + lean * 1.2, -172 - (salto ? 4 : 0)];
  arto(c, [[lean, -142], [H[0] - 2, H[1] + 12]], 16, COL.pelo, false);
  const occhi = spav ? 'sgranati' : f === 'chiusi' || f === 'fianchiChiusi' ? 'chiusi' : 'aperti';
  testa(c, H[0], H[1], -0.1 + lean * 0.012, { occhi, bocca: spav ? 'o' : 'sorriso', lingua: salto, trema: trema * 0.02, guarda: [0, 1.5] });
  return [H[0], H[1] - 62];
}

/** Disegna una renna (trasformazione mondo già applicata al contesto); t = tempo reale del gioco. */
export function drawReindeerCartoon(ctx, r, t) {
  const paura = r.scare > 0 ? 1 - r.scare / REINDEER.scareTime : null; // 0..1 dall'urto
  const tick = Math.floor((t + r.x * 0.37) * FPS);
  let spav = null;
  if (paura !== null) spav = paura < 0.12 ? 'urto' : paura < 0.55 ? 'salto' : tick % 2 ? 'atterra1' : 'atterra2';
  const balzo = spav === 'salto' ? REINDEER.jump * (paura < 0.33 ? 1 : 0.6) : 0; // a scatti, come i fotogrammi
  const film = FILM[r.pose] || FILM.fronte;
  const f = film[tick % film.length];
  // le renne in piedi guardano un po' a destra e un po' a sinistra (dalla posizione); quelle che brucano seguono `facing`
  const verso = r.pose === 'bruca' ? r.facing : Math.round(r.x * 10) % 2 ? 1 : -1;
  ctx.save();
  ctx.translate(r.x, r.g);
  ctx.scale(1 / K, -1 / K);
  ctx.fillStyle = 'rgba(40,50,110,0.22)'; // ombra a terra (resta giù mentre la renna salta)
  ctx.beginPath();
  ctx.ellipse(0, 0, (r.pose === 'bruca' ? 95 : 55) * (1 - balzo * 0.8), 10, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -balzo * K + (spav === 'urto' ? 6 : 0));
  ctx.save();
  ctx.scale(verso, 1);
  const sopra = r.pose === 'bruca' ? bruca(ctx, f, spav) : fronte(ctx, f, spav);
  ctx.restore();
  if (paura !== null && paura < 0.85) {
    ctx.font = '800 55px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = LW * 2;
    ctx.strokeStyle = COL.contorno;
    ctx.fillStyle = '#ffd36b';
    ctx.strokeText('!', sopra[0] * verso, sopra[1]);
    ctx.fillText('!', sopra[0] * verso, sopra[1]);
  }
  ctx.restore();
}
