import { VIEW_W, VIEW_H } from '../config.js';

/**
 * Pointer Events unificati (mouse, touch, penna) → callback in coordinate logiche.
 * Gestisce un solo puntatore attivo alla volta. `hover` (facoltativo) riceve ogni movimento, anche del mouse
 * senza tasto premuto (lo sguardo del gufo).
 */
export function attachInput(canvas, { down, move, up, hover }) {
  let activeId = null;

  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VIEW_W,
      y: ((e.clientY - r.top) / r.height) * VIEW_H,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    hover?.(toLogical(e));
    down(toLogical(e));
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    hover?.(toLogical(e));
    if (e.pointerId !== activeId) return;
    move(toLogical(e));
  });

  const end = (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    up(toLogical(e));
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // Niente menu contestuale con il long-press.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
