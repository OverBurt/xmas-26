// Da passare a cdp.mjs: converte punti del mondo (metri) in pixel fisici del telefono
// e restituisce dove toccare per slitta, fionda e un tiro che consegna dalla finestra.
// Uso: node tools/phone/cdp.mjs "$(cat tools/phone/coords.js)"
(() => {
  const g = xmas.game, c = g.camera, r = document.getElementById('frame').getBoundingClientRect(), k = r.width / 1280, d = devicePixelRatio;
  const dev = (wx, wy) => [Math.round((r.left + (wx - c.x) * c.ppm * k) * d), Math.round((r.top + (600 - (wy - c.bottom) * c.ppm) * k) * d)];
  const shot = (type, zone, a0, a1, p0, p1) => {
    const s = xmas.findShot(type, zone, a0, a1, p0, p1);
    return s && dev(g.sling.x - Math.cos(s[0]) * s[1], g.sling.y - Math.sin(s[0]) * s[1]).concat(s.map((v) => +v.toFixed(3)));
  };
  const first = g.sleigh.gifts[0];
  return {
    fullscreen: !!document.fullscreenElement,
    state: g.state,
    sling: dev(g.sling.x, g.sling.y),
    gifts: g.sleigh.gifts.map((x) => [x.type, ...dev(x.x, x.y)]),
    firstWindow: first && shot(first.type, 'window', 0.3, 1.3, 1.2, 2.2),
  };
})()
