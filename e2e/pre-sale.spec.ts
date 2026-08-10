import { test, expect, type Page } from '@playwright/test';

const FREE = { email: process.env.E2E_EMAIL, pass: process.env.E2E_PASS };

async function login(page: Page, email: string, pass: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
}

async function expectNoMojibake(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/Ã[^\sA-Z]|Â[^\s]|â€|â€œ|â€�|ðŸ/);
}

test.describe('pre-venda publica', () => {
  test('landing, termos, privacidade e politica comercial carregam sem texto corrompido', async ({ page }) => {
    for (const route of ['/', '/terms', '/privacy', '/cancellation-policy']) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      await expectNoMojibake(page);
    }
  });

  test('politica comercial mostra cancelamento, reembolso e aviso agronomico', async ({ page }) => {
    await page.goto('/cancellation-policy');
    await expect(page.getByRole('heading', { name: 'Cancelamento', exact: true })).toBeVisible();
    await expect(page.getByText(/reembolso/i).first()).toBeVisible();
    await expect(page.getByText(/não substituem laudo técnico/i)).toBeVisible();
  });
});

test.describe('billing autenticado', () => {
  test.skip(!FREE.email || !FREE.pass, 'defina E2E_EMAIL/E2E_PASS para validar billing real');

  test('billing oferece cartão e Pix sem prometer WhatsApp', async ({ page }) => {
    await login(page, FREE.email!, FREE.pass!);
    await page.goto('/app/billing');
    await expect(page.getByRole('heading', { name: /escolha seu plano/i })).toBeVisible();
    await expect(page.getByText(/cartão/i).first()).toBeVisible();
    await expect(page.getByText(/pix/i).first()).toBeVisible();
    await expect(page.getByText(/alertas via WhatsApp/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /cancelamento, reembolso/i })).toBeVisible();
    await expectNoMojibake(page);
  });
});
