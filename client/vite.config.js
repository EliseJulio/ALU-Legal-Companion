import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@/lib/api" means src/lib/api.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // strictPort stops a stale dev server from another project on 5173 from being used by mistake.
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
    // The end-to-end tests have their own runner. Vitest cannot run them.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    // Typing a whole sentence one key at a time is slow when several test files run at once.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
