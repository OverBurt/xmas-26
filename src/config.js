// Costanti di gioco. Unità del mondo fisico: metri, secondi, kg.

/** Risoluzione logica (rapporto ~2.13:1, smartphone orizzontale). */
export const VIEW_W = 1280;
export const VIEW_H = 600;

/**
 * Tetto al rendering (batteria). Si disegna un frame ogni N aggiornamenti dello schermo, con N intero e fisso
 * (cadenza regolare, niente scatti): N = il più grande intero con frequenza/N ≥ MAX_FPS (vedi src/core/loop.js).
 * 60 Hz → 60 FPS, 90 Hz → 90, 120 Hz → 60, 144 Hz → 72, 240 Hz → 60.
 */
export const MAX_FPS = 60;
/** A scena ferma (in attesa del giocatore, niente in movimento) si disegna un frame ogni IDLE_DIV: meno batteria. */
export const IDLE_DIV = 2;

/** Camera. */
export const CAMERA = {
  bottom: -0.6, // bordo inferiore visibile (m), fisso
  speed: 3.5, // reattività dell'inseguimento (1/s)
  lookAhead: 0.25, // secondi di anticipo sulla velocità del pacco
  flightViewW: 30, // zoom durante il volo
  followMarginTop: 2.5, // spazio sopra il pacco inseguito (m)
  pullZoomOut: 12, // metri di zoom-out extra a tensione massima (parabole alte sopra le torri)
  aimBehind: 1.2, // durante la mira: margine a sinistra oltre la tensione massima, dietro la fionda
};

export const GRAVITY = -10;

/** Timestep fisso del motore. */
export const PHYSICS_DT = 1 / 60;
export const MAX_SUBSTEPS = 3;
export const VELOCITY_ITERATIONS = 8;
export const POSITION_ITERATIONS = 3;

/** Limite di risoluzione del canvas (fill-rate su schermi ad alta densità). */
export const MAX_DPR = 2;

export const GROUND_Y = 0;

/** Lastre di ghiaccio. */
export const ICE = {
  thickness: 0.15,
  columnHeight: 1.5,
  bay: 1.35, // distanza tra i centri delle colonne
  density: 0.9,
  friction: 0.7,
  restitution: 0.05,
  /** Impulso normale (N·s) oltre il quale una lastra intera si rompe. */
  breakImpulse: 1.4,
  /** Ghiaccio fragile (colonne e cristalli della guglia): la soglia di rottura è questa frazione di breakImpulse. */
  fragile: 0.3,
};

/**
 * Neve compatta (mattoni del fortino, cumuli sulle aperture, pupazzi).
 * Si sbriciola in zolle e poi in polvere; assorbe parte della velocità del pacco.
 */
export const SNOW = {
  density: 0.55,
  friction: 0.9,
  restitution: 0.02,
  breakImpulse: 0.4, // impulso per rompere un blocco intero (neve fragile: si frantuma facilmente)
  levelFactor: 1.15, // le zolle richiedono un colpo un po' più forte
  debrisArea: 0.07, // zolle più piccole (m²) si sbriciolano da sole dopo poco
  debrisLife: 1.4,
  kick: 0.35, // separazione delle zolle (m/s): la neve non "esplode" come il ghiaccio
  absorb: 0.8, // velocità residua del pacco dopo aver sfondato un blocco
  groundFactor: 0.15, // cadendo a terra la soglia di rottura è il 15%: un mattone si rompe già da poche decine di cm
  brick: { w: 0.7, h: 0.38 }, // mattoni del fortino (merli e muro semplice)
  longBrick: 1.4, // lunghezza dei mattoni nelle file sopra gli archi dei fortini ad arcate (meno pezzi)
  /**
   * Torri a più piani: moltiplicatore di densità per piano (dal basso). Neve compattata alla base,
   * fresca in cima: il peso grava sui pezzi robusti (pile più stabili) e la cima cade più facilmente.
   * Anche la soglia di rottura scala con la densità.
   */
  storeyDensity: [1.5, 1.0, 0.7],
  /** Polvere (particelle, solo disegno) quando la neve si sbriciola: dimensione (m) e vita (s) min–max, gravità, attrito, apertura. */
  powder: { size: [0.08, 0.22], life: [0.6, 1.3], gravity: 1.5, drag: 2.5, spread: 0.5 },
};

