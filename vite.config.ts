import { defineConfig } from 'vite';

export default defineConfig({
  base: '/roguelite/',   // 🔥 CRITICAL FIX
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
