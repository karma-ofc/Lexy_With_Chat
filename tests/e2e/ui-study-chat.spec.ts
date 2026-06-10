import { test, expect } from '@playwright/test';
import { MAIN_API, CHAT_HOST, loginUser } from './test-utils';

test.describe('Lexy UI study and chat coverage', () => {
  test('starts a study session and answers a card correctly', async ({ page, request }) => {
    const random = Date.now();
    const username = `ui_study_${random}`;
    const password = `Pass${random}!`;
    const name = 'Study Mode Tester';
    const deckName = `Study Deck ${random}`;
    const cardFront = 'cat';
    const cardBack = 'кот';

    const registerResponse = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password },
    });
    expect(registerResponse.ok()).toBeTruthy();
    const registerBody = await registerResponse.json();
    expect(registerBody.token).toBeTruthy();
    const authToken = registerBody.token;

    try {
      const createDeckResponse = await request.post(`${MAIN_API}/decks`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: {
          name: deckName,
          description: 'Deck for study mode UI test',
          source: 'created',
          public_deck_id: null,
        },
      });
      expect(createDeckResponse.ok()).toBeTruthy();
      const createDeckBody = await createDeckResponse.json();
      const deckId = createDeckBody.deck?.id || createDeckBody.deck?.deck_id;
      expect(deckId).toBeTruthy();

      const createCardResponse = await request.post(`${MAIN_API}/decks/${deckId}/cards`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        data: { front: cardFront, back: cardBack },
      });
      expect(createCardResponse.ok()).toBeTruthy();

      await page.goto('/');
      await page.click('#authBtn');
      await page.fill('#loginUsername', username);
      await page.fill('#loginPassword', password);
      await page.click('#loginForm button[type="submit"]');

      await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
      await page.click('button[data-tab="mydecks"]');
      await expect(page.getByRole('heading', { name: 'Мои колоды' })).toBeVisible();

      const deckCard = page.locator('.deck-card', { hasText: deckName }).first();
      await expect(deckCard).toBeVisible();
      await deckCard.click();

      await expect(page.getByRole('heading', { name: 'Выберите режим' })).toBeVisible();
      await page.click('button:has-text("Слово → письменно")');

      await expect(page.locator('#studyCard')).toBeVisible();
      await page.fill('input[placeholder="Введите перевод..."]', cardBack);
      await page.click('button:has-text("Проверить")');

      await expect(page.locator('#studyCard')).toBeHidden({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'Мои колоды' })).toBeVisible();
    } finally {
      await request.delete(`${MAIN_API}/auth/account`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  });

  test('opens chat, sends a text message and shares a deck', async ({ page, request }) => {
    const random = Date.now();
    const usernameA = `chat_a_${random}`;
    const usernameB = `chat_b_${random}`;
    const password = `Pass${random}!`;
    const nameA = 'Chat User A';
    const nameB = 'Chat User B';
    const deckName = `Chat Deck ${random}`;
    const messageText = 'Привет, это тестовое сообщение';

    const registerResponseA = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: nameA, username: usernameA, password },
    });
    expect(registerResponseA.ok()).toBeTruthy();
    const bodyA = await registerResponseA.json();
    expect(bodyA.token).toBeTruthy();
    const authTokenA = bodyA.token;

    const registerResponseB = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name: nameB, username: usernameB, password },
    });
    expect(registerResponseB.ok()).toBeTruthy();
    const bodyB = await registerResponseB.json();
    expect(bodyB.token).toBeTruthy();
    const authTokenB = bodyB.token;

    try {
      const createDeckResponse = await request.post(`${MAIN_API}/decks`, {
        headers: { Authorization: `Bearer ${authTokenA}`, 'Content-Type': 'application/json' },
        data: {
          name: deckName,
          description: 'Deck for chat sharing test',
          source: 'created',
          public_deck_id: null,
        },
      });
      expect(createDeckResponse.ok()).toBeTruthy();
      const createDeckBody = await createDeckResponse.json();
      const deckId = createDeckBody.deck?.id || createDeckBody.deck?.deck_id;
      expect(deckId).toBeTruthy();

      await request.post(`${MAIN_API}/decks/${deckId}/cards`, {
        headers: { Authorization: `Bearer ${authTokenA}`, 'Content-Type': 'application/json' },
        data: { front: 'dog', back: 'собака' },
      });

      const loginA = await loginUser(request, usernameA, password);
      expect(loginA.response.ok()).toBeTruthy();
      const userAId = loginA.body.user?.id || loginA.body.user?.user_id || null;
      expect(userAId).toBeTruthy();

      const loginB = await loginUser(request, usernameB, password);
      expect(loginB.response.ok()).toBeTruthy();
      expect(loginB.body.user?.id || loginB.body.user?.user_id).toBeTruthy();

      const createMessageResponse = await request.post(`${CHAT_HOST}/chat-api/messages`, {
        headers: { Authorization: `Bearer ${authTokenB}`, 'Content-Type': 'application/json' },
        data: { recipientId: userAId, text: 'Привет из теста' },
      });
      expect(createMessageResponse.ok()).toBeTruthy();

      await page.goto('/');
      await page.click('#authBtn');
      await page.fill('#loginUsername', usernameA);
      await page.fill('#loginPassword', password);
      await page.click('#loginForm button[type="submit"]');

      await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
      await page.click('button[data-tab="chat"]');
      await expect(page.getByRole('heading', { name: 'Чат' })).toBeVisible();

      const userButton = page.locator('.chat-user-item', { hasText: `@${usernameB}` }).first();
      await expect(userButton).toBeVisible();
      await userButton.click();

      await expect(page.locator('.chat-panel-header')).toContainText(usernameB);

      const textarea = page.locator('.chat-composer-input textarea');
      await expect(textarea).toBeVisible();
      await textarea.fill(messageText);
      await page.click('button.chat-send-button');

      await expect(page.locator('.chat-message-text', { hasText: messageText })).toBeVisible();

      await page.click('button.chat-attach-button:has-text("Отправить колоду")');
      await expect(page.locator('.chat-deck-list')).toBeVisible();
      const deckRow = page.locator('.chat-deck-row', { hasText: deckName }).first();
      await expect(deckRow).toBeVisible();
      await deckRow.click();

      await expect(page.locator('.chat-deck-card .chat-deck-title', { hasText: deckName })).toBeVisible();
    } finally {
      await request.delete(`${MAIN_API}/auth/account`, {
        headers: { Authorization: `Bearer ${authTokenA}` },
      });
      await request.delete(`${MAIN_API}/auth/account`, {
        headers: { Authorization: `Bearer ${authTokenB}` },
      });
    }
  });
});
