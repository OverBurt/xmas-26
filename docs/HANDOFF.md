# Xmas-26 — Handoff guide

> Document to pick up the project without prior context. It describes the current state (17/11/2026),
> how to run and test the game, the architecture, the rules in force, the decisions made with the user and the next steps.
> The detailed, chronological history of every iteration (with measurements) is in [GDD.md](GDD.md), from §7 onwards.

---

## 1. What it is

A Christmas-card **game in JavaScript with 2D physics**, inspired by fling-a-projectile-with-a-slingshot games but **original** in theme and graphics:
from a slingshot on the left you launch **gift parcels** taken from a **sleigh** towards the **houses** on the right, getting past obstacles of
snow and ice that break realistically. A parcel is delivered (and scores points) if it gets in through the **chimney** (most points), a
**window** (medium) or the **door** (low). 5 parcels per level. The core strategy: sacrifice a throw to open the way or try to go over.

- **Target**: smartphone in landscape (primary) + desktop (frame with smartphone proportions).
- **Language** of the UI, of the code comments and of the commits: **Italian**. The user writes in Italian.
- Christmas-card setting: snowy mountain village at night. **No personalised message** (no names in the URL).

## 2. Status

| Phase | Status |
|---|---|
| M0 physics prototype (Planck, stability, performance) | ✅ also verified on the phone |
| M1 mechanics (sleigh, slingshot, single gesture, trajectory, camera) | ✅ also on the phone |
| M2 breakage (pre-fracture, collapses, debris) | ✅ |
| M3 houses, deliveries, scoring, end of level | ✅ also on the phone (before the later iterations) |
| Obstacle iterations (snow, tree, arches, ice sculptures, igloo) | ✅ on desktop only |
| Opening camera sequence, level selector | ✅ (part of M5 brought forward) |
| **M4 setting** (sky, moon, stars, parallax, mountains, falling snow, drawn houses) | ❌ to do — graphics are still **provisional** (flat shapes on a grid) |
| **M5 direction and UX** (audio, "Buone Feste" end screen, HUD, progression between levels) | 🟡 partial |
| **M6 polish** (quality tiers, offline PWA, iOS tests, HTTPS publishing) | ❌ |
| Level 3 "La tormenta" (chairlift + wind) | ❌ only proposed |

**The latest changes (since the "La collina" level onwards) have not been tested on the phone**: it was asleep/locked. Retest on Android (see §4).

## 3. Running the project

