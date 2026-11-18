# Xmas-26 — Handoff guide

> Document to pick up the project without prior context. It describes the current state (19/11/2026),
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
| **M4 setting** (direction A "Notte di velluto": parallax backdrop, two house styles, snow caps, falling snow, HUD, quality tiers) | ✅ also on the S21 |
| **M5 direction and UX**: audio (synthesized effects + pre-recorded music, separate music/effects volume and mute), "Buone Feste" end screen, plugged-opening labels, **"Avanti" button to the next level, total stars** | ✅ on the S21 too — **sounds never listened to by the agent: the user judges them** |
| Three levels of increasing difficulty, calibrated (19/11) | ✅ |
| **Issue #1 (review after the phone test, 18/11)**: start page with PLAY, graphic level page with previews, icon buttons + Install, buttons hidden while aiming/flying, closer aim view, softer snow sound, owl-in-the-moon icon and banner, end panel clear of the buttons, lower third house on level 3, foreground parallax layer, side reindeer with head up | ✅ on desktop and on the S21, published on 18/11 — **sounds not listened to by the agent** |
| **M6**: quality tiers ✅, idle frame halving + text cache ✅, **offline service worker + installable manifest ✅ (tested with `vite preview`, server stopped)**, HTTPS publishing ✅ (**GitHub Pages: https://overburt.github.io/xmas-26/**, automatic at every push on `main`, see §9), iOS test ❌ (planned by the user) | partial |

## 3. Running the project

```bash
npm install
npm run dev        # Vite on :5173, exposed on the local network (--host)
npm run build      # static output in dist/
```
- `.claude/launch.json` has the `xmas-dev` configuration (for the Claude desktop app's Browser pane).
- URL parameters: `?debug` (HUD with FPS/physics/bodies + "Sveglia pile" and "Stress +40" buttons), `?level=<id>` (opens a level).
- Keys: `R` reset, `L` level selector, `Esc` closes the selector, `M` mute/unmute; with `?debug` also `W` wake everything, `S` stress.

### Levels (`src/game/levels/`, order in `index.js`)
**Current selector (19/11): `borgo-addormentato` (easy), `bosco-di-cristallo` (medium), `vetta-del-gufo` (hard) — points and stars calibrated on 19/11 (GDD, last chronological entries); tested on the S21. Older JSONs are kept in the folder, unlisted.**

- **Il borgo addormentato** (easy): small crystal tree, narrow fort with the fragile ice spire and a snowman right in front of the baita, casetta on a 1.5 m rise; no plugged openings; full trajectory preview.
- **Il bosco di cristallo** (medium): two crystal trees after the sling, one hill with the spire fort in front of the casetta, then a small tree, an igloo with a snowman and the baita; 2 plugged openings; preview up to 31 m from the sling.
- **La vetta del gufo** (hard): wide fort with a card castle in front of a small baita, big tree, a 2.5 m step with the spire fort and a casetta, a 4 m summit with a second small baita (lowered and changed from a casetta on 18/11, issue #1: the tall house was cut off by the flight view); 3 plugged openings; preview up to 28 m. After that change the simulated players score more here (median 6700 vs 5200): stars are now 3200/6700/10000.
Aim view (issue #1): `aimW` 22 m (23 on level 3) with the left edge at −1 m, closer than the previous 26 m so sling and parcels look bigger; pulling the band still widens the view to `aimMaxW`.
Reindeer poses: `fronte` and `fianco` (side view, head up: looks ahead and every `REINDEER.sguardo.ciclo` s turns to the camera; the collision shape has the raised head). `bruca` no longer exists.
Level-specific keys: `camera.aimMaxW` (view width at full pull: must reach the last house), `previewDist` (trajectory shown up to this distance from the sling), house `stile`. The older levels were deleted (git history).

### Start page, level page, images (issue #1)
- **Start page**: on a normal opening the game is in state `titolo` (`Game.showTitle()`): the level is built and still in the aim view, `hudDraw.drawTitle` draws title, lights and the PLAY button on the canvas, the owl looks at PLAY (`GFX.titolo`). A tap anywhere, Enter or Space calls `game.onPlay` → opening sequence. With `?level=` or `?debug` the title is skipped (tools and tests rely on it). On the title only audio/share/install/fullscreen buttons remain, moved to the bottom right.
- **Level page** (`#levels`, DOM): one card per level with a preview image `public/livelli/<id>.webp`, number, name, stars, best score. **Regenerate the previews with `npm run anteprime` when a level changes** (dev server running).
- **Icon** `public/icon.svg`: the gift box on the snow (the owl-in-the-moon icon of issue #1 was published and then withdrawn at the user's request on 18/11; it is in git history, commit `3b60be7`, as `public/gufo.svg`) → `npm run icone` makes `icon-512.png` / `icon-192.png` / `icon-180.png`. **Banner** `public/og.png` = screenshot of the start page → `npm run og` (dev server running). All three use headless Chrome.
- **Buttons during a level**: collapsed behind a three-dot button (`#menu-btn`; classes `.gioco` / `.aperto` on `#controls`, set by `main.js`); opening animates the buttons in with a small label under each (`data-etichetta`); they close on a second tap or on a touch on the scene. On the start page and on the end panel all buttons are visible. Chrome's tap highlight is off; pressed buttons turn gold.
- **Inactivity**: after `TURN.inattivita` (120 s) without pointer/keyboard events inside a level the game resets and returns to the start page (never with `?level` / `?debug`).
- **Opening sequence**: `INTRO.attesa` (1 s still on the houses with the level name), then `INTRO.duration` (6.2 s) with a very slow start (`INTRO.partenza`), level name visible until `attesa + titolo`.
- **Icon file names**: Chrome on Android keeps reusing an icon it already downloaded from the same address (seen on the S21 after publishing the new drawing). When the icon drawing changes, **rename the files** (now back to `icon*.png` / `icon.svg`, the names the gift icon always had) in the manifest, `index.html`, `sw.js` and `tools/og/crea-icone.mjs`. An app installed before the change keeps its old icon until it is removed and installed again.
- **Install button** (`core/install.js`): shown only when the browser fires `beforeinstallprompt` and the game is not running standalone; iOS keeps the Home Screen hint.
- **End panel placement**: `view.panelFit()` moves the panel below the DOM buttons and shrinks it if needed when they would overlap (phones); used by both `drawSummary` and the button hit test in `gestures.js`. `main.js` keeps the buttons' box updated (`setUiBox`).
- **Foreground layer** (`GFX.parallax.primo`, factor 1.3, from the "Notte di velluto" design artifact): low snow mounds, bushes and a few fence posts along the bottom edge, drawn after the scene (`Backdrop.drawFront`), nothing in front of sleigh and sling in the aim view, off in the low quality tier (`tiers.*.front`), `?salta=primo` to switch it off.

### Measurement tools (`tools/sim/`, headless, seeded)
- `npm test` — stability of every listed level (≤ 3 cm, 0 breaks, all asleep).
- `npm run sim:grid -- <id> [--noplug]` — valid shots per opening (3 parcels × 546).
- `npm run sim:score -- <id>` — **regenerates the opening points and the 1st star** in the level JSON (always rerun after changing obstacles), saves the grid for play.
- `npm run sim:play -- <id> [N] [--stars]` — full 5-parcel games with simulated players; `--stars` writes 2nd/3rd star thresholds.
- `node tools/sim/sacr.mjs <id>` — effect of a demolition shot on the following shots.

## 4. How to test (important: the user wants verifications, not assumptions)

### In the browser (desktop)
- Open `http://localhost:5173/?debug&level=<id>`. The page exposes `window.xmas`:
  - `xmas.game` — instance of `Game` (state, `pw.world` Planck, `slabs`, `houses`, `forts`, `trees`, `camera`…).
  - `xmas.sim(type, angle, pull)` — simulates a throw in a **separate world** (does not touch the visible game) and returns the opening reached (`'door' / 'window'|'chimney'|null`). `angle` in radians above the horizontal, `pull` in metres (max 2.2).
  - `xmas.fire(type, angle, pull)` — performs the throw in the visible game (only in the `ready` state: use `xmas.game.endIntro()` first if the intro is running).
  - `xmas.findShot(type, zone, a0, a1, p0, p1)` — searches for a throw that delivers through an opening.
  - `xmas.wakeAll()`, `xmas.stress()`.
  - `xmas.audio` — sound direction: `motore` (`ctx`, `muto`, buses), `musica`, `commuta()` (mute toggle), `stats` = `{suoni: {name: count}, maxVoci, scartati}` (reset by hand, e.g. `xmas.audio.stats.suoni = {}`). The AudioContext exists only after the first real gesture: in headless Chrome use CDP `Input.dispatchMouseEvent` (not `element.click()`), see GDD "M5".
- **Stability test** (always run it after touching structures): save the positions of `game.slabs`, `xmas.wakeAll()`, wait 6–8 s, measure the maximum displacement and `game.fracture.broken`; everything has to go back to sleep (`pw.counts().awake === 0`) without breaking. Current reference: ≤ 3 cm (`npm test`; il-villaggio 0.5 cm) (they are the filler blocks beside the outer arches that settle), 0 breaks.
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
├─ config.js             ALL tunable constants (camera, materials, thresholds, scoring, times, AUDIO) — commented
├─ audio/                Web Audio: effects synthesized live, music played from a pre-recorded file (M5)
│  ├─ motore.js          AudioContext (created on the first gesture), buses sfx/music → master → compressor, shared noise buffer,
│  │                     voice limit (AUDIO.maxVoices), mute (suspends the context, localStorage), visibility suspend/resume, stats
│  ├─ effetti.js         the sounds: band tension (continuous), launch, snow/ice/snowman breaks, glass, delivery bells, reindeer, cancel, jingle, tree crystals
│  ├─ musica.js          plays public/audio/musica.m4a in a seamless loop (one buffer source, decoded once)
│  ├─ arrangiamento.js   "Jingle Bells" chorus + verse (1857, public domain), our arrangement: NOT run in the game, only by tools/audio/registra-musica.mjs (`npm run musica`) to re-record the file
│  └─ regia.js           avviaAudio(game, {button}): game events → sounds, break grouping, music ducking, mute button + M key; `aggiorna()` every frame
├─ style.css             phone frame on desktop, DOM buttons (icons; hidden with `.via` while aiming/flying), level page (cards sized in `--u` = screen px per logical px), "rotate the phone" overlay
├─ core/
│  ├─ loop.js            fixed 1/60 timestep with accumulator + interpolation; FPS cap = draw every N-th screen refresh
│  │                     (N integer, regular cadence: 60 Hz→60, 90→90, 120→60, 144→72); `stats.hz`/`stats.every` in the debug HUD
│  ├─ emitter.js         minimal event channel (on/off/emit), base class of Game
│  ├─ ease.js            the shared easing curves (easeInOut for the intro, easeOut for the slingshot)
│  ├─ camera.js          side camera: fixed bottom edge, viewW = visible width, smoothed follow, pan, clamp
│  ├─ input.js           unified Pointer Events → logical coordinates 1280×600
│  └─ fullscreen.js      Fullscreen API on the first tap (retries until it succeeds), iOS hint (Add to Home Screen)
├─ physics/
│  ├─ world.js           Planck wrapper: ground, prev-state map for interpolation, events:
│  │                     pre-solve (computes contact.approachSpeed), post-solve (onImpulse with speed), begin-contact;
│  │                     `pw.wm` = one WorldManifold reused by every contact callback (no allocation per contact)
│  ├─ fracture.js        pre-fracture (ice: angled crosscuts; snow: rough lumps; long pieces: crosswise),
│  │                     createIceBody (ice/snow/glass material), compound snow, snowballs,
│  │                     Fracture class: impulse queue → shatter/crumble/splitSnowman after the step, debris that disappears
│  ├─ polygon.js         area, centroid, splitting a convex polygon by a line, sanitize, rect, ccw (sort CCW);
│  │                     **`GAP`** (the only definition of the contact skin, imported by every builder)
│  └─ trajectory.js      preview with the same integrator as the engine (matches the real flight)
├─ entities/
│  ├─ gift.js            parcel (bullet = CCD), 3 variants
│  ├─ sleigh.js          sleigh with parcels that are NOT physical (pick in any order)
│  ├─ slingshot.js       arm/load/pull/release; tension → velocity
│  ├─ house.js           house in cross-section: converging walls, door/window openings with glass (separate static bodies),
│  │                     funnel chimney tilted to the left, delivery zones (convex polygons), snow on the openings
│  ├─ hill.js            hill (static trapezoid) for houses at different heights
│  ├─ snowFort.js        snow forts: "wall" type (staggered bricks + merlons) and "arcade" type;
│  │                     `storeys` stacks arcade storeys (tapering piers/arches, denser snow at the base, floor slab between storeys);
│  │                     few large pieces: one block per pier, arches of 3 bodies, long bricks
│  │                     (piers, arches of wedge-shaped voussoirs, fill blocks, rows of bricks, then an ice sculpture or merlons)
│  ├─ iceSculpture.js    ice compositions: "piramide", "torre", "ponte" (leaning slabs, hexagonal/triangular prisms, crystals)
│  ├─ iceCrystal.js      clusters of 3 solid crystals with flat bases
│  ├─ iceTower.js        old ice "castle of cards" (no longer used in the levels, `towers` in the JSON)
│  ├─ igloo.js           dome of 7 snow voussoirs on the ground, flat keystone (holds a snowman)
│  ├─ snowman.js         snowman = single body (3 circles + flat foot) that splits into balls
│  └─ snowTree.js        tree: sinuous static trunk (follows the curve), curvy branches, crystals of 7 shapes on the branches (non-physical, checked by hand)
├─ game/
│  ├─ game.js            facade `Game extends Emitter`: game state + same public API as before (state, step, frame,
│  │                     launch, reset, setLevel, endIntro, pointer*, score…); `step()` orders the phases after pw.step
│  ├─ levelBuilder.js    buildLevel(pw, json) → forts, slabs, trees, hills, pines, reindeer, houses (order matters: seeded rng)
│  ├─ contacts.js        contact callbacks (glass, chimney edge, reindeer, impulses → Fracture), queues, shatterGlass
│  ├─ turn.js            turn states: launch, giftsResting, nextTurn, endLevel, flight/settle transitions
│  ├─ gestures.js        pointerDown/Move/Up: carry from the sleigh, aim (frozen camera), pan; trajectory preview
│  ├─ scoring.js         deliver, deliveries/lost parcels after the step, total score, end-of-level summary
│  ├─ intro.js           opening camera move
│  └─ levels/*.json + index.js
└─ render/
   ├─ sceneDraw.js       orchestrator: builds the caches (per level + quality, per match) and draws the frame in order
   ├─ view.js            current view (X/Y/S metres→pixels), sprites (makeSprite/blit/blitAt), path helpers, seeded rng
   ├─ quality.js         quality tier (alta/media/bassa), automatic step-down, `?qualita=` override
   ├─ backdrop.js        offscreen parallax: sky+moon+stars, far/mid mountains, soft hills, town skyline, tall pines; twinkling stars
   ├─ terrainDraw.js     sinuous ground (per frame, visible span only), hill sprites, stones
   ├─ houseDraw.js       house sprite (three rooms, curved walls and chimney, snow-cap roof); per frame: panes
   ├─ snow.js            materials: cartoon snow blocks, the "cappello" snow cap, ice
   ├─ bodiesDraw.js      dynamic bodies: snow/ice sprites per intact body, direct drawing for fragments, glass shards, snowmen, gifts
   ├─ propsDraw.js       gift sprites, sleigh sprite, slingshot, snowman balls, decorations (lamp post, signpost, bushes, sled)
   ├─ treeDraw.js        crystal tree (trunk sprite + crystals batched by shape) and seeded game pines
   ├─ reindeerDraw.js    reindeer and their scare reaction (draws in world coordinates)
   ├─ weather.js         falling snow (screen-space pool), chimney smoke
   ├─ hudDraw.js         HUD, point labels, floating points, intro title, end panel, trajectory dots
   └─ particles.js       pool of non-physical particles in three shapes (snow dust, shards, sparks), batched by shape and opacity
tools/phone/             tests on an Android phone via adb (see above)
docs/GDD.md              design + chronological history of the iterations with measurements
```

### Turn state machine (`game.state`)
`intro` (continuous camera move houses → panorama → sling, 4.2 s, a tap skips it) → `ready` (pick/aim) → `flight` (camera follows the parcel)
→ `settle` (waits for the scene to sleep, max 4 s; 1.6 s minimum after a delivery) → `ready`… → `end` (when **no parcels are left to throw**: "Buone Feste!" panel with stars, score, "Livelli" / "Riprova").
**No fast-forward** (removed on request, 18/11): a tap during `flight`/`settle` does nothing. Nothing that the physics/rules read may depend on real time: the reindeer "already scared" cooldown uses `game.simTime` (physics time).

### Physics: key points
- **Units**: metres, kg, s. Logical view 1280×600 (2.13:1); camera `viewW` = visible metres.
- **Contact skin**: Planck keeps polygons apart by `2·polygonRadius − linearSlop` = 1.5 cm. **Every stacked piece must be created at that distance** (`GAP` constant in the builders), otherwise the stacks "jump". Structures are created **asleep** (`awake:false`).
- **Do not modify the world inside contact callbacks** (and do not emit events there: a listener could): breakages, glass, deliveries, reindeer events are queued and applied after `pw.step()` (see `Fracture.process`, `contacts.js`: `shatterGlass`, `pendingDeliveries`, `contactEvents`). Callbacks use the shared `pw.wm` WorldManifold: check `contact.getManifold().pointCount` first (with 0 points Planck returns it unfilled).
- **Breakage**: `post-solve` → `onImpulse(body, impulse, other, approachSpeed)` → `Fracture.hit`. Threshold per material/level (`ICE`, `SNOW`, `SNOWMAN`, `FRACTURE` in config). Parcels multiply the impulse (`damage`: small 0.5, standard 1, big 1.6). **Nothing breaks below 0.6 m/s of approach speed** (without this, settling tall stacks broke the base). Snow that hits the ground/hill: threshold × 0.2.
- **Budget**: max 130 dynamic bodies (breakages that would add bodies beyond that are skipped); at most `FRACTURE.maxPerStep` (6) breaks per physics step, the rest wait in the queue (no frame spikes in big collapses); small debris disappears (ice 3 s, snow 1.4 s, glass 1.8 s).
- **Glass**: static bodies; in `pre-solve` the contact is disabled when it is to break (the parcel passes through, slowed to 85%); a **parcel always breaks it**, other objects only above 0.8 N·s.
- **Deliveries**: centre of the parcel inside a convex zone of the house (behind a door/window, inside the chimney flue). The door zone reaches 0.55 m **in front** of the glass (a parcel arriving at the door, even rolling, gets in). **Touching the inner side/edge of the chimney** (within 7 cm) counts as a chimney delivery (checked in begin-contact and pre-solve).
- **Tree**: crystals are not bodies; at every step the segment travelled by the parcel (prev→current) is tested against the crystals; each crystal hit falls like a leaf and slows the parcel: `v *= (1 − 0.02/mass)`.

### Game events (for audio / direction, M5)
`game.on(name, fn)` returns an unsubscribe function; `game.off(name, fn)`; listeners survive `reset()`/`setLevel()`. All emitted outside contact callbacks.

| Event | Data |
|---|---|
| `stato` | `{stato, prima}` turn state change |
| `tensione` | `{tipo}` start of aiming (parcel on the band) |
| `annullato` | `{}` released with too little tension (no throw) |
| `lancio` | `{tipo, x, y, vx, vy, velocita}` (m/s, max ~24) |
| `rottura` | `{materiale: 'ice' / 'snow' / 'snowman', area (m²), x, y, pezzi, forza (N·s), daPacco}` |
| `cristalli` | `{n}` crystals knocked off the tree in this step (emitted after the step) |
| `svanito` | `{tipo, x, y}` an undelivered gift imploding into a puff at the end of the turn (body removed) |
| `vetro` | `{apertura: 'door' / 'window', x, y, daPacco}` |
| `consegna` | `{tipo: 'chimney' / 'window' / 'door', punti, casa (index), ripetizione (1 = first), x, y}` |
| `renna` | `{renna, x, y, colpi, punti (−100), daPacco}` (queued in the callback, emitted after the step) |
| `fine` | end-of-level summary (main.js saves the best score with it; the old `onEnd`/`onEvent` are gone) |

`onLevels()` stays a plain callback (end panel "Livelli" button).

### Sounds (M5, `src/audio/regia.js`, constants in `AUDIO`)
| Event | Sound |
|---|---|
| `tensione` | comic kazoo voice (square + saw an octave below through a band-pass "vowel" opening oo→ee, pitch vibrato widening with tension), 170→560 Hz, low volume (0.011), plus a rubber squeak at each of 9 tension steps; followed every frame while `game.mode === 'aim'` |
| `annullato` | small muffled descending "thunk" |
| `lancio` | snap (noise click + 260→70 Hz twang) + air whoosh, longer/louder with `velocita` |
| `rottura` | snow: soft thump + low-pass rustle; ice: 3–5 crystalline tinkles; snowman: deeper thump. **Grouped**: ≤ `breakMax` (2) sounds per material every `breakWindow` (0.1 s), the strongest; extra breaks raise the group volume. Volume from `forza` (log) and `area` |
| `cristalli` | soft high tinkle (2–4 very short sine pings 3.2–6.8 kHz + faint high-pass noise), at most one every `crystalWindow` (0.07 s), volume `crystalGain` |
| `vetro` | high noise crash + 9 falling shards (one sound per 80 ms) |
| `consegna` | pentatonic bells: door 2 notes, window 3, chimney 5 + chord + sparkle; starting note C5→G5 with points; repeats one note shorter |
| `renna` | funny bleat/honk (saw through two moving formants, pitch up-down, wide vibrato, 0.42 s) |
| `fine` | bell jingle (one more note per star), then music fades to 40% |
Music (pre-recorded in `public/audio/musica.m4a`, AAC 48 kbps mono, 855 KB, 140.69 s cycle = 2 rounds; re-record with `npm run musica` after changing `arrangiamento.js`, then update `AUDIO.musicaDurata`): "Jingle Bells" chorus then verse (16 + 16 bars), own arrangement, every note randomly shifted up to 35 ms and the melody detuned up to 22 cents ("played by hand") (plucked melody that moves to bells every other loop, oom-pah bass, sleigh bells on eighths, glockenspiel arpeggios on held notes, 2 bars of rest), C major, 116 bpm, volume 0.12, 45% while aiming. Max 14 simultaneous effect voices. Mute button `#muto-btn` (SVG speaker) + `M`, saved in `localStorage['xmas-muto']`; muted = context suspended.

### Level JSON schema
```jsonc
{
  "id": "la-collina", "name": "Titolo · sottotitolo",       // the part before " · " is the intro title
  "bounds": { "minX": -1, "maxX": 50 },                        // horizontal limits of camera/world (m)
  "sleigh": { "x": 0.3 }, "sling": { "x": 5.4, "y": 2.6 },
  "gifts": ["standard", "small", "big", "standard", "small"], // the 5 parcels on the sleigh
  "preview": 0.6,                                              // fraction of the trajectory preview
  "previewDist": 12,            // optional: trajectory preview shown only up to this distance (m) from the sling, whatever the pull; replaces "preview"
  "stars": [2000, 3500, 5000],                                 // thresholds for 1–3 stars
  "camera": { "aimCenter": 10, "aimW": 22 },                   // framing at rest on the sling
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
      "snowCap": true, "doorDrift": false,                     // snow plugging the chimney / drift at the door
      "stile": "baita" | "casetta" }                           // drawing only: palette, roof, gable, furnishing (houseDraw.js)
  ]
}
```

## 6. Game rules in force

- 5 parcels on the sleigh, taken in **any order**. Gestures: drag a parcel onto the slingshot → it arms itself and **the same gesture** continues as aiming; pulling the **empty slingshot** arms the first parcel; tapping a parcel loads it (tapping another swaps them); a drag that is too short cancels. Dragging on empty space moves the view (it comes back after 2 s).
- While aiming the camera **moves to the right** (left edge just behind the slingshot) and widens by up to +7 m with tension. The aim depends only on the finger (camera "frozen" at the start of the gesture).
- Parcels: small 0.4 m (light, damage 0.5), standard 0.55 m, big 0.8×0.6 m (heavy, damage 1.6). Max velocity ~24 m/s.
- **Delivery**: one formula for every opening, **measured difficulty only, snow included**: `1000·(60/valid shots)^0.75`, 50–3000, generated by `tools/sim/score.mjs`. Each repeated delivery in the same opening is worth 60% of the previous one. A throw serves at most one house (the parcel disappears). A house can receive several parcels (each one scores).
- **Score** = deliveries + 15 points per m² of broken snow/ice + 2 per crystal + **1500 if every house has received at least one parcel**. Stars: 1st = two cheapest deliveries; 2nd/3rd from simulated players.
- A tap during the flight or the settling **speeds the simulation up** (×4) instead of skipping: the turn still ends only when the parcels are still.
- Opening labels turn **light blue with a snowflake** while a snow plug (chimney cap / door drift) is still in place (`isPlugged`, `HOUSE.plugMoved`).
- The level **ends only when the parcels run out**. End panel with stars (level thresholds), details, "Livelli" and "Riprova". Best score per level saved on the device.
- Glass in doors and windows: always broken by a parcel. Snow on the chimney/at the door: has to be removed (it breaks or falls).

## 7. Decisions taken with the user (do not reopen them without asking)

1. **Engine**: Planck.js (Box2D) — chosen for stacking stability and bullet CCD without WASM. Verified on the S21: 158 bodies at 60 FPS.
2. **Platforms**: Android Chrome in landscape + desktop with a frame; fullscreen on the first tap; iPhone via "Add to Home Screen" (PWA manifest present).
3. **3 levels** of increasing difficulty; **no personalised message**; **parcels with physical variants**; **audio: effects + music** (done in M5, synthesized; music = "Jingle Bells" PD with our own arrangement).
4. Original ice "castle of cards" → **rejected as not fitting the theme** (mountain setting). Replaced by snow. The ice came back only as **sculptures** (prisms, leaning slabs, crystals) on top of the forts, at the user's request.
5. Snow forts: **only arcades** are kept. The "posts and planks" structures and the "lattice" wall were tried and **rejected as ugly**.
6. **Crystal tree** (variant): kept, smaller, more visible branches, crystals **attached to the branches** (not uniform). Trunk and branches **sinuous**, crystals of **many shapes** (drops, snow, icicles…).
12. **Forts are vertical** (tall towers of arcade storeys): they must force a **lob** instead of a direct shot. Stability comes from geometry and weights (taper, denser base, floor slab), not from more solver iterations.
13. **Scoring by measured difficulty only** (single formula, snow plugs included → plugged chimneys pay more), decreasing value for repeated deliveries, breaks proportional to area, 1st star = two deliveries. Big parcel may enter the chimney. A house can receive several parcels — **confirmed**.
14. **One level** for now; arcade fort (the layered fort of long/hollow pieces was tried and **rejected as too heavy**); solid snowy pines as obstacles/frame; the demolition shot must be a real alternative (measured ×2.35 with a low lob over the tree). Aim: longer finger stroke + soft response near max. Preview shows the **whole arc**. Dead code removed.
15. **Reindeer** (M4 setting, two funny reindeer on the hill after house B): **solid bodies** (parcels bounce off, they never break); when hit they get **scared** (jump, wide eyes) and then return to their pose; they will make a **sound** once audio exists (M5); **hitting a reindeer costs 100 points** (once per object and reindeer). The cartoon-style redesign of the reindeer was tried and rejected: keep the direction-A reindeer.
16. Village fort: the user did not choose between the ice-bridge fort and the card-castle fort → the ice bridge stays (card castle in `prova-carte`).
7. **Igloo with a snowman** between the forts of level 2, to block the trajectory.
8. Houses: **bigger**, walls **converging** upwards, door and windows **as large as possible** with **glass to break**; **funnel** chimney on the **left slope**, tilted to the left; the parcel that rolls up to the door gets in; the inner edge of the chimney counts as a delivery.
9. Snow blocks have to **crumble easily when they fall to the ground**.
10. Opening sequence: **a single continuous move**, without lingering on the panorama.
11. While aiming: **more field to the right**.

## 8. Known issues / open questions

- **Audio never listened to by the agent** (no audio output in its browser): kazoo sling voice, recorded music, crystal tinkle, "Fiu!" of vanishing gifts, volumes. The user judges them; tune `AUDIO` / `effetti.js`.
- **iOS never tested** (rotate overlay, Home Screen hint, audio unlock on first touch, AAC loop, service worker): planned by the user.
- **Social previews need the public URL**: set `VITE_SITE_URL` in `.env` (with trailing slash) before building, otherwise `og:url`/`og:image` stay relative. App name shown to players: "Biglietto d'auguri - GAME" (project/repo stay Xmas-26).
- **Published** on GitHub Pages (public repository `OverBurt/xmas-26`): every push on `main` rebuilds and republishes through `.github/workflows/pages.yml`.
- Text uses system rounded fonts only (`GFX.font`); on devices without one it falls back to the system sans.
- The drawing deliberately exceeds the physical polygons in a few places (roof snow, gift bows, snowman hats, enlarged tree crystals, ground snow mounds): see GDD.
- Idle frame halving (`IDLE_DIV`): ambient animations (snow, stars, crystals in the wind) run at 30 FPS while the scene waits for the player; any gesture or movement brings back 60.
- After changing obstacles or houses always rerun `npm run sim:score -- <id>` and `npm run sim:play -- <id> --stars`.
- Level 3 is now easier than before for the simulated players (third house lower and wider): if it must stay the hardest, plug or shrink an opening and rerun score/play.
- On level 3 the card castle reaches the moon in the aim view (it did already with the wider view).
- Service worker (now `xmas26-v5`, it also pre-caches the level previews — the list of names is in `sw.js`): bump `VERSIONE` in `public/sw.js` when publishing a new build if stale files must be dropped at once.
- Automated checks: only `npm test` (stability); the rest is verified with the `tools/sim` measurements and in the browser/phone with the `xmas.*` helpers.

## 9. Recommended next steps

1. **Published on GitHub Pages** (19/11): https://overburt.github.io/xmas-26/ — **how publishing works and the rules for every agent: §11**.
   Still to check by hand: social preview with a link debugger, install as an app on Android (Chrome reports no installability errors), "Condividi" on the phone.
2. **iOS test** (user, planned): layout, audio, offline.
3. Listen to the audio on the phone and tune volumes.
4. Optional: more levels; unlock levels by stars (today all are selectable).

## 10. Git and conventions

- Branch `main`, remote `origin` = **public** repository `github.com/OverBurt/xmas-26` (every push on `main` is published, see §11). `variante-albero` already merged (fast-forward), only local. `.env` and `.idea/` are not versioned (template in `.env.example`). Commit messages in Italian, with a short descriptive title and bullet points; final attribution line `Co-Authored-By` as the harness asks.
- Commit only when the user asks for it; push only when the user asks to publish (§11). Update [GDD.md](GDD.md) (chronological section with measurements) and this file after every significant change.
- Comments and UI texts in Italian; all tunable constants go in `config.js` with a comment (house measures in `HOUSE`, re-exported by `house.js` for the renderer; snow powder in `SNOW.powder`; tap slop in `GESTURE`).
- Stacked pieces: import `GAP` (and `ccw`) from `src/physics/polygon.js`, never redefine them.
- Behaviour-preserving refactors: compare `node tools/sim/grid.mjs <level> --json`, `stab.mjs`, `sacr.mjs` before/after (seeded, must be identical).

## 11. Publishing (rules for every agent)

The game is live at **https://overburt.github.io/xmas-26/**, served by GitHub Pages from the **public** repository `OverBurt/xmas-26`.
**A push on `main` is a publication**: players see it within ~1 minute.

### Who can update and publish
- **OverBurt** — owner (also repository settings: visibility, Pages, collaborators).
- **om4overmob** — manager authorised by the owner on 19/11 for updates and publishing: collaborator with **write** permission (push to `main` = publish). Invited on 19/11; active once the invitation is accepted. As a collaborator on a personal repository it cannot change settings (Pages, visibility): those stay with OverBurt.

### How it works
- Workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml), triggered by every push on `main` (or by hand: `gh workflow run pages.yml`):
  `npm ci` → `npm run build` with `VITE_SITE_URL=https://overburt.github.io/xmas-26/` → upload of `dist/` → deploy to Pages.
- Pages source = "GitHub Actions" (already set; if it is ever lost: `gh api -X POST repos/OverBurt/xmas-26/pages -f build_type=workflow`).
- `VITE_SITE_URL` (with the trailing slash) fills `canonical`, `og:url`, `og:image`, `twitter:image` and the JSON-LD in `index.html`.
  In CI it comes from the workflow; locally from `.env` (not versioned; template `.env.example`).
- `base: './'` in `vite.config.js`: every path is relative, so the site works under `/xmas-26/`.
- Service worker `public/sw.js`: the page is network-first (updates arrive at once), the other files are served from the cache and refreshed in the background.
  Build files have content hashes in their names, so a new build is picked up by itself. **Bump `VERSIONE` in `sw.js`** only when files with a fixed name change
  (`audio/musica.m4a`, icons, `manifest.webmanifest`, `og.png`) or when old caches must be dropped at once.

### Before pushing (checklist)
1. The user asked to publish (or to commit **and** push). Otherwise commit only, or nothing.
2. `npm test` passes (stability of every listed level) and `npm run build` succeeds.
3. If obstacles, houses or levels changed: `npm run sim:score -- <id>` and `npm run sim:play -- <id> --stars` (points and stars regenerated).
4. Checked in the browser (`npm run dev`) and, when possible, on the phone; docs updated (GDD chronological entry, this file).
5. **Privacy — the repository is public, everything committed is readable by anyone, forever in the history:**
   - Git identity must be a **GitHub noreply address**, never a personal or company email: `OverBurt <36509480+OverBurt@users.noreply.github.com>` or `om4overmob <270955320+om4overmob@users.noreply.github.com>` (check with `git config user.email` before committing; set it in every new clone with `git config user.name` / `git config user.email`).
   - No personal data in files or commit messages: no personal/company emails, local paths (`/Users/...`), device serial numbers, local IP addresses, screenshots or logs with personal information, tokens. Quick scan before pushing:
     `git diff origin/main --name-only | xargs grep -nIiE "@[a-z0-9-]+\.(com|it|net|org)|/Users/|192\.168\.|token|password" 2>/dev/null` (the noreply and `noreply@anthropic.com` addresses are fine).
   - `.env` and `.idea/` stay out of the repository (`.gitignore`).

### After pushing
- Follow the run: `gh run list --workflow pages.yml --limit 1` then `gh run watch <id> --exit-status` (run it in the background: about 1 minute).
- Check the site: `curl -s -o /dev/null -w '%{http_code}' https://overburt.github.io/xmas-26/` (also `sw.js`, `manifest.webmanifest`, `og.png`, `audio/musica.m4a`, the `assets/index-*.js` named in the page) and that `og:image` holds the full address.
- When possible, open it on the phone: see [tools/phone/README.md](../tools/phone/README.md) ("Gioco pubblicato", `CDP_MATCH=overburt.github.io`). Measured on 19/11 on the S21: real-finger throw 56–72 FPS, physics < 2 ms, offline reload works, no installability errors.
- Report to the user the address, the run result and what was checked.

### If something goes wrong
- Failed run: read `gh run view <id> --log-failed`, fix, push again.
- Broken site: `git revert <sha>` and push (a new deploy of the previous state). **Never force-push `main`** and never rewrite history unless the user explicitly asks
  (if personal data was pushed: tell the user at once; cleaning needs a history rewrite **and** recreating the repository, because GitHub keeps old commits reachable by id — done once on 19/11, it needs the `delete_repo` permission granted by the user).
- Changing the address (custom domain, renamed repository): update `VITE_SITE_URL` in the workflow and in `.env`, README, this file; regenerate `og.png` if needed (`node tools/og/crea-og.mjs`).