/** Albero con chioma di cristalli di neve (variante al fortino). */
export const TREE = {
  spacing: 0.45, // distanza tra i cristalli nella chioma (m)
  crystalRadius: 0.14, // raggio di contatto di un cristallo
  vento: { ampiezza: 0.035, velocita: 2.2, raffica: 0.45, rotazione: 0.12, pendolo: 0.22 }, // ondeggiamento dei cristalli (m, rad/s, rad): solo disegno
  crystalScale: 1.3, // grandezza disegnata dei cristalli (solo grafica: il contatto resta crystalRadius)
  drag: 0.02, // frenata per cristallo: velocità × (1 − drag / massa del pacco)
  push: 0.15, // frazione della velocità del pacco trasmessa al cristallo che si stacca
  fallGravity: 16, // accelerazione di caduta dei cristalli staccati (m/s²): cadono rapidi a terra
  fallLife: 3, // secondi massimi di vita di un cristallo staccato
  groundFade: 0.6, // arrivato a terra, svanisce in questi secondi
  trunkSway: 0.4, // ampiezza (m) della sinuosità del tronco
  branchBend: 0.45, // curvatura massima (m) dei rami principali; i rametti la metà
  branchWiggle: 0.12, // ondulazione secondaria (m) lungo i rami
  /**
   * Forme dei cristalli e loro frequenza relativa. Gocce e stalattiti pendono sotto i rami,
   * i cuscinetti di neve stanno sopra, le altre forme ai lati.
   */
  shapes: { fiocco: 3, stella: 1.5, gemma: 1.2, esagono: 1, goccia: 1.5, stalattite: 2, neve: 1.5 },
};

/** Pini innevati (ostacoli solidi e cornice ai bordi del livello). */
export const PINE = {
  h: 5.2, // altezza totale (m)
  width: 0.62, // larghezza della base dei rami in rapporto all'altezza
  trunkW: 0.34,
  trunkH: 0.9,
};

/** Renne (decorazione solida che si spaventa quando viene colpita). */
export const REINDEER = {
  scareTime: 1.6, // durata della reazione (s)
  jump: 0.35, // altezza del balzo spaventato (m, solo disegno: il corpo fisico resta fermo)
  minSpeed: 1, // velocità relativa minima (m/s) perché un urto la spaventi
  cooldown: 0.4, // appena spaventata ignora altri contatti per questo tempo (un rimbalzo non fa due versi)
  restitution: 0.45, // il pacco rimbalza
  // renna di fianco (solo disegno): ogni `ciclo` s gira la testa verso la camera per `camera` s; `giro` = durata del movimento
  sguardo: { ciclo: 8, camera: 2.6, giro: 0.35 },
};

/** Pupazzi di neve: corpo unico finché un colpo non li separa in palle che rotolano. */
export const SNOWMAN = {
  splitImpulse: 0.8,
  ballImpulse: 1.6, // una palla si sbriciola solo con un colpo deciso
  radii: [0.5, 0.37, 0.27],
};

/**
 * Casa in sezione (src/entities/house.js; il disegno in src/render/houseDraw.js usa gli stessi valori).
 * Misure in metri.
 */
export const HOUSE = {
  wall: 0.28, // spessore dei muri
  eave: 0.35, // sporgenza della gronda oltre il muro
  chimneyWall: 0.14, // spessore delle pareti del camino
  zoneDepth: 0.6, // profondità della zona di consegna dietro porta e finestre (oltre il muro)
  doorReach: 0.55, // la zona della porta sporge davanti al vetro: metà del pacco grande (0.4) + vetro + margine
  pane: 0.045, // mezzo spessore del vetro
  chimneyEdge: 0.07, // tolleranza per un contatto sul lato interno del camino (metà del bordo superiore): vale la consegna
  plugMoved: 0.35, // neve su camino/porta spostata di più di così (m) non tappa più: l'etichetta torna normale (solo disegno)
};

