# Xmas-26 — Game Design & Technical Document (bozza v0.1)

> Gioco-biglietto di auguri: fionda + fisica, pacchi regalo da consegnare alle case attraverso camino, finestre o porta.
> Target: smartphone in orizzontale (primario) + desktop (riquadro con proporzioni da smartphone orizzontale).

---

## 1. Sintesi del gameplay

| Elemento | Regola |
|---|---|
| Munizioni | 5 pacchi regalo colorati, impilati su una slitta a sinistra |
| Lancio | Drag del pacco dalla slitta alla fionda → tensione = potenza, direzione = angolo, anteprima traiettoria nell'HUD → rilascio |
| Ostacoli | "Castelli di carte" di lastre di ghiaccio al centro: si rompono e crollano fisicamente |
| Bersagli | Case a destra con 3 tipi di ingresso; colpire muri/tetto = rimbalzo |
| Punteggio | Camino = alto · Finestre = medio (variabile per difficoltà) · Porta = basso |
| Strategia | Sacrificare un lancio per abbattere la barriera **oppure** tentare lo scavalcamento |
| Fine livello | Pacchi esauriti e scena ferma (tutti i corpi in sleep) oppure tutte le consegne fatte |

### Punteggio proposto (da tarare)
- **Camino**: 1000
- **Finestra**: 300–700 in base a dimensione/altezza (finestra piccola alta > grande bassa)
- **Porta**: 150
- **Bonus ghiaccio**: +10 per lastra rotta, +50 per crollo completo di una struttura
- **Bonus pacchi avanzati**: +500 ciascuno se tutte le case sono servite prima di finire i pacchi
- **Stelle**: 1–3 in base alle soglie di punteggio (serve a dare rigiocabilità)

---

## 2. Analisi tecnica: fisica nel browser mobile

### 2.1 Motori candidati

| Motore | Tipo | Peso | Stabilità pile | CCD (anti-tunneling) | Note |
|---|---|---|---|---|---|
| **Matter.js** | JS puro | ~80 KB | Debole: pile alte "tremano" e collassano da sole | Assente | Il più facile, ma proprio il caso "castello di carte" è il suo punto debole |
| **Planck.js** | JS puro (port Box2D 2.x) | ~200 KB | Buona (solver Box2D, warm starting) | Sì, flag `bullet` | Stessa famiglia di motore usata dai giochi di fionda classici; nessun WASM |
| **Box2D v3 (wasm)** | WASM | ~300–500 KB | Ottima (soft-step solver) | Sì | Prestazioni e stabilità migliori, ma binding meno maturi e debug più scomodo |
| **Rapier 2D** | WASM (Rust) | ~1.4 MB (build compat) | Molto buona | Sì | Veloce e deterministico, bundle pesante per un biglietto d'auguri |

**Raccomandazione: Planck.js.** Il gioco vive su due requisiti critici — pile sottili che restano in piedi finché non vengono colpite, e un proiettile veloce che non deve attraversare le lastre — e Planck li copre entrambi senza WASM, con un bundle contenuto. Se in fase di prototipo le pile si rivelassero instabili su mobile, il fallback è Box2D v3 wasm (API concettualmente uguale).

### 2.2 Limiti e contromisure

