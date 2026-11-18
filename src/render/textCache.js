/**
 * Cache dei disegni con testo (etichette dei punti, HUD). Scrivere testo sul canvas a ogni frame costa
 * (sull'S21 ~1 ms per frame): ogni elemento si disegna una volta sola in un atlante offscreen e poi si copia
 * con una drawImage; si ridisegna solo quando cambia la chiave (il contenuto) o la scala del canvas.
 * Un unico atlante per tutti: sulla scheda video del telefono poche immagini grandi costano meno di tante piccole.
 */
const LATO = [2048, 1024]; // px dell'atlante
let atlante = null; // {cv, c, x, y, riga, k, voci: Map}

function nuovo(k) {
  const cv = document.createElement('canvas');
  cv.width = LATO[0];
  cv.height = LATO[1];
  atlante = { cv, c: cv.getContext('2d'), x: 0, y: 0, riga: 0, k, voci: new Map() };
}

/**
 * Disegna (dalla cache) un elemento largo w e alto h px logici, con l'origine locale in (ox, oy) dentro il
 * riquadro, alla posizione (x, y) del contesto. `draw(c)` lo disegna attorno a (0, 0) in px logici.
 * La trasparenza corrente del contesto (globalAlpha) vale anche per la copia.
 */
export function daCache(ctx, chiave, x, y, w, h, ox, oy, draw) {
  const k = ctx.getTransform().a; // px del canvas per px logico
  if (!atlante || Math.abs(atlante.k - k) > 1e-3) nuovo(k);
  let v = atlante.voci.get(chiave);
  if (!v) {
    const sw = Math.ceil(w * k) + 2;
    const sh = Math.ceil(h * k) + 2;
    if (sw > LATO[0] || sh > LATO[1]) return draw2(ctx, x, y, draw); // troppo grande: si disegna diretto
    if (atlante.x + sw > LATO[0]) {
      atlante.x = 0;
      atlante.y += atlante.riga;
      atlante.riga = 0;
    }
    if (atlante.y + sh > LATO[1]) nuovo(k); // pieno: si riparte da capo (le voci tornano alla prossima richiesta)
    v = { sx: atlante.x, sy: atlante.y, sw, sh };
    atlante.voci.set(chiave, v);
    atlante.x += sw;
    atlante.riga = Math.max(atlante.riga, sh);
    const c = atlante.c;
    c.save();
    c.beginPath();
    c.rect(v.sx, v.sy, sw, sh);
    c.clip();
    c.setTransform(k, 0, 0, k, v.sx + 1 + ox * k, v.sy + 1 + oy * k);
    draw(c);
    c.restore();
  }
  ctx.drawImage(atlante.cv, v.sx, v.sy, v.sw, v.sh, x - ox - 1 / k, y - oy - 1 / k, v.sw / k, v.sh / k);
}

function draw2(ctx, x, y, draw) {
  ctx.save();
  ctx.translate(x, y);
  draw(ctx);
  ctx.restore();
}
