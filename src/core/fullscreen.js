/**
 * Schermo intero e blocco in orizzontale.
 *
 * - Android/Chrome e desktop: Fullscreen API, richiedibile solo dentro un gesto dell'utente
 *   (tap/click), quindi la chiediamo al primo tocco e con il pulsante ⛶.
 *   Il blocco dell'orientamento funziona solo quando la pagina è già a schermo intero.
 * - iPhone/Safari: la Fullscreen API non esiste per le pagine. L'unico modo è aprire il gioco
 *   dalla schermata Home (PWA, display standalone): mostriamo un suggerimento.
 */

const doc = document;
const root = doc.documentElement;

const requestFs = root.requestFullscreen || root.webkitRequestFullscreen;
const exitFs = doc.exitFullscreen || doc.webkitExitFullscreen;

export const fullscreenSupported = typeof requestFs === 'function' && doc.fullscreenEnabled !== false;

export const isStandalone =
  matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;

const isIOS =
  /iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !fullscreenSupported);

const isTouch = matchMedia('(pointer: coarse)').matches;

export function isFullscreen() {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function enterFullscreen() {
  if (!fullscreenSupported || isFullscreen()) return;
  try {
    await requestFs.call(root, { navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape').catch(() => {});
  } catch {
    // Rifiutato (es. non dentro un gesto): si riproverà al prossimo tocco o col pulsante.
  }
}

export function toggleFullscreen() {
  if (isFullscreen()) exitFs?.call(doc);
  else enterFullscreen();
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.button pulsante ⛶ (nascosto dove non serve)
 * @param {HTMLElement} opts.iosHint banner "Aggiungi alla schermata Home"
 * @param {() => void} opts.onChange chiamata quando cambia lo stato (per il resize)
 */
export function setupFullscreen({ button, iosHint, onChange }) {
  if (isStandalone) {
    button.hidden = true;
  } else if (fullscreenSupported) {
    button.addEventListener('click', toggleFullscreen);
    // Sui dispositivi touch entriamo a schermo intero al primo tocco sulla pagina.
    // Se la richiesta viene rifiutata (es. tocco in verticale, gesto non valido)
    // riproviamo al tocco successivo, finché non riesce la prima volta.
    if (isTouch) {
      const tryEnter = async () => {
        await enterFullscreen();
        if (isFullscreen()) window.removeEventListener('pointerup', tryEnter, true);
      };
      window.addEventListener('pointerup', tryEnter, true);
    }
  } else {
    button.hidden = true;
    if (isIOS && iosHint) {
      let dismissed = false;
      try { dismissed = localStorage.getItem('xmas-ios-hint') === '1'; } catch {}
      if (!dismissed) {
        iosHint.hidden = false;
        iosHint.addEventListener('click', () => {
          iosHint.hidden = true;
          try { localStorage.setItem('xmas-ios-hint', '1'); } catch {}
        });
      }
    }
  }

  const changed = () => {
    button.textContent = isFullscreen() ? '⤡' : '⛶';
    // Lasciamo al browser il tempo di aggiornare le dimensioni del viewport.
    requestAnimationFrame(() => requestAnimationFrame(onChange));
  };
  doc.addEventListener('fullscreenchange', changed);
  doc.addEventListener('webkitfullscreenchange', changed);
  window.visualViewport?.addEventListener('resize', onChange);
}
