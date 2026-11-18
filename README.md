# Xmas-26

Gioco-biglietto di Natale con fionda e fisica: si lanciano pacchi regalo dalla slitta verso le case di un villaggio di montagna,
superando fortini di neve, sculture di ghiaccio, igloo, pupazzi e alberi di cristalli che si rompono in modo realistico.

- **Per chi riprende il progetto**: [docs/HANDOFF.md](docs/HANDOFF.md) (stato, architettura, regole, decisioni, prossimi passi).
- Design e storia delle iterazioni con le misure: [docs/GDD.md](docs/GDD.md).
- Prove su telefono Android: [tools/phone/README.md](tools/phone/README.md).
- **Gioca online**: https://overburt.github.io/xmas-26/ (pubblicato da GitHub Actions a ogni push su `main`).

## Avvio

```bash
npm install
npm run dev
```

Il server è esposto in rete locale (`--host`): dal telefono, sulla stessa Wi-Fi, apri l'indirizzo `Network:` stampato da Vite.
Al primo tocco in orizzontale il gioco va a schermo intero (Android); su iPhone va aggiunto alla schermata Home.

## Come si gioca

- **Un solo gesto**: trascina un pacco dalla slitta fino alla fionda, si arma da solo e continuando a trascinare indietro prendi la mira. Rilascia per lanciare.
- **Dalla fionda**: se è vuota, tirala direttamente: si arma con il primo pacco della slitta. Un tocco su un pacco lo carica; toccandone un altro li scambi.
- Consegna i pacchi nelle case: **camino** 1000 punti (vale anche toccarne lo spigolo interno), **finestre** 400–700, **porta** 150–200 (un pacco che ci arriva, anche rotolando, entra). I vetri si rompono al contatto con un pacco. Neve sul camino o davanti alla porta va tolta prima.
- Neve e ghiaccio si rompono con gli urti (il pacco grande sfonda, il piccolo quasi non rompe); i pupazzi si separano in palle che rotolano; i cristalli dell'albero cadono come foglie e aprono un varco.
- +10 per ogni pezzo rotto, +2 per cristallo, +1500 se tutte le case ricevono almeno un pacco. Il livello finisce quando hai lanciato tutti i 5 pacchi.
- All'avvio la camera mostra case e scenario (un tocco salta). Trascinando su uno spazio vuoto sposti la visuale. **Livelli** (tasto L) per scegliere il livello; il miglior punteggio resta salvato.

## Debug

Apri con `?debug` (e `&level=<id>`) per FPS, costo della fisica, stato del turno e i pulsanti **Sveglia pile** (W) e **Stress +40** (S). **Reset** (R) è sempre disponibile.

Dalla console: `xmas.findShot('small', 'chimney')` cerca un tiro che consegna da un'apertura, `xmas.fire('small', angolo, tensione)` lo esegue,
`xmas.sim(...)` lo simula in un mondo separato, `xmas.wakeAll()` sveglia le strutture (test di stabilità), `xmas.game` dà accesso a tutto (mondo Planck in `xmas.game.pw.world`).
