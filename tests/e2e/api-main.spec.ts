import { test, expect } from '@playwright/test';

test.describe('Lexy main API coverage', () => {
  test('register/login/profile/create deck/card/update/delete and delete account', async ({ request }) => {
    const random = Date.now();
    const username = `pwuser_${random}`;
    const password = 'TestPass123!';
    const name = 'Playwright User';
    const baseApi = 'http://127.0.0.1:3000/api';

    const registerResponse = await request.post(`${baseApi}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password }
    });
    expect(registerResponse.ok()).toBeTruthy();

    const registerBody = await registerResponse.json();
    expect(registerBody.token).toBeTruthy();
    expect(registerBody.user).toBeTruthy();
    expect(registerBody.user.username).toBe(username);

    const token = registerBody.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const profileResponse = await request.get(`${baseApi}/auth/me`, { headers: authHeaders });
    expect(profileResponse.ok()).toBeTruthy();
    const profileBody = await profileResponse.json();
    expect(profileBody.user.username).toBe(username);

    const createDeckResponse = await request.post(`${baseApi}/decks`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { name: 'PW Test Deck', description: 'Created by Playwright API test', source: 'created', public_deck_id: null }
    });
    expect(createDeckResponse.ok()).toBeTruthy();

    const createDeckBody = await createDeckResponse.json();
    expect(createDeckBody.deck).toBeTruthy();
    const deckId = createDeckBody.deck.id;
    expect(deckId).toBeTruthy();

    const addCardResponse = await request.post(`${baseApi}/decks/${deckId}/cards`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { front: 'Test front', back: 'Test back' }
    });
    expect(addCardResponse.ok()).toBeTruthy();

    const addCardBody = await addCardResponse.json();
    expect(addCardBody.card).toBeTruthy();
    const cardId = addCardBody.card.id;
    expect(cardId).toBeTruthy();

    const cardsResponse = await request.get(`${baseApi}/decks/${deckId}/cards`, { headers: authHeaders });
    expect(cardsResponse.ok()).toBeTruthy();
    const cardsBody = await cardsResponse.json();
    expect(Array.isArray(cardsBody.cards)).toBeTruthy();
    expect(cardsBody.cards.some((card) => card.id === cardId)).toBeTruthy();

    const updateCardResponse = await request.put(`${baseApi}/cards/${cardId}`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { front: 'Updated front', back: 'Updated back' }
    });
    expect(updateCardResponse.ok()).toBeTruthy();

    const updateCardBody = await updateCardResponse.json();
    expect(updateCardBody.card.front).toBe('Updated front');

    const deleteCardResponse = await request.delete(`${baseApi}/cards/${cardId}`, { headers: authHeaders });
    expect(deleteCardResponse.ok()).toBeTruthy();

    const deleteDeckResponse = await request.delete(`${baseApi}/decks/${deckId}`, { headers: authHeaders });
    expect(deleteDeckResponse.ok()).toBeTruthy();

    const deleteAccountResponse = await request.delete(`${baseApi}/auth/account`, { headers: authHeaders });
    expect(deleteAccountResponse.ok()).toBeTruthy();
  });

  test('main and chat health endpoints are working', async ({ request }) => {
    const mainHealth = await request.get('http://127.0.0.1:3000/api/health');
    expect(mainHealth.ok()).toBeTruthy();
    expect(await mainHealth.json()).toEqual({ ok: true });

    const chatHealth = await request.get('http://127.0.0.1:3001/chat-api/health');
    expect(chatHealth.ok()).toBeTruthy();
    expect(await chatHealth.json()).toEqual({ ok: true });
  });
});
