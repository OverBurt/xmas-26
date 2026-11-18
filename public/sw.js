// Service worker: il gioco funziona anche senza rete dopo la prima visita.
// - all'installazione mette in cache la pagina, i file che la pagina cita (script e stili del build, icone,
//   manifest) e la musica;
// - la pagina (navigazione) si chiede prima alla rete, così gli aggiornamenti arrivano subito, e senza rete
//   si usa la copia in cache;
// - gli altri file (hanno il nome con l'impronta del contenuto) si servono dalla cache e si aggiornano in sottofondo.
// Cambiare VERSIONE butta via le cache vecchie.
const VERSIONE = 'xmas26-v6';
const BASE = self.registration.scope;

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(VERSIONE);
      const pagina = await fetch(BASE, { cache: 'no-cache' });
      await cache.put(BASE, pagina.clone());
      const html = await pagina.text();
      const citati = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => new URL(m[1], BASE).href).filter((u) => u.startsWith(BASE));
      // in più: musica, icona grande e le anteprime dei livelli (pagina di scelta), che la pagina non cita
      const altri = ['audio/musica.m4a', 'pacco-512.png', 'pacco-192.png', 'livelli/borgo-addormentato.webp', 'livelli/bosco-di-cristallo.webp', 'livelli/vetta-del-gufo.webp'].map((p) => new URL(p, BASE).href);
      await Promise.all([...new Set([...citati, ...altri])].map((u) => cache.add(u).catch(() => {})));
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== VERSIONE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(BASE)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(VERSIONE);
      if (req.mode === 'navigate') {
        try {
          const r = await fetch(req);
          cache.put(BASE, r.clone());
          return r;
        } catch {
          return (await cache.match(BASE, { ignoreVary: true })) || Response.error();
        }
      }
      // ignoreVary: script e stili del build sono chiesti con `crossorigin` (intestazione Origin), ma in cache
      // sono entrati senza: con un server che risponde "Vary: Origin" non combacerebbero
      const inCache = await cache.match(req, { ignoreVary: true });
      const rete = fetch(req).then((r) => {
        if (r.ok) cache.put(req, r.clone());
        return r;
      });
      if (inCache) {
        rete.catch(() => {});
        return inCache;
      }
      return rete;
    })(),
  );
});
