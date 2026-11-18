// Costo della fisica per componente, misurato sul telefono (dentro la pagina del gioco, senza disegno).
// Per ogni variante del livello (completo, senza fortino, senza albero, ...) crea partite separate e misura
// il tempo di ogni step fisico (= un frame a 60 Hz) in tre situazioni: scena ferma, tiro che fa crollare
// il fortino, tiro nella chioma dell'albero. Stampa media, 95° percentile e massimo in ms per step.
// Prerequisiti: come cdp.mjs. Uso: node tools/phone/fisica.mjs [--giri 3]
const args = process.argv.slice(2);
const GIRI = args.includes('--giri') ? +args[args.indexOf('--giri') + 1] : 3;

const codice = `(async () => {
  const G = xmas.game.constructor;
  const base = xmas.game.level;
  const POWER = 11;
  const VARIANTI = {
    'completo': (l) => l,
    'senza fortino (e pupazzi)': (l) => { l.forts = []; l.snowmen = []; return l; },
    'senza pupazzi': (l) => { l.snowmen = []; return l; },
    'senza albero': (l) => { l.trees = []; return l; },
    'senza renne': (l) => { l.reindeer = []; return l; },
    'senza pini': (l) => { l.pines = []; return l; },
    'senza case': (l) => { l.houses = []; return l; },
  };
  const SCENARI = { fermo: null, crollo: ['big', 0.45, 2.0], albero: ['small', 0.3, 2.0] };
  const STEPS = 360; // 6 s di gioco
  const out = [];
  for (let giro = 0; giro < ${GIRI}; giro++) {
    for (const [nv, f] of Object.entries(VARIANTI)) {
      for (const [ns, tiro] of Object.entries(SCENARI)) {
        const g = new G(f(JSON.parse(JSON.stringify(base))));
        g.endIntro();
        if (tiro) {
          const gift = g.sleigh.gifts.find((x) => x.type === tiro[0]);
          g.sleigh.take(gift);
          const dx = -Math.cos(tiro[1]) * tiro[2];
          const dy = -Math.sin(tiro[1]) * tiro[2];
          g.launch({ gift, x: g.sling.x + dx, y: g.sling.y + dy, vx: -dx * POWER, vy: -dy * POWER });
        }
        const t = [];
        let svegli = 0;
        for (let i = 0; i < STEPS; i++) {
          const t0 = performance.now();
          g.step(1 / 60);
          t.push(performance.now() - t0);
          if (i % 10 === 0) svegli = Math.max(svegli, g.pw.counts().awake);
        }
        t.sort((a, b) => a - b);
        out.push({ v: nv, s: ns, media: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1], corpi: g.pw.counts().dynamic, svegli });
        await new Promise((r) => setTimeout(r, 30));
      }
    }
  }
  return out;
})()`;

const tabs = await (await fetch('http://localhost:9222/json')).json();
const page = tabs.find((t) => t.type === 'page' && t.url.includes('localhost:5173'));
if (!page) throw new Error('Nessuna scheda del gioco aperta in Chrome sul telefono');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: codice, awaitPromise: true, returnByValue: true } }));
const res = await new Promise((r) => ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id === 1) r(m.result); }));
ws.close();
const righe = res?.result?.value;
if (!righe) throw new Error(JSON.stringify(res));

// mediana dei giri per variante e scenario
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const chiavi = [...new Set(righe.map((r) => `${r.v}|${r.s}`))];
console.log('variante | scenario | media ms/step | p95 | max | corpi | svegli max');
for (const k of chiavi) {
  const rr = righe.filter((r) => `${r.v}|${r.s}` === k);
  const [v, s] = k.split('|');
  console.log([v, s, med(rr.map((r) => r.media)).toFixed(3), med(rr.map((r) => r.p95)).toFixed(2), med(rr.map((r) => r.max)).toFixed(1), rr[0].corpi, med(rr.map((r) => r.svegli))].join(' | '));
}
