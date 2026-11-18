// Crea le icone PNG dell'app (public/icon-512.png, icon-192.png per Android e icon-180.png per iPhone) da public/icon.svg con Chrome headless.
// I nomi dei file fanno parte della soluzione: Chrome su Android tiene a lungo in memoria le icone già scaricate, quindi
// se il disegno cambia va cambiato anche il nome (qui, nel manifest, in index.html e in sw.js).
// Uso: npm run icone
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tmp = mkdtempSync(join(tmpdir(), 'xmas-icone-'));
const svg = pathToFileURL(join(ROOT, 'public/icon.svg')).href;
for (const lato of [512, 192, 180]) {
  // una pagina grande quanto l'icona, con l'SVG a tutto campo
  const pagina = join(tmp, `icona-${lato}.html`);
  writeFileSync(pagina, `<!doctype html><style>html,body{margin:0;overflow:hidden}img{display:block;width:${lato}px;height:${lato}px}</style><img src="${svg}">`);
  const out = join(ROOT, `public/icon-${lato}.png`);
  execFileSync(CHROME, ['--headless=new', `--user-data-dir=${tmp}/prof`, `--screenshot=${out}`, `--window-size=${lato},${lato}`, '--force-device-scale-factor=1', '--hide-scrollbars', pathToFileURL(pagina).href], { stdio: 'ignore' });
  console.log('scritto', out);
}