/** Vetri di porte e finestre: si infrangono se l'urto supera la soglia, altrimenti il pacco rimbalza. */
export const GLASS = {
  breakImpulse: 0.8, // massa × velocità d'impatto normale (N·s)
  density: 1.2,
  friction: 0.3,
  restitution: 0.1,
  slowdown: 0.85, // velocità residua del pacco dopo aver sfondato il vetro
  shardLife: 1.8,
  shardInherit: 0.35, // frazione della velocità di chi rompe il vetro trasmessa alle schegge
};

/** Rottura del ghiaccio (pre-frattura, vedi GDD §2.2). */
export const FRACTURE = {
  maxLevel: 2, // 0 = lastra intera, 1 = pezzo (si rompe ancora una volta), 2 = scheggia finale
  levelFactor: 1.4, // ogni livello richiede un impulso più forte
  minLength: 0.45, // pezzi più corti non si rompono più
  maxBodies: 130, // budget di corpi dinamici: oltre, le rotture vengono saltate
  maxPerStep: 6, // rotture applicate per step fisico; le altre aspettano lo step dopo (crolli senza scatti)
  minImpactSpeed: 0.6, // m/s: sotto questa velocità d'impatto nulla si rompe (pile che si assestano)
  debrisArea: 0.05, // pezzi più piccoli (m²) svaniscono dopo qualche secondo
  debrisLife: 3,
  kick: 0.6, // velocità di separazione dei pezzi (m/s)
};

/** Varianti di pacco (vedi GDD §8). */
export const GIFTS = {
  // damage moltiplica l'impulso d'urto sul ghiaccio
  small: { label: 'piccolo', w: 0.4, h: 0.4, density: 1.5, damage: 0.5, color: '#5fe0b8' },
  standard: { label: 'standard', w: 0.55, h: 0.55, density: 2.0, damage: 1, color: '#ff6f61' },
  big: { label: 'grande', w: 0.8, h: 0.6, density: 3.5, damage: 1.6, color: '#ffc94a' },
};
export const GIFT_FRICTION = 0.5;
export const GIFT_RESTITUTION = 0.3;

/** Fionda (la posizione arriva dal livello). */
export const SLING = {
  grabRadius: 1.2, // raggio di presa attorno al punto di carico (m)
  loadRadius: 2.0, // rilasciando un pacco entro questa distanza la fionda si carica
  armRadius: 0.9, // trascinando un pacco entro questa distanza si arma e si passa a mirare
  maxPull: 2.2, // tensione massima (m)
  power: 11, // velocità = tensione * power  → max ~24 m/s
  /**
   * Corsa del dito per la tensione massima (px logici, vista 1280×600): più lunga della tensione disegnata,
   * così ogni pixel di dito sposta meno il tiro (sull'S21 ~120 px CSS). Oltre ~200 il dito esce in basso
   * nei pallonetti.
   */
  strokePx: 190,
  /**
   * Risposta dolce: tensione = t·(1−soft) + soft·(1−(1−t)²), con t = frazione della corsa.
   * Vicino al massimo la tensione cresce a (1−soft) della velocità lineare: mira più fine sui tiri potenti.
   */
  soft: 0.5,
  minTension: 0.12, // sotto questa tensione il rilascio annulla il tiro
};

/** Gesti sullo schermo (px logici, vista 1280×600). */
export const GESTURE = {
  tapSlop: 12, // un pacco preso dalla slitta e spostato meno di così è un tocco (lo carica), non un trascinamento
};

/**
 * Punteggio. Le consegne valgono quanto scritto nel JSON del livello, generato da `node tools/sim/score.mjs <livello>`
 * con una formula unica per tutte le aperture (solo difficoltà misurata, neve sulle aperture compresa):
 * punti = refPoints · (refHits / tiri validi)^exponent, arrotondati a 50, tra minPoints e maxPoints;
 * tiri validi = consegne su 3 pacchi × 546 tiri della griglia, con la neve al suo posto.
 */
