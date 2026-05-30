import { test, expect } from '@playwright/test';

/**
 * (A-14) Smoke tests — não exigem autenticação nem backend.
 * Garantem que o app sobe, a landing renderiza e o login tem os campos.
 */

test('landing page carrega', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Tracto/i);
  // Há um caminho para login a partir da landing.
  await expect(page.locator('a[href="/login"], a[href*="login"]').first()).toBeVisible();
});

test('página de login tem email, senha e submit', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('rota protegida redireciona para login quando deslogado', async ({ page }) => {
  await page.goto('/app/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
