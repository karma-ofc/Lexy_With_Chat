import { test, expect } from '@playwright/test';
import { MAIN_API, CHAT_HOST, registerUser, loginUser } from './test-utils';

test.describe('Lexy chat group workflow', () => {
  test('creates a group, adds participant, and reads group messages', async ({ request }) => {
    const random = Date.now();
    const username = `chatuser_${random}`;
    const password = `ChatPass${random}!`;

    const registerResult = await registerUser(request, 'Chat User', username, password);
    expect(registerResult.response.ok()).toBeTruthy();
    const userToken = registerResult.body.token;
    expect(userToken).toBeTruthy();
    const userHeaders = { Authorization: `Bearer ${userToken}` };

    const chatUsersResponse = await request.get(`${CHAT_HOST}/api/chat/users`, { headers: userHeaders });
    expect(chatUsersResponse.ok()).toBeTruthy();
    const chatUsersBody = await chatUsersResponse.json();
    expect(Array.isArray(chatUsersBody.users)).toBeTruthy();
    const participant = chatUsersBody.users.find((user) => user.username !== username);
    expect(participant).toBeTruthy();

    const createGroupResponse = await request.post(`${CHAT_HOST}/chat-api/groups`, {
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      data: { name: `Chat Group ${random}` },
    });
    expect(createGroupResponse.ok()).toBeTruthy();
    const createGroupBody = await createGroupResponse.json();
    expect(createGroupBody.group).toBeTruthy();
    const groupId = createGroupBody.group.id;
    expect(groupId).toBeTruthy();

    const addParticipantResponse = await request.post(`${CHAT_HOST}/chat-api/groups/${groupId}/participants`, {
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      data: { participantId: participant.id },
    });
    expect(addParticipantResponse.ok()).toBeTruthy();
    const addParticipantBody = await addParticipantResponse.json();
    expect(addParticipantBody.ok).toBeTruthy();

    const groupsResponse = await request.get(`${CHAT_HOST}/chat-api/groups`, { headers: userHeaders });
    expect(groupsResponse.ok()).toBeTruthy();
    const groupsBody = await groupsResponse.json();
    expect(Array.isArray(groupsBody.groups)).toBeTruthy();
    expect(groupsBody.groups.some((group) => group.id === groupId)).toBeTruthy();

    const sendGroupMessageResponse = await request.post(`${CHAT_HOST}/chat-api/messages`, {
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      data: { groupId, type: 'text', text: 'Привет группе!' },
    });
    expect(sendGroupMessageResponse.ok()).toBeTruthy();
    const sendGroupMessageBody = await sendGroupMessageResponse.json();
    expect(sendGroupMessageBody.message).toBeTruthy();
    const messageId = sendGroupMessageBody.message.id;
    expect(messageId).toBeTruthy();

    const groupMessagesResponse = await request.get(`${CHAT_HOST}/chat-api/messages/group/${groupId}`, { headers: userHeaders });
    expect(groupMessagesResponse.ok()).toBeTruthy();
    const groupMessagesBody = await groupMessagesResponse.json();
    expect(Array.isArray(groupMessagesBody.messages)).toBeTruthy();
    expect(groupMessagesBody.messages.some((message) => message.id === messageId)).toBeTruthy();

    const loginResult = await loginUser(request, username, password);
    expect(loginResult.response.ok()).toBeTruthy();
    const authDeleteResponse = await request.delete(`${MAIN_API}/auth/account`, {
      headers: { Authorization: `Bearer ${loginResult.body.token}` },
    });
    expect(authDeleteResponse.ok()).toBeTruthy();
  });
});