export const SCORE = {
  refHits: 60,
  refPoints: 1000,
  exponent: 0.75,
  minPoints: 100,
  maxPoints: 3000,
  repeat: 0.6, // ogni nuova consegna nella stessa apertura vale il 60% della precedente
  reindeerPenalty: 100, // colpire una renna toglie punti (una volta per spavento)
  perArea: 15, // punti per m² di neve/ghiaccio rotto (un mattone 0.7×0.38 ≈ 4 punti, un blocco cavo grande ≈ 45)
  crystal: 2, // per ogni cristallo staccato dall'albero
  allServedBonus: 1500, // premio se tutte le case ricevono almeno un pacco
  floaterLife: 2.2, // secondi di vita dei punti che volano via dall'apertura ("+1.000")
  floaterRise: 2.2, // velocità iniziale (m/s) con cui salgono; poi rallentano
  floaterDrift: 0.6, // deriva laterale (m/s), verso l'esterno della casa
};

/** Regia d'apertura del livello: un unico movimento continuo case → panoramica → lancio. */
export const INTRO = {
  // Ordine: compare il nome del livello, resta `attesa` secondi, sfuma in `titoloSfuma`, e solo dopo la camera si muove.
  attesa: 2, // s fermi sulle case col nome del livello in vista
  titoloSfuma: 0.8, // s di dissolvenza del nome; il movimento parte quando è sparito
  duration: 6.2, // secondi del movimento: circa 2 di allontanamento lentissimo dalle case, poi accelera e rallenta arrivando sulla fionda
  partenza: 1.4, // quanto è lenta la partenza: esponente applicato al tempo prima della curva (1 = accelera subito; con 1.4 nei primi 2 s si fa il 3% del percorso)
  titoloY: 66, // px logici dall'alto del nome del livello (il sottotitolo sta 48 px sotto): nel cielo, sopra i tetti
};

/** Tempi del turno (s). */
export const TURN = {
  afterPause: 1, // s di attesa a scena ferma prima di tornare alla mira, solo se un pacco non consegnato deve svanire
  puffImplode: 0.22, // s: il pacco non consegnato si rimpicciolisce girando
  puffCloud: 0.75, // s: poi la nuvoletta si allarga e si dissolve
  maxFlight: 8, // dopo questo tempo il volo si considera concluso
  minFlight: 1,
  stopSpeed: 0.3, // pacco "fermo" sotto questa velocità
  maxSettle: 4, // attesa massima che la scena si fermi
  maxGiftWait: 10, // attesa massima che i pacchi lanciati si fermino (poi si va avanti comunque)
  deliveryLinger: 1.6, // dopo una consegna la camera resta sulla casa
  panReturn: 2, // dopo un pan manuale la camera torna alla fionda
  inattivita: 120, // s senza tocchi, clic o tasti dentro un livello: si esce e si torna alla pagina di avvio (non con ?level o ?debug)
  outMargin: 5, // un pacco oltre i limiti del livello (o sotto il terreno) di questi metri è perso
};

export const TRAJECTORY = {
  steps: 330, // passi di simulazione (5.5 s): l'arco intero fino al terreno; il livello ne mostra un tratto lungo `previewDist` metri dalla fionda
  dotEvery: 4,
};

/**
 * Grafica (M4, direzione "Notte di velluto"). Solo disegno: nessun effetto su fisica, regole e punteggi.
 * Colori, piani del parallasse e livelli di qualità stanno qui; il disegno è in `src/render/`.
 */
