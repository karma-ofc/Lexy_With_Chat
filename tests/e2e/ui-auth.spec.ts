import { test, expect } from '@playwright/test';

const MAIN_API = 'http://127.0.0.1:3000/api';

test.describe('Lexy frontend auth flow', () => {
  test('login via UI after registration', async ({ page, request }) => {
    const random = Date.now();
    const username = `pwui_${random}`;
    const password = 'TestPass123!';
    const name = 'Playwright UI';

    const registerResponse = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password }
    });
    expect(registerResponse.ok()).toBeTruthy();

    const payload = await registerResponse.json();
    expect(payload.token).toBeTruthy();
    const token = payload.token;

    await page.goto('/');
    await page.click('#authBtn');

    await expect(page.locator('#loginForm')).toBeVisible();
    await page.fill('#loginUsername', username);
    await page.fill('#loginPassword', password);
    await page.click('#loginForm button[type="submit"]');

    await expect(page.getByRole('button', { name: 'Профиль' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();

    const deleteAccountResponse = await request.delete(`${MAIN_API}/auth/account`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(deleteAccountResponse.ok()).toBeTruthy();
  });
});
