// Simple API client wrapper used by frontend components (placeholder)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function get(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  return res.json();
}

export async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include'
  });
  return res.json();
}

export default { get, post };
