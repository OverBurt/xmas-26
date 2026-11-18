/**
 * Pulsante "Condividi": manda il biglietto ai propri contatti con il pannello di condivisione del dispositivo
 * (Web Share API: WhatsApp, Messaggi, posta...). Dove non c'è (molti browser da computer) copia il link negli
 * appunti e lo dice con un avviso; se nemmeno quello è permesso, mostra il link da copiare a mano.
 */
const ICONA = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.6" fill="currentColor"/><circle cx="6" cy="12" r="2.6" fill="currentColor"/><circle cx="18" cy="19" r="2.6" fill="currentColor"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/></svg>`;
const TITOLO = "Biglietto d'auguri - GAME";
const TESTO = "Buone Feste! Ti mando un biglietto d'auguri da giocare: lancia i regali con la fionda dentro le case 🎁";

export function setupShare({ button, avviso }) {
  if (!button) return;
  button.innerHTML = ICONA;
  let timer = null;
  const mostra = (msg) => {
    if (!avviso) return;
    avviso.textContent = msg;
    avviso.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (avviso.hidden = true), 3200);
  };
  button.addEventListener('click', async () => {
    // il link condiviso è l'indirizzo del gioco senza parametri (livello, debug...)
    const url = location.origin + location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: TITOLO, text: TESTO, url });
      } catch (e) {
        if (e?.name !== 'AbortError') mostra('Condivisione non riuscita'); // AbortError = l'utente ha chiuso il pannello
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${TESTO} ${url}`);
      mostra('Link copiato: incollalo in un messaggio');
    } catch {
      mostra(url);
    }
  });
}
