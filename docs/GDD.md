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
- Da sistemare: sul telefono i pulsanti DOM "Livelli"/"Reset" coprono in parte il nome del livello.

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
