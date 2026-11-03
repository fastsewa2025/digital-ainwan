import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the site runs on :5173 and talks to the API on :5000 through this proxy,
// so the browser sees a single origin, exactly like production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 600 },
});
