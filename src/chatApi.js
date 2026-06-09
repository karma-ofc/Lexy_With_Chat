import { io } from 'socket.io-client';

const CHAT_API_URL = 'http://localhost:3001/chat-api';
const CHAT_SOCKET_PATH = '/socket.io';

function getAuthHeaders() {
  const token = localStorage.getItem('lexy_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(response, fallbackError) {
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const hasBody = rawBody.trim().length > 0;

  if (contentType.includes('application/json') && hasBody) {
    const data = JSON.parse(rawBody);
    if (!response.ok) {
      throw new Error(data.error || fallbackError);
    }
    return data;
  }

  if (!response.ok) {
    throw new Error(rawBody || fallbackError);
  }
  if (contentType.includes('application/json')) {
    return {};
  }
  return { raw: rawBody };
}

export function createChatSocket() {
  const token = localStorage.getItem('lexy_token');
  if (!token) return null;

  return io('http://localhost:3001', {
    path: CHAT_SOCKET_PATH,
    auth: { token },
    transports: ['polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000
  });
}

export const chatApi = {
  async getThreads() {
    const response = await fetch(`${CHAT_API_URL}/threads`, {
      headers: getAuthHeaders()
    });
    return parseResponse(response, 'Failed to get chat threads');
  },

  async getMessages(participantId) {
    const response = await fetch(`${CHAT_API_URL}/messages/${participantId}`, {
      headers: getAuthHeaders()
    });
    return parseResponse(response, 'Failed to get chat messages');
  },

  async sendMessage(recipientId, payload) {
    const response = await fetch(`${CHAT_API_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ recipientId, ...payload })
    });
    return parseResponse(response, 'Failed to send message');
  },

  async markThreadRead(participantId) {
    const response = await fetch(`${CHAT_API_URL}/threads/${participantId}/read`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return parseResponse(response, 'Failed to mark thread as read');
  },

  async updateMessage(messageId, text) {
    const response = await fetch(`${CHAT_API_URL}/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ text })
    });
    return parseResponse(response, 'Failed to update message');
  },

  async deleteMessage(messageId, deleteFor = 'self') {
    const response = await fetch(`${CHAT_API_URL}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ deleteFor })
    });
    return parseResponse(response, 'Failed to delete message');
  },

  async createGroup(name) {
    const response = await fetch(`${CHAT_API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name })
    });
    return parseResponse(response, 'Failed to create group');
  },

  async getGroups() {
    const response = await fetch(`${CHAT_API_URL}/groups`, {
      headers: getAuthHeaders()
    });
    return parseResponse(response, 'Failed to get groups');
  },

  async addParticipant(groupId, participantId) {
    const response = await fetch(`${CHAT_API_URL}/groups/${groupId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ participantId })
    });
    return parseResponse(response, 'Failed to add participant');
  },

  async updateGroup(groupId, name) {
    const response = await fetch(`${CHAT_API_URL}/groups/${groupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name })
    });
    return parseResponse(response, 'Failed to update group');
  },

  async leaveGroup(groupId) {
    const response = await fetch(`${CHAT_API_URL}/groups/${groupId}/members/me`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return parseResponse(response, 'Failed to leave group');
  },

  async getGroupMessages(groupId) {
    const response = await fetch(`${CHAT_API_URL}/messages/group/${groupId}`, {
      headers: getAuthHeaders()
    });
    return parseResponse(response, 'Failed to get group messages');
  },

  async sendGroupMessage(groupId, payload) {
    const response = await fetch(`${CHAT_API_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ groupId, ...payload })
    });
    return parseResponse(response, 'Failed to send group message');
  }
};

export default chatApi;