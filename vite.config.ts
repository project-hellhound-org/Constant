import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Views are lazy-loaded; the remaining entry chunk (~190 kB gzip) is React + Dexie + shared UI.
    chunkSizeWarningLimit: 700,
  },
});
