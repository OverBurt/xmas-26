import { isStandalone } from './fullscreen.js';

/**
 * Pulsante "Installa": compare solo se il gioco non è già installato e il browser offre l'installazione
 * (Chrome su Android e su computer mandano l'evento `beforeinstallprompt`). Al tocco apre la richiesta del browser;
 * sparisce a installazione fatta o rifiutata. Su iPhone l'evento non esiste: resta il suggerimento
 * "Aggiungi alla schermata Home" (fullscreen.js).
 */
export function setupInstall({ button, avviso }) {
  if (!button || isStandalone) return; // aperto come app: è già installato
  let richiesta = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // niente banner automatico: si installa dal nostro pulsante
    richiesta = e;
    button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    richiesta = null;
    button.hidden = true;
    avviso?.('Gioco installato: lo trovi tra le tue app');
  });
  button.addEventListener('click', async () => {
    if (!richiesta) return;
    const r = richiesta;
    richiesta = null; // la richiesta si può usare una volta sola
    button.hidden = true;
    r.prompt();
    await r.userChoice.catch(() => {});
  });
}
