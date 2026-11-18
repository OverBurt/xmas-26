# Prove su smartphone Android via adb

Strumenti usati per provare il gioco su un telefono vero (Samsung Galaxy S21, Android 15, Chrome 157) collegato via USB.

## Preparazione (una volta)
1. Sul Mac: `brew install --cask android-platform-tools` (adb).
2. Sul telefono: Opzioni sviluppatore → **Debug USB** attivo; collegare il cavo e accettare "Consenti debug USB" (spuntare "Consenti sempre").
3. `adb devices` deve mostrare il telefono come `device` (se `unauthorized`: accettare di nuovo la richiesta sul telefono sbloccato).

## Sessione di prova
```bash
npm run dev                                            # server Vite su :5173
adb reverse tcp:5173 tcp:5173                          # il telefono vede localhost:5173 del Mac
adb forward tcp:9222 localabstract:chrome_devtools_remote   # DevTools di Chrome del telefono
adb shell am start -a android.intent.action.VIEW -d "http://localhost:5173/?debug" -p com.android.chrome
```
- **Schermo intero**: va chiesto con un tocco vero. Toccare il **centro del canvas** (es. `adb shell input tap 1200 600` in orizzontale), non in alto: prima dello schermo intero la pagina è più in basso e un tocco in alto può premere "Stress +40".
- **Stato e misure**: `node tools/phone/cdp.mjs "document.getElementById('hud').textContent"` (FPS, ms di fisica, corpi).
- **Coordinate da toccare**: `node tools/phone/cdp.mjs "$(cat tools/phone/coords.js)"`.
- **Gesto unico slitta → fionda → mira**: `tools/phone/drag.sh xPacco yPacco xFionda yFionda xMira yMira`.
- **Screenshot**: `adb exec-out screencap -p > shot.png`.
- **Consumi per componente**: `node tools/phone/consumi.mjs --giri 3` ricarica il gioco spegnendo una parte del disegno alla volta (`?salta=`), più audio spento, solo cielo e pagina vuota; misura la CPU dei processi di Chrome (pagina, GPU, browser) e del compositore di Android, il thread della pagina, FPS e ms di disegno, e stampa le mediane. Con `--crollo` misura durante un tiro che fa crollare il fortino. Con `--solo "tutto acceso,senza audio"` solo le configurazioni nominate.
- **Costo della fisica per componente**: `node tools/phone/fisica.mjs --giri 3` (dentro la pagina, senza disegno) misura i ms per step con il livello completo e senza fortino, pupazzi, albero, renne, pini, case, a scena ferma, in un crollo del fortino e in un tiro nell'albero.
- Il telefono va tenuto sbloccato e con lo schermo acceso (`adb shell dumpsys power | grep mWakefulness` → `Awake`). Non cambiare impostazioni di sistema dal terminale (rotazione ecc.): chiedere all'utente.

## Risultati misurati (S21)
- Consumi a scena ferma, inquadratura di mira, 60 FPS (18/11/2026, mediane di 3 giri): Chrome in totale ~184% di un core (pagina 65, processo GPU 108, browser 11) più ~27 del compositore di Android; pagina vuota 6. Solo cielo (tutto il disegno spento) 148: la parte fissa (loop a 60 FPS su un canvas 1536×720) pesa più di tutti i componenti insieme. Audio ~22; sfondo, pini, corpi, terreno, testi 8–12 ciascuno; gli altri sotto il rumore di misura (±8). Con la musica registrata l'audio costa ~17 (di cui ~13 fissi per il flusso audio aperto).
- Fisica (ms per step): ferma 0.14, crollo del fortino 1.35 (p95 1.8, picchi 6); senza fortino quasi zero; pupazzi ~¼ del crollo; albero, renne, pini, case trascurabili.
- 158 corpi tutti svegli: 60 FPS, fisica ~5.5 ms/frame. Scena normale: fisica 0.1–2.5 ms.
- Il canvas è limitato a DPR 2 (1536×720 a schermo intero), rendering limitato a 60 FPS (lo schermo è a 120 Hz).
