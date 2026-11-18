import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // percorsi relativi: il gioco funziona anche pubblicato in una sottocartella
  server: { host: true, port: 5173 },
  build: { target: 'es2020' },
});