| Limite | Effetto | Contromisura |
|---|---|---|
| **CPU mobile** (budget ~4–6 ms/frame per la fisica) | Cali di FPS con molti corpi | Tetto di **~120 corpi dinamici attivi**; sleeping abilitato; shard piccoli convertiti in particelle non fisiche dopo 2–3 s |
| **Pile sottili e alte** | Jitter, crollo spontaneo all'avvio | Corpi creati **già addormentati** (`awake=false`) in posizione esatta; attrito alto (0.6–0.8), restituzione bassa (0.05); max 4 piani; spessore lastre ≥ 0.15 m in unità mondo |
| **Tunneling** | Il pacco attraversa le lastre o le pareti | `bullet: true` sui pacchi; velocità massima di lancio clampata |
| **Frattura realistica** | La frattura Voronoi in tempo reale è troppo costosa | **Pre-frattura**: ogni lastra ha 2–4 frammenti precalcolati al caricamento; quando l'impulso di contatto (`post-solve`) supera la soglia, la lastra viene sostituita dai frammenti che ereditano velocità lineare/angolare. Frammenti di frammenti: un solo livello di rottura secondaria |
| **Timestep variabile** (frame drop, tab in background) | Simulazione instabile, "esplosioni" | Timestep fisso 1/60 s con accumulatore, max 3 substep per frame, interpolazione del rendering tra stati |
| **Unità** | Box2D lavora bene con oggetti 0.1–10 m | Mondo in metri: pacco ~0.5 m, lastra 0.15×1.5 m, casa ~4 m; scala px/m solo nel renderer |
| **Fill-rate GPU** | Schermi ad alta densità (DPR 3) pesano molto | DPR del canvas limitato a 2 (1.5 in modalità "risparmio"); sfondi pre-renderizzati su canvas offscreen |

### 2.3 Consegna: come "entra" un pacco
- Le case sono **corpi statici** con aperture modellate nella forma (non solo disegnate).
- Ogni ingresso ha un **sensore** dietro l'apertura. Il pacco è consegnato quando il suo centro entra nel sensore **con velocità diretta verso l'interno** (es. camino: vy verso il basso).
- Le aperture sono dimensionate rispetto al pacco: camino ≈ 1.3× il pacco, finestre 1.2–1.8×, porta 2×. Questo crea naturalmente la scala di difficoltà.
- Pacco consegnato → rimosso dalla fisica, animazione (luce in finestra, sbuffo dal camino, "+1000" fluttuante).
- Muri, tetto, cornici → rimbalzo fisico (restituzione 0.3 sul pacco, neve sul tetto con attrito alto).

### 2.4 Anteprima della traiettoria
- Calcolata **con lo stesso integratore del motore** (Euler semi-implicito, stesso dt, stessa gravità), non con la parabola analitica: così coincide con il volo reale fino al primo urto.
- Mostrata come puntini che si diradano; lunghezza della preview = leva di difficoltà (es. intera nel livello 1, metà nei successivi).

---

## 3. Rendering e performance

- **Canvas 2D custom**, nessuna libreria grafica: il numero di oggetti (<150 + particelle) non giustifica WebGL/PixiJS e si risparmiano ~450 KB.
- **Layer di parallasse pre-renderizzati** su canvas offscreen una sola volta (cielo, stelle, luna, 3 piani di montagne, colline): ogni frame è un `drawImage` per layer.
- Stelle che brillano: piccolo sottoinsieme animato sopra il layer statico.
- Neve che cade: pool di particelle a dimensione fissa (60–150 in base al tier).
- **Tier di qualità automatici**: misura del frame time nei primi secondi → riduce particelle, DPR, glow.
- Target: 60 fps su smartphone di fascia media (2021+); degrado accettabile a 30 fps senza effetti sulla fisica (timestep fisso).

### Stile visivo (originale)
- **Flat geometrico moderno** con gradienti morbidi e "glow" caldi: palette notturna blu/indaco, accenti caldi giallo-arancio (finestre, luna), pacchi in colori saturi (corallo, menta, oro, lilla, rosso) con nastri a contrasto.
- Tutto disegnato **proceduralmente da codice** (path vettoriali): niente sprite sheet, nitido a ogni zoom, peso quasi nullo.
- Ghiaccio: azzurro traslucido con riflesso diagonale e bordo chiaro; frammenti con lo stesso shading.
- Case: forme "da cartone" con tetti spioventi carichi di neve, camini storti, finestre illuminate.

---

## 4. Schermo, input e piattaforme

