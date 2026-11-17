# Xmas-26

Gioco-biglietto di Natale con fionda e fisica. Design e analisi tecnica in [docs/GDD.md](docs/GDD.md).

## Avvio

```bash
npm install
npm run dev
```

Il server è esposto in rete locale (`--host`): per provarlo su smartphone apri dal telefono l'indirizzo `Network:` stampato da Vite (stessa Wi-Fi del computer).

## Come si gioca (M3)

- **Un solo gesto**: trascina un pacco dalla slitta fino alla fionda, si arma da solo e continuando a trascinare indietro prendi la mira. Rilascia per lanciare.
- **Dalla fionda**: se è vuota, tocca e tira direttamente la fionda: si arma con il primo pacco della slitta.
- Un tocco su un pacco lo carica; toccandone un altro li scambi. Un trascinamento troppo corto annulla il lancio (il pacco resta caricato).
- Il ghiaccio si rompe in schegge quando viene colpito forte (il pacco grande sfonda, il piccolo quasi non rompe); le schegge piccole svaniscono dopo qualche secondo.
- Consegna i pacchi nelle case: **camino** 1000 punti, **finestre** 400–600, **porta** 150. Porte e finestre hanno un vetro: va colpito abbastanza forte per sfondarlo. Ogni lastra rotta vale 10; servendo tutte le case +1500. Il livello finisce quando hai lanciato tutti i pacchi.
- La camera segue il pacco e poi torna alla fionda; tocca lo schermo per saltare l'attesa.
- Trascinando su uno spazio vuoto sposti la visuale (torna da sola dopo 2 s).
- Il livello è in `src/game/levels/level1.json`.

## Debug

Apri con `?debug` (es. `http://localhost:5173/?debug`) per vedere FPS, costo della fisica, stato del turno e i pulsanti:
- **Sveglia pile** (W): sveglia le lastre senza urti per verificare che stiano in piedi.
- **Stress +40** (S): aggiunge 40 blocchi per misurare il costo della fisica.
- **Reset** (R) è sempre disponibile.

Dalla console: `xmas.findShot('small', 'chimney')` cerca un tiro che consegna da un'apertura, `xmas.fire('small', angolo, tensione)` lo esegue, `xmas.sim(...)` lo simula senza toccare il gioco. `xmas.game` dà accesso allo stato del gioco e al mondo Planck (`xmas.game.pw.world`).
