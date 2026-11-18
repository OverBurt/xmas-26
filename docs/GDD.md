# Xmas-26 — Game Design & Technical Document

> **Stato attuale e passaggio di consegne: [HANDOFF.md](HANDOFF.md).** Questo documento contiene il progetto iniziale (§1–§6, aggiornati dove indicato)
> e, dal §7, la storia cronologica delle iterazioni con le misure fatte. In caso di contrasto vale l'ultima sezione cronologica / HANDOFF.

> Gioco-biglietto di auguri: fionda + fisica, pacchi regalo da consegnare alle case attraverso camino, finestre o porta.
> Target: smartphone in orizzontale (primario) + desktop (riquadro con proporzioni da smartphone orizzontale).

---

## 1. Sintesi del gameplay

| Elemento | Regola |
|---|---|
| Munizioni | 5 pacchi regalo colorati, impilati su una slitta a sinistra |
| Lancio | Drag del pacco dalla slitta alla fionda → tensione = potenza, direzione = angolo, anteprima traiettoria nell'HUD → rilascio |
| Ostacoli | Fortini di neve ad arcate con sculture di ghiaccio, igloo, pupazzi, albero di cristalli: si rompono e crollano fisicamente (in origine "castelli di carte" di ghiaccio, poi sostituiti) |
| Bersagli | Case a destra con 3 tipi di ingresso; colpire muri/tetto = rimbalzo |
| Punteggio | Camino = alto · Finestre = medio (variabile per difficoltà) · Porta = basso |
| Strategia | Sacrificare un lancio per abbattere la barriera **oppure** tentare lo scavalcamento |
| Fine livello | Solo quando i pacchi sono esauriti (decisione dell'utente) |

### Punteggio (in vigore)
- **Camino**: 1000 (vale anche toccarne lo spigolo interno)
- **Finestra**: 400–700 per livello · **Porta**: 150–200
- **Rotture**: +10 per pezzo di neve/ghiaccio rotto, +2 per cristallo staccato dall'albero
- **Premio**: +1500 se tutte le case hanno ricevuto almeno un pacco
- **Stelle**: 1–3 in base alle soglie del livello; miglior punteggio salvato sul dispositivo

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

Lo schema iniziale prevedeva più file (state.js, scoring.js, ui/hud.js, render/draw/*): nella realizzazione la logica di gioco è concentrata in `src/game/game.js`
e il disegno in `src/render/sceneDraw.js`. **Struttura aggiornata e schema dei livelli JSON: [HANDOFF.md §5](HANDOFF.md).**

---

## 7. Roadmap

| Fase | Contenuto | Verifica | Stato |
|---|---|---|---|
| **M0 — Prototipo fisico** | Planck, terreno, una pila di lastre, un pacco lanciabile, wireframe | Pila stabile per 60 s senza tocchi; FPS su smartphone reale | ✅ |
| **M1 — Meccanica** | Fionda + drag + traiettoria, slitta con 5 pacchi, camera follow | Lancio piacevole su touch e mouse | ✅ |
| **M2 — Rottura** | Pre-frattura, soglie d'impulso, pulizia frammenti | Crollo credibile, nessun calo sotto 50 fps | ✅ |
| **M3 — Case e punteggio** | Aperture, sensori, punteggio, fine livello | Ogni ingresso riconosciuto correttamente | ✅ (+ iterazioni su ostacoli e case) |
| **M4 — Ambientazione** | Cielo, luna, stelle, parallasse, neve, case disegnate | Look finale | ❌ da fare |
| **M5 — Regia e UX** | Intro camera, HUD, schermata finale con auguri, audio | Flusso completo | 🟡 intro e selettore livelli fatti |
| **M6 — Rifinitura** | Tier qualità, PWA, test iOS/Android/desktop, livelli | Pronto da inviare | ❌ |

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

### Variante "albero di cristalli" (branch `variante-albero`, 17/11/2026)
- Al posto dei fortini, un **albero** (alto ~8 m) con **~120 cristalli di neve** al posto delle foglie (`snowTree.js`). Tronco solido; i 4 cerchi della chioma nel JSON guidano la crescita dei rami: un ramo principale per lobo, 3–4 rametti e un ramoscello ciascuno (~30 rami). I cristalli sono **attaccati ai rami**, a passo irregolare e alternati ai due lati, con un grappolo in punta: la chioma è irregolare e i rami si vedono.
- I cristalli **non sono corpi fisici**: a ogni step si controlla il segmento percorso dal pacco contro i cristalli (costo trascurabile anche a 24 m/s). Un cristallo attraversato si stacca e **cade ondeggiando come una foglia** (spinta iniziale nella direzione del pacco, poi caduta lenta a 0.9 m/s con oscillazione laterale e rotazione), svanisce in ~3 s. Il varco resta aperto per i lanci successivi.
- Ogni cristallo **frena il pacco**: velocità × (1 − 0.02 / massa) → il piccolo si ferma presto, il grande sfonda. Un tiro standard nel mezzo stacca ~30 cristalli e scende da ~20 a 7 m/s. +2 punti per cristallo.
- **Difficoltà del primo lancio** (546 tiri per pacco): porta 15–26, finestre 5–11, camino 2–9 — più difficile dei fortini (finestre 19–22) finché non si apre un varco: la scelta "sacrifico un lancio per aprire la strada" diventa centrale.
- **Selettore dei livelli**: pulsante "Livelli" (tasto L) e pulsante nel pannello di fine livello; per ora "Il villaggio · albero" e "Il villaggio · fortini". Il livello scelto e il miglior punteggio (stelle) di ciascuno restano salvati sul dispositivo; `?level=<id>` apre direttamente un livello.

### Livello "La collina · fortino ad arcate" (17/11/2026, desktop)
- **Fortino ad arcate** (`snowFort.js`, `arches` nel JSON): 4 pilastri alti 4 file, 3 archi larghi 1.4 m fatti di 5 conci a cuneo ciascuno, riempimenti ai lati della chiave (blocchi composti da due triangoli, perché la forma è concava) e 3 file di mattoni sfalsati sopra, con merli. Stabile: svegliato senza urti si sposta al massimo di 1 cm.
- **Pupazzi in cima**: `"merlon": n` mette un pupazzo sul merlo n-esimo (qui il 2° e il 4°).
- **Case a quote diverse**: nuova **collina** (`hill.js`, altopiano con pendii); le case hanno `y` = quota del terreno. Casa A a terra dietro il fortino, casa B sulla collina a 3 m, con cappello di neve sul camino e punti più alti (porta 200, finestra 700).
- **Crollo**: il pacco grande nel pilastro di sinistra fa cedere gli archi uno dopo l'altro; il muro sopra si accascia e i pupazzi rotolano (uno fino alla porta della casa A). Picco 110 corpi.
- **Difficoltà del primo lancio** (546 tiri per pacco): casa A porta 17–21, finestra 2–4, camino 8–10; casa B porta 13–17, finestra 3–4, camino 1–2 (tappato dalla neve). Anteprima della traiettoria ridotta al 60%.

### Vetri e regia d'apertura (17/11/2026)
- **Vetri**: un pacco rompe sempre il vetro di porte e finestre, a qualunque velocità (anche rotolando); gli altri oggetti (zolle, schegge, palle di neve) solo oltre la soglia di 0.8 N·s.
- **Regia d'apertura** (a ogni avvio, "Riprova" e cambio livello): un unico movimento continuo di 4.2 s lungo una curva (Bézier quadratica con controllo sulla panoramica) dalle case alla zona di lancio: parte lento sulle case con il nome del livello, si allarga verso la panoramica senza fermarsi (al massimo ~39 m di larghezza su 51 nel livello della collina) e rallenta arrivando sulla fionda. Un tocco la salta. Durata in `INTRO.duration`.

### Solo fortini ad arcate (17/11/2026)
Provati e scartati i fortini "a pilastrini e assi" e il muro a traforo: esteticamente poco convincenti. Tutti i fortini sono ora **ad arcate** (i vuoti li danno gli archi). Restano: merli che mancano a caso (25%, mai sotto un pupazzo) e le parti allungate di neve che si spezzano di traverso.
- "Il villaggio · fortini": fortino basso a 2 arcate (pilastri di 3 file) con un pupazzo sul merlo centrale + torretta a 1 arcata alta (pilastri di 5 file).
- "La collina": 3 arcate con 3 file di mattoni sopra e due pupazzi sui merli.

### Spigolo interno del camino (17/11/2026)
- Un pacco che **tocca il lato interno del camino** (le facce interne del condotto e lo spigolo interno della bocca, entro 7 cm, cioè metà del bordo) è consegnato come se fosse entrato. Il controllo avviene sia quando il contatto inizia sia mentre continua (un pacco che scivola dal bordo esterno verso l'interno conta quando arriva allo spigolo). Il bordo esterno e la faccia esterna fanno ancora rimbalzare.
- Verificato facendo cadere il pacco piccolo sulla bocca: centro a 12 e 20 cm fuori dallo spigolo interno → consegnato dal camino; a 36 e 60 cm (bordo esterno) → rimbalza sul tetto.
- La mira mostra più campo a destra: il bordo sinistro si ferma poco dietro la fionda e, tendendo l'elastico, la camera si allarga fino a +7 m.

### Fortini misti neve + ghiaccio, cristalli, igloo (17/11/2026)
- **Fortini misti**: base ad arcate di neve, una fila di mattoni, poi un piano del vecchio "castello di ghiaccio" (colonne e lastre, `ice.floors` nel JSON, colonne più basse: 1–1.1 m) e in cima un **grappolo di cristalli di ghiaccio** (`iceCrystal.js`): tre prismi solidi a base piatta con punta a matita, le punte laterali aperte verso l'esterno. Si frantumano in schegge come le lastre. I pupazzi possono stare sul muro di neve ai lati del piano di ghiaccio.
- **Igloo** (`igloo.js`): cupola di 7 conci di neve appoggiata al terreno, vuota dentro; il concio in chiave ha la faccia superiore piana e regge un **pupazzo**, che diventa un ostacolo alto sulla traiettoria tra i due fortini.
- **"Il villaggio · fortini e igloo"**: fortino a 2 arcate con piano di ghiaccio a 3 campate e cristalli; igloo con pupazzo; torretta a 1 arcata alta con due piani di ghiaccio stretti e cristalli; pupazzo a terra davanti alle case.
- **"La collina"**: 3 arcate + piano di ghiaccio [3, 2] con cristalli in cima e i due pupazzi sul muro ai lati.
- Stabili (svegliati senza urti: si assestano solo i riempimenti accanto agli archi, ~5 cm, nulla si rompe). Un pacco standard sul piano di ghiaccio del primo fortino: spazza il piano, frantuma i cristalli, fa cedere un arco e crollare l'igloo con il pupazzo. Picco 96 corpi.

### Sculture di ghiaccio (17/11/2026)
Al posto del "castello di carte" sopra i fortini, composizioni geometriche di ghiaccio (`iceSculpture.js`, `ice.sculpture` nel JSON), tutte di pezzi solidi che si frantumano; i prismi hanno una faccetta interna disegnata, come una gemma.
- **piramide**: due grandi lastre appoggiate ad A (base piatta, faccia di contatto verticale in cima) con il grappolo di cristalli sotto la punta e due prismi triangolari agli angoli — fortino a 2 arcate del livello 2.
- **torre**: prisma esagonale → lastra → prisma esagonale più piccolo → prisma triangolare — torretta del livello 2. Gli esagoni hanno facce piatte al 70% della larghezza: con facce più strette la lastra sopra faceva da altalena e la torre crollava da sola.
- **ponte**: due prismi esagonali come pile, una lastra sopra con una tenda ad A e due triangoli, cristalli sotto il ponte — livello "La collina", con i pupazzi ai lati (`margin`).
- **Rottura solo per urti veri**: in pre-solve si misura la velocità con cui i due corpi si vengono incontro; sotto 0.6 m/s niente si rompe. Prima, l'assestamento di una pila alta produceva picchi d'impulso che rompevano i mattoni di neve alla base senza alcun colpo.
- Stabili in entrambi i livelli (al risveglio si assestano solo i riempimenti accanto agli archi, ≤ 7 cm). Il pacco grande sulla piramide la frantuma insieme ai cristalli.

### Neve che cade a terra (17/11/2026)
- Quando un pezzo di neve (mattone, zolla, palla, pupazzo) urta il terreno o una collina, la soglia di rottura scende al 20% (`SNOW.groundFactor`). Misurato con un mattone lasciato cadere: da 15 cm resta intero, da 25 cm in su si sbriciola sempre. Resta valida la velocità minima d'impatto (0.6 m/s): i mattoni appoggiati a terra non si rompono e i fortini svegliati senza urti restano intatti.

### Albero sinuoso, cristalli di sette forme, fortini verticali (17/11/2026, solo desktop/Node)
- **Albero**: tronco sinuoso (onda che parte da zero alla base, piede svasato, rastremato) e rami curvi con ondulazione, disegnati come nastri rastremati (`render/treeDraw.js`). Il corpo statico del tronco segue la curva (16 quadrilateri). Parametri in `TREE.trunkSway/branchBend/branchWiggle`.
- **Cristalli di sette forme** (`TREE.shapes`): fiocco, stellina, gemma, piastrina esagonale ai lati dei rami; goccia e stalattite appese sotto; cuscinetto di neve appoggiato sopra. Gocce e stalattiti cadono dritte e più veloci (`TREE.heavyFall`), le altre ondeggiano. Collisioni invariate (punto + raggio). ~137 cristalli, 34 rami.
- **Fortini verticali** (richiesta: obbligare al lancio a parabola): `storeys` nel JSON impila piani ad arcate. Costruzione "da torre vera":
  - pilastri più larghi in basso e archi più stretti in alto (`pierW`, `archW` per piano), ogni piano centrato → sagoma rastremata; sopra i pilastri larghi un blocchetto chiude lo spazio tra i riempimenti;
  - densità per piano `SNOW.storeyDensity` [1.5, 1.0, 0.7]: neve compattata in basso, fresca in cima; la soglia di rottura scala con la densità, i frammenti la ereditano;
  - tra un piano e l'altro l'ultima fila è un **solaio** intero: senza, la torre a 3 piani crollava da sola (le spinte dell'arco superiore facevano scivolare i mattoni sotto i pilastri). Con 20 iterazioni del solver reggeva lo stesso, ma costa 2.5× sul telefono.
- Stabilità (svegliati senza urti, 5 prove): fortini 6.2 cm, collina 7.3 cm, 0 rotture, tutto torna a dormire. Torre di neve della collina da sola: 3.7 cm. Il ponte di ghiaccio della collina ha bisogno di ≥ 3 m di spazio (`margin` 0.9), altrimenti scivola.
- Livelli: "fortini" = torre a 2 piani (6.4 m con la piramide) + igloo + torre a 3 piani (9.4 m con la torre di prismi); "collina" = 2 arcate × 3 piani con ponte e pupazzi (9.7 m).
- **Tiri tesi** (angolo < 35°) che consegnano, 3 pacchi × 546 tiri, senza neve sulle aperture: fortini 109 → 6, collina 74 → 0. Le finestre della casa A, ora coperte dalla torre, sono diventate molto difficili (fortini 83 → 9, collina 35 → 4).

- **Verifica in Chrome** (desktop, estensione Claude in Chrome): albero a 59 FPS; la cima del tronco si assottiglia e finisce arrotondata come un ramo (prima sporgeva un moncone tagliato). Pacco grande teso contro i fortini: spazza piramide e piano alto della prima torre e l'igloo, la torre a 3 piani resta in piedi e il pacco si ferma davanti. Durante il crollo **130 corpi** (tetto `FRACTURE.maxBodies` raggiunto), media 87 FPS ma **un frame da 82 ms**: da alleggerire prima del test sul telefono. Collina: un lancio standard a 47° sfiora la cima della torre e consegna dal camino della casa A.

### Misura del punteggio (17/11/2026)
Griglia completa senza neve sulle aperture (somma dei 3 pacchi): il camino (1000) ha 53–88 tiri validi, le finestre (400–700) 18–81, le finestre delle case B sono il bersaglio più difficile. Restringere la bocca del camino a 1.15 m toglie solo ~25%, togliere lo spigolo interno ~30–45%. L'utente ha chiesto di ribilanciare: scelta del metodo in sospeso. Confermato: una casa può ricevere più pacchi (ognuno conta).

### Fortini in meno pezzi, punteggio per difficoltà, mira (17/11/2026)
- **Fortini semplificati** (`arcadeStorey`): pilastro = un blocco unico per piano; arco = 3 corpi (due "spalle" composte da 2 conci + riempimento + blocchetto sopra il pilastro, e la chiave); file sopra gli archi con mattoni lunghi 1.4 m (`SNOW.longBrick`). Corpi dinamici: fortini 103 → 52, collina 96 → 45. Stabilità migliorata: 1.5 cm e 3.6 cm, 0 rotture.
- Stesso tiro di prova in Chrome (pacco grande teso nel livello fortini): picco 130 → **101 corpi**, frame peggiore 82 → **9 ms**, 30 pezzi rotti; la torre alta resta in piedi.
- **Punteggio per difficoltà** (richiesta dell'utente; formula in `config.js`, valori nei JSON). Tiri validi (3 pacchi × 546, senza neve) → punti:

| Livello | Casa | Porta (tiri → punti) | Finestra | Camino |
|---|---|---|---|---|
| albero | A | 130 → 150 | 53 → 1050 | 76 → 900 |
| albero | B | 63 → 200 | 19 → 1500 | 58 → 1000 |
| fortini | A | 37 → 250 | 11 → 1500 | 75 → 900 |
| fortini | B | 59 → 200 | 19 → 1500 | 49 → 1100 |
| collina | A | 61 → 200 | 4 → 1500 | 52 → 1050 |
| collina | B | 53 → 200 | 7 → 1500 | 33 (5 col cappello di neve) → 1350 |

  Finestra = 1000·√(60/tiri) tra 500 e 1500; camino = 1000·√(60/tiri) tra 800 e 1500 (anche il camino segue la difficoltà, su richiesta dell'utente); porta = 200·√(60/tiri) tra 150 e 400. Misure senza neve sulle aperture: la neve (cappello sul camino, cumulo alla porta) non è ancora considerata nei punti. Soglie delle stelle alzate di conseguenza (villaggi 1800/3500/5500, collina 2000/4000/6000): **provvisorie**, da tarare giocando.
- **Anteprima della traiettoria** più lunga: 1.5 → 2 s (`TRAJECTORY.steps` 120; i livelli ne mostrano la frazione `preview`).
- **Zoom-out durante la tensione** 7 → 12 m (`CAMERA.pullZoomOut`): a tensione massima la vista è 36 × 17 m e comprende torri e case.

### Review di Fable e livello unico "Il villaggio" (18/11/2026)
Review complessiva (Fable) con misure: motore solido, problemi di design (mira troppo sensibile, anteprima inutile al pallonetto, sacrificio incoerente, punteggi incoerenti). Decisioni dell'utente e cosa è stato fatto:
- **Un solo livello** per ora, `il-villaggio`: 1 forte, 1 albero, casa A a terra (cumulo alla porta) e casa B sulla collina a 3 m (cappello sul camino). I vecchi JSON restano in `levels/` ma non sono nell'elenco (usano chiavi superate, es. `merlon`).
- **Forte a strati di pezzi lunghi e cavi** (`layers` in `snowFort.js`, richiesta dell'utente): portale cavo a 2 campate (pilastri e arco in un pezzo), trave lunga, blocco con **oblò** passante (un pacco preciso lo attraversa: terza via oltre a pallonetto e demolizione), trave, torre di ghiaccio e due pupazzi sugli spalti. I pezzi cavi sono composti da strisce convesse. **13 corpi** in tutto il livello; stabilità 0.5 cm, 0 rotture.
- **Sacrificio come vera alternativa**: tiri standard validi dopo un pacco grande sul forte ×1.5–2.9 (prima ×1.0–1.2 nei fortini); base del forte più densa (`dens` 1.8) per non renderlo dominante.
- **Mira**: corsa del dito 1.75× più lunga (`SLING.strokePx` 190 px logici) e risposta dolce (`SLING.soft` 0.5: vicino al massimo la tensione cresce a metà velocità) → sensibilità vicino al massimo ~3.5× più fine (calcolata: camino A da ~2 a ~7 px CSS sull'S21; non ancora provata con un dito vero).
- **Mira provata sull'S21 con tocchi veri** (adb, gesto unico slitta → fionda → mira): corsa piena 342 px fisici (~124 px CSS); verso il camino A il tiro consegna con il dito spostato da 0 a +16 px fisici lungo la direzione di tensione (a −8 entra dalla porta, a +24 dalla finestra della casa B, a −16 e −24 manca): finestra utile ~16–24 px fisici ≈ 6–9 px CSS (prima ~2). 60 FPS, fisica ~1.2 ms.
- **Anteprima di tutto l'arco** fino al terreno o al bordo del livello (`TRAJECTORY.steps` 330).
- **Punteggio solo per difficoltà misurata, neve compresa**: `tools/sim/score.mjs` misura i tiri validi (3 pacchi × 546, 2 semi, con la neve) e scrive i punti con `1000·(60/tiri)^0.75` (50–3000). Il Villaggio: A porta 31.5 → 1600, A finestra 21.5 → 2150, A camino 81.5 → 800, B porta 47.5 → 1200, B finestra 13.5 → 3000, B camino (tappato) 6.5 → 3000.
- **Valore che cala** a ogni consegna nella stessa apertura (`SCORE.repeat` 0.6; verificato: 3000 → 1800 → prossima 1080, etichetta aggiornata).
- **Rotture in base alla superficie** (`SCORE.perArea` 15 punti/m²).
- **Stelle**: 1ª = due consegne meno pagate (2000); 2ª/3ª da `tools/sim/play.mjs` (mediana e 90° percentile del giocatore medio): 2000/4900/7800. Giocatore medio: 88% almeno una stella, 10% tre stelle.
- Pacco grande nel camino: resta ammesso. Codice morto eliminato (`iceTower.js`, fortino a muro, merli).
- Tecnica: generatore casuale con seme (`src/core/rng.js`) per misure riproducibili; turno e riepilogo aspettano che i pacchi siano fermi; tetto dei corpi rigido (`continue`); script di misura in `tools/sim/` (`npm test` = stabilità, `npm run sim:grid|sim:score|sim:play`).

### Ritorno ai fortini ad arcate, nuova disposizione con i pini (18/11/2026)
- L'utente ha scartato il forte a strati (troppo pesante): eliminato il codice, torna il fortino ad arcate a pochi pezzi (2 arcate × 2 piani, rastremato, ponte di ghiaccio, pupazzi sugli spalti). Stabilità 3.5 cm, 0 rotture, 37 corpi (`npm test`, soglia portata a 4 cm).
- Disposizione da sinistra: pino, slitta, fionda, **albero di cristalli subito dopo la fionda**, fortino verso le case, casa A a terra (cumulo alla porta), **pino tra le case**, casa B sulla collina (cappello sul camino), **tre pini** dopo l'ultima casa. Pini: nuovo `pine.js` (corpo statico: tronco + tre piani triangolari, neve disegnata sui rami; costanti `PINE`), tutti uguali (uno più basso).
- Misure: tiri tesi validi 0 (il tronco dell'albero ferma i lanci bassi). Sacrificio: il grande teso si ferma sull'albero; con un pallonetto basso (0.6 rad, 2.0 m) i tiri validi dopo salgono ×2.35.
- Punti rigenerati: A porta 11.5 → 3000, A finestra 6 → 3000, A camino 66.5 → 950, B porta 40.5 → 1350, B finestra 8.5 → 3000, B camino 7 → 3000. Stelle 2300/3100/6900.
- **Livello molto difficile**: giocatore simulato medio 1.6 consegne su 5, 39% senza stelle; quattro aperture al tetto dei 3000. L'utente ha deciso di lasciarlo così e di tarare i punteggi in seguito.

### Prova: castello di carte di ghiaccio e neve (18/11/2026)
Su richiesta dell'utente (foto di un castello di carte), solo per provare l'elemento, livello `prova-carte` (copia del villaggio con il castello al posto del fortino; non calibrato). `cardCastle.js`: piani di tende ad A di lastre di ghiaccio, ogni piano una tenda in meno, separati da blocchi di neve orizzontali appoggiati sulle punte.
- Prima versione instabile: il blocco in cima, appoggiato sulla punta di una sola tenda, scivolava via (equilibrio su uno spigolo) e trascinava tutto. Soluzione: ogni lastra finisce con una **cima piatta** di 12 cm (`cap`), il blocco poggia di piatto. Stabilità: 0–0.6 cm fino a 4 piani, 0 rotture (3 piani: 17 corpi).
- In Chrome: pallonetto del pacco grande → fa cadere solo il blocco in cima e consegna dalla finestra A; colpo teso a metà altezza (0.5 rad) → crolla il piano alto e si spezza il blocco di mezzo, 12 pezzi rotti, picco 35 corpi, frame peggiore 10 ms.

- **Fortino con castello di carte in cima** (proposta dell'utente): base di neve ad arcate, 1 arcata × 2 piani (arcate 1.6/1.5 m, pilastri 1.0/0.9 m), e sopra il castello di carte (`cards` nel fortino: 3 piani di tende piccole, mezza base 0.5 m, alte 1.2 m). Alto 9.3 m, 30 corpi, stabilità 1.1 cm, 0 rotture. In Chrome: pacco grande a 0.6 rad → il castello si affloscia in cima e la base resta in piedi (15 rotti, picco 73 corpi, frame peggiore 9 ms); a 0.5 rad → il colpo spazza via il castello e il piano alto delle arcate, le lastre volano verso la casa A (18 rotti, picco 62 corpi, 9 ms). Livello `prova-carte`.

### Neve più fragile, rotture distribuite sugli step (18/11/2026)
- Richiesta dell'utente: i blocchi di neve si devono frantumare più facilmente. `SNOW.breakImpulse` 0.7 → 0.4, `levelFactor` 1.3 → 1.15, `groundFactor` 0.2 → 0.15. Le strutture svegliate senza urti restano intatte (`npm test`: 0 rotture in entrambi i livelli).
- Effetto (fortino con castello di carte, Chrome): pacco grande a 0.5 rad 18 → 56 pezzi rotti, a 0.6 rad 15 → 27; il fortino si sbriciola invece di restare in blocchi.
- Il primo test ha mostrato uno scatto di 75 ms (decine di rotture nello stesso step). Ora al massimo `FRACTURE.maxPerStep` = 6 rotture per step, le altre restano in coda per gli step seguenti: frame peggiore 9–17 ms, 0 frame oltre 20 ms, picco 65–67 corpi.
- I punti del villaggio non sono stati rigenerati (la taratura è rimandata).

### Renne solide che si spaventano (18/11/2026, anteprima nel gioco)
- Decisione dell'utente: le renne sono corpi solidi, quando vengono colpite si spaventano e (con l'audio) faranno un verso. Implementate in anteprima: `reindeer.js` (corpo statico: per la renna che bruca un ottagono per il tronco + un poligono per collo e testa bassa; per quella di fronte due cerchi; zampe non solide), `reindeerDraw.js` (disegno provvisorio dalla direzione A: due pose, brucare con il muso che si alza, ciglia, coda, lucine; spavento con balzo solo disegnato, testa alzata, occhi sbarrati, orecchie dritte, corna che tremano, "!"), costanti `REINDEER` (durata 1.6 s, balzo 0.35 m, velocità minima 1 m/s, pausa 0.4 s contro i doppi contatti). Il colpo si rileva in begin-contact (solo stato, il mondo non cambia) e il gioco emette l'evento `renna` (aggancio per il verso).
- Posizione: sulla collina dopo la casa B. I tre pini finali coprivano le renne (il pacco si fermava sul pino): livello allungato a x 58.5 e alternati renna che bruca (46.2), pino (49.4), renna di fronte (51.4), pino, pino.
- Provato anche uno stile da cartone piatto (zampe lunghe, nasone, sorrisone, renna in piedi che saluta) su riferimento dell'utente: **annullato** su sua richiesta, restano le renne della direzione A.
- Verificato in Chrome: pacco lasciato cadere sulla renna di fronte → si spaventa (balzo, "!"), evento emesso; pacco sulla renna che bruca → rimbalza sulla schiena, lei alza la testa e salta. Colpire una renna oggi non dà né toglie punti. Punti delle aperture non rigenerati.

### Punto 1 della roadmap: livello chiuso (18/11/2026, notte)
- **Renne: colpirle toglie punti** (decisione dell'utente): `SCORE.reindeerPenalty` = 100, una volta per oggetto e per renna (un pacco che rimbalza sulla testa non toglie punti due volte; verificato in Node: un colpo → un evento, −100). Scritta "−100" rossa che sale; riga "Renne spaventate" nel riepilogo finale; il punteggio non scende sotto zero.
- Fortino del villaggio: nessuna decisione dell'utente su ponte di ghiaccio o castello di carte → resta quello con il **ponte di ghiaccio**; il castello di carte resta nel livello `prova-carte`.
- Punti e stelle rigenerati dopo i cambi (pini e renne spostati, neve più fragile): A porta 14 → 3000, A finestra 5 → 3000, A camino 66.5 → 950, B porta 40.5 → 1350, B finestra 8.5 → 3000, B camino 6 → 3000; stelle 2300/4900/8700. Giocatore simulato medio: 2.4 consegne su 5, 21% senza stelle, 9% tre stelle (taratura fine rimandata dall'utente).

### M4 «ambientazione»: direzione A «Notte di velluto» nel gioco (18–19/11/2026)
Implementata la grafica scelta dall'utente sulle anteprime (pagina di dettaglio della direzione A). Solo disegno: fisica, regole, poligoni e punteggi non sono cambiati.
- **Sfondo in parallasse** (`backdrop.js`), pre-renderizzato offscreen una volta per livello: cielo con luna e 150 stelle (fermo), montagne lontane (fattore 0,04) e medie (0,08), colline morbide (0,14), profilo della città con tetti innevati, campanili e finestre accese (0,40), pini alti con la base sulla linea del terreno (0,58). Ogni piano segue lo zoom della camera solo in parte (`GFX.parallax.*.zoom`), ancorato alla riga dell'orizzonte. 16 stelle tremolano in modo irregolare (tre sinusoidi con periodi 1 : 1,618 : 2,718 più lampi brevi). Per frame: 6 `drawImage`.
- **Disegno in pixel logici** con `view.js` (X/Y/S): la stessa funzione disegna sullo schermo o dentro uno sprite in cache (`makeSprite`, `blit`, `blitAt`).
- **Sprite in cache** per livello e qualità: colline, case (interno a tre locali, muri panciuti, camino curvo, tetto col cappello di neve, telai), pini di gioco (uno per pino, generato dal suo seme: sagome tutte diverse dentro tronco + tre triangoli), slitta, decorazioni, tre tipi di pacco, palle dei pupazzi; per partita: tronco e rami dell'albero; per corpo: pezzi interi di neve e ghiaccio (le spalle degli archi, concave, passano da una maschera unica per non lasciare fili tra i poligoni). Frammenti, zolle e schegge sono disegnati direttamente con due riempimenti.
- **A ogni frame**: terreno sinuoso solo nel tratto in vista (linea d'appoggio dritta, onde sotto la superficie), vetri con traversine finché interi, bagliore delle consegne, fumo dai camini aperti, cristalli dell'albero (un tracciato per forma), renne (`reindeerDraw.js`, invariato), corpi, particelle a tre forme raggruppate per forma e opacità (polvere tonda, schegge, scintille), fionda (riposo, carico, tesa con la sacca dietro il pacco), traiettoria color crema in 4 riempimenti, neve che cade in 3 riempimenti.
- **Testi**: HUD a pillola con i pacchi rimasti e i punti, suggerimento del momento, etichette dei punti con icona (dorate se valgono il massimo, spente con freccina dopo una consegna), titolo d'apertura, pannello finale con stelle. Pulsanti DOM a pillola. Carattere: solo caratteri tondi di sistema (`GFX.font`), nessun download.
- **Decorazioni senza corpo fisico** nel JSON del livello (`decor`: lampione, cartello, due cespugli, slittino; `stones`: tre sassi). Nessun primo piano davanti al gioco.
- **Qualità** (`quality.js`, `GFX.tiers`): alta / media / bassa (densità del canvas 2 / 2 / 1,5; sprite a 96 / 72 / 48 px per metro; fiocchi 90 / 55 / 28; stelle animate 16 / 8 / 0; fumo solo in alta e media; sfondi a densità 1 / 1 / 0,75). Parte da alta e scende da sola se l'intervallo medio tra i frame supera 21 ms per 2,5 s, mai durante un volo; `?qualita=alta|media|bassa` la fissa.
- **Debug**: griglia metrica solo con `?debug`; il riquadro di debug mostra anche tempo di disegno medio e massimo e la qualità; `xmas.perf` e `xmas.quality` da console.
- **Scarti dichiarati tra disegno e collisione**: neve del tetto circa 11 cm sopra la falda e fino a 35 cm sotto la linea di gronda; fiocco dei pacchi, berretto dei pupazzi e punte dei pini entro circa 10–20 cm; pendii della collina entro circa 8 cm.
- **Misure** (Chrome headless su Mac, canvas 2680×1256 a densità 2, crollo del forte con un pacco grande, 240 frame): tempo di disegno medio 0,9–1,1 ms, peggiore 2,1 ms (alta), 3,5 ms (media), 4,1 ms (bassa, canvas 2010 px); intervallo massimo tra due frame 16,8 ms; ricostruzione degli sprite al cambio di qualità 10 ms nel frame peggiore. Sono tempi delle chiamate Canvas lato JavaScript su un computer: **non misurato sul telefono**.
- `npm test` (stabilità: 3,5 cm e 1,1 cm, 0 rotti) e `npm run build` passano.

### M4 nel gioco: verifica e prestazioni (18/11/2026, notte)
- Verificato in Chrome (gioco vero, non solo headless): intro, mira, tiro reale con consegna (+3000 alla porta A, etichetta scesa a 1800 ▼), crollo, renne. Luna abbassata (`GFX.moon`) su segnalazione dell'utente: ora le vette più alte le passano davanti, si legge dietro le montagne.
- **S21: la prima versione andava a 26–38 FPS** (prima di M4: 60). Ricerca per esclusione con il nuovo `?salta=` (debug): sfondo, case, pini e testi pesavano poco; il costo era nei **corpi** (≈ 40 sprite diversi a ogni frame: 60 FPS senza). Convertirli in ImageBitmap non bastava (31 FPS). Soluzione: **atlante** degli sprite piccoli (`GFX.atlas`, 2048 px, `view.js`): tutti i pezzi, pupazzi, pacchi e decorazioni in pochi canvas grandi; case e piani di sfondo come ImageBitmap. Dopo: **58 FPS a qualità alta sia fermo sia durante il crollo** (23 pezzi rotti), 7–8 frame oltre 20 ms su 3–5 s.
- Da sistemare: sul telefono i pulsanti DOM "Livelli"/"Reset" coprono in parte il nome del livello (risolto nel punto 3).

### Punto 3 della roadmap: pulizia e preparazione a M5 (18/11/2026)
Nessun cambio di comportamento: stessa fisica, stesse regole, stesso disegno (tranne la posizione del nome del livello sul telefono).
- **`game.js` diviso** in moduli dentro `src/game/`: `levelBuilder.js` (costruzione dal JSON, stesso ordine), `contacts.js` (callback di contatto: vetri, spigolo del camino, renne, impulsi; frantumazione dei vetri), `turn.js` (lancio, stati del turno, fine livello), `gestures.js` (slitta, mira, pan), `scoring.js` (consegne, punteggio, riepilogo), `intro.js` (regia). `Game` resta la facciata con la stessa API usata da `main.js`, dal disegno e da `tools/sim`.
- **Canale di eventi** (`src/core/emitter.js`, `Game extends Emitter`): `stato`, `tensione`, `annullato`, `lancio`, `rottura`, `vetro`, `consegna`, `renna`, `fine` (dati in HANDOFF §5). Tutti emessi fuori dalle callback di contatto: l'evento `renna` nasce nella callback ma è accodato ed emesso dopo lo step. `onEvent` e `onEnd` tolti (`main.js` usa `game.on('fine')`). Nessun suono ancora.
- **Costanti in `config.js`**: `HOUSE` (muro, gronda, pareti del camino, profondità delle zone, sporgenza della zona porta, vetro, tolleranza dello spigolo del camino — `house.js` le riesporta per il disegno), `SNOW.powder`, `GLASS.shardInherit`, `GESTURE.tapSlop` (12 px), `SCORE.zoneGlow/floaterLife/floaterRise`, `TURN.outMargin`. `SLING.minTension` era già in config.
- **Duplicati tolti**: un solo `GAP` e un solo `ccw()` in `src/physics/polygon.js` (prima in 7 e 3 file), un solo modulo per le curve (`src/core/ease.js`: `easeInOut` della regia, `easeOut` della fionda, che sono curve diverse). Lo spazio tra i pacchi sulla slitta (che si chiamava anch'esso `GAP`) ora è `SPACING`.
- **Loop**: il tetto a 60 FPS scartava i frame quando ne arrivavano prima di 1/60 s, e su 90/144 Hz dava 45/48 FPS. Ora si disegna un aggiornamento dello schermo ogni N (N intero = il più grande con frequenza/N ≥ 60, frequenza stimata dagli intervalli di requestAnimationFrame): cadenza sempre regolare. Scelta: su 90 Hz si disegna a 90 (un accumulatore a 60 esatti alternerebbe 1 e 2 aggiornamenti per frame, a scatti). Simulazione con requestAnimationFrame finto e ±0,5 ms di jitter: 60→60, 75→75, 90→90, 120→60, 144→72, 165→82,5, 240→60 FPS, sempre lo stesso numero di aggiornamenti tra due disegni; il vecchio loop dava 60, 37,5, 45, 60, 48,5 (alternando 2 e 3), 55, 60. La fisica resta a 60 step/s. L'HUD di debug mostra la frequenza stimata e N.
- **Allocazioni per contatto**: un solo `WorldManifold` riusato (`pw.wm`) da velocità d'avvicinamento, vetri e spigolo del camino; la velocità del punto di contatto è calcolata a mano (stesse operazioni di `getLinearVelocityFromWorldPoint`, nessun `Vec2` nuovo).
- **Nome del livello sul telefono**: `main.js` misura il bordo inferiore dei pulsanti DOM e lo passa al disegno in px logici; il nome va sotto (`max(76, bordo + 16)`): su desktop resta dov'era, a 800×360 CSS scende di ~14 px logici. Pulsanti invariati (bersagli da 36 px CSS).
- **Verifica**: misure di riferimento prese prima del lavoro e ripetute dopo, **identiche** (`grid.mjs il-villaggio --json`, `grid.mjs prova-carte --json`, `stab.mjs il-villaggio 1 2`, `sacr.mjs il-villaggio big 0.6 2.0`); in più un'impronta (hash delle posizioni di tutti i corpi a ogni step su 7 lanci in sequenza e 126 lanci con assestamento completo, con consegne, vetri e renne) identica prima e dopo. `npm test` e `npm run build` passano. Chrome headless: nessun errore in console, lancio `xmas.fire('big',0.6,2.0)` con eventi `stato`, `lancio`, 31 `rottura`, `vetro`; in Node anche `consegna`, `renna`, `fine`, `tensione`, `annullato` con gesti simulati. Screenshot a 800×360 CSS densità 3: il nome del livello non è più coperto. **Non provato sul telefono vero.**

- Verifica del thread principale sul punto 3: confronto con il riferimento rifatto in modo indipendente → identico; in Chrome sul Mac un lancio emette lancio, 33 rotture, vetro e i cambi di stato senza errori. Il loop su uno schermo a frequenza variabile (~112–120 Hz) faceva oscillare il divisore tra 1 e 2 (82 FPS irregolari): aggiunta un'isteresi (N cambia solo dopo 30 aggiornamenti concordi) → 60 FPS stabili. **Non riprovato sull'S21** (in standby durante la notte): da confermare FPS col nuovo loop e nome del livello sotto i pulsanti.

### M5 «regia e audio»: suoni, musica, Buone Feste, aperture tappate, accelerazione (18/11/2026)
- **Audio tutto sintetizzato** con Web Audio, nessun file e nessuna libreria, in `src/audio/`: `motore.js` (contesto, bus effetti/musica → master → compressore, rumore bianco condiviso, limite di voci, muto, statistiche), `effetti.js` (i suoni), `musica.js` (sequenziatore con lookahead sul tempo del contesto), `regia.js` (aggancio agli eventi di `Game`, tono dell'elastico seguito a ogni frame, raggruppamento delle rotture, volume della musica, pulsante muto). Costanti in `config.js` (`AUDIO`).
  - Sblocco al primo `pointerdown`/`pointerup`/tasto (lo stesso tocco che chiede lo schermo intero); fuori da un gesto non si prova nemmeno (`navigator.userActivation`), così niente avviso del browser. Pagina nascosta → contesto sospeso, al ritorno riprende. Col muto il contesto viene sospeso del tutto.
  - Evento → suono: `tensione` tono dell'elastico (dente di sega + triangolo filtrati con tremolio, 150→520 Hz con la tensione al quadrato, volume 0,025) · `annullato` "tunf" smorzato · `lancio` schiocco (rumore acuto + twang 260→70 Hz) e fruscio passa-banda che scende, più lungo con la velocità · `rottura` neve: tonfo grave + fruscio passa-basso; ghiaccio: 3–5 tintinnii acuti casuali; pupazzo: tonfo più grave · `vetro` schianto acuto + 9 frammenti · `consegna` campanelle in pentatonica (porta 2 note, finestra 3, camino 5 + accordo e scintillio), nota di partenza da Do5 a Sol5 con i punti (scala logaritmica 50→3000), ripetizioni una nota in meno · `renna` verso buffo (dente di sega con due formanti che scorrono, altezza che sale e ricade, vibrato largo, 0,42 s) · `fine` jingle di campanelle (una nota in più per stella, scintillio con 3 stelle) · `accelera` fruscio veloce.
  - **Rotture raggruppate**: al massimo 2 suoni per materiale ogni 0,1 s (i più forti), le rotture in più alzano il volume del gruppo; volume da `forza` (logaritmico) e `area`. Massimo 14 voci di effetti insieme (i suoni importanti passano comunque).
  - **Musica**: ritornello di "Jingle Bells" (Pierpont, 1857, pubblico dominio) con arrangiamento nostro: melodia pizzicata (triangolo + quadra filtrata) che al giro dopo passa alle campanelle un'ottava sopra; basso um-pa con scalette Do→Fa; sonagli da slitta sugli ottavi; arpeggi di glockenspiel nelle battute a nota tenuta; 2 battute di respiro. Do maggiore, 116 bpm, 18 battute (~37 s). Volume 0,12, scende al 45% durante la mira, al 40% a fine livello (lento, dopo il jingle).
  - **Pulsante muto** (DOM, icona SVG altoparlante, accanto a ⛶) e tasto `M`; preferenza in `localStorage` (`xmas-muto`, con try/catch).
- **Schermata finale «Buone Feste!»**: titolo grande dorato, esito delle case sotto, stelle che si accendono una dopo l'altra, punteggio, dettaglio, "Livelli"/"Riprova" (spostati 16 px più in basso). Entrata con un piccolo rimbalzo (0,35 s). Decorazioni leggere: 46 fiocchi che scendono, tre stelle cadenti a turno, scintille attorno al titolo, festone di lucine colorate e neve sul bordo del pannello. Nessun nome né messaggio personalizzato.
- **Aperture tappate**: finché il cappello di neve sul camino o il cumulo alla porta esistono e sono vicini al posto di partenza (`HOUSE.plugMoved` 0,35 m), l'etichetta dei punti è azzurra con un fiocco di neve e un cuscinetto di neve sopra; torna normale quando la neve è rotta o spostata (`isPlugged` in `house.js`).
- **Tempi morti**: un tocco durante il volo o l'assestamento **accelera** (`FAST.steps` = 4 step fisici per aggiornamento, indicatore ▶▶ al posto del suggerimento "Tocca per accelerare") invece di saltare l'attesa; il turno finisce sempre da solo a pacchi fermi. Gli step sono gli stessi (dt fisso), cambia solo quanti per frame; se gli step extra superano `FAST.budgetMs` (10 ms) in un frame ci si ferma (si accelera meno, l'esito non cambia).
  - Per avere davvero lo stesso esito: il tempo di "già spaventata" delle renne (cooldown 0,4 s) contava in tempo reale (decresceva in `game.frame`), ora in tempo fisico (`game.simTime`); l'animazione resta a tempo reale. Effetto collaterale nelle simulazioni in Node (dove `frame` non gira): prima una renna, dopo il primo spavento, ignorava per sempre gli altri urti; ora dopo 0,4 s di fisica può contarne altri (sempre una volta per oggetto), come nel browser.
- **Verifica**: `npm test` e `npm run build` passano; `grid.mjs il-villaggio --json` **identico** prima e dopo. Accelerazione in Node, con un loop che imita `main.js` (step + `game.frame`) e tocchi veri (`pointerDown` al frame 1, 20 o 90 di ogni turno) su 3 partite intere da 5 pacchi (semi 1–3, con consegne, crolli e renne colpite): punteggio, consegne, rotture, area rotta, penalità, sequenza degli eventi, numero di step e impronta delle posizioni di tutti i corpi a ogni step **identici**; frame da 1431–1636 a 364–749 (4 step per frame). Chrome headless: nessun errore né avviso in console; contesto audio nullo prima del gesto, `running` dopo il primo clic, musica partita; mira con trascinamento vero → `tensione` e musica da 0,134 a 0,072 (con il volume musica di allora, 0,16); rilascio → `lancio`; tocco in volo → ▶▶ e 4 passi per aggiornamento, `accelera`; crollo da 104 eventi di rottura → 43 suoni di neve, 1 di ghiaccio, 2 pupazzi, 1 vetro, al massimo 13 voci, nessuno scartato; muto da pulsante (`localStorage` = 1, contesto sospeso, nessun suono richiesto) e da tasto M, preferenza conservata dopo il ricaricamento; pagina nascosta/visibile → sospeso/ripreso; fine livello → jingle e musica a 0,065. Ogni suono e 39 s di musica resi anche con un `OfflineAudioContext` nel browser: tutti producono segnale (picchi: consegna camino 0,36, jingle 0,41, lancio 0,23, ghiaccio 0,21, renna 0,18, neve 0,13, elastico 0,09, musica 0,11); volumi riequilibrati su queste misure (campanelle dimezzate, schiocco più forte, musica 0,16 → 0,12). **Ascolto reale non fatto** (headless senza uscita audio) e **non provato sul telefono**.

- Verifica del thread principale su M5: griglia identica al riferimento, `npm test` e build ok; in Chrome sul Mac pulsante muto presente, etichette tappate col fiocco, schermata "Buone Feste!". Accettata la correzione della pausa delle renne contata in tempo di fisica (necessaria perché il volo accelerato dia lo stesso punteggio; nelle simulazioni prima la renna ignorava ogni colpo successivo). **Non ascoltato e non provato sull'S21** (notte): da sentire volumi, verso delle renne e crolli; da misurare il volo accelerato sul telefono.

### Ritocchi dopo la prova di M5 (18/11/2026)
- **Albero**: il corpo solido del tronco arriva solo alla prima biforcazione (il ramo principale più basso, ~2.1 m); sopra, tra i rami, il pacco passa e stacca i cristalli. Verificato: pacco tirato a 1.9 m si ferma sul tronco, a 2.5–3.2 m passa. La griglia dei tiri resta identica; il ricalcolo dei punti porta la porta della casa A da 3000 a 2900 (stelle invariate).
- **Elastico**: volume più che dimezzato (0.025 → 0.011) e timbro comico: voce nasale tipo kazoo con vibrato d'intonazione e "vocale" che si apre tirando, più uno squittio di gomma a ogni scatto di tensione.
- **Musica**: dopo il ritornello c'è la strofa (16 battute, accordi Do/Fa/Sol, scalette del basso verso il Fa), poi le 2 battute di respiro.
- **Parallasse**: nell'inquadratura di mira dietro la slitta c'è un gruppo fisso di tre pini; le case del paese iniziano oltre la chioma dell'albero (`GFX.paeseMargine`), dietro la slitta e l'albero resta solo il colle con qualche abete. Le posizioni si calcolano dal punto del mondo all'inquadratura di mira del livello (`level.camera`).
- **Luna** più in alto (y 215 → 165 px, poi 110).
- **Montagne lontane** schiacciate in verticale (vette al 62%) con il fondo delle valli alzato a 110 px sopra l'orizzonte: una catena continua e più bassa dietro le montagne medie (`GFX.montiForma`).
- Sfondo alzato ancora: luna a y 110 px, valli delle montagne lontane a 165 px e medie a 70 px sopra l'orizzonte, profilo del paese +45 px e pini dietro la scena +35 px (`alza` in `GFX.parallax`).
- Tolto il piano delle colline morbide dietro il paese: lo sfondo ora ha 4 piani (montagne lontane, medie, paese, pini).
- Montagne medie (le più vicine) schiacciate al 55% e arrotondate (`tondo` 0.7: profilo a campana, neve senza dentelli), valli a 85 px poi alzate a 165 px: più morbide di quelle lontane.
- Pini dietro la scena: il gruppo dietro la slitta ora è di quattro (il quarto era dietro l'albero di gioco) e fino oltre la chioma dell'albero non ci sono altri pini. Montagne con il gradiente rovesciato: scure in cima e chiare alla base, così il paese e i pini scuri davanti risaltano (`GFX.colors.monti`).
- Gradiente scuro in cima e chiaro alla base anche sul colle del paese, sulla collina dei pini e su ogni pino dietro la scena. Le montagne medie (provato e scartato un profilo a dorsali collinari) restano quelle tonde, traslate di 140 px a sinistra (`sposta` in `GFX.montiForma`).
- **Pino della luna con il gufo**: nel piano dei pini un pino dritto ha la punta al centro della luna nell'inquadratura di mira (posizione calcolata dalla luna e dall'inquadratura, non a mano); in cima un gufo nero in sagoma da cartone (tondo, testa larga con i ciuffetti, alette, zampette, occhioni del colore della luna con pupille e punto di luce) (`GFX.gufo`, colore `GFX.colors.gufo`). Il pino che prima copriva la luna a caso è tolto. Le pupille del gufo si disegnano a ogni frame (`Backdrop.pupille`) e guardano il pacco in volo, altrimenti il mouse o il dito (`hover` in `core/input.js`), con un movimento morbido.
- Cielo più scuro, sempre con il solo gradiente verticale (provato e scartato un gradiente radiale).
- Pini dietro la scena più scuri (toni quasi neri, schiarita verso la base ridotta a 0.1, `GFX.piniSchiarita`) con la neve più chiara e un alone scuro sfumato attorno a ogni pino (`GFX.piniAlone`, dipinto una volta nel piano in cache): le sagome si staccano dalle montagne invece di impastarsi.
- **Consegna**: l'apertura centrata non si illumina più; il punteggio ("+3.000") vola via ben visibile: entra con un rimbalzo elastico, grande (54 px) con alone dorato, ombra e bordo scuro, sale veloce rallentando con una leggera deriva verso l'esterno della casa e svanisce ingrandendosi (2.2 s). Stesso stile, in rosso, per i punti tolti dalle renne.
- Cristalli dell'albero disegnati più grandi del 30% (`TREE.crystalScale`); il raggio di contatto resta quello di prima, il gioco non cambia. La stellina ora è fredda come gli altri cristalli (bianco e azzurro). I cristalli colpiti cadono rapidi per gravità (`TREE.fallGravity`), a terra si fermano e svaniscono in 0.6 s (`TREE.groundFade`); al distacco un tintinnio lieve e acuto (evento `cristalli`, al massimo uno ogni 0.07 s, `AUDIO.crystalGain`). La griglia dei tiri resta identica a quella di riferimento.
- **Pannello Buone Feste**: la neve sul bordo è lo stesso cappello dei tetti (`cappello` in `snow.js`); le lucine spuntano da sotto la neve.

### Consumi sul telefono, testi, musica registrata, costo della fisica (18/11/2026)
- **Consumi per componente** (S21, scena ferma, `npm run phone:consumi`): Chrome ~184% di un core con tutto acceso, 148 con solo il cielo, 6 una pagina vuota. La parte fissa (presentare a 60 FPS un canvas 1536×720) pesa più di tutti i componenti insieme; poi audio ~22, corpi/pini/sfondo ~11–12, terreno e testi ~8 (i testi costano ~1 ms per frame al thread del gioco), il resto sotto il rumore.
- **Testi durante il lancio**: le etichette dei punti delle aperture svaniscono in 0.25 s quando parte il tiro e non si disegnano durante volo e assestamento; ricompaiono a tiro finito. Restano HUD e punteggio che vola via.
- **Musica registrata**: non si sintetizza più nel gioco. `arrangiamento.js` (stesso arrangiamento, stonatura ridotta a 22 cent) si registra con `npm run musica` (OfflineAudioContext in Chrome headless, ciclo chiuso senza stacchi, AAC con afconvert) in `public/audio/musica.m4a` (855 KB, 140.69 s); il gioco la riproduce in loop da un solo buffer. Chrome su Mac e Android toglie il ritardo del codificatore: il buffer dura esattamente il ciclo, loop senza stacchi. Misura: l'audio passa da ~22 a ~17; del resto ~8 è il flusso audio verso l'altoparlante (processo browser) e ~5 il thread audio della pagina, presenti con qualsiasi suono; il compressore vale ~3, la riproduzione della musica ~1.5.
- **Costo della fisica per componente** (S21, dentro la pagina senza disegno, `npm run phone:fisica`, ms per step = per frame): scena ferma 0.14, crollo del fortino 1.35 di media (p95 1.8, picchi 6 alle fratture), tiro nell'albero 0.16. Il **fortino** è quasi tutta la fisica: senza fortino 0.008 a scena ferma e 0.06 nel tiro; i suoi 2 pupazzi valgono circa un quarto del crollo (1.35 → 1.02). L'**albero** non pesa (i cristalli non sono corpi fisici: un pacco nella chioma costa come a scena ferma); renne, pini e case sono corpi statici, sotto il rumore. Con il volo accelerato (4 step per frame) il crollo arriva a ~5.4 ms per frame, ancora sotto i 16.7 ms.

### Prova: fortino stretto con la guglia di ghiaccio (18/11/2026)
- Livello di prova `prova-guglia` (copia del villaggio, Il villaggio non cambia): fortino ad arcate stretto (1 arcata × 2 piani, largo 2.8 m invece di 5.5) con in cima la scultura **"guglia"**: due colonne sottili di cristallo, un grappolo di cristalli appuntiti in mezzo e una lastra sopra, dove sta un pupazzo (`snowmen: [{fort: 0, cima: true}]`).
- Tutto il ghiaccio della guglia è **fragile** (`ICE.fragile` = 0.3: soglia di rottura al 30%): un pacco grande la abbatte già a 3 m/s, il piccolo da 8 m/s; il pupazzo cade e si rompe. Stabile da solo (0.8 cm, nessuna rottura).
- Griglia dei tiri: con il fortino stretto compaiono 4 tiri tesi validi (prima 0) e più consegne in tutte le aperture: il fortino protegge meno.

### Secondo albero di cristalli e radici (18/11/2026)
- **Radici**: alla base degli alberi di cristalli ora ci sono quattro radici curve e rastremate (due per lato, una lunga e una corta) unite al tronco con lo stesso contorno, e un cumulo di neve al piede da cui spuntano; niente più taglio netto sul terreno (solo grafica, `treeDraw.js`).
- **Il villaggio**: il pino tra le due case è sostituito da un albero di cristalli piccolo (x 32.6, tronco 1.5 m, chioma ~2 m). Punti rigenerati con la difficoltà misurata: porta B 1350 → 1300, prima stella 2300 → 2250 (le altre aperture e stelle invariate).
- **Prova guglia**: aggiunto lo stesso albero piccolo (x 33.7) e il pino spostato a 31.5, verso la casa A.
- **Terreno più ondulato** (solo grafica, la fisica resta piatta): il bordo della neve ha cumuli morbidi fino a ~20 cm sopra la linea d'appoggio con un filo d'ombra azzurra sotto la cresta, e tre fasce di neve più in basso con onde più ampie e frequenti (`GFX.terreno`).
- Albero piccolo del villaggio spostato a x 33.4 (punti rigenerati: tornano porta B 1350 e prima stella 2300). Montagne vicine: aggiunto un rilievo tondo innevato a sinistra (x 130 px nell'inquadratura di mira) e spostata di 120 px a destra la vetta alta che stava a 449 px, le altre ferme (`vette` e `spostaVette` in `GFX.montiForma`; posizioni e indici delle vette in console con `__vetteMedie`). Montagne in fondo: la seconda vetta da sinistra alzata di 120 (`alzaVette`), ora supera la quota della neve e ha una spruzzatina in cima (`__vetteLontane` per gli indici). Le montagne in fondo hanno ora forme diverse (`varieta`): aguzza a fianchi concavi, altopiano, asimmetrica (un fianco ripido e uno lungo), doppia con una sella, tonda; la forma viene da un generatore a parte, posizioni e altezze non cambiano. Tolta la vetta che nell'inquadratura di mira stava sotto la luna (`togliVette: [3]`): la luna con il gufo si staglia sulla valle. Nelle montagne in fondo, tra le due colline vicine sotto la luna, spunta un piccolo promontorio innevato dalla forma realistica (`roccia`: asimmetrico, con una spalla sul fianco lungo e piccole irregolarità; x 1005, `vette` con `forma`).

### Tolto il "tocca per accelerare" (18/11/2026)
- Su richiesta dell'utente il tocco durante volo e assestamento non accelera più la simulazione: tolti `Game.accelera`, i passi extra nel loop, l'indicatore ▶▶, il suggerimento, l'evento e il suono `accelera`, la costante `FAST`. Un tocco in volo non fa nulla; il turno finisce a pacchi fermi come sempre.

### Case diverse e cristalli al vento (18/11/2026)
- **Due case diverse** (campo `stile` delle case, solo disegno, più la geometria nel JSON):
  - casa A **baita** (invariata): larga 6.2 m, legno viola, tetto a squame, ghirlanda sul timpano, tre locali (soggiorno con caminetto e albero, cameretta, stanza del gatto);
  - casa B **casetta** (sulla collina): alta e stretta (4.6 × 4.8 m, tetto 3 m più ripido, pareti quasi dritte), legno azzurro, tegole rosse a file, oblò illuminato sul timpano, camino di pietra più stretto (0.8 → 1.35 m) e più basso sulla falda (pos 0.4); due locali: cucina (stufa smaltata con la pentola che fuma, tavola a quadretti con la torta, mensola con i barattoli, il cane che dorme sotto la tavola) e soffitta (carta a righe, libreria, sedia a dondolo con il gomitolo, lampada a stella).
  - Tavolozze in `GFX.colors.stiliCasa`. Punti rigenerati con la difficoltà misurata: invariati (camino B resta 3000 anche più stretto; stelle 2300/4900/8700). Stesse case nella prova guglia.
- **Cristalli al vento**: i cristalli degli alberi ondeggiano lievemente come foglie (ognuno con la sua fase, più una raffica lenta che attraversa la chioma; in alto si muovono di più; gocce e stalattiti dondolano). Solo disegno: le posizioni dei contatti non cambiano (`TREE.vento`).
- **Vetri sempre rotti dalla consegna**: ogni zona di porta e finestra conosce il suo vetro; quando un pacco viene consegnato lì, il vetro si frantuma sempre (schegge, suono). Prima un pacco che rotolava piano verso la porta poteva essere consegnato prima di toccare il vetro (la zona della porta inizia poco prima del vetro) e il vetro restava intero. Verificato sulla griglia: 37 consegne da porte e finestre, 0 vetri rimasti interi. Punti invariati.
- Prova guglia: il pino tra le case spostato subito dopo la casetta, sulla collina (x 44.3). Il sasso che stava sotto le radici dell'albero piccolo (x 33.9) ora è incastonato nel fianco della collina (x 36.6), in entrambi i livelli.

### Tre livelli nuovi a difficoltà crescente (19/11/2026, punti ancora da tarare)
Nati dal livello di prova con il fortino stretto e la guglia; sfondo identico in tutti. Il selettore ora ha solo questi tre (i vecchi JSON restano nella cartella).
| | 1 · Il borgo addormentato | 2 · Il bosco di cristallo | 3 · La vetta del gufo |
|---|---|---|---|
| Scena | 51 m, pianura + rialzo di 1.5 m | 67 m, due colline (2 m e 3.5 m) con avvallamento | 63 m, due gradoni (2.5 m e 5 m) |
| Case | baita a terra (x 22), casetta sul rialzo (x 37.2) | casetta sulla prima collina (x 25.2), baita nell'avvallamento (x 46.4) | baita piccola a terra (x 21.2), casetta sul gradone (x 39.4), casetta in vetta (x 48.3) |
| Ostacoli | albero piccolo, fortino con guglia tra le case | 3 alberi (grande, piccolo, medio), fortino con guglia, igloo con pupazzo davanti alla baita | fortino largo con castello di carte, fortino con guglia sul gradone, albero grande, pupazzo a terra |
| Aperture tappate | 0 | 2 | 3 |
| Renne | 1 | 2 | 3 |
| Traiettoria | 100% | 70% | 45% |
| Griglia (tiri validi tesi) | 219 | 1 | 10 |
- Stabili (`npm test`: 0.8–1.2 cm, nessuna rottura). Tutte le aperture raggiungibili, anche la casa in vetta (camino 12 tiri della griglia, porta 20): non è servito alzare la potenza della fionda.
- **Punti e stelle sono ancora quelli copiati dal livello di riferimento**: da rigenerare con `npm run sim:score` dopo l'approvazione dei livelli.
- Per lo sfondo, il punto da cui iniziano le case del paese considera solo gli alberi dentro l'inquadratura di mira.
- **Seconda stesura dopo la prova dell'utente** (la tabella sopra descrive la prima): (1) gli ostacoli ora coprono le aperture che pagano, così abbatterli conviene; (2) scene più corte e vista di mira che a tensione massima arriva all'ultima casa (`camera.aimMaxW` nel JSON: 42 / 47.5 / 50 m; prima sempre 38).
  - Borgo (51 m): fortino con guglia a 1.3 m dalla baita (x 18.6 → casa a 22.6), casetta sul rialzo a 37.6.
  - Bosco (56 m): due alberi dopo la fionda (9.8 e 14), una sola collina con il fortino con guglia sopra, davanti alla casetta (x 24.4); nell'avvallamento albero piccolo, igloo con pupazzo e baita (x 41.4).
  - Vetta (58.5 m): fortino con carte davanti alla baita piccola, albero a 29.6, gradone da 33.5 con fortino e casetta (x 38), vetta da 45 con la casetta a 45.6.
  - Poi, su richiesta: vista a fionda tesa più stretta nel bosco (`aimMaxW` 43: della baita lontana si vedono porta, finestra e camino) e nella vetta (44.4: l'ultimo camino è tagliato dal bordo destro); traiettoria mostrata più corta: bosco 50%, vetta 30% (prima 70% e 45%). Infine la traiettoria mostrata non è più una frazione del tempo di volo (cresceva con la forza del tiro) ma una **distanza dalla fionda** fissa per livello (`previewDist` nel JSON, metri in linea d'aria dal punto di lancio): borgo arco intero, bosco 12 m, vetta 7 m (poi allungate su richiesta: bosco 26 e poi 31 m, vetta 20, 25 e poi 28 m). Misurato a tensione 1.0 / 1.6 / 2.2: bosco 11.8 / 11.3 / 10.6 m, vetta 6.6 / 6.5 / 6.2 m (l'ultimo punto cade entro il limite).
  - Misure (`sim:grid`, `sacr.mjs`): tiri tesi validi 63 / 1 / 8; dopo un lancio di demolizione i tiri standard validi passano ×1.5 nel borgo (punti medi 330 → 622), ×3 nel bosco, ×2 nella vetta. Stabili (9 ok).

### Renne da cartone animate a fotogrammi (19/11/2026)
- Su richiesta dell'utente (riferimento di stile: l'immagine di renne da cartone incollata il 18/11, non ricalcata): renna ridisegnata a codice in `render/reindeerCartoon.js`: zampe lunghe e sottili, muso lungo con il nasone scuro, sorriso bianco, occhi vicini, corna fini con i rametti, pancia chiara.
- Animazione a fotogrammi (7 al secondo, senza interpolazione), una pellicola di pose per tipo: `bruca` a quattro zampe (mastica a testa bassa con l'erba in bocca, alza il muso, sbatte gli occhi, scodinzola, scalpita); `fronte` in piedi su due zampe (ferma, sbatte gli occhi, saluta, mani sui fianchi, balletto). Colpita: urto, salto a zampe larghe con la lingua fuori e "!", atterraggio tremante.
- Il corpo fisico non cambia. Interruttore `GFX.renne`: l'utente ha poi scelto di tenere per ora la renna di prima, quindi vale 'classica' (`reindeerDraw.js`); 'cartone' riattiva quella nuova.
- Nessuna renna nella zona di lancio: nella Vetta del gufo quella dopo la fionda è andata sulla vetta (ora una a terra dopo la baita e due in vetta).

### Pacchi non consegnati che svaniscono (19/11/2026)
- A fine turno (scena ferma, prima del pacco successivo o del riepilogo) ogni pacco lanciato e non consegnato implode: si rimpicciolisce girando (0.22 s) e lascia una nuvoletta di sbuffi bianchi che si allarga, sale appena e si dissolve (0.75 s), con un "Fiu!" di vento (soffio in un passa-banda stretto che sale di tono, più un fischio leggero; evento `svanito`). Il corpo viene tolto dal mondo: i pacchi fermi non restano più come ostacoli e non possono essere consegnati da un urto successivo. Tempi in `TURN.puffImplode` / `TURN.puffCloud`. La sparizione parte appena la scena è ferma; poi il gioco aspetta ancora 1 s (`TURN.afterPause`) prima di tornare all'inquadratura di mira o al riepilogo, così si vede il pacco svanire (misurato: 1.02 s dalla nuvoletta al ritorno, nuvoletta già dissolta).

### Taratura dei tre livelli e prova sull'S21 (19/11/2026)
Punti dalle difficoltà misurate (`sim:score`, neve compresa), stelle da partite simulate (`sim:play --stars`: 1ª = le due aperture meno pagate, 2ª = mediana del giocatore medio, 3ª = suo 90° percentile).
| Apertura | Borgo | Bosco | Vetta |
|---|---|---|---|
| A porta / finestra / camino | 850 / 3000 / 700 | 1300 / 3000 / 1900 | 2500 / 3000 / 1400 |
| B porta / finestra / camino | 700 / 2100 / 1350 | 2300 / 3000 / 2050 | 1850 / 3000 / 3000 |
| C porta / finestra / camino | — | — | 2100 / 3000 / 2200 |
| Stelle | 1400 / 3400 / 5800 | 3200 / 5700 / 8600 | 3250 / 5200 / 8600 |
| Giocatore medio: stelle 0/1/2/3 | 19 / 32 / 40 / 9 % | 19 / 34 / 38 / 9 % | 15 / 36 / 43 / 7 % |
- S21 (Chrome, qualità alta, canvas 1536×720): i tre livelli partono e si giocano; durante un tiro di demolizione con il pacco grande FPS minimo 52–54 (lo schermo in quel momento andava a 73–79 Hz variabili; a 60 Hz il gioco tiene 60), fisica al massimo 1.8–3.9 ms per frame, disegno peggiore 4.4–5.7 ms. Audio e musica registrata attivi.
- Pannello di fine livello: più aria tra la neve del bordo e "Buone Feste!" (il pannello parte più in alto, contenuti 36 px più giù).

### Consumi, HUD sul telefono, progressione, offline, pulizia (19/11/2026)
- **Pausa a fine lancio** solo se un pacco non consegnato deve svanire (dopo una consegna si torna subito alla mira).
- **Renne da cartone tolte** dal codice (resta la renna di prima).
- **Consumi (S21, scena ferma, `phone:consumi`)**: a scena ferma in attesa del giocatore si disegna un frame ogni due (`IDLE_DIV`, `Game.fermo`; la fisica resta a 60 Hz, al primo gesto o movimento si torna a 60 FPS) e i testi (etichette dei punti, HUD) vengono da una cache in un atlante (`render/textCache.js`). CPU di Chrome 184 → **118**% di un core (−36%): pagina 65 → 45, GPU 108 → 61. I testi ora costano ~1 (prima ~8). La qualità automatica riporta il tempo misurato al frame normale, così i 30 FPS voluti non la fanno scendere.
- **HUD sul telefono**: sull'S21 un px logico vale 0.62 px dello schermo (etichette alte meno di 9 px). Ora HUD, etichette dei punti e dettaglio del riepilogo si ingrandiscono in proporzione sugli schermi piccoli (`HUD.k` = 0.9 / scala, max 1.6: 1.44 sull'S21, 1 su desktop); le etichette ingrandite si scostano dalle aperture.
- **Progressione**: nel pannello finale compare "Avanti ›" se c'è un livello dopo e si è presa almeno una stella; "Stelle in tutto: N su 9" nel pannello e nel selettore (il meglio di ogni livello, su questo dispositivo).
- **Offline e installazione**: `public/sw.js` mette in cache pagina, script, stili, icone e musica alla prima visita; pagina dalla rete se c'è, altrimenti dalla cache. Percorsi relativi (`base: './'`, manifest con `start_url` "."): funziona anche in una sottocartella. Verificato con il build servito in locale e poi il server spento: il gioco parte, musica compresa. (Corretto un primo difetto: i file chiesti con `crossorigin` non combaciavano con la cache per via di "Vary: Origin".)
- **Nome dell'app**: "Biglietto d'auguri - GAME" (titolo della pagina, nome nell'installazione; nome breve sotto l'icona "Auguri"). Il progetto e il repository restano Xmas-26.
- **Descrizioni e condivisione**: in `index.html` descrizione, Open Graph, Twitter card e dati strutturati JSON-LD (VideoGame/WebApplication); `public/og.png` (1200×630, rifatta con `node tools/og/crea-og.mjs`), `robots.txt`, `llms.txt` (descrizione in chiaro per gli assistenti AI). L'indirizzo pubblico va messo in `.env` (`VITE_SITE_URL`, con la barra finale): finché è vuoto og:url e og:image sono relativi e le anteprime sui social non sono garantite. Pulsante **Condividi** (`core/share.js`): pannello di condivisione del dispositivo (Web Share API), altrimenti copia testo e link negli appunti con un avviso.
- **In sospeso — pubblicazione su GitHub Pages**: decisa dall'utente il 19/11, la farà un altro agente. Istruzioni in HANDOFF §9 (indirizzo in `.env`, build, cosa verificare dopo).
- **Pulizia**: tolti i sei vecchi livelli, aggiornati `CLAUDE.md` e HANDOFF (§2, §3, §8, §9).

### Pubblicazione (19/11/2026)
- Storia ripulita dai dati personali (autore e committer di tutti i commit = OverBurt con l'indirizzo noreply di GitHub), repository ricreato per eliminare le copie vecchie, poi reso **pubblico**.
- **GitHub Pages**: https://overburt.github.io/xmas-26/, pubblicato da GitHub Actions (`.github/workflows/pages.yml`) a ogni push su `main`, con l'indirizzo pubblico per le anteprime impostato nel workflow.

### Revisione dopo la prova su telefono: issue #1 (18/11/2026)
Richieste dell'utente raccolte nella issue GitHub #1, fatte tutte e pubblicate la sera stessa.
- **Pagina di avvio**: stato `titolo` del gioco. La scena del livello è ferma nell'inquadratura di mira; sopra, disegnati nel canvas, filo di lucine, titolo dorato «Biglietto d'auguri» con l'etichetta GAME, sottotitolo e pulsante PLAY che pulsa; il gufo sulla luna guarda PLAY. Un tocco, Invio o spazio fanno partire la regia. Con `?level` o `?debug` si salta. I pulsanti rimasti (audio, condividi, installa, schermo intero) vanno in basso a destra per non coprire la luna.
- **HUD**: sul telefono niente nome del livello; durante mira e lancio spariscono i pulsanti e il suggerimento sotto i punti. Livelli e Reset sono icone; nuovo pulsante Installa, visibile solo se il browser offre l'installazione e il gioco non è già installato.
- **Mira più vicina**: vista di 22 m (23 nel terzo livello) invece di 26, bordo sinistro sempre a −1 m: fionda e pacchi sono il 18% più grandi. Tendendo l'elastico la vista si allarga come prima fino a `aimMaxW`.
- **Suono della neve**: «pòf» ovattato (colpetto grave con attacco dolce + sbuffo scuro e corto), valori in `AUDIO.neve`. Non ascoltato dall'agente.
- **Icona e banner**: icona = gufo sulla punta del pino contro la luna (`public/gufo.svg`, PNG con `npm run icone`); banner `og.png` = fotografia della pagina di avvio (`npm run og`).
- **Pagina dei livelli**: pannello come quello finale, una scheda per livello con l'anteprima della scena (`public/livelli/<id>.webp`, `npm run anteprime`), numero, nome, stelle e record.
- **Finestra «Buone Feste»**: quando i pulsanti in alto la toccherebbero scende sotto di loro e, se serve, si rimpicciolisce (`view.panelFit`); i pulsanti restano visibili. Sull'S21 a schermo intero scende di 70 px logici senza rimpicciolirsi.
- **Terzo livello**: l'ultima casa era tagliata in alto dalla vista di volo (cima a 13,5 m con vista alta 13,5). Rilievo da 5 a 4 m e casa cambiata in baita (3,9 + 2,3 m): cima a circa 11,6 m. Livello allungato a x 54,5 per le renne.
- **Primo piano**: ritrovato nell'artefatto di design «Notte di velluto» (piano 1,30, facoltativo, lì sconsigliato perché copre la fascia dove poggiano slitta, fionda e porte). Fatto con cumuli, cespugli e qualche steccato lungo il bordo inferiore; niente davanti a slitta e fionda nell'inquadratura di mira; spento nella qualità bassa.
- **Renna di fianco**: non bruca più. Sta di profilo a testa alta, guarda dritto e ogni 8 s gira la testa verso la camera per 2,6 s; sagoma di collisione con la testa alta. Spaventata guarda in camera con gli occhi sbarrati.
- **Punti e stelle rigenerati** (casa e renna cambiate). Bosco: A porta 1300 → 1350, prima stella 3250, le altre invariate (5700/8600). Vetta: A 2300/3000/1400, B 1800/3000/3000, C 2400/3000/2000; stelle 3200/6700/10000 (prima 3250/5200/8600). Giocatore simulato medio sulla Vetta: 3,06 consegne, mediana 6700, senza stelle 4%, tre stelle 9%: **ora il terzo livello rende più punti del secondo** (mediana 5679, 2,47 consegne), perché la terza casa è più bassa e più larga.
- **Ritocchi chiesti durante la prova** (stessa sera):
  - pagina dei livelli aperta dal pannello finale: si richiudeva subito, perché il clic del rilascio cadeva sulla pagina appena comparsa; ora i clic entro 400 ms dall'apertura si ignorano;
  - pacchi sulla slitta più distanziati (20 cm invece di 8; pianale utile 3,6 m, disegno invariato);
  - durante il livello i pulsanti sono raccolti dietro un pulsante con tre pallini verticali: toccandolo entrano animati uno dopo l'altro, con una piccola etichetta sotto ogni icona; si richiudono ritoccandolo o toccando la scena. Sulla pagina di avvio e nel pannello finale restano tutti in vista;
  - tolto il riquadro di evidenziazione del tocco di Chrome; al tocco l'icona diventa dorata con un bagliore;
  - dopo `TURN.inattivita` = 120 s senza gesti dentro un livello si torna alla pagina di avvio (non con `?level` o `?debug`); provato sull'S21 con 60 s;
  - regia d'apertura: 1 s fermi sulle case col nome del livello (`INTRO.attesa`), poi 6,2 s di movimento con partenza lentissima (3,5% del percorso nei primi 2 s, 61% al quarto), nome visibile fino a circa 4,8 s.
- **Icona vecchia all'installazione** (dopo la pubblicazione): installando dall'S21 compariva ancora il pacco regalo. I file pubblicati erano già quelli nuovi (stessa impronta in rete e nella cache del service worker sul telefono): era Chrome a riusare l'icona scaricata in precedenza con lo stesso indirizzo. Icone rinominate (`gufo.svg`, `gufo-512.png`, `gufo-192.png`, `gufo-180.png`), nel manifest prima i PNG (192 e 512, anche «maskable») e l'SVG per ultimo, service worker `xmas26-v4`. Regola: se l'icona cambia disegno, cambia anche nome.
- **Verifiche**: `npm test` 9 su 9, build riuscita. Chrome desktop: pagina di avvio, mira, pagina dei livelli, renna, terza casa. S21: pagina di avvio (anche a schermo intero), mira con pulsanti e suggerimento nascosti, finestra finale sotto i pulsanti, terza casa intera in volo; disegno 4,1–4,3 ms a scena ferma sul terzo livello, 60 FPS in volo (non a schermo intero, canvas 1194×560). Non verificati: suoni, pulsante Installa premuto davvero, iPhone.

## 8. Decisioni prese (17/11/2026)

### Livelli: 3, difficoltà crescente
Piano iniziale (superato dalle iterazioni): 1 "Il villaggio", 2 "La collina", 3 "La tormenta". **Livelli attuali** (vedi HANDOFF §3):
| Livello | Case | Ostacoli | Preview traiettoria |
|---|---|---|---|
| Il villaggio · albero | 2 case a terra (neve su camino e porta) | albero di cristalli, pupazzo | intera |
| Il villaggio · fortini e igloo | 2 case a terra | fortino a 2 arcate + piramide di ghiaccio, igloo con pupazzo, torretta + torre di prismi, pupazzo | intera |
| La collina | casa a terra + casa su collina a 3 m | fortino a 3 arcate + ponte di ghiaccio, 2 pupazzi | 60% |
| La tormenta (da fare) | — | proposta: seggiovia oscillante + vento | 40% |

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
