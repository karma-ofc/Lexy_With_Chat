import { test, expect } from '@playwright/test';

const MAIN_API = 'http://127.0.0.1:3000/api';
const CHAT_HOST = 'http://127.0.0.1:3001';

async function loginUser(request, username, password) {
  const response = await request.post(`${MAIN_API}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.describe('Swagger endpoint coverage', () => {
  test('main swagger endpoints work', async ({ request }) => {
    const random = Date.now();
    const username = `swagger_user_${random}`;
    const password = 'SwaggerPass123!';
    const name = 'Swagger User Test';

    const registerResponse = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password },
    });
    expect(registerResponse.ok()).toBeTruthy();

    const registerBody = await registerResponse.json();
    expect(registerBody.token).toBeTruthy();
    expect(registerBody.user.username).toBe(username);

    const token = registerBody.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const loginBody = await loginUser(request, username, password);
    expect(loginBody.token).toBeTruthy();
    expect(loginBody.user.username).toBe(username);

    const profileResponse = await request.get(`${MAIN_API}/auth/me`, { headers: authHeaders });
    expect(profileResponse.ok()).toBeTruthy();
    const profileBody = await profileResponse.json();
    expect(profileBody.user.username).toBe(username);

    const profileUpdateResponse = await request.put(`${MAIN_API}/auth/profile`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { name: 'Swagger Updated', avatar: '🧪' },
    });
    expect(profileUpdateResponse.ok()).toBeTruthy();
    const profileUpdateBody = await profileUpdateResponse.json();
    expect(profileUpdateBody.user.name).toBe('Swagger Updated');
    expect(profileUpdateBody.user.avatar).toBe('🧪');

    const adminLoginBody = await loginUser(request, 'admin', 'admin123');
    const adminHeaders = { Authorization: `Bearer ${adminLoginBody.token}` };

    const statsResponse = await request.put(`${MAIN_API}/auth/stats`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: {
        streak: 7,
        learned_words: 12,
        study_time: 120,
        accuracy: 95,
        last_study_date: new Date().toISOString(),
      },
    });
    expect(statsResponse.ok()).toBeTruthy();

    const statsGet = await request.get(`${MAIN_API}/auth/stats`, { headers: adminHeaders });
    expect(statsGet.ok()).toBeTruthy();
    const statsGetBody = await statsGet.json();
    expect(statsGetBody.accuracy).toBe(95);

    const activityBefore = await request.get(`${MAIN_API}/activity`, { headers: authHeaders });
    expect(activityBefore.ok()).toBeTruthy();
    const activityBeforeBody = await activityBefore.json();
    expect(activityBeforeBody.activity).toBeDefined();

    const activityDate = new Date(Date.now() + 3 * 3600000).toISOString().split('T')[0];
    const activityPost = await request.post(`${MAIN_API}/activity`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { cardsStudied: 3, date: activityDate },
    });
    expect(activityPost.ok()).toBeTruthy();

    const activityAfter = await request.get(`${MAIN_API}/activity`, { headers: authHeaders });
    expect(activityAfter.ok()).toBeTruthy();
    const activityAfterBody = await activityAfter.json();
    expect(activityAfterBody.activity).toBeDefined();

    const syncGet = await request.get(`${MAIN_API}/sync`, { headers: authHeaders });
    expect(syncGet.ok()).toBeTruthy();
    const syncGetBody = await syncGet.json();
    expect(Array.isArray(syncGetBody.decks)).toBeTruthy();
    expect(Array.isArray(syncGetBody.cards)).toBeTruthy();

    const syncPut = await request.put(`${MAIN_API}/sync`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { decks: [] },
    });
    expect(syncPut.ok()).toBeTruthy();
    const syncPutBody = await syncPut.json();
    expect(typeof syncPutBody.message).toBe('string');
    expect(syncPutBody.message).toContain('Синхронизация');

    const deckListResponse = await request.get(`${MAIN_API}/decks`, { headers: authHeaders });
    expect(deckListResponse.ok()).toBeTruthy();

    const createDeckResponse = await request.post(`${MAIN_API}/decks`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: {
        name: 'Swagger Deck',
        description: 'Deck created by swagger coverage test',
        source: 'created',
        public_deck_id: null,
      },
    });
    expect(createDeckResponse.ok()).toBeTruthy();
    const createDeckBody = await createDeckResponse.json();
    expect(createDeckBody.deck).toBeTruthy();
    const deckId = createDeckBody.deck.id;
    expect(deckId).toBeTruthy();

    const updateDeckResponse = await request.put(`${MAIN_API}/decks/${deckId}`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { name: 'Swagger Deck Updated', description: 'Updated description' },
    });
    expect(updateDeckResponse.ok()).toBeTruthy();
    const updateDeckBody = await updateDeckResponse.json();
    expect(updateDeckBody.deck.name).toBe('Swagger Deck Updated');

    const deckCardsBefore = await request.get(`${MAIN_API}/decks/${deckId}/cards`, { headers: authHeaders });
    expect(deckCardsBefore.ok()).toBeTruthy();
    const deckCardsBeforeBody = await deckCardsBefore.json();
    expect(Array.isArray(deckCardsBeforeBody.cards)).toBeTruthy();

    const createCardResponse = await request.post(`${MAIN_API}/decks/${deckId}/cards`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { front: 'Swagger Front', back: 'Swagger Back' },
    });
    expect(createCardResponse.ok()).toBeTruthy();
    const createCardBody = await createCardResponse.json();
    expect(createCardBody.card).toBeTruthy();
    const cardId = createCardBody.card.id;
    expect(cardId).toBeTruthy();

    const deckCardsAfter = await request.get(`${MAIN_API}/decks/${deckId}/cards`, { headers: authHeaders });
    expect(deckCardsAfter.ok()).toBeTruthy();
    const deckCardsAfterBody = await deckCardsAfter.json();
    expect(deckCardsAfterBody.cards.some((card) => card.id === cardId)).toBeTruthy();

    const publicDecksResponse = await request.get(`${MAIN_API}/public-decks`);
    expect(publicDecksResponse.ok()).toBeTruthy();
    const publicDecksBody = await publicDecksResponse.json();
    expect(Array.isArray(publicDecksBody.decks)).toBeTruthy();

    if (publicDecksBody.decks.length > 0) {
      const publicDeckId = publicDecksBody.decks[0].id;
      const publicDeckCardsResponse = await request.get(`${MAIN_API}/public-decks/${publicDeckId}/cards`);
      expect(publicDeckCardsResponse.ok()).toBeTruthy();
      const publicDeckCardsBody = await publicDeckCardsResponse.json();
      expect(Array.isArray(publicDeckCardsBody.cards)).toBeTruthy();
    }

    const passwordUpdateResponse = await request.put(`${MAIN_API}/auth/password`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { currentPassword: password, newPassword: 'SwaggerPassNew123!' },
    });
    expect(passwordUpdateResponse.ok()).toBeTruthy();

    const loginNewPassword = await loginUser(request, username, 'SwaggerPassNew123!');
    expect(loginNewPassword.token).toBeTruthy();

    const deleteAccountResponse = await request.delete(`${MAIN_API}/auth/account`, {
      headers: { Authorization: `Bearer ${loginNewPassword.token}` },
    });
    expect(deleteAccountResponse.ok()).toBeTruthy();
  });

  test('chat swagger endpoints work', async ({ request }) => {
    const random = Date.now();
    const username = `swagger_chat_${random}`;
    const password = 'SwaggerChat123!';
    const name = 'Swagger Chat User';

    const registerResponse = await request.post(`${MAIN_API}/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { name, username, password },
    });
    expect(registerResponse.ok()).toBeTruthy();
    const registerBody = await registerResponse.json();
    const userId = registerBody.user.id;
    expect(userId).toBeTruthy();
    const userToken = registerBody.token;
    const userHeaders = { Authorization: `Bearer ${userToken}` };

    const adminLogin = await request.post(`${MAIN_API}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { username: 'admin', password: 'admin123' },
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminBody = await adminLogin.json();
    const adminToken = adminBody.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const chatUsersResponse = await request.get(`${CHAT_HOST}/api/chat/users`, { headers: userHeaders });
    expect(chatUsersResponse.ok()).toBeTruthy();
    const chatUsersBody = await chatUsersResponse.json();
    expect(Array.isArray(chatUsersBody.users)).toBeTruthy();
    const recipientId = chatUsersBody.users.find((user) => user.id !== userId)?.id;
    expect(recipientId).toBeTruthy();

    const sendMessageResponse = await request.post(`${CHAT_HOST}/chat-api/messages`, {
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      data: { recipientId, type: 'text', text: 'Swagger chat message' },
    });
    expect(sendMessageResponse.ok()).toBeTruthy();
    const sendMessageBody = await sendMessageResponse.json();
    expect(sendMessageBody.message).toBeTruthy();
    const messageId = sendMessageBody.message.id;
    expect(messageId).toBeTruthy();

    const threadsResponse = await request.get(`${CHAT_HOST}/chat-api/threads`, { headers: userHeaders });
    expect(threadsResponse.ok()).toBeTruthy();
    const threadsBody = await threadsResponse.json();
    expect(Array.isArray(threadsBody.threads)).toBeTruthy();

    const messagesResponse = await request.get(`${CHAT_HOST}/chat-api/messages/${recipientId}`, { headers: userHeaders });
    expect(messagesResponse.ok()).toBeTruthy();
    const messagesBody = await messagesResponse.json();
    expect(Array.isArray(messagesBody.messages)).toBeTruthy();
    expect(messagesBody.messages.some((message) => message.id === messageId)).toBeTruthy();

    const updateMessageResponse = await request.put(`${CHAT_HOST}/chat-api/messages/${messageId}`, {
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      data: { text: 'Swagger chat message updated' },
    });
    expect(updateMessageResponse.ok()).toBeTruthy();
    const updateMessageBody = await updateMessageResponse.json();
    expect(updateMessageBody.message.text).toBe('Swagger chat message updated');

    const createGroupResponse = await request.post(`${CHAT_HOST}/chat-api/groups`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: { name: 'Swagger Test Group' },
    });
    expect(createGroupResponse.ok()).toBeTruthy();
    const createGroupBody = await createGroupResponse.json();
    const groupId = createGroupBody.group.id;
    expect(groupId).toBeTruthy();

    const syncUserResponse = await request.post(`${CHAT_HOST}/chat-api/messages`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: { recipientId: userId, type: 'text', text: 'Sync user for group' },
    });
    expect(syncUserResponse.ok()).toBeTruthy();

    const addParticipantResponse = await request.post(`${CHAT_HOST}/chat-api/groups/${groupId}/participants`, {
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      data: { participantId: userId },
    });
    expect(addParticipantResponse.ok()).toBeTruthy();
    const addParticipantBody = await addParticipantResponse.json();
    expect(addParticipantBody.ok).toBeTruthy();

    const groupsResponse = await request.get(`${CHAT_HOST}/chat-api/groups`, { headers: adminHeaders });
    expect(groupsResponse.ok()).toBeTruthy();
    const groupsBody = await groupsResponse.json();
    expect(Array.isArray(groupsBody.groups)).toBeTruthy();
    expect(groupsBody.groups.some((group) => group.id === groupId)).toBeTruthy();
    const createdGroup = groupsBody.groups.find((group) => group.id === groupId);
    expect(Array.isArray(createdGroup.participants)).toBeTruthy();
    expect(createdGroup.participants).toContain(userId);

    const deleteMessageResponse = await request.delete(`${CHAT_HOST}/chat-api/messages/${messageId}`, {
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      data: { deleteFor: 'all' },
    });
    expect(deleteMessageResponse.ok()).toBeTruthy();

    const deleteAccountResponse = await request.delete(`${MAIN_API}/auth/account`, { headers: userHeaders });
    expect(deleteAccountResponse.ok()).toBeTruthy();
  });
});