- **Risoluzione logica** fissa (es. 1280×600, rapporto ~2.13:1 come uno smartphone orizzontale), scalata con letterbox.
- **Desktop**: il canvas sta dentro un riquadro con proporzioni da smartphone orizzontale, centrato su sfondo decorativo.
- **Mobile verticale**: overlay "ruota il telefono".
- Fullscreen + blocco orientamento: funziona su Android/Chrome; **iOS Safari non supporta né Fullscreen API su iPhone né orientation lock** → soluzione: manifest PWA ("Aggiungi a Home") e layout con `100dvh`.
- **Pointer Events** unificati (mouse/touch), `touch-action: none` sul canvas, nessun gesto del browser durante il drag.
- **Audio**: Web Audio sbloccato al primo tap (vincolo iOS); suoni brevi sintetizzati o OGG/MP3 piccoli.

---

## 5. Flusso di un livello (camera)

1. **Intro** — zoom stretto sulle case (1.5 s), con il nome del destinatario/messaggio
2. **Panoramica** — pan verso sinistra sopra gli ostacoli (2 s, easing)
3. **Pronti** — zoom sulla slitta e la fionda (1 s); tap per saltare l'intro
4. **Mira** — camera stabile sulla fionda, con leggero zoom-out man mano che si tende
5. **Volo** — camera segue il pacco (con look-ahead), zoom-out per tenere in vista le case
6. **Assestamento** — attesa che la scena dorma (o timeout 4 s), poi ritorno alla fionda
7. **Fine** — riepilogo punteggio, stelle, **messaggio di auguri** e pulsante "rigioca/condividi"

---

## 6. Architettura del codice

```
xmas-26/
├─ index.html
├─ vite.config.js
├─ public/            manifest PWA, icone, audio
└─ src/
   ├─ main.js         bootstrap, loop, resize, quality tier
   ├─ core/
   │  ├─ loop.js      timestep fisso + interpolazione
   │  ├─ input.js     pointer events → azioni di gioco
   │  └─ camera.js    zoom/pan/follow + tween dell'intro
   ├─ physics/
   │  ├─ world.js     wrapper Planck (scala, contatti, budget corpi)
   │  ├─ fracture.js  pre-frattura e sostituzione lastre
   │  └─ trajectory.js
   ├─ entities/       gift, slingshot, sleigh, iceSlab, house
   ├─ render/
   │  ├─ background.js parallasse offscreen
   │  ├─ draw/*.js     disegno procedurale per entità
   │  └─ particles.js  neve, schegge, scintille
   ├─ game/
   │  ├─ state.js     macchina a stati (intro/aim/flight/settle/end)
   │  ├─ scoring.js
   │  └─ levels/*.json layout ostacoli e case
   └─ ui/hud.js       pacchi rimasti, punteggio, overlay
```

- Build con **Vite**, JS moderno senza framework, output statico (hostabile ovunque).
- Livelli in **JSON** (posizioni di lastre, case, aperture) → facili da modificare e da aggiungere.
- Modalità debug (`?debug`) con wireframe fisico, FPS e conteggio corpi.

---

## 7. Roadmap

| Fase | Contenuto | Verifica |
|---|---|---|
| **M0 — Prototipo fisico** | Planck, terreno, una pila di lastre, un pacco lanciabile, wireframe | Pila stabile per 60 s senza tocchi; FPS su smartphone reale |
| **M1 — Meccanica** | Fionda + drag + traiettoria, slitta con 5 pacchi, camera follow | Lancio piacevole su touch e mouse |
| **M2 — Rottura** | Pre-frattura, soglie d'impulso, pulizia frammenti | Crollo credibile, nessun calo sotto 50 fps |
| **M3 — Case e punteggio** | Aperture, sensori, punteggio, fine livello | Ogni ingresso riconosciuto correttamente |
| **M4 — Ambientazione** | Cielo, luna, stelle, parallasse, neve, case disegnate | Look finale |
| **M5 — Regia e UX** | Intro camera, HUD, schermata finale con auguri, audio | Flusso completo |
| **M6 — Rifinitura** | Tier qualità, PWA, test iOS/Android/desktop, livelli | Pronto da inviare |

