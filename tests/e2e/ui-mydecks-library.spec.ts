import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { MAIN_API, loginAdmin } from './test-utils';

test.describe('Lexy MyDecks + Library UI flows', () => {
  test('creates a deck, adds a card, edits name and image, then adds public deck from library', async ({ page, request }) => {
    const random = Date.now();
    const username = `ui_flow_${random}`;
    const password = `Pass${random}!`;
    const name = 'UI Flow Tester';
    const myDeckName = `MyDeck ${random}`;
    const updatedDeckName = `${myDeckName} Updated`;
    const cardFront = 'apple';
    const cardBack = 'яблоко';
    const publicDeckName = `Public Deck ${random}`;

    const registerResponse = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password },
    });
    expect(registerResponse.ok()).toBeTruthy();
    const registerBody = await registerResponse.json();
    const token = registerBody.token;
    expect(token).toBeTruthy();

    const adminLogin = await loginAdmin(request);
    expect(adminLogin.response.ok()).toBeTruthy();
    const adminToken = adminLogin.body.token;
    expect(adminToken).toBeTruthy();

    const createPublicDeckResponse = await request.post(`${MAIN_API}/admin/public-decks`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      data: {
        name: publicDeckName,
        description: 'Public deck for UI flow test',
        lang: 'Русский',
        category: 'new,popular',
      },
    });
    expect(createPublicDeckResponse.ok()).toBeTruthy();
    const createPublicDeckBody = await createPublicDeckResponse.json();
    const publicDeckId = createPublicDeckBody.deck?.public_deck_id || createPublicDeckBody.deck?.deck_id || createPublicDeckBody.deck?.id;
    expect(publicDeckId).toBeTruthy();

    const imageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
      'base64'
    );
    const imagePath = path.join(__dirname, `ui-deck-image-${random}.png`);
    fs.writeFileSync(imagePath, imageBuffer);

    try {
      await page.goto('/');
      page.on('dialog', (dialog) => dialog.accept().catch(() => {}));
      await page.click('#authBtn');
      await expect(page.locator('#loginForm')).toBeVisible({ timeout: 10000 });
      await page.fill('#loginUsername', username);
      await page.fill('#loginPassword', password);
      await page.click('#loginForm button[type="submit"]');

      await expect(page.getByRole('button', { name: 'Профиль' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible({ timeout: 15000 });

      await page.click('button[data-tab="mydecks"]');
      await expect(page.getByRole('heading', { name: 'Мои колоды' })).toBeVisible();

      await page.click('button.btn-create-deck');
      await expect(page.getByRole('heading', { name: 'Создать колоду' })).toBeVisible();
      await page.fill('input[placeholder="Введите название"]', myDeckName);
      await page.click('button:has-text("Создать")');
      const myDeckCard = page.locator('.deck-card', { hasText: myDeckName });
      await expect(myDeckCard).toHaveCount(1);
      await expect(myDeckCard).toBeVisible();

      const myDeckMenuButton = myDeckCard.locator('.menu-btn');
      await expect(myDeckMenuButton).toBeVisible();
      await myDeckMenuButton.click();
      await page.click('button:has-text("Список карт")');
      await expect(page.getByRole('heading', { name: `${myDeckName} — карты` })).toBeVisible();

      await page.click('button:has-text("+ Добавить карточку")');
      await page.fill('input[placeholder="Например: dog"]', cardFront);
      await page.fill('input[placeholder="Например: собака"]', cardBack);
      await page.click('button:has-text("Добавить")');
      await expect(page.getByText(cardFront)).toBeVisible();
      await expect(page.getByText(cardBack)).toBeVisible();

      await page.click('.auth-close');

      const myDeckMenuButton2 = myDeckCard.locator('.menu-btn');
      await expect(myDeckMenuButton2).toBeVisible();
      await myDeckMenuButton2.click();

      await page.click('button:has-text("Редактировать название")');
      const nameInput = page.locator('.auth-container input[type="text"]');
      await expect(nameInput).toBeVisible();
      await nameInput.fill(updatedDeckName);
      const saveNameButton = page.locator('.auth-container:has(input[type="text"]) button:has-text("Сохранить")').first();
      await expect(saveNameButton).toBeVisible({ timeout: 10000 });
      await saveNameButton.scrollIntoViewIfNeeded();
      await saveNameButton.click({ timeout: 20000 });

      await expect(page.locator('.deck-card', { hasText: updatedDeckName })).toBeVisible();

      const updatedDeckCard = page.locator('.deck-card', { hasText: updatedDeckName });
      await updatedDeckCard.locator('.menu-btn').click();
      await page.click('button:has-text("Изменить обложку")');
      await page.setInputFiles('#menuImageInput', imagePath);
      const saveImageButton = page.locator('.auth-container:has(#menuImageInput) button:has-text("Сохранить")').first();
      await expect(saveImageButton).toBeVisible({ timeout: 10000 });
      await saveImageButton.scrollIntoViewIfNeeded();
      await saveImageButton.click({ timeout: 20000 });
      await expect(page.locator('.deck-card', { hasText: updatedDeckName }).locator('img')).toBeVisible();

      await page.click('button[data-tab="library"]');
      await expect(page.getByRole('heading', { name: 'Библиотека' })).toBeVisible();

      const publicDeckCard = page.locator('.deck-card', { hasText: publicDeckName }).first();
      await expect(publicDeckCard).toBeVisible();
      await publicDeckCard.locator('button.btn-icon').click();

      await page.click('button[data-tab="mydecks"]');
      await expect(page.getByRole('heading', { name: 'Мои колоды' })).toBeVisible();
      await expect(page.locator('.deck-card', { hasText: publicDeckName })).toBeVisible();
    } finally {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      await request.delete(`${MAIN_API}/auth/account`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await request.delete(`${MAIN_API}/admin/public-decks/${publicDeckId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
  });
});
