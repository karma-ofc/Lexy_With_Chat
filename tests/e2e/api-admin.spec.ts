import { test, expect } from '@playwright/test';
import { MAIN_API, registerUser, loginUser } from './test-utils';

test.describe('Lexy admin API coverage', () => {
  test('admin public decks and user role management', async ({ request }) => {
    const adminLogin = await loginUser(request, 'admin', 'admin123');
    expect(adminLogin.response.ok()).toBeTruthy();
    const adminToken = adminLogin.body.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const createDeckResponse = await request.post(`${MAIN_API}/admin/public-decks`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: {
        name: `Admin Deck ${Date.now()}`,
        description: 'Created by admin API test',
        lang: 'Английский',
        category: 'Test',
      },
    });
    expect(createDeckResponse.ok()).toBeTruthy();
    const createDeckBody = await createDeckResponse.json();
    expect(createDeckBody.deck).toBeTruthy();
    const publicDeckId = createDeckBody.deck.id;
    const deckId = createDeckBody.deck.deck_id;
    expect(deckId).toBeTruthy();

    const adminDecksResponse = await request.get(`${MAIN_API}/admin/public-decks`, { headers: adminHeaders });
    expect(adminDecksResponse.ok()).toBeTruthy();
    const adminDecksBody = await adminDecksResponse.json();
    expect(Array.isArray(adminDecksBody.decks)).toBeTruthy();
    expect(adminDecksBody.decks.some((deck) => deck.id === deckId)).toBeTruthy();

    const updateDeckResponse = await request.put(`${MAIN_API}/admin/public-decks/${deckId}`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: {
        name: 'Admin Deck Updated',
        description: 'Updated by admin test',
        lang: 'Русский',
        category: 'Updated',
      },
    });
    expect(updateDeckResponse.ok()).toBeTruthy();

    const deckCardsResponse = await request.get(`${MAIN_API}/admin/public-decks/${deckId}/cards`, { headers: adminHeaders });
    expect(deckCardsResponse.ok()).toBeTruthy();
    const deckCardsBody = await deckCardsResponse.json();
    expect(Array.isArray(deckCardsBody.cards)).toBeTruthy();

    const addCardResponse = await request.post(`${MAIN_API}/admin/public-decks/${deckId}/cards`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: { front: 'Admin card front', back: 'Admin card back' },
    });
    expect(addCardResponse.ok()).toBeTruthy();
    const addCardBody = await addCardResponse.json();
    expect(addCardBody.card).toBeTruthy();
    const publicCardId = addCardBody.card.id;

    const deletePublicCardResponse = await request.delete(`${MAIN_API}/admin/public-cards/${publicCardId}`, { headers: adminHeaders });
    expect(deletePublicCardResponse.ok()).toBeTruthy();

    const deleteDeckResponse = await request.delete(`${MAIN_API}/admin/public-decks/${deckId}`, { headers: adminHeaders });
    expect(deleteDeckResponse.ok()).toBeTruthy();

    const random = Date.now();
    const username = `adminuser_${random}`;
    const password = `AdminUser${random}!`;
    const registerResult = await registerUser(request, 'Admin Test', username, password);
    expect(registerResult.response.ok()).toBeTruthy();
    const newUserId = registerResult.body.user.id;
    expect(newUserId).toBeTruthy();
    const usersResponse = await request.get(`${MAIN_API}/admin/users`, { headers: adminHeaders });
    expect(usersResponse.ok()).toBeTruthy();
    const usersBody = await usersResponse.json();
    expect(usersBody.users.some((user) => user.username === username)).toBeTruthy();

    const updateRoleResponse = await request.put(`${MAIN_API}/admin/users/${newUserId}/role`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: { role: 'admin' },
    });
    expect(updateRoleResponse.ok()).toBeTruthy();
    const updateRoleBody = await updateRoleResponse.json();
    expect(updateRoleBody.user).toBeTruthy();
    expect(updateRoleBody.user.role).toBe('admin');

    const resetRoleResponse = await request.put(`${MAIN_API}/admin/users/${newUserId}/role`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: { role: 'user' },
    });
    expect(resetRoleResponse.ok()).toBeTruthy();

    const loginResult = await loginUser(request, username, password);
    expect(loginResult.response.ok()).toBeTruthy();
    const userToken = loginResult.body.token;
    expect(userToken).toBeTruthy();

    const deleteAccountResponse = await request.delete(`${MAIN_API}/auth/account`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(deleteAccountResponse.ok()).toBeTruthy();
  });
});
