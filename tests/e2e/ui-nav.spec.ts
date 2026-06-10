import { test, expect } from '@playwright/test';
import { MAIN_API } from './test-utils';

test.describe('Lexy UI navigation and registration', () => {
  test('registers through UI and visits all protected pages', async ({ page, request }) => {
    const random = Date.now();
    const name = `UI Test ${random}`;
    const username = `uitest_${random}`;
    const password = `Pass${random}!`;

    await page.goto('/');
    await page.click('#authBtn');
    await page.click('[data-auth-tab="register"]');

    await page.fill('#regNameModal', name);
    await page.fill('#regUsernameModal', username);
    await page.fill('#regPasswordModal', password);
    await page.click('#registerFormModal button[type="submit"]');

    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Профиль' })).toBeVisible();

    await page.click('button[data-tab="library"]');
    await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible();

    await page.click('button[data-tab="mydecks"]');
    await expect(page.getByRole('heading', { name: 'Мои колоды' })).toBeVisible();

    await page.click('button[data-tab="stats"]');
    await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible();

    await page.click('button[data-tab="chat"]');
    await expect(page.getByRole('heading', { name: 'Чат' })).toBeVisible();

    await page.click('button[data-tab="profile"]');
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('lexy_token'));
    expect(token).toBeTruthy();

    const deleteResponse = await request.delete(`${MAIN_API}/auth/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.ok()).toBeTruthy();
  });
});
