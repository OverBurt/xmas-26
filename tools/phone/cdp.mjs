// Valuta un'espressione JS nella pagina del gioco aperta in Chrome sul telefono (via DevTools Protocol).
// Prerequisiti: adb collegato, `adb forward tcp:9222 localabstract:chrome_devtools_remote`.
// Uso: node tools/phone/cdp.mjs "<espressione JS>"   (le Promise vengono attese)
const tabs = await (await fetch('http://localhost:9222/json')).json();
const pages = tabs.filter((t) => t.type === 'page' && t.url.includes('localhost:5173'));
if (!pages.length) {
  console.error('Nessuna scheda del gioco aperta in Chrome sul telefono (localhost:5173).');
  process.exit(1);
}
// La prima della lista è quella usata più di recente
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
ws.send(
  JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: process.argv[2], awaitPromise: true, returnByValue: true },
  }),
);
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id !== 1) return;
  console.log(JSON.stringify(m.result?.result?.value ?? m.result, null, 1));
  ws.close();
});
