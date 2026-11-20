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
<<<<<<< HEAD
    // Views are lazy-loaded; the remaining entry chunk (~190 kB gzip) is React + Dexie + shared UI.
    chunkSizeWarningLimit: 700,
=======
>>>>>>> 3188260cffcd6c1abd8c68ed70c6c1c7131ab17e
  },
});
