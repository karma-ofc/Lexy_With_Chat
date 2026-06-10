import { test, expect } from '@playwright/test';
import { MAIN_API, loginUser, loginAdmin } from './test-utils';

test.describe('Lexy advanced API coverage', () => {
  test('favorites, forgotten, add public deck, translate and submit deck endpoints', async ({ request }) => {
    const random = Date.now();
    const username = `api_adv_${random}`;
    const password = `Pass${random}!`;
    const name = 'API Advanced Tester';

    const registerResponse = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password },
    });
    expect(registerResponse.ok()).toBeTruthy();
    const registerBody = await registerResponse.json();
    const token = registerBody.token;
    expect(token).toBeTruthy();

    const loginResponse = await loginUser(request, username, password);
    expect(loginResponse.response.ok()).toBeTruthy();
    const authToken = loginResponse.body.token;
    expect(authToken).toBeTruthy();

    const createDeckResponse = await request.post(`${MAIN_API}/decks`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: {
        name: `Advanced Deck ${random}`,
        description: 'Deck for advanced API coverage',
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
      data: { front: 'banana', back: 'банан' },
    });
    expect(createCardResponse.ok()).toBeTruthy();
    const createCardBody = await createCardResponse.json();
    const cardId = createCardBody.card?.id;
    expect(cardId).toBeTruthy();

    const favoriteResponse = await request.put(`${MAIN_API}/cards/${cardId}/favorite`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(favoriteResponse.ok()).toBeTruthy();

    const favoritesResponse = await request.get(`${MAIN_API}/cards/favorites`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(favoritesResponse.ok()).toBeTruthy();
    const favoritesBody = await favoritesResponse.json();
    expect(Array.isArray(favoritesBody)).toBeTruthy();
    expect(favoritesBody.some((card) => card.id === cardId)).toBeTruthy();

    const forgottenResponse = await request.put(`${MAIN_API}/cards/${cardId}/forgotten`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { is_forgotten: true },
    });
    expect(forgottenResponse.ok()).toBeTruthy();

    const forgottenListResponse = await request.get(`${MAIN_API}/cards/forgotten`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(forgottenListResponse.ok()).toBeTruthy();
    const forgottenListBody = await forgottenListResponse.json();
    expect(Array.isArray(forgottenListBody)).toBeTruthy();
    expect(forgottenListBody.some((card) => card.id === cardId)).toBeTruthy();

    const translateResponse = await request.get(`${MAIN_API}/dictionary/translate?text=hello&lang=en-ru`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(translateResponse.ok()).toBeTruthy();
    const translateBody = await translateResponse.json();
    expect(typeof translateBody.translation).toBe('string');

    const adminLogin = await loginAdmin(request);
    expect(adminLogin.response.ok()).toBeTruthy();
    const adminToken = adminLogin.body.token;
    expect(adminToken).toBeTruthy();

    const createPublicDeckResponse = await request.post(`${MAIN_API}/admin/public-decks`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      data: {
        name: `Admin Public Deck ${random}`,
        description: 'Public deck for add endpoint',
        lang: 'Русский',
        category: 'recommended',
      },
    });
    expect(createPublicDeckResponse.ok()).toBeTruthy();
    const createPublicDeckBody = await createPublicDeckResponse.json();
    const publicDeckId = createPublicDeckBody.deck?.public_deck_id || createPublicDeckBody.deck?.deck_id || createPublicDeckBody.deck?.id;
    expect(publicDeckId).toBeTruthy();

    const addPublicDeckResponse = await request.post(`${MAIN_API}/decks/${publicDeckId}/add`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    });
    if (!addPublicDeckResponse.ok()) {
      const errorText = await addPublicDeckResponse.text();
      console.error('Add public deck failed response:', errorText);
    }
    expect(addPublicDeckResponse.ok()).toBeTruthy();
    const addPublicDeckBody = await addPublicDeckResponse.json();
    expect(addPublicDeckBody.deck).toBeTruthy();

    const submitResponse = await request.post(`${MAIN_API}/decks/${deckId}/submit`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { message: 'Please review this deck' },
    });
    expect(submitResponse.ok()).toBeTruthy();

    const deleteAccountResponse = await request.delete(`${MAIN_API}/auth/account`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(deleteAccountResponse.ok()).toBeTruthy();

    const deletePublicDeckResponse = await request.delete(`${MAIN_API}/admin/public-decks/${publicDeckId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deletePublicDeckResponse.ok()).toBeTruthy();
  });
});
