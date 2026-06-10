import { test, expect } from '@playwright/test';

test.describe('Lexy full-stack smoke tests', () => {
  test('homepage loads and shows landing text', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LinguaCards/i);
    await expect(page.getByText('Запоминать легче с Lexy')).toBeVisible();
    await expect(page.getByRole('button', { name: /Попробовать/i })).toBeVisible();
  });

  test('backend health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:3000/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });
});
