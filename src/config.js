// Costanti di gioco. Unità del mondo fisico: metri, secondi, kg.

/** Risoluzione logica (rapporto ~2.13:1, smartphone orizzontale). */
export const VIEW_W = 1280;
export const VIEW_H = 600;

/** Tetto al rendering: sugli schermi a 120 Hz si disegna a 60 FPS (batteria). */
export const MAX_FPS = 60;

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
};

/** Albero con chioma di cristalli di neve (variante al fortino). */
export const TREE = {
  spacing: 0.45, // distanza tra i cristalli nella chioma (m)
  crystalRadius: 0.14, // raggio di contatto di un cristallo
  drag: 0.02, // frenata per cristallo: velocità × (1 − drag / massa del pacco)
  push: 0.15, // frazione della velocità del pacco trasmessa al cristallo che si stacca
  fallSpeed: 0.9, // velocità di caduta "a foglia" (m/s)
  airDrag: 3, // quanto in fretta il cristallo rallenta fino alla caduta lenta
  fallLife: 3, // secondi prima di svanire
  trunkSway: 0.4, // ampiezza (m) della sinuosità del tronco
  branchBend: 0.45, // curvatura massima (m) dei rami principali; i rametti la metà
  branchWiggle: 0.12, // ondulazione secondaria (m) lungo i rami
  /**
   * Forme dei cristalli e loro frequenza relativa. Gocce e stalattiti pendono sotto i rami,
   * i cuscinetti di neve stanno sopra, le altre forme ai lati.
   */
  shapes: { fiocco: 3, stella: 1.5, gemma: 1.2, esagono: 1, goccia: 1.5, stalattite: 2, neve: 1.5 },
  heavyFall: 3.5, // gocce e stalattiti cadono dritte, più veloci (× fallSpeed)
};

/** Pini innevati (ostacoli solidi e cornice ai bordi del livello). */
export const PINE = {
  h: 5.2, // altezza totale (m)
  width: 0.62, // larghezza della base dei rami in rapporto all'altezza
  trunkW: 0.34,
  trunkH: 0.9,
};

/** Pupazzi di neve: corpo unico finché un colpo non li separa in palle che rotolano. */
export const SNOWMAN = {
  splitImpulse: 0.8,
  ballImpulse: 1.6, // una palla si sbriciola solo con un colpo deciso
  radii: [0.5, 0.37, 0.27],
};

/** Vetri di porte e finestre: si infrangono se l'urto supera la soglia, altrimenti il pacco rimbalza. */
export const GLASS = {
  breakImpulse: 0.8, // massa × velocità d'impatto normale (N·s)
  density: 1.2,
  friction: 0.3,
  restitution: 0.1,
  slowdown: 0.85, // velocità residua del pacco dopo aver sfondato il vetro
  shardLife: 1.8,
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
  perArea: 15, // punti per m² di neve/ghiaccio rotto (un mattone 0.7×0.38 ≈ 4 punti, un blocco cavo grande ≈ 45)
  crystal: 2, // per ogni cristallo staccato dall'albero
  allServedBonus: 1500, // premio se tutte le case ricevono almeno un pacco
};

/** Regia d'apertura del livello: un unico movimento continuo case → panoramica → lancio. */
export const INTRO = {
  duration: 4.2, // secondi (lento in partenza sulle case e in arrivo sulla fionda)
};

/** Tempi del turno (s). */
export const TURN = {
  maxFlight: 8, // dopo questo tempo il volo si considera concluso
  minFlight: 1,
  stopSpeed: 0.3, // pacco "fermo" sotto questa velocità
  maxSettle: 4, // attesa massima che la scena si fermi
  maxGiftWait: 10, // attesa massima che i pacchi lanciati si fermino (poi si va avanti comunque)
  deliveryLinger: 1.6, // dopo una consegna la camera resta sulla casa
  panReturn: 2, // dopo un pan manuale la camera torna alla fionda
};

export const TRAJECTORY = {
  steps: 330, // passi di simulazione (5.5 s): l'arco intero fino al terreno; il livello ne mostra la frazione `preview`
  dotEvery: 4,
};
