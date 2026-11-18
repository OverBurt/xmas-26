/**
 * Canale di eventi minimale (on/off/emit). Gli ascoltatori restano registrati anche dopo reset/setLevel.
 * Un ascoltatore che lancia un'eccezione non blocca gli altri né il gioco (l'errore va in console).
 */
export class Emitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /** Registra `fn(dati)` per l'evento `name`; restituisce la funzione che lo rimuove. */
  on(name, fn) {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    this.listeners.get(name)?.delete(fn);
  }

  emit(name, data) {
    const set = this.listeners.get(name);
    if (!set || !set.size) return;
    for (const fn of [...set]) {
      try {
        fn(data);
      } catch (e) {
        console.error(`ascoltatore di '${name}':`, e);
      }
    }
  }
}