export const GFX = {
  /** Carattere tondo dei testi a schermo: solo caratteri di sistema (nessun download, funziona offline). */
  font: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif',
  /** Larghezza di vista (m) a cui sono disegnati i piani dello sfondo: a questo zoom la loro scala è 1. */
  refViewW: 34,
  /**
   * Piani del parallasse, dal più lontano. `f` = frazione dello scorrimento della camera;
   * `zoom` = quanto il piano segue lo zoom della camera (0 = scala fissa, 1 = come il piano di gioco).
   */
  parallax: {
    lontane: { f: 0.04, zoom: 0.06 }, // montagne lontane
    medie: { f: 0.08, zoom: 0.12 }, // montagne medie
    paese: { f: 0.4, zoom: 0.45, alza: 45 }, // profilo della città (`alza`: px in più sopra l'orizzonte)
    pini: { f: 0.58, zoom: 0.65, alza: 35 }, // pini alti subito dietro la scena (`alza`: px in più sopra la linea del terreno)
    // primo piano davanti alla scena: cumuli, cespugli e paletti lungo il bordo inferiore. `alto` = altezza della striscia (px),
    // `steccati` e `cespugli` = probabilità accanto a ogni cumulo. Spento nella qualità bassa (tiers.front).
    primo: { f: 1.3, zoom: 1, alto: 64, steccati: 0.35, cespugli: 0.5 },
  },
  /**
   * Forma dei due piani di montagne [lontane, medie]: `scala` schiaccia le altezze delle vette,
   * `valle` (px alla vista di riferimento) alza il fondo delle valli sopra l'orizzonte,
   * `tondo` (0–1) arrotonda cime e piedi (0 = fianchi dritti a punta), `sposta` trasla le vette (px, negativo = a sinistra),
   * `vette` rilievi aggiunti a mano (x in px dello schermo nell'inquadratura di mira), `spostaVette` {indice: px} sposta
   * singole vette generate, `alzaVette` {indice: altezza in più} le alza (oltre la soglia prendono la neve;
   * posizioni e indici in console: `__vetteLontane`, `__vetteMedie`), `togliVette` [indici] le toglie, `varieta` dà a ogni vetta una forma diversa
   * (aguzza, altopiano, asimmetrica, doppia, tonda; `roccia` solo a mano).
   * Le medie, più vicine, sono più basse e più tonde delle lontane.
   */
  montiForma: [{ scala: 0.62, valle: 165, alzaVette: { 2: 120 }, togliVette: [3], varieta: true, vette: [{ x: 1125, h: 400, w: 190, forma: 'roccia' }] }, { scala: 0.55, valle: 165, tondo: 0.7, sposta: -140, vette: [{ x: 130, h: 330, w: 300 }], spostaVette: { 2: 120 } }],
  stars: 150, // stelle fisse dipinte nel cielo
  atlas: { size: 2048, maxSprite: 512, pad: 2 }, // atlante degli sprite piccoli (px): una sola immagine per la scheda video
  moon: { x: 1000, y: 110, r: 44 }, // luna (px logici del cielo): disegnata nel cielo, dietro tutti i piani delle montagne
  pannello: { x1: 920, y0: 16, y1: 516, margine: 8 }, // ingombro del pannello di fine livello (px logici, neve compresa) e distanza minima dai pulsanti in alto e dal bordo in basso
  /**
   * Pagina di avvio (px logici): centro del blocco del titolo, riga del titolo e del sottotitolo, centro e misure del
   * pulsante PLAY (che il gufo guarda). Il blocco sta a sinistra della luna, sopra la slitta e la fionda.
   */
  titolo: { x: 482, y: 122, play: { x: 482, y: 322, w: 250, h: 88 } },
  panelSnowPpm: 60, // scala (px per metro) del cappello di neve sul pannello di fine livello: neve grande come sui tetti
  piniAlone: 18, // sfumatura (px) dell'alone scuro attorno ai pini dietro la scena
  piniSchiarita: 0.1, // pini dietro la scena: quanto schiariscono verso la base (0 = tono pieno); bassa = sagome scure che si staccano dalle montagne
  gufo: { alto: 40, sotto: 27, dx: -15 }, // gufo sul pino della luna (px dello schermo): altezza, punta del pino sotto il centro della luna e spostamento orizzontale dal centro
  labelFade: 0.25, // s di dissolvenza delle etichette dei punti quando parte il lancio (e al ritorno)
  terreno: { orlo: 0.15, fascia: 0.17 }, // ampiezza (m) dei cumuli sul bordo della neve e delle onde delle fasce più in basso (solo grafica)
  hudScaleRef: 0.9, // sotto questa scala (px dello schermo per px logico) HUD ed etichette si ingrandiscono in proporzione
  hudScaleMax: 1.6, // ingrandimento massimo
  hudNomeMax: 1.05, // il nome del livello nell'HUD si mostra solo fino a questo ingrandimento (cioè non sui telefoni)
  paeseMargine: 0.8, // m oltre la chioma più a destra degli alberi da cui iniziano le case del paese (nell'inquadratura di mira)
  /** Livelli di qualità: scelti da soli in base al tempo di frame, oppure con `?qualita=alta|media|bassa`. */
  tiers: {
    alta: { dpr: 2, sprite: 96, layer: 1, snow: 90, twinkle: 16, smoke: true, front: true },
    media: { dpr: 2, sprite: 72, layer: 1, snow: 55, twinkle: 8, smoke: true, front: true },
    bassa: { dpr: 1.5, sprite: 48, layer: 0.75, snow: 28, twinkle: 0, smoke: false, front: false },
  },
  // dpr = densità massima del canvas; sprite = pixel per metro degli sprite in cache; layer = densità dei piani di sfondo;
  // snow = fiocchi che cadono; twinkle = stelle che tremolano; smoke = fumo dai camini aperti; front = primo piano davanti alla scena.
  auto: {
    warmup: 3, // secondi iniziali ignorati (caricamento, costruzione degli sprite)
    window: 2.5, // secondi di misura prima di decidere
    slowMs: 21, // sopra questo tempo medio tra due frame si scende di un livello
  },
  colors: {
    // cielo: gradiente verticale dall'alto all'orizzonte
    cielo: ['#04071a', '#0d143d', '#212765', '#3e3a82'], luna: '#ffe7ad', stelle: '#dfe6ff',
    // Gradienti dei piani [in cima, alla base]: scuriscono salendo, la base chiara fa risaltare le sagome del piano davanti
    monti: [['#2b3172', '#5860ab'], ['#232a66', '#4b539f']], cime: 'rgba(206,216,255,0.34)', // montagne [lontane, medie]
    paeseGrad: ['#151b4c', '#2c357c'], // colle del paese
    paese: '#1a2056', paese2: '#232b6c', paese3: '#2a3378', paeseTetto: '#151a48', paeseNeve: '#6672bd', paeseLuce: '#ffd98a',
    piniLontani: ['#0a0e2e', '#0d1236', '#080b26'], piniNeve: '#9ba7ec', piniAlone: 'rgba(2,3,16,0.75)', piniBase: '#2f3a85', gufo: '#04050d', collinaPini: ['#0f1438', '#262e6e'],
    neve: '#ffffff', neve2: '#dfe8ff', neveFascia: '#c3d2ee', neveOmbra: '#a9bdf0', neveLinea: '#8ea3dc', neveDensa: '#7f9be0',
    ghiaccio: '#8fe9ff', ghiaccio2: '#3aa3ea', ghiaccioBordo: '#eafcff',
    muro: '#9a5d78', muro2: '#6f3f5a', tetto: '#59346a', tetto2: '#3f2450', camino: '#b0655a', camino2: '#7f4447',
    interno: ['#ffe09a', '#f8a652', '#bd5a3c'], vetro: '#c9f3ff', telaio: '#f1cb93',
    // Tavolozze delle case per stile (def.stile): 'baita' (larga, legno viola, tetto a squame) e 'casetta'
    // (alta e stretta, legno azzurro, tegole rosse, camino di pietra). Le chiavi sostituiscono muro/tetto/camino/interno.
    stiliCasa: {
      baita: {},
      casetta: { muro: '#5f84b8', muro2: '#3d5a8c', tetto: '#b9474b', tetto2: '#7c2b39', camino: '#9aa0b8', camino2: '#646a82', interno: ['#fff0b8', '#ffc574', '#d97a4a'] },
    },
    legno: '#bb7f47', legno2: '#7c4f2b', corteccia: '#4f3552', corteccia2: '#7d5a7b', elastico: '#f0553f',
    slitta: '#e03a45', slitta2: '#a3243a', oro: '#ffd36b', oro2: '#d99a2b', verdeacqua: '#35c4a8',
    pino: '#226a5c', pino2: '#174e4a', pietra: '#8992c4', pietra2: '#5a639b',
    verdi: [['#226a5c', '#174e4a'], ['#2f7d58', '#1c5a46'], ['#1f6472', '#154a57'], ['#3a7a4c', '#215438'], ['#27705f', '#184f52']],
    /** Pacchi: [carta, nastro] per tipo. */
    pacchi: { small: ['#4fe0b5', '#ffffff'], standard: ['#ff6f61', '#ffe08a'], big: ['#ffc94a', '#d8344a'] },
    contorno: '#1d1442', traiettoria: '#fff1c2', hud: 'rgba(9,13,42,0.66)', hudBordo: 'rgba(255,255,255,0.18)',
  },
};

