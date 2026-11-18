# Xmas-26 — instructions for agents

Christmas-card game in JS with 2D physics (Planck.js + Canvas 2D, Vite, no framework): parcels thrown with a slingshot towards houses,
past obstacles of snow and ice that break. Smartphone in landscape + desktop.

**Read [docs/HANDOFF.md](docs/HANDOFF.md) first**: status, architecture, rules in force, decisions taken with the user, next steps.
The chronological history with measurements is in [docs/GDD.md](docs/GDD.md).

## Commands
- `npm run dev` (Vite :5173, also on the local network) · `npm run build`
- Test in the browser: `http://localhost:5173/?debug&level=<borgo-addormentato|bosco-di-cristallo|vetta-del-gufo>` (with `?level` or `?debug` the start page is skipped) and the `window.xmas` helpers (`sim`, `fire`, `findShot`, `wakeAll`, `game`).
- Images (dev server running): `npm run anteprime` (level previews, after changing a level), `npm run og` (social banner = start page), `npm run icone` (PNG icons from `public/pacco.svg`).
- Test on Android: [tools/phone/README.md](tools/phone/README.md) (adb + DevTools).

## Rules
- The user writes in **Italian**: answers, UI texts, code comments and commit messages in Italian.
- **Always verify** changes in the browser (stability test after touching structures, simulated throws for gameplay) and, when possible, on the phone. Report the measurements.
- All tunable constants go in `src/config.js`, commented. Levels in `src/game/levels/*.json`.
- Physics: create stacked pieces at a distance `GAP = 2·polygonRadius − linearSlop` and asleep; never modify the Planck world inside contact callbacks (queue and apply after `step`).
- Do not reopen decisions already taken (HANDOFF §7) without asking. Original graphics: no recreations of existing games.
- After significant changes update `docs/GDD.md` (chronological section) and `docs/HANDOFF.md`. Commit only on request.

## Publishing — read [HANDOFF §11](docs/HANDOFF.md) before any push
- The game is live at https://overburt.github.io/xmas-26/ from the **public** repository `OverBurt/xmas-26`: **every push on `main` is published** to players by `.github/workflows/pages.yml`.
- Push only when the user asks to publish. Before pushing: `npm test`, `npm run build`, scores/stars regenerated if levels changed, docs updated. After pushing: follow the run (`gh run watch`), check the site responds, report.
- Who may update and publish: **OverBurt** (owner) and **om4overmob** (manager, write permission). Settings (Pages, visibility, collaborators) stay with OverBurt.
- **Privacy**: commits must be authored with a GitHub noreply address — `OverBurt <36509480+OverBurt@users.noreply.github.com>` or `om4overmob <270955320+om4overmob@users.noreply.github.com>`; never commit personal data (emails, `/Users/...` paths, device serials, local IPs, tokens), `.env` or `.idea/`.
- Never force-push `main` or rewrite history without an explicit request; to undo a publication, `git revert` and push.
- Bump `VERSIONE` in `public/sw.js` when fixed-name files change (music, icons, manifest, `og.png`).
