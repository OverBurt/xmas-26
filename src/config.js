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
  pullZoomOut: 5, // metri di zoom-out extra a tensione massima
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
  breakImpulse: 0.7, // impulso per rompere un blocco intero
  levelFactor: 1.3, // le zolle richiedono un colpo più forte
  debrisArea: 0.07, // zolle più piccole (m²) si sbriciolano da sole dopo poco
  debrisLife: 1.4,
  kick: 0.35, // separazione delle zolle (m/s): la neve non "esplode" come il ghiaccio
  absorb: 0.8, // velocità residua del pacco dopo aver sfondato un blocco
  brick: { w: 0.7, h: 0.38 }, // mattoni del fortino
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
};

/** Punteggio (le consegne valgono quanto indicato nel JSON del livello). */
export const SCORE = {
  icePerBreak: 10,
  crystal: 2, // per ogni cristallo staccato dall'albero
  allServedBonus: 1500, // premio se tutte le case ricevono almeno un pacco
};

/** Tempi del turno (s). */
export const TURN = {
  maxFlight: 8, // dopo questo tempo il volo si considera concluso
  minFlight: 1,
  stopSpeed: 0.3, // pacco "fermo" sotto questa velocità
  maxSettle: 4, // attesa massima che la scena si fermi
  deliveryLinger: 1.6, // dopo una consegna la camera resta sulla casa
  panReturn: 2, // dopo un pan manuale la camera torna alla fionda
};

export const TRAJECTORY = {
  steps: 90, // passi di simulazione (1.5 s)
  dotEvery: 3,
};