/**
 * Audio (M5): tutto sintetizzato con Web Audio (src/audio/), nessun file. Volumi lineari 0–1.
 * Si sblocca al primo tocco/clic/tasto, si sospende quando la pagina è nascosta.
 */
export const AUDIO = {
  master: 0.8, // volume generale
  sfx: 0.9, // bus degli effetti
  music: 0.12, // musica: bassa, sotto gli effetti
  musicAim: 0.45, // durante la mira la musica scende a questa frazione
  musicEnd: 0.4, // a fine livello la musica si attenua a questa frazione (dopo il jingle)
  duckTime: 0.25, // costante di tempo (s) delle variazioni di volume della musica
  tempo: 116, // battiti al minuto della musica
  musicaDurata: 140.6897, // durata musicale (s) della registrazione public/audio/musica.m4a: il loop si ripete esattamente su questa
  musicaGuadagno: 1, // la registrazione è stata abbassata per non saturare: il gioco la riporta al volume originale
  sfasamento: 0.035, // ogni nota della musica anticipa o ritarda a caso fino a questi secondi (0 = a tempo esatto)
  stonatura: 22, // ogni nota della melodia cala o cresce a caso fino a questi cent (100 = un semitono; 0 = intonata)
  maxVoices: 14, // voci di effetti suonabili insieme (oltre, i nuovi suoni deboli vengono scartati)
  /** Rotture raggruppate: al massimo `breakMax` suoni per materiale ogni `breakWindow` s; il resto si somma al volume. */
  breakWindow: 0.1,
  breakMax: 2,
  glassWindow: 0.08, // vetri ravvicinati: un solo suono
  /**
   * Neve che si rompe, un "pòf" ovattato: volume del colpetto grave e dello sbuffo d'aria, attacco del colpetto (s),
   * tono del colpetto [inizio, fine] (Hz), taglio del passa-basso dello sbuffo [inizio, fine] (Hz).
   */
  neve: { colpo: 0.32, sbuffo: 0.22, attacco: 0.014, tono: [150, 58], filtro: [520, 140] },
  crystalGain: 0.8, // volume del tintinnio dei cristalli dell'albero (lieve)
  crystalWindow: 0.07, // cristalli dell'albero staccati di fila: al massimo un tintinnio ogni tanti secondi
  /**
   * Voce dell'elastico durante la mira (kazoo comico): frequenza a riposo e a tensione massima (Hz), volume,
   * formante da "uu" a "ii" (Hz), vibrato (cent a metà tensione), squittii lungo tutta la corsa.
   */
  tension: { f0: 170, f1: 560, gain: 0.011, formant: [650, 1700], vibrato: 40, scatti: 9 },
  storageKey: 'xmas-muto', // preferenze audio (localStorage): JSON {musica: {on, vol}, effetti: {on, vol}}; il vecchio '1'/'0' viene convertito
};