```bash
npm install
npm run dev        # Vite on :5173, exposed on the local network (--host)
npm run build      # static output in dist/
```
- `.claude/launch.json` has the `xmas-dev` configuration (for the Claude desktop app's Browser pane).
- URL parameters: `?debug` (HUD with FPS/physics/bodies + "Sveglia pile" and "Stress +40" buttons), `?level=<id>` (opens a level).
- Keys: `R` reset, `L` level selector, `Esc` closes the selector; with `?debug` also `W` wake everything, `S` stress.

### Levels (`src/game/levels/`, order in `index.js`)
| id | Name | Content |
|---|---|---|
| `villaggio-albero` | Il villaggio · albero | tree with snow crystals that fall like leaves, snowman, 2 houses (snow cap on house A's chimney, snow drift at house B's door) |
| `villaggio-fortini` | Il villaggio · fortini e igloo | fort with 2 arches + ice **pyramid** with crystals; **igloo** with a snowman on top; tower with 1 arch + **prism tower**; snowman on the ground |
| `la-collina` | La collina · fortino ad arcate | fort with 3 arches + ice **bridge**, two snowmen at the sides; house A on the ground, house B on a 3 m **hill** (snow cap on the chimney); trajectory preview 60% |

## 4. How to test (important: the user wants verifications, not assumptions)

### In the browser (desktop)
- Open `http://localhost:5173/?debug&level=<id>`. The page exposes `window.xmas`:
  - `xmas.game` — instance of `Game` (state, `pw.world` Planck, `slabs`, `houses`, `forts`, `trees`, `camera`…).
  - `xmas.sim(type, angle, pull)` — simulates a throw in a **separate world** (does not touch the visible game) and returns the opening reached (`'door'|'window'|'chimney'|null`). `angle` in radians above the horizontal, `pull` in metres (max 2.2).
  - `xmas.fire(type, angle, pull)` — performs the throw in the visible game (only in the `ready` state: use `xmas.game.endIntro()` first if the intro is running).
  - `xmas.findShot(type, zone, a0, a1, p0, p1)` — searches for a throw that delivers through an opening.
  - `xmas.wakeAll()`, `xmas.stress()`.
- **Stability test** (always run it after touching structures): save the positions of `game.slabs`, `xmas.wakeAll()`, wait 6–8 s, measure the maximum displacement and `game.fracture.broken`; everything has to go back to sleep (`pw.counts().awake === 0`) without breaking. Current reference: ≤ 5–7 cm (they are the filler blocks beside the outer arches that settle), 0 breaks.
- **Difficulty grid**: loop over `angle 0.1→1.35 step 0.05` × `pull 1.2→2.2 step 0.1` (546 throws per gift) with `new Game(level)` + `launch()` + `step()` up to 480 steps, counting the deliveries per opening. It takes ~30–40 s per level: run it in the background (async) and read the result with a second call (the JS tool has a 45 s timeout).
- Fracture patterns and missing merlons are **random** → the simulations are not perfectly reproducible.
- Vite reloads the whole page when files change (main.js/game.js): wait ~1 s before using `xmas`.
- The user often plays in the same pane while you work: if a test returns strange values, repeat it.

### On a real Android phone (adb)
See [tools/phone/README.md](../tools/phone/README.md): `adb reverse` of port 5173, DevTools via `adb forward`, `cdp.mjs` to evaluate JS in the phone's page, `drag.sh` for real touch gestures, `coords.js` to convert world coordinates → screen pixels. The user's phone: **Samsung Galaxy S21** (Android 15, Chrome 157, 2400×1080, 120 Hz). Never change system settings from the terminal; if the phone is locked, ask the user.

## 5. Architecture

Vite + vanilla JS (ES modules), **Planck.js 1.5** (Box2D port) for physics, **Canvas 2D** drawn procedurally (no sprites). ~3800 lines.

```
src/
├─ main.js               bootstrap: canvas/resize/letterbox, fullscreen, input → game, loop, level selector,
│                        best score (localStorage), debug tools (window.xmas)
├─ config.js             ALL tunable constants (camera, materials, thresholds, scoring, times) — commented
├─ style.css             phone frame on desktop, DOM buttons, selector, "rotate the phone" overlay
├─ core/
│  ├─ loop.js            fixed 1/60 timestep with accumulator + interpolation; rendering capped at 60 FPS
│  ├─ camera.js          side camera: fixed bottom edge, viewW = visible width, smoothed follow, pan, clamp
│  ├─ input.js           unified Pointer Events → logical coordinates 1280×600
│  └─ fullscreen.js      Fullscreen API on the first tap (retries until it succeeds), iOS hint (Add to Home Screen)
├─ physics/
│  ├─ world.js           Planck wrapper: ground, prev-state map for interpolation, events:
│  │                     pre-solve (computes contact.approachSpeed), post-solve (onImpulse with speed), begin-contact
│  ├─ fracture.js        pre-fracture (ice: angled crosscuts; snow: rough lumps; long pieces: crosswise),
│  │                     createIceBody (ice/snow/glass material), compound snow, snowballs,
│  │                     Fracture class: impulse queue → shatter/crumble/splitSnowman after the step, debris that disappears
│  ├─ polygon.js         area, centroid, splitting a convex polygon by a line, sanitize, rect
│  └─ trajectory.js      preview with the same integrator as the engine (matches the real flight)
├─ entities/
│  ├─ gift.js            parcel (bullet = CCD), 3 variants
│  ├─ sleigh.js          sleigh with parcels that are NOT physical (pick in any order)
│  ├─ slingshot.js       arm/load/pull/release; tension → velocity
│  ├─ house.js           house in cross-section: converging walls, door/window openings with glass (separate static bodies),
│  │                     funnel chimney tilted to the left, delivery zones (convex polygons), snow on the openings
│  ├─ hill.js            hill (static trapezoid) for houses at different heights
│  ├─ snowFort.js        snow forts: "wall" type (staggered bricks + merlons) and "arcade" type
│  │                     (piers, arches of wedge-shaped voussoirs, fill blocks, rows of bricks, then an ice sculpture or merlons)
│  ├─ iceSculpture.js    ice compositions: "piramide", "torre", "ponte" (leaning slabs, hexagonal/triangular prisms, crystals)
│  ├─ iceCrystal.js      clusters of 3 solid crystals with flat bases
│  ├─ iceTower.js        old ice "castle of cards" (no longer used in the levels, `towers` in the JSON)
│  ├─ igloo.js           dome of 7 snow voussoirs on the ground, flat keystone (holds a snowman)
│  ├─ snowman.js         snowman = single body (3 circles + flat foot) that splits into balls
│  └─ snowTree.js        tree: static trunk, procedural branches, crystals attached to the branches (non-physical, checked by hand)
├─ game/
│  ├─ game.js            the whole game: level construction, state machine, input, glass, deliveries, scoring, intro
│  └─ levels/*.json + index.js
└─ render/
   ├─ sceneDraw.js       provisional drawing of everything (grid, bodies, houses, tree, sleigh, slingshot, HUD, labels, end panel, intro title)
   └─ particles.js       pool of non-physical particles (shards, snow powder, sparks)
tools/phone/             tests on an Android phone via adb (see above)
docs/GDD.md              design + chronological history of the iterations with measurements
```

### Turn state machine (`game.state`)
`intro` (continuous camera move houses → panorama → sling, 4.2 s, a tap skips it) → `ready` (pick/aim) → `flight` (camera follows the parcel)
→ `settle` (waits for the scene to sleep, max 4 s; 1.6 s minimum after a delivery; a tap skips it) → `ready`… → `end` (when **no parcels are left to throw**: panel with stars, score, "Livelli" / "Riprova").

### Physics: key points
- **Units**: metres, kg, s. Logical view 1280×600 (2.13:1); camera `viewW` = visible metres.
- **Contact skin**: Planck keeps polygons apart by `2·polygonRadius − linearSlop` = 1.5 cm. **Every stacked piece must be created at that distance** (`GAP` constant in the builders), otherwise the stacks "jump". Structures are created **asleep** (`awake:false`).
- **Do not modify the world inside contact callbacks**: breakages, glass, deliveries are queued and applied after `pw.step()` (see `Fracture.process`, `shatterGlass`, `pendingDeliveries`).
- **Breakage**: `post-solve` → `onImpulse(body, impulse, other, approachSpeed)` → `Fracture.hit`. Threshold per material/level (`ICE`, `SNOW`, `SNOWMAN`, `FRACTURE` in config). Parcels multiply the impulse (`damage`: small 0.5, standard 1, big 1.6). **Nothing breaks below 0.6 m/s of approach speed** (without this, settling tall stacks broke the base). Snow that hits the ground/hill: threshold × 0.2.
- **Budget**: max 130 dynamic bodies (breakages beyond that are skipped); small debris disappears (ice 3 s, snow 1.4 s, glass 1.8 s).
- **Glass**: static bodies; in `pre-solve` the contact is disabled when it is to break (the parcel passes through, slowed to 85%); a **parcel always breaks it**, other objects only above 0.8 N·s.
- **Deliveries**: centre of the parcel inside a convex zone of the house (behind a door/window, inside the chimney flue). The door zone reaches 0.55 m **in front** of the glass (a parcel arriving at the door, even rolling, gets in). **Touching the inner side/edge of the chimney** (within 7 cm) counts as a chimney delivery (checked in begin-contact and pre-solve).
- **Tree**: crystals are not bodies; at every step the segment travelled by the parcel (prev→current) is tested against the crystals; each crystal hit falls like a leaf and slows the parcel: `v *= (1 − 0.02/mass)`.

### Level JSON schema
```jsonc
{
  "id": "la-collina", "name": "Titolo · sottotitolo",       // the part before " · " is the intro title
  "bounds": { "minX": -1, "maxX": 50 },                        // horizontal limits of camera/world (m)
  "sleigh": { "x": 0.3 }, "sling": { "x": 5.4, "y": 2.6 },
  "gifts": ["standard", "small", "big", "standard", "small"], // the 5 parcels on the sleigh
  "preview": 0.6,                                              // fraction of the trajectory preview
  "stars": [2000, 3500, 5000],                                 // thresholds for 1–3 stars
  "camera": { "aimCenter": 12, "aimW": 26 },                   // framing at rest on the sling
  "forts": [                                                   // snow forts
    { "x": 12, "arches": 3, "pierRows": 4, "upperRows": 1,     // arcade (without "arches": wall with "cols","rows")
      "ice": { "sculpture": "ponte", "margin": 1.3 },          // ice sculpture on top (piramide|torre|ponte)
      "crenels": true }                                        // merlons (if there is no "ice"); 25% missing at random
  ],
  "snowmen": [ { "fort": 0, "merlon": 1 }, { "x": 24.8 } ],    // on a merlon / beside the sculpture, or on the ground
  "igloos":  [ { "x": 17.9, "r": 1.2, "snowman": true } ],
  "trees":   [ { "x": 18, "trunkH": 2.8, "trunkW": 0.6, "spacing": 0.62, "crown": [ {"dx":0,"dy":2.3,"r":2.4} ] } ],
  "towers":  [ { "x": 14, "floors": [3, 2, 1] } ],             // old ice castle (unused)
  "hills":   [ { "x0": 32.5, "x1": 42, "h": 3.0, "slope": 3.5 } ],
  "houses": [
    { "x": 34, "y": 3.0, "w": 6, "h": 4.0, "roof": 2.5, "lean": 0.6,   // y = ground height
      "door": { "h": 1.9, "points": 200 },
      "windows": [ { "y": 2.25, "h": 1.45, "points": 700 } ],
      "chimney": { "pos": 0.4, "bottom": 0.95, "top": 1.7, "h": 1.4, "tilt": 12, "points": 1000 },
      "snowCap": true, "doorDrift": false }                    // snow plugging the chimney / drift at the door
  ]
}
```

## 6. Game rules in force

- 5 parcels on the sleigh, taken in **any order**. Gestures: drag a parcel onto the slingshot → it arms itself and **the same gesture** continues as aiming; pulling the **empty slingshot** arms the first parcel; tapping a parcel loads it (tapping another swaps them); a drag that is too short cancels. Dragging on empty space moves the view (it comes back after 2 s).
- While aiming the camera **moves to the right** (left edge just behind the slingshot) and widens by up to +7 m with tension. The aim depends only on the finger (camera "frozen" at the start of the gesture).
- Parcels: small 0.4 m (light, damage 0.5), standard 0.55 m, big 0.8×0.6 m (heavy, damage 1.6). Max velocity ~24 m/s.
- **Delivery**: chimney 1000, windows 400–700 (by level), door 150–200. A throw serves at most one house (the parcel disappears). A house can receive several parcels (each one scores).
- **Score** = deliveries + 10 per broken piece of ice/snow + 2 per crystal knocked off the tree + **1500 if every house has received at least one parcel**.
- The level **ends only when the parcels run out**. End panel with stars (level thresholds), details, "Livelli" and "Riprova". Best score per level saved on the device.
- Glass in doors and windows: always broken by a parcel. Snow on the chimney/at the door: has to be removed (it breaks or falls).

## 7. Decisions taken with the user (do not reopen them without asking)

1. **Engine**: Planck.js (Box2D) — chosen for stacking stability and bullet CCD without WASM. Verified on the S21: 158 bodies at 60 FPS.
2. **Platforms**: Android Chrome in landscape + desktop with a frame; fullscreen on the first tap; iPhone via "Add to Home Screen" (PWA manifest present).
3. **3 levels** of increasing difficulty; **no personalised message**; **parcels with physical variants**; **audio: effects + music** (still to do).
4. Original ice "castle of cards" → **rejected as not fitting the theme** (mountain setting). Replaced by snow. The ice came back only as **sculptures** (prisms, leaning slabs, crystals) on top of the forts, at the user's request.
5. Snow forts: **only arcades** are kept. The "posts and planks" structures and the "lattice" wall were tried and **rejected as ugly**.
6. **Crystal tree** (variant): kept, smaller, more visible branches, crystals **attached to the branches** (not uniform).
7. **Igloo with a snowman** between the forts of level 2, to block the trajectory.
8. Houses: **bigger**, walls **converging** upwards, door and windows **as large as possible** with **glass to break**; **funnel** chimney on the **left slope**, tilted to the left; the parcel that rolls up to the door gets in; the inner edge of the chimney counts as a delivery.
9. Snow blocks have to **crumble easily when they fall to the ground**.
10. Opening sequence: **a single continuous move**, without lingering on the panorama.
11. While aiming: **more field to the right**.

## 8. Known issues / open questions

- **Graphics**: everything is still provisional (grid, flat shapes, square particles). The houses are drawn as solid shapes without details.
- **Untested on the phone** since "La collina" onwards (snow, igloo, ice sculptures, glass, intro, chimney edge). Measure FPS during the big collapses (peak ~110 bodies).
- **Scoring balance**: with the funnel chimney (easy when it is not plugged) the chimney worth 1000 is easier than the windows (400–700). The user has not yet decided whether to rebalance.
- Not confirmed by the user: can a house receive several parcels (currently yes)?
- The filler blocks beside the outer arches settle by 4–7 cm when they wake up (harmless, but visible if you look closely).
- The scenery isn't designed for the iPhone: the "rotate the phone" overlay and the hint for adding it to the Home Screen exist, but have never been tested on iOS.
- The old `iceTower.js` and the "wall" fort type (without arches) are no longer used in the levels.
- No automated tests: verification is done in the browser/phone with the `xmas.*` helpers.

## 9. Recommended next steps

1. **Phone test** of the current state (all 3 levels; FPS during collapses; gestures; intro; selector).
2. **M4 setting** (GDD §3 and §5): night-blue gradient sky, bright moon and stars (a few twinkling), parallax on 3+ levels of snowy mountains and hills pre-rendered offscreen, falling snow (pool of particles), houses drawn "in cross-section" with a warm-lit interior, cartoon-style roofs loaded with snow, illuminated windows; snow drawn soft (lumps with rounded edges, white powder instead of squares), ice with reflections; the sleigh and slingshot styled. Keep it light: offscreen layers, DPR ≤ 2, automatic quality tiers.
3. **M5**: Web Audio (band tension, launch, ice/glass/snow, delivery chimes, music loop with mute), "Buone Feste" end screen, progression to the next level, total stars.
4. **Level 3 "La tormenta"**: proposed with a swinging chairlift (Planck joints) and wind that pushes the parcel; to be agreed with the user.
5. **M6**: quality tiers, offline service worker, publishing over HTTPS (installable PWA), iOS test.

## 10. Git and conventions

- Branch `main`. `variante-albero` already merged (fast-forward). Commit messages in Italian, with a short descriptive title and bullet points; final attribution line `Co-Authored-By` as the harness asks.
- Commit only when the user asks for it. Update [GDD.md](GDD.md) (chronological section with measurements) and this file after every significant change.
- Comments and UI texts in Italian; all tunable constants go in `config.js` with a comment.
