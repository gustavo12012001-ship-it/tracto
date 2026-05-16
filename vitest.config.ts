import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config Vitest separada do vite.config.ts pra evitar puxar PWA plugin
// em ambiente de teste (que não precisa de service worker).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        'src/main.tsx',
      ],
    },
  },
});
