# Xmas-26 — instructions for agents

Christmas-card game in JS with 2D physics (Planck.js + Canvas 2D, Vite, no framework): parcels thrown with a slingshot towards houses,
past obstacles of snow and ice that break. Smartphone in landscape + desktop.

**Read [docs/HANDOFF.md](docs/HANDOFF.md) first**: status, architecture, rules in force, decisions taken with the user, next steps.
The chronological history with measurements is in [docs/GDD.md](docs/GDD.md).

## Commands
- `npm run dev` (Vite :5173, also on the local network) · `npm run build`
- Test in the browser: `http://localhost:5173/?debug&level=<borgo-addormentato|bosco-di-cristallo|vetta-del-gufo>` and the `window.xmas` helpers (`sim`, `fire`, `findShot`, `wakeAll`, `game`).
- Test on Android: [tools/phone/README.md](tools/phone/README.md) (adb + DevTools).

## Rules
- The user writes in **Italian**: answers, UI texts, code comments and commit messages in Italian.
- **Always verify** changes in the browser (stability test after touching structures, simulated throws for gameplay) and, when possible, on the phone. Report the measurements.
- All tunable constants go in `src/config.js`, commented. Levels in `src/game/levels/*.json`.
- Physics: create stacked pieces at a distance `GAP = 2·polygonRadius − linearSlop` and asleep; never modify the Planck world inside contact callbacks (queue and apply after `step`).
- Do not reopen decisions already taken (HANDOFF §7) without asking. Original graphics: no recreations of existing games.
- After significant changes update `docs/GDD.md` (chronological section) and `docs/HANDOFF.md`. Commit only on request.