---

### Esito M0 (17/11/2026, desktop Mac; da ripetere su smartphone reale)
- **Pelle di contatto di Planck**: ogni poligono ha `polygonRadius` = 1 cm e due corpi restano separati di `2·radius − linearSlop` = 1.5 cm. Creare le lastre a contatto esatto le faceva "saltare" di ~1 cm per piano; ora vengono create già a quella distanza (`iceTower.js`). Lo scarto non si vede (< 1 px).
- **Stabilità**: piramide 3 piani, torre 4 piani e colonna stretta 4 piani, svegliate senza urti, restano in piedi (deriva finale < 1 cm) e tornano a dormire in pochi secondi.
- **Crollo**: un pacco standard abbatte la colonna stretta e parte della piramide; impulso massimo misurato ~3 (soglia di rottura provvisoria 0.6).
- **Costo**: 118 corpi tutti svegli → ~0.6 ms/frame su desktop.

### Esito M0 su smartphone reale (Samsung Galaxy S21, Android 15, Chrome 157, via adb)
- **Scena normale (38 lastre)**: 60 FPS stabili (120 con la scena ferma: lo schermo è a 120 Hz), fisica 0.1–1.9 ms/frame.
- **Stress 158 corpi tutti svegli e ammucchiati**: 60 FPS costanti, fisica ~5.5 ms/frame → il tetto di ~120 corpi attivi del §2.2 è confermato con margine.
- **Stabilità pile**: identica al desktop (STABILE dopo 20 s, deriva finale 0.6 cm).
- **Lancio touch** con trascinamento reale: funziona, nessuno scroll/zoom della pagina.
- **Schermo intero**: entra al primo tocco in orizzontale; frame 768×360 CSS (DPR 3, canvas limitato a 1536×720). Se il primo tocco viene rifiutato si riprova al successivo.
- Da valutare: limitare il rendering a 60 FPS sugli schermi a 120 Hz per risparmiare batteria.

### Esito M2 — rottura del ghiaccio (17/11/2026, desktop)
- **Pre-frattura** (`src/physics/fracture.js`): ogni lastra nasce con 2–4 pezzi precalcolati, ottenuti con tagli trasversali inclinati (±25°) lungo l'asse lungo, più a volte un taglio diagonale che crea una scheggia appuntita. I pezzi ereditano velocità lineare e angolare della lastra e ricevono una piccola spinta di separazione proporzionale al colpo.
- **Livelli di rottura**: lastra (0) → pezzi (1) che possono rompersi ancora in 2 → schegge (2) che non si rompono più. Ogni livello richiede 1.4× l'impulso del precedente.
- **Soglia**: 1.4 N·s sulla lastra intera; i pacchi moltiplicano l'impulso (piccolo 0.5, standard 1, grande 1.6). Anche le lastre che cadono l'una sull'altra si rompono, quindi il crollo è a cascata.
- **Budget e pulizia**: al massimo 130 corpi dinamici (le rotture oltre il budget vengono saltate); i pezzi sotto 0.05 m² svaniscono dopo 3–4.5 s con dissolvenza e qualche scintilla.
- **Misure** (stesso tiro diretto, 3 prove ciascuno): piccolo 5 rotture, standard 3–8, grande 9–14; picco 54 corpi, ben sotto il budget già verificato sul telefono (158 corpi a 60 FPS).

