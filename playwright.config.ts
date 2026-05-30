import { defineConfig, devices } from '@playwright/test';

/**
 * (A-14) Configuração Playwright para testes E2E.
 *
 * Pré-requisitos (NÃO commitados no package.json para não desincronizar o
 * lockfile usado pelo `npm ci` da CI):
 *
 *   npm i -D @playwright/test
 *   npx playwright install --with-deps chromium
 *
 * Variáveis de ambiente (defina num .env.e2e ou no shell):
 *   E2E_BASE_URL        — URL do app (default http://localhost:5173)
 *   E2E_EMAIL/E2E_PASS  — conta de teste FREE (para fluxos autenticados)
 *   E2E_PRO_EMAIL/...   — conta de teste PRO (para fluxos de plano pago)
 *
 * Rodar:
 *   npx playwright test
 *   npx playwright test --ui
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  // Sobe o dev server automaticamente quando rodando local.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
