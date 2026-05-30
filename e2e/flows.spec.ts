import { test, expect, type Page } from '@playwright/test';

/**
 * (A-14) Fluxos de negócio E2E.
 *
 * Estes testes exigem contas de teste reais (FREE e PRO) e um backend acessível.
 * Defina as variáveis de ambiente antes de rodar:
 *   E2E_EMAIL / E2E_PASS           — conta FREE
 *   E2E_PRO_EMAIL / E2E_PRO_PASS   — conta PRO
 *
 * Sem credenciais, os blocos são pulados (test.skip) — assim a suíte continua
 * verde localmente e na CI sem vazar segredos. Os seletores marcados com TODO
 * devem ser confirmados contra a UI atual ao popular as credenciais.
 */

const FREE = { email: process.env.E2E_EMAIL, pass: process.env.E2E_PASS };
const PRO = { email: process.env.E2E_PRO_EMAIL, pass: process.env.E2E_PRO_PASS };

async function login(page: Page, email: string, pass: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
}

test.describe('Autenticação', () => {
  test.skip(!FREE.email || !FREE.pass, 'defina E2E_EMAIL/E2E_PASS');

  test('login com conta FREE entra no app', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('criação de talhão', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    await page.goto('/app/maps');
    // TODO: confirmar seletores do fluxo de desenho/salvar talhão na UI atual.
    // Exemplo esperado:
    //   await page.getByRole('button', { name: /novo talhão|desenhar/i }).click();
    //   ...desenhar polígono no mapa...
    //   await page.getByRole('button', { name: /salvar/i }).click();
    //   await expect(page.getByText(/talhão salvo|sucesso/i)).toBeVisible();
  });

  test('limite FREE de talhões bloqueia criação adicional', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    // TODO: após atingir o limite do plano FREE, a UI deve exibir CTA de upgrade
    // e impedir salvar. Asserir a mensagem de bloqueio e o botão "Fazer upgrade".
  });

  test('feature paga (satélite + IA) bloqueada no FREE', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    await page.goto('/app/images');
    // TODO: asserir gate de upgrade ao tentar acessar análise IA do satélite.
  });

  test('limite diário de chat no FREE', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    await page.goto('/app/chat');
    // TODO: após N mensagens, asserir mensagem de limite diário atingido.
  });
});

test.describe('Plano PRO', () => {
  test.skip(!PRO.email || !PRO.pass, 'defina E2E_PRO_EMAIL/E2E_PRO_PASS');

  test('conta PRO acessa satélite + IA', async ({ page }) => {
    await login(page, PRO.email!, PRO.pass!);
    await page.goto('/app/images');
    // TODO: asserir que a análise IA está disponível (sem gate de upgrade).
  });
});

test.describe('Upgrade (mock)', () => {
  test.skip(!FREE.email || !FREE.pass, 'defina E2E_EMAIL/E2E_PASS');

  test('CTA de upgrade leva ao checkout/billing', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    await page.goto('/app/billing');
    // TODO: clicar em assinar PRO e asserir redirecionamento ao Mercado Pago
    // (mockar a chamada de preapproval para não criar cobrança real).
  });
});