### Esito M3 — case, consegne e punteggio (17/11/2026, desktop)
- **Casa in sezione**: in 2D di lato il muro sinistro è quello rivolto alla fionda, quindi porta e finestre sono **aperture vere** in quel muro; dietro c'è la stanza (vuota, fisicamente), il muro destro e il tetto sono pieni, il camino è un condotto aperto in alto. Graficamente la casa sarà disegnata "in sezione" con l'interno illuminato (M4).
- **Consegna**: il pacco è consegnato quando il suo centro entra nella zona subito dietro un'apertura (o dentro il condotto del camino); il pacco sparisce con scintille dorate e un "+punti" fluttuante, l'apertura si illumina e la camera resta 1.6 s sulla casa.
- **Punteggio**: valore dell'apertura (dal JSON) + 10 per ogni lastra rotta + 500 per ogni pacco avanzato se tutte le case sono servite. Stelle da soglie nel JSON (livello 1: 1200 / 2500 / 4000).
- **Fine livello**: pacchi finiti oppure tutte le case servite (almeno una consegna ciascuna) → pannello con stelle, punteggio, dettaglio e "Riprova".
- **Difficoltà misurata** (griglia di 546 tiri per pacco, solo livello 1): porta 13–22 tiri validi, finestre 1–3, camino 0–2. Il pacco grande non entra nei camini (largh. 0.9 m), passa da porta e finestra grande.

### Esito M3 su smartphone (Galaxy S21 via adb, tocchi reali)
- Gesto unico slitta → fionda → mira con il pacco grande: consegna dalla porta, attraversando e frantumando entrambe le torri, 60 FPS costanti (fisica ≤ 2.5 ms/frame, picco 86 corpi).
- Tiro dalla fionda vuota: si arma con il primo pacco della slitta; consegna dalla finestra.
- Pannello finale e "Riprova" funzionano al tocco.
- **Correzione**: la camera zooma mentre si tende l'elastico, quindi lo stesso punto del dito corrispondeva a un punto diverso del mondo e la mira "scivolava". Ora durante la mira si usa la camera fissata all'inizio del gesto: la tensione dipende solo dal movimento del dito.

### Revisione M3 — regole e case (17/11/2026)
- **Regole**: una casa è servita quando un pacco entra dal camino, da una finestra o dalla porta; un lancio serve al più una casa (il pacco sparisce alla consegna). Il livello termina **solo quando i pacchi sono finiti**. Premio fisso di 1500 punti se tutte le case hanno ricevuto almeno un pacco. Stelle livello 1: 1500 / 3000 / 4500.
- **Case più grandi** (7×4.6 m e 6.2×4 m) con **pareti laterali convergenti** verso l'alto (`lean`): il muro sinistro inclinato espone meglio porta e finestre ai pacchi che scendono da sinistra.
- **Porta e finestre ampie** (porta 1.7–1.8 m, finestre 1.1–1.3 m) chiuse da **vetro**: se massa × velocità d'impatto supera 0.8 N·s il contatto viene annullato prima della risoluzione (pre-solve), il pacco passa rallentato del 15% e il vetro esplode in schegge che svaniscono; sotto soglia il pacco rimbalza (verificato: 0.8 m/s rimbalza, da 1.6 m/s sfonda ed entra).
- **Camino a imbuto** sulla falda sinistra, inclinato di 12° verso sinistra, largo 1.0 m alla base e 1.8 m in cima: ora ci entra anche il pacco grande.
- **Difficoltà misurata** (546 tiri per pacco): camino 11–14, finestre 4–6, porta 13–33 tiri validi (prima: camino 0–2, finestre 1–3).

