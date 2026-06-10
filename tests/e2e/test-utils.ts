import type { APIRequestContext } from '@playwright/test';

export const MAIN_API = 'http://127.0.0.1:3000/api';
export const CHAT_HOST = 'http://127.0.0.1:3001';

export async function registerUser(request: APIRequestContext, name: string, username: string, password: string) {
  const response = await request.post(`${MAIN_API}/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    data: { name, username, password },
  });
  return { response, body: await response.json() };
}

export async function loginUser(request: APIRequestContext, username: string, password: string) {
  const response = await request.post(`${MAIN_API}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { username, password },
  });
  const body = await response.json();
  return { response, body };
}

export async function loginAdmin(request: APIRequestContext) {
  return loginUser(request, 'admin', 'admin123');
}

export async function createAdminPublicDeck(request: APIRequestContext, token: string, data: { name: string; description: string; lang?: string; category?: string }) {
  const response = await request.post(`${MAIN_API}/admin/public-decks`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data,
  });
  return { response, body: await response.json() };
}