### Prova neve: fortino, pupazzi, neve sulle aperture (17/11/2026, desktop)
Il castello di ghiaccio non era giustificato in un villaggio di montagna: sostituito da elementi di neve (il codice del ghiaccio resta disponibile, `towers` nel JSON).
- **Fortino di neve** (`snowFort.js`): mattoni 0.7×0.38 m sfalsati come un muro vero, con merli in cima. Molto più stabile del castello di carte (deriva 0.8 cm a pile sveglie).
- **Rottura della neve** (`fracture.js`): un mattone si spacca in 3–4 zolle tozze con spigoli smussati (1–2 tagli irregolari, non schegge), con una nuvola di polvere lenta che si posa; le zolle piccole si sbriciolano in polvere dopo ~1.5 s, le altre si possono spaccare una volta ancora. Soglia 0.7 N·s (più fragile del ghiaccio), separazione dei pezzi bassa: la neve si accascia invece di esplodere. **Assorbe**: il pacco che sfonda la neve perde il 20% di velocità.
- **Pupazzi** (`snowman.js`): un solo corpo (tre palle + base piatta, sta in piedi) finché un colpo non lo separa in palle che rotolano; la testa con carota e occhi rotola con la palla. Una palla grande colpita forte si sbriciola in zolle, una piccola in polvere.
- **Neve sulle aperture**: cappello di neve sul camino (casa A) da far cadere o sbriciolare; cumulo di neve contro la porta (casa B). I loro pezzi si sciolgono via presto.
- **Aperture al massimo**: casa A alta 5 m con porta 2.4 m e finestra 1.95 m, casa B alta 4.4 m con porta 2.1 m e finestra 1.65 m (resta solo un architrave sottile).
- **Porta**: il vetro della porta cede sempre al contatto con un pacco e la zona di consegna sporge 0.55 m davanti al vetro: un pacco che arriva rotolando o scivolando a terra fino alla porta entra (verificato con tutti e tre i pacchi). Il vetro delle finestre resta da sfondare con forza.
- **Misure**: pacco grande contro fortino + pupazzo + torre: picco 90 corpi, 60 FPS su desktop. Difficoltà (546 tiri per pacco, con neve): porta 26–28, finestre 19–22, camino 5–8 tiri validi (il camino A è tappato dalla neve).

## 8. Decisioni prese (17/11/2026)

### Livelli: 3, difficoltà crescente
| Livello | Case | Ostacoli | Preview traiettoria |
|---|---|---|---|
| 1 — "Il villaggio" | 1 casa, camino largo | 1 castello di ghiaccio basso (2 piani) | Intera |
| 2 — "La collina" | 2 case a quote diverse | 2 strutture, una alta 3 piani | 60% |
| 3 — "La tormenta" | 3 case, finestre piccole | Muro di ghiaccio alto 4 piani + struttura sul tetto | 40% |

5 pacchi per livello; stelle e punteggio per livello, totale finale.

### Nessun messaggio personalizzato
La schermata finale mostra solo punteggio/stelle e un "Buone Feste" generico disegnato nella scena (nessun parametro nell'URL).

### Pacchi con varianti fisiche
| Pacco | Forma | Massa | Ruolo strategico |
|---|---|---|---|
| **Piccolo** (menta) | cubo 0.4 m | leggera | Entra comodamente nel camino e nelle finestre piccole; quasi non danneggia il ghiaccio |
| **Standard** (corallo) | 0.55 m | media | Tuttofare |
| **Grande** (oro) | rettangolo 0.8×0.6 m | pesante | Sfonda le strutture; passa solo dalla porta (o dalle finestre grandi) |

La slitta mostra i 5 pacchi del livello (definiti nel JSON del livello) e il giocatore li prende **in qualsiasi ordine**: sa in anticipo cosa ha a disposizione e sceglie quando "sacrificare" il grande. (Implementato in M1: tap = carica, trascina sulla fionda = carica, tap su un altro pacco = scambio.)

### Audio: effetti + musica
- Effetti sintetizzati con Web Audio (tensione elastico, lancio, ghiaccio, tonfo nella neve, campanelle di consegna).
- Musica: arrangiamento originale in loop, oppure melodia tradizionale di pubblico dominio riarrangiata; generata con Web Audio o file OGG/MP3 < 300 KB. Pulsante mute sempre visibile, volume musica ridotto durante la mira.
